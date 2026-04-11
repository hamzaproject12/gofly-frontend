import { Router, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { authenticateToken } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

type AuthUser = { agentId?: number; role?: string };

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

  if (status && status !== 'all') {
    if (status !== 'Urgent') {
      where.status = status;
    } else {
      where.status = { not: 'Complet' };
    }
  }

  applyRoomTypeQuery(where as Record<string, unknown>, roomType);

  if (dateFrom || dateTo) {
    where.reservationDate = {};
    if (dateFrom) where.reservationDate.gte = new Date(dateFrom);
    if (dateTo) where.reservationDate.lte = new Date(dateTo);
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
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
      const where = buildExportWhere(req.query as Record<string, string | undefined>, user);

      const leaders = await prisma.reservation.findMany({
        where,
        include: {
          program: { select: { id: true, name: true } },
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
