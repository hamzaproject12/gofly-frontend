/**
 * Validité d'un prix de réservation — source unique pour tous les formulaires.
 *
 * Règle métier : **0 DH est un prix VALIDE**. Une agence enregistre parfois un
 * accompagnateur / encadrant qui voyage avec le groupe sans être facturé : sa
 * place doit être décomptée et son dossier suivi (passeport, visa, vol), mais
 * son prix vaut 0. Un test « falsy » (`if (!prix)`) traite ce 0 comme un prix
 * absent et bloque la confirmation : ne jamais en réintroduire.
 *
 * Un prix n'est invalide que s'il est absent (null / undefined / chaîne vide),
 * non numérique (NaN, Infinity) ou strictement négatif.
 */

/** Convertit une saisie en nombre, ou NaN si la valeur est absente/illisible. */
export function parsePrix(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return Number.NaN
  if (typeof value === "number") return value
  const texte = String(value).trim()
  if (texte === "") return Number.NaN
  return Number(texte)
}

/** Vrai si le prix est exploitable : nombre fini >= 0. Le prix 0 est valide. */
export function estPrixValide(value: number | string | null | undefined): boolean {
  const n = parsePrix(value)
  return Number.isFinite(n) && n >= 0
}

/**
 * Prix normalisé pour l'enregistrement : nombre fini >= 0, arrondi à l'unité.
 * Retourne null si la valeur n'est pas un prix exploitable — l'appelant doit
 * alors refuser l'enregistrement plutôt que d'écrire NaN ou une valeur négative.
 */
export function normaliserPrix(value: number | string | null | undefined): number | null {
  const n = parsePrix(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

/**
 * Réduction bornée à l'intervalle [0, prix calculé] : une réduction supérieure
 * au prix est ramenée au prix (résultat 0 DH), jamais un prix négatif.
 */
export function plafonnerReduction(reduction: number, prixCalcule: number): number {
  if (!Number.isFinite(reduction) || reduction < 0) return 0
  if (!Number.isFinite(prixCalcule) || prixCalcule <= 0) return 0
  return Math.min(reduction, prixCalcule)
}

/**
 * Pourcentage payé, sans division par zéro. Un dossier à 0 DH est soldé (100 %).
 */
export function pourcentagePaye(
  paye: number | string | null | undefined,
  total: number | string | null | undefined
): number {
  const montantPaye = Number(paye)
  const montantTotal = Number(total)
  const p = Number.isFinite(montantPaye) ? montantPaye : 0
  const t = Number.isFinite(montantTotal) ? montantTotal : 0
  if (t <= 0) return 100
  return Math.max(0, Math.min(100, Math.round((p / t) * 100)))
}
