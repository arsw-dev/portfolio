type Bullet = string;

type Job = {
  company: string;
  role: string;
  dates: string;
  bullets: Bullet[];
};

const jobs: Job[] = [
  {
    company: 'Tesoro XP Inc.',
    role: 'Junior Applications Developer',
    dates: '07/2025 — Present',
    bullets: [
      'Built mobile-first web view with React, Redux, and Mapbox — global singleton map instance for cost-effective initialization.',
      'Bridged Descope Auth into Redux for centralized session management; implemented OTP, email/password, and custom JWT token claims.',
      'Expanded internal component library with compound component patterns; shipped Next.js documentation site with custom theme and SEO.',
      'Built chat-style support module for the admin dashboard, handling user tickets and an integrated resource viewer.',
    ],
  },
  {
    company: 'Atlas Reality Inc.',
    role: 'Junior Applications Developer',
    dates: '10/2024 — 07/2025',
    bullets: [
      'Developed internal React dashboard for merchant data, integrating with the Visa Developer API for streamlined onboarding.',
      'Implemented Azure MSAL authentication with RBAC; built NestJS backend with Sequelize ORM establishing the core API layer.',
      'Engineered custom data table with TanStack Query — server-driven pagination, sorting, and cache management with Zustand for client state.',
      'Built internal component library on Radix UI primitives providing an accessible design foundation across the application.',
    ],
  },
  {
    company: 'Virtusa Corporation',
    role: 'Full Stack Developer',
    dates: '03/2024 — 10/2024',
    bullets: [
      'Built SmartRetail Analytics web app using React and Svelte — interactive dashboard for sales and inventory management.',
      'Integrated Apache Kafka for real-time streaming; deployed on GCP reducing infrastructure costs by 20% with GitLab CI/CD pipelines.',
    ],
  },
];

const JobEntry = ({ job, index }: { job: Job; index: number }) => (
  <div data-fade className="grid grid-cols-[1fr] md:grid-cols-[56px_1fr] gap-x-[44px]">
    <div className="hidden pt-[3px] text-[11px] font-light tracking-[0.06em] text-text-chrome md:block">
      {String(index + 1).padStart(2, '0')}
    </div>
    <div>
      <div className="mb-[6px] flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[15px] font-medium text-text-primary">{job.company}</span>
        <span className="text-[11px] font-light tracking-[0.06em] text-text-chrome">{job.dates}</span>
      </div>
      <div className="mb-[22px] text-[12px] tracking-[0.02em] text-accent">{job.role}</div>
      <div className="flex flex-col gap-[10px]">
        {job.bullets.map((bullet, i) => (
          <div key={i} className="flex gap-[16px]">
            <span className="mt-[3px] shrink-0 text-text-chrome">—</span>
            <span className="text-[13px] font-light leading-[1.85] text-text-body">{bullet}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Experience = () => (
  <section id="experience" className="border-t border-border-faint py-24 max-md:py-[60px]">
    <div className="mx-auto max-w-[1200px] px-15 max-[900px]:px-[22px]">
      <p data-fade className="mb-[72px] text-[11px] uppercase tracking-[0.2em] text-text-chrome">
        experience
      </p>
      {jobs.map((job, i) => (
        <div key={job.company}>
          <JobEntry job={job} index={i} />
          {i < jobs.length - 1 && (
            <div className="my-[56px] h-px bg-[#0d1520] md:ml-[100px]" />
          )}
        </div>
      ))}
    </div>
  </section>
);

export { Experience };
export type { Job };
