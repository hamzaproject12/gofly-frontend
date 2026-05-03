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
  if (v === null || v === undefined) return '—';
  if (v instanceof Date) return v.toISOString();
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
  programId: 'Programme (id)',
  roomType: 'Type chambre',
  hotelMadina: 'Hôtel Madina',
  hotelMakkah: 'Hôtel Makkah',
  price: 'Prix (DH)',
  paidAmount: 'Montant payé (DH)',
  status: 'Statut dossier',
  statutPasseport: 'Statut passeport',
  statutVisa: 'Statut visa',
  statutHotel: 'Statut hôtel',
  statutVol: 'Statut vol',
  reservationDate: 'Date réservation',
  gender: 'Genre',
  agentId: 'Agent assigné',
  reduction: 'Réduction',
  plan: 'Plan',
  passportNumber: 'N° passeport',
  transport: 'Transport',
  remarque: 'Remarque',
  groupe: 'Groupe',
  typeReservation: 'Type réservation',
  isLeader: 'Leader',
  parentId: 'parentId',
  groupId: 'groupId',
  familyMixed: 'Famille mixte',
  roomSlot: 'roomSlot',
};

export function diffReservationJournalRows(before: ReservationJournalRow, after: ReservationJournalRow): string {
  const changed = getChangedReservationScalarKeys(before, after);
  if (!changed.length) return '';

  const lines: string[] = ['--- Champs modifiés ---'];
  for (const k of changed) {
    if (k === 'programId') {
      lines.push(
        `Programme: « ${before.program.name} » (id ${before.program.id}) → « ${after.program.name} » (id ${after.program.id})`
      );
      continue;
    }
    if (k === 'agentId') {
      const bNom = before.agent?.nom ?? '—';
      const aNom = after.agent?.nom ?? '—';
      lines.push(
        `${RES_FIELD_FR.agentId}: ${bNom} (id ${fmtJournalVal(before.agentId)}) → ${aNom} (id ${fmtJournalVal(after.agentId)})`
      );
      continue;
    }
    const label = RES_FIELD_FR[k] ?? String(k);
    lines.push(`${label}: ${fmtJournalVal(before[k])} → ${fmtJournalVal(after[k])}`);
  }
  return lines.join('\n');
}

export function compactReservationSnapshot(r: ReservationJournalRow): string {
  return [
    `ID #${r.id} — ${r.firstName} ${r.lastName} | ${r.phone}`,
    `Programme: ${r.program.name} (id=${r.program.id}) | ${r.roomType} | ${r.status} | ${r.price} DH`,
    `Hôtels: ${r.hotelMadina ?? '—'} / ${r.hotelMakkah ?? '—'} | Statuts P/V/H/Vol: ${r.statutPasseport}/${r.statutVisa}/${r.statutHotel}/${r.statutVol}`,
  ].join('\n');
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
  isDeleted: 'Masqué (soft delete)',
  deletedAt: 'Date suppression',
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
  const lines: string[] = ['--- Champs programme modifiés ---'];
  for (const k of changed) {
    const label = PROG_FIELD_FR[k] ?? String(k);
    lines.push(`${label}: ${fmtJournalVal(before[k])} → ${fmtJournalVal(after[k])}`);
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
  const summary = `Création réservation #${snapshot.id} — ${snapshot.firstName} ${snapshot.lastName}`;
  let text = '=== CRÉATION RÉSERVATION ===\n';
  text += 'Origine: API POST (création réservation ou groupe chambre privée).\n';
  text += compactReservationSnapshot(snapshot);
  return { summary, detailText: text };
}

export function buildReservationUpdateDetail(
  before: ReservationJournalRow,
  after: ReservationJournalRow,
  source: 'PUT' | 'PATCH',
  options?: { extraNote?: string }
): { summary: string; detailText: string } {
  const summary = `Modification réservation #${after.id} — ${after.firstName} ${after.lastName}`;
  let text = '=== MODIFICATION RÉSERVATION ===\n';
  text += `Origine: API ${source} /api/reservations/:id\n`;
  const diff = diffReservationJournalRows(before, after);
  text += diff || '(Aucun champ métier modifié sur la ligne réservation.)\n';
  if (options?.extraNote) text += `\n${options.extraNote}\n`;
  if (source === 'PUT') {
    text += '\nNote: en PUT, paiements et pièces peuvent avoir été remplacés si fournis dans la requête.\n';
  }
  return { summary, detailText: text };
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

  let text = '=== SUPPRESSION DE RÉSERVATION(S) ===\n';
  text += `Nombre de lignes: ${sorted.length}\n`;
  text += `Origine: API DELETE /api/reservations/:id\n\n`;

  for (const r of sorted) {
    const role = r.isLeader ? 'Leader' : 'Accompagnant';
    text += `#${r.id} (${role}) — ${r.firstName} ${r.lastName} | ${r.phone} | ${r.program.name} | ${r.price} DH payé ${r.paidAmount} DH | statut ${r.status}\n`;
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
  const summary = `Suppression de ${rooms.length} chambre(s) — programme « ${prog.name} » (id=${prog.id})`;

  let text = '=== SUPPRESSION DE CHAMBRE(S) ===\n';
  text += `Contexte: ${context}\n`;
  text += `Nombre de chambres: ${rooms.length}\n\n`;

  for (const room of rooms) {
    text += `#${room.id} — ${room.hotel.name} (${room.hotel.city}) | ${room.roomType} ${room.gender} | places ${room.nbrPlaceRestantes}/${room.nbrPlaceTotal} | ${room.prixRoom} DH | résa: ${JSON.stringify(room.listeIdsReservation)}\n`;
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
  const summary = `Programme « ${program.name} » (id=${program.id})`;
  let text = '=== PROGRAMME (instantané) ===\n';
  text += `ID ${program.id} — ${program.name}\n`;
  text += `Jours Mdn/Mkk: ${program.nbJoursMadina}/${program.nbJoursMakkah} | change ${program.exchange} | avion ${program.prixAvionDH} DH | visa ${program.prixVisaRiyal} riyal\n`;
  text += `Profits g/éco/n/VIP: ${program.profit} / ${program.profitEconomique} / ${program.profitNormal} / ${program.profitVIP}\n`;
  text += `isDeleted: ${program.isDeleted} | deletedAt: ${program.deletedAt?.toISOString() ?? '—'}\n`;
  return { summary, detailText: text };
}

export function buildProgramUpdateDetail(
  before: Program,
  after: Program,
  roomsCountBefore: number,
  roomsCountAfter: number
): { summary: string; detailText: string } {
  const summary = `Modification programme « ${after.name} » (id=${after.id})`;
  let text = '=== MODIFICATION PROGRAMME ===\n';
  text += `Origine: API PUT /api/programs/:id\n`;
  const progDiff = diffProgramScalars(before, after);
  text += progDiff ? `${progDiff}\n` : '';
  if (roomsCountBefore !== roomsCountAfter) {
    text += `--- Stock chambres (lignes Room) ---\n${roomsCountBefore} → ${roomsCountAfter}\n`;
  }
  if (!progDiff && roomsCountBefore === roomsCountAfter) {
    text +=
      '(Aucune différence sur les champs programme suivis ; la configuration hôtels / chambres peut être identique en compteur.)\n';
  } else {
    text +=
      '\n(Les liaisons hôtels et le détail des chambres peuvent aussi avoir changé sans toucher aux champs ci-dessus.)\n';
  }
  return { summary, detailText: text };
}

export function buildProgramHardDeleteExtra(counts: {
  reservationCount: number;
  roomCount: number;
  expenseCount: number;
}): string {
  return `\nCompteurs avant suppression définitive — réservations: ${counts.reservationCount}, chambres: ${counts.roomCount}, dépenses (programme): ${counts.expenseCount}\n`;
}

export function buildFixedChargeDeletionDetail(fc: FixedCharge & { agent?: { id: number; nom: string; email: string | null } | null }): {
  summary: string;
  detailText: string;
} {
  const summary = `Charge fixe « ${fc.label} » (id=${fc.id})`;
  let text = '=== SUPPRESSION CHARGE FIXE ===\n';
  text += `#${fc.id} — ${fc.label} | ${fc.amount} DH | ${fc.category} | active: ${fc.isActive}\n`;
  text += `Agent lié: ${fc.agent ? `${fc.agent.nom} (id=${fc.agent.id})` : '—'}\n`;
  return { summary, detailText: text };
}

export function buildAgentDeactivationDetail(
  target: Agent,
  actorLabel: string
): { summary: string; detailText: string } {
  const summary = `Désactivation agent « ${target.nom} » (id=${target.id})`;
  let text = '=== DÉSACTIVATION AGENT ===\n';
  text += `Cible: #${target.id} ${target.nom} (${target.role}) | actif avant: ${target.isActive}\n`;
  text += `Par (session): ${actorLabel} → isActive: false\n`;
  return { summary, detailText: text };
}
