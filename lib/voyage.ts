/**
 * Échéances des dates de voyage d'un programme (départ / arrivée).
 *
 * Source unique du calcul et des seuils : le dashboard et la page Gestion des
 * programmes doivent alerter au même moment, sinon un programme apparaît urgent
 * sur un écran et pas sur l'autre.
 */

/**
 * Fenêtre d'alerte avant une date de voyage, en jours calendaires.
 * Une date qui tombe dans cette fenêtre (aujourd'hui inclus) déclenche une alerte.
 */
export const JOURS_ALERTE_VOYAGE = 2

/** Au-delà de ce seuil l'échéance n'est plus signalée en ambre. */
export const JOURS_VIGILANCE_VOYAGE = 7

/**
 * Nombre de jours calendaires entre aujourd'hui et `value` : 0 = aujourd'hui,
 * 2 = dans deux jours, négatif = date déjà passée. `null` si la date est absente
 * ou invalide. On compare des minuits locaux pour que l'heure de la journée
 * n'influence jamais le décompte.
 */
export function joursAvant(value: string | Date | null | undefined): number | null {
  if (!value) return null
  const cible = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(cible.getTime())) return null
  const minuitCible = new Date(cible.getFullYear(), cible.getMonth(), cible.getDate())
  const now = new Date()
  const minuitAujourdhui = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((minuitCible.getTime() - minuitAujourdhui.getTime()) / 86400000)
}

/** Vrai si l'échéance tombe dans les `JOURS_ALERTE_VOYAGE` jours à venir. */
export function estImminente(jours: number | null): jours is number {
  return jours !== null && jours >= 0 && jours <= JOURS_ALERTE_VOYAGE
}

/** Libellé d'échéance lisible : « aujourd'hui », « demain », « dans 2 jours ». */
export function libelleEcheance(jours: number): string {
  if (jours === 0) return "aujourd'hui"
  if (jours === 1) return "demain"
  return `dans ${jours} jours`
}

/**
 * Heure de vol lisible : « 14h30 ». Les heures sont stockées en texte "HH:mm"
 * (voir `Program.heureDepart` côté Prisma) : pas de conversion de fuseau, ce qui
 * est saisi est ce qui s'affiche. Renvoie `null` si l'heure est absente ou illisible.
 */
export function formatHeureVoyage(value: string | null | undefined): string | null {
  if (!value) return null
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const heures = Number(m[1])
  const minutes = Number(m[2])
  if (heures > 23 || minutes > 59) return null
  return `${String(heures).padStart(2, "0")}h${String(minutes).padStart(2, "0")}`
}
