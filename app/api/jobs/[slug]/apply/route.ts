import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARTHA_API = "https://api-india.artha.link/api/v1/jobs";

interface ArthaJob {
  id?: string | number;
  slug?: string;
  title?: string;
  company?: string;
  url?: string;
  country?: string;
  location?: {
    country?: string;
    city?: string;
    state?: string;
  };
}

interface ArthaResponse {
  success?: boolean;
  message?: string;
  jobs?: ArthaJob[];
  results?: ArthaJob[];
  data?: {
    items?: ArthaJob[];
    jobs?: ArthaJob[];
    results?: ArthaJob[];
    total?: number;
    has_more?: boolean;
  };
  total?: number;
  has_more?: boolean;
}

interface RouteContext {
  params: Promise<{
    slug: string;
  }>;
}

function extractJobs(data: ArthaResponse): ArthaJob[] {
  if (Array.isArray(data.jobs)) return data.jobs;
  if (Array.isArray(data.results)) return data.results;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (data.data && Array.isArray(data.data.jobs)) return data.data.jobs;
  if (data.data && Array.isArray(data.data.results)) return data.data.results;
  return [];
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;

    console.log("==========================================");
    console.log("[APPLY] Requested slug:", slug);
    console.log("==========================================");

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Job slug is required" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = env.jobsearly_db;

    if (!db) {
      return NextResponse.json(
        { success: false, error: "D1 database binding is missing" },
        { status: 500 }
      );
    }

    // 1. Get stored job from D1
    const storedJob = await db
      .prepare(`SELECT slug, title, company, country, url FROM jobs WHERE slug = ? LIMIT 1`)
      .bind(slug)
      .first<{ slug: string; title: string; company: string; country: string | null; url: string | null }>();

    if (!storedJob) {
      console.warn("[APPLY] Job not found in D1:", slug);
      return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
    }

    const cloudflareEnv = env as unknown as { ARTHA_API_KEY?: string };
    const apiKey = cloudflareEnv.ARTHA_API_KEY;
    const location = storedJob.country || "IN";

    let freshUrl: string | null = null;

    // 2. Fetch fresh signed URL from active Artha API feed
    if (apiKey) {
      const limit = 100;
      const maxPages = 3;

      for (let page = 0; page < maxPages; page++) {
        const offset = page * limit;
        const arthaUrl = `${ARTHA_API}?limit=${limit}&offset=${offset}&location=${encodeURIComponent(location)}`;

        console.log(`[APPLY] Fetching fresh Artha URL (page ${page + 1}):`, arthaUrl);

        try {
          const response = await fetch(arthaUrl, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "x-api-key": apiKey,
            },
            cache: "no-store",
            signal: AbortSignal.timeout(4000),
          });

          if (!response.ok) {
            console.warn(`[APPLY] Artha API returned status ${response.status}`);
            break;
          }

          const responseText = await response.text();
          const data = JSON.parse(responseText) as ArthaResponse;

          if (data.success === false) break;

          const jobs = extractJobs(data);
          const freshJob = jobs.find((j) => j.slug === slug);

          if (freshJob && freshJob.url) {
            freshUrl = freshJob.url;
            console.log(`[APPLY] Found fresh signed URL from Artha API on page ${page + 1}`);
            break;
          }

          const hasMore = data.data?.has_more ?? data.has_more ?? false;
          if (!hasMore || jobs.length === 0) break;
        } catch (fetchErr) {
          console.warn("[APPLY] Fresh Artha fetch warning:", fetchErr instanceof Error ? fetchErr.message : fetchErr);
          break;
        }
      }
    }

    // 3. Handle expired / inactive jobs
    if (!freshUrl) {
      console.warn("[APPLY] Job is no longer active in Artha feed:", slug);

      // Clean up expired job from D1 so it doesn't linger
      db.prepare(`DELETE FROM jobs WHERE slug = ?`)
        .bind(slug)
        .run()
        .catch((e: unknown) => console.warn("[APPLY] Failed to delete expired D1 job:", e));

      return NextResponse.json(
        {
          success: false,
          error: "This job posting is no longer active or accepting applications.",
        },
        { status: 410 }
      );
    }

    // Update D1 with fresh URL
    db.prepare(`UPDATE jobs SET url = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?`)
      .bind(freshUrl, slug)
      .run()
      .catch((e: unknown) => console.warn("[APPLY] Failed to update D1 url:", e));

    console.log("[APPLY] Redirecting candidate with fresh signed URL to:", freshUrl);
    return NextResponse.redirect(freshUrl, 302);

  } catch (error) {
    console.error("==========================================");
    console.error("[APPLY] ERROR:", error);
    console.error("==========================================");

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to process application" },
      { status: 500 }
    );
  }
}
