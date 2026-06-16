import { createFileRoute } from '@tanstack/react-router';
import { About } from '#/components/about';
import { Experience } from '#/components/experience';
import { Hero } from '#/components/hero';
import { Stack } from '#/components/stack';
import { useFadeIn } from '#/hooks/use-fade-in';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  useFadeIn();

  return (
    <main>
      <Hero />
      <Experience />
      <About />
      <Stack />
    </main>
  );
}
