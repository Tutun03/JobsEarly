import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface Job {
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

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function JobDetailsPage({ params }: PageProps) {
  const { slug } = await params;

  console.log("======================================");
  console.log("[JOB PAGE] Requested slug:", slug);

  try {
    /*
    |--------------------------------------------------------------------------
    | CLOUDFLARE CONTEXT
    |--------------------------------------------------------------------------
    */

    const { env } = await getCloudflareContext({
      async: true,
    });

    console.log("[JOB PAGE] Cloudflare context loaded");

    /*
    |--------------------------------------------------------------------------
    | D1 DATABASE
    |--------------------------------------------------------------------------
    */

    const db = env.jobsearly_db;

    if (!db) {
      console.error("[JOB PAGE] D1 binding jobsearly_db is missing");

      notFound();
    }

    /*
    |--------------------------------------------------------------------------
    | FIND JOB BY SLUG
    |--------------------------------------------------------------------------
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
          url
        FROM jobs
        WHERE slug = ?
        LIMIT 1
        `,
      )
      .bind(slug)
      .first<Job>();

    console.log(
      "[JOB PAGE] Database result:",
      result
        ? {
            id: result.id,
            slug: result.slug,
            title: result.title,
            company: result.company,
          }
        : "NOT FOUND",
    );

    if (!result) {
      console.error("[JOB PAGE] Job not found for slug:", slug);

      notFound();
    }

    const job = result;

    /*
    |--------------------------------------------------------------------------
    | PARSE SKILLS
    |--------------------------------------------------------------------------
    */

    let skills: string[] = [];

    if (job.skills) {
      try {
        const parsed: unknown = JSON.parse(job.skills);

        if (Array.isArray(parsed)) {
          skills = parsed
            .map((skill: unknown) => String(skill).trim())
            .filter((skill: string) => skill.length > 0);
        } else {
          skills = [String(parsed).trim()].filter(
            (skill: string) => skill.length > 0,
          );
        }
      } catch {
        skills = job.skills
          .split(",")
          .map((skill: string) => skill.trim())
          .filter((skill: string) => skill.length > 0);
      }
    }

    /*
    |--------------------------------------------------------------------------
    | EXPERIENCE
    |--------------------------------------------------------------------------
    */

    let experience = "Experience not specified";

    if (job.exp_min != null && job.exp_max != null) {
      experience = `${job.exp_min} - ${job.exp_max} ${job.exp_unit || "years"}`;
    } else if (job.exp_min != null) {
      experience = `${job.exp_min}+ ${job.exp_unit || "years"}`;
    } else if (job.exp_max != null) {
      experience = `Up to ${job.exp_max} ${job.exp_unit || "years"}`;
    }

    /*
    |--------------------------------------------------------------------------
    | JOB TYPE
    |--------------------------------------------------------------------------
    */

    const jobType = job.job_type
      ? job.job_type.replace(/_/g, " ")
      : "Full-Time";

    /*
    |--------------------------------------------------------------------------
    | LOCATION
    |--------------------------------------------------------------------------
    */

    const location = job.city || job.state || job.country || "India";

    /*
    |--------------------------------------------------------------------------
    | SALARY
    |--------------------------------------------------------------------------
    */

    let salary = "Salary not disclosed";

    if (job.salary_min != null && job.salary_max != null) {
      salary = `${
        job.salary_curr || "₹"
      } ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`;
    } else if (job.salary_min != null) {
      salary = `${job.salary_curr || "₹"} ${job.salary_min.toLocaleString()}+`;
    }

    /*
    |--------------------------------------------------------------------------
    | PAGE
    |--------------------------------------------------------------------------
    */

    return (
      <>
        {/* HEADER */}

        <header className="site-header">
          <div className="container navbar">
            <a href="/" className="logo">
              <span className="logo-mark">J</span>
              JobsEarly
            </a>

            <a href="/#contact" className="contact-link">
              Contact
            </a>
          </div>
        </header>

        {/* JOB DETAILS */}

        <main className="job-detail-page">
          <div className="container">
            {/* BACK */}

            <div className="job-detail-back">
              <a href="/">← Back to jobs</a>
            </div>

            {/* JOB HEADER */}

            <section className="job-detail-header">
              <div className="job-detail-company-logo">
                {job.logo ? (
                  <img src={job.logo} alt={`${job.company} logo`} />
                ) : (
                  job.company?.charAt(0)?.toUpperCase()
                )}
              </div>

              <div className="job-detail-header-content">
                <p className="job-company">{job.company}</p>

                <h1>{job.title}</h1>

                <div className="job-detail-meta">
                  <span>📍 {location}</span>

                  <span>💼 {jobType}</span>

                  <span>🎓 {experience}</span>
                </div>
              </div>
            </section>

            {/* MAIN CONTENT */}

            <div className="job-detail-layout">
              {/* DESCRIPTION */}

              <article className="job-description">
                <h2>Job Description</h2>

                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      job.description ||
                      "<p>Job description not available.</p>",
                  }}
                />
              </article>

              {/* SIDEBAR */}

              <aside className="job-detail-sidebar">
                {/* APPLY */}

                <div className="job-apply-card">
                  <h3>Interested in this job?</h3>

                  <p>Apply through the employer's application page.</p>

                  {job.url && (
                    <a
                      href={`/api/jobs/${encodeURIComponent(slug)}/apply`}
                      className="primary-button"
                    >
                      Apply Now →
                    </a>
                  )}
                </div>

                {/* JOB INFO */}

                <div className="job-info-card">
                  <h3>Job Information</h3>

                  <div className="job-info-row">
                    <span>Company</span>

                    <strong>{job.company}</strong>
                  </div>

                  <div className="job-info-row">
                    <span>Location</span>

                    <strong>{location}</strong>
                  </div>

                  <div className="job-info-row">
                    <span>Job Type</span>

                    <strong>{jobType}</strong>
                  </div>

                  <div className="job-info-row">
                    <span>Experience</span>

                    <strong>{experience}</strong>
                  </div>

                  <div className="job-info-row">
                    <span>Salary</span>

                    <strong>{salary}</strong>
                  </div>
                </div>

                {/* SKILLS */}

                {skills.length > 0 && (
                  <div className="job-info-card">
                    <h3>Skills</h3>

                    <div className="job-tags">
                      {skills.map((skill: string, index: number) => (
                        <span key={`${skill}-${index}`} className="job-tag">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </main>

        {/* FOOTER */}

        <footer className="site-footer">
          <div className="container">
            <div className="footer-contact">
              <span className="footer-contact-label">Support</span>

              <a href="mailto:support@jobsearly.com" className="footer-email">
                support@jobsearly.com
              </a>
            </div>

            <div className="footer-bottom">
              © {new Date().getFullYear()} JobsEarly. All rights reserved.
            </div>
          </div>
        </footer>
      </>
    );
  } catch (error) {
    console.error("[JOB PAGE] Error:", error);

    notFound();
  }
}
