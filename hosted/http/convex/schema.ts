import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  jobs: defineTable({
    userId: v.string(),
    status: v.string(),
    createdAt: v.number(),
  }).index('by_userId', ['userId']),
  downloads: defineTable({
    userId: v.string(),
    jobId: v.id('jobs'),
    createdAt: v.number(),
  }).index('by_userId', ['userId']),
});
