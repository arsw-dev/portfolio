import { createFileRoute } from '@tanstack/react-router';
import { posts } from '#/data/posts';
import { useFadeIn } from '#/hooks/use-fade-in';

export const Route = createFileRoute('/writing/')({
  component: Writing,
});

function Writing() {
  useFadeIn();

  return (
    <main>
      <div className="mx-auto max-w-[1200px] px-15 pt-20 pb-18 max-[900px]:px-5.5">
        <p className="mb-7 text-[11px] uppercase tracking-[0.2em] text-text-chrome animate-fade-up-1">writing</p>
        <h1 className="mb-6 text-[clamp(36px,5vw,64px)] font-medium leading-[1.05] tracking-[-0.02em] text-text-primary animate-fade-up-2">
          A log of technical
          <br />
          explorations and builds.
        </h1>
        <p className="max-w-[500px] text-[13px] font-light leading-[1.8] text-text-body animate-fade-up-3">
          Patterns I've found useful, tools worth talking about, and things I built that were interesting enough to write down.
        </p>
      </div>
      <div className="border-t border-border-faint mx-auto max-w-[1200px] px-15 max-[900px]:px-5.5">
        {!posts.length
          ? (
              <div data-fade="true" className="text-text-chrome text-xs min-h-40 flex items-center justify-center">
                <span className="opacity-45">
                  You&apos;ll find my musings here when I come around to writing one.
                </span>
              </div>
            )
          : posts.map((post, idx) => (
              <div
                key={post.slug}
                data-fade
                className={`grid grid-cols-[96px_1fr] gap-x-12 py-12 max-sm:grid-cols-1 max-sm:gap-y-3, ${idx !== posts.length - 1 ? 'border-b border-[#0e1520]' : ''}`}
              >
                <div className="pt-[3px] max-sm:pt-0">
                  <span className="text-[11px] font-light tracking-[0.06em] text-text-chrome whitespace-nowrap">
                    {post.date}
                  </span>
                </div>
                <div>
                  <div className="mb-3 flex flex-wrap items-baseline gap-3">
                    <a
                      href={`/writing/${post.slug}`}
                      className="text-[15px] font-medium text-text-primary transition-colors duration-150 hover:text-accent"
                    >
                      {post.title}
                    </a>
                    <div className="flex flex-shrink-0 gap-2">
                      {post.tags.map(tag => (
                        <span key={tag} className="text-[10px] tracking-[0.06em] text-accent">
                          [
                          {tag}
                          ]
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="max-w-[680px] text-[13px] font-light leading-[1.8] text-text-body">
                    {post.summary}
                  </p>
                </div>
              </div>
            ))}
      </div>
    </main>
  );
}
