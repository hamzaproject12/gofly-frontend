import { Router, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { authenticateToken } from '../middleware/auth';
import { parseHotelsAutre } from '../services/hotelsAutreService';
import { buildFileDownloadUrl, publicApiBaseUrl } from '../services/fileDownloadLink';

const prisma = new PrismaClient();
const router = Router();


/** Aligné sur la page Gestion des Réservations (app/reservations/page.tsx) */
const DAYS_URGENCY_WINDOW = 7;

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

type DocRef = { id: number; fileType: string };

function findDocId(
  docs: DocRef[],
  ...matchers: ((t: string) => boolean)[]
): number | null {
  for (const d of docs || []) {
    const t = (d.fileType || '').toLowerCase();
    if (matchers.some((fn) => fn(t))) {
      return d.id;
    }
  }
  return null;
}

function passportDocId(docs: DocRef[]): number | null {
  return findDocId(
    docs,
    (t) => t.includes('pass') || t.includes('passeport'),
    (t) => t === 'passport'
  );
}

function cinDocId(docs: DocRef[]): number | null {
  return findDocId(docs, (t) => t.includes('cin') || t.includes('carte identite'));
}

type Pay = {
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  fichier: {
    id: number;
  } | null;
};

function paymentDocIds(payments: Pay[]) {
  const sorted = [...payments].sort(
    (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
  );
  let recu: number | null = null;
  let virement: number | null = null;
  for (const p of sorted) {
    const id = p.fichier?.id;
    if (!id) continue;
    const method = (p.paymentMethod || '').toLowerCase();
    if (method.includes('virement')) {
      if (!virement) virement = id;
    } else {
      if (!recu) recu = id;
    }
  }
  return { recu, virement };
}

/**
 * Cellule Excel cliquable pointant vers /api/files/:id/download.
 * On ne met plus l'URL Cloudinary brute : les PDF y sont stockés en `raw`
 * sans extension, le fichier téléchargé arrivait donc sans extension et ne
 * s'ouvrait pas. Le backend renvoie le bon Content-Type et un nom lisible.
 */
function docCell(baseUrl: string, id: number | null, label: string): string | ExcelJS.CellHyperlinkValue {
  if (!id) return '';
  return {
    text: label,
    hyperlink: buildFileDownloadUrl(baseUrl, id),
  };
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
  'Autres hôtels',
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

/** Index (1-based) des colonnes contenant un lien de document. */
const DOC_LINK_COLUMNS = [
  HEADERS.indexOf('Image passport') + 1,
  HEADERS.indexOf('Image CIN') + 1,
  HEADERS.indexOf('image recu') + 1,
  HEADERS.indexOf('image virement') + 1,
];

/** Index (1-based) de la colonne « Chambre ». */
const ROOM_COLUMN = HEADERS.indexOf('Chambre') + 1;

/**
 * Codes couleur de l'export.
 * - Chambre privée : une couleur par chambre, pour voir d'un coup d'œil
 *   quelles personnes occupent la même chambre.
 * - Lit en chambre partagée (réservation normale) : alternance blanc / gris,
 *   volontairement neutre pour rester distinguable des chambres privées.
 */
const PRIVATE_ROOM_FILLS = [
  'FFFDE9D9',
  'FFE2EFDA',
  'FFFFF2CC',
  'FFE4DFEC',
  'FFFCE4EC',
  'FFDAEEF3',
  'FFEAF1DD',
  'FFFFE0B2',
  'FFD9E1F2',
  'FFF8CBAD',
];
const SHARED_BED_FILLS = ['FFFFFFFF', 'FFF2F2F2'];
const GROUP_BORDER_COLOR = { argb: 'FFA6A6A6' };

function paintRow(row: ExcelJS.Row, argb: string, columns: number): void {
  for (let c = 1; c <= columns; c += 1) {
    row.getCell(c).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb },
    };
  }
}

/** Encadre les lignes d'une même réservation pour matérialiser le regroupement. */
function outlineGroup(
  sheet: ExcelJS.Worksheet,
  firstRow: number,
  lastRow: number,
  columns: number
): void {
  for (let r = firstRow; r <= lastRow; r += 1) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= columns; c += 1) {
      const border: Partial<ExcelJS.Borders> = {};
      if (r === firstRow) border.top = { style: 'thin', color: GROUP_BORDER_COLOR };
      if (r === lastRow) border.bottom = { style: 'thin', color: GROUP_BORDER_COLOR };
      if (c === 1) border.left = { style: 'thin', color: GROUP_BORDER_COLOR };
      if (c === columns) border.right = { style: 'thin', color: GROUP_BORDER_COLOR };
      row.getCell(c).border = border;
    }
  }
}

/** Feuille d'explication des couleurs, placée en tête du classeur. */
function addLegendSheet(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet('Légende');
  sheet.getColumn(1).width = 16;
  sheet.getColumn(2).width = 90;

  const title = sheet.addRow(['Légende des couleurs']);
  title.font = { bold: true, size: 14 };
  sheet.addRow([]);

  const header = sheet.addRow(['Couleur', 'Signification']);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  paintRow(header, 'FF4472C4', 2);

  const entries: { fill: string; text: string }[] = [
    {
      fill: PRIVATE_ROOM_FILLS[0],
      text: 'Chambre privée : toutes les lignes de cette couleur occupent la MÊME chambre.',
    },
    {
      fill: PRIVATE_ROOM_FILLS[1],
      text: 'Chambre privée suivante : la couleur change à chaque chambre privée.',
    },
    {
      fill: PRIVATE_ROOM_FILLS[2],
      text: 'Chambre privée suivante (les couleurs tournent sur 10 teintes).',
    },
    {
      fill: SHARED_BED_FILLS[0],
      text: 'Réservation normale (lit en chambre partagée) : fond blanc, aucune chambre réservée en propre.',
    },
    {
      fill: SHARED_BED_FILLS[1],
      text: 'Réservation normale suivante : alternance blanc / gris pour séparer deux réservations.',
    },
  ];

  for (const entry of entries) {
    const row = sheet.addRow(['', entry.text]);
    paintRow(row, entry.fill, 1);
    row.getCell(1).border = {
      top: { style: 'thin', color: GROUP_BORDER_COLOR },
      bottom: { style: 'thin', color: GROUP_BORDER_COLOR },
      left: { style: 'thin', color: GROUP_BORDER_COLOR },
      right: { style: 'thin', color: GROUP_BORDER_COLOR },
    };
    row.getCell(2).alignment = { vertical: 'middle', wrapText: true };
  }

  sheet.addRow([]);
  const note = sheet.addRow([
    '',
    'Un encadré fin regroupe les personnes d’une même réservation (titulaire + accompagnants). '
      + 'La colonne « Chambre » indique le type : « Chambre privée » ou le nombre de lits de la chambre partagée.',
  ]);
  note.getCell(2).alignment = { vertical: 'middle', wrapText: true };
  note.getCell(2).font = { italic: true };
}

function buildExportWhere(
  query: Record<string, string | undefined>
): Prisma.ReservationWhereInput {
  const { program, programId } = query;

  const where: Prisma.ReservationWhereInput = {
    isLeader: true,
  };

  if (programId && programId !== 'tous') {
    const id = parseInt(programId, 10);
    if (!Number.isNaN(id)) where.programId = id;
  } else if (program && program !== 'tous') {
    where.program = { name: program };
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
      const query = req.query as Record<string, string | undefined>;
      const where = buildExportWhere(query);
      const apiBaseUrl = publicApiBaseUrl(req);

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

      const leaders = leadersRaw;

      // Resolve hotel IDs → names (Madina/Makkah + hôtels Autre snapshotés en JSON)
      const hotelIdSet = new Set<number>();
      const collectAutreIds = (json: unknown) => {
        for (const e of parseHotelsAutre(json)) hotelIdSet.add(e.hotelId);
      };
      for (const r of leaders) {
        if (r.hotelMadina) { const n = parseInt(r.hotelMadina, 10); if (!isNaN(n)) hotelIdSet.add(n); }
        if (r.hotelMakkah) { const n = parseInt(r.hotelMakkah, 10); if (!isNaN(n)) hotelIdSet.add(n); }
        collectAutreIds(r.hotelsAutre);
        for (const acc of r.accompagnants || []) {
          if (acc.hotelMadina) { const n = parseInt(acc.hotelMadina, 10); if (!isNaN(n)) hotelIdSet.add(n); }
          if (acc.hotelMakkah) { const n = parseInt(acc.hotelMakkah, 10); if (!isNaN(n)) hotelIdSet.add(n); }
          collectAutreIds(acc.hotelsAutre);
        }
      }
      const hotelRows = hotelIdSet.size > 0
        ? await prisma.hotel.findMany({ where: { id: { in: [...hotelIdSet] } } })
        : [];
      const hotelMap = new Map<string, string>(hotelRows.map((h) => [String(h.id), h.name]));
      const resolveHotel = (id: string | null | undefined): string => {
        if (!id) return '';
        return hotelMap.get(id) || id;
      };
      // Liste des hôtels Autre d'une personne, en noms (snapshot, sinon résolu par id)
      const autreHotelsLabel = (json: unknown): string =>
        parseHotelsAutre(json)
          .map((e) => e.hotelName || hotelMap.get(String(e.hotelId)) || '')
          .filter(Boolean)
          .join(', ');

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

      // Feuille d'explication des couleurs, en tête du classeur.
      addLegendSheet(workbook);

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
        // Compteurs de rotation des couleurs : indépendants pour les chambres
        // privées et pour les lits partagés.
        let privateRoomColorIdx = 0;
        let sharedBedColorIdx = 0;
        for (const leader of rows) {
          const groupe = leader.groupe || '';
          const chambre = roomLabel(leader.roomType, leader.typeReservation);
          const fin = {
            price: leader.price,
            paidAmount: leader.paidAmount,
            payments: leader.payments as Pay[],
          };
          const totalVentesGroupe =
            leader.price +
            (leader.accompagnants || []).reduce((sum, acc: any) => sum + (acc.price ?? 0), 0);

          const emitRow = (
            person: (typeof leader) & { documents?: typeof leader.documents },
            isLeader: boolean
          ): ExcelJS.Row => {
            idx += 1;
            const docs = person.documents || [];
            const pays = (isLeader ? fin.payments : (person as any).payments || []) as Pay[];
            const [a1, a2, a3] = avances(pays);
            const { recu, virement } = paymentDocIds(pays);
            const remis = isLeader ? fin.paidAmount : (person as any).paidAmount ?? 0;
            const vente = isLeader ? fin.price : (person as any).price ?? 0;
            const reste = Math.max(0, Math.round((vente - remis) * 100) / 100);

            const nomComplet = `${person.firstName || ''} ${person.lastName || ''}`.trim();
            const hk = resolveHotel(person.hotelMakkah) || resolveHotel(leader.hotelMakkah);
            const hm = resolveHotel(person.hotelMadina) || resolveHotel(leader.hotelMadina);
            const autres = autreHotelsLabel(person.hotelsAutre) || autreHotelsLabel(leader.hotelsAutre);

            const row = sheet.addRow([
              idx,
              groupe,
              nomComplet,
              '',
              person.gender || '',
              person.passportNumber || '',
              hk,
              hm,
              autres,
              chambre,
              docCell(apiBaseUrl, passportDocId(docs as any), 'Passeport'),
              docCell(apiBaseUrl, cinDocId(docs as any), 'CIN'),
              person.phone || '',
              person.statutVisa ? 'Oui' : 'Non',
              person.statutVol ? 'Oui' : 'Non',
              isLeader ? String(vente) : '',
              isLeader ? a1 : '',
              isLeader ? a2 : '',
              isLeader ? a3 : '',
              isLeader ? String(remis) : '',
              isLeader ? String(reste) : '',
              isLeader ? String(totalVentesGroupe) : '',
              transportLabel(person.transport),
              person.remarque || '',
              isLeader ? docCell(apiBaseUrl, recu, 'Reçu') : '',
              isLeader ? docCell(apiBaseUrl, virement, 'Virement') : '',
            ]);

            // Colonnes documents : style lien pour qu'elles soient reconnaissables
            for (const col of DOC_LINK_COLUMNS) {
              const cell = row.getCell(col);
              if (cell.value && typeof cell.value === 'object' && 'hyperlink' in cell.value) {
                cell.font = { color: { argb: 'FF0563C1' }, underline: true };
              }
            }

            return row;
          };

          const groupRows: ExcelJS.Row[] = [emitRow(leader, true)];
          for (const acc of leader.accompagnants || []) {
            groupRows.push(emitRow(acc as any, false));
          }

          // Couleur du groupe : une teinte par chambre privée (toutes les
          // personnes d'une même chambre partagent la couleur), alternance
          // neutre blanc/gris pour les réservations normales (lit partagé).
          const isPrivateRoom = leader.typeReservation === 'CHAMBRE_PRIVEE';
          const fillColor = isPrivateRoom
            ? PRIVATE_ROOM_FILLS[privateRoomColorIdx++ % PRIVATE_ROOM_FILLS.length]
            : SHARED_BED_FILLS[sharedBedColorIdx++ % SHARED_BED_FILLS.length];

          for (const groupRow of groupRows) {
            paintRow(groupRow, fillColor, HEADERS.length);
            if (isPrivateRoom) {
              groupRow.getCell(ROOM_COLUMN).font = { bold: true };
            }
          }
          outlineGroup(
            sheet,
            groupRows[0].number,
            groupRows[groupRows.length - 1].number,
            HEADERS.length
          );
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
