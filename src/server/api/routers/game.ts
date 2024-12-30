import { createTRPCRouter } from "~/server/api/trpc";
import { discussionRouter } from "./discussion";
import { proposalRouter } from "./proposal";
import { orchestratorRouter } from "./orchestrator";
import { aiPlayerRouter } from "./ai-player";

export const gameRouter = createTRPCRouter({
  discussion: discussionRouter,
  proposal: proposalRouter,
  orchestrator: orchestratorRouter,
  ai: aiPlayerRouter,
}); 