import { NextRequest, NextResponse } from "next/server";

const ARTHA_API_URL =
  "https://api-india.artha.link/api/v1/jobs";

/*
 * ============================================================
 * CHANGE ONLY THIS NUMBER WHEN YOU WANT MORE/FEWER JOBS
 * ============================================================
 *
 * 30 jobs -> 3 pages
 * 40 jobs -> 4 pages
 * 50 jobs -> 5 pages
 *
 * Homepage automatically calculates the pages.
 */
const MAX_JOBS = 70;

/*
 * Maximum jobs requested from Artha in one API call.
 *
 * If MAX_JOBS = 40:
 *
 * Request 1:
 * limit = 30
 * offset = 0
 *
 * Request 2:
 * limit = 10
 * offset = 30
 *
 * Total = 40
 */
const BATCH_SIZE = 70;

interface ArthaResponse {
  success?: boolean;

  data?: {
    items?: any[];
    total?: number;
    limit?: number;
    offset?: number;
    has_more?: boolean;
  };

  message?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const location =
      searchParams.get("location") || "IN";

    const apiKey =
      process.env.ARTHA_API_KEY || "";

    /*
     * ==========================================================
     * CHECK API KEY
     * ==========================================================
     */

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
     * ==========================================================
     * FETCH JOBS IN BATCHES
     * ==========================================================
     *
     * Example for MAX_JOBS = 40:
     *
     * Batch 1:
     *   limit  = 30
     *   offset = 0
     *
     * Batch 2:
     *   limit  = 10
     *   offset = 30
     *
     * Final:
     *   40 jobs
     *
     * If later you change MAX_JOBS to 50:
     *
     * Batch 1:
     *   limit  = 30
     *   offset = 0
     *
     * Batch 2:
     *   limit  = 20
     *   offset = 30
     *
     * Final:
     *   50 jobs
     */

    const allItems: any[] = [];

    let offset = 0;

    while (allItems.length < MAX_JOBS) {
      const remaining =
        MAX_JOBS - allItems.length;

      const batchLimit = Math.min(
        BATCH_SIZE,
        remaining
      );

      /*
       * Build Artha API URL
       */

      const apiUrl =
        new URL(ARTHA_API_URL);

      apiUrl.searchParams.set(
        "limit",
        batchLimit.toString()
      );

      apiUrl.searchParams.set(
        "offset",
        offset.toString()
      );

      apiUrl.searchParams.set(
        "location",
        location
      );

      console.log(
        `Fetching Artha jobs: limit=${batchLimit}, offset=${offset}, location=${location}`
      );

      /*
       * Call Artha
       */

      const response = await fetch(
        apiUrl.toString(),
        {
          method: "GET",

          headers: {
            "X-API-Key": apiKey,
            Accept: "application/json",
          },

          cache: "no-store",
        }
      );

      const data: ArthaResponse =
        await response.json();

      /*
       * ========================================================
       * HANDLE ARTHA API ERROR
       * ========================================================
       */

      if (!response.ok) {
        console.error(
          "Artha Jobs API Error:",
          response.status,
          data
        );

        return NextResponse.json(
          {
            success: false,
            error: data,
          },
          {
            status: response.status,
          }
        );
      }

      /*
       * ========================================================
       * GET ITEMS
       * ========================================================
       */

      const items =
        Array.isArray(
          data?.data?.items
        )
          ? data.data.items
          : [];

      console.log(
        `Artha returned ${items.length} jobs for offset=${offset}`
      );

      /*
       * No jobs returned.
       * There is nothing more to fetch.
       */

      if (items.length === 0) {
        break;
      }

      /*
       * Add jobs to combined list.
       */

      allItems.push(...items);

      /*
       * Move offset forward.
       */

      offset += items.length;

      /*
       * If Artha returned fewer jobs than requested,
       * we have probably reached the end.
       */

      if (items.length < batchLimit) {
        break;
      }
    }

    /*
     * ==========================================================
     * LIMIT FINAL RESULT
     * ==========================================================
     *
     * This guarantees that even if Artha unexpectedly
     * returns extra jobs, our application exposes only
     * MAX_JOBS.
     */

    const finalItems =
      allItems.slice(
        0,
        MAX_JOBS
      );

    /*
     * ==========================================================
     * REMOVE DUPLICATES
     * ==========================================================
     *
     * Some APIs can occasionally return overlapping
     * results between batches.
     *
     * We use:
     *
     * 1. id
     * 2. slug
     * 3. company + title
     */

    const uniqueJobs =
      Array.from(
        new Map(
          finalItems.map(
            (job, index) => {
              const key =
                job?.id ||
                job?.slug ||
                `${job?.company}-${job?.title}-${index}`;

              return [
                key,
                job,
              ];
            }
          )
        ).values()
      ).slice(
        0,
        MAX_JOBS
      );

    console.log(
      "Combined jobs:",
      finalItems.length
    );

    console.log(
      "Unique jobs:",
      uniqueJobs.length
    );

    /*
     * ==========================================================
     * RETURN RESPONSE
     * ==========================================================
     */

    return NextResponse.json({
      success: true,

      data: {
        items: uniqueJobs,

        /*
         * IMPORTANT:
         *
         * total is the number of jobs actually
         * returned to the frontend.
         */

        total: uniqueJobs.length,

        limit: uniqueJobs.length,

        offset: 0,

        /*
         * We already fetched the complete set
         * requested by MAX_JOBS.
         */

        has_more: false,
      },

      message:
        `Fetched ${uniqueJobs.length} jobs`,
    });
  } catch (error) {
    console.error(
      "Jobs API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to fetch jobs",
      },
      {
        status: 500,
      }
    );
  }
}