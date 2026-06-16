const currentYear = new Date().getFullYear();

const Footer = () => {
  return (
    <footer className="border-t border-[#0e1520]">
      <div className="mx-auto flex max-w-300 items-center justify-between px-15 py-7 max-[900px]:px-5.5">
        <span className="text-[11px] tracking-[0.06em] text-text-chrome">Aryan Swaminath</span>
        <span className="text-[11px] text-text-chrome flex items-center gap-1">
          <span className="mt-0.5">©</span>
          {currentYear}
        </span>
      </div>
    </footer>
  );
};

export { Footer };
