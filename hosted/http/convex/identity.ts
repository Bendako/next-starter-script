import { queryGeneric } from 'convex/server';
import { v } from 'convex/values';

function requireClerkUserId(identity: { subject: string } | null): string {
  if (!identity) {
    throw new Error('Not authenticated');
  }
  return identity.subject;
}

export const viewer = queryGeneric({
  args: {},
  returns: v.object({
    clerkUserId: v.string(),
  }),
  handler: async (ctx) => {
    const clerkUserId = requireClerkUserId(await ctx.auth.getUserIdentity());
    return { clerkUserId };
  },
});

export const listOwned = queryGeneric({
  args: {
    userId: v.optional(v.string()),
  },
  returns: v.object({
    jobs: v.array(v.object({ userId: v.string() })),
    downloads: v.array(v.object({ userId: v.string() })),
  }),
  handler: async (ctx, args) => {
    void args.userId;
    const clerkUserId = requireClerkUserId(await ctx.auth.getUserIdentity());
    const jobs = await ctx.db
      .query('jobs')
      .withIndex('by_userId', (q) => q.eq('userId', clerkUserId))
      .collect();
    const downloads = await ctx.db
      .query('downloads')
      .withIndex('by_userId', (q) => q.eq('userId', clerkUserId))
      .collect();
    return {
      jobs: jobs.map((job) => ({ userId: job.userId })),
      downloads: downloads.map((download) => ({ userId: download.userId })),
    };
  },
});
