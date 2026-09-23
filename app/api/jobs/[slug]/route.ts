import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    slug: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Job slug is required" },
        { status: 400 }
      );
    }

    let env: any = null;
    try {
      const cfContext = await getCloudflareContext({ async: true });
      env = cfContext.env;
    } catch (cfErr) {
      console.warn("[ENV] Could not load Cloudflare context:", cfErr);
    }

    const db = env?.jobsearly_db;
    const apiKey = env?.ARTHA_API_KEY as string | undefined;

    // 1. Try D1 first
    if (db) {
      try {
        const result = await db
          .prepare(
            `
            SELECT
              id, slug, title, company, logo, description, city, state, country,
              job_type, salary_min, salary_max, salary_curr, exp_min, exp_max, exp_unit,
              skills, posted_date, url, created_at, updated_at
            FROM jobs
            WHERE slug = ?
            LIMIT 1
            `
          )
          .bind(slug)
          .first();

        if (result) {
          return NextResponse.json({
            success: true,
            job: result,
          });
        }
      } catch (d1Err) {
        console.warn("[D1] Slug query failed, falling back to Artha API:", d1Err);
      }
    }

    // 2. Fallback: Query Artha API directly for slug if not in D1
    if (apiKey) {
      console.log(`[API] Job slug "${slug}" not found in D1, fetching from Artha API...`);
      const arthaRes = await fetch(`https://api-india.artha.link/api/v1/jobs?search=${encodeURIComponent(slug)}`, {
        headers: {
          Accept: "application/json",
          "x-api-key": apiKey,
        },
        cache: "no-store",
      });

      if (arthaRes.ok) {
        const data = await arthaRes.json();
        const items = data?.data?.items || data?.jobs || data?.results || [];
        const match = items.find((j: any) => j.slug === slug) || items[0];

        if (match) {
          return NextResponse.json({
            success: true,
            job: {
              id: String(match.id || match.slug),
              slug: match.slug,
              title: match.title || "",
              company: match.company || "",
              logo: match.logo || null,
              description: match.description || "",
              city: match.city || match.location?.city || null,
              state: match.state || match.location?.state || null,
              country: match.country || match.location?.country || "IN",
              job_type: match.job_type || null,
              salary_min: match.salary?.min || match.salary_min || null,
              salary_max: match.salary?.max || match.salary_max || null,
              salary_curr: match.salary?.currency || match.salary_curr || null,
              exp_min: match.experience?.min || match.exp_min || null,
              exp_max: match.experience?.max || match.exp_max || null,
              exp_unit: match.experience?.unit || match.exp_unit || null,
              skills: Array.isArray(match.skills) ? JSON.stringify(match.skills) : match.skills || null,
              posted_date: match.posted_date || null,
              url: match.url || null,
            },
          });
        }
      }
    }

    return NextResponse.json(
      { success: false, error: "Job not found", slug },
      { status: 404 }
    );
  } catch (error) {
    console.error("GET /api/jobs/[slug] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to load job",
      },
      { status: 500 }
    );
  }
}
