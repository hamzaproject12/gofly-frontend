import { Router, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { authenticateToken } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

type AuthUser = { agentId?: number; role?: string };

/** Aligné sur la page Gestion des Réservations (app/reservations/page.tsx) */
const DAYS_URGENCY_WINDOW = 18;

type LeaderForUrgency = {
  status: string;
  statutPasseport: boolean;
  statutVisa: boolean;
  statutHotel: boolean;
  statutVol: boolean;
  program: {
    passportDeadline: Date | null;
    visaDeadline: Date | null;
    hotelDeadline: Date | null;
    flightDeadline: Date | null;
  } | null;
  accompagnants?: {
    statutPasseport: boolean;
    statutVisa: boolean;
    statutHotel: boolean;
    statutVol: boolean;
  }[];
};

function isLeaderUrgentForExport(leader: LeaderForUrgency): boolean {
  if (leader.status === 'Complet') return false;
  const members = [leader, ...(leader.accompagnants || [])];
  const passportGroupOk = members.every((m) => Boolean(m.statutPasseport));
  const visaGroupOk = members.every((m) => Boolean(m.statutVisa));
  const hotelGroupOk = members.every((m) => Boolean(m.statutHotel));
  const flightGroupOk = members.every((m) => Boolean(m.statutVol));
  const prog = leader.program;
  if (!prog) return false;
  const now = new Date();

  /** Urgent si le groupe n’a pas validé l’étape ET l’échéance est dans la fenêtre (comme le front). */
  const deadlineUrgent = (groupOk: boolean, deadline: Date | null | undefined): boolean => {
    if (groupOk || !deadline) return false;
    const diff = (new Date(deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= DAYS_URGENCY_WINDOW;
  };

  if (deadlineUrgent(passportGroupOk, prog.passportDeadline)) return true;
  if (deadlineUrgent(visaGroupOk, prog.visaDeadline)) return true;
  if (deadlineUrgent(hotelGroupOk, prog.hotelDeadline)) return true;
  if (deadlineUrgent(flightGroupOk, prog.flightDeadline)) return true;
  return false;
}

/** Date locale YYYY-MM-DD → début de journée */
function parseDateStartLocal(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d, 0, 0, 0, 0);
}

/** Date locale YYYY-MM-DD → fin de journée (inclusif) */
function parseDateEndInclusiveLocal(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d, 23, 59, 59, 999);
}

function applyRoomTypeQuery(where: Record<string, unknown>, roomType: unknown) {
  const rt = typeof roomType === 'string' ? roomType : '';
  if (!rt || rt === 'toutes') return;
  if (rt === 'FAMILLE' || rt === 'CHAMBRE_PRIVEE') {
    (where as { typeReservation: string }).typeReservation = 'CHAMBRE_PRIVEE';
  } else {
    (where as { roomType: string }).roomType = rt;
  }
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\[\]\*\?\/\\:]/g, ' ').trim().slice(0, 31);
  return cleaned || 'Programme';
}

function roomLabel(roomType: string, typeReservation: string): string {
  if (typeReservation === 'CHAMBRE_PRIVEE') return 'Chambre privée';
  const m: Record<string, string> = {
    SINGLE: '1 personne',
    DOUBLE: '2 personnes',
    TRIPLE: '3 personnes',
    QUAD: '4 personnes',
    QUINT: '5 personnes',
  };
  return m[roomType] || roomType;
}

function findDocUrl(
  docs: { fileType: string; cloudinaryUrl: string | null; filePath: string }[],
  ...matchers: ((t: string) => boolean)[]
): string {
  for (const d of docs || []) {
    const t = (d.fileType || '').toLowerCase();
    if (matchers.some((fn) => fn(t))) {
      return d.cloudinaryUrl || d.filePath || '';
    }
  }
  return '';
}

function passportUrl(
  docs: { fileType: string; cloudinaryUrl: string | null; filePath: string }[]
): string {
  return findDocUrl(
    docs,
    (t) => t.includes('pass') || t.includes('passeport'),
    (t) => t === 'passport'
  );
}

function cinUrl(
  docs: { fileType: string; cloudinaryUrl: string | null; filePath: string }[]
): string {
  return findDocUrl(docs, (t) => t.includes('cin') || t.includes('carte identite'));
}

type Pay = {
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  fichier: {
    cloudinaryUrl: string | null;
    filePath: string;
  } | null;
};

function paymentImages(payments: Pay[]) {
  const sorted = [...payments].sort(
    (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
  );
  let recu = '';
  let virement = '';
  for (const p of sorted) {
    const url = p.fichier?.cloudinaryUrl || p.fichier?.filePath || '';
    if (!url) continue;
    const method = (p.paymentMethod || '').toLowerCase();
    if (method.includes('virement')) {
      if (!virement) virement = url;
    } else {
      if (!recu) recu = url;
    }
  }
  return { recu, virement };
}

function avances(payments: Pay[]): [string, string, string] {
  const sorted = [...payments].sort(
    (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
  );
  const fmt = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '');
  return [
    sorted[0] ? fmt(sorted[0].amount) : '',
    sorted[1] ? fmt(sorted[1].amount) : '',
    sorted[2] ? fmt(sorted[2].amount) : '',
  ];
}

function transportLabel(t: string | null | undefined): string {
  if (t == null || t === '') return '';
  const s = String(t).toLowerCase();
  if (s === 'true' || s === 'oui' || s === 'yes') return 'Oui';
  if (s === 'false' || s === 'non' || s === 'no') return 'Non';
  return String(t);
}

const HEADERS = [
  'Nbr',
  'Groupe',
  'Nom et Prenom',
  'الاسم الكامل',
  'H/F',
  'N° passport',
  'Hotel Makkah',
  'Hotel medina',
  'Chambre',
  'Image passport',
  'Image CIN',
  'Téléphone',
  'visa',
  'BILLET',
  'Vente',
  'Avance 1',
  'Avance 2',
  'Avance 3',
  'Remis',
  'Reste',
  'Total des ventes',
  'Transport',
  'Remarque',
  'image recu',
  'image virement',
];

function buildExportWhere(
  query: Record<string, string | undefined>,
  user: AuthUser
): Prisma.ReservationWhereInput {
  const {
    program,
    programId,
    status,
    roomType,
    dateFrom,
    dateTo,
    search,
  } = query;

  const where: Prisma.ReservationWhereInput = {
    isLeader: true,
  };

  if (user.role !== 'ADMIN' && user.agentId != null) {
    where.agentId = user.agentId;
  }

  if (programId && programId !== 'tous') {
    const id = parseInt(programId, 10);
    if (!Number.isNaN(id)) where.programId = id;
  } else if (program && program !== 'tous') {
    where.program = { name: program };
  }

  /**
   * Statut affiché : « Urgent » et « Incomplet » sont affinés après requête (comme sur le front).
   * Ici on ne filtre en SQL que ce qui est stocké en base.
   */
  if (status && status !== 'all' && status !== 'Urgent' && status !== 'Incomplet') {
    where.status = status;
  } else if (status === 'Urgent') {
    where.status = { not: 'Complet' };
  } else if (status === 'Incomplet') {
    where.status = 'Incomplet';
  }

  applyRoomTypeQuery(where as Record<string, unknown>, roomType);

  if (dateFrom || dateTo) {
    where.reservationDate = {};
    if (dateFrom) {
      const start = parseDateStartLocal(String(dateFrom));
      where.reservationDate.gte = start ?? new Date(dateFrom as string);
    }
    if (dateTo) {
      const end = parseDateEndInclusiveLocal(String(dateTo));
      where.reservationDate.lte = end ?? new Date(dateTo as string);
    }
  }

  const searchTrim = typeof search === 'string' ? search.trim() : '';
  if (searchTrim) {
    where.OR = [
      { firstName: { contains: searchTrim, mode: 'insensitive' } },
      { lastName: { contains: searchTrim, mode: 'insensitive' } },
      { phone: { contains: searchTrim, mode: 'insensitive' } },
      { program: { name: { contains: searchTrim, mode: 'insensitive' } } },
    ];
  }

  return where;
}

/**
 * GET /api/export/reservations/agency
 * Query: program | programId, status, roomType, dateFrom, dateTo, search (same idea as liste réservations)
 */
router.get(
  '/reservations/agency',
  authenticateToken,
  async (req: any, res: Response) => {
    try {
      const user = req.user as AuthUser;
      const query = req.query as Record<string, string | undefined>;
      const where = buildExportWhere(query, user);
      const statusFilter = (query.status || 'all').trim();

      const leadersRaw = await prisma.reservation.findMany({
        where,
        include: {
          program: {
            select: {
              id: true,
              name: true,
              visaDeadline: true,
              hotelDeadline: true,
              flightDeadline: true,
              passportDeadline: true,
            },
          },
          documents: true,
          payments: {
            include: { fichier: true },
            orderBy: { paymentDate: 'asc' },
          },
          accompagnants: {
            include: {
              documents: true,
              payments: {
                include: { fichier: true },
                orderBy: { paymentDate: 'asc' },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
        orderBy: [{ programId: 'asc' }, { reservationDate: 'asc' }, { id: 'asc' }],
      });

      let leaders = leadersRaw;
      if (statusFilter === 'Urgent') {
        leaders = leadersRaw.filter((r) => isLeaderUrgentForExport(r as LeaderForUrgency));
      } else if (statusFilter === 'Incomplet') {
        leaders = leadersRaw.filter((r) => !isLeaderUrgentForExport(r as LeaderForUrgency));
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Omra Travel';
      workbook.created = new Date();

      const byProgram = new Map<
        number,
        typeof leaders
      >();
      for (const r of leaders) {
        const pid = r.programId;
        if (!byProgram.has(pid)) byProgram.set(pid, []);
        byProgram.get(pid)!.push(r);
      }

      if (byProgram.size === 0) {
        const sheet = workbook.addWorksheet('Vide');
        sheet.addRow(HEADERS);
        sheet.addRow(['Aucune réservation pour ces filtres']);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="export-agence-vide.xlsx"`
        );
        await workbook.xlsx.write(res);
        return;
      }

      const usedNames = new Set<string>();

      for (const [, rows] of byProgram) {
        const programName = rows[0]?.program?.name || 'Programme';
        let sheetName = sanitizeSheetName(programName);
        let n = 2;
        while (usedNames.has(sheetName)) {
          sheetName = sanitizeSheetName(`${programName.slice(0, 25)} (${n})`);
          n++;
        }
        usedNames.add(sheetName);

        const sheet = workbook.addWorksheet(sheetName);
        sheet.addRow(HEADERS);
        const headerRow = sheet.getRow(1);
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' },
        };
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

        let idx = 0;
        for (const leader of rows) {
          const groupe = leader.groupe || '';
          const chambre = roomLabel(leader.roomType, leader.typeReservation);
          const fin = {
            price: leader.price,
            paidAmount: leader.paidAmount,
            payments: leader.payments as Pay[],
          };

          const emitRow = (
            person: (typeof leader) & { documents?: typeof leader.documents },
            isLeader: boolean
          ) => {
            idx += 1;
            const docs = person.documents || [];
            const pays = (isLeader ? fin.payments : (person as any).payments || []) as Pay[];
            const [a1, a2, a3] = avances(pays);
            const { recu, virement } = paymentImages(pays);
            const remis = isLeader ? fin.paidAmount : (person as any).paidAmount ?? 0;
            const vente = isLeader ? fin.price : (person as any).price ?? 0;
            const reste = Math.max(0, Math.round((vente - remis) * 100) / 100);

            const nomComplet = `${person.firstName || ''} ${person.lastName || ''}`.trim();
            const hk = person.hotelMakkah || leader.hotelMakkah || '';
            const hm = person.hotelMadina || leader.hotelMadina || '';

            sheet.addRow([
              idx,
              groupe,
              nomComplet,
              '',
              person.gender || '',
              person.passportNumber || '',
              hk,
              hm,
              chambre,
              passportUrl(docs as any),
              cinUrl(docs as any),
              person.phone || '',
              person.statutVisa ? 'Oui' : 'Non',
              person.statutVol ? 'Oui' : 'Non',
              isLeader ? String(vente) : '',
              isLeader ? a1 : '',
              isLeader ? a2 : '',
              isLeader ? a3 : '',
              isLeader ? String(remis) : '',
              isLeader ? String(reste) : '',
              isLeader ? String(vente) : '',
              transportLabel(person.transport),
              person.remarque || '',
              isLeader ? recu : '',
              isLeader ? virement : '',
            ]);
          };

          emitRow(leader, true);
          for (const acc of leader.accompagnants || []) {
            emitRow(acc as any, false);
          }
        }

        sheet.columns.forEach((col) => {
          col.width = 18;
        });
      }

      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `export-agence-${stamp}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      await workbook.xlsx.write(res);
    } catch (error) {
      console.error('Export agency error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Erreur lors de l'export Excel",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
);

export default router;
