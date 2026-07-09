-- Système de crédits prépayés : rôle SUPER_ADMIN, Wallet (singleton) et CreditLedger (append-only).
-- Migration non destructive : uniquement des ajouts (aucune table/colonne existante modifiée).

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('ACHAT_PACK', 'CONSOMMATION', 'REMBOURSEMENT', 'AJUSTEMENT');

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reservationId" INTEGER,
    "packLabel" VARCHAR(100),
    "paymentRef" VARCHAR(200),
    "note" TEXT,
    "createdBy" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "CreditLedger_walletId_created_at_idx" ON "CreditLedger"("walletId", "created_at");

-- CreateIndex
CREATE INDEX "CreditLedger_created_at_idx" ON "CreditLedger"("created_at");
