-- AlterEnum
ALTER TYPE "ActivityAction" ADD VALUE 'ESCALATED';

-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN     "lastEscalationStatus" TEXT NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE INDEX "WorkItem_teamId_status_lastEscalationStatus_idx" ON "WorkItem"("teamId", "status", "lastEscalationStatus");
