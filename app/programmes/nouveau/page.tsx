"use client"

import { useState, useEffect, useMemo } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { usePathname, useRouter } from "next/navigation"
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
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import Link from "next/link"

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
  const riyalTotal = prixVisa + prixHotelMadina + prixHotelMakkah
  const prixFinal = prixAvion + p + riyalTotal * params.exchange
  return Math.round(prixFinal)
}

export default function NouveauProgramme() {
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hotelsMadina, setHotelsMadina] = useState<Hotel[]>([])
  const [hotelsMakkah, setHotelsMakkah] = useState<Hotel[]>([])
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
    if (!formData.nbJoursMadina.trim()) reasons.push("NB jours Madina est obligatoire.")
    if (!formData.nbJoursMakkah.trim()) reasons.push("NB jours Makkah est obligatoire.")
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

    if (formData.hotelsMadina.length === 0) reasons.push("Selectionnez au moins un hotel a Madina.")
    if (formData.hotelsMakkah.length === 0) reasons.push("Selectionnez au moins un hotel a Makkah.")

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

    return reasons
  }, [formData])

  const madinaBedsCount = useMemo(() => totalBedsByCity(formData.hotelsMadina), [formData.hotelsMadina])
  const makkahBedsCount = useMemo(() => totalBedsByCity(formData.hotelsMakkah), [formData.hotelsMakkah])

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
    let totalTravelersMax = 0

    const labels = ["", "Simple", "Double", "Triple", "Quadruple", "Quintuple"]

    for (let t = 1; t <= 5; t++) {
      const pm = weightedAvgRoomPriceRiyal(formData.hotelsMadina, t)
      const pk = weightedAvgRoomPriceRiyal(formData.hotelsMakkah, t)
      const madinaPlacesT = placesByType(formData.hotelsMadina, t)
      const makkahPlacesT = placesByType(formData.hotelsMakkah, t)
      const paired = Math.min(madinaPlacesT, makkahPlacesT)
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
      })
      const subtotalDh = paired * unitDh
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
    const resultatPrevDh = revenueAfterAgentsDh - agentChargesTotalDh - autresChargesDh

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
      agentChargesTotalDh,
      autresChargesDh,
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
    if (!String(formData.nbJoursMadina).trim()) return false
    if (!String(formData.nbJoursMakkah).trim()) return false
    if (!String(formData.prixAvion).trim()) return false
    if (!String(formData.prixVisaRiyal).trim()) return false
    if (formData.hotelsMadina.length === 0 || formData.hotelsMakkah.length === 0) return false
    if (!hasHotelInventoryConfigured(formData.hotelsMadina)) return false
    if (!hasHotelInventoryConfigured(formData.hotelsMakkah)) return false
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
  ])

  // Charger les hôtels disponibles
  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const [madinaResponse, makkahResponse] = await Promise.all([
          fetch(api.url('/api/hotels/available?city=Madina')),
          fetch(api.url('/api/hotels/available?city=Makkah'))
        ]);

        if (!madinaResponse.ok || !makkahResponse.ok) {
          throw new Error('Erreur lors du chargement des hôtels');
        }

        const madinaHotels = await madinaResponse.json();
        const makkahHotels = await makkahResponse.json();

        console.log('Hôtels Madina chargés:', madinaHotels);
        console.log('Hôtels Makkah chargés:', makkahHotels);

        setHotelsMadina(madinaHotels || []);
        setHotelsMakkah(makkahHotels || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

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
        hotelsMakkah: formData.hotelsMakkah
      }

      const response = await fetch(api.url(api.endpoints.programs), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(programData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la création du programme')
      }

      toast({
        title: 'Succès',
        description: 'Le programme a été créé avec succès',
      })

      router.push('/programmes')
    } catch (error) {
      console.error('Erreur:', error)
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Une erreur est survenue lors de la création du programme',
        variant: 'destructive',
      })
    } finally {
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
                    
                    {/* Grille principale pour les champs standards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                      <div className="space-y-2">
                        <Label htmlFor="nbJoursMadina" className="text-green-700 font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          NB Jours Madina *
                        </Label>
                        <Input
                          id="nbJoursMadina"
                          type="number"
                          value={formData.nbJoursMadina}
                          onChange={(e) => setFormData({ ...formData, nbJoursMadina: e.target.value })}
                          placeholder="Ex: 4"
                          className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nbJoursMakkah" className="text-green-700 font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          NB Jours Makkah *
                        </Label>
                        <Input
                          id="nbJoursMakkah"
                          type="number"
                          value={formData.nbJoursMakkah}
                          onChange={(e) => setFormData({ ...formData, nbJoursMakkah: e.target.value })}
                          placeholder="Ex: 15"
                          className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                        />
                      </div>
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

                  {/* Hôtels - Layout en 2 colonnes */}
                  <div className="flex flex-col gap-6 mb-6">
                    {/* Hôtels à Madina */}
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200 mb-6 w-full">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-yellow-800 flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Hôtels à Madina *
                        </h3>
                        <div className="text-xs md:text-sm font-semibold text-yellow-900 bg-yellow-200/70 px-3 py-1.5 rounded-full">
                          {madinaBedsCount} lits Madina / {makkahBedsCount} lits Makkah
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

                    {/* Hôtels à Makkah */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Hôtels à Makkah *
                        </h3>
                        <div className="text-xs md:text-sm font-semibold text-blue-900 bg-blue-200/70 px-3 py-1.5 rounded-full">
                          {makkahBedsCount} lits Makkah / {madinaBedsCount} lits Madina
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
                  </div>

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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-violet-300 text-violet-900 hover:bg-violet-100"
                        onClick={() => setShowSimulationSection((prev) => !prev)}
                      >
                        {showSimulationSection ? "Masquer" : "Afficher"}
                      </Button>
                    </div>
                    <p className="text-sm text-violet-800/90 mb-4 flex gap-2 items-start">
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        Remplissez d&apos;abord le nom du programme, les détails financiers (exchange, jours, avion, visa),
                        puis sélectionnez les hôtels Madina et Makkah avec au moins une chambre (nombre et prix en Riyal).
                        Ensuite, ajustez les hypothèses ci-dessous. Même logique que la page Nouvelle réservation pour le
                        ticket ; les places agents réduisent le CA et ajoutent une charge.
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
                          <p className="text-xs text-violet-700">CA si tout payant</p>
                          <p className="text-xl font-bold text-violet-950">
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.revenueIfAllPayDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </p>
                        </div>
                        <div className="bg-white p-4">
                          <p className="text-xs text-violet-700">Ticket moyen (estim.)</p>
                          <p className="text-xl font-bold text-violet-950">
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.avgTicketDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </p>
                        </div>
                        <div className="bg-white p-4">
                          <p className="text-xs text-violet-700">Résultat prévisionnel</p>
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
                          <span>Chiffre d&apos;affaires retenu</span>
                          <span className="font-medium">
                            {canRunSimulation
                              ? `${Math.round(simulationPreview.revenueAfterAgentsDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <span>Charges agents (total)</span>
                          <span className="font-medium">
                            {canRunSimulation
                              ? `−${Math.round(simulationPreview.agentChargesTotalDh).toLocaleString("fr-FR")} DH`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <span>Autres charges</span>
                          <span className="font-medium">
                            {canRunSimulation
                              ? `−${Math.round(simulationPreview.autresChargesDh).toLocaleString("fr-FR")} DH`
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
                        onClick={handleSubmit}
                        disabled={!isFormValid}
                        className="flex-1 h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="mr-2 h-5 w-5" />
                        Enregistrer le programme
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
                  onClick={handleSubmit}
                  disabled={!isFormValid}
                  className="w-full h-11 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer le programme
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
