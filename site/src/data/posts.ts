type Post = {
  slug: string;
  date: string;
  title: string;
  tags: string[];
  summary: string;
  readingTime: string;
};

const posts: Post[] = [
  {
    slug: 'building-a-global-mapbox-singleton-in-react',
    date: 'Jun 2025',
    title: 'Building a Global Mapbox Singleton in React',
    tags: ['react', 'maps'],
    summary: 'How we went from per-page map initialization to a single shared instance, cutting costs and improving load performance across a mobile web view.',
    readingTime: '6 min read',
  },
  // {
  //   slug: 'custom-data-tables-with-tanstack-query',
  //   date: 'Apr 2025',
  //   title: 'Custom Data Tables with TanStack Query',
  //   tags: ['react', 'dx'],
  //   summary: 'Server-driven pagination, sorting, and cache management — without writing the same boilerplate five times. A pattern for building data tables that scale.',
  //   readingTime: '8 min read',
  // },
  // {
  //   slug: 'bridging-descope-auth-into-redux',
  //   date: 'Feb 2025',
  //   title: 'Bridging Descope Auth into Redux',
  //   tags: ['auth', 'react'],
  //   summary: 'Centralizing auth state across a mobile web application — how we wired Descope\'s SDK into Redux Toolkit for consistent session handling throughout the app.',
  //   readingTime: '5 min read',
  // },
  // {
  //   slug: 'compound-components-apis-your-team-actually-loves',
  //   date: 'Dec 2024',
  //   title: 'Compound Components: APIs Your Team Actually Loves',
  //   tags: ['react', 'patterns'],
  //   summary: 'A pattern for building flexible, composable UI components with minimal prop drilling and maximum developer ergonomics — the approach we used building our internal component library.',
  //   readingTime: '7 min read',
  // },
  // {
  //   slug: 'rbac-in-a-react-dashboard-with-azure-msal',
  //   date: 'Oct 2024',
  //   title: 'RBAC in a React Dashboard with Azure MSAL',
  //   tags: ['auth', 'azure'],
  //   summary: 'Fine-grained role-based access control using Azure MSAL and custom token claims — how we enforced permissions across a merchant data platform without leaking roles to the client.',
  //   readingTime: '9 min read',
  // },
];

export { posts };
export type { Post };
