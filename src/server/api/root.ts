import { createTRPCRouter } from "~/server/api/trpc";
import { orchestrationRouter } from "./routers/orchestration-router";
import { eventRouter } from "./routers/event-router";
import { aiPlayerRouter } from "~/server/ai/ai-orchestrator";
import { discussionRouter } from "./routers/discussion";
import { proposalRouter } from "./routers/proposal";
import { userRouter } from "./routers/user";
import { objectivesRouter } from "./routers/objectives";
/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  orchestration: orchestrationRouter,
  events: eventRouter,
  ai: aiPlayerRouter,
  discussion: discussionRouter,
  proposal: proposalRouter,
  user: userRouter,
  objectives: objectivesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

// Export createCaller
export const createCaller = appRouter.createCaller;
