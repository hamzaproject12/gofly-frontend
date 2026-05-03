-- CreateTable
CREATE TABLE "JournalSuppression" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" INTEGER,
    "actorRoleSnapshot" VARCHAR(20) NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(40) NOT NULL,
    "entityId" INTEGER,
    "summary" VARCHAR(500),
    "detailText" TEXT NOT NULL,

    CONSTRAINT "JournalSuppression_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "JournalSuppression" ADD CONSTRAINT "JournalSuppression_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "JournalSuppression_created_at_idx" ON "JournalSuppression"("created_at");

-- CreateIndex
CREATE INDEX "JournalSuppression_actorId_created_at_idx" ON "JournalSuppression"("actorId", "created_at");

-- CreateIndex
CREATE INDEX "JournalSuppression_action_idx" ON "JournalSuppression"("action");

-- CreateIndex
CREATE INDEX "JournalSuppression_entityType_entityId_idx" ON "JournalSuppression"("entityType", "entityId");
