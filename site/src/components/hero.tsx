type Row = {
  label: string;
  value: Array<{ label: string; iconSrc?: string }>;
  amber?: boolean;
};

const profileRows: Row[] = [
  { label: 'role', value: [{ label: 'Software Engineer' }], amber: false },
  { label: 'base', value: [{ label: 'La Crosse, WI' }], amber: false },
  { label: 'exp', value: [{ label: `${new Date().getFullYear() - 2023}+ years` }], amber: false },
  { label: 'focus', value: [{ label: 'internal tooling, performance, UX' }], amber: true },
  { label: 'stack', value: [
    { label: 'React', iconSrc: '/logo192.png' },
    { label: 'Hono', iconSrc: '/hono.svg' },
    { label: 'NodeJS', iconSrc: '/node.svg' },
    { label: 'TypeScript', iconSrc: '/ts.png' },
  ], amber: true },
] as const;

const DevProfileCard = () => (
  <div className="animate-fade-up-card overflow-hidden rounded-[3px] border border-border bg-surface">
    <div className="border-b border-border-faint px-[22px] py-[16px]">
      <span className="text-[10px] tracking-[0.18em] text-text-chrome lowercase">dev.profile</span>
    </div>
    <div className="px-[22px]">
      {profileRows.map(({ label, value, amber }) => (
        <div
          key={label}
          className="grid grid-cols-[72px_1fr] py-[13px] border-b border-[#0e1520]"
        >
          <span className="text-[11px] font-light tracking-[0.05em] text-text-chrome">{label}</span>
          <div className={`text-[11px] flex gap-2 ${amber ? 'text-accent' : 'text-text-body'}`}>
            {
              value.map(v => (
                <div className="flex items-center gap-1" key={v.label}>
                  {v.iconSrc && <img src={v.iconSrc} className="size-2.5" />}
                  <span>{v.label}</span>
                </div>
              ),
              )
            }
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[72px_1fr] py-[13px] h-[43.5px]">
        <span className="text-[11px] font-light tracking-[0.05em] text-text-chrome">status</span>
        <div className="flex items-center gap-[7px]">
          <div className="size-[5px] shrink-0 rounded-full bg-accent" />
          <span className="text-[11px] text-accent">open to opportunities</span>
        </div>
      </div>
    </div>
  </div>
);

const Hero = () => (
  <div className="grid max-w-[1200px] mx-auto items-center gap-[72px] px-15 py-14 min-h-[calc(100vh-52px)] grid-cols-[1fr_370px] max-md:grid-cols-1 max-md:gap-[40px] max-md:min-h-auto max-[900px]:px-5.5">
    <div>
      <div className="animate-fade-up-1">
        <span className="text-[11px] tracking-[0.2em] text-text-chrome lowercase">[aryan.swaminath]</span>
      </div>
      <div className="mt-[38px] animate-fade-up-2">
        <h1 className="text-[clamp(46px,6.5vw,82px)] font-medium leading-[1.21] tracking-[-0.022em] text-text-primary">
          Aryan
          <br />
          Swaminath
          <span className="animate-blink font-light text-accent">_</span>
        </h1>
      </div>
      <div className="mt-5 animate-fade-up-3">
        <span className="whitespace-nowrap text-[13px] tracking-[0.03em] text-accent">Software Engineer</span>
      </div>
      <p className="mt-7 max-w-[460px] animate-fade-up-4 text-[13px] font-light leading-[1.9] text-text-body">
        Versatile full stack developer specializing in internal tools, admin dashboards, and merchant platforms. 3+ years across fintech, retail analytics, and data systems.
      </p>
      <div className="mt-11 flex flex-wrap gap-7 animate-fade-up-5">
        <a
          href="#"
          className="border-b border-[#192232] pb-[3px] text-[12px] text-[#2c3f58] transition-[color,border-color] duration-200 hover:border-accent hover:text-text-primary"
        >
          [email redacted]
        </a>
        <a
          href="#"
          className="border-b border-[#192232] pb-[3px] text-[12px] text-[#2c3f58] transition-[color,border-color] duration-200 hover:border-accent hover:text-text-primary text-nowrap"
        >
          linkedin ↗
        </a>
      </div>
    </div>
    <DevProfileCard />
  </div>
);

export { Hero };
