/**
 * Plan de chambres (rooming list) — types, palette « famille » et index pèlerins.
 *
 * Source de vérité : `GET /api/room-availability/:programId/rooming`, qui
 * reconstitue le placement réel à partir de `Room.listeIdsReservation`
 * (1 réservation = 1 place, l'index dans la liste EST le numéro de place).
 *
 * Ce module est partagé par la page `/programmes/plan-chambres/[id]` et par
 * l'export PDF (`lib/roomingPdf.ts`) : les couleurs affichées à l'écran et
 * celles imprimées viennent donc du MÊME tableau, elles ne peuvent pas diverger.
 */

export interface RoomingOccupant {
  place: number
  reservationId: number
  nom: string
  prenom: string
  nomFamille: string
  gender: string
  phone: string
  passportNumber: string
  groupe: string
  status: string
  typeReservation: "LIT" | "CHAMBRE_PRIVEE" | string
  /** Clé de regroupement : `groupId` de la réservation, ou `solo-<id>`. */
  groupKey: string
  isLeader: boolean
}

export interface RoomingRoom {
  id: number
  /** Numéro d'ordre de la chambre dans l'hôtel (stable : par type puis par id). */
  numero: number
  roomType: string
  roomTypeLabel: string
  gender: string
  prixRoom: number
  totalPlaces: number
  placesOccupees: number
  placesRestantes: number
  estChambrePrivee: boolean
  estComplete: boolean
  estVide: boolean
  occupants: RoomingOccupant[]
  placesLibres: number[]
}

export interface RoomingHotel {
  hotelId: number
  hotelName: string
  city: string
  ordre: number
  totalPlaces: number
  placesOccupees: number
  placesRestantes: number
  rooms: RoomingRoom[]
}

export interface RoomingVille {
  key: string
  label: string
  totalPlaces: number
  placesOccupees: number
  placesRestantes: number
  hotels: RoomingHotel[]
}

export interface RoomingProgram {
  id: number
  name: string
  status: "ACTIF" | "CLOTURE" | "ARCHIVE" | string
  dateDepart: string | null
  dateArrivee: string | null
  dureeJours: number
  isDeleted: boolean
}

export interface RoomingSummary {
  totalHotels: number
  totalRooms: number
  totalPlaces: number
  placesOccupees: number
  placesRestantes: number
  chambresCompletes: number
  chambresPartielles: number
  chambresVides: number
  pelerins: number
}

export interface RoomingPlan {
  success: boolean
  program: RoomingProgram
  summary: RoomingSummary
  villes: RoomingVille[]
}

/* ------------------------------------------------------------------ */
/* Couleurs de famille                                                 */
/* ------------------------------------------------------------------ */

export interface FamilyColor {
  /** Fond pastel, lisible avec du texte foncé (écran et papier). */
  bg: string
  /** Liseré / puce, plus saturé. */
  accent: string
  /** Texte sur le fond pastel. */
  text: string
  /** Même couleur de fond en RVB, pour jsPDF. */
  rgb: [number, number, number]
}

/**
 * 12 teintes volontairement pastel : une famille garde SA couleur dans tous les
 * hôtels du programme (Madina, Makkah, étapes « Autre »), ce qui permet de
 * suivre un même groupe d'un hôtel à l'autre d'un simple coup d'œil.
 */
export const FAMILY_PALETTE: FamilyColor[] = [
  { bg: "#FFEDD5", accent: "#F97316", text: "#9A3412", rgb: [255, 237, 213] },
  { bg: "#DBEAFE", accent: "#3B82F6", text: "#1E40AF", rgb: [219, 234, 254] },
  { bg: "#DCFCE7", accent: "#22C55E", text: "#166534", rgb: [220, 252, 231] },
  { bg: "#FAE8FF", accent: "#D946EF", text: "#86198F", rgb: [250, 232, 255] },
  { bg: "#FEF9C3", accent: "#EAB308", text: "#854D0E", rgb: [254, 249, 195] },
  { bg: "#CFFAFE", accent: "#06B6D4", text: "#155E75", rgb: [207, 250, 254] },
  { bg: "#FCE7F3", accent: "#EC4899", text: "#9D174D", rgb: [252, 231, 243] },
  { bg: "#E0E7FF", accent: "#6366F1", text: "#3730A3", rgb: [224, 231, 255] },
  { bg: "#D1FAE5", accent: "#10B981", text: "#065F46", rgb: [209, 250, 229] },
  { bg: "#FFE4E6", accent: "#F43F5E", text: "#9F1239", rgb: [255, 228, 230] },
  { bg: "#ECFCCB", accent: "#84CC16", text: "#3F6212", rgb: [236, 252, 203] },
  { bg: "#EDE9FE", accent: "#8B5CF6", text: "#5B21B6", rgb: [237, 233, 254] },
]

/** Personne réservée seule : gris neutre, pour ne pas noyer les familles. */
export const SOLO_COLOR: FamilyColor = {
  bg: "#F1F5F9",
  accent: "#94A3B8",
  text: "#334155",
  rgb: [241, 245, 249],
}

export interface Famille {
  groupKey: string
  /** Libellé lisible : le champ « Groupe » saisi, sinon « Famille NOM ». */
  label: string
  /** Nombre de pèlerins distincts du groupe. */
  taille: number
  color: FamilyColor
  /** null pour une personne seule (pas de couleur de famille attribuée). */
  colorIndex: number | null
}

/**
 * Attribue une couleur à chaque groupe de 2 personnes ou plus.
 *
 * Les réservations solo restent en gris : colorier tout le monde produirait un
 * arc-en-ciel où « même couleur » ne voudrait plus rien dire. L'ordre de
 * parcours (ville → hôtel → chambre → place) rend l'attribution déterministe :
 * le même plan donne toujours les mêmes couleurs, à l'écran comme au PDF.
 */
export function buildFamilies(villes: RoomingVille[]): Map<string, Famille> {
  const membres = new Map<string, Map<number, RoomingOccupant>>()
  const ordreApparition: string[] = []

  for (const ville of villes) {
    for (const hotel of ville.hotels) {
      for (const room of hotel.rooms) {
        for (const occupant of room.occupants) {
          if (!membres.has(occupant.groupKey)) {
            membres.set(occupant.groupKey, new Map())
            ordreApparition.push(occupant.groupKey)
          }
          membres.get(occupant.groupKey)!.set(occupant.reservationId, occupant)
        }
      }
    }
  }

  const familles = new Map<string, Famille>()
  let prochaineCouleur = 0

  for (const groupKey of ordreApparition) {
    const personnes = [...membres.get(groupKey)!.values()]
    const taille = personnes.length
    const chef = personnes.find((p) => p.isLeader) || personnes[0]
    const groupeSaisi = personnes.find((p) => p.groupe.trim())?.groupe.trim()
    const nomFamille = (chef.nomFamille || chef.nom || "").trim()

    const estFamille = taille > 1
    const colorIndex = estFamille ? prochaineCouleur % FAMILY_PALETTE.length : null
    if (estFamille) prochaineCouleur += 1

    familles.set(groupKey, {
      groupKey,
      label: groupeSaisi || (estFamille && nomFamille ? `Famille ${nomFamille}` : chef.nom),
      taille,
      color: colorIndex === null ? SOLO_COLOR : FAMILY_PALETTE[colorIndex],
      colorIndex,
    })
  }

  return familles
}

/* ------------------------------------------------------------------ */
/* Index des pèlerins                                                  */
/* ------------------------------------------------------------------ */

export interface PlacementPelerin {
  ville: string
  hotelName: string
  roomNumero: number
  roomTypeLabel: string
  totalPlaces: number
  place: number
}

export interface LignePelerin {
  reservationId: number
  nom: string
  gender: string
  phone: string
  passportNumber: string
  status: string
  groupKey: string
  /** Un pèlerin occupe une place par étape : Madina, Makkah, chaque hôtel « Autre ». */
  placements: PlacementPelerin[]
}

/**
 * Liste alphabétique des pèlerins placés, avec leur chambre dans CHAQUE hôtel
 * du parcours. C'est la vue « où dort M. X ? » dont un agent a besoin à
 * l'aéroport ou à l'arrivée à l'hôtel, l'inverse exact du plan par chambre.
 */
export function buildPilgrimIndex(villes: RoomingVille[]): LignePelerin[] {
  const parPelerin = new Map<number, LignePelerin>()

  for (const ville of villes) {
    for (const hotel of ville.hotels) {
      for (const room of hotel.rooms) {
        for (const occupant of room.occupants) {
          let ligne = parPelerin.get(occupant.reservationId)
          if (!ligne) {
            ligne = {
              reservationId: occupant.reservationId,
              nom: occupant.nom,
              gender: occupant.gender,
              phone: occupant.phone,
              passportNumber: occupant.passportNumber,
              status: occupant.status,
              groupKey: occupant.groupKey,
              placements: [],
            }
            parPelerin.set(occupant.reservationId, ligne)
          }
          ligne.placements.push({
            ville: ville.label,
            hotelName: hotel.hotelName,
            roomNumero: room.numero,
            roomTypeLabel: room.roomTypeLabel,
            totalPlaces: room.totalPlaces,
            place: occupant.place,
          })
        }
      }
    }
  }

  return [...parPelerin.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
}

/** « Ch. 3 (Quadruple) · place 2 » — libellé compact d'un placement. */
export function libellePlacement(p: PlacementPelerin): string {
  return `Ch. ${p.roomNumero} (${p.roomTypeLabel}) · place ${p.place}/${p.totalPlaces}`
}

/* ------------------------------------------------------------------ */
/* Libellés                                                            */
/* ------------------------------------------------------------------ */

export function libelleGenre(gender: string): string {
  if (gender === "Homme") return "Hommes"
  if (gender === "Femme") return "Femmes"
  return "Mixte"
}

export function iconeGenre(gender: string): string {
  if (gender === "Homme") return "👨"
  if (gender === "Femme") return "👩"
  return "👥"
}

export function initialeGenre(gender: string): string {
  if (gender === "Homme") return "H"
  if (gender === "Femme") return "F"
  return "—"
}

export interface VilleStyle {
  icon: string
  gradient: string
  bg: string
  border: string
  text: string
  /** En-tête de section du PDF. */
  rgb: [number, number, number]
}

export function styleVille(key: string): VilleStyle {
  const k = (key || "").toLowerCase()
  if (k.includes("madina") || k.includes("médine") || k.includes("medine")) {
    return {
      icon: "🕌",
      gradient: "from-emerald-500 to-green-600",
      bg: "bg-emerald-50/60",
      border: "border-emerald-200",
      text: "text-emerald-700",
      rgb: [16, 185, 129],
    }
  }
  if (k.includes("makkah") || k.includes("makka") || k.includes("mecque") || k.includes("mecca")) {
    return {
      icon: "🕋",
      gradient: "from-blue-600 to-indigo-600",
      bg: "bg-blue-50/60",
      border: "border-blue-200",
      text: "text-blue-700",
      rgb: [59, 130, 246],
    }
  }
  return {
    icon: "🏨",
    gradient: "from-slate-500 to-gray-600",
    bg: "bg-slate-50/70",
    border: "border-slate-200",
    text: "text-slate-700",
    rgb: [100, 116, 139],
  }
}

/** Nom d'hôtel sans le suffixe « (Ville) » quand il est déjà porté par la section. */
export function nomHotelCourt(hotelName: string): string {
  return hotelName.replace(/\s*\([^)]*\)\s*$/, "").trim() || hotelName
}

/** Nom de fichier sûr, sans accents ni espaces. */
export function slugify(value: string, max = 48): string {
  const sansAccents = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  return (
    sansAccents
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, max) || "programme"
  )
}
