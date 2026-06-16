const About = () => (
  <section id="about" className="border-t border-border-faint py-24 max-md:py-[60px]">
    <div className="mx-auto max-w-[1200px] px-15 max-[900px]:px-[22px]">
      <p data-fade className="mb-12 text-[11px] uppercase tracking-[0.2em] text-text-chrome">
        about
      </p>
      <div data-fade className="grid grid-cols-[1fr_268px] gap-16 max-md:grid-cols-1">
        <div>
          <p className="mb-[22px] text-[14px] font-light leading-[1.95] text-text-body">
            Full stack developer with 3+ years of experience building production web applications — primarily internal tools, admin dashboards, and data platforms.
          </p>
          <p className="mb-[22px] text-[14px] font-light leading-[1.95] text-text-body">
            My work spans the React ecosystem, Node.js backends, and cloud deployments across Azure and GCP. I care about clean APIs, sensible state architecture, and code that the next person can actually work in.
          </p>
          <p className="text-[14px] font-light leading-[1.95] text-text-body">
            Currently at Tesoro XP, shipping features for a merchant platform and mobile-first web view.
          </p>
        </div>
        <div className="flex flex-row md:flex-col gap-8 border-l border-border-faint pl-10 max-md:border-l-0 max-md:pt-8 max-md:pl-0">
          <div className="w-full">
            <div className="mb-3 text-[10px] uppercase tracking-[0.16em] text-text-chrome">Education</div>
            <div className="mb-[6px] text-[13px] text-text-primary">B.S. Computer Science</div>
            <div className="text-[12px] font-light leading-[1.7] text-text-chrome">
              University of South Dakota
              <br />
              2021 — 2024
            </div>
          </div>
          <div className="w-full">
            <div className="mb-3 text-[10px] uppercase tracking-[0.16em] text-text-chrome">Currently at</div>
            <div className="mb-[6px] text-[13px] text-text-primary">Tesoro XP Inc.</div>
            <div className="text-[12px] font-light leading-[1.7] text-text-chrome">
              07/2025 — Present
              <br />
              Remote, USA
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export { About };
