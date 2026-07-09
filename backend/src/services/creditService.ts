import { Prisma, PrismaClient } from '@prisma/client';

/** Client Prisma « normal » ou client de transaction ($transaction). */
type Db = PrismaClient | Prisma.TransactionClient;

/** Fenêtre de remboursement automatique après création d'une réservation. */
export const REFUND_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Erreur métier : solde de crédits insuffisant. Lancée à l'intérieur d'une
 * $transaction, elle fait échouer la transaction entière (aucun dossier créé).
 */
export class InsufficientCreditsError extends Error {
  readonly code = 'CREDITS_INSUFFISANTS';

  constructor(
    public readonly solde: number,
    public readonly requis: number
  ) {
    super(`Crédits insuffisants : solde=${solde}, requis=${requis}`);
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Crédits offerts à la création du wallet (variable d'environnement
 * WELCOME_CREDITS, défaut 10 si absente ou invalide).
 */
function welcomeCredits(): number {
  const raw = Number(process.env.WELCOME_CREDITS ?? '10');
  return Number.isInteger(raw) && raw >= 0 ? raw : 10;
}

/**
 * Garantit l'existence du Wallet singleton (findFirst-or-create).
 * À la CRÉATION uniquement : solde initial = WELCOME_CREDITS + ligne BONUS.
 * Si un wallet existe déjà (quel que soit son solde), ne modifie rien.
 */
export async function ensureWallet(db: Db) {
  const existing = await db.wallet.findFirst();
  if (existing) return existing;
  const bonus = welcomeCredits();
  const wallet = await db.wallet.create({ data: { balance: bonus } });
  if (bonus > 0) {
    await db.creditLedger.create({
      data: {
        walletId: wallet.id,
        type: 'BONUS',
        amount: bonus,
        balanceAfter: bonus,
        note: 'Crédits de bienvenue — offre de démarrage',
        createdBy: 'system',
      },
    });
  }
  return wallet;
}

/**
 * Débite `n` crédits dans la transaction courante. Le décrément est
 * conditionnel (`balance >= n`) pour gérer la concurrence : si deux créations
 * simultanées se disputent le dernier crédit, une seule passe.
 */
export async function debitCreditsInTx(
  tx: Prisma.TransactionClient,
  n: number
): Promise<{ walletId: number; balanceAfter: number }> {
  const wallet = await ensureWallet(tx);
  const updated = await tx.wallet.updateMany({
    where: { id: wallet.id, balance: { gte: n } },
    data: { balance: { decrement: n } },
  });
  if (updated.count === 0) {
    throw new InsufficientCreditsError(wallet.balance, n);
  }
  const after = await tx.wallet.findUnique({ where: { id: wallet.id } });
  return { walletId: wallet.id, balanceAfter: after?.balance ?? wallet.balance - n };
}

/** Écrit la ligne CONSOMMATION (-n) une fois la réservation créée (même transaction). */
export async function logConsumptionInTx(
  tx: Prisma.TransactionClient,
  params: {
    walletId: number;
    n: number;
    balanceAfter: number;
    reservationId: number;
    createdBy: string;
  }
): Promise<void> {
  await tx.creditLedger.create({
    data: {
      walletId: params.walletId,
      type: 'CONSOMMATION',
      amount: -params.n,
      balanceAfter: params.balanceAfter,
      reservationId: params.reservationId,
      createdBy: params.createdBy,
    },
  });
}

/**
 * Rembourse `n` crédits (suppression d'un dossier créé il y a moins de 48h)
 * dans la transaction courante : incrément + ligne REMBOURSEMENT (+n).
 */
export async function refundCreditsInTx(
  tx: Prisma.TransactionClient,
  n: number,
  params: { reservationId: number; createdBy: string }
): Promise<void> {
  const wallet = await ensureWallet(tx);
  const updated = await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: { increment: n } },
  });
  await tx.creditLedger.create({
    data: {
      walletId: wallet.id,
      type: 'REMBOURSEMENT',
      amount: n,
      balanceAfter: updated.balance,
      reservationId: params.reservationId,
      createdBy: params.createdBy,
    },
  });
}
