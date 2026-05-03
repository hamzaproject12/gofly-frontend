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

/** Nom affiché dans « Par » pour les événements liés à une réservation (agent assigné). */
export function getAssignedAgentNomFromReservationRows(rows: ReservationJournalRow[]): string | null {
  const leader = rows.find((r) => r.isLeader);
  return leader?.agent?.nom ?? rows[0]?.agent?.nom ?? null;
}

export function describeReservationSnapshot(r: ReservationJournalRow): string {
  let text = '';
  text += `ID #${r.id} — ${r.firstName} ${r.lastName}\n`;
  text += `Téléphone: ${r.phone}\n`;
  text += `Programme: ${r.program.name} (id=${r.program.id})\n`;
  text += `Type chambre: ${r.roomType} | Genre: ${r.gender}\n`;
  text += `Plan: ${r.plan} | Type réservation: ${r.typeReservation}\n`;
  text += `Prix: ${r.price} DH | Payé: ${r.paidAmount} DH | Réduction: ${r.reduction}\n`;
  text += `Statut: ${r.status}\n`;
  text += `Date réservation: ${r.reservationDate.toISOString()}\n`;
  text += `Hôtels Madina/Makkah: ${r.hotelMadina ?? '—'} / ${r.hotelMakkah ?? '—'}\n`;
  text += `Statuts: passeport=${r.statutPasseport} visa=${r.statutVisa} hôtel=${r.statutHotel} vol=${r.statutVol}\n`;
  text += `Agent assigné: ${r.agent ? `${r.agent.nom} (id=${r.agent.id})` : '—'}\n`;
  text += `Remarque: ${r.remarque ?? '—'}\n`;
  return text;
}

export function buildReservationCreationDetail(snapshot: ReservationJournalRow): {
  summary: string;
  detailText: string;
} {
  const summary = `Création réservation #${snapshot.id} — ${snapshot.firstName} ${snapshot.lastName}`;
  let text = '=== CRÉATION RÉSERVATION ===\n';
  text += 'Origine: API POST (création réservation ou groupe chambre privée).\n';
  text += describeReservationSnapshot(snapshot);
  return { summary, detailText: text };
}

export function buildReservationUpdateDetail(
  before: ReservationJournalRow,
  after: ReservationJournalRow,
  source: 'PUT' | 'PATCH'
): { summary: string; detailText: string } {
  const summary = `Modification réservation #${after.id} — ${after.firstName} ${after.lastName}`;
  let text = '=== MODIFICATION RÉSERVATION ===\n';
  text += `Origine: API ${source} /api/reservations/:id\n`;
  text += `Agent assigné (référence métier): ${after.agent ? `${after.agent.nom} (id=${after.agent.id})` : before.agent ? `${before.agent.nom} (id=${before.agent.id})` : '—'}\n\n`;
  text += '--- AVANT ---\n';
  text += describeReservationSnapshot(before);
  text += '\n--- APRÈS ---\n';
  text += describeReservationSnapshot(after);
  text +=
    '\nNote: en PUT, paiements et pièces peuvent avoir été remplacés si fournis dans la requête.\n';
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
    const role = r.isLeader ? 'Leader' : 'Accompagnant / membre';
    text += `--- ${role} — ID réservation #${r.id} ---\n`;
    text += `Nom: ${r.firstName} ${r.lastName}\n`;
    text += `Téléphone: ${r.phone}\n`;
    text += `Programme: ${r.program.name} (id=${r.program.id})\n`;
    text += `Type chambre: ${r.roomType} | Genre: ${r.gender}\n`;
    text += `Plan: ${r.plan} | Type réservation: ${r.typeReservation}\n`;
    text += `Prix: ${r.price} DH | Payé: ${r.paidAmount} DH | Réduction: ${r.reduction}\n`;
    text += `Statut: ${r.status}\n`;
    text += `Date réservation: ${r.reservationDate.toISOString()}\n`;
    text += `Hôtel Madina: ${r.hotelMadina ?? '—'} | Hôtel Makkah: ${r.hotelMakkah ?? '—'}\n`;
    text += `Passeport: ${r.passportNumber ?? '—'} | Transport: ${r.transport ?? '—'}\n`;
    text += `Groupe: ${r.groupe ?? '—'} | groupId: ${r.groupId ?? '—'} | parentId: ${r.parentId ?? '—'}\n`;
    text += `Leader: ${r.isLeader} | roomSlot: ${r.roomSlot ?? '—'}\n`;
    text += `Statuts: passeport=${r.statutPasseport} visa=${r.statutVisa} hôtel=${r.statutHotel} vol=${r.statutVol}\n`;
    text += `Agent assigné: ${r.agent ? `${r.agent.nom} (id=${r.agent.id})` : '—'}\n`;
    text += `Remarque: ${r.remarque ?? '—'}\n\n`;
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
    text += `--- Chambre ID #${room.id} ---\n`;
    text += `Programme: ${room.program.name} (id=${room.program.id})\n`;
    text += `Hôtel: ${room.hotel.name} (${room.hotel.city})\n`;
    text += `Type: ${room.roomType} | Genre: ${room.gender}\n`;
    text += `Places totales: ${room.nbrPlaceTotal} | Restantes: ${room.nbrPlaceRestantes}\n`;
    text += `Prix chambre: ${room.prixRoom} DH\n`;
    text += `IDs réservations liées (listeIdsReservation): ${JSON.stringify(room.listeIdsReservation)}\n\n`;
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
  let text = '=== PROGRAMME (instantané avant suppression / masquage) ===\n';
  text += `ID: ${program.id}\n`;
  text += `Nom: ${program.name}\n`;
  text += `Créé le: ${program.created_at.toISOString()}\n`;
  text += `isDeleted: ${program.isDeleted} | deletedAt: ${program.deletedAt?.toISOString() ?? '—'}\n`;
  text += `Deadlines — visa: ${program.visaDeadline?.toISOString() ?? '—'} | hôtel: ${program.hotelDeadline?.toISOString() ?? '—'} | vol: ${program.flightDeadline?.toISOString() ?? '—'} | passeport: ${program.passportDeadline?.toISOString() ?? '—'}\n`;
  text += `Exchange: ${program.exchange} | Jours Madina: ${program.nbJoursMadina} | Jours Makkah: ${program.nbJoursMakkah}\n`;
  text += `Prix avion DH: ${program.prixAvionDH} | Prix visa riyal: ${program.prixVisaRiyal}\n`;
  text += `Profits — global: ${program.profit} | éco: ${program.profitEconomique} | normal: ${program.profitNormal} | VIP: ${program.profitVIP}\n`;
  return { summary, detailText: text };
}

export function buildProgramUpdateDetail(
  before: Program,
  after: Program,
  roomsCountBefore: number,
  roomsCountAfter: number
): { summary: string; detailText: string } {
  const summary = `Modification programme « ${after.name} » (id=${after.id})`;
  let text = '=== MODIFICATION PROGRAMME (champs + configuration chambres via même enregistrement) ===\n';
  text += `Origine: API PUT /api/programs/:id\n`;
  text += `Stock chambres (lignes Room) — avant: ${roomsCountBefore} | après: ${roomsCountAfter}\n\n`;
  text += '--- AVANT ---\n';
  text += buildProgramDeletionDetail(before).detailText;
  text += '\n--- APRÈS ---\n';
  text += buildProgramDeletionDetail(after).detailText;
  text +=
    '\n(Les chambres peuvent avoir été recréées, prix mis à jour ou lignes libres supprimées selon la config hôtels.)\n';
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
  text += `ID: ${fc.id}\n`;
  text += `Libellé: ${fc.label}\n`;
  text += `Montant: ${fc.amount} DH\n`;
  text += `Catégorie: ${fc.category}\n`;
  text += `Active: ${fc.isActive}\n`;
  text += `Agent lié: ${fc.agent ? `${fc.agent.nom} (id=${fc.agent.id}, ${fc.agent.email ?? ''})` : '—'}\n`;
  text += `Créée: ${fc.createdAt.toISOString()} | MAJ: ${fc.updatedAt.toISOString()}\n`;
  return { summary, detailText: text };
}

export function buildAgentDeactivationDetail(
  target: Agent,
  actorLabel: string
): { summary: string; detailText: string } {
  const summary = `Désactivation agent « ${target.nom} » (id=${target.id})`;
  let text = '=== DÉSACTIVATION AGENT ===\n';
  text += `Agent concerné — ID: ${target.id}\n`;
  text += `Nom: ${target.nom}\n`;
  text += `Email: ${target.email ?? '—'}\n`;
  text += `Rôle: ${target.role}\n`;
  text += `État avant action (actif): ${target.isActive}\n`;
  text += `Action réalisée par (session): ${actorLabel}\n`;
  text += `Compte rendu: isActive passé à false (soft delete).\n`;
  return { summary, detailText: text };
}
