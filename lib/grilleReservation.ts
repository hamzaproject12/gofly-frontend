/**
 * Côté réservation : lire la grille tarifaire d'un programme pour la vendre.
 *
 * La passe 1 permet au gérant de SAISIR la grille (cf. `lib/grilleTarifaire.ts`).
 * Ce module-ci sert les formulaires de réservation : quelles cases sont
 * proposées, à quel prix, et quels hôtels la formule impose.
 *
 * Aucune notion de plan Économique / Normal / VIP : en mode GRILLE le prix vient
 * de la brochure.
 */

import {
  COLONNES_GRILLE,
  FormuleApi,
  RoomTypeKey,
  VilleHotel,
  hotelsFormuleDepuisApi,
} from "@/lib/grilleTarifaire"

export type { FormuleApi }

/** Mode de tarification d'un programme. */
export type PricingMode = "CALCUL" | "GRILLE"

/**
 * Formules triées dans l'ordre de la brochure.
 *
 * Point d'entrée unique de la grille dans les formulaires de réservation : les
 * hôtels y sont ramenés à la forme plate `{ id, name, city }` (cf.
 * `hotelsFormuleDepuisApi`), dont dépendent `hotelsImposes` et
 * `formulesContenantHotel`. L'opération est idempotente — une grille déjà plate
 * traverse sans changement.
 */
export function formulesTriees(formules: FormuleApi[] | undefined | null): FormuleApi[] {
  if (!Array.isArray(formules)) return []
  return [...formules]
    .map((f) => ({
      ...f,
      hotels: hotelsFormuleDepuisApi(f.hotels),
      prix: Array.isArray(f.prix) ? f.prix : [],
    }))
    .sort((a, b) => a.ordre - b.ordre || a.id - b.id)
}

/** Prix de vente par personne d'une case, ou `null` si la case n'est pas proposée. */
export function prixGrilleDe(
  formules: FormuleApi[],
  formuleId: number | null,
  roomType: string | null
): number | null {
  if (formuleId === null || !roomType) return null
  const formule = formules.find((f) => f.id === formuleId)
  if (!formule) return null
  const cellule = formule.prix.find((p) => p.roomType === roomType)
  return cellule ? cellule.prixVente : null
}

/** Types de chambre réellement proposés par une formule. */
export function typesProposes(formule: FormuleApi): RoomTypeKey[] {
  return COLONNES_GRILLE.filter((roomType) =>
    formule.prix.some((p) => p.roomType === roomType)
  )
}

/**
 * Colonnes du tableau de vente : les types proposés par AU MOINS une formule.
 * Une colonne que personne ne propose n'a rien à faire dans la brochure.
 */
export function colonnesVente(formules: FormuleApi[]): RoomTypeKey[] {
  return COLONNES_GRILLE.filter((roomType) =>
    formules.some((f) => f.prix.some((p) => p.roomType === roomType))
  )
}

/** Vrai si la grille porte au moins une case vendable. */
export function grilleExploitable(formules: FormuleApi[] | undefined | null): boolean {
  return formulesTriees(formules).some((f) => f.prix.length > 0)
}

/** Hôtels qu'une formule autorise dans une ville donnée. */
export function hotelsImposes(
  formule: FormuleApi | null | undefined,
  city: VilleHotel
): Array<{ id: number; name: string; city: VilleHotel }> {
  if (!formule) return []
  return formule.hotels.filter((h) => h.city === city)
}

/**
 * Formules qui autorisent un hôtel donné — utilisé par le pré-remplissage depuis
 * le tableau de bord : un même hôtel peut appartenir à PLUSIEURS formules, on ne
 * devine jamais laquelle a été vendue.
 */
export function formulesContenantHotel(
  formules: FormuleApi[],
  hotelId: number
): FormuleApi[] {
  return formules.filter((f) => f.hotels.some((h) => h.id === hotelId))
}

/** Total de la grille pour un nombre d'occupants donné. */
export function totalGrille(prixParPersonne: number | null, occupants: number): number | null {
  if (prixParPersonne === null) return null
  const n = Number.isInteger(occupants) && occupants > 0 ? occupants : 1
  return prixParPersonne * n
}

/**
 * Une chambre du programme, réduite à ce qui décide de la disponibilité d'une
 * case de la brochure. Forme volontairement minimale : les deux formulaires de
 * réservation la servent depuis `programInfo.rooms` sans conversion.
 */
export interface ChambreInventaire {
  hotelId: number
  roomType: string
  gender?: string | null
  nbrPlaceTotal: number
  nbrPlaceRestantes: number
}

/**
 * Pourquoi une case de la brochure n'est plus vendable.
 * - `COMPLET` : des chambres existent, elles sont toutes pleines.
 * - `AUCUNE_CHAMBRE` : aucune chambre de ce type (et de ce genre) dans les
 *   hôtels de la formule — rien à occuper, donc rien à vendre.
 */
export type MotifIndispo = "COMPLET" | "AUCUNE_CHAMBRE"

export interface DispoCase {
  vendable: boolean
  motif: MotifIndispo | null
}

const VENDABLE: DispoCase = { vendable: true, motif: null }

/**
 * Villes dont l'hébergement conditionne la vente. Les hôtels « Autre » sont une
 * étape optionnelle (l'agent peut la désactiver) : leur inventaire ne doit donc
 * jamais faire passer une case de la brochure pour complète.
 */
const VILLES_VENTE: VilleHotel[] = ["Madina", "Makkah"]

/** Une chambre réservée aux hommes n'accueille pas une pèlerine — et inversement. */
function genreCompatible(genreChambre: string | null | undefined, genreVendu: string | null | undefined): boolean {
  if (!genreVendu) return true
  if (!genreChambre || genreChambre === "Mixte") return true
  return genreChambre === genreVendu
}

/**
 * Disponibilité d'une case de la grille (une formule × un type de chambre).
 *
 * Une case dont il ne reste rien à occuper n'a pas de prix à afficher : la
 * brochure annoncerait un tarif que personne ne peut acheter. La règle est
 * calquée sur les garde-fous du prix (« Aucune place disponible… », « Aucune
 * chambre de ce type et de ce genre… ») : pour CHAQUE ville de séjour que la
 * formule couvre, il faut au moins une chambre du bon type, du bon genre, et
 * encore libre.
 *
 * Inventaire vide (programme pas encore chargé, chambres jamais créées) : on ne
 * prétend pas savoir, la case reste vendable. Mieux vaut laisser vendre que
 * barrer toute une brochure sur une information absente.
 */
export function dispoCase(
  formule: FormuleApi,
  roomType: RoomTypeKey,
  chambres: ChambreInventaire[] | undefined | null,
  options: {
    /** Genre vendu ; `null` quand le dossier accepte une chambre mixte (famille). */
    gender?: string | null
    /** Chambre privée : il faut une chambre ENTIÈREMENT libre, pas un lit. */
    chambreEntiere?: boolean
  } = {}
): DispoCase {
  if (!Array.isArray(chambres) || chambres.length === 0) return VENDABLE

  const estLibre = (chambre: ChambreInventaire): boolean =>
    options.chambreEntiere
      ? chambre.nbrPlaceTotal > 0 && chambre.nbrPlaceRestantes >= chambre.nbrPlaceTotal
      : chambre.nbrPlaceRestantes > 0

  for (const ville of VILLES_VENTE) {
    const hotelsVille = formule.hotels.filter((h) => h.city === ville).map((h) => h.id)
    // Formule sans étape dans cette ville : rien à vérifier.
    if (hotelsVille.length === 0) continue
    const candidates = chambres.filter(
      (c) =>
        hotelsVille.includes(c.hotelId) &&
        c.roomType === roomType &&
        genreCompatible(c.gender, options.gender)
    )
    if (candidates.length === 0) return { vendable: false, motif: "AUCUNE_CHAMBRE" }
    if (!candidates.some(estLibre)) return { vendable: false, motif: "COMPLET" }
  }

  return VENDABLE
}
