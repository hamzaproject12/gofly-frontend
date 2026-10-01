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

import { COLONNES_GRILLE, FormuleApi, RoomTypeKey, VilleHotel } from "@/lib/grilleTarifaire"

export type { FormuleApi }

/** Mode de tarification d'un programme. */
export type PricingMode = "CALCUL" | "GRILLE"

/** Formules triées dans l'ordre de la brochure. */
export function formulesTriees(formules: FormuleApi[] | undefined | null): FormuleApi[] {
  if (!Array.isArray(formules)) return []
  return [...formules].sort((a, b) => a.ordre - b.ordre || a.id - b.id)
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
