import { NextRequest, NextResponse } from "next/server";

const ARTHA_API_URL =
  "https://api-india.artha.link/api/v1/jobs";

interface Job {
  id: string;
  slug: string;
  title: string;
  company: string;
  logo: string;
  description: string;
  city: string | null;
  state: string | null;
  country: string;
  job_type: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_curr: string | null;
  exp_min: number;
  exp_max: number;
  exp_unit: string;
  skills: string[];
  posted_date: string;
  url: string;
}

interface ArthaResponse {
  success?: boolean;

  data?: {
    items?: Job[];
    total?: number;
    limit?: number;
    offset?: number;
    has_more?: boolean;
  };

  message?: string;
}

/*
 * ============================================================
 * RETRY SETTINGS
 * ============================================================
 */

const MAX_ATTEMPTS = 3;

const RETRY_DELAYS = [
  0,
  500,
  1000,
];

/*
 * ============================================================
 * GET JOB
 * ============================================================
 */

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
    }>;
  }
) {
  try {
    const { slug } = await context.params;

    /*
     * ========================================================
     * API KEY
     * ========================================================
     */

    const apiKey =
      process.env.ARTHA_API_KEY || "";

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ARTHA_API_KEY is not configured",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ========================================================
     * DECODE SLUG
     * ========================================================
     */

    let requestedSlug = slug;

    try {
      requestedSlug =
        decodeURIComponent(slug);
    } catch {
      requestedSlug = slug;
    }

    console.log(
      "Requested job slug:",
      requestedSlug
    );

    /*
     * ========================================================
     * RETRY ARTHA
     * ========================================================
     */

    for (
      let attempt = 0;
      attempt < MAX_ATTEMPTS;
      attempt++
    ) {
      /*
       * Wait before retry
       */

      if (RETRY_DELAYS[attempt] > 0) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            RETRY_DELAYS[attempt]
          )
        );
      }

      console.log(
        `Artha attempt ${attempt + 1}/${MAX_ATTEMPTS}`
      );

      /*
       * ======================================================
       * BUILD ARTHA URL
       * ======================================================
       */

      const apiUrl =
        new URL(ARTHA_API_URL);

      apiUrl.searchParams.set(
        "q",
        requestedSlug
      );

      apiUrl.searchParams.set(
        "limit",
        "100"
      );

      apiUrl.searchParams.set(
        "location",
        "IN"
      );

      /*
       * ======================================================
       * CALL ARTHA
       * ======================================================
       */

      let response: Response;

      try {
        response = await fetch(
          apiUrl.toString(),
          {
            method: "GET",

            headers: {
              "X-API-Key": apiKey,
              Accept:
                "application/json",
            },

            cache: "no-store",
          }
        );
      } catch (error) {
        console.error(
          "Artha network error:",
          error
        );

        continue;
      }

      let data: ArthaResponse;

      try {
        data =
          await response.json();
      } catch (error) {
        console.error(
          "Artha JSON parsing error:",
          error
        );

        continue;
      }

      /*
       * ======================================================
       * ARTHA HTTP ERROR
       * ======================================================
       */

      if (!response.ok) {
        console.error(
          "Artha API error:",
          response.status,
          data
        );

        /*
         * Retry instead of immediately
         * returning 404/500.
         */

        continue;
      }

      /*
       * ======================================================
       * GET JOBS
       * ======================================================
       */

      const jobs =
        Array.isArray(
          data?.data?.items
        )
          ? data.data.items
          : [];

      console.log(
        `Artha returned ${jobs.length} jobs on attempt ${
          attempt + 1
        }`
      );

      /*
       * ======================================================
       * EXACT SLUG MATCH
       * ======================================================
       */

      const exactMatch =
        jobs.find(
          (job) =>
            job?.slug ===
            requestedSlug
        );

      /*
       * ======================================================
       * CASE INSENSITIVE MATCH
       * ======================================================
       */

      const caseInsensitiveMatch =
        jobs.find(
          (job) =>
            job?.slug
              ?.toLowerCase() ===
            requestedSlug.toLowerCase()
        );

      const job =
        exactMatch ||
        caseInsensitiveMatch ||
        null;

      /*
       * ======================================================
       * SUCCESS
       * ======================================================
       */

      if (job) {
        console.log(
          "JOB FOUND:",
          job.slug
        );

        /*
         * ====================================================
         * CACHE SUCCESSFUL RESPONSE
         * ====================================================
         *
         * Cache-Control tells Cloudflare/CDN that this
         * successful job response can be reused.
         *
         * 1 hour fresh
         * 24 hours stale-while-revalidate
         */

        return NextResponse.json(
          {
            success: true,
            data: job,
          },
          {
            status: 200,

            headers: {
              "Cache-Control":
                "public, s-maxage=3600, stale-while-revalidate=86400",
            },
          }
        );
      }

      /*
       * ======================================================
       * JOB NOT FOUND ON THIS ATTEMPT
       * ======================================================
       */

      console.log(
        `Exact slug not found on attempt ${
          attempt + 1
        }`
      );

      /*
       * IMPORTANT:
       *
       * DO NOT return 404 here.
       *
       * Retry Artha.
       */
    }

    /*
     * ========================================================
     * ALL RETRIES FAILED
     * ========================================================
     */

    console.error(
      "JOB NOT FOUND AFTER ALL RETRIES:",
      requestedSlug
    );

    return NextResponse.json(
      {
        success: false,
        error: "Job not found",
      },
      {
        status: 404,

        /*
         * NEVER CACHE THIS 404.
         */

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "Job detail API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to fetch job",
      },
      {
        status: 500,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}