"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { usePathname, useRouter } from "next/navigation"
import { useUnsavedChangesOptional } from "@/app/components/UnsavedChangesProvider"
import {
  CalendarIcon,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle,
  Bell,
  Settings,
  Search,
  Calendar,
  Users,
  FileText,
  Wallet,
  Plane,
  DollarSign,
  BadgeCheck,
  PiggyBank,
  User,
  Bed,
  Calculator,
  Info,
  Download,
  Loader2,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import Link from "next/link"
import { siteConfig } from "@/lib/config"

interface Hotel {
  id: number;
  name: string;
  city: 'Madina' | 'Makkah';
}

type ChambresConfig = { [key: number]: { nb: string; prix: string } }

function parseNum(s: string | undefined, fallback = 0): number {
  const n = parseFloat(String(s ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : fallback
}

/** Prix moyen pondéré par nombre de chambres (Riyal / chambre) pour un type 1..5 */
function weightedAvgRoomPriceRiyal(hotels: { chambres: ChambresConfig }[], type: number): number {
  let sumNb = 0
  let sumPxNb = 0
  for (const h of hotels) {
    const nb = parseInt(h.chambres[type]?.nb || "0", 10) || 0
    const px = parseNum(h.chambres[type]?.prix, 0)
    if (nb > 0 && px > 0) {
      sumNb += nb
      sumPxNb += px * nb
    }
  }
  return sumNb > 0 ? sumPxNb / sumNb : 0
}

/** Places totales pour un type de chambre (nb chambres × capacité) */
function placesByType(hotels: { chambres: ChambresConfig }[], type: number): number {
  let p = 0
  for (const h of hotels) {
    const nb = parseInt(h.chambres[type]?.nb || "0", 10) || 0
    p += nb * type
  }
  return p
}

/** Au moins une ligne chambre avec nombre et prix chambre renseignés (non nuls) */
function hasHotelInventoryConfigured(hotels: { chambres: ChambresConfig }[]): boolean {
  for (const h of hotels) {
    for (let t = 1; t <= 5; t++) {
      const nb = parseInt(h.chambres[t]?.nb || "0", 10) || 0
      const px = parseNum(h.chambres[t]?.prix, 0)
      if (nb > 0 && px > 0) return true
    }
  }
  return false
}

function hasAtLeastOneFullyPricedRoom(hotel: { chambres: ChambresConfig }): boolean {
  for (let t = 1; t <= 5; t++) {
    const nb = parseInt(hotel.chambres[t]?.nb || "0", 10) || 0
    const px = parseNum(hotel.chambres[t]?.prix, 0)
    if (nb > 0 && px > 0) return true
  }
  return false
}

function hasRoomsWithoutPrice(hotel: { chambres: ChambresConfig }): boolean {
  for (let t = 1; t <= 5; t++) {
    const nb = parseInt(hotel.chambres[t]?.nb || "0", 10) || 0
    const prixRaw = String(hotel.chambres[t]?.prix ?? "").trim()
    const px = parseNum(prixRaw, 0)
    if (nb > 0 && (!prixRaw || px <= 0)) return true
  }
  return false
}

// Format manuel (pas de toLocaleString : ICU/navigateur insere un espace
// insecable U+00A0 ou fine U+202F que la fonte Helvetica de jsPDF rend en "/").
// Ici on garantit une espace ASCII normale (U+0020) comme separateur de milliers.
const fmtNumFr = (n: number, decimals = 0): string => {
  const safe = Number.isFinite(n) ? n : 0
  const fixed = Math.abs(safe).toFixed(decimals)
  const [intPart, decPart] = fixed.split(".")
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  const sign = safe < 0 ? "-" : ""
  return sign + grouped + (decPart ? "," + decPart : "")
}

const fmtDhFr = (n: number): string => `${fmtNumFr(Math.round(n))} DH`

async function loadImageAsDataUrl(
  url: string
): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" })
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("read error"))
      reader.readAsDataURL(blob)
    })
    const { w, h } = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 })
      img.onerror = () => resolve({ w: 1, h: 1 })
      img.src = dataUrl
    })
    return { data: dataUrl, w, h }
  } catch {
    return null
  }
}

function totalBedsByCity(hotels: { chambres: ChambresConfig }[]): number {
  let total = 0
  for (const hotel of hotels) {
    for (let t = 1; t <= 5; t++) {
      const nb = parseInt(hotel.chambres[t]?.nb || "0", 10) || 0
      total += nb * t
    }
  }
  return total
}

function profitForPlan(
  plan: "Économique" | "Normal" | "VIP",
  profit: number,
  profitEconomique: number,
  profitNormal: number,
  profitVIP: number
): number {
  switch (plan) {
    case "Économique":
      return profitEconomique || profit
    case "VIP":
      return profitVIP || profit
    case "Normal":
    default:
      return profitNormal || profit
  }
}

/**
 * Même principe que `calculatePrice` dans `app/reservations/nouvelle/page.tsx` :
 * prixAvion + profit(plan) + (visa + hôtels Madina + Makkah en Riyal) × exchange
 * avec prix hôtel = (prix chambre / nb personnes du type) × jours ville.
 */
function unitTicketPriceDh(params: {
  exchange: number
  prixAvionDH: number
  prixVisaRiyal: number
  profit: number
  profitEconomique: number
  profitNormal: number
  profitVIP: number
  plan: "Économique" | "Normal" | "VIP"
  roomTypeKey: number
  prixRoomMadinaRiyal: number
  prixRoomMakkahRiyal: number
  joursMadina: number
  joursMakkah: number
  includeAvion: boolean
  includeVisa: boolean
  /** Coût hôtels « Autre » déjà par voyageur (Σ prixRoom/nbPersonnes × nuits), en Riyal */
  prixHotelAutreRiyalPerTraveler?: number
}): number {
  const nbPersonnes = params.roomTypeKey
  const p = profitForPlan(
    params.plan,
    params.profit,
    params.profitEconomique,
    params.profitNormal,
    params.profitVIP
  )
  const prixAvion = params.includeAvion ? params.prixAvionDH : 0
  const prixVisa = params.includeVisa ? params.prixVisaRiyal : 0
  const prixHotelMadina =
    params.prixRoomMadinaRiyal > 0 && nbPersonnes > 0
      ? (params.prixRoomMadinaRiyal / nbPersonnes) * params.joursMadina
      : 0
  const prixHotelMakkah =
    params.prixRoomMakkahRiyal > 0 && nbPersonnes > 0
      ? (params.prixRoomMakkahRiyal / nbPersonnes) * params.joursMakkah
      : 0
  const riyalTotal =
    prixVisa + prixHotelMadina + prixHotelMakkah + (params.prixHotelAutreRiyalPerTraveler ?? 0)
  const prixFinal = prixAvion + p + riyalTotal * params.exchange
  return Math.round(prixFinal)
}

/**
 * Coût agence par voyageur (vol + hôtels + visa en DH), sans marge commerciale.
 * Même décomposition que le prix client (`unitTicketPriceDh`) mais sans le terme `profit`.
 */
function unitAgencyCostTravelerDh(params: {
  exchange: number
  prixAvionDH: number
  prixVisaRiyal: number
  roomTypeKey: number
  prixRoomMadinaRiyal: number
  prixRoomMakkahRiyal: number
  joursMadina: number
  joursMakkah: number
  includeAvion: boolean
  includeVisa: boolean
  /** Coût hôtels « Autre » déjà par voyageur (Σ prixRoom/nbPersonnes × nuits), en Riyal */
  prixHotelAutreRiyalPerTraveler?: number
}): number {
  const nbPersonnes = params.roomTypeKey
  const prixAvion = params.includeAvion ? params.prixAvionDH : 0
  const prixVisa = params.includeVisa ? params.prixVisaRiyal : 0
  const prixHotelMadina =
    params.prixRoomMadinaRiyal > 0 && nbPersonnes > 0
      ? (params.prixRoomMadinaRiyal / nbPersonnes) * params.joursMadina
      : 0
  const prixHotelMakkah =
    params.prixRoomMakkahRiyal > 0 && nbPersonnes > 0
      ? (params.prixRoomMakkahRiyal / nbPersonnes) * params.joursMakkah
      : 0
  const riyalTotal =
    prixVisa + prixHotelMadina + prixHotelMakkah + (params.prixHotelAutreRiyalPerTraveler ?? 0)
  return Math.round(prixAvion + riyalTotal * params.exchange)
}

export default function NouveauProgramme() {
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const unsavedChanges = useUnsavedChangesOptional()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hotelsMadina, setHotelsMadina] = useState<Hotel[]>([])
  const [hotelsMakkah, setHotelsMakkah] = useState<Hotel[]>([])
  const [hotelsAutreList, setHotelsAutreList] = useState<Hotel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Remplacer la structure du state pour les hôtels
  const [formData, setFormData] = useState({
    nom: "",
    nbJoursMadina: "",
    nbJoursMakkah: "",
    exchange: "",
    prixAvion: "",
    prixVisaRiyal: "",
    profit: "",
    profitEconomique: "",
    profitNormal: "",
    profitVIP: "",
    dateCreation: new Date(),
    hotelsMadina: [] as Array<{
      name: string,
      chambres: {
        [key: number]: { nb: string, prix: string }
      }
    }>,
    hotelsMakkah: [] as Array<{
      name: string,
      chambres: {
        [key: number]: { nb: string, prix: string }
      }
    }>,
    hotelsAutre: [] as Array<{
      name: string,
      nbJours: string,
      ordre: string,
      chambres: {
        [key: number]: { nb: string, prix: string }
      }
    }>,
    datesLimites: {
      visa: null as Date | null,
      hotels: null as Date | null,
      billets: null as Date | null,
      passport: null as Date | null,
    },
  })

  const [autreHotelMadina, setAutreHotelMadina] = useState("");
  const [showAutreMadinaInput, setShowAutreMadinaInput] = useState(false);
  const [autreHotelMakkah, setAutreHotelMakkah] = useState("");
  const [showAutreMakkahInput, setShowAutreMakkahInput] = useState(false);
  // Catégorie « Autre » (N hôtels génériques)
  const [autreHotelAutre, setAutreHotelAutre] = useState("");
  const [showAutreAutreInput, setShowAutreAutreInput] = useState(false);
  // Onglet de catégorie d'hôtel actif (Madina / Makkah / Autre)
  const [activeHotelTab, setActiveHotelTab] = useState<"madina" | "makkah" | "autre">("madina");

  /** Hypothèses pour la simulation (même logique de prix que « Nouvelle réservation ») */
  const [simIncludeAvion, setSimIncludeAvion] = useState(true)
  const [simIncludeVisa, setSimIncludeVisa] = useState(true)
  const [simPlan, setSimPlan] = useState<"Économique" | "Normal" | "VIP">("Normal")
  const [simJoursMadina, setSimJoursMadina] = useState("")
  const [simJoursMakkah, setSimJoursMakkah] = useState("")
  /** Places réservées pour agents / staff : pas de paiement client, comptées en charges */
  const [simAgentPlaces, setSimAgentPlaces] = useState("")
  const [simAgentCostPerPlaceDH, setSimAgentCostPerPlaceDH] = useState("")
  const [simAutresChargesDH, setSimAutresChargesDH] = useState("")
  const [showValidationReasons, setShowValidationReasons] = useState(false)
  const [showSimulationSection, setShowSimulationSection] = useState(false)

  const hasUnsavedChanges = useMemo(() => {
    const hasDates = Object.values(formData.datesLimites).some(Boolean)
    const hasMadinaRooms = formData.hotelsMadina.some((h) =>
      Array.from({ length: 5 }, (_, i) => i + 1).some((t) => {
        const nb = parseInt(h.chambres[t]?.nb || "0", 10) || 0
        const prix = String(h.chambres[t]?.prix ?? "").trim()
        return nb > 0 || prix.length > 0
      })
    )
    const hasMakkahRooms = formData.hotelsMakkah.some((h) =>
      Array.from({ length: 5 }, (_, i) => i + 1).some((t) => {
        const nb = parseInt(h.chambres[t]?.nb || "0", 10) || 0
        const prix = String(h.chambres[t]?.prix ?? "").trim()
        return nb > 0 || prix.length > 0
      })
    )

    return Boolean(
      formData.nom.trim() ||
      formData.nbJoursMadina.trim() ||
      formData.nbJoursMakkah.trim() ||
      formData.exchange.trim() ||
      formData.prixAvion.trim() ||
      formData.prixVisaRiyal.trim() ||
      formData.profitEconomique.trim() ||
      formData.profitNormal.trim() ||
      formData.profitVIP.trim() ||
      formData.hotelsMadina.length > 0 ||
      formData.hotelsMakkah.length > 0 ||
      hasDates ||
      hasMadinaRooms ||
      hasMakkahRooms
    )
  }, [formData])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges || isSubmitting) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [hasUnsavedChanges, isSubmitting])

  useEffect(() => {
    if (!hasUnsavedChanges || isSubmitting) return

    const shouldWarnNavigation = () =>
      window.confirm("Vous avez des modifications non enregistrees. Quitter sans enregistrer ?")

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const link = target?.closest("a[href]") as HTMLAnchorElement | null
      if (!link) return
      if (link.target === "_blank") return
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      const href = link.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return
      // Export fichier (blob) ou download programmatique : pas une navigation hors page
      if (href.startsWith("blob:") || href.startsWith("data:") || link.hasAttribute("download")) return

      try {
        const url = new URL(link.href, window.location.origin)
        const isSamePath = url.pathname === pathname
        if (isSamePath) return
        if (!shouldWarnNavigation()) {
          event.preventDefault()
          event.stopPropagation()
        }
      } catch {
        // Ignore malformed urls
      }
    }

    const onPopState = () => {
      if (shouldWarnNavigation()) return
      window.history.pushState(null, "", window.location.href)
    }

    document.addEventListener("click", onDocumentClick, true)
    window.history.pushState(null, "", window.location.href)
    window.addEventListener("popstate", onPopState)

    return () => {
      document.removeEventListener("click", onDocumentClick, true)
      window.removeEventListener("popstate", onPopState)
    }
  }, [hasUnsavedChanges, isSubmitting, pathname])

  const validateRequiredFields = useMemo(() => {
    const reasons: string[] = []
    if (!formData.nom.trim()) reasons.push("Le nom du programme est obligatoire.")
    // NB jours requis uniquement si la catégorie contient au moins un hôtel
    if (formData.hotelsMadina.length > 0 && !formData.nbJoursMadina.trim()) reasons.push("NB jours Madina est obligatoire.")
    if (formData.hotelsMakkah.length > 0 && !formData.nbJoursMakkah.trim()) reasons.push("NB jours Makkah est obligatoire.")
    if (!formData.exchange.trim()) reasons.push("Exchange est obligatoire.")
    if (!formData.prixAvion.trim()) reasons.push("Prix avion est obligatoire.")
    if (!formData.prixVisaRiyal.trim()) reasons.push("Prix visa est obligatoire.")
    if (!formData.profitEconomique.trim()) reasons.push("Profit Economique est obligatoire.")
    if (!formData.profitNormal.trim()) reasons.push("Profit Normal est obligatoire.")
    if (!formData.profitVIP.trim()) reasons.push("Profit VIP est obligatoire.")

    if (!formData.datesLimites.passport) reasons.push("Date limite passeport est obligatoire.")
    if (!formData.datesLimites.visa) reasons.push("Date limite visa est obligatoire.")
    if (!formData.datesLimites.billets) reasons.push("Date limite billets est obligatoire.")
    if (!formData.datesLimites.hotels) reasons.push("Date limite hotels est obligatoire.")

    // Madina/Makkah/Autre sont tous optionnels — exiger seulement au moins un hôtel.
    if (
      formData.hotelsMadina.length === 0 &&
      formData.hotelsMakkah.length === 0 &&
      formData.hotelsAutre.length === 0
    ) {
      reasons.push("Selectionnez au moins un hotel (Madina, Makkah ou Autre).")
    }

    for (const hotel of formData.hotelsMadina) {
      if (!hasAtLeastOneFullyPricedRoom(hotel)) {
        reasons.push(`Hotel Madina "${hotel.name}" doit contenir au moins 1 chambre avec prix.`)
      }
      if (hasRoomsWithoutPrice(hotel)) {
        reasons.push(`Hotel Madina "${hotel.name}" contient des chambres sans prix.`)
      }
    }

    for (const hotel of formData.hotelsMakkah) {
      if (!hasAtLeastOneFullyPricedRoom(hotel)) {
        reasons.push(`Hotel Makkah "${hotel.name}" doit contenir au moins 1 chambre avec prix.`)
      }
      if (hasRoomsWithoutPrice(hotel)) {
        reasons.push(`Hotel Makkah "${hotel.name}" contient des chambres sans prix.`)
      }
    }

    for (const hotel of formData.hotelsAutre) {
      // Nb de nuits obligatoire dès qu'un hôtel Autre est sélectionné (comme Madina/Makkah)
      if (!String(hotel.nbJours ?? "").trim() || Number(hotel.nbJours) <= 0) {
        reasons.push(`Nb de nuits pour l'hôtel Autre "${hotel.name}" est obligatoire.`)
      }
      if (!hasAtLeastOneFullyPricedRoom(hotel)) {
        reasons.push(`Hotel Autre "${hotel.name}" doit contenir au moins 1 chambre avec prix.`)
      }
      if (hasRoomsWithoutPrice(hotel)) {
        reasons.push(`Hotel Autre "${hotel.name}" contient des chambres sans prix.`)
      }
    }

    return reasons
  }, [formData])

  const madinaBedsCount = useMemo(() => totalBedsByCity(formData.hotelsMadina), [formData.hotelsMadina])
  const makkahBedsCount = useMemo(() => totalBedsByCity(formData.hotelsMakkah), [formData.hotelsMakkah])
  const autreBedsCount = useMemo(() => totalBedsByCity(formData.hotelsAutre), [formData.hotelsAutre])

  const simulationPreview = useMemo(() => {
    const exchange = parseNum(formData.exchange, 1) || 1
    const prixAvionDH = parseNum(formData.prixAvion, 0)
    const prixVisaRiyal = parseNum(formData.prixVisaRiyal, 0)
    const profit = parseNum(formData.profit, 0)
    const profitEconomique = parseNum(formData.profitEconomique, 0)
    const profitNormal = parseNum(formData.profitNormal, 0)
    const profitVIP = parseNum(formData.profitVIP, 0)
    const jM = parseNum(simJoursMadina || formData.nbJoursMadina, 0)
    const jK = parseNum(simJoursMakkah || formData.nbJoursMakkah, 0)

    const byType: {
      typeKey: number
      label: string
      places: number
      unitDh: number
      subtotalDh: number
    }[] = []

    let revenueIfAllPayDh = 0
    let costVolHotelVisaAllTravelersDh = 0
    let costVolAllTravelersDh = 0
    let costHotelsAllTravelersDh = 0
    let costVisaAllTravelersDh = 0
    let totalTravelersMax = 0

    const labels = ["", "Simple", "Double", "Triple", "Quadruple", "Quintuple"]

    const hasMadina = formData.hotelsMadina.length > 0
    const hasMakkah = formData.hotelsMakkah.length > 0
    const hasAutre = formData.hotelsAutre.length > 0

    for (let t = 1; t <= 5; t++) {
      const pm = weightedAvgRoomPriceRiyal(formData.hotelsMadina, t)
      const pk = weightedAvgRoomPriceRiyal(formData.hotelsMakkah, t)
      const madinaPlacesT = placesByType(formData.hotelsMadina, t)
      const makkahPlacesT = placesByType(formData.hotelsMakkah, t)

      // Hôtels « Autre » : séquence (le voyageur loge dans chacun) →
      // capacité = min sur les hôtels Autre ; coût = somme par voyageur (Riyal).
      let autrePlacesT = Infinity
      let autreRiyalPerTraveler = 0
      for (const h of formData.hotelsAutre) {
        autrePlacesT = Math.min(autrePlacesT, placesByType([h], t))
        const priceH = weightedAvgRoomPriceRiyal([h], t)
        const nights = parseNum(h.nbJours, 0)
        if (priceH > 0 && t > 0) autreRiyalPerTraveler += (priceH / t) * nights
      }

      // Goulot d'étranglement = min des places parmi les catégories PRÉSENTES
      const presentPlaces: number[] = []
      if (hasMadina) presentPlaces.push(madinaPlacesT)
      if (hasMakkah) presentPlaces.push(makkahPlacesT)
      if (hasAutre) presentPlaces.push(autrePlacesT === Infinity ? 0 : autrePlacesT)
      const paired = presentPlaces.length > 0 ? Math.min(...presentPlaces) : 0
      if (paired <= 0) continue

      const unitDh = unitTicketPriceDh({
        exchange,
        prixAvionDH,
        prixVisaRiyal,
        profit,
        profitEconomique,
        profitNormal,
        profitVIP,
        plan: simPlan,
        roomTypeKey: t,
        prixRoomMadinaRiyal: pm,
        prixRoomMakkahRiyal: pk,
        joursMadina: jM,
        joursMakkah: jK,
        includeAvion: simIncludeAvion,
        includeVisa: simIncludeVisa,
        prixHotelAutreRiyalPerTraveler: autreRiyalPerTraveler,
      })
      const subtotalDh = paired * unitDh
      const nbPersonnes = t
      const unitCostVolDh = simIncludeAvion ? prixAvionDH : 0
      const unitCostVisaDh = simIncludeVisa ? prixVisaRiyal * exchange : 0
      const unitCostHotelsDh =
        ((pm > 0 && nbPersonnes > 0 ? (pm / nbPersonnes) * jM : 0) +
          (pk > 0 && nbPersonnes > 0 ? (pk / nbPersonnes) * jK : 0) +
          autreRiyalPerTraveler) *
        exchange
      const unitCostDh = unitAgencyCostTravelerDh({
        exchange,
        prixAvionDH,
        prixVisaRiyal,
        roomTypeKey: t,
        prixRoomMadinaRiyal: pm,
        prixRoomMakkahRiyal: pk,
        joursMadina: jM,
        joursMakkah: jK,
        includeAvion: simIncludeAvion,
        includeVisa: simIncludeVisa,
        prixHotelAutreRiyalPerTraveler: autreRiyalPerTraveler,
      })
      costVolAllTravelersDh += paired * unitCostVolDh
      costHotelsAllTravelersDh += paired * unitCostHotelsDh
      costVisaAllTravelersDh += paired * unitCostVisaDh
      costVolHotelVisaAllTravelersDh += paired * unitCostDh
      revenueIfAllPayDh += subtotalDh
      totalTravelersMax += paired
      byType.push({
        typeKey: t,
        label: labels[t] ?? `Type ${t}`,
        places: paired,
        unitDh,
        subtotalDh,
      })
    }

    const avgTicketDh = totalTravelersMax > 0 ? revenueIfAllPayDh / totalTravelersMax : 0
    let agentPlaces = Math.max(0, parseInt(simAgentPlaces, 10) || 0)
    const agentOver = agentPlaces > totalTravelersMax
    if (agentPlaces > totalTravelersMax) agentPlaces = totalTravelersMax
    const payingTravelers = Math.max(0, totalTravelersMax - agentPlaces)
    const revenueAfterAgentsDh = payingTravelers * avgTicketDh
    const agentCostPer = parseNum(simAgentCostPerPlaceDH, 0)
    const agentChargesTotalDh = agentPlaces * agentCostPer
    const autresChargesDh = parseNum(simAutresChargesDH, 0)
    const totalChargesDh =
      costVolHotelVisaAllTravelersDh + agentChargesTotalDh + autresChargesDh
    const resultatPrevDh = revenueAfterAgentsDh - totalChargesDh

    return {
      exchange,
      joursMadinaEff: jM,
      joursMakkahEff: jK,
      byType,
      totalTravelersMax,
      revenueIfAllPayDh,
      avgTicketDh,
      agentPlaces,
      agentOver,
      payingTravelers,
      revenueAfterAgentsDh,
      costVolHotelVisaAllTravelersDh,
      costVolAllTravelersDh,
      costHotelsAllTravelersDh,
      costVisaAllTravelersDh,
      agentChargesTotalDh,
      autresChargesDh,
      totalChargesDh,
      resultatPrevDh,
    }
  }, [
    formData.exchange,
    formData.prixAvion,
    formData.prixVisaRiyal,
    formData.profit,
    formData.profitEconomique,
    formData.profitNormal,
    formData.profitVIP,
    formData.nbJoursMadina,
    formData.nbJoursMakkah,
    formData.hotelsMadina,
    formData.hotelsMakkah,
    formData.hotelsAutre,
    simIncludeAvion,
    simIncludeVisa,
    simPlan,
    simJoursMadina,
    simJoursMakkah,
    simAgentPlaces,
    simAgentCostPerPlaceDH,
    simAutresChargesDH,
  ])

  const canRunSimulation = useMemo(() => {
    if (!formData.nom.trim()) return false
    if (!String(formData.exchange).trim()) return false
    if (!String(formData.prixAvion).trim()) return false
    if (!String(formData.prixVisaRiyal).trim()) return false

    const hasMadina = formData.hotelsMadina.length > 0
    const hasMakkah = formData.hotelsMakkah.length > 0
    const hasAutre = formData.hotelsAutre.length > 0
    // Au moins une catégorie présente (la simulation s'adapte aux hôtels choisis)
    if (!hasMadina && !hasMakkah && !hasAutre) return false

    if (hasMadina) {
      if (!String(formData.nbJoursMadina).trim()) return false
      if (!hasHotelInventoryConfigured(formData.hotelsMadina)) return false
    }
    if (hasMakkah) {
      if (!String(formData.nbJoursMakkah).trim()) return false
      if (!hasHotelInventoryConfigured(formData.hotelsMakkah)) return false
    }
    if (hasAutre) {
      if (!hasHotelInventoryConfigured(formData.hotelsAutre)) return false
      // chaque hôtel Autre doit avoir un nb de nuits valide
      if (formData.hotelsAutre.some(h => !String(h.nbJours ?? "").trim() || Number(h.nbJours) <= 0)) return false
    }
    return true
  }, [
    formData.nom,
    formData.exchange,
    formData.nbJoursMadina,
    formData.nbJoursMakkah,
    formData.prixAvion,
    formData.prixVisaRiyal,
    formData.hotelsMadina,
    formData.hotelsMakkah,
    formData.hotelsAutre,
  ])

  const downloadSimulationReport = useCallback(async () => {
    if (!canRunSimulation) return
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ])
    const p = simulationPreview
    const exportedAt = new Date()
    const dateLabel = exportedAt.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
    const fileDate = exportedAt.toISOString().slice(0, 10)
    const programName = formData.nom.trim() || "Programme"
    const slug =
      programName
        .replace(/[^\wÀ-ÿ\s-]/gu, "")
        .replace(/\s+/g, "-")
        .slice(0, 48) || "programme"

    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const marginX = 40
    const contentW = pageW - 2 * marginX

    // Palette violet / slate / status
    const COLORS = {
      violet: [109, 40, 217] as [number, number, number],
      violetSoft: [237, 233, 254] as [number, number, number],
      slate: [51, 65, 85] as [number, number, number],
      slateSoft: [248, 250, 252] as [number, number, number],
      slateLine: [226, 232, 240] as [number, number, number],
      green: [22, 163, 74] as [number, number, number],
      red: [220, 38, 38] as [number, number, number],
      mute: [120, 120, 120] as [number, number, number],
    }
    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2])
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2])
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2])

    // === HEADER BAND ===
    setFill(COLORS.violet)
    doc.rect(0, 0, pageW, 80, "F")
    let textX = marginX
    const logo = await loadImageAsDataUrl(siteConfig.logo)
    if (logo) {
      const targetH = 44
      const targetW = Math.min(120, targetH * (logo.w / Math.max(1, logo.h)))
      try {
        doc.addImage(logo.data, "PNG", marginX, 18, targetW, targetH)
        textX = marginX + targetW + 14
      } catch {
        // si le logo n'est pas un PNG décodable, on l'ignore
      }
    }
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.text(siteConfig.name, textX, 38)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.text("Rapport de simulation de rentabilité (prévisionnel)", textX, 56)

    let y = 110

    // === TITLE BLOCK ===
    setText(COLORS.violet)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.text(`Programme : ${programName}`, marginX, y)
    y += 18
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    setText(COLORS.slate)
    doc.text(`Édité le ${dateLabel}`, marginX, y)
    y += 22

    const getLastY = (): number =>
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

    const sectionTitle = (label: string) => {
      if (y > pageH - 90) {
        doc.addPage()
        y = 60
      }
      setFill(COLORS.violet)
      doc.rect(marginX, y - 11, 4, 16, "F")
      setText(COLORS.violet)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.text(label, marginX + 12, y)
      y += 12
    }

    const kvTable = (rows: [string, string][]) => {
      autoTable(doc, {
        startY: y,
        body: rows,
        theme: "plain",
        styles: {
          fontSize: 10,
          cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
          textColor: COLORS.slate,
          lineColor: COLORS.slateLine,
          lineWidth: 0.5,
        },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 290 },
          1: { textColor: [30, 30, 30], halign: "right", cellWidth: 220 },
        },
        alternateRowStyles: { fillColor: COLORS.slateSoft },
        margin: { left: marginX, right: marginX },
      })
      y = getLastY() + 16
    }

    // === INFORMATIONS PROGRAMME ===
    sectionTitle("Informations du programme")
    kvTable([
      ["Change DH / Riyal", fmtNumFr(parseNum(formData.exchange, 0), 2)],
      ["Nombre de jours Madina", fmtNumFr(parseNum(formData.nbJoursMadina, 0))],
      ["Nombre de jours Makkah", fmtNumFr(parseNum(formData.nbJoursMakkah, 0))],
      ["Prix avion (DH)", fmtDhFr(parseNum(formData.prixAvion, 0))],
      ["Prix visa (Riyal)", fmtNumFr(parseNum(formData.prixVisaRiyal, 0))],
      ["Profit générique (DH)", fmtDhFr(parseNum(formData.profit, 0))],
      ["Profit Économique (DH)", fmtDhFr(parseNum(formData.profitEconomique, 0))],
      ["Profit Normal (DH)", fmtDhFr(parseNum(formData.profitNormal, 0))],
      ["Profit VIP (DH)", fmtDhFr(parseNum(formData.profitVIP, 0))],
    ])

    // === DATES LIMITES ===
    sectionTitle("Dates limites")
    const fmtDate = (d: Date | null | undefined) =>
      d ? format(d, "dd/MM/yyyy", { locale: fr }) : "—"
    kvTable([
      ["Date limite passeport", fmtDate(formData.datesLimites.passport)],
      ["Date limite visa", fmtDate(formData.datesLimites.visa)],
      ["Date limite billets", fmtDate(formData.datesLimites.billets)],
      ["Date limite hôtels", fmtDate(formData.datesLimites.hotels)],
    ])

    // === HYPOTHÈSES DE LA SIMULATION ===
    sectionTitle("Hypothèses de la simulation")
    kvTable([
      ["Inclure avion dans le coût", simIncludeAvion ? "Oui" : "Non"],
      ["Inclure visa dans le coût", simIncludeVisa ? "Oui" : "Non"],
      ["Plan tarifaire", simPlan],
      ["Jours Madina (simulation)", simJoursMadina || "(défaut formulaire)"],
      ["Jours Makkah (simulation)", simJoursMakkah || "(défaut formulaire)"],
      ["Places agents", fmtNumFr(parseInt(simAgentPlaces || "0", 10) || 0)],
      ["Charge par place agent (DH)", fmtDhFr(parseNum(simAgentCostPerPlaceDH, 0))],
      ["Autres charges fixes (DH)", fmtDhFr(parseNum(simAutresChargesDH, 0))],
    ])

    // === DÉTAIL PAR TYPE DE CHAMBRE ===
    sectionTitle("Détail par type de chambre")
    autoTable(doc, {
      startY: y,
      head: [["Type", "Places", "Prix / pers. (DH)", "Sous-total (DH)"]],
      body: p.byType.map((row) => [
        row.label,
        fmtNumFr(row.places),
        fmtNumFr(Math.round(row.unitDh)),
        fmtNumFr(Math.round(row.subtotalDh)),
      ]),
      foot: [[
        "Total",
        fmtNumFr(p.totalTravelersMax),
        "",
        fmtNumFr(Math.round(p.revenueIfAllPayDh)),
      ]],
      headStyles: { fillColor: COLORS.violet, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: COLORS.violetSoft, textColor: COLORS.violet, fontStyle: "bold" },
      showFoot: "lastPage",
      styles: {
        fontSize: 10,
        cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
        lineColor: COLORS.slateLine,
        lineWidth: 0.5,
      },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { halign: "right", cellWidth: 80 },
        2: { halign: "right", cellWidth: 150 },
        3: { halign: "right", cellWidth: 150 },
      },
      margin: { left: marginX, right: marginX },
    })
    y = getLastY() + 16

    // === INVENTAIRE HÔTELS ===
    const hotelRows: string[][] = []
    const pushHotelRows = (
      city: "Madina" | "Makkah",
      hotels: Array<{ name: string; chambres: ChambresConfig }>
    ) => {
      for (const hotel of hotels) {
        for (let t = 1; t <= 5; t++) {
          const nbChambres = parseInt(hotel.chambres[t]?.nb || "0", 10) || 0
          const prixRoomRiyal = parseNum(hotel.chambres[t]?.prix, 0)
          if (nbChambres <= 0 && prixRoomRiyal <= 0) continue
          const label =
            t === 1 ? "Simple"
            : t === 2 ? "Double"
            : t === 3 ? "Triple"
            : t === 4 ? "Quadruple"
            : "Quintuple"
          hotelRows.push([
            city,
            hotel.name,
            label,
            fmtNumFr(nbChambres),
            fmtNumFr(prixRoomRiyal),
            fmtNumFr(nbChambres * t),
          ])
        }
      }
    }
    pushHotelRows("Madina", formData.hotelsMadina)
    pushHotelRows("Makkah", formData.hotelsMakkah)

    if (hotelRows.length > 0) {
      sectionTitle("Inventaire hôtels et chambres")
      autoTable(doc, {
        startY: y,
        head: [["Ville", "Hôtel", "Type", "Nb chambres", "Prix chambre (Riyal)", "Places"]],
        body: hotelRows,
        headStyles: { fillColor: COLORS.violet, textColor: 255, fontStyle: "bold" },
        styles: {
          fontSize: 9,
          cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
          lineColor: COLORS.slateLine,
          lineWidth: 0.5,
        },
        columnStyles: {
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
        },
        alternateRowStyles: { fillColor: COLORS.slateSoft },
        margin: { left: marginX, right: marginX },
      })
      y = getLastY() + 16
    }

    // === RÉSULTAT PRÉVISIONNEL ===
    if (y > pageH - 320) {
      doc.addPage()
      y = 60
    }
    sectionTitle("Résultat prévisionnel")
    autoTable(doc, {
      startY: y,
      body: [
        ["CA si capacité pleine et tous payants", fmtDhFr(p.revenueIfAllPayDh)],
        ["Total paiement prévu (après agents)", fmtDhFr(p.revenueAfterAgentsDh)],
        ["Capacité totale (voyageurs)", `${fmtNumFr(p.totalTravelersMax)} pers.`],
        ["Places payantes", `${fmtNumFr(p.payingTravelers)} pers.`],
        ["Places agents (non payantes)", `${fmtNumFr(p.agentPlaces)} pers.`],
        ["Coût agence vol", fmtDhFr(p.costVolAllTravelersDh)],
        ["Coût agence hôtels", fmtDhFr(p.costHotelsAllTravelersDh)],
        ["Coût agence visa", fmtDhFr(p.costVisaAllTravelersDh)],
        ["Charges agents", fmtDhFr(p.agentChargesTotalDh)],
        ["Autres charges fixes", fmtDhFr(p.autresChargesDh)],
        ["Total charges", fmtDhFr(p.totalChargesDh)],
      ],
      theme: "plain",
      styles: {
        fontSize: 10,
        cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
        textColor: COLORS.slate,
        lineColor: COLORS.slateLine,
        lineWidth: 0.5,
      },
      columnStyles: {
        0: { cellWidth: 310 },
        1: { halign: "right", fontStyle: "bold", textColor: [30, 30, 30], cellWidth: 200 },
      },
      alternateRowStyles: { fillColor: COLORS.slateSoft },
      margin: { left: marginX, right: marginX },
    })
    y = getLastY() + 18

    // Encadré du gain net
    const isProfit = p.resultatPrevDh >= 0
    const boxH = 80
    if (y + boxH > pageH - 70) {
      doc.addPage()
      y = 60
    }
    setFill(isProfit ? COLORS.green : COLORS.red)
    doc.roundedRect(marginX, y, contentW, boxH, 8, 8, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(11)
    doc.text(isProfit ? "GAIN NET PRÉVISIONNEL" : "PERTE NETTE PRÉVISIONNELLE", marginX + 22, y + 28)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(26)
    doc.text(fmtDhFr(p.resultatPrevDh), marginX + 22, y + 62)
    y += boxH + 18

    // Mention de bas de document
    if (y > pageH - 70) {
      doc.addPage()
      y = 60
    }
    setText(COLORS.mute)
    doc.setFont("helvetica", "italic")
    doc.setFontSize(8)
    const noteLines = doc.splitTextToSize(
      "Ce rapport est une projection prévisionnelle basée sur les hypothèses saisies au moment de la simulation. Les résultats réels peuvent différer en fonction du remplissage effectif du programme, des taux de change et des coûts réels constatés. Document à conserver pour comparaison avec le résultat final du programme.",
      contentW
    )
    doc.text(noteLines, marginX, y + 4)

    // === FOOTERS ===
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      setDraw(COLORS.slateLine)
      doc.setLineWidth(0.5)
      doc.line(marginX, pageH - 30, pageW - marginX, pageH - 30)
      setText(COLORS.mute)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.text(`${siteConfig.name} — ${programName}`, marginX, pageH - 16)
      doc.text(`Page ${i} / ${pageCount}`, pageW - marginX, pageH - 16, { align: "right" })
    }

    doc.save(`rapport-rentabilite-${slug}-${fileDate}.pdf`)
    toast({
      title: "Rapport téléchargé",
      description: "Rapport PDF de simulation enregistré — à conserver pour comparaison.",
    })
  }, [
    canRunSimulation,
    simulationPreview,
    formData,
    simIncludeAvion,
    simIncludeVisa,
    simPlan,
    simJoursMadina,
    simJoursMakkah,
    simAgentPlaces,
    simAgentCostPerPlaceDH,
    simAutresChargesDH,
    toast,
  ])

  // Charger les hôtels disponibles
  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const [madinaResponse, makkahResponse, autreResponse] = await Promise.all([
          fetch(api.url('/api/hotels/available?city=Madina')),
          fetch(api.url('/api/hotels/available?city=Makkah')),
          fetch(api.url('/api/hotels/available?city=Autre'))
        ]);

        if (!madinaResponse.ok || !makkahResponse.ok || !autreResponse.ok) {
          throw new Error('Erreur lors du chargement des hôtels');
        }

        const madinaHotels = await madinaResponse.json();
        const makkahHotels = await makkahResponse.json();
        const autreHotels = await autreResponse.json();

        console.log('Hôtels Madina chargés:', madinaHotels);
        console.log('Hôtels Makkah chargés:', makkahHotels);
        console.log('Hôtels Autre chargés:', autreHotels);

        setHotelsMadina(madinaHotels || []);
        setHotelsMakkah(makkahHotels || []);
        setHotelsAutreList(autreHotels || []);
      } catch (error) {
        console.error('Erreur:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les hôtels. Vérifiez que le serveur backend est démarré.',
          variant: 'destructive',
        });
        // Initialiser avec des tableaux vides en cas d'erreur
        setHotelsMadina([]);
        setHotelsMakkah([]);
        setHotelsAutreList([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHotels();
  }, [toast]);

  // Nouvelle fonction pour gérer la sélection d'un hôtel Madina
  const toggleHotelMadina = (hotelName: string) => {
    setFormData(prev => {
      const exists = prev.hotelsMadina.find(h => h.name === hotelName);
      if (exists) {
        return {
          ...prev,
          hotelsMadina: prev.hotelsMadina.filter(h => h.name !== hotelName)
        };
      } else {
        return {
          ...prev,
          hotelsMadina: [
            ...prev.hotelsMadina,
            {
              name: hotelName,
              chambres: {
                1: { nb: "", prix: "" },
                2: { nb: "", prix: "" },
                3: { nb: "", prix: "" },
                4: { nb: "", prix: "" },
                5: { nb: "", prix: "" },
              }
            }
          ]
        };
      }
    });
  }

  // Nouvelle fonction pour modifier les chambres/prix d'un hôtel Madina
  const handleChambreChangeMadina = (hotelName: string, type: number, field: 'nb' | 'prix', value: string) => {
    setFormData(prev => ({
      ...prev,
      hotelsMadina: prev.hotelsMadina.map(hotel =>
        hotel.name === hotelName
          ? {
              ...hotel,
              chambres: {
                ...hotel.chambres,
                [type]: {
                  ...hotel.chambres[type],
                  [field]: value
                }
              }
            }
          : hotel
      )
    }));
  }

  // Nouvelle fonction pour modifier les chambres/prix d'un hôtel Makkah
  const handleChambreChangeMakkah = (hotelName: string, type: number, field: 'nb' | 'prix', value: string) => {
    setFormData(prev => ({
      ...prev,
      hotelsMakkah: prev.hotelsMakkah.map(hotel =>
        hotel.name === hotelName
          ? {
              ...hotel,
              chambres: {
                ...hotel.chambres,
                [type]: {
                  ...hotel.chambres[type],
                  [field]: value
                }
              }
            }
          : hotel
      )
    }));
  }

  const toggleHotelMakkah = (hotelName: string) => {
    setFormData(prev => {
      const isSelected = prev.hotelsMakkah.some(hotel => hotel.name === hotelName);
      
      if (isSelected) {
        // Retirer l'hôtel
        return {
          ...prev,
          hotelsMakkah: prev.hotelsMakkah.filter(hotel => hotel.name !== hotelName)
        };
      } else {
        // Ajouter l'hôtel avec configuration par défaut
        return {
          ...prev,
          hotelsMakkah: [
            ...prev.hotelsMakkah,
            {
              name: hotelName,
              chambres: {
                1: { nb: "", prix: "" },
                2: { nb: "", prix: "" },
                3: { nb: "", prix: "" },
                4: { nb: "", prix: "" },
                5: { nb: "", prix: "" },
              }
            }
          ]
        };
      }
    });
  }

  // ----- Catégorie « Autre » -----
  const toggleHotelAutre = (hotelName: string) => {
    setFormData(prev => {
      const exists = prev.hotelsAutre.find(h => h.name === hotelName);
      if (exists) {
        return { ...prev, hotelsAutre: prev.hotelsAutre.filter(h => h.name !== hotelName) };
      }
      // Ordre par défaut = position d'ajout (séquence Turquie→X→Y)
      const nextOrdre = (prev.hotelsAutre.length + 1).toString();
      return {
        ...prev,
        hotelsAutre: [
          ...prev.hotelsAutre,
          {
            name: hotelName,
            nbJours: "",
            ordre: nextOrdre,
            chambres: {
              1: { nb: "", prix: "" },
              2: { nb: "", prix: "" },
              3: { nb: "", prix: "" },
              4: { nb: "", prix: "" },
              5: { nb: "", prix: "" },
            }
          }
        ]
      };
    });
  }

  const handleChambreChangeAutre = (hotelName: string, type: number, field: 'nb' | 'prix', value: string) => {
    setFormData(prev => ({
      ...prev,
      hotelsAutre: prev.hotelsAutre.map(hotel =>
        hotel.name === hotelName
          ? { ...hotel, chambres: { ...hotel.chambres, [type]: { ...hotel.chambres[type], [field]: value } } }
          : hotel
      )
    }));
  }

  // Modifier nbJours / ordre d'un hôtel Autre
  const handleAutreFieldChange = (hotelName: string, field: 'nbJours' | 'ordre', value: string) => {
    setFormData(prev => ({
      ...prev,
      hotelsAutre: prev.hotelsAutre.map(hotel =>
        hotel.name === hotelName ? { ...hotel, [field]: value } : hotel
      )
    }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid || isSubmitting) return

    setIsSubmitting(true)

    try {
      const programData = {
        name: formData.nom,
        nbJoursMadina: formData.nbJoursMadina ? parseInt(formData.nbJoursMadina) : 0,
        nbJoursMakkah: formData.nbJoursMakkah ? parseInt(formData.nbJoursMakkah) : 0,
        exchange: formData.exchange ? parseFloat(formData.exchange) : 1.0,
        prixAvionDH: formData.prixAvion ? parseFloat(formData.prixAvion) : 0,
        prixVisaRiyal: formData.prixVisaRiyal ? parseFloat(formData.prixVisaRiyal) : 0,
        profit: formData.profit ? parseFloat(formData.profit) : 0,
        profitEconomique: formData.profitEconomique ? parseFloat(formData.profitEconomique) : 0,
        profitNormal: formData.profitNormal ? parseFloat(formData.profitNormal) : 0,
        profitVIP: formData.profitVIP ? parseFloat(formData.profitVIP) : 0,
        visaDeadline: formData.datesLimites.visa,
        hotelDeadline: formData.datesLimites.hotels,
        flightDeadline: formData.datesLimites.billets,
        passportDeadline: formData.datesLimites.passport,
        hotelsMadina: formData.hotelsMadina,
        hotelsMakkah: formData.hotelsMakkah,
        hotelsAutre: formData.hotelsAutre.map(h => ({
          name: h.name,
          nbJours: h.nbJours ? parseInt(h.nbJours) : 0,
          ordre: h.ordre ? parseInt(h.ordre) : 0,
          chambres: h.chambres,
        }))
      }

      const response = await api.request(api.endpoints.programs, {
        method: 'POST',
        body: JSON.stringify(programData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erreur lors de la création du programme')
      }

      toast({
        title: 'Succès',
        description: 'Le programme a été créé avec succès',
      })

      // Enregistrement réussi : on neutralise le garde-fou « modifications non
      // enregistrées » (local + provider global) pour que la redirection ne
      // déclenche pas l'alerte navigateur « Changes you made may not be saved ».
      unsavedChanges?.clearDirty()

      // Redirection fiable vers le dashboard. On garde `isSubmitting` à true
      // (bouton désactivé) pendant la navigation pour éviter qu'un second clic
      // ne recrée un programme en double.
      router.push('/')
      router.refresh()
      window.location.href = '/'
      return
    } catch (error) {
      console.error('Erreur:', error)
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Une erreur est survenue lors de la création du programme',
        variant: 'destructive',
      })
      setIsSubmitting(false)
    }
  }

  const isFormValid = validateRequiredFields.length === 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 gap-6">
          {/* Colonne principale - Formulaire */}
          <div className="space-y-4">
            <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <CardTitle className="text-xl flex items-center gap-3">
                  <Sparkles className="h-6 w-6" />
                  Créer un nouveau programme
                </CardTitle>
                <CardDescription className="text-blue-100 space-y-2">
                  <span className="block">Configurez les détails du programme.</span>
                  <span className="block text-sm text-blue-50/95 leading-relaxed">
                    Bloc violet{" "}
                    <a
                      href="#simulation-rentabilite"
                      className="font-medium underline underline-offset-2 decoration-blue-200 hover:text-white"
                    >
                      Simulation de rentabilité (prévisionnel)
                    </a>
                    {" "}
                    : sous les sections Hôtels Madina et Makkah (faites défiler), ou cliquez ici pour y aller.
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <form onSubmit={handleSubmit}>
                  {/* Informations de base */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-xl border border-blue-200 mb-6">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Informations de base
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="nom" className="text-blue-700 font-medium flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Nom du programme *
                        </Label>
                        <Input
                          id="nom"
                          value={formData.nom}
                          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                          placeholder="Ex: Omra Ramadan 15/03 - 02/04"
                          className="h-12 border-2 border-blue-200 focus:border-blue-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dateCreation" className="text-blue-700 font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Date de création
                        </Label>
                        <div className="w-full flex items-center h-12 px-3 border-2 border-blue-200 rounded-lg bg-slate-50 text-slate-700 shadow-sm">
                          <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                          <span>{format(formData.dateCreation, "PPP", { locale: fr })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nouveaux champs ajoutés */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-xl border border-green-200 mb-6">
                    <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Détails financiers et durée
                    </h3>
                    
                    {/* Grille principale pour les champs standards.
                        (NB Jours Madina/Makkah ont été déplacés dans leurs onglets respectifs ci-dessous.) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                      <div className="space-y-2">
                        <Label htmlFor="exchange" className="text-green-700 font-medium flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Exchange *
                        </Label>
                        <Input
                          id="exchange"
                          type="number"
                          step="0.01"
                          value={formData.exchange}
                          onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                          placeholder="Ex: 2.80"
                          className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prixAvion" className="text-green-700 font-medium flex items-center gap-2">
                          <Plane className="h-4 w-4" />
                          Prix Avion (DH) *
                        </Label>
                        <Input
                          id="prixAvion"
                          type="number"
                          value={formData.prixAvion}
                          onChange={(e) => setFormData({ ...formData, prixAvion: e.target.value })}
                          placeholder="Ex: 7750"
                          className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prixVisaRiyal" className="text-green-700 font-medium flex items-center gap-2">
                          <BadgeCheck className="h-4 w-4" />
                          Prix Visa (Riyal) *
                        </Label>
                        <Input
                          id="prixVisaRiyal"
                          type="number"
                          value={formData.prixVisaRiyal}
                          onChange={(e) => setFormData({ ...formData, prixVisaRiyal: e.target.value })}
                          placeholder="Ex: 550"
                          className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                        />
                      </div>
                    </div>

                    {/* Section séparée pour les profits */}
                    <div className="border-t border-green-200 pt-6">
                      <h4 className="text-md font-semibold text-green-700 mb-4 flex items-center gap-2">
                        <PiggyBank className="h-5 w-5" />
                        Profits par plan
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="profitEconomique" className="text-green-700 font-medium flex items-center gap-2">
                            Profit Économique (DH) *
                          </Label>
                          <Input
                            id="profitEconomique"
                            type="number"
                            value={formData.profitEconomique}
                            onChange={(e) => setFormData({ ...formData, profitEconomique: e.target.value })}
                            placeholder="Ex: 1000"
                            className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="profitNormal" className="text-green-700 font-medium flex items-center gap-2">
                            Profit Normal (DH) *
                          </Label>
                          <Input
                            id="profitNormal"
                            type="number"
                            value={formData.profitNormal}
                            onChange={(e) => setFormData({ ...formData, profitNormal: e.target.value })}
                            placeholder="Ex: 1500"
                            className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="profitVIP" className="text-green-700 font-medium flex items-center gap-2">
                            Profit VIP (DH) *
                          </Label>
                          <Input
                            id="profitVIP"
                            type="number"
                            value={formData.profitVIP}
                            onChange={(e) => setFormData({ ...formData, profitVIP: e.target.value })}
                            placeholder="Ex: 2000"
                            className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hôtels — sélection par catégorie via onglets (Madina / Makkah / Autre) */}
                  <Tabs value={activeHotelTab} onValueChange={(v) => setActiveHotelTab(v as "madina" | "makkah" | "autre")} className="mb-6">
                    <TabsList className="grid w-full grid-cols-3 h-auto">
                      <TabsTrigger value="madina" className="data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-900">
                        🕌 Madina <span className="ml-1 font-semibold">[{madinaBedsCount}]</span>
                      </TabsTrigger>
                      <TabsTrigger value="makkah" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900">
                        🕋 Makkah <span className="ml-1 font-semibold">[{makkahBedsCount}]</span>
                      </TabsTrigger>
                      <TabsTrigger value="autre" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-900">
                        🏨 Autre <span className="ml-1 font-semibold">[{autreBedsCount}]</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="madina">
                    {/* Hôtels à Madina */}
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200 w-full">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-yellow-800 flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Hôtels à Madina
                        </h3>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="nbJoursMadina" className="text-yellow-800 font-medium text-sm whitespace-nowrap">
                            NB Jours Madina{formData.hotelsMadina.length > 0 ? " *" : ""}
                          </Label>
                          <Input
                            id="nbJoursMadina"
                            type="number"
                            min="0"
                            value={formData.nbJoursMadina}
                            onChange={(e) => setFormData({ ...formData, nbJoursMadina: e.target.value })}
                            placeholder="Ex: 4"
                            className="h-9 w-20 text-center border-2 border-yellow-200 focus:border-yellow-500 rounded-lg bg-white/80"
                          />
                        </div>
                        <div className="text-xs md:text-sm font-semibold text-yellow-900 bg-yellow-200/70 px-3 py-1.5 rounded-full">
                          {madinaBedsCount} lits
                        </div>
                      </div>
                      <div className="flex flex-col gap-4">
                        {hotelsMadina.length === 0 ? (
                          <div className="text-center py-4 text-gray-500">
                            <p>Aucun hôtel trouvé pour Madina.</p>
                            <p className="text-sm">Vous pouvez ajouter un hôtel personnalisé ci-dessous.</p>
                          </div>
                        ) : (
                          hotelsMadina.map((hotel, index) => {
                            const selected = formData.hotelsMadina.some(h => h.name === hotel.name);
                            return (
                              <div key={index} className="border border-yellow-200 rounded-lg p-3 bg-white/70">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox
                                    checked={selected}
                                    onCheckedChange={() => toggleHotelMadina(hotel.name)}
                                    className="data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                                  />
                                  <span className="text-sm font-medium text-yellow-800">{hotel.name}</span>
                                </label>
                                {selected && (
                                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                    {[1,2,3,4,5].map(type => (
                                      <div key={type} className="bg-white border border-yellow-200 rounded-lg p-4 shadow-sm">
                                        {/* Icônes de personnes */}
                                        <div className="text-center mb-3">
                                          <div className="flex items-center justify-center gap-1 mb-2">
                                            {Array.from({ length: type }, (_, i) => (
                                              <div key={i} className="w-6 h-6 flex items-center justify-center">
                                                <User className="w-5 h-5 text-yellow-600" />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                        
                                        {/* Compteur de chambres */}
                                        <div className="mb-3">
                                          <div className="text-sm text-yellow-700 mb-2 text-center font-semibold">Chambres</div>
                                          <div className="flex justify-center">
                                            <div className="inline-flex items-center bg-gray-50 border border-yellow-300 rounded-lg">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 hover:bg-yellow-100 text-yellow-600 border-r border-yellow-200 rounded-l-lg"
                                                onClick={() => {
                                                  const currentValue = parseInt(formData.hotelsMadina.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0");
                                                  const newValue = Math.max(0, currentValue - 1);
                                                  handleChambreChangeMadina(hotel.name, type, 'nb', newValue.toString());
                                                }}
                                              >
                                                <span className="text-sm font-semibold">−</span>
                                              </Button>
                                              <div className="h-8 w-10 flex items-center justify-center text-sm font-semibold text-yellow-800 bg-white">
                                                {formData.hotelsMadina.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0"}
                                              </div>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 hover:bg-yellow-100 text-yellow-600 border-l border-yellow-200 rounded-r-lg"
                                                onClick={() => {
                                                  const currentValue = parseInt(formData.hotelsMadina.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0");
                                                  const newValue = currentValue + 1;
                                                  handleChambreChangeMadina(hotel.name, type, 'nb', newValue.toString());
                                                }}
                                              >
                                                <span className="text-sm font-semibold">+</span>
                                              </Button>
                                            </div>
                                          </div>
                                          
                                          {/* Icônes de chambres */}
                                          <div className="mt-2 flex justify-center">
                                            <div className="flex flex-wrap items-center gap-1 max-w-32">
                                              {Array.from({ length: parseInt(formData.hotelsMadina.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0") }, (_, i) => (
                                                <div key={i} className="w-4 h-4 text-yellow-600">
                                                  <Bed className="w-4 h-4" />
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Prix */}
                                        <div>
                                          <div className="text-sm text-yellow-700 mb-2 text-center font-semibold">Prix (Riyal)</div>
                                          <Input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={formData.hotelsMadina.find(h => h.name === hotel.name)?.chambres[type]?.prix || ""}
                                            onChange={e => handleChambreChangeMadina(hotel.name, type, 'prix', e.target.value)}
                                            className="h-9 w-full text-center border-yellow-300 focus:border-yellow-500 text-sm"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        {/* Option Autre */}
                        <div className="border border-yellow-200 rounded-lg p-3 bg-white/70 mt-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={showAutreMadinaInput}
                              onCheckedChange={() => setShowAutreMadinaInput((v) => !v)}
                              className="data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                            />
                            <span className="text-sm font-medium text-yellow-800">Autre</span>
                          </label>
                          {showAutreMadinaInput && (
                            <div className="mt-2 flex gap-2 items-center">
                              <Input
                                type="text"
                                placeholder="Nom de l'hôtel"
                                value={autreHotelMadina}
                                onChange={e => setAutreHotelMadina(e.target.value)}
                                className="h-9 border-2 border-yellow-200 focus:border-yellow-400 rounded-lg text-sm"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                                onClick={() => {
                                  const trimmed = autreHotelMadina.trim();
                                  if (trimmed && !formData.hotelsMadina.some(h => h.name === trimmed)) {
                                    // Ajouter l'hôtel à la liste des hôtels disponibles
                                    const newHotel = {
                                      id: Date.now(), // ID unique
                                      name: trimmed,
                                      city: 'Madina' as const
                                    };
                                    setHotelsMadina(prev => [...prev, newHotel]);
                                    
                                    // Ajouter l'hôtel aux hôtels sélectionnés avec configuration
                                    setFormData(prev => ({
                                      ...prev,
                                      hotelsMadina: [
                                        ...prev.hotelsMadina,
                                        {
                                          name: trimmed,
                                          chambres: {
                                            1: { nb: "", prix: "" },
                                            2: { nb: "", prix: "" },
                                            3: { nb: "", prix: "" },
                                            4: { nb: "", prix: "" },
                                          }
                                        }
                                      ]
                                    }));
                                    setAutreHotelMadina("");
                                    setShowAutreMadinaInput(false);
                                  }
                                }}
                                disabled={!autreHotelMadina.trim() || formData.hotelsMadina.some(h => h.name === autreHotelMadina.trim())}
                              >
                                Ajouter
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    </TabsContent>

                    <TabsContent value="makkah">
                    {/* Hôtels à Makkah */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Hôtels à Makkah
                        </h3>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="nbJoursMakkah" className="text-blue-800 font-medium text-sm whitespace-nowrap">
                            NB Jours Makkah{formData.hotelsMakkah.length > 0 ? " *" : ""}
                          </Label>
                          <Input
                            id="nbJoursMakkah"
                            type="number"
                            min="0"
                            value={formData.nbJoursMakkah}
                            onChange={(e) => setFormData({ ...formData, nbJoursMakkah: e.target.value })}
                            placeholder="Ex: 15"
                            className="h-9 w-20 text-center border-2 border-blue-200 focus:border-blue-500 rounded-lg bg-white/80"
                          />
                        </div>
                        <div className="text-xs md:text-sm font-semibold text-blue-900 bg-blue-200/70 px-3 py-1.5 rounded-full">
                          {makkahBedsCount} lits
                        </div>
                      </div>

                      <div className="space-y-3">
                        {hotelsMakkah.length === 0 ? (
                          <div className="text-center py-4 text-gray-500">
                            <p>Aucun hôtel trouvé pour Makkah.</p>
                            <p className="text-sm">Vous pouvez ajouter un hôtel personnalisé ci-dessous.</p>
                          </div>
                        ) : (
                          hotelsMakkah.map((hotel, index) => {
                            const isSelected = formData.hotelsMakkah.some(h => h.name === hotel.name);
                            return (
                              <div key={index} className="space-y-2">
                                <label className="flex items-center space-x-2 p-3 rounded-lg border border-blue-200 hover:bg-blue-50 transition-all cursor-pointer">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleHotelMakkah(hotel.name)}
                                    className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                  />
                                  <span className="text-sm font-medium text-blue-800">{hotel.name}</span>
                                </label>
                                
                                {/* Configuration des chambres - affichage direct comme pour Madina */}
                                {isSelected && (
                                  <div className="bg-white rounded-lg border border-blue-200 p-4 ml-6">
                                    <h5 className="text-sm font-semibold text-blue-800 mb-3">{hotel.name}</h5>
                                    
                                                                  {/* Types de chambres */}
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {[1, 2, 3, 4, 5].map((type) => (
                                        <div key={type} className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                                          {/* Icône de personne */}
                                          <div className="flex justify-center mb-2">
                                            <div className="flex items-center gap-1">
                                              {Array.from({ length: type }, (_, i) => (
                                                <User key={i} className="w-4 h-4 text-blue-600" />
                                              ))}
                                            </div>
                                          </div>
                                          
                                          {/* Compteur de chambres */}
                                          <div className="mb-3">
                                            <div className="text-sm text-blue-700 mb-2 text-center font-semibold">Chambres</div>
                                            <div className="flex justify-center">
                                              <div className="inline-flex items-center bg-gray-50 border border-blue-300 rounded-lg">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 hover:bg-blue-100 text-blue-600 border-r border-blue-200 rounded-l-lg"
                                                  onClick={() => {
                                                    const currentValue = parseInt(formData.hotelsMakkah.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0");
                                                    const newValue = Math.max(0, currentValue - 1);
                                                    handleChambreChangeMakkah(hotel.name, type, 'nb', newValue.toString());
                                                  }}
                                                >
                                                  <span className="text-sm font-semibold">−</span>
                                                </Button>
                                                <div className="h-8 w-10 flex items-center justify-center text-sm font-semibold text-blue-800 bg-white">
                                                  {formData.hotelsMakkah.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0"}
                                                </div>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 hover:bg-blue-100 text-blue-600 border-l border-blue-200 rounded-r-lg"
                                                  onClick={() => {
                                                    const currentValue = parseInt(formData.hotelsMakkah.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0");
                                                    const newValue = currentValue + 1;
                                                    handleChambreChangeMakkah(hotel.name, type, 'nb', newValue.toString());
                                                  }}
                                                >
                                                  <span className="text-sm font-semibold">+</span>
                                                </Button>
                                              </div>
                                            </div>
                                            
                                            {/* Icônes de chambres */}
                                            <div className="mt-2 flex justify-center">
                                              <div className="flex flex-wrap items-center gap-1 max-w-32">
                                                {Array.from({ length: parseInt(formData.hotelsMakkah.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0") }, (_, i) => (
                                                  <div key={i} className="w-4 h-4 text-blue-600">
                                                    <Bed className="w-4 h-4" />
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {/* Prix */}
                                          <div>
                                            <div className="text-sm text-blue-700 mb-2 text-center font-semibold">Prix (Riyal)</div>
                                            <Input
                                              type="number"
                                              min="0"
                                              placeholder="0"
                                              value={formData.hotelsMakkah.find(h => h.name === hotel.name)?.chambres[type]?.prix || ""}
                                              onChange={e => handleChambreChangeMakkah(hotel.name, type, 'prix', e.target.value)}
                                              className="h-9 w-full text-center border-blue-300 focus:border-blue-500 text-sm"
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        {/* Option Autre */}
                        <div className="border border-blue-200 rounded-lg p-3 bg-white/70 mt-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={showAutreMakkahInput}
                              onCheckedChange={() => setShowAutreMakkahInput((v) => !v)}
                              className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                            />
                            <span className="text-sm font-medium text-blue-800">Autre</span>
                          </label>
                          {showAutreMakkahInput && (
                            <div className="mt-2 flex gap-2 items-center">
                              <Input
                                type="text"
                                placeholder="Nom de l'hôtel"
                                value={autreHotelMakkah}
                                onChange={e => setAutreHotelMakkah(e.target.value)}
                                className="h-9 border-2 border-blue-200 focus:border-blue-400 rounded-lg text-sm"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                                onClick={() => {
                                  const trimmed = autreHotelMakkah.trim();
                                  if (trimmed && !formData.hotelsMakkah.some(h => h.name === trimmed)) {
                                    // Ajouter l'hôtel à la liste des hôtels disponibles
                                    const newHotel = {
                                      id: Date.now(), // ID unique
                                      name: trimmed,
                                      city: 'Makkah' as const
                                    };
                                    setHotelsMakkah(prev => [...prev, newHotel]);

                                    // Ajouter l'hôtel aux hôtels sélectionnés avec configuration
                                    setFormData(prev => ({
                                      ...prev,
                                      hotelsMakkah: [
                                        ...prev.hotelsMakkah,
                                        {
                                          name: trimmed,
                                          chambres: {
                                            1: { nb: "", prix: "" },
                                            2: { nb: "", prix: "" },
                                            3: { nb: "", prix: "" },
                                            4: { nb: "", prix: "" },
                                          }
                                        }
                                      ]
                                    }));
                                    setAutreHotelMakkah("");
                                    setShowAutreMakkahInput(false);
                                  }
                                }}
                                disabled={!autreHotelMakkah.trim() || formData.hotelsMakkah.some(h => h.name === autreHotelMakkah.trim())}
                              >
                                Ajouter
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    </TabsContent>

                    <TabsContent value="autre">
                    {/* Hôtels Autre (N hôtels génériques : ex. Turquie → ville X → ville Y) */}
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl border border-emerald-200">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Hôtels Autre
                        </h3>
                        <div className="text-xs md:text-sm font-semibold text-emerald-900 bg-emerald-200/70 px-3 py-1.5 rounded-full">
                          {autreBedsCount} lits
                        </div>
                      </div>
                      <div className="flex flex-col gap-4">
                        {hotelsAutreList.length === 0 ? (
                          <div className="text-center py-4 text-gray-500">
                            <p>Aucun hôtel « Autre » trouvé.</p>
                            <p className="text-sm">Créez-en via la page Hôtels (ville « Autre »), ou ajoutez-en un ci-dessous.</p>
                          </div>
                        ) : (
                          hotelsAutreList.map((hotel, index) => {
                            const selected = formData.hotelsAutre.some(h => h.name === hotel.name);
                            const current = formData.hotelsAutre.find(h => h.name === hotel.name);
                            return (
                              <div key={index} className="border border-emerald-200 rounded-lg p-3 bg-white/70">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox
                                    checked={selected}
                                    onCheckedChange={() => toggleHotelAutre(hotel.name)}
                                    className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                  />
                                  <span className="text-sm font-medium text-emerald-800">{hotel.name}</span>
                                </label>
                                {selected && (
                                  <>
                                    <div className="mt-3 max-w-xs">
                                      <div className="text-xs text-emerald-700 mb-1 font-semibold text-center">Nb de nuits *</div>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="Ex: 3"
                                        value={current?.nbJours || ""}
                                        onChange={e => handleAutreFieldChange(hotel.name, 'nbJours', e.target.value)}
                                        className="h-9 w-full text-center border-emerald-300 focus:border-emerald-500 text-sm"
                                      />
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                      {[1,2,3,4,5].map(type => (
                                        <div key={type} className="bg-white border border-emerald-200 rounded-lg p-4 shadow-sm">
                                          <div className="text-center mb-3">
                                            <div className="flex items-center justify-center gap-1 mb-2">
                                              {Array.from({ length: type }, (_, i) => (
                                                <div key={i} className="w-6 h-6 flex items-center justify-center">
                                                  <User className="w-5 h-5 text-emerald-600" />
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          <div className="mb-3">
                                            <div className="text-sm text-emerald-700 mb-2 text-center font-semibold">Chambres</div>
                                            <div className="flex justify-center">
                                              <div className="inline-flex items-center bg-gray-50 border border-emerald-300 rounded-lg">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 hover:bg-emerald-100 text-emerald-600 border-r border-emerald-200 rounded-l-lg"
                                                  onClick={() => {
                                                    const currentValue = parseInt(formData.hotelsAutre.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0");
                                                    const newValue = Math.max(0, currentValue - 1);
                                                    handleChambreChangeAutre(hotel.name, type, 'nb', newValue.toString());
                                                  }}
                                                >
                                                  <span className="text-sm font-semibold">−</span>
                                                </Button>
                                                <div className="h-8 w-10 flex items-center justify-center text-sm font-semibold text-emerald-800 bg-white">
                                                  {formData.hotelsAutre.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0"}
                                                </div>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 hover:bg-emerald-100 text-emerald-600 border-l border-emerald-200 rounded-r-lg"
                                                  onClick={() => {
                                                    const currentValue = parseInt(formData.hotelsAutre.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0");
                                                    const newValue = currentValue + 1;
                                                    handleChambreChangeAutre(hotel.name, type, 'nb', newValue.toString());
                                                  }}
                                                >
                                                  <span className="text-sm font-semibold">+</span>
                                                </Button>
                                              </div>
                                            </div>
                                            <div className="mt-2 flex justify-center">
                                              <div className="flex flex-wrap items-center gap-1 max-w-32">
                                                {Array.from({ length: parseInt(formData.hotelsAutre.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0") }, (_, i) => (
                                                  <div key={i} className="w-4 h-4 text-emerald-600">
                                                    <Bed className="w-4 h-4" />
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-emerald-700 mb-2 text-center font-semibold">Prix (Riyal)</div>
                                            <Input
                                              type="number"
                                              min="0"
                                              placeholder="0"
                                              value={formData.hotelsAutre.find(h => h.name === hotel.name)?.chambres[type]?.prix || ""}
                                              onChange={e => handleChambreChangeAutre(hotel.name, type, 'prix', e.target.value)}
                                              className="h-9 w-full text-center border-emerald-300 focus:border-emerald-500 text-sm"
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })
                        )}
                        {/* Ajouter un hôtel Autre à la volée */}
                        <div className="border border-emerald-200 rounded-lg p-3 bg-white/70 mt-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={showAutreAutreInput}
                              onCheckedChange={() => setShowAutreAutreInput((v) => !v)}
                              className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                            />
                            <span className="text-sm font-medium text-emerald-800">Ajouter un hôtel</span>
                          </label>
                          {showAutreAutreInput && (
                            <div className="mt-2 flex gap-2 items-center">
                              <Input
                                type="text"
                                placeholder="Nom de l'hôtel"
                                value={autreHotelAutre}
                                onChange={e => setAutreHotelAutre(e.target.value)}
                                className="h-9 border-2 border-emerald-200 focus:border-emerald-400 rounded-lg text-sm"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded"
                                onClick={() => {
                                  const trimmed = autreHotelAutre.trim();
                                  if (trimmed && !formData.hotelsAutre.some(h => h.name === trimmed)) {
                                    const newHotel = { id: Date.now(), name: trimmed, city: 'Autre' as const };
                                    setHotelsAutreList(prev => [...prev, newHotel]);
                                    const nextOrdre = (formData.hotelsAutre.length + 1).toString();
                                    setFormData(prev => ({
                                      ...prev,
                                      hotelsAutre: [
                                        ...prev.hotelsAutre,
                                        {
                                          name: trimmed,
                                          nbJours: "",
                                          ordre: nextOrdre,
                                          chambres: {
                                            1: { nb: "", prix: "" },
                                            2: { nb: "", prix: "" },
                                            3: { nb: "", prix: "" },
                                            4: { nb: "", prix: "" },
                                            5: { nb: "", prix: "" },
                                          }
                                        }
                                      ]
                                    }));
                                    setAutreHotelAutre("");
                                    setShowAutreAutreInput(false);
                                  }
                                }}
                                disabled={!autreHotelAutre.trim() || formData.hotelsAutre.some(h => h.name === autreHotelAutre.trim())}
                              >
                                Ajouter
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    </TabsContent>
                  </Tabs>

                  {/* Simulation : après infos de base, financier et hôtels — champs désactivés tant que les prérequis ne sont pas remplis */}
                  <div
                    id="simulation-rentabilite"
                    className={`scroll-mt-24 bg-gradient-to-br from-violet-50 to-indigo-100 p-6 rounded-xl border border-violet-200 mb-6 ring-1 ring-violet-200/50 ${!canRunSimulation ? "opacity-95" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-violet-900 flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        Simulation de rentabilité (prévisionnel)
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-violet-300 text-violet-900 hover:bg-violet-100"
                          onClick={() => setShowSimulationSection((prev) => !prev)}
                        >
                          {showSimulationSection ? "Masquer" : "Afficher"}
                        </Button>
                        {showSimulationSection && canRunSimulation && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-violet-300 text-violet-900 hover:bg-violet-100"
                            onClick={downloadSimulationReport}
                          >
                            <Download className="h-4 w-4 mr-1.5" />
                            Télécharger
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-violet-800/90 mb-4 flex gap-2 items-start">
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        Remplissez d&apos;abord le nom du programme, les détails financiers (exchange, jours, avion, visa),
                        puis sélectionnez les hôtels Madina et Makkah avec au moins une chambre (nombre et prix en Riyal).
                        Ensuite, ajustez les hypothèses ci-dessous (même logique que « Nouvelle réservation » pour le prix).
                        Le total paiement prévu correspond aux voyageurs payants ; le total charges inclut le coût agence
                        (vol + hôtel + visa, sans marge) pour tous les voyageurs de la capacité simulée, plus les charges
                        agents et les autres charges saisies.
                      </span>
                    </p>

                    {!canRunSimulation && showSimulationSection && (
                      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                        <p className="font-semibold mb-2">Complétez le formulaire ci-dessus pour activer la simulation :</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Nom du programme</li>
                          <li>Exchange, NB jours Madina et Makkah, prix avion (DH) et visa (Riyal)</li>
                          <li>Au moins un hôtel à Madina et un à Makkah</li>
                          <li>Pour chaque ville : au moins une ligne chambre avec nombre de chambres et prix (Riyal) renseignés</li>
                        </ul>
                      </div>
                    )}

                    {showSimulationSection && (
                    <>
                    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 ${!canRunSimulation ? "pointer-events-none opacity-55" : ""}`}>
                      <div className="space-y-4 rounded-lg border border-violet-200 bg-white/70 p-4">
                        <p className="text-sm font-semibold text-violet-900">Hypothèses de calcul</p>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 text-sm text-violet-900 cursor-pointer">
                            <Checkbox
                              checked={simIncludeAvion}
                              disabled={!canRunSimulation}
                              onCheckedChange={(c) => setSimIncludeAvion(!!c)}
                              className="data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                            />
                            Inclure le prix avion (DH)
                          </label>
                          <label className="flex items-center gap-2 text-sm text-violet-900 cursor-pointer">
                            <Checkbox
                              checked={simIncludeVisa}
                              disabled={!canRunSimulation}
                              onCheckedChange={(c) => setSimIncludeVisa(!!c)}
                              className="data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                            />
                            Inclure le visa (Riyal → DH)
                          </label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-violet-800 text-sm">Plan tarifaire</Label>
                            <Select
                              value={simPlan}
                              disabled={!canRunSimulation}
                              onValueChange={(v) => setSimPlan(v as "Économique" | "Normal" | "VIP")}
                            >
                              <SelectTrigger className="border-violet-200 bg-white">
                                <SelectValue placeholder="Plan" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Économique">Économique</SelectItem>
                                <SelectItem value="Normal">Normal</SelectItem>
                                <SelectItem value="VIP">VIP</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-violet-800 text-sm">Jours Madina / Makkah (simulation)</Label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                min={0}
                                disabled={!canRunSimulation}
                                placeholder={formData.nbJoursMadina || "Madina"}
                                value={simJoursMadina}
                                onChange={(e) => setSimJoursMadina(e.target.value)}
                                className="border-violet-200"
                              />
                              <Input
                                type="number"
                                min={0}
                                disabled={!canRunSimulation}
                                placeholder={formData.nbJoursMakkah || "Makkah"}
                                value={simJoursMakkah}
                                onChange={(e) => setSimJoursMakkah(e.target.value)}
                                className="border-violet-200"
                              />
                            </div>
                            <p className="text-xs text-violet-700/80">Vide = reprend les champs « NB Jours » du formulaire.</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 rounded-lg border border-violet-200 bg-white/70 p-4">
                        <p className="text-sm font-semibold text-violet-900">Agents (non payants) & autres charges</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="simAgentPlaces" className="text-violet-800 text-sm">
                              Places agents (sans paiement client)
                            </Label>
                            <Input
                              id="simAgentPlaces"
                              type="number"
                              min={0}
                              disabled={!canRunSimulation}
                              value={simAgentPlaces}
                              onChange={(e) => setSimAgentPlaces(e.target.value)}
                              placeholder="0"
                              className="border-violet-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="simAgentCost" className="text-violet-800 text-sm">
                              Charge par place agent (DH)
                            </Label>
                            <Input
                              id="simAgentCost"
                              type="number"
                              min={0}
                              step="0.01"
                              disabled={!canRunSimulation}
                              value={simAgentCostPerPlaceDH}
                              onChange={(e) => setSimAgentCostPerPlaceDH(e.target.value)}
                              placeholder="Ex: coût réel / place"
                              className="border-violet-200"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="simAutres" className="text-violet-800 text-sm">
                            Autres charges fixes prévisionnelles (DH)
                          </Label>
                          <Input
                            id="simAutres"
                            type="number"
                            min={0}
                            step="0.01"
                            disabled={!canRunSimulation}
                            value={simAutresChargesDH}
                            onChange={(e) => setSimAutresChargesDH(e.target.value)}
                            placeholder="0"
                            className="border-violet-200"
                          />
                        </div>
                      </div>
                    </div>

                    {canRunSimulation && simulationPreview.agentOver && (
                      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
                        Le nombre de places agents dépasse la capacité simulée ({simulationPreview.totalTravelersMax}). La
                        valeur est plafonnée pour le calcul.
                      </p>
                    )}

                    <div className={`rounded-xl border border-violet-200 bg-white/90 overflow-hidden ${!canRunSimulation ? "opacity-60" : ""}`}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-violet-100">
                        <div className="bg-white p-4">
                          <p className="text-xs text-violet-700">Capacité (voyageurs)</p>
                          <p className="text-xl font-bold text-violet-950">
                            {canRunSimulation ? simulationPreview.totalTravelersMax : "—"}
                          </p>
                        </div>
                        <div className="bg-white p-4">
                          <p className="text-xs text-violet-700">Total paiement prévu</p>
                          <p className="text-xl font-bold text-violet-950">
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.revenueAfterAgentsDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </p>
                          <p className="text-[11px] text-violet-600 mt-1 leading-snug">
                            Encaissements des places payantes (hypothèses + détail par type ci-dessous).
                          </p>
                        </div>
                        <div className="bg-white p-4">
                          <p className="text-xs text-violet-700">Total charges</p>
                          <p className="text-xl font-bold text-violet-950">
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.totalChargesDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </p>
                          <p className="text-[11px] text-violet-600 mt-1 leading-snug">
                            Coût vol+hôtel+visa (tous voyageurs) + charges agents + autres charges.
                          </p>
                        </div>
                        <div className="bg-white p-4">
                          <p className="text-xs text-violet-700">Gain net prévu</p>
                          <p
                            className={`text-xl font-bold ${
                              !canRunSimulation
                                ? "text-violet-400"
                                : simulationPreview.resultatPrevDh >= 0
                                  ? "text-emerald-700"
                                  : "text-red-700"
                            }`}
                          >
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.resultatPrevDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </p>
                          <p className="text-[11px] text-violet-600 mt-1 leading-snug">
                            Total paiement prévu − total charges (coût voyage inclus).
                          </p>
                        </div>
                      </div>
                      <div className="px-4 py-3 border-t border-violet-100 text-sm text-violet-800 space-y-1">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span>Places payantes (après agents)</span>
                          <span className="font-medium">
                            {canRunSimulation ? simulationPreview.payingTravelers : "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <span>Places agents (non payantes)</span>
                          <span className="font-medium">
                            {canRunSimulation ? simulationPreview.agentPlaces : "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <span>Réf. CA si capacité pleine et tous payants</span>
                          <span className="font-medium">
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.revenueIfAllPayDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <span>Coût agence vol (tous les voyageurs)</span>
                          <span className="font-medium">
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.costVolAllTravelersDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <span>Coût agence hôtel (tous les voyageurs)</span>
                          <span className="font-medium">
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.costHotelsAllTravelersDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <span>Coût agence visa (tous les voyageurs)</span>
                          <span className="font-medium">
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.costVisaAllTravelersDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <span>Charges agents (saisies)</span>
                          <span className="font-medium">
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.agentChargesTotalDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <span>Autres charges (saisies)</span>
                          <span className="font-medium">
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.autresChargesDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2 pt-1 border-t border-violet-100/80 font-semibold text-violet-950">
                          <span>Total charges</span>
                          <span>
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.totalChargesDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </span>
                        </div>
                        <p className="text-xs text-violet-600 pt-2">
                          {canRunSimulation ? (
                            <>
                              Change utilisé : {simulationPreview.exchange} · Jours Madina / Makkah :{" "}
                              {simulationPreview.joursMadinaEff} / {simulationPreview.joursMakkahEff}
                            </>
                          ) : (
                            "Renseignez les champs requis pour afficher le détail."
                          )}
                        </p>
                      </div>
                    </div>

                    {canRunSimulation && simulationPreview.byType.length > 0 ? (
                      <div className="mt-4 overflow-x-auto rounded-lg border border-violet-200 bg-white/80">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-violet-100 text-left text-violet-800">
                              <th className="p-2 font-medium">Type chambre</th>
                              <th className="p-2 font-medium">Places (min Madina/Makkah)</th>
                              <th className="p-2 font-medium">Prix / pers. (DH)</th>
                              <th className="p-2 font-medium">Sous-total (DH)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {simulationPreview.byType.map((row) => (
                              <tr key={row.typeKey} className="border-b border-violet-50">
                                <td className="p-2">{row.label}</td>
                                <td className="p-2">{row.places}</td>
                                <td className="p-2">{row.unitDh.toLocaleString("fr-FR")}</td>
                                <td className="p-2 font-medium">{Math.round(row.subtotalDh).toLocaleString("fr-FR")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-violet-700 bg-white/60 border border-violet-100 rounded-lg px-3 py-2">
                        {canRunSimulation
                          ? "Aucune capacité simulée avec la configuration actuelle (vérifiez les types de chambre des deux côtés)."
                          : "Les montants et le tableau détaillé s’affichent une fois les prérequis remplis (voir encadré orange)."}
                      </p>
                    )}
                    </>
                    )}
                  </div>

                  {/* Dates limites */}
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                    <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Dates limites
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {([
                        { key: "passport", label: "Date limite passeport", color: "purple" },
                        { key: "visa", label: "Date limite visa", color: "red" },
                        { key: "billets", label: "Date limite billets", color: "green" },
                        { key: "hotels", label: "Date limite hôtels", color: "blue" },                        
                        
                      ] as const).map((item) => {
                        type Key = "visa" | "hotels" | "billets" | "passport";
                        const key = item.key as Key;
                        const dateValue = formData.datesLimites[key];
                        const selectedDate: Date | undefined = dateValue ?? undefined;
                        return (
                          <div key={item.key} className="space-y-2">
                            <Label className="text-orange-700 font-medium text-sm">{item.label} *</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal h-10 border-2 border-orange-200 hover:border-orange-300 rounded-lg text-sm"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 text-orange-500" />
                                  {dateValue ? (
                                    format(dateValue, "PPP", { locale: fr })
                                  ) : (
                                    <span>Sélectionner une date</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 shadow-xl border-0">
                                <CalendarComponent
                                  mode="single"
                                  selected={selectedDate}
                                  onSelect={(date) =>
                                    setFormData({
                                      ...formData,
                                      datesLimites: { ...formData.datesLimites, [key]: date },
                                    })
                                  }
                                  initialFocus
                                  className="rounded-lg"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex flex-col gap-3 mt-8">
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!isFormValid || isSubmitting}
                        className="flex-1 h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Enregistrement…
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-5 w-5" />
                            Enregistrer le programme
                          </>
                        )}
                      </Button>
                      <Link href="/programmes" className="flex-1">
                        <Button
                          variant="outline"
                          className="w-full h-12 border-2 border-gray-300 hover:border-gray-400"
                          onClick={(e) => {
                            if (!hasUnsavedChanges || isSubmitting) return
                            const shouldLeave = window.confirm(
                              "Vous avez des modifications non enregistrees. Quitter sans enregistrer ?"
                            )
                            if (!shouldLeave) e.preventDefault()
                          }}
                        >
                          <ArrowLeft className="mr-2 h-5 w-5" />
                          Annuler
                        </Button>
                      </Link>
                    </div>
                    {!isFormValid && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold">
                            Enregistrer le programme est desactive ({validateRequiredFields.length} raison(s)).
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-900 hover:bg-red-100"
                            onClick={() => setShowValidationReasons((prev) => !prev)}
                          >
                            {showValidationReasons ? "Masquer les raisons" : "Voir les raisons"}
                          </Button>
                        </div>
                        {showValidationReasons && (
                          <ul className="list-disc pl-5 space-y-1 mt-2">
                            {validateRequiredFields.map((reason, idx) => (
                              <li key={`${reason}-${idx}`}>{reason}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Colonne droite - Récapitulatif */}
          {/* 
          <div className="space-y-4">
            <Card
              className={`border-0 shadow-xl transition-all ${isFormValid ? "bg-gradient-to-br from-green-50 to-green-100 border-green-200" : "bg-white"}`}
            >
              <CardHeader
                className={`${isFormValid ? "bg-gradient-to-r from-green-600 to-green-700" : "bg-gradient-to-r from-gray-600 to-gray-700"} text-white rounded-t-xl`}
              >
                <CardTitle className="text-lg flex items-center gap-2">
                  {isFormValid ? <CheckCircle className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                  Récapitulatif
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Nom:</span>
                    <span className="font-medium text-xs">{formData.nom || "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Date création:</span>
                    <span className="font-medium text-xs">
                      {formData.dateCreation
                        ? format(formData.dateCreation, "dd/MM/yyyy", { locale: fr })
                        : "Non définie"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Jours Madina:</span>
                    <span className="font-medium text-xs">{formData.nbJoursMadina || "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Jours Makkah:</span>
                    <span className="font-medium text-xs">{formData.nbJoursMakkah || "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Exchange:</span>
                    <span className="font-medium text-xs">{formData.exchange || "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Prix Avion:</span>
                    <span className="font-medium text-xs">{formData.prixAvion ? `${formData.prixAvion} DH` : "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Prix Visa:</span>
                    <span className="font-medium text-xs">{formData.prixVisaRiyal ? `${formData.prixVisaRiyal} Riyal` : "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Profit:</span>
                    <span className="font-medium text-xs">{formData.profit ? `${formData.profit} DH` : "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Hôtels Madina:</span>
                    <span className="font-medium text-xs">{formData.hotelsMadina.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Hôtels Makkah:</span>
                    <span className="font-medium text-xs">{formData.hotelsMakkah.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Dates limites:</span>
                    <span className="font-medium text-xs">
                      {Object.values(formData.datesLimites).filter(Boolean).length}/4
                    </span>
                  </div>
                </div>

                {(formData.hotelsMadina.length > 0 || formData.hotelsMakkah.length > 0) && (
                  <div className="border-t pt-3 space-y-2">
                    {formData.hotelsMadina.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-yellow-700 mb-1">Madina:</p>
                        <div className="flex flex-wrap gap-1">
                          {formData.hotelsMadina.slice(0, 2).map((hotel, index) => (
                            <span key={index} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                              {hotel.name}
                            </span>
                          ))}
                          {formData.hotelsMadina.length > 2 && (
                            <span className="text-xs text-gray-500">+{formData.hotelsMadina.length - 2}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {formData.hotelsMakkah.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-blue-700 mb-1">Makkah:</p>
                        <div className="flex flex-wrap gap-1">
                          {formData.hotelsMakkah.slice(0, 2).map((hotel, index) => (
                            <span key={index} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {hotel}
                            </span>
                          ))}
                          {formData.hotelsMakkah.length > 2 && (
                            <span className="text-xs text-gray-500">+{formData.hotelsMakkah.length - 2}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white">
              <CardContent className="p-4 space-y-3">
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isFormValid || isSubmitting}
                  className="w-full h-11 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Enregistrer le programme
                    </>
                  )}
                </Button>
                <Link href="/programmes">
                  <Button variant="outline" className="w-full h-11 border-2 border-gray-300 hover:border-gray-400">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Annuler
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
          */}
        </div>
      </div>
    </div>
  )
}
