export default function JobLoading() {
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

      {/* JOB DETAILS SKELETON */}
      <main className="job-detail-page">
        <div className="container">
          {/* BACK LINK */}
          <div className="job-detail-back">
            <a href="/">← Back to jobs</a>
          </div>

          {/* JOB HEADER SKELETON */}
          <section className="job-detail-header" style={{ opacity: 0.8 }}>
            <div
              className="job-detail-company-logo job-skeleton"
              style={{ width: 64, height: 64, minHeight: 64, borderRadius: 14 }}
            />

            <div className="job-detail-header-content" style={{ width: "100%" }}>
              <div
                className="job-skeleton"
                style={{ width: "140px", height: "16px", borderRadius: "6px", marginBottom: "12px" }}
              />

              <div
                className="job-skeleton"
                style={{ width: "65%", height: "32px", borderRadius: "8px", marginBottom: "16px" }}
              />

              <div style={{ display: "flex", gap: "12px" }}>
                <div
                  className="job-skeleton"
                  style={{ width: "90px", height: "24px", borderRadius: "6px" }}
                />
                <div
                  className="job-skeleton"
                  style={{ width: "100px", height: "24px", borderRadius: "6px" }}
                />
                <div
                  className="job-skeleton"
                  style={{ width: "110px", height: "24px", borderRadius: "6px" }}
                />
              </div>
            </div>
          </section>

          {/* MAIN CONTENT SKELETON */}
          <div className="job-detail-layout">
            {/* DESCRIPTION SKELETON */}
            <article className="job-description">
              <div
                className="job-skeleton"
                style={{ width: "180px", height: "24px", borderRadius: "6px", marginBottom: "24px" }}
              />

              <div
                className="job-skeleton"
                style={{ width: "100%", height: "16px", borderRadius: "4px", marginBottom: "12px" }}
              />
              <div
                className="job-skeleton"
                style={{ width: "94%", height: "16px", borderRadius: "4px", marginBottom: "12px" }}
              />
              <div
                className="job-skeleton"
                style={{ width: "97%", height: "16px", borderRadius: "4px", marginBottom: "12px" }}
              />
              <div
                className="job-skeleton"
                style={{ width: "75%", height: "16px", borderRadius: "4px", marginBottom: "28px" }}
              />

              <div
                className="job-skeleton"
                style={{ width: "100%", height: "16px", borderRadius: "4px", marginBottom: "12px" }}
              />
              <div
                className="job-skeleton"
                style={{ width: "88%", height: "16px", borderRadius: "4px", marginBottom: "12px" }}
              />
            </article>

            {/* SIDEBAR SKELETON */}
            <aside className="job-detail-sidebar">
              <div className="job-apply-card">
                <div
                  className="job-skeleton"
                  style={{ width: "70%", height: "20px", borderRadius: "6px", marginBottom: "12px" }}
                />
                <div
                  className="job-skeleton"
                  style={{ width: "100%", height: "14px", borderRadius: "4px", marginBottom: "20px" }}
                />
                <div
                  className="job-skeleton"
                  style={{ width: "100%", height: "46px", borderRadius: "10px" }}
                />
              </div>

              <div className="job-info-card">
                <div
                  className="job-skeleton"
                  style={{ width: "50%", height: "20px", borderRadius: "6px", marginBottom: "16px" }}
                />
                <div
                  className="job-skeleton"
                  style={{ width: "100%", height: "14px", borderRadius: "4px", marginBottom: "12px" }}
                />
                <div
                  className="job-skeleton"
                  style={{ width: "100%", height: "14px", borderRadius: "4px", marginBottom: "12px" }}
                />
                <div
                  className="job-skeleton"
                  style={{ width: "100%", height: "14px", borderRadius: "4px" }}
                />
              </div>
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
}
