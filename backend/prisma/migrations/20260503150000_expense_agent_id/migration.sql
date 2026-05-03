-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "agentId" INTEGER;

-- AddForeignKey
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
