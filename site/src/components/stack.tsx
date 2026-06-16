type SkillCategory = {
  label: string;
  skills: string[];
};

const categories: SkillCategory[] = [
  {
    label: 'Frontend',
    skills: ['React.js', 'Next.js', 'Svelte', 'TypeScript', 'Redux', 'Zustand', 'TanStack Query', 'Tailwind', 'Radix UI'],
  },
  {
    label: 'Backend',
    skills: ['Node.js', 'NestJS', 'Express.js', 'RESTful APIs', 'WebSockets', 'Apache Kafka'],
  },
  {
    label: 'Databases',
    skills: ['MongoDB', 'PostgreSQL', 'MSSQL', 'MySQL', 'Sequelize', 'Prisma'],
  },
  {
    label: 'Cloud & Auth',
    skills: ['Azure', 'GCP', 'AWS', 'Docker', 'Kubernetes', 'Azure MSAL', 'RBAC', 'OAuth', 'Descope Auth'],
  },
];

const Stack = () => (
  <section id="stack" className="border-t border-border-faint py-24 max-md:py-[60px]">
    <div className="mx-auto max-w-[1200px] px-15 max-[900px]:px-[22px]">
      <p data-fade className="mb-12 text-[11px] uppercase tracking-[0.2em] text-text-chrome">
        stack
      </p>
      <div data-fade className="grid grid-cols-2 gap-[2px] max-md:grid-cols-1">
        {categories.map(({ label, skills }) => (
          <div key={label} className="rounded-[3px] border border-border bg-surface px-7 py-6">
            <div className="mb-4 text-[10px] uppercase tracking-[0.14em] text-accent">{label}</div>
            <div className="flex flex-wrap gap-[6px]">
              {skills.map(skill => (
                <span
                  key={skill}
                  className="rounded-[2px] border border-border bg-bg px-[10px] py-1 text-[11px] text-text-body"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export { Stack };
export type { SkillCategory };
