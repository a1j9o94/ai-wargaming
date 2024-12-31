import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { tracked } from "@trpc/server";
import { ee } from "~/server/events/game-events";
import { on } from "events";
import type { GameUpdate, LogEntry } from "~/server/events/event-types";

export const eventRouter = createTRPCRouter({
  // Subscribe to game updates
  onGameUpdate: protectedProcedure
    .input(z.object({
      gameId: z.string(),
      lastEventId: z.string().nullish(),
    }))
    .subscription(async function* ({ input, ctx }) {
      console.log(`[DEBUG] New subscription started for game ${input.gameId}`);
      
      // Cache the participant check result
      const participant = await ctx.db.gameParticipant.findFirst({
        where: {
          gameId: input.gameId,
          userId: ctx.session.user.id,
        },
        select: { id: true },
      });

      if (!participant) {
        console.log(`[DEBUG] Subscription rejected - no participant found for game ${input.gameId}`);
        return;
      }

      console.log(`[DEBUG] Subscription authorized for participant ${participant.id} in game ${input.gameId}`);

      // Create a cleanup function that removes specific listeners
      const errorHandler = (err: Error) => {
        console.log(`[DEBUG] Error in game subscription for ${input.gameId}:`, err);
      };

      const updateHandler = (update: unknown) => {
        console.log(`[DEBUG] Received update for game ${input.gameId}:`, {
          updateType: update && typeof update === 'object' && 'type' in update ? (update as { type: string }).type : 'unknown',
          updateId: update && typeof update === 'object' && 'id' in update ? (update as { id: string }).id : undefined
        });
      };

      // Add listeners
      ee.on(`game:${input.gameId}`, updateHandler);
      ee.on('error', errorHandler);

      const cleanup = () => {
        console.log(`[DEBUG] Cleaning up subscription for game ${input.gameId}`);
        ee.off(`game:${input.gameId}`, updateHandler);
        ee.off('error', errorHandler);
      };

      try {
        // Use a more efficient event handling approach
        for await (const [update] of on(ee, `game:${input.gameId}`)) {
          // Skip invalid updates early
          if (!update || typeof update !== 'object') continue;

          // Handle different types of updates
          if (update && typeof update === 'object' && 'type' in update && 
              (update as GameUpdate).type === 'GAME_UPDATE') {
            const gameUpdate = update as GameUpdate;
            yield tracked(gameUpdate.event, gameUpdate);
          } else if (update && typeof update === 'object' && 'id' in update) {
            // For log entries, only fetch if necessary
            const logEntry = update as LogEntry;
            
            // If we already know it's public, yield immediately
            if (logEntry.isPublic) {
              yield tracked(logEntry.id, logEntry);
              continue;
            }

            // Only query the database if we need to check visibility
            const typedUpdate = await ctx.db.logEntry.findUnique({
              where: { id: logEntry.id },
              select: {
                id: true,
                isPublic: true,
                visibleTo: {
                  select: { id: true }
                }
              }
            });
            
            if (typedUpdate?.isPublic || 
                typedUpdate?.visibleTo?.some(p => p.id === participant.id)) {
              yield tracked(typedUpdate.id, typedUpdate);
            }
          }
        }
      } catch (err) {
        console.error(`[DEBUG] Subscription error for game ${input.gameId}:`, err);
      } finally {
        cleanup();
      }
    }),
}); 