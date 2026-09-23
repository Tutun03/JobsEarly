import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARTHA_API =
  "https://api-india.artha.link/api/v1/jobs";

/* =========================================================
   ARTHA TYPES
   ========================================================= */

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

/* =========================================================
   EXTRACT JOBS
   ========================================================= */

function extractJobs(data: ArthaResponse): ArthaJob[] {
  if (Array.isArray(data.jobs)) {
    return data.jobs;
  }

  if (Array.isArray(data.results)) {
    return data.results;
  }

  if (data.data && Array.isArray(data.data.items)) {
    return data.data.items;
  }

  if (data.data && Array.isArray(data.data.jobs)) {
    return data.data.jobs;
  }

  if (data.data && Array.isArray(data.data.results)) {
    return data.data.results;
  }

  return [];
}

/* =========================================================
   GET /api/jobs/[slug]/apply
   ========================================================= */

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;

    const { searchParams } = request.nextUrl;

    const offsetParam = searchParams.get("offset");
    const limitParam = searchParams.get("limit") || "10";

    /*
     * We keep reading the passed URL as a FINAL fallback.
     *
     * IMPORTANT:
     * We no longer immediately redirect using this URL because
     * it can be an old/expired Artha signed URL.
     */
    const directUrl = searchParams.get("url");

    console.log(
      `[APPLY] Apply request for slug: "${slug}", offset: ${offsetParam}`
    );

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: "Job slug is required",
        },
        { status: 400 }
      );
    }

    /* =======================================================
       OLD LOGIC - KEPT COMMENTED OUT
       ======================================================= */

    /*
    // OLD:
    // Immediately redirect using the URL passed from frontend.

    if (directUrl && directUrl.startsWith("http")) {
      console.log(
        "[APPLY] Instant redirect using passed signed URL"
      );

      return NextResponse.redirect(
        directUrl,
        302
      );
    }
    */

    /* =======================================================
       CLOUDFLARE CONTEXT
       ======================================================= */

    let env: any = null;

    try {
      const cfContext = await getCloudflareContext({
        async: true,
      });

      env = cfContext.env;
    } catch (cfErr) {
      console.warn(
        "[ENV] Cloudflare context error:",
        cfErr
      );
    }

    const apiKey =
      env?.ARTHA_API_KEY as string | undefined;

    let freshUrl: string | null = null;

    /* =======================================================
       1. GET FRESH SIGNED URL FROM ARTHA
       ======================================================= */

    if (apiKey) {
      /*
       * IMPORTANT:
       *
       * Always search Artha using the exact slug.
       *
       * We intentionally DO NOT use:
       *
       * limit + offset + jobs[0]
       *
       * because that could return the URL of another job.
       */

      const arthaUrl =
        `${ARTHA_API}?search=${encodeURIComponent(slug)}`;

      console.log(
        `[APPLY] Fetching fresh job from Artha: ${arthaUrl}`
      );

      try {
        const response = await fetch(
          arthaUrl,
          {
            method: "GET",

            headers: {
              Accept: "application/json",
              "x-api-key": apiKey,
            },

            cache: "no-store",

            signal:
              AbortSignal.timeout(5000),
          }
        );

        console.log(
          `[APPLY] Artha response status: ${response.status}`
        );

        if (response.ok) {
          const data =
            (await response.json()) as ArthaResponse;

          const jobs =
            extractJobs(data);

          console.log(
            `[APPLY] Artha returned ${jobs.length} jobs`
          );

          /*
           * Find ONLY the requested job.
           *
           * Do NOT fallback to jobs[0].
           */

          const match =
            jobs.find(
              (job) => job.slug === slug
            );

          if (match?.url) {
            freshUrl = match.url;

            console.log(
              "[APPLY] Fresh signed URL found from Artha"
            );
          } else {
            console.warn(
              "[APPLY] Matching job or URL not found in Artha response"
            );
          }
        } else {
          const errorText =
            await response.text();

          console.warn(
            `[APPLY] Artha returned ${response.status}: ${errorText}`
          );
        }
      } catch (fetchErr) {
        console.warn(
          "[APPLY] Fresh Artha fetch failed:",
          fetchErr
        );
      }
    } else {
      console.warn(
        "[APPLY] ARTHA_API_KEY is missing"
      );
    }

    /* =======================================================
       OLD ARTHA LOGIC - KEPT COMMENTED OUT
       ======================================================= */

    /*
    // OLD LOGIC:
    //
    // This used offset/limit when they were supplied.
    // That could fetch a page which does not contain
    // the requested slug.
    //
    // Then it used jobs[0] as a fallback.

    let arthaUrl =
      `${ARTHA_API}?search=${encodeURIComponent(slug)}`;

    if (
      offsetParam !== null &&
      offsetParam !== undefined
    ) {
      arthaUrl =
        `${ARTHA_API}?limit=${limitParam}` +
        `&offset=${offsetParam}` +
        `&location=IN`;
    }

    const response = await fetch(
      arthaUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-api-key": apiKey,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      }
    );

    if (response.ok) {
      const data =
        (await response.json()) as ArthaResponse;

      const jobs =
        extractJobs(data);

      const match =
        jobs.find(
          (j) => j.slug === slug
        ) || jobs[0];

      if (match && match.url) {
        freshUrl = match.url;
      }
    }
    */

    /* =======================================================
       2. D1 FALLBACK
       ======================================================= */

    const db =
      env?.jobsearly_db;

    if (!freshUrl && db) {
      try {
        console.log(
          `[APPLY] Artha fresh URL unavailable. Checking D1 for slug: ${slug}`
        );

        const storedJob =
          (await db
            .prepare(
              `SELECT url
               FROM jobs
               WHERE slug = ?
               LIMIT 1`
            )
            .bind(slug)
            .first()) as
              | { url: string | null }
              | null;

        if (storedJob?.url) {
          freshUrl =
            storedJob.url;

          console.log(
            "[APPLY] Using D1 URL as fallback"
          );
        } else {
          console.warn(
            "[APPLY] No URL found in D1"
          );
        }
      } catch (d1Err) {
        console.warn(
          "[APPLY] D1 fallback query failed:",
          d1Err
        );
      }
    }

    /* =======================================================
       3. PASSED URL FINAL FALLBACK
       ======================================================= */

    /*
     * Only use the URL passed by the frontend if:
     *
     * 1. Artha didn't give us a fresh URL
     * 2. D1 didn't give us a URL
     *
     * This preserves the old behavior as a fallback.
     */

    if (
      !freshUrl &&
      directUrl &&
      directUrl.startsWith("http")
    ) {
      freshUrl =
        directUrl;

      console.log(
        "[APPLY] Using passed URL as final fallback"
      );
    }

    /* =======================================================
       4. NO URL FOUND
       ======================================================= */

    if (!freshUrl) {
      console.warn(
        "[APPLY] Job posting inactive or URL unavailable:",
        slug
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "This job posting is no longer active or accepting applications.",
        },
        { status: 410 }
      );
    }

    /* =======================================================
       5. UPDATE D1 WITH FRESH ARTHA URL
       ======================================================= */

    /*
     * If Artha returned a fresh URL, update D1.
     *
     * We keep the old setTimeout approach commented out
     * because Cloudflare Workers should use waitUntil()
     * for background work.
     */

    if (
      db &&
      freshUrl
    ) {
      try {
        /*
         * For this Apply request, we update D1 directly.
         *
         * This ensures the new signed URL is actually
         * written before the Worker finishes.
         */

        await db
          .prepare(
            `UPDATE jobs
             SET url = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE slug = ?`
          )
          .bind(
            freshUrl,
            slug
          )
          .run();

        console.log(
          "[APPLY] D1 URL updated successfully"
        );
      } catch (d1UpdateErr) {
        console.warn(
          "[APPLY] D1 URL update failed:",
          d1UpdateErr
        );
      }
    }

    /* =======================================================
       OLD D1 UPDATE LOGIC - KEPT COMMENTED OUT
       ======================================================= */

    /*
    // OLD:
    // Cloudflare Worker could finish before this setTimeout
    // operation executes.

    if (db) {
      setTimeout(() => {
        db
          .prepare(
            `UPDATE jobs
             SET url = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE slug = ?`
          )
          .bind(
            freshUrl,
            slug
          )
          .run()
          .catch(
            (e: unknown) =>
              console.warn(
                "[APPLY] D1 URL update error:",
                e
              )
          );
      }, 10);
    }
    */

    /* =======================================================
       6. FINAL REDIRECT
       ======================================================= */

    console.log(
      "[APPLY] Redirecting candidate to:",
      freshUrl
    );

    return NextResponse.redirect(
      freshUrl,
      302
    );
  } catch (error) {
    console.error(
      "[APPLY] ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to process application",
      },
      { status: 500 }
    );
  }
}