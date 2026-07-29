import type { PrismaClient, Prisma, ProgramStatus } from '@prisma/client';

/**
 * Helpers du cycle de vie des programmes (ACTIF / CLOTURE / ARCHIVE).
 *
 * Règles appliquées côté écriture :
 *  - Création de réservation : autorisée uniquement si le programme est ACTIF
 *    (rejet HTTP 409 { code: 'PROGRAMME_NON_ACTIF' } sinon). Doit être vérifié
 *    AVANT tout débit de crédit.
 *  - Paiements, dépenses, modification de réservation : autorisés si ACTIF ou
 *    CLOTURE ; bloqués si ARCHIVE (lecture seule).
 */

/** Client Prisma OU client de transaction. */
type Db = PrismaClient | Prisma.TransactionClient;

export async function getProgramLifecycle(
  db: Db,
  programId: number
): Promise<{ status: ProgramStatus; name: string } | null> {
  if (!Number.isFinite(programId)) return null;
  const program = await db.program.findUnique({
    where: { id: programId },
    select: { status: true, name: true },
  });
  return program ?? null;
}

/** true si le programme accepte de nouvelles réservations (uniquement ACTIF). */
export function isBookable(status: ProgramStatus): boolean {
  return status === 'ACTIF';
}

/** true si le programme accepte les écritures financières / MAJ dossier (ACTIF ou CLOTURE). */
export function isWritable(status: ProgramStatus): boolean {
  return status === 'ACTIF' || status === 'CLOTURE';
}

/** Corps de réponse standardisé quand une nouvelle réservation est refusée. */
export const PROGRAMME_NON_ACTIF_BODY = {
  code: 'PROGRAMME_NON_ACTIF',
  message: "Ce programme est clôturé, aucune nouvelle réservation n'est possible.",
} as const;

/** Corps de réponse standardisé quand une écriture est refusée (programme archivé). */
export const PROGRAMME_ARCHIVE_BODY = {
  code: 'PROGRAMME_ARCHIVE',
  message: 'Programme archivé — lecture seule, aucune modification possible.',
} as const;
