import { createTRPCRouter } from "~/server/api/trpc";
import { gameRouter } from "./routers/game";
import { userRouter } from "./routers/user";
import { aiPlayerRouter } from "./routers/ai-player";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  game: gameRouter,
  user: userRouter,
  ai: aiPlayerRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
