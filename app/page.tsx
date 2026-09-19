"use client";

import { useEffect, useState } from "react";

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

const JOBS_PER_PAGE = 10;

export default function HomePage() {
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("IN");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * LOAD JOBS
   *
   * The backend decides how many jobs are available.
   *
   * Example:
   * 30 jobs -> allJobs contains 30
   * 40 jobs -> allJobs contains 40
   * 50 jobs -> allJobs contains 50
   *
   * We DO NOT slice the jobs here.
   */
  async function loadJobs(selectedLocation = location) {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/jobs?location=${encodeURIComponent(
          selectedLocation
        )}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch jobs: ${response.status}`
        );
      }

      const result: ApiResponse =
        await response.json();

      if (
        !result?.data?.items ||
        !Array.isArray(result.data.items)
      ) {
        throw new Error(
          "Invalid API response"
        );
      }

      /*
       * IMPORTANT
       *
       * Do NOT use:
       *
       * result.data.items.slice(0, 30)
       *
       * We keep ALL jobs returned by the backend.
       */
      setAllJobs(result.data.items);

      /*
       * Whenever jobs are reloaded,
       * start from page 1.
       */
      setPage(1);
    } catch (error) {
      console.error(
        "Jobs loading error:",
        error
      );

      setError(
        "Unable to load jobs. Please try again."
      );

      setAllJobs([]);
    } finally {
      setLoading(false);
    }
  }

  /*
   * INITIAL LOAD
   */
  useEffect(() => {
    loadJobs("IN");
  }, []);

  /*
   * SEARCH
   *
   * Search through ALL loaded jobs.
   */
  const filteredJobs = allJobs.filter(
    (job) => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return true;
      }

      const title =
        job.title?.toLowerCase() || "";

      const company =
        job.company?.toLowerCase() || "";

      const city =
        job.city?.toLowerCase() || "";

      const state =
        job.state?.toLowerCase() || "";

      const country =
        job.country?.toLowerCase() || "";

      const skills =
        job.skills || [];

      return (
        title.includes(query) ||
        company.includes(query) ||
        city.includes(query) ||
        state.includes(query) ||
        country.includes(query) ||
        skills.some((skill) =>
          skill
            .toLowerCase()
            .includes(query)
        )
      );
    }
  );

  /*
   * DYNAMIC PAGINATION
   *
   * Examples:
   *
   * 30 jobs / 10 = 3 pages
   * 40 jobs / 10 = 4 pages
   * 50 jobs / 10 = 5 pages
   * 41 jobs / 10 = 5 pages
   */
  const totalPages = Math.ceil(
    filteredJobs.length /
      JOBS_PER_PAGE
  );

  /*
   * Protect page if filtering reduces
   * the number of available pages.
   */
  const safePage =
    totalPages > 0
      ? Math.min(page, totalPages)
      : 1;

  /*
   * Calculate which jobs belong
   * to the current page.
   */
  const startIndex =
    (safePage - 1) *
    JOBS_PER_PAGE;

  const visibleJobs =
    filteredJobs.slice(
      startIndex,
      startIndex + JOBS_PER_PAGE
    );

  /*
   * CHANGE PAGE
   */
  function changePage(
    newPage: number
  ) {
    if (
      newPage < 1 ||
      newPage > totalPages
    ) {
      return;
    }

    setPage(newPage);

    setTimeout(() => {
      document
        .getElementById(
          "jobs-section"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  }

  /*
   * SEARCH BUTTON
   */
  function handleSearch() {
    setPage(1);

    setTimeout(() => {
      document
        .getElementById(
          "jobs-section"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  }

  /*
   * LOCATION CHANGE
   */
  function handleLocationChange(
    newLocation: string
  ) {
    setLocation(newLocation);
    setSearch("");
    setPage(1);

    loadJobs(newLocation);
  }

  return (
    <>
      {/* =========================
          HEADER
      ========================== */}

      <header className="site-header">
        <div className="container navbar">
          <a
            href="/"
            className="logo"
          >
            <span className="logo-mark">
              J
            </span>

            JobsEarly
          </a>

          <a
            href="#contact"
            className="contact-link"
          >
            Contact
          </a>
        </div>
      </header>

      {/* =========================
          HERO
      ========================== */}

      <section className="hero">
        <div className="container">
          <div className="hero-content">

            <span className="hero-label">
              Career opportunities,
              simplified
            </span>

            <h1>
              Find work that{" "}
              <span>
                moves you forward.
              </span>
            </h1>

            <p>
              Discover fresh job
              opportunities from companies
              across India. Search, explore
              and apply to your next
              opportunity without the noise.
            </p>

            {/* SEARCH */}

            <div className="search-wrapper">

              <input
                type="text"
                className="search-input"
                placeholder="Company, job title, location or skill..."
                value={search}
                onChange={(e) => {
                  setSearch(
                    e.target.value
                  );

                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter"
                  ) {
                    handleSearch();
                  }
                }}
              />

              <select
                value={location}
                onChange={(e) =>
                  handleLocationChange(
                    e.target.value
                  )
                }
                className="search-location"
              >
                <option value="IN">
                  India
                </option>
              </select>

              <button
                className="search-button"
                onClick={
                  handleSearch
                }
              >
                Search Jobs
              </button>

            </div>

            <p className="search-example">
              Try: Software Engineer ·
              Java · Python · Amazon
            </p>

          </div>
        </div>
      </section>

      {/* =========================
          JOBS
      ========================== */}

      <section
        id="jobs-section"
        className="jobs-section"
      >
        <div className="container">

          {/* SECTION HEADER */}

          <div className="section-header">

            <div>

              <h2>
                Latest jobs
              </h2>

              <p>
                Fresh opportunities from
                our job feed.
              </p>

            </div>

            <span className="job-count">
              {filteredJobs.length}{" "}
              jobs available
            </span>

          </div>

          {/* =========================
              LOADING
          ========================== */}

          {loading && (
            <div className="jobs-grid">

              {Array.from({
                length: 6,
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="job-skeleton"
                  />
                )
              )}

            </div>
          )}

          {/* =========================
              ERROR
          ========================== */}

          {!loading && error && (
            <div className="error-box">

              <div className="error-icon">
                !
              </div>

              <h2>
                Something went wrong
              </h2>

              <p>
                {error}
              </p>

              <button
                className="primary-button"
                onClick={() =>
                  loadJobs(
                    location
                  )
                }
              >
                Try Again
              </button>

            </div>
          )}

          {/* =========================
              JOBS
          ========================== */}

          {!loading &&
            !error && (
              <>
                {visibleJobs.length ===
                0 ? (
                  <div className="empty-box">

                    <div className="empty-icon">
                      ⌕
                    </div>

                    <h2>
                      No jobs found
                    </h2>

                    <p>
                      Try searching for
                      another company,
                      job title, location
                      or skill.
                    </p>

                  </div>
                ) : (
                  <div className="jobs-grid">

                    {visibleJobs.map(
                      (job) => (
                        <article
                          key={job.id}
                          className="job-card"
                        >

                          {/* TOP */}

                          <div className="job-card-top">

                            <div className="company-logo">

                              {job.logo ? (
                                <img
                                  src={
                                    job.logo
                                  }
                                  alt={
                                    job.company
                                  }
                                />
                              ) : (
                                job.company
                                  ?.charAt(
                                    0
                                  )
                                  ?.toUpperCase()
                              )}

                            </div>

                            <span className="new-badge">
                              New
                            </span>

                          </div>

                          {/* COMPANY + TITLE */}

                          <div>

                            <p className="job-company">
                              {
                                job.company
                              }
                            </p>

                            <h3 className="job-title">
                              {
                                job.title
                              }
                            </h3>

                          </div>

                          {/* META */}

                          <div className="job-meta">

                            <div className="job-meta-item">

                              <span>
                                📍
                              </span>

                              <span>
                                {job.city ||
                                  job.state ||
                                  job.country ||
                                  "India"}
                              </span>

                            </div>

                            <div className="job-meta-item">

                              <span>
                                💼
                              </span>

                              <span>
                                {job.job_type
                                  ? job.job_type.replace(
                                      /_/g,
                                      " "
                                    )
                                  : "Full-Time"}
                              </span>

                            </div>

                            <div className="job-meta-item">

                              <span>
                                🎓
                              </span>

                              <span>
                                {job.exp_min ??
                                  0}{" "}
                                -{" "}
                                {job.exp_max ??
                                  0}{" "}
                                {job.exp_unit ||
                                  "years"}
                              </span>

                            </div>

                          </div>

                          {/* SKILLS */}

                          {job.skills
                            ?.length >
                            0 && (
                            <div className="job-tags">

                              {job.skills
                                .slice(
                                  0,
                                  4
                                )
                                .map(
                                  (
                                    skill,
                                    index
                                  ) => (
                                    <span
                                      key={`${skill}-${index}`}
                                      className="job-tag"
                                    >
                                      {
                                        skill
                                      }
                                    </span>
                                  )
                                )}

                            </div>
                          )}

                          {/* FOOTER */}

                          <div className="job-card-footer">

                            <span className="job-salary">

                              {job.salary_min !=
                                null &&
                              job.salary_max !=
                                null
                                ? `${
                                    job.salary_curr ||
                                    "₹"
                                  } ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`
                                : "Salary not disclosed"}

                            </span>

                            <a
                              href={`/jobs/${encodeURIComponent(
                                job.slug
                              )}`}
                              className="view-job"
                            >
                              View Job →
                            </a>

                          </div>

                        </article>
                      )
                    )}

                  </div>
                )}

                {/* =========================
                    PAGINATION
                ========================== */}

                {totalPages > 1 && (
                  <div className="pagination">

                    {/* PREVIOUS */}

                    <button
                      onClick={() =>
                        changePage(
                          safePage - 1
                        )
                      }
                      disabled={
                        safePage === 1
                      }
                    >
                      ←
                    </button>

                    {/* PAGE NUMBERS */}

                    {Array.from(
                      {
                        length:
                          totalPages,
                      },
                      (_, index) =>
                        index + 1
                    ).map(
                      (
                        pageNumber
                      ) => (
                        <button
                          key={
                            pageNumber
                          }
                          onClick={() =>
                            changePage(
                              pageNumber
                            )
                          }
                          className={
                            safePage ===
                            pageNumber
                              ? "active"
                              : ""
                          }
                        >
                          {
                            pageNumber
                          }
                        </button>
                      )
                    )}

                    {/* NEXT */}

                    <button
                      onClick={() =>
                        changePage(
                          safePage + 1
                        )
                      }
                      disabled={
                        safePage ===
                        totalPages
                      }
                    >
                      →
                    </button>

                  </div>
                )}

              </>
            )}

        </div>
      </section>

      {/* =========================
          CTA
      ========================== */}

      <section className="cta">
        <div className="container">

          <div className="cta-content">

            <span>
              Your next move
            </span>

            <h2>
              Stop scrolling.
              <br />
              Start applying.
            </h2>

            <p>
              New opportunities are added
              regularly. Keep exploring,
              keep learning and find the
              role that fits your journey.
            </p>

          </div>

        </div>
      </section>

      {/* =========================
          FOOTER
      ========================== */}

      <footer
        id="contact"
        className="site-footer"
      >
        <div className="container">

          <div className="footer-contact">

            <span className="footer-contact-label">
              
            </span>

            <a
              href="mailto:support@jobsearly.com"
              className="footer-email"
            >
              support@jobsearly.com
            </a>

          </div>

          <div className="footer-bottom">
            ©{" "}
            {new Date().getFullYear()}{" "}
            JobsEarly. All rights
            reserved.
          </div>

        </div>
      </footer>
    </>
  );
}