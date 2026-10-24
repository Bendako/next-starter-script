import { queryGeneric } from 'convex/server';

export const ok = queryGeneric({
  args: {},
  handler: async () => 'OK',
});
