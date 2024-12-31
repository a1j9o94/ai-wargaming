-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GameParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "userId" TEXT,
    "civilization" TEXT NOT NULL,
    "might" INTEGER NOT NULL DEFAULT 80,
    "economy" INTEGER NOT NULL DEFAULT 80,
    "tradeDealsAccepted" INTEGER NOT NULL DEFAULT 0,
    "remainingProposals" INTEGER NOT NULL DEFAULT 2,
    "isAI" BOOLEAN NOT NULL DEFAULT false,
    "hasAcknowledgedCompletion" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "GameParticipant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GameParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GameParticipant" ("civilization", "economy", "gameId", "hasAcknowledgedCompletion", "id", "isAI", "might", "remainingProposals", "userId") SELECT "civilization", "economy", "gameId", "hasAcknowledgedCompletion", "id", "isAI", "might", "remainingProposals", "userId" FROM "GameParticipant";
DROP TABLE "GameParticipant";
ALTER TABLE "new_GameParticipant" RENAME TO "GameParticipant";
CREATE UNIQUE INDEX "GameParticipant_gameId_userId_key" ON "GameParticipant"("gameId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
