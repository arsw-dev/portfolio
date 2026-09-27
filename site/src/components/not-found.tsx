import { Link } from '@tanstack/react-router';

// Rendered for any route the app doesn't define. The server can't tell those apart from real routes (every
// extensionless path gets the SPA shell with a 200), so noindex keeps search engines from indexing them as pages.
const NotFound = () => {
  return (
    <main>
      <meta name="robots" content="noindex" />
      <div className="mx-auto max-w-[1200px] px-15 pt-20 pb-18 max-[900px]:px-5.5">
        <p className="mb-7 text-[11px] uppercase tracking-[0.2em] text-text-chrome animate-fade-up-1">404</p>
        <h1 className="mb-6 text-[clamp(36px,5vw,64px)] font-medium leading-[1.05] tracking-[-0.02em] text-text-primary animate-fade-up-2">
          Nothing lives here.
        </h1>
        <p className="max-w-[500px] text-[13px] font-light leading-[1.8] text-text-body animate-fade-up-3">
          This page doesn&apos;t exist, or it moved.
          {' '}
          <Link to="/" className="text-text-primary transition-colors duration-150 hover:text-accent">
            Head back home
          </Link>
          .
        </p>
      </div>
    </main>
  );
};

export { NotFound };
