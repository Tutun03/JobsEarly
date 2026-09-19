import { notFound } from "next/navigation";

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

interface ApiResponse {
  success: boolean;

  data: {
    items: Job[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };

  message?: string;
}

/*
 * ============================================================
 * GET JOB
 * ============================================================
 *
 * We fetch the complete list returned by:
 *
 * /api/jobs
 *
 * IMPORTANT:
 *
 * There is NO hard-coded 30 or 40 here.
 *
 * Therefore, if the API route returns:
 *
 * 30 jobs -> all 30 are searched
 * 40 jobs -> all 40 are searched
 * 50 jobs -> all 50 are searched
 *
 * This keeps the detail page synchronized with the homepage.
 */

async function getJob(slug: string): Promise<Job | null> {
  try {
    /*
     * Fetch jobs from our deployed internal API.
     *
     * IMPORTANT:
     * Do NOT use localhost here because this code
     * also runs on Cloudflare production.
     */

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://jobsearly.aniketacharya30.workers.dev";

    const response = await fetch(
      `${siteUrl}/api/jobs?location=IN`,
      {
        cache: "no-store",
      }
    );

    /*
     * API request failed
     */

    if (!response.ok) {
      console.error(
        "Jobs API error:",
        response.status
      );

      return null;
    }

    /*
     * Parse response
     */

    const result: ApiResponse =
      await response.json();

    /*
     * Validate response
     */

    if (
      !result?.data?.items ||
      !Array.isArray(result.data.items)
    ) {
      console.error(
        "Invalid jobs API response"
      );

      return null;
    }

    /*
     * ========================================================
     * IMPORTANT
     * ========================================================
     *
     * DO NOT slice to 30.
     *
     * Use every job returned by the API.
     *
     * This makes this page dynamically support:
     *
     * 30 jobs
     * 40 jobs
     * 50 jobs
     * 100 jobs
     * etc.
     */

    const jobs = result.data.items;

    /*
     * Decode the requested slug safely.
     */

    let requestedSlug = slug;

    try {
      requestedSlug = decodeURIComponent(slug);
    } catch {
      requestedSlug = slug;
    }

    /*
     * ========================================================
     * 1. EXACT MATCH
     * ========================================================
     */

    const exactMatch = jobs.find(
      (job) =>
        job.slug === requestedSlug
    );

    if (exactMatch) {
      return exactMatch;
    }

    /*
     * ========================================================
     * 2. CASE-INSENSITIVE MATCH
     * ========================================================
     */

    const caseInsensitiveMatch =
      jobs.find(
        (job) =>
          job.slug?.toLowerCase() ===
          requestedSlug.toLowerCase()
      );

    if (caseInsensitiveMatch) {
      return caseInsensitiveMatch;
    }

    /*
     * ========================================================
     * 3. NORMALIZED MATCH
     * ========================================================
     *
     * Handles:
     *
     * My Job
     * my-job
     * MY-JOB
     */

    const normalizeSlug = (
      value: string
    ) => {
      return value
        .trim()
        .toLowerCase()
        .replace(/%20/g, "-")
        .replace(/\s+/g, "-");
    };

    const normalizedRequestedSlug =
      normalizeSlug(requestedSlug);

    const normalizedMatch =
      jobs.find(
        (job) =>
          normalizeSlug(job.slug) ===
          normalizedRequestedSlug
      );

    if (normalizedMatch) {
      return normalizedMatch;
    }

    /*
     * ========================================================
     * JOB NOT FOUND
     * ========================================================
     */

    console.error(
      "JOB NOT FOUND",
      {
        requestedSlug,

        availableSlugs:
          jobs.map(
            (job) => job.slug
          ),
      }
    );

    return null;
  } catch (error) {
    console.error(
      "Job details error:",
      error
    );

    return null;
  }
}

/*
 * ============================================================
 * JOB DETAILS PAGE
 * ============================================================
 */

export default async function JobDetailsPage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  /*
   * Next.js dynamic route params
   */

  const { slug } = await params;

  /*
   * Find requested job
   */

  const job = await getJob(slug);

  /*
   * If job doesn't exist,
   * show Next.js 404 page.
   */

  if (!job) {
    notFound();
  }

  return (
    <main className="job-details-page">
      <div className="container">

        {/* BACK */}

        <a
          href="/#jobs-section"
          className="back-link"
        >
          ← Back to jobs
        </a>

        {/* JOB HEADER */}

        <article className="job-details-card">

          <div className="job-header">

            <div className="job-company-logo">
              {job.logo ? (
                <img
                  src={job.logo}
                  alt={job.company}
                />
              ) : (
                <span>
                  {job.company?.charAt(0)}
                </span>
              )}
            </div>

            <div>

              <h1>
                {job.title}
              </h1>

              <p className="job-company">
                {job.company}
              </p>

              <div className="job-meta">

                <span>
                  📍{" "}
                  {job.city ||
                    job.state ||
                    job.country ||
                    "India"}
                </span>

                <span>
                  💼{" "}
                  {job.job_type
                    ? job.job_type.replace(
                        /_/g,
                        " "
                      )
                    : "Full-Time"}
                </span>

                <span>
                  🎓{" "}
                  {job.exp_min ?? 0}{" "}
                  -{" "}
                  {job.exp_max ?? 0}{" "}
                  {job.exp_unit ||
                    "years"}
                </span>

              </div>

            </div>

          </div>

          {/* APPLY SECTION */}

          <div className="job-apply-section">

            <div>

              <span className="apply-label">
                Interested in this role?
              </span>

              <p>
                Apply directly through
                the original job posting.
              </p>

            </div>

            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="apply-button"
            >
              <span>
                View & Apply
              </span>

              <span className="apply-arrow">
                →
              </span>
            </a>

          </div>

          {/* DESCRIPTION */}

          <div className="job-description">

            <h2>
              Job Description
            </h2>

            <div
              dangerouslySetInnerHTML={{
                __html:
                  job.description ||
                  "<p>No description available.</p>",
              }}
            />

          </div>

          {/* SKILLS */}

          {job.skills?.length > 0 && (
            <div className="job-skills-section">

              <h2>
                Skills
              </h2>

              <div className="job-tags">

                {job.skills.map(
                  (
                    skill,
                    index
                  ) => (
                    <span
                      key={`${skill}-${index}`}
                      className="job-tag"
                    >
                      {skill}
                    </span>
                  )
                )}

              </div>

            </div>
          )}

          {/* EXTRA INFO */}

          <div className="job-extra-info">

            {/* SALARY */}

            <div>

              <span>
                Salary
              </span>

              <strong>
                {job.salary_min != null &&
                job.salary_max != null
                  ? `${job.salary_curr || "₹"} ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`
                  : "Not disclosed"}
              </strong>

            </div>

            {/* EXPERIENCE */}

            <div>

              <span>
                Experience
              </span>

              <strong>
                {job.exp_min ?? 0}{" "}
                -{" "}
                {job.exp_max ?? 0}{" "}
                {job.exp_unit ||
                  "years"}
              </strong>

            </div>

            {/* LOCATION */}

            <div>

              <span>
                Location
              </span>

              <strong>
                {job.city ||
                  job.state ||
                  job.country ||
                  "India"}
              </strong>

            </div>

          </div>

          {/* BOTTOM APPLY */}

          <div className="job-bottom-apply">

            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="apply-button"
            >

              <span>
                View & Apply
              </span>

              <span className="apply-arrow">
                →
              </span>

            </a>

          </div>

        </article>

      </div>
    </main>
  );
}