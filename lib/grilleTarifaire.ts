/**
 * Grille tarifaire d'un programme — le prix de la BROCHURE publiée.
 *
 * Forme réelle des brochures de l'agence : un tableau `formules × types de chambre`.
 *
 * | Formule (hôtels)                                    | Quintuple | Quadruple | Triple | Double |
 * |-----------------------------------------------------|-----------|-----------|--------|--------|
 * | Al Markaziya (Madina) + Abraj Al Kiswah (Makkah)    | 12 900    | 13 900    | 14 900 | 15 900 |
 * | Al Markaziya + Emaar Grand OU Diyafat Al Rajaa      |     —     | 18 900    | 19 900 | 21 900 |
 *
 * - une LIGNE = une formule : un libellé libre + les hôtels AUTORISÉS par ville
 *   (une ville peut offrir un choix entre plusieurs hôtels) ;
 * - une COLONNE = un type de chambre ;
 * - une case vide (« — ») = NON PROPOSÉ, jamais un prix à 0 (0 DH reste un prix
 *   valide : place offerte) ;
 * - prix PAR PERSONNE, en dirhams entiers.
 *
 * Aucune notion de plan Économique / Normal / VIP ici : en mode GRILLE le prix
 * vient de la brochure, pas d'un plan.
 */

export type RoomTypeKey = "SINGLE" | "DOUBLE" | "TRIPLE" | "QUAD" | "QUINT"

export type VilleHotel = "Madina" | "Makkah" | "Autre"

/** Capacité (nombre de personnes) d'un type de chambre. */
export const CAPACITE_TYPE: Record<RoomTypeKey, number> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  QUAD: 4,
  QUINT: 5,
}

/** Libellé français d'un type de chambre, tel qu'imprimé dans les brochures. */
export const LIBELLE_TYPE: Record<RoomTypeKey, string> = {
  SINGLE: "Simple",
  DOUBLE: "Double",
  TRIPLE: "Triple",
  QUAD: "Quadruple",
  QUINT: "Quintuple",
}

/**
 * Colonnes de la grille, dans l'ordre des brochures : de la chambre la plus
 * partagée (donc la moins chère) à la plus privative.
 */
export const COLONNES_GRILLE: RoomTypeKey[] = ["QUINT", "QUAD", "TRIPLE", "DOUBLE", "SINGLE"]

/** Villes pour lesquelles un hébergement est INDISPENSABLE à un séjour complet. */
const VILLES_SEJOUR: VilleHotel[] = ["Madina", "Makkah"]

/** Clé locale d'un hôtel : ville + nom. Les hôtels saisis à la création n'ont pas encore d'id. */
export function cleHotel(city: VilleHotel, name: string): string {
  return `${city}|${name.trim().toLocaleLowerCase("fr")}`
}

/** Un hôtel du programme, avec ce qu'il faut pour estimer le coût d'une nuitée. */
export interface HotelGrilleOption {
  /** Clé locale `cleHotel(city, name)` — identifiant stable côté formulaire. */
  cle: string
  name: string
  city: VilleHotel
  /** Prix de la chambre en Riyal, par type de chambre. Absent = non renseigné. */
  prixChambreRiyal: Partial<Record<RoomTypeKey, number>>
  /** Types de chambre réellement configurés dans cet hôtel (nombre de chambres > 0). */
  typesChambre: RoomTypeKey[]
  /** Nuits passées dans cet hôtel (jours de la ville, ou nbJours de l'hôtel « Autre »). */
  nuits: number
}

/** Une formule en cours de saisie dans le formulaire. */
export interface FormuleForm {
  /** Clé React stable, indépendante de la base (une formule non enregistrée n'a pas d'id). */
  cle: string
  label: string
  /** Clés des hôtels autorisés (cf. `cleHotel`). */
  hotels: string[]
  /** Prix saisi par type de chambre. Chaîne vide = case « — » (non proposé). */
  prix: Partial<Record<RoomTypeKey, string>>
  /**
   * Le libellé a été saisi à la main : il n'est plus dérivé des hôtels cochés.
   * Tant que ce drapeau est faux, cocher un hôtel met le libellé à jour tout seul.
   */
  labelManuel?: boolean
}

/** Paramètres financiers du programme utilisés par l'estimation du coût. */
export interface ParamsCoutProgramme {
  /** Taux de change Riyal → DH. */
  exchange: number
  /** Prix du billet d'avion, déjà en DH. */
  prixAvionDH: number
  /** Prix du visa, en Riyal. */
  prixVisaRiyal: number
}

/**
 * Coût d'hébergement par voyageur, en Riyal : prix de la chambre réparti sur ses
 * occupants, multiplié par le nombre de nuits.
 */
export function coutHotelParVoyageurRiyal(
  prixChambreRiyal: number,
  capacite: number,
  nuits: number
): number {
  if (!Number.isFinite(prixChambreRiyal) || prixChambreRiyal <= 0) return 0
  if (!Number.isFinite(capacite) || capacite <= 0) return 0
  if (!Number.isFinite(nuits) || nuits <= 0) return 0
  return (prixChambreRiyal / capacite) * nuits
}

/**
 * Coût agence par voyageur, en DH : vol + (visa + hébergement) × change.
 *
 * Décomposition strictement identique au prix client du mode CALCUL, **sans le
 * terme de profit** : c'est un coût, pas un prix de vente.
 */
export function coutAgenceParVoyageurDh(params: {
  exchange: number
  prixAvionDH: number
  prixVisaRiyal: number
  /** Σ des coûts d'hébergement par voyageur, en Riyal. */
  coutHotelsRiyal: number
  includeAvion?: boolean
  includeVisa?: boolean
}): number {
  const prixAvion = params.includeAvion === false ? 0 : params.prixAvionDH
  const prixVisa = params.includeVisa === false ? 0 : params.prixVisaRiyal
  const riyal = prixVisa + params.coutHotelsRiyal
  return Math.round(prixAvion + riyal * params.exchange)
}

/**
 * Estimation du coût d'une case de la grille (une formule × un type de chambre).
 *
 * - `null` → coût INCOMPLET : au moins un hôtel retenu n'a pas de prix pour ce
 *   type de chambre, ou une ville de séjour (Madina / Makkah) présente dans le
 *   programme n'a aucun hôtel choisi dans cette formule. Mieux vaut le dire que
 *   d'afficher un chiffre faux.
 * - `{ min, max }` → coût par personne en DH. `min !== max` quand une ville offre
 *   un choix entre plusieurs hôtels de prix différents (fourchette).
 *
 * Les hôtels « Autre » sont une extension optionnelle : leur absence dans une
 * formule ne rend pas le coût incomplet, elle signifie simplement qu'elle ne
 * comporte pas cette étape.
 */
export function estimerCoutCase(
  formule: FormuleForm,
  roomType: RoomTypeKey,
  hotelsDuProgramme: HotelGrilleOption[],
  params: ParamsCoutProgramme
): { min: number; max: number } | null {
  const capacite = CAPACITE_TYPE[roomType]
  const retenus = hotelsDuProgramme.filter((h) => formule.hotels.includes(h.cle))

  // Une ville de séjour présente dans le programme mais absente de la formule :
  // le pèlerin doit bien dormir quelque part — le coût ne peut pas être établi.
  for (const ville of VILLES_SEJOUR) {
    const villeDansProgramme = hotelsDuProgramme.some((h) => h.city === ville)
    const villeDansFormule = retenus.some((h) => h.city === ville)
    if (villeDansProgramme && !villeDansFormule) return null
  }

  if (retenus.length === 0) return null

  let minRiyal = 0
  let maxRiyal = 0

  const villes = Array.from(new Set(retenus.map((h) => h.city)))
  for (const ville of villes) {
    const hotelsVille = retenus.filter((h) => h.city === ville)
    const couts: number[] = []
    for (const hotel of hotelsVille) {
      const prix = hotel.prixChambreRiyal[roomType]
      // Prix de chambre manquant sur un hôtel autorisé : fourchette indéterminable.
      if (prix === undefined || !Number.isFinite(prix) || prix <= 0) return null
      couts.push(coutHotelParVoyageurRiyal(prix, capacite, hotel.nuits))
    }
    if (couts.length === 0) return null
    minRiyal += Math.min(...couts)
    maxRiyal += Math.max(...couts)
  }

  return {
    min: coutAgenceParVoyageurDh({ ...params, coutHotelsRiyal: minRiyal }),
    max: coutAgenceParVoyageurDh({ ...params, coutHotelsRiyal: maxRiyal }),
  }
}

/**
 * Colonnes à afficher dans la grille : uniquement les types de chambre que le
 * programme propose RÉELLEMENT. Sans chambre double configurée, la colonne
 * « Double » n'a pas lieu d'être — elle inviterait à vendre un hébergement
 * inexistant.
 *
 * Un type déjà tarifé dans la grille reste affiché même s'il n'a plus de chambre :
 * masquer la colonne ferait disparaître un prix saisi sans que personne ne le voie.
 */
export function colonnesGrille(
  hotelsDuProgramme: HotelGrilleOption[],
  formules: FormuleForm[]
): RoomTypeKey[] {
  const disponibles = new Set<RoomTypeKey>()
  for (const hotel of hotelsDuProgramme) {
    for (const roomType of hotel.typesChambre) disponibles.add(roomType)
  }
  for (const formule of formules) {
    for (const roomType of COLONNES_GRILLE) {
      if (prixCase(formule, roomType) !== null) disponibles.add(roomType)
    }
  }
  return COLONNES_GRILLE.filter((roomType) => disponibles.has(roomType))
}

/**
 * Libellé dérivé des hôtels cochés, dans l'ordre des villes d'un séjour :
 * « Al Markaziya + Emaar Grand ou Diyafat Al Rajaa ». Les hôtels d'une même ville
 * sont une alternative, d'où le « ou » ; les villes se cumulent, d'où le « + ».
 */
export function labelDepuisHotels(
  clesHotels: string[],
  hotelsDuProgramme: HotelGrilleOption[]
): string {
  const retenus = hotelsDuProgramme.filter((h) => clesHotels.includes(h.cle))
  const parVille = ["Madina", "Makkah", "Autre"] as VilleHotel[]
  const morceaux: string[] = []
  for (const ville of parVille) {
    const noms = retenus.filter((h) => h.city === ville).map((h) => h.name)
    if (noms.length > 0) morceaux.push(noms.join(" ou "))
  }
  return morceaux.join(" + ")
}

/** Prix saisi dans une case, ou `null` si la case est vide (« non proposé »). */
export function prixCase(formule: FormuleForm, roomType: RoomTypeKey): number | null {
  const brut = String(formule.prix[roomType] ?? "").trim()
  if (brut === "") return null
  const n = Number(brut)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

/** Vrai si au moins une formule porte au moins un prix — condition de la bascule en GRILLE. */
export function grilleContientUnPrix(formules: FormuleForm[]): boolean {
  return formules.some((f) => COLONNES_GRILLE.some((t) => prixCase(f, t) !== null))
}

/**
 * Prix d'appel de la grille (« À partir de X DH ») : la case la moins chère,
 * ou `null` si aucune case n'est renseignée.
 */
export function prixMinGrille(formules: FormuleForm[]): number | null {
  let min: number | null = null
  for (const formule of formules) {
    for (const roomType of COLONNES_GRILLE) {
      const prix = prixCase(formule, roomType)
      if (prix === null) continue
      if (min === null || prix < min) min = prix
    }
  }
  return min
}

/**
 * Motifs qui empêchent d'enregistrer la grille. La MARGE n'en fait jamais partie :
 * vendre à perte est une décision du gérant, l'application l'affiche sans l'interdire.
 */
export function validerGrille(
  formules: FormuleForm[],
  hotelsDuProgramme: HotelGrilleOption[]
): string[] {
  const raisons: string[] = []
  const labelsVus = new Set<string>()

  formules.forEach((formule, index) => {
    const position = index + 1
    const label = formule.label.trim()
    if (!label) {
      raisons.push(`Formule ${position} : le libellé est obligatoire.`)
    } else {
      const cle = label.toLocaleLowerCase("fr")
      if (labelsVus.has(cle)) {
        raisons.push(`Deux formules portent le même libellé « ${label} ».`)
      }
      labelsVus.add(cle)
    }

    const nom = label || `Formule ${position}`
    for (const ville of VILLES_SEJOUR) {
      const villeDansProgramme = hotelsDuProgramme.some((h) => h.city === ville)
      if (!villeDansProgramme) continue
      const choisi = hotelsDuProgramme.some(
        (h) => h.city === ville && formule.hotels.includes(h.cle)
      )
      if (!choisi) {
        raisons.push(`Formule « ${nom} » : choisissez au moins un hôtel à ${ville}.`)
      }
    }

    if (hotelsDuProgramme.length > 0 && formule.hotels.length === 0) {
      raisons.push(`Formule « ${nom} » : aucun hôtel sélectionné.`)
    }

    for (const roomType of COLONNES_GRILLE) {
      const brut = String(formule.prix[roomType] ?? "").trim()
      if (brut === "") continue
      const n = Number(brut)
      if (!Number.isFinite(n) || n < 0) {
        raisons.push(
          `Formule « ${nom} » — ${LIBELLE_TYPE[roomType]} : le prix doit être un montant positif ou nul.`
        )
      }
    }
  })

  return Array.from(new Set(raisons))
}

/**
 * Formule reçue de l'API (GET /api/programs/:id).
 *
 * `note` n'est plus saisissable — le champ a été retiré de l'interface — mais la
 * colonne reste en base pour ne perdre aucune mention déjà enregistrée.
 */
export interface FormuleApi {
  id: number
  label: string
  note: string | null
  ordre: number
  hotels: Array<{ id: number; name: string; city: VilleHotel }>
  prix: Array<{ roomType: RoomTypeKey; prixVente: number }>
}

/** Grille de l'API → état du formulaire. */
export function formulesDepuisApi(formules: FormuleApi[] | undefined | null): FormuleForm[] {
  if (!Array.isArray(formules)) return []
  return [...formules]
    .sort((a, b) => a.ordre - b.ordre || a.id - b.id)
    .map((f) => {
      const prix: Partial<Record<RoomTypeKey, string>> = {}
      for (const cellule of f.prix) {
        prix[cellule.roomType] = String(cellule.prixVente)
      }
      return {
        cle: `api-${f.id}`,
        label: f.label,
        hotels: f.hotels.map((h) => cleHotel(h.city, h.name)),
        prix,
        // Un libellé déjà enregistré ne doit pas être réécrit par la génération
        // automatique au premier clic sur un hôtel.
        labelManuel: true,
      }
    })
}

/**
 * État du formulaire → corps de `PUT /api/programs/:id/grille`.
 *
 * Les hôtels sont transmis par NOM + VILLE : c'est la seule référence disponible
 * au moment de la création d'un programme (les hôtels viennent d'être saisis et
 * n'ont pas encore d'identifiant côté navigateur). Le backend les résout parmi
 * les hôtels réellement rattachés au programme.
 */
export function formulesVersApi(
  formules: FormuleForm[],
  hotelsDuProgramme: HotelGrilleOption[]
): Array<{
  label: string
  ordre: number
  hotels: Array<{ name: string; city: VilleHotel }>
  prix: Array<{ roomType: RoomTypeKey; prixVente: number }>
}> {
  const parCle = new Map(hotelsDuProgramme.map((h) => [h.cle, h]))
  return formules.map((formule, index) => ({
    label: formule.label.trim(),
    ordre: index,
    hotels: formule.hotels
      .map((cle) => parCle.get(cle))
      .filter((h): h is HotelGrilleOption => Boolean(h))
      .map((h) => ({ name: h.name, city: h.city })),
    prix: COLONNES_GRILLE.flatMap((roomType) => {
      const prix = prixCase(formule, roomType)
      return prix === null ? [] : [{ roomType, prixVente: prix }]
    }),
  }))
}

/** Formule vierge prête à être ajoutée au tableau. */
export function formuleVide(): FormuleForm {
  return {
    cle: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: "",
    hotels: [],
    prix: {},
  }
}
