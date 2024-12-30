import { createTRPCRouter } from "~/server/api/trpc";
import { discussionRouter } from "./routers/discussion";
import { orchestratorRouter } from "./routers/orchestrator";
import { proposalRouter } from "./routers/proposal";
import { aiPlayerRouter } from "./routers/ai-player";
import { userRouter } from "./routers/user";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  game: createTRPCRouter({
    orchestrator: orchestratorRouter,
    proposal: proposalRouter,
    discussion: discussionRouter,
    ai: aiPlayerRouter,
  }),
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

// Export createCaller
export const createCaller = appRouter.createCaller;
