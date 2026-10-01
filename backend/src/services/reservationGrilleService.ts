import { City, Prisma, PrismaClient, RoomType } from '@prisma/client';
import { ROOM_TYPE_LABEL_FR } from './programGrilleService';
import type { HotelAutreEntry } from './hotelsAutreService';

/**
 * Validation SERVEUR du prix d'une réservation en mode GRILLE.
 *
 * Le prix envoyé par le navigateur n'est jamais cru : il est recalculé depuis la
 * grille lue en base. Un client forgé qui réclamerait 5 000 DH sur une case à
 * 13 900 est refusé, et c'est bien la valeur de la base qui est enregistrée dans
 * `prixGrille`.
 *
 * Un programme en mode CALCUL traverse ce service sans rien changer : le prix
 * reçu est accepté tel quel, exactement comme avant la grille tarifaire.
 */

/** Refus de validation destiné à l'utilisateur, avec son code HTTP. */
export class ReservationGrilleError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ReservationGrilleError';
    this.statusCode = statusCode;
  }
}

/** Message imposé quand une « proposition » descend sous le prix de la grille. */
export const MESSAGE_PROPOSITION_SOUS_GRILLE =
  'Pour un prix inférieur à la grille, utilisez une réduction';

/** Champs à écrire sur la réservation, une fois la validation passée. */
export interface TraceGrille {
  /** Formule vendue, null en mode CALCUL ou hors grille. */
  formuleId: number | null;
  /** Libellé figé de la formule vendue. */
  formuleLabel: string | null;
  /** Prix de brochure PAR PERSONNE, lu en base — jamais celui du client. */
  prixGrille: number | null;
  horsGrille: boolean;
  /** Prix à persister, recalculé côté serveur. */
  price: number;
  /** Réduction retenue (bornée). */
  reduction: number;
}

/** Hôtels désignés par la réservation, tels que le client les envoie. */
export interface HotelsReservation {
  /** Nom ou identifiant de l'hôtel à Madina (les deux conventions existent en base). */
  hotelMadina?: string | null;
  hotelMakkah?: string | null;
  hotelsAutre?: HotelAutreEntry[];
}

type ClientPrisma = PrismaClient | Prisma.TransactionClient;

/** Normalise un nom d'hôtel pour comparaison (casse et espaces indifférents). */
function normNom(valeur: string): string {
  return valeur.trim().toLocaleLowerCase('fr');
}

/**
 * Un hôtel de la formule correspond-il à la valeur envoyée par le client ?
 * Les colonnes `hotelMadina` / `hotelMakkah` contiennent historiquement soit le
 * NOM de l'hôtel (ce que postent les formulaires actuels), soit son identifiant
 * sous forme de chaîne — les deux sont donc acceptés.
 */
function correspondHotel(
  valeurClient: string,
  hotel: { id: number; name: string }
): boolean {
  const brut = valeurClient.trim();
  if (brut === '') return false;
  if (brut === String(hotel.id)) return true;
  return normNom(brut) === normNom(hotel.name);
}

/**
 * Vérifie que les hôtels retenus appartiennent bien à la formule vendue.
 *
 * Pour Madina et Makkah, dès que la formule propose des hôtels dans la ville, la
 * réservation doit en désigner un : c'est le sens même d'une formule, le pèlerin
 * ne choisit pas un hôtel hors brochure. Les hôtels « Autre » sont une étape
 * facultative — leur absence est tolérée, mais un hôtel étranger à la formule
 * est refusé.
 */
function verifierHotelsDeLaFormule(
  hotels: HotelsReservation,
  hotelsFormule: Array<{ id: number; name: string; city: City }>
): void {
  const parVille = (ville: City) => hotelsFormule.filter((h) => h.city === ville);

  const controlerVille = (ville: 'Madina' | 'Makkah', valeur: string | null | undefined) => {
    const autorises = parVille(ville as City);
    if (autorises.length === 0) return;
    const brut = String(valeur ?? '').trim();
    if (brut === '' || brut === 'none') {
      throw new ReservationGrilleError(
        `La formule impose un hôtel à ${ville} : sélectionnez-en un parmi ${autorises
          .map((h) => h.name)
          .join(' ou ')}.`
      );
    }
    if (!autorises.some((h) => correspondHotel(brut, h))) {
      throw new ReservationGrilleError(
        `L'hôtel retenu à ${ville} n'appartient pas à la formule vendue (attendu : ${autorises
          .map((h) => h.name)
          .join(' ou ')}).`
      );
    }
  };

  controlerVille('Madina', hotels.hotelMadina);
  controlerVille('Makkah', hotels.hotelMakkah);

  const autresAutorises = parVille('Autre' as City);
  for (const entree of hotels.hotelsAutre ?? []) {
    if (!autresAutorises.some((h) => h.id === entree.hotelId)) {
      throw new ReservationGrilleError(
        `L'hôtel « ${entree.hotelName ?? entree.hotelId} » n'appartient pas à la formule vendue.`
      );
    }
  }
}

/**
 * Valide le prix d'une réservation et renvoie les champs à persister.
 *
 * @param occupants nombre de pèlerins couverts par le prix : 1 pour une
 *        réservation à la place (LIT), la taille du groupe pour une chambre
 *        privée dont le prix est concentré sur le chef de dossier.
 */
export async function validerReservationGrille(
  db: ClientPrisma,
  params: {
    programId: number;
    roomType: RoomType;
    occupants: number;
    /** Prix demandé par le client, déjà normalisé (entier >= 0). */
    prixDemande: number;
    /** Réduction demandée par le client. */
    reductionDemandee: unknown;
    /** Formule choisie par le client. */
    formuleId: unknown;
    /** Le client demande une réservation hors grille. */
    horsGrilleDemande: unknown;
    hotels: HotelsReservation;
    /** L'appelant est-il au moins ADMIN (rôle relu en base) ? */
    appelantEstAdmin: boolean;
  }
): Promise<TraceGrille> {
  const reductionBrute = Number(params.reductionDemandee ?? 0);
  const reductionClient =
    Number.isFinite(reductionBrute) && reductionBrute > 0 ? Math.round(reductionBrute) : 0;

  const program = await db.program.findUnique({
    where: { id: params.programId },
    select: { id: true, name: true, pricingMode: true },
  });
  if (!program) {
    throw new ReservationGrilleError('Programme non trouvé', 404);
  }

  // ---- Mode CALCUL : comportement historique, strictement inchangé ----
  if (program.pricingMode !== 'GRILLE') {
    return {
      formuleId: null,
      formuleLabel: null,
      prixGrille: null,
      horsGrille: false,
      price: params.prixDemande,
      reduction: reductionClient,
    };
  }

  // ---- Hors grille : ADMIN uniquement, prix libre ----
  const horsGrille = params.horsGrilleDemande === true || params.horsGrilleDemande === 'true';
  if (horsGrille) {
    if (!params.appelantEstAdmin) {
      throw new ReservationGrilleError(
        "Seul un administrateur peut enregistrer une réservation hors grille.",
        403
      );
    }
    return {
      formuleId: null,
      formuleLabel: null,
      prixGrille: null,
      horsGrille: true,
      price: params.prixDemande,
      reduction: reductionClient,
    };
  }

  // ---- Vente sur grille ----
  const formuleIdNum = Number(params.formuleId);
  if (!Number.isInteger(formuleIdNum) || formuleIdNum <= 0) {
    throw new ReservationGrilleError(
      "Ce programme est tarifé par grille : choisissez une formule et un type de chambre."
    );
  }

  const formule = await db.programFormule.findFirst({
    where: { id: formuleIdNum, programId: params.programId },
    include: { hotels: { include: { hotel: true } }, prix: true },
  });
  if (!formule) {
    throw new ReservationGrilleError(
      "La formule choisie n'appartient pas à ce programme."
    );
  }

  const cellule = formule.prix.find((p) => p.roomType === params.roomType);
  if (!cellule) {
    throw new ReservationGrilleError(
      `La formule « ${formule.label} » ne propose pas de chambre ${
        ROOM_TYPE_LABEL_FR[params.roomType]
      }.`
    );
  }

  verifierHotelsDeLaFormule(
    params.hotels,
    formule.hotels.map((fh) => ({
      id: fh.hotel.id,
      name: fh.hotel.name,
      city: fh.hotel.city,
    }))
  );

  const occupants = Number.isInteger(params.occupants) && params.occupants > 0
    ? params.occupants
    : 1;
  const prixGrille = cellule.prixVente;
  const total = prixGrille * occupants;

  if (reductionClient > total) {
    throw new ReservationGrilleError(
      `La réduction (${reductionClient} DH) dépasse le prix de la grille (${total} DH).`
    );
  }

  const attendu = total - reductionClient;

  // Prix conforme à la grille, réduction comprise (0 DH est un prix valide :
  // une réduction égale au total est acceptée, cas de l'accompagnateur offert).
  if (params.prixDemande === attendu) {
    return {
      formuleId: formule.id,
      formuleLabel: formule.label,
      prixGrille,
      horsGrille: false,
      price: attendu,
      reduction: reductionClient,
    };
  }

  // « Proposition » : un prix AU-DESSUS du total de la grille, sans réduction.
  if (reductionClient === 0 && params.prixDemande > total) {
    return {
      formuleId: formule.id,
      formuleLabel: formule.label,
      prixGrille,
      horsGrille: false,
      price: params.prixDemande,
      reduction: 0,
    };
  }

  if (reductionClient === 0 && params.prixDemande < total) {
    throw new ReservationGrilleError(MESSAGE_PROPOSITION_SOUS_GRILLE);
  }

  throw new ReservationGrilleError(
    `Prix incohérent avec la grille : attendu ${attendu} DH (${prixGrille} DH × ${occupants} occupant(s)` +
      `${reductionClient > 0 ? ` − ${reductionClient} DH de réduction` : ''}), reçu ${params.prixDemande} DH.`
  );
}

/** Détail de journal d'une vente qui s'écarte du prix de la grille. */
export function buildEcartGrilleDetail(params: {
  programName: string;
  trace: TraceGrille;
  occupants: number;
  nomDossier: string;
}): { summary: string; detailText: string } | null {
  const { trace, occupants } = params;

  if (trace.horsGrille) {
    return {
      summary: `Réservation HORS GRILLE — ${params.nomDossier} (${params.programName})`,
      detailText:
        'RÉSERVATION HORS GRILLE TARIFAIRE\n\n' +
        `Programme : ${params.programName}\n` +
        `Dossier : ${params.nomDossier}\n` +
        `Occupants couverts : ${occupants}\n` +
        `Prix saisi manuellement : ${trace.price} DH\n` +
        'Hôtels et prix choisis librement par un administrateur, hors de toute formule.\n',
    };
  }

  if (trace.prixGrille === null) return null;

  const total = trace.prixGrille * occupants;
  const ecart = trace.price - total;
  if (ecart === 0 && trace.reduction === 0) return null;

  const nature = trace.reduction > 0 ? 'RÉDUCTION' : 'PROPOSITION';
  return {
    summary: `Réservation avec ${nature.toLowerCase()} — ${params.nomDossier} (${params.programName})`,
    detailText:
      `RÉSERVATION AVEC ${nature} SUR LA GRILLE\n\n` +
      `Programme : ${params.programName}\n` +
      `Dossier : ${params.nomDossier}\n` +
      `Formule vendue : ${trace.formuleLabel ?? '—'}\n` +
      `Prix grille : ${trace.prixGrille} DH / personne × ${occupants} occupant(s) = ${total} DH\n` +
      (trace.reduction > 0 ? `Réduction appliquée : ${trace.reduction} DH\n` : '') +
      (trace.reduction === 0 && ecart > 0 ? `Supplément proposé : +${ecart} DH\n` : '') +
      `Montant enregistré : ${trace.price} DH\n`,
  };
}
