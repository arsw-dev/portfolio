import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { posts } from '#/data/posts';

const mdxModules = import.meta.glob('../../posts/*.mdx');

export const Route = createFileRoute('/writing/$slug')({
  loader: async ({ params }) => {
    const key = `../../posts/${params.slug}.mdx`;
    const load = mdxModules[key];
    if (!load)
      throw redirect({ to: '/writing' });
    const mod = await load() as { default: React.ComponentType };
    return { Content: mod.default };
  },
  component: BlogPost,
});

function BlogPost() {
  const { slug } = Route.useParams();
  // eslint-disable-next-line react/static-components -- stable module export from dynamic import, not created during render
  const { Content } = Route.useLoaderData();

  const idx = posts.findIndex(p => p.slug === slug);
  const post = posts[idx];
  const next = posts[idx + 1];

  if (!post)
    return null;

  return (
    <main>
      <div className="mx-auto max-w-[760px] px-15 pt-16 pb-14 animate-fade-up-1 max-[900px]:px-5.5">
        <div className="mb-10 flex items-center gap-5">
          <Link to="/writing" className="text-[11px] tracking-[0.1em] text-text-chrome transition-colors duration-150 hover:text-accent">
            ← writing
          </Link>
          <span className="text-[11px] text-[#1e2a3a]">·</span>
          <span className="text-[11px] font-light tracking-[0.06em] text-text-chrome">{post.date}</span>
          <span className="text-[11px] text-[#1e2a3a]">·</span>
          <span className="text-[11px] font-light tracking-[0.06em] text-text-chrome">{post.readingTime}</span>
        </div>
        <h1 className="mb-5 text-[clamp(26px,4vw,40px)] font-medium leading-[1.2] tracking-[-0.018em] text-text-primary">
          {post.title}
        </h1>
        <div className="flex gap-2.5">
          {post.tags.map(tag => (
            <span key={tag} className="text-[10px] tracking-[0.06em] text-accent">
              [
              {tag}
              ]
            </span>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-[760px] px-15 pb-24 border-t border-border-faint max-[900px]:px-5.5">
        <article className="prose pt-12">
          {/* eslint-disable-next-line react/static-components -- same as above */}
          <Content />
        </article>
        <div className="mt-16 flex items-center justify-between border-t border-border-faint pt-10">
          <Link to="/writing" className="text-[12px] text-text-chrome transition-colors duration-150 hover:text-accent">
            ← all posts
          </Link>
          {next && (
            <div className="text-right">
              <div className="mb-1.5 text-[10px] tracking-[0.1em] text-[#2a3f58]">next</div>
              <Link
                to="/writing/$slug"
                params={{ slug: next.slug }}
                className="text-[13px] text-text-body transition-colors duration-150 hover:text-accent"
              >
                {next.title}
                {' '}
                →
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
