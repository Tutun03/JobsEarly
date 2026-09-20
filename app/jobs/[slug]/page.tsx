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
  data?: Job;
  error?: string;
}

// ============================================================
// GET SINGLE JOB
// ============================================================

async function getJob(
  slug: string
): Promise<Job | null> {
  try {
    let requestedSlug = slug;

    try {
      requestedSlug =
        decodeURIComponent(slug);
    } catch {
      requestedSlug = slug;
    }

    /*
     * Use the application's own API route.
     *
     * This route talks securely to Artha using
     * ARTHA_API_KEY.
     */

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://jobsearly.dailyupdate.workers.dev";

    const response = await fetch(
      `${siteUrl}/api/jobs/${encodeURIComponent(
        requestedSlug
      )}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(
        "Job detail API error:",
        response.status
      );

      return null;
    }

    const result: ApiResponse =
      await response.json();

    if (
      !result?.success ||
      !result?.data
    ) {
      console.error(
        "Invalid job detail response:",
        result
      );

      return null;
    }

    return result.data;
  } catch (error) {
    console.error(
      "Job details error:",
      error
    );

    return null;
  }
}

// ============================================================
// JOB DETAILS PAGE
// ============================================================

export default async function JobDetailsPage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;

  const job = await getJob(slug);

  if (!job) {
    notFound();
  }

  const location =
    job.city ||
    job.state ||
    job.country ||
    "India";

  const jobType =
    job.job_type
      ? job.job_type.replace(
          /_/g,
          " "
        )
      : "Full-Time";

  const experience =
    `${job.exp_min ?? 0} - ${
      job.exp_max ?? 0
    } ${job.exp_unit || "years"}`;

  const salary =
    job.salary_min != null &&
    job.salary_max != null
      ? `${job.salary_curr || "₹"} ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`
      : "Not disclosed";

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

        {/* JOB CARD */}

        <article className="job-details-card">

          {/* HEADER */}

          <div className="job-header">

            <div className="job-company-logo">

              {job.logo ? (
                <img
                  src={job.logo}
                  alt={`${job.company} logo`}
                />
              ) : (
                <span>
                  {job.company
                    ?.charAt(0)
                    ?.toUpperCase()}
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
                  📍 {location}
                </span>

                <span>
                  💼 {jobType}
                </span>

                <span>
                  🎓 {experience}
                </span>

              </div>

            </div>

          </div>

          {/* APPLY */}

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

          {/* EXTRA INFORMATION */}

          <div className="job-extra-info">

            <div>
              <span>
                Salary
              </span>

              <strong>
                {salary}
              </strong>
            </div>

            <div>
              <span>
                Experience
              </span>

              <strong>
                {experience}
              </strong>
            </div>

            <div>
              <span>
                Location
              </span>

              <strong>
                {location}
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
