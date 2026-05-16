import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Reservation, Room, Program, FixedCharge, Agent, Hotel } from '@prisma/client';

export const JOURNAL_ACTION = {
  RESERVATION_CREATED: 'RESERVATION_CREATED',
  RESERVATION_DELETED: 'RESERVATION_DELETED',
  RESERVATION_UPDATED: 'RESERVATION_UPDATED',
  ROOM_DELETED: 'ROOM_DELETED',
  PROGRAM_SOFT_DELETED: 'PROGRAM_SOFT_DELETED',
  PROGRAM_HARD_DELETED: 'PROGRAM_HARD_DELETED',
  PROGRAM_UPDATED: 'PROGRAM_UPDATED',
  FIXED_CHARGE_DELETED: 'FIXED_CHARGE_DELETED',
  AGENT_DEACTIVATED: 'AGENT_DEACTIVATED',
} as const;

export type JournalActionCode = (typeof JOURNAL_ACTION)[keyof typeof JOURNAL_ACTION];

type JwtPayload = { agentId?: number; role?: string; email?: string; nom?: string };

export function getJournalActorFromRequest(req: Request): {
  actorId: number | null;
  actorRoleSnapshot: string;
} {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token) token = req.cookies?.authToken;
    if (!token) return { actorId: null, actorRoleSnapshot: 'UNKNOWN' };
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JwtPayload;
    const actorId = decoded.agentId ?? null;
    const actorRoleSnapshot =
      decoded.role === 'ADMIN' || decoded.role === 'AGENT' ? decoded.role : 'UNKNOWN';
    return { actorId, actorRoleSnapshot };
  } catch {
    return { actorId: null, actorRoleSnapshot: 'UNKNOWN' };
  }
}

/** Complète rôle + nom depuis la table Agent (JWT peut ne pas contenir le rôle). */
export async function resolveJournalActor(
  prisma: PrismaClient,
  req: Request
): Promise<{ actorId: number | null; actorRoleSnapshot: string; actorNom: string | null }> {
  const jwtActor = getJournalActorFromRequest(req);
  if (!jwtActor.actorId) {
    return { actorId: null, actorRoleSnapshot: jwtActor.actorRoleSnapshot, actorNom: null };
  }
  const agent = await prisma.agent.findUnique({
    where: { id: jwtActor.actorId },
    select: { nom: true, role: true },
  });
  return {
    actorId: jwtActor.actorId,
    actorRoleSnapshot: agent?.role ?? jwtActor.actorRoleSnapshot,
    actorNom: agent?.nom ?? null,
  };
}

export async function logJournalSuppression(
  prisma: PrismaClient,
  req: Request,
  params: {
    action: string;
    entityType: string;
    entityId: number | null;
    summary: string;
    detailText: string;
    /**
     * Libellé facultatif stocké en plus de actorId. Pour la traçabilité « qui a agi »,
     * ne pas y mettre l’agent commercial du dossier : préférer laisser vide pour utiliser
     * le nom résolu depuis la session (JWT → Agent).
     */
    parDisplay?: string | null;
    /**
     * Si la session JWT est absente, tracer cet agent (ex. agentId enregistré sur la réservation à la création).
     */
    actorIdFallback?: number | null;
  }
): Promise<void> {
  let resolved = await resolveJournalActor(prisma, req);
  const fb = params.actorIdFallback;
  if (resolved.actorId == null && fb != null && fb > 0) {
    const agentFb = await prisma.agent.findUnique({
      where: { id: fb },
      select: { id: true, nom: true, role: true },
    });
    if (agentFb) {
      const roleSnap =
        agentFb.role === 'ADMIN' || agentFb.role === 'AGENT' ? agentFb.role : 'UNKNOWN';
      resolved = { actorId: agentFb.id, actorRoleSnapshot: roleSnap, actorNom: agentFb.nom };
    }
  }

  const parDisplayFinal =
    params.parDisplay !== undefined && params.parDisplay !== null && params.parDisplay !== ''
      ? params.parDisplay
      : resolved.actorNom ?? undefined;

  try {
    await prisma.journalSuppression.create({
      data: {
        actorId: resolved.actorId ?? undefined,
        actorRoleSnapshot: resolved.actorRoleSnapshot,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? undefined,
        summary: params.summary.slice(0, 500),
        detailText: params.detailText,
        parDisplay: parDisplayFinal ?? undefined,
      },
    });
  } catch (e) {
    console.error('[JournalSuppression] Échec enregistrement:', e);
  }
}

export type ReservationJournalRow = Reservation & {
  program: { id: number; name: string };
  agent: { id: number; nom: string } | null;
};

function fmtJournalVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'vide';
  if (v instanceof Date) return v.toLocaleDateString('fr-FR');
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  return String(v);
}

const RESERVATION_SCALAR_KEYS: (keyof Reservation)[] = [
  'firstName',
  'lastName',
  'phone',
  'programId',
  'roomType',
  'hotelMadina',
  'hotelMakkah',
  'price',
  'paidAmount',
  'status',
  'statutPasseport',
  'statutVisa',
  'statutHotel',
  'statutVol',
  'reservationDate',
  'gender',
  'agentId',
  'reduction',
  'plan',
  'passportNumber',
  'transport',
  'remarque',
  'groupe',
  'typeReservation',
  'isLeader',
  'parentId',
  'groupId',
  'familyMixed',
  'roomSlot',
];

function reservationScalarEqual(k: keyof Reservation, b: Reservation, a: Reservation): boolean {
  const bv = b[k];
  const av = a[k];
  if (bv instanceof Date && av instanceof Date) return bv.getTime() === av.getTime();
  return bv === av;
}

export function getChangedReservationScalarKeys(b: Reservation, a: Reservation): (keyof Reservation)[] {
  const out: (keyof Reservation)[] = [];
  for (const k of RESERVATION_SCALAR_KEYS) {
    if (!reservationScalarEqual(k, b, a)) out.push(k);
  }
  return out;
}

const RESERVATION_STATUS_KEYS = new Set<keyof Reservation>([
  'status',
  'statutPasseport',
  'statutVisa',
  'statutHotel',
  'statutVol',
]);

/**
 * PATCH juste après création (wizard) : éviter la double ligne « créée » + « modifiée »
 * lorsque seuls statut / statuts pièces changent, sans payload documents.
 */
export function shouldSilencePostCreateStatutPatchJournal(
  before: ReservationJournalRow,
  after: ReservationJournalRow,
  hasDocumentsPayload: boolean,
  silenceMs = 180_000
): boolean {
  if (hasDocumentsPayload) return false;
  const created = before.created_at;
  if (!created || Date.now() - new Date(created).getTime() > silenceMs) return false;
  const changed = getChangedReservationScalarKeys(before, after);
  return changed.length > 0 && changed.every((k) => RESERVATION_STATUS_KEYS.has(k));
}

const RES_FIELD_FR: Partial<Record<keyof Reservation, string>> = {
  firstName: 'Prénom',
  lastName: 'Nom',
  phone: 'Téléphone',
  programId: 'Programme',
  roomType: 'Type de chambre',
  hotelMadina: 'Hôtel Madina',
  hotelMakkah: 'Hôtel Makkah',
  price: 'Prix (DH)',
  paidAmount: 'Montant payé (DH)',
  status: 'Statut du dossier',
  statutPasseport: 'Passeport joint',
  statutVisa: 'Visa obtenu',
  statutHotel: 'Hôtel confirmé',
  statutVol: 'Vol confirmé',
  reservationDate: 'Date de réservation',
  gender: 'Genre',
  agentId: 'Agent assigné',
  reduction: 'Réduction',
  plan: 'Formule',
  passportNumber: 'Numéro de passeport',
  transport: 'Transport',
  remarque: 'Remarque',
  groupe: 'Groupe',
  typeReservation: 'Type de réservation',
  isLeader: 'Responsable du dossier',
  parentId: 'Dossier parent',
  groupId: 'Référence du groupe',
  familyMixed: 'Famille mixte',
  roomSlot: 'Place dans la chambre',
};

export function diffReservationJournalRows(before: ReservationJournalRow, after: ReservationJournalRow): string {
  const changed = getChangedReservationScalarKeys(before, after);
  if (!changed.length) return '';

  const lines: string[] = ['Informations modifiées :'];
  for (const k of changed) {
    if (k === 'programId') {
      lines.push(
        `- Programme : « ${before.program.name} » → « ${after.program.name} »`
      );
      continue;
    }
    if (k === 'agentId') {
      const bNom = before.agent?.nom ?? 'aucun';
      const aNom = after.agent?.nom ?? 'aucun';
      lines.push(`- Agent assigné : ${bNom} → ${aNom}`);
      continue;
    }
    const label = RES_FIELD_FR[k] ?? String(k);
    lines.push(`- ${label} : ${fmtJournalVal(before[k])} → ${fmtJournalVal(after[k])}`);
  }
  return lines.join('\n');
}

export function compactReservationSnapshot(r: ReservationJournalRow): string {
  // N'afficher que les statuts à « oui » (passeport joint, visa, hôtel, vol).
  // Les statuts à false sont volontairement omis.
  const statutsOui: string[] = [];
  if (r.statutPasseport) statutsOui.push('Passeport joint: oui');
  if (r.statutVisa) statutsOui.push('Visa: oui');
  if (r.statutHotel) statutsOui.push('Hôtel: oui');
  if (r.statutVol) statutsOui.push('Vol: oui');
  const statutsLine = statutsOui.length ? statutsOui.join(' | ') : 'aucun';
  return [
    `Dossier n°${r.id} — ${r.firstName} ${r.lastName} — Téléphone : ${r.phone}`,
    `Programme : ${r.program.name} — Type de chambre : ${r.roomType} — Statut : ${r.status} — Prix : ${r.price} DH`,
    `Hôtel Madina : ${r.hotelMadina ?? 'non précisé'} — Hôtel Makkah : ${r.hotelMakkah ?? 'non précisé'}`,
    `Documents/statuts : ${statutsLine}`,
  ].join('\n');
}

/**
 * Vrai si la réservation vient d'être créée (dans la fenêtre de silence) : on
 * évite alors d'ajouter une ligne « modifiée » / « paiement » distincte de la
 * ligne « créée » lors de l'assistant nouvelle réservation / nouvelle chambre.
 */
export function isWithinPostCreateSilenceWindow(
  createdAt: Date | string | null | undefined,
  silenceMs = 180_000
): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() <= silenceMs;
}

const PROGRAM_SCALAR_KEYS: (keyof Program)[] = [
  'name',
  'nbJoursMadina',
  'nbJoursMakkah',
  'exchange',
  'prixAvionDH',
  'prixVisaRiyal',
  'profit',
  'profitEconomique',
  'profitNormal',
  'profitVIP',
  'visaDeadline',
  'hotelDeadline',
  'flightDeadline',
  'passportDeadline',
  'isDeleted',
  'deletedAt',
];

const PROG_FIELD_FR: Partial<Record<keyof Program, string>> = {
  name: 'Nom',
  nbJoursMadina: 'Jours Madina',
  nbJoursMakkah: 'Jours Makkah',
  exchange: 'Change',
  prixAvionDH: 'Prix avion (DH)',
  prixVisaRiyal: 'Prix visa (riyal)',
  profit: 'Profit global',
  profitEconomique: 'Profit éco',
  profitNormal: 'Profit normal',
  profitVIP: 'Profit VIP',
  visaDeadline: 'Deadline visa',
  hotelDeadline: 'Deadline hôtel',
  flightDeadline: 'Deadline vol',
  passportDeadline: 'Deadline passeport',
  isDeleted: 'Programme masqué',
  deletedAt: 'Date de masquage',
};

function programScalarEqual(k: keyof Program, b: Program, a: Program): boolean {
  const bv = b[k];
  const av = a[k];
  if (bv instanceof Date && av instanceof Date) return bv.getTime() === av.getTime();
  return bv === av;
}

export function getChangedProgramScalarKeys(b: Program, a: Program): (keyof Program)[] {
  const out: (keyof Program)[] = [];
  for (const k of PROGRAM_SCALAR_KEYS) {
    if (!programScalarEqual(k, b, a)) out.push(k);
  }
  return out;
}

export function diffProgramScalars(before: Program, after: Program): string {
  const changed = getChangedProgramScalarKeys(before, after);
  if (!changed.length) return '';
  const lines: string[] = ['Informations du programme modifiées :'];
  for (const k of changed) {
    const label = PROG_FIELD_FR[k] ?? String(k);
    lines.push(`- ${label} : ${fmtJournalVal(before[k])} → ${fmtJournalVal(after[k])}`);
  }
  return lines.join('\n');
}

/** Nom affiché dans « Par » pour les événements liés à une réservation (agent assigné). */
export function getAssignedAgentNomFromReservationRows(rows: ReservationJournalRow[]): string | null {
  const leader = rows.find((r) => r.isLeader);
  return leader?.agent?.nom ?? rows[0]?.agent?.nom ?? null;
}

export function buildReservationCreationDetail(snapshot: ReservationJournalRow): {
  summary: string;
  detailText: string;
} {
  const summary = `Création réservation — dossier n°${snapshot.id} — ${snapshot.firstName} ${snapshot.lastName}`;
  let text = 'CRÉATION D\'UNE RÉSERVATION\n\n';
  text += compactReservationSnapshot(snapshot);
  return { summary, detailText: text };
}

/**
 * Détail de création d'un dossier chambre privée : instantané du leader +
 * de chaque accompagnant, dans une seule entrée « Réservation créée ».
 */
export function buildReservationGroupCreationDetail(
  rows: ReservationJournalRow[],
  groupId: string | null
): { summary: string; detailText: string } {
  const sorted = [...rows].sort((a, b) => {
    if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1;
    return a.id - b.id;
  });
  const leader = sorted.find((r) => r.isLeader) ?? sorted[0];
  const summary = leader
    ? `Création groupe (${sorted.length} pers.) — ${leader.firstName} ${leader.lastName} (#${leader.id})`
    : `Création groupe (${sorted.length} pers.)`;

  let text = 'CRÉATION D\'UNE CHAMBRE PRIVÉE (DOSSIER GROUPE)\n\n';
  text += `Nombre de personnes : ${sorted.length}\n\n`;

  for (const r of sorted) {
    const role = r.isLeader ? 'Responsable du dossier' : 'Accompagnant';
    text += `--- ${role} ---\n`;
    text += `${compactReservationSnapshot(r)}\n\n`;
  }

  return { summary, detailText: text.trimEnd() + '\n' };
}

export function buildReservationUpdateDetail(
  before: ReservationJournalRow,
  after: ReservationJournalRow,
  source: 'PUT' | 'PATCH',
  options?: { extraNote?: string }
): { summary: string; detailText: string } {
  const summary = `Modification réservation — dossier n°${after.id} — ${after.firstName} ${after.lastName}`;
  let text = 'MODIFICATION D\'UNE RÉSERVATION\n\n';
  const diff = diffReservationJournalRows(before, after);
  text += diff || 'Aucune information de la réservation n\'a été modifiée.';
  if (options?.extraNote) text += `\n\n${options.extraNote}`;
  return { summary, detailText: text };
}

/**
 * Modification d'une chambre complète (dossier leader + accompagnants) en un seul
 * appel : produit UNE entrée de journal agrégée listant, par membre, les champs
 * réellement modifiés. `anyChange` est false si aucun membre n'a changé (dans ce
 * cas, ne rien journaliser).
 */
export function buildRoomGroupUpdateDetail(
  pairs: { before: ReservationJournalRow; after: ReservationJournalRow }[]
): { summary: string; detailText: string; anyChange: boolean } {
  const sorted = [...pairs].sort((a, b) => {
    if (a.after.isLeader !== b.after.isLeader) return a.after.isLeader ? -1 : 1;
    return a.after.id - b.after.id;
  });
  const leaderPair = sorted.find((p) => p.after.isLeader) ?? sorted[0];
  const leader = leaderPair?.after;

  const summary = leader
    ? `Modification chambre (${sorted.length} pers.) — ${leader.firstName} ${leader.lastName} (#${leader.id})`
    : `Modification chambre (${sorted.length} pers.)`;

  let text = 'MODIFICATION D\'UNE CHAMBRE PRIVÉE (DOSSIER GROUPE)\n\n';
  text += `Nombre de personnes : ${sorted.length}\n\n`;

  let anyChange = false;
  for (const p of sorted) {
    const role = p.after.isLeader ? 'Responsable du dossier' : 'Accompagnant';
    text += `--- ${role} : ${p.after.firstName} ${p.after.lastName} (dossier n°${p.after.id}) ---\n`;
    const diff = diffReservationJournalRows(p.before, p.after);
    if (diff) {
      anyChange = true;
      text += `${diff}\n\n`;
    } else {
      text += 'Aucune information modifiée.\n\n';
    }
  }

  return { summary, detailText: text, anyChange };
}

export function buildReservationDeletionDetail(rows: ReservationJournalRow[]): {
  summary: string;
  detailText: string;
} {
  const sorted = [...rows].sort((a, b) => {
    if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1;
    return a.id - b.id;
  });
  const names = sorted.map((r) => `${r.firstName} ${r.lastName}`).join(', ');
  const summary = `Suppression de ${sorted.length} réservation(s) — ${names.slice(0, 200)}${names.length > 200 ? '…' : ''}`;

  let text = 'SUPPRESSION DE RÉSERVATION(S)\n\n';
  text += `Nombre de réservations supprimées : ${sorted.length}\n\n`;

  for (const r of sorted) {
    const role = r.isLeader ? 'Responsable du dossier' : 'Accompagnant';
    text += `Dossier n°${r.id} (${role}) — ${r.firstName} ${r.lastName} — Téléphone : ${r.phone}\n`;
    text += `   Programme : ${r.program.name} — Prix : ${r.price} DH — Payé : ${r.paidAmount} DH — Statut : ${r.status}\n`;
  }

  return { summary, detailText: text };
}

export type RoomJournalRow = Room & {
  hotel: Hotel;
  program: { id: number; name: string };
};

export function buildRoomDeletionDetail(rooms: RoomJournalRow[], context: string): {
  summary: string;
  detailText: string;
} {
  if (rooms.length === 0) {
    return { summary: '', detailText: '' };
  }
  const prog = rooms[0].program;
  const summary = `Suppression de ${rooms.length} chambre(s) — programme « ${prog.name} »`;

  let text = 'SUPPRESSION DE CHAMBRE(S)\n\n';
  text += `Programme : ${prog.name}\n`;
  text += `Nombre de chambres supprimées : ${rooms.length}\n\n`;

  for (const room of rooms) {
    text += `Chambre n°${room.id} — ${room.hotel.name} (${room.hotel.city}) — ${room.roomType} ${room.gender}\n`;
    text += `   Places restantes : ${room.nbrPlaceRestantes}/${room.nbrPlaceTotal} — Prix : ${room.prixRoom} DH\n`;
  }

  return { summary, detailText: text };
}

/** Appeler après deleteMany : passer le snapshot chargé **avant** la suppression. */
export async function logRoomsDeletedFromSnapshot(
  prisma: PrismaClient,
  req: Request,
  rooms: RoomJournalRow[],
  context: string,
  parDisplay?: string | null
): Promise<void> {
  if (!rooms.length) return;
  const { summary, detailText } = buildRoomDeletionDetail(rooms, context);
  await logJournalSuppression(prisma, req, {
    action: JOURNAL_ACTION.ROOM_DELETED,
    entityType: 'Room',
    entityId: rooms[0].id,
    summary,
    detailText,
    parDisplay: parDisplay ?? undefined,
  });
}

export function buildProgramDeletionDetail(program: Program): { summary: string; detailText: string } {
  const summary = `Programme « ${program.name} »`;
  let text = 'PROGRAMME (informations)\n\n';
  text += `Nom : ${program.name}\n`;
  text += `Durée : ${program.nbJoursMadina} jour(s) à Madina — ${program.nbJoursMakkah} jour(s) à Makkah\n`;
  text += `Taux de change : ${program.exchange} — Prix avion : ${program.prixAvionDH} DH — Prix visa : ${program.prixVisaRiyal} riyal\n`;
  text += `Profits — global : ${program.profit} | économique : ${program.profitEconomique} | normal : ${program.profitNormal} | VIP : ${program.profitVIP}\n`;
  text += `Programme masqué : ${program.isDeleted ? 'oui' : 'non'}\n`;
  return { summary, detailText: text };
}

export function buildProgramUpdateDetail(
  before: Program,
  after: Program,
  roomsCountBefore: number,
  roomsCountAfter: number
): { summary: string; detailText: string } {
  const summary = `Modification programme « ${after.name} »`;
  let text = 'MODIFICATION D\'UN PROGRAMME\n\n';
  const progDiff = diffProgramScalars(before, after);
  text += progDiff ? `${progDiff}\n` : '';
  if (roomsCountBefore !== roomsCountAfter) {
    text += `Nombre de chambres : ${roomsCountBefore} → ${roomsCountAfter}\n`;
  }
  if (!progDiff && roomsCountBefore === roomsCountAfter) {
    text +=
      'Aucune information principale du programme n\'a changé (les hôtels ou le détail des chambres ont pu être ajustés sans modifier ces informations).\n';
  } else {
    text +=
      '\nRemarque : les hôtels associés et le détail des chambres ont aussi pu changer.\n';
  }
  return { summary, detailText: text };
}

export function buildProgramHardDeleteExtra(counts: {
  reservationCount: number;
  roomCount: number;
  expenseCount: number;
}): string {
  return `\nAvant la suppression définitive — Réservations : ${counts.reservationCount} | Chambres : ${counts.roomCount} | Dépenses du programme : ${counts.expenseCount}\n`;
}

export function buildFixedChargeDeletionDetail(fc: FixedCharge & { agent?: { id: number; nom: string; email: string | null } | null }): {
  summary: string;
  detailText: string;
} {
  const summary = `Charge fixe « ${fc.label} »`;
  let text = 'SUPPRESSION D\'UNE CHARGE FIXE\n\n';
  text += `Libellé : ${fc.label}\n`;
  text += `Montant : ${fc.amount} DH — Catégorie : ${fc.category} — Active : ${fc.isActive ? 'oui' : 'non'}\n`;
  text += `Agent lié : ${fc.agent ? fc.agent.nom : 'aucun'}\n`;
  return { summary, detailText: text };
}

export function buildAgentDeactivationDetail(
  target: Agent,
  actorLabel: string
): { summary: string; detailText: string } {
  const summary = `Désactivation agent « ${target.nom} »`;
  let text = 'DÉSACTIVATION D\'UN AGENT\n\n';
  text += `Agent concerné : ${target.nom} (${target.role})\n`;
  text += `Désactivé par : ${actorLabel}\n`;
  return { summary, detailText: text };
}
