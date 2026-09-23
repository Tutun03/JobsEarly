"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  useRef,
} from "react";

interface BackendJob {
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

  skills: string[];

  posted_date: string | null;
  url: string | null;
}

interface ApiResponse {
  success: boolean;

  jobs: BackendJob[];

  total: number;

  source?: string;

  artha_total?: number;

  artha_has_more?: boolean;

  error?: string;
}

const JOBS_PER_PAGE = 10;

export default function HomePage() {
  const fetchingRef = useRef<string | null>(null);
  const [
    allJobs,
    setAllJobs,
  ] = useState<Job[]>([]);

  const [
    totalJobs,
    setTotalJobs,
  ] = useState(0);

  const [
    pageCache,
    setPageCache,
  ] = useState<Record<string, Job[]>>({});

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    location,
    setLocation,
  ] = useState("IN");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  /*
  |--------------------------------------------------------------------------
  | CONVERT BACKEND JOB -> FRONTEND JOB
  |--------------------------------------------------------------------------
  */

  function normalizeFrontendJob(
    job: BackendJob
  ): Job {
    let skills: string[] = [];

    if (Array.isArray(job.skills)) {
      skills = job.skills;
    } else if (
      typeof job.skills === "string"
    ) {
      try {
        const parsed =
          JSON.parse(job.skills);

        if (Array.isArray(parsed)) {
          skills = parsed;
        } else if (
          typeof parsed === "string"
        ) {
          skills = [parsed];
        }
      } catch {
        /*
         * If skills is not JSON,
         * treat it as comma-separated text.
         */
        skills = job.skills
          .split(",")
          .map((skill) =>
            skill.trim()
          )
          .filter(Boolean);
      }
    }

    return {
      id: String(job.id ?? ""),
      slug: String(job.slug ?? ""),
      title: job.title ?? "",
      company: job.company ?? "",
      logo: job.logo ?? null,
      description:
        job.description ?? "",

      city: job.city ?? null,
      state: job.state ?? null,
      country:
        job.country ?? "IN",

      job_type:
        job.job_type ?? null,

      salary_min:
        job.salary_min ?? null,

      salary_max:
        job.salary_max ?? null,

      salary_curr:
        job.salary_curr ?? null,

      exp_min:
        job.exp_min ?? null,

      exp_max:
        job.exp_max ?? null,

      exp_unit:
        job.exp_unit ?? null,

      skills,

      posted_date:
        job.posted_date ?? null,

      url:
        job.url ?? null,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD JOBS
  |--------------------------------------------------------------------------
  */

  async function loadJobs(
    targetPage = 1,
    selectedLocation = location,
    currentSearch = search,
    forceRefresh = false
  ) {
    const trimmedSearch = currentSearch.trim();
    const reqKey = `${selectedLocation}_${trimmedSearch.toLowerCase()}_${targetPage}`;

    if (!forceRefresh && fetchingRef.current === reqKey) {
      console.log(`[CLIENT] Skipping duplicate in-flight fetch for key: ${reqKey}`);
      return;
    }

    fetchingRef.current = reqKey;

    try {
      const trimmedSearch = currentSearch.trim();
      const cacheKey = `${selectedLocation}_${trimmedSearch.toLowerCase()}_${targetPage}`;

      if (
        !forceRefresh &&
        pageCache[cacheKey] &&
        selectedLocation === location
      ) {
        console.log(`[CLIENT CACHE] Serving Page ${targetPage} from memory for key: ${cacheKey}`);
        setAllJobs(pageCache[cacheKey]);
        setPage(targetPage);
        return;
      }

      setLoading(true);
      setError("");

      const offset = (targetPage - 1) * JOBS_PER_PAGE;

      console.log(`[API] Fetching jobs page ${targetPage} (offset: ${offset}, search: "${trimmedSearch}")...`);

      const response = await fetch(
        `/api/jobs?location=${encodeURIComponent(
          selectedLocation
        )}&limit=${JOBS_PER_PAGE}&offset=${offset}&search=${encodeURIComponent(trimmedSearch)}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.status}`);
      }

      const result = (await response.json()) as ApiResponse;

      if (!result || result.success !== true || !Array.isArray(result.jobs)) {
        throw new Error(result?.error || "Invalid API response: jobs array is missing");
      }

      const normalizedJobs = result.jobs.map(normalizeFrontendJob);

      setPageCache((prev) => ({
        ...prev,
        [cacheKey]: normalizedJobs,
      }));

      setAllJobs(normalizedJobs);
      setTotalJobs(result.total ?? normalizedJobs.length);
      setPage(targetPage);
    } catch (error) {
      console.error("Jobs loading error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load jobs. Please try again."
      );
      setAllJobs([]);
    } finally {
      fetchingRef.current = null;
      setLoading(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | INITIAL LOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    loadJobs(1, "IN", "", false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
  |--------------------------------------------------------------------------
  | SEARCH
  |--------------------------------------------------------------------------
  */

  const filteredJobs =
    allJobs.filter((job) => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return true;
      }

      const terms = query.split(/\s+/).filter(Boolean);
      if (terms.length === 0) {
        return true;
      }

      const title = job.title?.toLowerCase() || "";
      const company = job.company?.toLowerCase() || "";
      const city = job.city?.toLowerCase() || "";
      const state = job.state?.toLowerCase() || "";
      const country = job.country?.toLowerCase() || "";
      const skills = Array.isArray(job.skills)
        ? job.skills.join(" ").toLowerCase()
        : String(job.skills ?? "").toLowerCase();

      const text = `${title} ${company} ${city} ${state} ${country} ${skills}`;

      return terms.every((term) => text.includes(term));
    });

  /*
  |--------------------------------------------------------------------------
  | PAGINATION
  |--------------------------------------------------------------------------
  */

  const totalPages = Math.max(
    1,
    Math.ceil(totalJobs / JOBS_PER_PAGE)
  );

  const safePage =
    totalPages > 0
      ? Math.min(
          page,
          totalPages
        )
      : 1;

  const visibleJobs = allJobs;

  /*
  |--------------------------------------------------------------------------
  | CHANGE PAGE
  |--------------------------------------------------------------------------
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

    loadJobs(newPage, location, search);

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
  |--------------------------------------------------------------------------
  | SEARCH BUTTON
  |--------------------------------------------------------------------------
  */

  function handleSearch() {
    setPage(1);
    loadJobs(1, location, search, true);

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
  |--------------------------------------------------------------------------
  | LOCATION
  |--------------------------------------------------------------------------
  */

  function handleLocationChange(
    newLocation: string
  ) {
    setLocation(
      newLocation
    );

    setSearch("");
    setPage(1);

    loadJobs(1, newLocation, search, true);
  }

  /*
  |--------------------------------------------------------------------------
  | EXPERIENCE FORMATTER
  |--------------------------------------------------------------------------
  */

  function formatExperience(
    job: Job
  ) {
    if (
      job.exp_min != null &&
      job.exp_max != null
    ) {
      return `${job.exp_min} - ${job.exp_max} ${
        job.exp_unit ||
        "years"
      }`;
    }

    if (
      job.exp_min != null
    ) {
      return `${job.exp_min}+ ${
        job.exp_unit ||
        "years"
      }`;
    }

    if (
      job.exp_max != null
    ) {
      return `Up to ${job.exp_max} ${
        job.exp_unit ||
        "years"
      }`;
    }

    return "Experience not specified";
  }

  /*
  |--------------------------------------------------------------------------
  | JOB TYPE FORMATTER
  |--------------------------------------------------------------------------
  */

  function formatJobType(
    job: Job
  ) {
    return job.job_type
      ? job.job_type.replace(
          /_/g,
          " "
        )
      : "Full-Time";
  }

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <>
      {/* HEADER */}

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

      {/* HERO */}

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
              opportunities from
              companies across India.
              Search, explore and apply
              to your next opportunity
              without the noise.
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

      {/* JOBS */}

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
                Fresh opportunities
                from our job feed.
              </p>
            </div>

            <span className="job-count">
              {filteredJobs.length}{" "}
              jobs available
            </span>
          </div>

          {/* LOADING */}

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

          {/* ERROR */}

          {!loading &&
            error && (
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
                    loadJobs(page, location, search, true)
                  }
                >
                  Try Again
                </button>
              </div>
            )}

          {/* JOBS */}

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
                                  alt={`${job.company} logo`}
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

                          {/* COMPANY */}

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
                                {formatJobType(
                                  job
                                )}
                              </span>
                            </div>

                            <div className="job-meta-item">
                              <span>
                                🎓
                              </span>

                              <span>
                                {formatExperience(
                                  job
                                )}
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

                            <Link
                              href={`/jobs/${encodeURIComponent(
                                job.slug
                              )}`}
                              className="view-job"
                            >
                              View Job →
                            </Link>
                          </div>

                        </article>
                      )
                    )}
                  </div>
                )}

                {/* PAGINATION */}

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
                        safePage ===
                        1
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

      {/* CTA */}

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

      {/* FOOTER */}

      <footer
        id="contact"
        className="site-footer"
      >
        <div className="container">

          <div className="footer-contact">

            <span className="footer-contact-label">
              Support
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