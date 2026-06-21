type SkillCategory = {
  label: string;
  skills: { iconSrc?: string; label: string }[];
};

const categories: SkillCategory[] = [
  {
    label: 'Frontend',
    skills: [
      { label: 'React.js', iconSrc: '/logo192.png' },
      { label: 'Next.js', iconSrc: '/nextjs.svg' },
      { label: 'Svelte', iconSrc: '/svelte.svg' },
      { label: 'TypeScript', iconSrc: '/ts.png' },
      { label: 'Redux', iconSrc: '/redux.svg' },
      { label: 'Zustand', iconSrc: 'https://user-images.githubusercontent.com/958486/218346783-72be5ae3-b953-4dd7-b239-788a882fdad6.svg' },
      { label: 'TanStack', iconSrc: '/tanstack.svg' },
      { label: 'TailwindCSS', iconSrc: '/tailwind.svg' },
      { label: 'Radix UI', iconSrc: '/radix.svg' },
    ],
  },
  {
    label: 'Backend',
    skills: [
      { label: 'Node.js', iconSrc: '/node.svg' },
      { label: 'NestJS', iconSrc: '/nest.svg' },
      { label: 'Hono', iconSrc: '/hono.svg' },
      { label: 'WebSockets', iconSrc: '/websocket.svg' },
      { label: 'Apache Kafka', iconSrc: '/kafka.svg' },
    ],
  },
  {
    label: 'Databases',
    skills: [
      { label: 'MongoDB', iconSrc: '/mongodb.svg' },
      { label: 'PostgreSQL', iconSrc: '/postgresql.svg' },
      { label: 'MSSQL', iconSrc: '/mssql.svg' },
      { label: 'MySQL', iconSrc: '/mysql.svg' },
      { label: 'Sequelize', iconSrc: '/sequelize.svg' },
      { label: 'Prisma', iconSrc: '/prisma.svg' },
    ],
  },
  {
    label: 'Cloud & Auth',
    skills: [
      { label: 'Azure', iconSrc: '/azure.svg' },
      { label: 'GCP', iconSrc: '/gcp.svg' },
      { label: 'AWS', iconSrc: '/aws.svg' },
      { label: 'Docker', iconSrc: '/docker.svg' },
      { label: 'Kubernetes', iconSrc: '/k8s.svg' },
      { label: 'Descope Auth', iconSrc: '/descope.svg' },
    ],
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
                <div
                  key={skill.label}
                  className="flex gap-1 items-center rounded-[2px] border border-border bg-bg px-[10px] py-1 text-[11px] text-text-body"
                >
                  {skill.iconSrc && <img src={skill.iconSrc} className="size-3" />}
                  <span>
                    {skill.label}
                  </span>
                </div>
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
