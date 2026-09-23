import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

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
  logo?: string;
  description?: string;

  location?: {
    city?: string;
    state?: string;
    country?: string;
  };

  city?: string;
  state?: string;
  country?: string;

  job_type?: string;

  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };

  salary_min?: number;
  salary_max?: number;
  salary_curr?: string;

  experience?: {
    min?: number;
    max?: number;
    unit?: string;
  };

  exp_min?: number;
  exp_max?: number;
  exp_unit?: string;

  skills?: string[] | string;

  posted_date?: string;
  url?: string;
}

/*
 * Actual Artha response structure:
 *
 * {
 *   success: true,
 *   message: "...",
 *   data: {
 *     items: [...],
 *     total: 103,
 *     limit: 100,
 *     offset: 0,
 *     has_more: true
 *   }
 * }
 */

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

    pagination?: {
      total?: number;
      has_more?: boolean;
    };
  };

  total?: number;

  has_more?: boolean;

  pagination?: {
    total?: number;
    has_more?: boolean;
  };

  error?: {
    code?: string;
    message?: string;
  };
}

/* =========================================================
   NORMALIZED JOB
   ========================================================= */

interface NormalizedJob {
  id: string;
  slug: string;
  title: string;
  company: string;
  logo: string | null;
  description: string;

  city: string | null;
  state: string | null;
  country: string;

  job_type: string | null;

  salary_min: number | null;
  salary_max: number | null;
  salary_curr: string | null;

  exp_min: number | null;
  exp_max: number | null;
  exp_unit: string | null;

  skills: string | null;

  posted_date: string | null;
  url: string | null;
}

/* =========================================================
   NORMALIZE JOB
   ========================================================= */

function normalizeJob(
  job: ArthaJob
): NormalizedJob | null {
  if (!job.slug) {
    console.warn(
      "[NORMALIZE] Skipping job because slug is missing"
    );

    return null;
  }

  const id = String(
    job.id ?? job.slug
  );

  const location =
    job.location ?? {};

  const salaryMin =
    job.salary?.min ??
    job.salary_min ??
    null;

  const salaryMax =
    job.salary?.max ??
    job.salary_max ??
    null;

  const salaryCurr =
    job.salary?.currency ??
    job.salary_curr ??
    null;

  const expMin =
    job.experience?.min ??
    job.exp_min ??
    null;

  const expMax =
    job.experience?.max ??
    job.exp_max ??
    null;

  const expUnit =
    job.experience?.unit ??
    job.exp_unit ??
    null;

  let skills: string | null = null;

  if (Array.isArray(job.skills)) {
    skills = JSON.stringify(
      job.skills
    );
  } else if (
    typeof job.skills === "string"
  ) {
    skills = job.skills;
  }

  const normalized: NormalizedJob = {
    id,

    slug: job.slug,

    title:
      job.title ?? "",

    company:
      job.company ?? "",

    logo:
      job.logo ?? null,

    description:
      job.description ?? "",

    city:
      job.city ??
      location.city ??
      null,

    state:
      job.state ??
      location.state ??
      null,

    country:
      job.country ??
      location.country ??
      "IN",

    job_type:
      job.job_type ??
      null,

    salary_min:
      salaryMin,

    salary_max:
      salaryMax,

    salary_curr:
      salaryCurr,

    exp_min:
      expMin,

    exp_max:
      expMax,

    exp_unit:
      expUnit,

    skills,

    posted_date:
      job.posted_date ??
      null,

    url:
      job.url ??
      null,
  };

  return normalized;
}

/* =========================================================
   SAVE JOBS TO D1
   ========================================================= */

async function saveJobs(
  db: D1Database,
  jobs: ArthaJob[]
) {
  console.log(
    "=============================================="
  );

  console.log(
    "[D1] saveJobs() called"
  );

  console.log(
    "[D1] Jobs received:",
    jobs.length
  );

  console.log(
    "=============================================="
  );

  if (!Array.isArray(jobs)) {
    console.error(
      "[D1] ERROR: jobs is not an array:",
      jobs
    );

    return;
  }

  let savedCount = 0;
  let skippedCount = 0;

  for (
    const rawJob of jobs
  ) {
    const job =
      normalizeJob(rawJob);

    if (!job) {
      skippedCount++;

      continue;
    }

    try {
      await db
        .prepare(
          `
          INSERT INTO jobs (
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
            url
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

          ON CONFLICT(slug)
          DO UPDATE SET
            title = excluded.title,
            company = excluded.company,
            logo = excluded.logo,
            description = excluded.description,
            city = excluded.city,
            state = excluded.state,
            country = excluded.country,
            job_type = excluded.job_type,
            salary_min = excluded.salary_min,
            salary_max = excluded.salary_max,
            salary_curr = excluded.salary_curr,
            exp_min = excluded.exp_min,
            exp_max = excluded.exp_max,
            exp_unit = excluded.exp_unit,
            skills = excluded.skills,
            posted_date = excluded.posted_date,
            url = excluded.url,
            updated_at = CURRENT_TIMESTAMP
          `
        )
        .bind(
          job.id,
          job.slug,
          job.title,
          job.company,
          job.logo,
          job.description,
          job.city,
          job.state,
          job.country,
          job.job_type,
          job.salary_min,
          job.salary_max,
          job.salary_curr,
          job.exp_min,
          job.exp_max,
          job.exp_unit,
          job.skills,
          job.posted_date,
          job.url
        )
        .run();

      savedCount++;

      /*
       * Log only first few jobs to avoid flooding terminal.
       */
      if (savedCount <= 3) {
        console.log(
          `[D1] Saved job ${savedCount}:`,
          {
            id: job.id,
            slug: job.slug,
            title: job.title,
            company: job.company,
            country: job.country,
          }
        );
      }
    } catch (error) {
      console.error(
        "[D1] Failed to save job:",
        {
          id: job.id,
          slug: job.slug,
          title: job.title,
        },
        error
      );

      throw error;
    }
  }

  console.log(
    "=============================================="
  );

  console.log(
    "[D1] SAVE COMPLETE"
  );

  console.log(
    "[D1] Saved:",
    savedCount
  );

  console.log(
    "[D1] Skipped:",
    skippedCount
  );

  console.log(
    "=============================================="
  );
}

/* =========================================================
   EXTRACT JOBS FROM ARTHA RESPONSE
   ========================================================= */

function extractArthaJobs(
  data: ArthaResponse
): ArthaJob[] {
  console.log(
    "=============================================="
  );

  console.log(
    "[ARTHA] Starting job extraction..."
  );

  /*
   * 1. data.jobs
   */
  if (
    Array.isArray(data.jobs)
  ) {
    console.log(
      "[ARTHA] Found jobs at data.jobs:",
      data.jobs.length
    );

    return data.jobs;
  }

  /*
   * 2. data.results
   */
  if (
    Array.isArray(data.results)
  ) {
    console.log(
      "[ARTHA] Found jobs at data.results:",
      data.results.length
    );

    return data.results;
  }

  /*
   * 3. IMPORTANT:
   *
   * Actual Artha API structure:
   *
   * data.data.items
   *
   */
  if (
    data.data &&
    Array.isArray(
      data.data.items
    )
  ) {
    console.log(
      "[ARTHA] Found jobs at data.data.items:",
      data.data.items.length
    );

    return data.data.items;
  }

  /*
   * 4. data.data.jobs
   */
  if (
    data.data &&
    Array.isArray(
      data.data.jobs
    )
  ) {
    console.log(
      "[ARTHA] Found jobs at data.data.jobs:",
      data.data.jobs.length
    );

    return data.data.jobs;
  }

  /*
   * 5. data.data.results
   */
  if (
    data.data &&
    Array.isArray(
      data.data.results
    )
  ) {
    console.log(
      "[ARTHA] Found jobs at data.data.results:",
      data.data.results.length
    );

    return data.data.results;
  }

  console.error(
    "[ARTHA] NO JOB ARRAY FOUND!"
  );

  console.error(
    "[ARTHA] Top-level keys:",
    Object.keys(data)
  );

  if (data.data) {
    console.error(
      "[ARTHA] data keys:",
      Object.keys(data.data)
    );
  }

  console.log(
    "=============================================="
  );

  return [];
}

/* =========================================================
   EXTRACT TOTAL
   ========================================================= */

function extractArthaTotal(
  data: ArthaResponse,
  jobs: ArthaJob[]
): number {
  /*
   * Top-level total
   */
  if (
    typeof data.total === "number"
  ) {
    return data.total;
  }

  /*
   * Actual Artha structure:
   *
   * data.data.total
   */
  if (
    data.data &&
    typeof data.data.total === "number"
  ) {
    return data.data.total;
  }

  /*
   * pagination.total
   */
  if (
    data.pagination &&
    typeof data.pagination.total === "number"
  ) {
    return data.pagination.total;
  }

  /*
   * data.data.pagination.total
   */
  if (
    data.data?.pagination &&
    typeof data.data.pagination.total === "number"
  ) {
    return data.data.pagination.total;
  }

  return jobs.length;
}

/* =========================================================
   EXTRACT HAS MORE
   ========================================================= */

function extractArthaHasMore(
  data: ArthaResponse
): boolean {
  /*
   * Top-level
   */
  if (
    typeof data.has_more === "boolean"
  ) {
    return data.has_more;
  }

  /*
   * Actual Artha structure:
   *
   * data.data.has_more
   */
  if (
    data.data &&
    typeof data.data.has_more === "boolean"
  ) {
    return data.data.has_more;
  }

  /*
   * pagination.has_more
   */
  if (
    data.pagination &&
    typeof data.pagination.has_more === "boolean"
  ) {
    return data.pagination.has_more;
  }

  /*
   * data.data.pagination.has_more
   */
  if (
    data.data?.pagination &&
    typeof data.data.pagination.has_more === "boolean"
  ) {
    return data.data.pagination.has_more;
  }

  return false;
}

/* =========================================================
   FETCH JOBS FROM ARTHA
   ========================================================= */

async function getJobsFromArtha(
  apiKey: string,
  location: string,
  limit: number,
  offset: number
) {
  const url =
    `${ARTHA_API}?limit=${limit}` +
    `&offset=${offset}` +
    `&location=${encodeURIComponent(
      location
    )}`;

  console.log(
    "=============================================="
  );

  console.log(
    "[ARTHA] Fetching jobs"
  );

  console.log(
    "[ARTHA] URL:",
    url
  );

  console.log(
    "[ARTHA] Location:",
    location
  );

  console.log(
    "[ARTHA] Limit:",
    limit
  );

  console.log(
    "[ARTHA] Offset:",
    offset
  );

  console.log(
    "=============================================="
  );

  if (!apiKey) {
    throw new Error(
      "ARTHA_API_KEY is not configured"
    );
  }

  const response =
    await fetch(url, {
      method: "GET",

      headers: {
        Accept:
          "application/json",

        "x-api-key":
          apiKey,
      },

      cache: "no-store",
    });

  console.log(
    "[ARTHA] HTTP status:",
    response.status
  );

  const responseText =
    await response.text();

  /*
   * HTTP ERROR
   */

  if (!response.ok) {
    console.error(
      "[ARTHA] API ERROR"
    );

    console.error(
      "[ARTHA] Status:",
      response.status
    );

    console.error(
      "[ARTHA] Response:",
      responseText
    );

    throw new Error(
      `Artha API returned ${response.status}: ${responseText}`
    );
  }

  /*
   * Parse JSON
   */

  let data: ArthaResponse;

  try {
    data =
      JSON.parse(
        responseText
      ) as ArthaResponse;
  } catch {
    console.error(
      "[ARTHA] Invalid JSON:"
    );

    console.error(
      responseText
    );

    throw new Error(
      "Artha API returned invalid JSON"
    );
  }

  /*
   * Log response structure.
   *
   * Do NOT print the entire response because
   * 100 jobs can make the terminal huge.
   */

  console.log(
    "=============================================="
  );

  console.log(
    "[ARTHA] RESPONSE STRUCTURE"
  );

  console.log(
    "[ARTHA] Top-level keys:",
    Object.keys(data)
  );

  if (data.data) {
    console.log(
      "[ARTHA] data keys:",
      Object.keys(data.data)
    );
  }

  console.log(
    "[ARTHA] success:",
    data.success
  );

  console.log(
    "[ARTHA] message:",
    data.message
  );

  console.log(
    "[ARTHA] data.total:",
    data.data?.total
  );

  console.log(
    "[ARTHA] data.limit:",
    data.data?.limit
  );

  console.log(
    "[ARTHA] data.offset:",
    data.data?.offset
  );

  console.log(
    "[ARTHA] data.has_more:",
    data.data?.has_more
  );

  console.log(
    "[ARTHA] data.items length:",
    Array.isArray(
      data.data?.items
    )
      ? data.data.items.length
      : "NOT ARRAY"
  );

  console.log(
    "=============================================="
  );

  /*
   * API returned success=false
   */

  if (
    data.success === false
  ) {
    const message =
      data.error?.message ??
      "Artha API returned success=false";

    throw new Error(
      `Artha API error: ${message}`
    );
  }

  /*
   * Extract jobs
   */

  const jobs =
    extractArthaJobs(
      data
    );

  /*
   * Extract total
   */

  const total =
    extractArthaTotal(
      data,
      jobs
    );

  /*
   * Extract has_more
   */

  const hasMore =
    extractArthaHasMore(
      data
    );

  /*
   * Final extraction logs
   */

  console.log(
    "=============================================="
  );

  console.log(
    "[ARTHA] EXTRACTION RESULT"
  );

  console.log(
    "[ARTHA] Extracted jobs:",
    jobs.length
  );

  console.log(
    "[ARTHA] Total jobs:",
    total
  );

  console.log(
    "[ARTHA] Has more:",
    hasMore
  );

  if (
    jobs.length > 0
  ) {
    console.log(
      "[ARTHA] First job:"
    );

    console.log({
      id: jobs[0]?.id,
      slug: jobs[0]?.slug,
      title: jobs[0]?.title,
      company: jobs[0]?.company,
      country: jobs[0]?.country,
      city: jobs[0]?.city,
    });
  }

  console.log(
    "=============================================="
  );

  return {
    jobs,

    total,

    has_more:
      hasMore,
  };
}

/* =========================================================
   GET /api/jobs
   ========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    console.log(
      "\n\n=============================================="
    );

    console.log(
      "[API] GET /api/jobs START"
    );

    console.log(
      "=============================================="
    );

    /*
     * ----------------------------------------------------
     * CLOUDFLARE ENVIRONMENT
     * ----------------------------------------------------
     */

    const { env } =
      await getCloudflareContext({
        async: true,
      });

    console.log(
      "[ENV] Cloudflare context loaded"
    );

    /*
     * ----------------------------------------------------
     * D1 ..
     * ----------------------------------------------------
     */

    const db =
      env.jobsearly_db;

    if (!db) {
      console.error(
        "[D1] jobsearly_db binding is missing"
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

    console.log(
      "[D1] jobsearly_db binding found"
    );

    /*
     * ----------------------------------------------------
     * ARTHA API KEY
     * ----------------------------------------------------
     *
     * CloudflareEnv does not necessarily contain
     * our custom variable in TypeScript.
     *
     * Therefore we safely cast it.
     * ----------------------------------------------------
     */

    const cloudflareEnv =
      env as unknown as {
        ARTHA_API_KEY?: string;
      };

    const apiKey =
      cloudflareEnv.ARTHA_API_KEY;

    if (!apiKey) {
      console.error(
        "[ENV] ARTHA_API_KEY is missing"
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "ARTHA_API_KEY is missing from Cloudflare environment",
        },
        {
          status: 500,
        }
      );
    }

    console.log(
      "[ENV] ARTHA_API_KEY found"
    );

    /*
     * ----------------------------------------------------
     * QUERY PARAMETERS
     * ----------------------------------------------------
     */

    const searchParams =
      request.nextUrl.searchParams;

    const location =
      searchParams.get(
        "location"
      ) ?? "IN";

    const requestedLimit =
      Number(
        searchParams.get(
          "limit"
        ) ?? "100"
      );

    const limit =
      Math.min(
        Math.max(
          Number.isFinite(
            requestedLimit
          )
            ? requestedLimit
            : 100,
          1
        ),
        100
      );

    const requestedOffset =
      Number(
        searchParams.get(
          "offset"
        ) ?? "0"
      );

    const offset =
      Math.max(
        Number.isFinite(
          requestedOffset
        )
          ? requestedOffset
          : 0,
        0
      );

    console.log(
      "[API] Query:",
      {
        location,
        limit,
        offset,
      }
    );

    /*
     * ----------------------------------------------------
     * STEP 1
     *
     * READ EXISTING D1 JOBS
     * ----------------------------------------------------
     */

    console.log(
      "[D1] Checking cached jobs..."
    );

    const cached =
      await db
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
            url
          FROM jobs
          WHERE country = ?
          ORDER BY
            CASE
              WHEN posted_date IS NULL THEN 1
              ELSE 0
            END,
            posted_date DESC
          LIMIT ? OFFSET ?
          `
        )
        .bind(
          location,
          limit,
          offset
        )
        .all();

    const cachedJobs =
      cached.results ??
      [];

    console.log(
      "[D1] Cached jobs returned:",
      cachedJobs.length
    );

    /*
     * ----------------------------------------------------
     * STEP 2
     *
     * COUNT STORED JOBS
     * ----------------------------------------------------
     */

    const countResult =
      await db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM jobs
          WHERE country = ?
          `
        )
        .bind(
          location
        )
        .first<{
          count: number;
        }>();

    const storedTotal =
      Number(
        countResult?.count ??
          0
      );

    console.log(
      "[D1] Stored total:",
      storedTotal
    );

    /*
     * ----------------------------------------------------
     * STEP 3
     *
     * RETURN CACHE IF ENOUGH DATA EXISTS
     * ----------------------------------------------------
     */

    if (
      cachedJobs.length > 0 &&
      offset +
        cachedJobs.length <=
        storedTotal
    ) {
      console.log(
        "[D1] Returning jobs from D1"
      );

      console.log(
        "[API] Returning:",
        cachedJobs.length,
        "jobs"
      );

      return NextResponse.json({
        success: true,

        jobs:
          cachedJobs,

        total:
          storedTotal,

        source:
          "d1",
      });
    }

    /*
     * ----------------------------------------------------
     * STEP 4
     *
     * FETCH FROM ARTHA
     * ----------------------------------------------------
     */

    console.log(
      "[API] D1 does not contain enough jobs."
    );

    console.log(
      "[API] Fetching from Artha..."
    );

    const artha =
      await getJobsFromArtha(
        apiKey,
        location,
        100,
        offset
      );

    /*
     * ----------------------------------------------------
     * STEP 5
     *
     * SAVE TO D1
     * ----------------------------------------------------
     */

    if (
      artha.jobs.length > 0
    ) {
      console.log(
        "[D1] Saving",
        artha.jobs.length,
        "jobs..."
      );

      await saveJobs(
        db,
        artha.jobs
      );
    } else {
      console.warn(
        "[D1] Artha returned 0 jobs."
      );

      console.warn(
        "[D1] Nothing to save."
      );
    }

    /*
     * ----------------------------------------------------
     * STEP 6
     *
     * READ D1 AGAIN
     * ----------------------------------------------------
     */

    console.log(
      "[D1] Reading final records..."
    );

    const finalResult =
      await db
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
            url
          FROM jobs
          WHERE country = ?
          ORDER BY
            CASE
              WHEN posted_date IS NULL THEN 1
              ELSE 0
            END,
            posted_date DESC
          LIMIT ? OFFSET ?
          `
        )
        .bind(
          location,
          limit,
          offset
        )
        .all();

    const finalJobs =
      finalResult.results ??
      [];

    console.log(
      "[D1] Final jobs returned:",
      finalJobs.length
    );

    /*
     * ----------------------------------------------------
     * STEP 7
     *
     * FINAL COUNT
     * ----------------------------------------------------
     */

    const finalCount =
      await db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM jobs
          WHERE country = ?
          `
        )
        .bind(
          location
        )
        .first<{
          count: number;
        }>();

    const finalTotal =
      Number(
        finalCount?.count ??
          0
      );

    console.log(
      "[D1] Final total:",
      finalTotal
    );

    /*
     * ----------------------------------------------------
     * FINAL RESPONSE
     * ----------------------------------------------------
     */

    console.log(
      "=============================================="
    );

    console.log(
      "[API] FINAL RESPONSE"
    );

    console.log(
      "[API] Jobs:",
      finalJobs.length
    );

    console.log(
      "[API] D1 total:",
      finalTotal
    );

    console.log(
      "[API] Artha total:",
      artha.total
    );

    console.log(
      "[API] Artha has_more:",
      artha.has_more
    );

    console.log(
      "=============================================="
    );

    return NextResponse.json({
      success: true,

      jobs:
        finalJobs,

      total:
        finalTotal,

      source:
        "d1",

      artha_total:
        artha.total,

      artha_has_more:
        artha.has_more,
    });
  } catch (error) {
    console.error(
      "=============================================="
    );

    console.error(
      "[API] GET /api/jobs ERROR"
    );

    console.error(
      error
    );

    console.error(
      "=============================================="
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to load jobs",
      },
      {
        status: 500,
      }
    );
  }
}