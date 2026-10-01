import { City, PrismaClient, RoomType } from '@prisma/client';

/**
 * Grille tarifaire d'un programme — le prix de la BROCHURE publiée.
 *
 * Une grille est un tableau `formules × types de chambre` :
 *   - une LIGNE (ProgramFormule) = une combinaison d'hôtels vendue sous un libellé,
 *     avec la liste des hôtels AUTORISÉS (une ville peut offrir un choix entre
 *     plusieurs hôtels : « Emaar Grand OU Diyafat Al Rajaa ») ;
 *   - une CASE (ProgramFormulePrix) = le prix de vente par personne, en dirhams
 *     entiers. Une case « — » (non proposée) est l'ABSENCE de ligne, jamais un
 *     prix à 0 : 0 DH reste un prix valide et ne peut pas signifier « pas de prix ».
 *
 * Ce service ne connaît RIEN des plans Économique / Normal / VIP : en mode GRILLE
 * le prix vient de la brochure, pas d'un plan.
 */

/** Capacité (nombre de personnes) d'un type de chambre. */
export const ROOM_TYPE_CAPACITY: Record<RoomType, number> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  QUAD: 4,
  QUINT: 5,
};

/** Libellé français d'un type de chambre, tel qu'affiché dans les brochures. */
export const ROOM_TYPE_LABEL_FR: Record<RoomType, string> = {
  SINGLE: 'Simple',
  DOUBLE: 'Double',
  TRIPLE: 'Triple',
  QUAD: 'Quadruple',
  QUINT: 'Quintuple',
};

const ROOM_TYPES: RoomType[] = ['SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD', 'QUINT'];

/** Include Prisma commun à toutes les lectures de grille. */
export const PROGRAM_FORMULES_QUERY = {
  include: {
    hotels: { include: { hotel: true } },
    prix: true,
  },
  orderBy: [{ ordre: 'asc' as const }, { id: 'asc' as const }],
};

/** Une case de la grille telle qu'exposée par l'API. */
export interface GrillePrixDTO {
  roomType: RoomType;
  prixVente: number;
}

/** Une formule telle qu'exposée par l'API. */
export interface GrilleFormuleDTO {
  id: number;
  label: string;
  note: string | null;
  ordre: number;
  hotels: Array<{ id: number; name: string; city: City }>;
  prix: GrillePrixDTO[];
}

/** Formule reçue du client lors d'une écriture de grille. */
export interface GrilleFormuleInput {
  label: string;
  note: string | null;
  ordre: number;
  hotelIds: number[];
  prix: GrillePrixDTO[];
}

/**
 * Hôtels d'un programme, indexés des deux façons dont les clients les désignent :
 * par identifiant (page d'édition, qui lit la grille existante) et par nom + ville
 * (page de création, où les hôtels sont saisis au nom et n'ont pas encore d'id
 * côté navigateur).
 */
export interface ProgrammeHotelsIndex {
  ids: Set<number>;
  parNom: Map<string, number>;
}

/** Clé d'indexation d'un hôtel par ville + nom, insensible à la casse et aux espaces. */
function cleHotel(city: string, name: string): string {
  return `${city}|${name.trim().toLocaleLowerCase('fr')}`;
}

/** Ligne de formule lue en base (avec ses hôtels et ses prix). */
export type FormuleRow = {
  id: number;
  label: string;
  note: string | null;
  ordre: number;
  hotels: Array<{ hotel: { id: number; name: string; city: City } }>;
  prix: Array<{ roomType: RoomType; prixVente: number }>;
};

/** Saisie de grille refusée : le message est destiné à l'utilisateur (français). */
export class GrilleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GrilleValidationError';
  }
}

/** Tri des cases par capacité croissante, pour un affichage stable. */
function sortPrix(prix: GrillePrixDTO[]): GrillePrixDTO[] {
  return [...prix].sort(
    (a, b) => ROOM_TYPE_CAPACITY[a.roomType] - ROOM_TYPE_CAPACITY[b.roomType]
  );
}

/** Formules de la base → forme exposée par l'API. */
export function serializeFormules(rows: FormuleRow[]): GrilleFormuleDTO[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    note: row.note,
    ordre: row.ordre,
    hotels: row.hotels
      .map((fh) => ({ id: fh.hotel.id, name: fh.hotel.name, city: fh.hotel.city }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    prix: sortPrix(row.prix.map((p) => ({ roomType: p.roomType, prixVente: p.prixVente }))),
  }));
}

/**
 * Programme lu avec `PROGRAM_FORMULES_QUERY` → programme dont la grille est à la
 * forme EXPOSÉE par l'API.
 *
 * Prisma imbrique l'hôtel d'une formule dans sa table de jointure
 * (`hotels: [{ hotelId, hotel: { id, name, city } }]`), alors que les clients
 * attendent la forme PLATE (`hotels: [{ id, name, city }]`) — celle que
 * renvoient déjà `PUT /:id/grille` et `PUT /:id/pricing-mode`. Toute route qui
 * expose un programme avec sa grille passe donc par ici : sans cela
 * `formule.hotels[].city` et `.name` valent `undefined` côté navigateur, le
 * formulaire d'édition échoue à recharger la grille et les hôtels imposés d'une
 * formule sont introuvables dans les formulaires de réservation.
 */
export function serializeProgrammeGrille<T extends { formules?: FormuleRow[] | null }>(
  programme: T
) {
  const { formules, ...reste } = programme;
  return { ...reste, formules: serializeFormules(formules ?? []) };
}

/** Vrai si au moins une formule porte au moins un prix — condition de la bascule en GRILLE. */
export function grilleContientUnPrix(formules: Array<{ prix: unknown[] }>): boolean {
  return formules.some((f) => f.prix.length > 0);
}

/**
 * Prix d'appel de la grille (« À partir de X DH ») : la case la moins chère,
 * ou `null` si aucune case n'est renseignée.
 */
export function grillePrixMin(
  formules: Array<{ prix: Array<{ prixVente: number }> }>
): number | null {
  let min: number | null = null;
  for (const formule of formules) {
    for (const p of formule.prix) {
      if (min === null || p.prixVente < min) min = p.prixVente;
    }
  }
  return min;
}

/**
 * Valide et normalise la grille reçue du client.
 * Lève une `GrilleValidationError` (→ HTTP 400) au premier problème.
 *
 * @param hotels hôtels rattachés au programme (Madina + Makkah + Autre) : une
 *        formule ne peut autoriser qu'un hôtel du programme.
 */
export function parseGrilleInput(
  body: unknown,
  hotels: ProgrammeHotelsIndex
): GrilleFormuleInput[] {
  const raw = (body as { formules?: unknown })?.formules;
  if (raw === undefined || raw === null) {
    throw new GrilleValidationError('La grille tarifaire est absente de la requête.');
  }
  if (!Array.isArray(raw)) {
    throw new GrilleValidationError('La grille tarifaire doit être une liste de formules.');
  }

  const formules: GrilleFormuleInput[] = [];
  const labelsVus = new Set<string>();

  raw.forEach((item, index) => {
    const position = index + 1;
    if (!item || typeof item !== 'object') {
      throw new GrilleValidationError(`Formule ${position} : données illisibles.`);
    }
    const entry = item as Record<string, unknown>;

    const label = String(entry.label ?? '').trim();
    if (!label) {
      throw new GrilleValidationError(`Formule ${position} : le libellé est obligatoire.`);
    }
    if (label.length > 200) {
      throw new GrilleValidationError(
        `Formule ${position} : le libellé dépasse 200 caractères.`
      );
    }
    const labelNormalise = label.toLocaleLowerCase('fr');
    if (labelsVus.has(labelNormalise)) {
      throw new GrilleValidationError(`Deux formules portent le même libellé « ${label} ».`);
    }
    labelsVus.add(labelNormalise);

    const noteBrute = String(entry.note ?? '').trim();
    if (noteBrute.length > 300) {
      throw new GrilleValidationError(
        `Formule « ${label} » : la mention dépasse 300 caractères.`
      );
    }

    // Hôtels autorisés : uniquement des hôtels du programme, sans doublon.
    // Deux référencements acceptés — par identifiant, ou par nom + ville pour le
    // formulaire de création, où les hôtels viennent d'être saisis au nom.
    const hotelIds: number[] = [];
    const ajouter = (hotelId: number) => {
      if (!hotelIds.includes(hotelId)) hotelIds.push(hotelId);
    };

    for (const value of Array.isArray(entry.hotelIds) ? entry.hotelIds : []) {
      const hotelId = Number(value);
      if (!Number.isInteger(hotelId) || hotelId <= 0) {
        throw new GrilleValidationError(`Formule « ${label} » : hôtel invalide.`);
      }
      if (!hotels.ids.has(hotelId)) {
        throw new GrilleValidationError(
          `Formule « ${label} » : un des hôtels choisis n'appartient pas à ce programme.`
        );
      }
      ajouter(hotelId);
    }

    for (const value of Array.isArray(entry.hotels) ? entry.hotels : []) {
      if (!value || typeof value !== 'object') {
        throw new GrilleValidationError(`Formule « ${label} » : hôtel illisible.`);
      }
      const ref = value as Record<string, unknown>;
      const nom = String(ref.name ?? '').trim();
      const ville = String(ref.city ?? '').trim();
      if (!nom || !ville) {
        throw new GrilleValidationError(
          `Formule « ${label} » : un hôtel est cité sans nom ou sans ville.`
        );
      }
      const hotelId = hotels.parNom.get(cleHotel(ville, nom));
      if (hotelId === undefined) {
        throw new GrilleValidationError(
          `Formule « ${label} » : l'hôtel « ${nom} » (${ville}) n'appartient pas à ce programme.`
        );
      }
      ajouter(hotelId);
    }

    // Cases de la brochure : entiers >= 0. Une case vide n'est PAS transmise.
    const prixBruts = Array.isArray(entry.prix) ? entry.prix : [];
    const prix: GrillePrixDTO[] = [];
    const typesVus = new Set<RoomType>();
    for (const value of prixBruts) {
      if (!value || typeof value !== 'object') {
        throw new GrilleValidationError(`Formule « ${label} » : prix illisible.`);
      }
      const cellule = value as Record<string, unknown>;
      const roomType = String(cellule.roomType ?? '') as RoomType;
      if (!ROOM_TYPES.includes(roomType)) {
        throw new GrilleValidationError(
          `Formule « ${label} » : type de chambre inconnu (${String(cellule.roomType)}).`
        );
      }
      if (typesVus.has(roomType)) {
        throw new GrilleValidationError(
          `Formule « ${label} » : deux prix pour ${ROOM_TYPE_LABEL_FR[roomType]}.`
        );
      }
      typesVus.add(roomType);

      const prixVente = Number(cellule.prixVente);
      if (!Number.isFinite(prixVente) || prixVente < 0) {
        throw new GrilleValidationError(
          `Formule « ${label} » — ${ROOM_TYPE_LABEL_FR[roomType]} : le prix doit être un nombre positif ou nul.`
        );
      }
      if (!Number.isInteger(prixVente)) {
        throw new GrilleValidationError(
          `Formule « ${label} » — ${ROOM_TYPE_LABEL_FR[roomType]} : le prix doit être un montant entier en dirhams.`
        );
      }
      prix.push({ roomType, prixVente });
    }

    formules.push({
      label,
      note: noteBrute === '' ? null : noteBrute,
      // La POSITION dans la liste fait foi : c'est l'ordre affiché dans la brochure.
      // Un `ordre` transmis par le client est ignoré, pour ne jamais se retrouver
      // avec deux formules au même rang.
      ordre: index,
      hotelIds,
      prix: sortPrix(prix),
    });
  });

  return formules;
}

/** Hôtels rattachés à un programme, toutes villes confondues. */
export async function getProgrammeHotelsIndex(
  prisma: PrismaClient,
  programId: number
): Promise<ProgrammeHotelsIndex> {
  const select = { hotel: { select: { id: true, name: true, city: true } } };
  const [madina, makkah, autre] = await Promise.all([
    prisma.programHotelMadina.findMany({ where: { programId }, select }),
    prisma.programHotelMakkah.findMany({ where: { programId }, select }),
    prisma.programHotelAutre.findMany({ where: { programId }, select }),
  ]);
  const index: ProgrammeHotelsIndex = { ids: new Set(), parNom: new Map() };
  for (const row of [...madina, ...makkah, ...autre]) {
    index.ids.add(row.hotel.id);
    index.parNom.set(cleHotel(row.hotel.city, row.hotel.name), row.hotel.id);
  }
  return index;
}

/** Grille actuelle d'un programme, prête à être exposée ou comparée. */
export async function readProgramFormules(
  prisma: PrismaClient,
  programId: number
): Promise<GrilleFormuleDTO[]> {
  const rows = await prisma.programFormule.findMany({
    where: { programId },
    ...PROGRAM_FORMULES_QUERY,
  });
  return serializeFormules(rows as FormuleRow[]);
}

/**
 * Remplace INTÉGRALEMENT la grille d'un programme, dans UNE transaction :
 * l'ancienne grille n'est jamais à moitié effacée si une formule est refusée.
 *
 * Aucune réservation n'est touchée : les dossiers déjà enregistrés gardent leur
 * prix, leur réduction et leur plan.
 */
export async function replaceProgramFormules(
  prisma: PrismaClient,
  programId: number,
  formules: GrilleFormuleInput[]
): Promise<GrilleFormuleDTO[]> {
  const rows = await prisma.$transaction(async (tx) => {
    await tx.programFormule.deleteMany({ where: { programId } });
    for (const formule of formules) {
      await tx.programFormule.create({
        data: {
          programId,
          label: formule.label,
          note: formule.note,
          ordre: formule.ordre,
          hotels: { create: formule.hotelIds.map((hotelId) => ({ hotelId })) },
          prix: {
            create: formule.prix.map((p) => ({
              roomType: p.roomType,
              prixVente: p.prixVente,
            })),
          },
        },
      });
    }
    return tx.programFormule.findMany({ where: { programId }, ...PROGRAM_FORMULES_QUERY });
  });
  return serializeFormules(rows as FormuleRow[]);
}

/** Montant formaté pour le journal : « 12 900 DH » (espace fine insécable évitée). */
function dh(montant: number): string {
  return `${montant.toLocaleString('fr-FR').replace(/ | /g, ' ')} DH`;
}

/** Une case par formule et type, pour comparer deux versions de la grille. */
function casesParType(formule: GrilleFormuleDTO): Map<RoomType, number> {
  return new Map(formule.prix.map((p) => [p.roomType, p.prixVente]));
}

/** Rapproche deux versions d'une grille par libellé (les ids changent au remplacement). */
function cle(label: string): string {
  return label.trim().toLocaleLowerCase('fr');
}

/**
 * Détail de journal d'une modification de grille : formules ajoutées, supprimées,
 * et pour chaque case l'ANCIEN et le NOUVEAU prix.
 */
export function buildGrilleUpdateDetail(
  programName: string,
  before: GrilleFormuleDTO[],
  after: GrilleFormuleDTO[]
): { summary: string; detailText: string } {
  const summary = `Grille tarifaire — programme « ${programName} »`;
  let text = 'MODIFICATION DE LA GRILLE TARIFAIRE\n\n';
  text += `Programme : ${programName}\n`;
  text += `Formules : ${before.length} → ${after.length}\n\n`;

  const avant = new Map(before.map((f) => [cle(f.label), f]));
  const apres = new Map(after.map((f) => [cle(f.label), f]));
  const lignes: string[] = [];

  for (const formule of after) {
    const precedente = avant.get(cle(formule.label));
    const hotels = formule.hotels.map((h) => `${h.name} (${h.city})`).join(' / ') || 'aucun hôtel';
    if (!precedente) {
      const cases = formule.prix
        .map((p) => `${ROOM_TYPE_LABEL_FR[p.roomType]} ${dh(p.prixVente)}`)
        .join(' · ');
      lignes.push(
        `+ Formule ajoutée « ${formule.label} » — ${hotels}${cases ? ` — ${cases}` : ' — aucun prix'}`
      );
      continue;
    }

    const modifications: string[] = [];
    const casesAvant = casesParType(precedente);
    const casesApres = casesParType(formule);
    for (const roomType of ROOM_TYPES) {
      const ancien = casesAvant.get(roomType);
      const nouveau = casesApres.get(roomType);
      if (ancien === undefined && nouveau === undefined) continue;
      if (ancien === undefined) {
        modifications.push(`${ROOM_TYPE_LABEL_FR[roomType]} : non proposé → ${dh(nouveau!)}`);
      } else if (nouveau === undefined) {
        modifications.push(`${ROOM_TYPE_LABEL_FR[roomType]} : ${dh(ancien)} → non proposé`);
      } else if (ancien !== nouveau) {
        modifications.push(`${ROOM_TYPE_LABEL_FR[roomType]} : ${dh(ancien)} → ${dh(nouveau)}`);
      }
    }

    const hotelsAvant = precedente.hotels.map((h) => h.name).sort().join(' / ');
    const hotelsApres = formule.hotels.map((h) => h.name).sort().join(' / ');
    if (hotelsAvant !== hotelsApres) {
      modifications.push(`Hôtels : ${hotelsAvant || 'aucun'} → ${hotelsApres || 'aucun'}`);
    }
    if ((precedente.note ?? '') !== (formule.note ?? '')) {
      modifications.push(`Mention : ${precedente.note || '—'} → ${formule.note || '—'}`);
    }
    if (modifications.length > 0) {
      lignes.push(`~ Formule « ${formule.label} » — ${modifications.join(' | ')}`);
    }
  }

  for (const formule of before) {
    if (apres.has(cle(formule.label))) continue;
    const cases = formule.prix
      .map((p) => `${ROOM_TYPE_LABEL_FR[p.roomType]} ${dh(p.prixVente)}`)
      .join(' · ');
    lignes.push(
      `- Formule supprimée « ${formule.label} »${cases ? ` — ${cases}` : ''}`
    );
  }

  text += lignes.length > 0 ? `${lignes.join('\n')}\n` : 'Aucun changement détecté.\n';

  const minAvant = grillePrixMin(before);
  const minApres = grillePrixMin(after);
  if (minAvant !== minApres) {
    text += `\nPrix d'appel (« à partir de ») : ${
      minAvant === null ? '—' : dh(minAvant)
    } → ${minApres === null ? '—' : dh(minApres)}\n`;
  }
  text +=
    '\nLes réservations existantes ne sont pas modifiées : elles gardent leur prix et leur réduction.\n';

  return { summary, detailText: text };
}

/** Détail de journal d'une bascule CALCUL ↔ GRILLE. */
export function buildPricingModeChangeDetail(
  programName: string,
  before: 'CALCUL' | 'GRILLE',
  after: 'CALCUL' | 'GRILLE',
  formules: GrilleFormuleDTO[]
): { summary: string; detailText: string } {
  const libelle = (mode: 'CALCUL' | 'GRILLE') =>
    mode === 'GRILLE' ? 'grille tarifaire (brochure)' : 'calcul automatique';
  const summary = `Origine du prix — programme « ${programName} » : ${libelle(before)} → ${libelle(after)}`;
  let text = "CHANGEMENT DE L'ORIGINE DU PRIX DE VENTE\n\n";
  text += `Programme : ${programName}\n`;
  text += `Mode : ${before} → ${after}\n`;
  const min = grillePrixMin(formules);
  text += `Grille au moment de la bascule : ${formules.length} formule(s)${
    min === null ? ', aucun prix saisi' : `, à partir de ${dh(min)}`
  }\n`;
  for (const formule of formules) {
    const cases = formule.prix
      .map((p) => `${ROOM_TYPE_LABEL_FR[p.roomType]} ${dh(p.prixVente)}`)
      .join(' · ');
    text += `  • ${formule.label} — ${cases || 'aucun prix'}\n`;
  }
  text +=
    '\nLes réservations existantes ne sont pas modifiées : elles gardent leur prix et leur réduction.\n';
  return { summary, detailText: text };
}
