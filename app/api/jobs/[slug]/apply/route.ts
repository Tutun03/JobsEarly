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
    const { searchParams } = request.nextUrl;

    const offsetParam = searchParams.get("offset");
    const limitParam = searchParams.get("limit") || "10";
    const directUrl = searchParams.get("url");

    console.log(`[APPLY] Fast Apply request for slug: "${slug}", offset: ${offsetParam}`);

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Job slug is required" },
        { status: 400 }
      );
    }

    // Direct redirect if valid signed URL was passed in query
    if (directUrl && directUrl.startsWith("http")) {
      console.log("[APPLY] Instant redirect using passed signed URL");
      return NextResponse.redirect(directUrl, 302);
    }

    let env: any = null;
    try {
      const cfContext = await getCloudflareContext({ async: true });
      env = cfContext.env;
    } catch (cfErr) {
      console.warn("[ENV] Cloudflare context error:", cfErr);
    }

    const apiKey = env?.ARTHA_API_KEY as string | undefined;
    let freshUrl: string | null = null;

    if (apiKey) {
      // If offset/limit provided, fetch that page directly; otherwise search by slug
      let arthaUrl = `${ARTHA_API}?search=${encodeURIComponent(slug)}`;
      if (offsetParam !== null && offsetParam !== undefined) {
        arthaUrl = `${ARTHA_API}?limit=${limitParam}&offset=${offsetParam}&location=IN`;
      }

      console.log(`[APPLY] Direct fetch fresh URL from Artha: ${arthaUrl}`);

      try {
        const response = await fetch(arthaUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "x-api-key": apiKey,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        });

        if (response.ok) {
          const data = (await response.json()) as ArthaResponse;
          const jobs = extractJobs(data);
          const match = jobs.find((j) => j.slug === slug) || jobs[0];

          if (match && match.url) {
            freshUrl = match.url;
            console.log("[APPLY] Found fresh signed URL directly from Artha in ~50ms!");
          }
        }
      } catch (fetchErr) {
        console.warn("[APPLY] Fast Artha fetch error:", fetchErr);
      }
    }

    // Fallback: Check D1 database if direct fetch didn't return a fresh URL
    const db = env?.jobsearly_db;
    if (!freshUrl && db) {
      try {
        const storedJob = await db
          .prepare(`SELECT url FROM jobs WHERE slug = ? LIMIT 1`)
          .bind(slug)
          .first() as { url: string | null } | null;

        if (storedJob?.url) {
          freshUrl = storedJob.url;
        }
      } catch (d1Err) {
        console.warn("[APPLY] D1 fallback query failed:", d1Err);
      }
    }

    // If still no URL, job is closed or expired
    if (!freshUrl) {
      console.warn("[APPLY] Job posting inactive or expired:", slug);
      return NextResponse.json(
        {
          success: false,
          error: "This job posting is no longer active or accepting applications.",
        },
        { status: 410 }
      );
    }

    // Update D1 out-of-band without delaying response
    if (db) {
      setTimeout(() => {
        db.prepare(`UPDATE jobs SET url = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?`)
          .bind(freshUrl, slug)
          .run()
          .catch((e: unknown) => console.warn("[APPLY] D1 URL update error:", e));
      }, 10);
    }

    console.log("[APPLY] Redirecting candidate to:", freshUrl);
    return NextResponse.redirect(freshUrl, 302);
  } catch (error) {
    console.error("[APPLY] ERROR:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to process application" },
      { status: 500 }
    );
  }
}
