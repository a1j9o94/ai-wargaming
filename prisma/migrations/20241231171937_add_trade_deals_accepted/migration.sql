-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProposalParticipant" (
    "proposalId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "targetProposalId" TEXT,

    PRIMARY KEY ("proposalId", "participantId"),
    CONSTRAINT "ProposalParticipant_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProposalParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GameParticipant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProposalParticipant_targetProposalId_fkey" FOREIGN KEY ("targetProposalId") REFERENCES "Proposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProposalParticipant" ("participantId", "proposalId", "role") SELECT "participantId", "proposalId", "role" FROM "ProposalParticipant";
DROP TABLE "ProposalParticipant";
ALTER TABLE "new_ProposalParticipant" RENAME TO "ProposalParticipant";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
