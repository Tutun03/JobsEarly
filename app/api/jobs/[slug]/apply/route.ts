import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARTHA_API =
  "https://api-india.artha.link/api/v1/jobs";

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
    limit?: number;
    offset?: number;
    has_more?: boolean;
  };

  total?: number;
  has_more?: boolean;

  error?: {
    code?: string;
    message?: string;
  };
}

interface RouteContext {
  params: Promise<{
    slug: string;
  }>;
}

/* =========================================================
   EXTRACT JOBS FROM ARTHA RESPONSE
   ========================================================= */

function extractJobs(
  data: ArthaResponse
): ArthaJob[] {

  if (Array.isArray(data.jobs)) {
    return data.jobs;
  }

  if (Array.isArray(data.results)) {
    return data.results;
  }

  if (
    data.data &&
    Array.isArray(data.data.items)
  ) {
    return data.data.items;
  }

  if (
    data.data &&
    Array.isArray(data.data.jobs)
  ) {
    return data.data.jobs;
  }

  if (
    data.data &&
    Array.isArray(data.data.results)
  ) {
    return data.data.results;
  }

  return [];
}

/* =========================================================
   FETCH FRESH JOBS FROM ARTHA
   ========================================================= */

async function fetchFreshArthaJobs(
  apiKey: string,
  location: string
): Promise<ArthaJob | null> {

  /*
   * IMPORTANT:
   *
   * We intentionally fetch from Artha at click time.
   *
   * We do NOT use the old URL stored in D1.
   *
   * This is necessary because the Artha redirect URL
   * may be signed and expire.
   */

  const limit = 100;
  let offset = 0;

  /*
   * Safety limit.
   *
   * We don't want an Apply click to make hundreds
   * of API requests.
   */
  const maxPages = 10;

  for (
    let page = 0;
    page < maxPages;
    page++
  ) {

    const url =
      `${ARTHA_API}?limit=${limit}` +
      `&offset=${offset}` +
      `&location=${encodeURIComponent(location)}`;

    console.log(
      "[APPLY] Fetching fresh Artha jobs:",
      {
        page: page + 1,
        offset,
        location,
      }
    );

    const response = await fetch(
      url,
      {
        method: "GET",

        headers: {
          Accept: "application/json",
          "x-api-key": apiKey,
        },

        /*
         * VERY IMPORTANT.
         *
         * Do not allow Next.js/Cloudflare to reuse
         * an old Artha response.
         */
        cache: "no-store",
      }
    );

    const responseText =
      await response.text();

    if (!response.ok) {
      console.error(
        "[APPLY] Artha API failed:",
        response.status,
        responseText
      );

      throw new Error(
        `Artha API returned ${response.status}`
      );
    }

    let data: ArthaResponse;

    try {
      data =
        JSON.parse(
          responseText
        ) as ArthaResponse;
    } catch {
      throw new Error(
        "Artha API returned invalid JSON"
      );
    }

    if (data.success === false) {
      throw new Error(
        data.error?.message ??
          data.message ??
          "Artha API returned success=false"
      );
    }

    const jobs =
      extractJobs(data);

    console.log(
      "[APPLY] Fresh Artha jobs received:",
      jobs.length
    );

    /*
     * Find EXACT slug.
     */
    const matchingJob =
      jobs.find(
        (job) =>
          job.slug ===
          (
            // slug will be checked by caller
            ""
          )
      );

    /*
     * We don't know the requested slug here,
     * so this function is intentionally replaced
     * below by the slug-aware implementation.
     */

    void matchingJob;

    const hasMore =
      data.data?.has_more ??
      data.has_more ??
      false;

    if (!hasMore || jobs.length === 0) {
      break;
    }

    offset += limit;
  }

  return null;
}

/* =========================================================
   GET APPLY REDIRECT
   ========================================================= */

export async function GET(
  request: NextRequest,
  context: RouteContext
) {

  try {

    const { slug } =
      await context.params;

    console.log(
      "=========================================="
    );

    console.log(
      "[APPLY] START"
    );

    console.log(
      "[APPLY] Requested slug:",
      slug
    );

    console.log(
      "=========================================="
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
      await getCloudflareContext({
        async: true,
      });

    const db =
      env.jobsearly_db;

    if (!db) {
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
     * Get the job from D1 ONLY to determine
     * its location.
     *
     * DO NOT use D1.url for the redirect.
     */

    const storedJob =
      await db
        .prepare(
          `
          SELECT
            slug,
            title,
            company,
            country
          FROM jobs
          WHERE slug = ?
          LIMIT 1
          `
        )
        .bind(slug)
        .first<{
          slug: string;
          title: string;
          company: string;
          country: string | null;
        }>();

    if (!storedJob) {

      console.warn(
        "[APPLY] Job not found in D1:",
        slug
      );

      return NextResponse.json(
        {
          success: false,
          error: "Job not found",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Get Artha API key.
     */

    const cloudflareEnv =
      env as unknown as {
        ARTHA_API_KEY?: string;
      };

    const apiKey =
      cloudflareEnv.ARTHA_API_KEY;

    if (!apiKey) {

      console.error(
        "[APPLY] ARTHA_API_KEY missing"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "ARTHA_API_KEY is missing",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Use the stored country for the Artha request.
     */

    const location =
      storedJob.country || "IN";

    /*
     * ----------------------------------------------------
     * FETCH FRESH ARTHA DATA
     * ----------------------------------------------------
     */

    let freshJob: ArthaJob | null =
      null;

    const limit = 100;
    let offset = 0;
    const maxPages = 10;

    for (
      let page = 0;
      page < maxPages;
      page++
    ) {

      const arthaUrl =
        `${ARTHA_API}?limit=${limit}` +
        `&offset=${offset}` +
        `&location=${encodeURIComponent(
          location
        )}`;

      console.log(
        "[APPLY] Fetching fresh Artha URL:",
        arthaUrl
      );

      const response =
        await fetch(
          arthaUrl,
          {
            method: "GET",

            headers: {
              Accept:
                "application/json",

              "x-api-key":
                apiKey,
            },

            cache: "no-store",
          }
        );

      const responseText =
        await response.text();

      if (!response.ok) {

        console.error(
          "[APPLY] Artha error:",
          response.status,
          responseText
        );

        throw new Error(
          `Artha API returned ${response.status}`
        );
      }

      let data: ArthaResponse;

      try {

        data =
          JSON.parse(
            responseText
          ) as ArthaResponse;

      } catch {

        throw new Error(
          "Artha API returned invalid JSON"
        );
      }

      if (
        data.success === false
      ) {

        throw new Error(
          data.error?.message ??
            data.message ??
            "Artha API returned success=false"
        );
      }

      const jobs =
        extractJobs(data);

      /*
       * EXACT MATCH
       */

      freshJob =
        jobs.find(
          (job) =>
            job.slug === slug
        ) ?? null;

      if (freshJob) {
        break;
      }

      const hasMore =
        data.data?.has_more ??
        data.has_more ??
        false;

      if (
        !hasMore ||
        jobs.length === 0
      ) {
        break;
      }

      offset += limit;
    }

    /*
     * ----------------------------------------------------
     * JOB NOT FOUND IN FRESH ARTHA DATA
     * ----------------------------------------------------
     */

    if (!freshJob) {

      console.error(
        "[APPLY] Job was not found in fresh Artha data:",
        slug
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Job is no longer available from Artha",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ----------------------------------------------------
     * FRESH ARTHA URL
     * ----------------------------------------------------
     */

    const freshUrl =
      freshJob.url;

    if (!freshUrl) {

      console.error(
        "[APPLY] Artha returned no URL:",
        slug
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Artha did not provide an application URL",
        },
        {
          status: 404,
        }
      );
    }

    console.log(
      "[APPLY] Fresh Artha URL obtained"
    );

    console.log(
      "[APPLY] Job:",
      freshJob.title
    );

    console.log(
      "[APPLY] Company:",
      freshJob.company
    );

    /*
     * ----------------------------------------------------
     * UPDATE D1 WITH FRESH URL
     * ----------------------------------------------------
     *
     * This means the next request will also have
     * the newest URL available in D1.
     */

    await db
      .prepare(
        `
        UPDATE jobs
        SET
          url = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE slug = ?
        `
      )
      .bind(
        freshUrl,
        slug
      )
      .run();

    console.log(
      "[APPLY] D1 URL refreshed"
    );

    /*
     * ----------------------------------------------------
     * REDIRECT THROUGH ARTHA
     * ----------------------------------------------------
     *
     * NEVER replace this with LinkedIn.
     */

    console.log(
      "[APPLY] Redirecting through Artha"
    );

    return NextResponse.redirect(
      freshUrl,
      302
    );

  } catch (error) {

    console.error(
      "=========================================="
    );

    console.error(
      "[APPLY] ERROR"
    );

    console.error(
      error
    );

    console.error(
      "=========================================="
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to process application",
      },
      {
        status: 500,
      }
    );
  }
}