/**
 * Formatage unique des montants et des dates pour toute l'application.
 *
 * Un montant affiché à l'agence est une donnée financière : il est TOUJOURS
 * rendu en entier, jamais abrégé en "k" ou "M", et toujours avec le même
 * séparateur, quelle que soit la page.
 */

// Séparateur de milliers : espace insécable (U+00A0). Un montant ne doit jamais
// être coupé en fin de ligne, et l'implémentation manuelle garantit un rendu
// identique quel que soit le moteur ICU du navigateur (Intl.NumberFormat rend
// tantôt U+202F tantôt U+00A0 selon les versions).
const SEPARATEUR_MILLIERS = " "
// Variante espace ASCII pour les rendus hors DOM (PDF jsPDF, canvas) : la fonte
// Helvetica de jsPDF rend U+00A0 et U+202F par un "/". Le retour à la ligne
// n'existant pas dans ces contextes, l'espace insécable n'y apporte rien.
const SEPARATEUR_MILLIERS_ASCII = " "
const DEVISE = "DH"

/** Convertit une valeur quelconque en nombre fini, 0 par défaut. */
function toNombre(value: number | string | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function grouper(value: number | string | null | undefined, separateur: string): string {
  const arrondi = Math.round(toNombre(value))
  const signe = arrondi < 0 ? "-" : ""
  const chiffres = Math.abs(arrondi).toString()
  return signe + chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, separateur)
}

/**
 * Nombre arrondi à l'unité, avec séparateurs de milliers, sans devise.
 * Ex. 1125572.267 -> "1 125 572"
 */
export function formatNombre(value: number | string | null | undefined): string {
  return grouper(value, SEPARATEUR_MILLIERS)
}

/**
 * Idem `formatNombre`, en espaces ASCII et avec décimales optionnelles.
 * Réservé aux exports PDF / canvas (voir SEPARATEUR_MILLIERS_ASCII).
 */
export function formatNombreAscii(
  value: number | string | null | undefined,
  decimales = 0
): string {
  const safe = toNombre(value)
  if (decimales <= 0) return grouper(safe, SEPARATEUR_MILLIERS_ASCII)

  const [partieEntiere, partieDecimale] = Math.abs(safe).toFixed(decimales).split(".")
  const signe = safe < 0 ? "-" : ""
  const groupee = partieEntiere.replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATEUR_MILLIERS_ASCII)
  return `${signe}${groupee}${partieDecimale ? `,${partieDecimale}` : ""}`
}

/** Idem `formatMontant`, en espaces ASCII — réservé aux exports PDF / canvas. */
export function formatMontantAscii(value: number | string | null | undefined): string {
  return `${formatNombreAscii(value)}${SEPARATEUR_MILLIERS_ASCII}${DEVISE}`
}

/**
 * Montant complet suffixé de la devise. Jamais abrégé.
 * Ex. 1177639 -> "1 177 639 DH"
 */
export function formatMontant(value: number | string | null | undefined): string {
  return `${formatNombre(value)}${SEPARATEUR_MILLIERS}${DEVISE}`
}

/**
 * Montant précédé d'un signe explicite, pour les variations de solde
 * (entrées / sorties de caisse). Ex. -4200 -> "-4 200 DH"
 */
export function formatMontantSigne(value: number | string | null | undefined): string {
  const n = Math.round(toNombre(value))
  return `${n >= 0 ? "+" : "-"}${formatNombre(Math.abs(n))}${SEPARATEUR_MILLIERS}${DEVISE}`
}

/**
 * Montant en valeur absolue : pour les libellés qui portent déjà leur sens
 * ("Reste : 23 000 DH"), où un signe négatif se lirait comme une perte.
 */
export function formatMontantAbsolu(value: number | string | null | undefined): string {
  return formatMontant(Math.abs(toNombre(value)))
}

/**
 * Date au format français jj/mm/aaaa.
 * Accepte une Date, un ISO complet ou une date seule "aaaa-mm-jj" — cette
 * dernière est découpée à la main pour éviter le décalage de fuseau que
 * provoquerait `new Date("2026-08-10")` (interprétée en UTC).
 */
export function formatDateFr(value: string | Date | null | undefined): string {
  if (!value) return ""

  if (typeof value === "string") {
    const dateSeule = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateSeule) {
      const [, annee, mois, jour] = dateSeule
      return `${jour}/${mois}/${annee}`
    }
  }

  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : ""

  const jour = String(d.getDate()).padStart(2, "0")
  const mois = String(d.getMonth() + 1).padStart(2, "0")
  return `${jour}/${mois}/${d.getFullYear()}`
}

/** Date + heure au format français jj/mm/aaaa HH:mm. */
export function formatDateHeureFr(value: string | Date | null | undefined): string {
  if (!value) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : ""

  const heures = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  return `${formatDateFr(d)} ${heures}:${minutes}`
}
