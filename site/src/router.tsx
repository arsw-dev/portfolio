import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { NotFound } from '#/components/not-found';
import { routeTree } from './routeTree.gen';

declare module '@tanstack/react-router' {
  // eslint-disable-next-line ts/consistent-type-definitions
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
  });

  return router;
};

export { getRouter };
