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

    console.log(
      "Requested job slug:",
      slug
    );

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: "Job slug is required",
        },
        {
          status: 400,
        }
      );
    }

    const { env } =
      getCloudflareContext();

    const db = env.jobsearly_db;

    if (!db) {
      console.error(
        "D1 binding jobsearly_db is missing"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "D1 database binding is missing",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * IMPORTANT:
     *
     * Do NOT call Artha here.
     *
     * The homepage already stored this job
     * in D1.
     */

    const result = await db
      .prepare(
        `
        SELECT
          id,
          slug,
          title,
          company,
          logo,
          description,
          city,
          state,
          country,
          job_type,
          salary_min,
          salary_max,
          salary_curr,
          exp_min,
          exp_max,
          exp_unit,
          skills,
          posted_date,
          url,
          created_at,
          updated_at
        FROM jobs
        WHERE slug = ?
        LIMIT 1
        `
      )
      .bind(slug)
      .first();

    if (!result) {
      console.warn(
        "JOB NOT FOUND IN D1:",
        slug
      );

      return NextResponse.json(
        {
          success: false,
          error: "Job not found",
          slug,
        },
        {
          status: 404,
        }
      );
    }

    console.log(
      "JOB FOUND IN D1:",
      slug
    );

    return NextResponse.json({
      success: true,
      job: result,
    });
  } catch (error) {
    console.error(
      "GET /api/jobs/[slug] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load job",
      },
      {
        status: 500,
      }
    );
  }
}