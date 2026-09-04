"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  Calendar as CalendarIcon,
  Sparkles,
  FileText,
  MapPin,
  Wallet,
  DollarSign,
  Plane,
  PiggyBank,
  Info,
  Save,
  ArrowLeft,
  User,
  Bed,
  BadgeCheck,
  AlertTriangle,
} from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Checkbox } from "@/components/ui/checkbox"

type RoomType = "SINGLE" | "DOUBLE" | "TRIPLE" | "QUAD" | "QUINT"

interface Hotel {
  id: number
  name: string
  city: "Madina" | "Makkah" | "Autre"
}

interface ProgramApi {
  id: number
  name: string
  created_at: string
  dateDepart: string | null
  dateArrivee: string | null
  visaDeadline: string | null
  hotelDeadline: string | null
  flightDeadline: string | null
  passportDeadline: string | null
  exchange: number
  nbJoursMadina: number
  nbJoursMakkah: number
  prixAvionDH: number
  prixVisaRiyal: number
  profit: number
  profitEconomique: number
  profitNormal: number
  profitVIP: number
  hotelsMadina: Array<{ hotel: { id: number; name: string; city: "Madina" } }>
  hotelsMakkah: Array<{ hotel: { id: number; name: string; city: "Makkah" } }>
  hotelsAutre?: Array<{ hotel: { id: number; name: string; city: "Autre" }; nbJours: number; ordre: number }>
  rooms: Array<{
    hotelId: number
    hotel: { id: number; name: string; city: "Madina" | "Makkah" | "Autre" }
    roomType: RoomType
    prixRoom: number
    nbrPlaceTotal: number
    nbrPlaceRestantes?: number
  }>
}

/** Convertit une date ISO renvoyée par l'API en `Date`, ou `null` si absente/invalide. */
function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Repli pour les programmes créés avant l'arrivée de `dateDepart` : leurs colonnes
 * de voyage sont NULL (migration additive) mais les 4 dates limites étaient saisies.
 * On propose la plus ancienne comme date de départ — l'admin peut la corriger avant
 * d'enregistrer. Aucun repli pour `dateArrivee` : rien en base ne permet de la deviner.
 */
function ancienneDateDepart(program: ProgramApi): Date | null {
  const deadlines = [
    program.passportDeadline,
    program.visaDeadline,
    program.flightDeadline,
    program.hotelDeadline,
  ]
    .map(toDate)
    .filter((d): d is Date => d !== null)

  if (deadlines.length === 0) return null
  return deadlines.reduce((plusAncienne, d) => (d < plusAncienne ? d : plusAncienne))
}

function mapRoomTypeToIndex(roomType: RoomType): 1 | 2 | 3 | 4 | 5 {
  switch (roomType) {
    case "SINGLE":
      return 1
    case "DOUBLE":
      return 2
    case "TRIPLE":
      return 3
    case "QUAD":
      return 4
    case "QUINT":
      return 5
  }
}

export default function ModifierProgrammePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hotelsMadina, setHotelsMadina] = useState<Hotel[]>([])
  const [hotelsMakkah, setHotelsMakkah] = useState<Hotel[]>([])
  const [hotelsAutreList, setHotelsAutreList] = useState<Hotel[]>([])
  const [activeHotelTab, setActiveHotelTab] = useState<"madina" | "makkah" | "autre">("madina")
  /** Confirmation demandée quand les catégories d'hôtels n'ont pas le même nombre de lits */
  const [showBedsMismatchDialog, setShowBedsMismatchDialog] = useState(false)

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
      name: string
      chambres: { [key: number]: { nb: string; prix: string } }
    }>,
    hotelsMakkah: [] as Array<{
      name: string
      chambres: { [key: number]: { nb: string; prix: string } }
    }>,
    hotelsAutre: [] as Array<{
      name: string
      nbJours: string
      ordre: string
      chambres: { [key: number]: { nb: string; prix: string } }
    }>,
    dateDepart: null as Date | null,
    dateArrivee: null as Date | null,
  })

  // Contraintes calculées à partir des rooms existantes: par hôtel et type → {occupied, total}
  const [roomConstraints, setRoomConstraints] = useState<{
    Madina: Record<string, Record<number, { occupied: number; total: number }>>
    Makkah: Record<string, Record<number, { occupied: number; total: number }>>
    Autre: Record<string, Record<number, { occupied: number; total: number }>>
  }>({ Madina: {}, Makkah: {}, Autre: {} })

  // Total de lits (places) par catégorie = Σ (nb chambres × capacité du type)
  const bedsOf = (hotels: Array<{ chambres: { [key: number]: { nb: string; prix: string } } }>) =>
    hotels.reduce((sum, h) => sum + [1, 2, 3, 4, 5].reduce((s, t) => s + (parseInt(h.chambres[t]?.nb || "0", 10) || 0) * t, 0), 0)
  const madinaBedsCount = useMemo(() => bedsOf(formData.hotelsMadina), [formData.hotelsMadina])
  const makkahBedsCount = useMemo(() => bedsOf(formData.hotelsMakkah), [formData.hotelsMakkah])
  const autreBedsCount = useMemo(() => bedsOf(formData.hotelsAutre), [formData.hotelsAutre])

  /**
   * Les catégories d'hôtels (Madina / Makkah / Autre) doivent offrir le même
   * nombre total de lits : la capacité réelle du programme est le minimum des
   * catégories présentes, tout lit en excès dans une catégorie est perdu.
   * On compare uniquement les catégories qui contiennent au moins un hôtel.
   */
  const bedsMismatch = useMemo(() => {
    const categories = [
      { key: "madina", label: "Madina", beds: madinaBedsCount, present: formData.hotelsMadina.length > 0 },
      { key: "makkah", label: "Makkah", beds: makkahBedsCount, present: formData.hotelsMakkah.length > 0 },
      { key: "autre", label: "Autre", beds: autreBedsCount, present: formData.hotelsAutre.length > 0 },
    ].filter((c) => c.present)

    if (categories.length < 2) return null

    const counts = categories.map((c) => c.beds)
    const min = Math.min(...counts)
    const max = Math.max(...counts)
    if (min === max) return null

    return { categories, min, max, ecart: max - min }
  }, [
    madinaBedsCount,
    makkahBedsCount,
    autreBedsCount,
    formData.hotelsMadina.length,
    formData.hotelsMakkah.length,
    formData.hotelsAutre.length,
  ])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setIsLoading(true)
        const [programRes, madinaRes, makkahRes, autreRes] = await Promise.all([
          fetch(api.url(`/api/programs/${id}`)),
          fetch(api.url('/api/hotels/available?city=Madina')),
          fetch(api.url('/api/hotels/available?city=Makkah')),
          fetch(api.url('/api/hotels/available?city=Autre')),
        ])

        if (!programRes.ok) {
          throw new Error("Programme introuvable")
        }

        const program: ProgramApi = await programRes.json()
        const madinaHotels: Hotel[] = madinaRes.ok ? await madinaRes.json() : []
        const makkahHotels: Hotel[] = makkahRes.ok ? await makkahRes.json() : []
        const autreHotels: Hotel[] = autreRes.ok ? await autreRes.json() : []

        setHotelsMadina(madinaHotels)
        setHotelsMakkah(makkahHotels)
        setHotelsAutreList(autreHotels)

        // Préparer les structures d'hôtels sélectionnés avec chambres/prix (nb = compteur de rooms)
        const selectedMadina = program.hotelsMadina.map(h => ({
          name: h.hotel.name,
          chambres: {
            1: { nb: "0", prix: "" },
            2: { nb: "0", prix: "" },
            3: { nb: "0", prix: "" },
            4: { nb: "0", prix: "" },
            5: { nb: "0", prix: "" },
          },
        }))
        const selectedMakkah = program.hotelsMakkah.map(h => ({
          name: h.hotel.name,
          chambres: {
            1: { nb: "0", prix: "" },
            2: { nb: "0", prix: "" },
            3: { nb: "0", prix: "" },
            4: { nb: "0", prix: "" },
            5: { nb: "0", prix: "" },
          },
        }))
        // Hôtels Autre du programme (triés par ordre d'affichage), avec nb nuits
        const selectedAutre = [...(program.hotelsAutre || [])]
          .sort((a, b) => a.ordre - b.ordre)
          .map(h => ({
            name: h.hotel.name,
            nbJours: String(h.nbJours ?? ""),
            ordre: String(h.ordre ?? ""),
            chambres: {
              1: { nb: "0", prix: "" },
              2: { nb: "0", prix: "" },
              3: { nb: "0", prix: "" },
              4: { nb: "0", prix: "" },
              5: { nb: "0", prix: "" },
            },
          }))

        // Contraintes rooms: total et occupées
        const constraintsMadina: Record<string, Record<number, { occupied: number; total: number }>> = {}
        const constraintsMakkah: Record<string, Record<number, { occupied: number; total: number }>> = {}
        const constraintsAutre: Record<string, Record<number, { occupied: number; total: number }>> = {}

        // Agréger les rooms → nb (compte), prix (première valeur), contraintes
        // Utiliser un compteur séparé pour éviter les problèmes de mutation
        const roomCounts: Record<string, Record<number, { count: number; prix: string }>> = {}
        
        for (const room of program.rooms) {
          const typeIndex = mapRoomTypeToIndex(room.roomType)
          const hotelName = room.hotel.name
          const city = room.hotel.city
          const key = `${city}:${hotelName}`

          if (!roomCounts[key]) {
            roomCounts[key] = { 1: { count: 0, prix: "" }, 2: { count: 0, prix: "" }, 3: { count: 0, prix: "" }, 4: { count: 0, prix: "" }, 5: { count: 0, prix: "" } }
          }

          // Incrémenter le compteur
          roomCounts[key][typeIndex].count += 1
          // Utiliser le prix de la première room rencontrée
          if (roomCounts[key][typeIndex].prix === "") {
            roomCounts[key][typeIndex].prix = String(room.prixRoom ?? "")
          }

          // Mettre à jour contraintes
          const mapRef = city === "Madina" ? constraintsMadina : city === "Makkah" ? constraintsMakkah : constraintsAutre
          mapRef[hotelName] = mapRef[hotelName] || {}
          const entry = mapRef[hotelName][typeIndex] || { occupied: 0, total: 0 }
          entry.total += 1
          if ((room.nbrPlaceRestantes ?? 0) < (room.nbrPlaceTotal ?? 0)) {
            entry.occupied += 1
          }
          mapRef[hotelName][typeIndex] = entry
        }

        // Appliquer les compteurs aux structures d'hôtels
        for (const hotel of selectedMadina) {
          const key = `Madina:${hotel.name}`
          if (roomCounts[key]) {
            for (let type = 1; type <= 5; type++) {
              hotel.chambres[type as 1 | 2 | 3 | 4 | 5] = {
                nb: String(roomCounts[key][type].count),
                prix: roomCounts[key][type].prix,
              }
            }
          }
        }
        for (const hotel of selectedMakkah) {
          const key = `Makkah:${hotel.name}`
          if (roomCounts[key]) {
            for (let type = 1; type <= 5; type++) {
              hotel.chambres[type as 1 | 2 | 3 | 4 | 5] = {
                nb: String(roomCounts[key][type].count),
                prix: roomCounts[key][type].prix,
              }
            }
          }
        }
        for (const hotel of selectedAutre) {
          const key = `Autre:${hotel.name}`
          if (roomCounts[key]) {
            for (let type = 1; type <= 5; type++) {
              hotel.chambres[type as 1 | 2 | 3 | 4 | 5] = {
                nb: String(roomCounts[key][type].count),
                prix: roomCounts[key][type].prix,
              }
            }
          }
        }

        setFormData({
          nom: program.name,
          nbJoursMadina: String(program.nbJoursMadina ?? ""),
          nbJoursMakkah: String(program.nbJoursMakkah ?? ""),
          exchange: String(program.exchange ?? ""),
          prixAvion: String(program.prixAvionDH ?? ""),
          prixVisaRiyal: String(program.prixVisaRiyal ?? ""),
          profit: String(program.profit ?? ""),
          profitEconomique: String((program as any).profitEconomique ?? ""),
          profitNormal: String((program as any).profitNormal ?? ""),
          profitVIP: String((program as any).profitVIP ?? ""),
          dateCreation: program.created_at ? new Date(program.created_at) : new Date(),
          hotelsMadina: selectedMadina,
          hotelsMakkah: selectedMakkah,
          hotelsAutre: selectedAutre,
          dateDepart: toDate(program.dateDepart) ?? ancienneDateDepart(program),
          dateArrivee: toDate(program.dateArrivee),
        })
        setRoomConstraints({ Madina: constraintsMadina, Makkah: constraintsMakkah, Autre: constraintsAutre })
      } catch (error) {
        console.error(error)
        toast({ title: "Erreur", description: error instanceof Error ? error.message : "Impossible de charger le programme", variant: "destructive" })
      } finally {
        setIsLoading(false)
      }
    }

    if (id) fetchAll()
  }, [id, toast])

  const isFormValid = useMemo(() => {
    return Boolean(formData.nom && formData.dateDepart && formData.dateArrivee)
  }, [formData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid || isSubmitting) return

    // Nombre de lits différent entre catégories d'hôtels : on demande une
    // confirmation explicite avant d'enregistrer les modifications.
    if (bedsMismatch) {
      setShowBedsMismatchDialog(true)
      return
    }

    await saveProgram()
  }

  const saveProgram = async () => {
    if (!isFormValid || isSubmitting) return
    setIsSubmitting(true)
    try {
      // S'assurer que toutes les clés numériques sont présentes dans chambres (1-5)
      const normalizeHotelChambres = (hotels: typeof formData.hotelsMadina) => {
        return hotels.map(hotel => ({
          ...hotel,
          chambres: {
            1: hotel.chambres[1] || { nb: "0", prix: "" },
            2: hotel.chambres[2] || { nb: "0", prix: "" },
            3: hotel.chambres[3] || { nb: "0", prix: "" },
            4: hotel.chambres[4] || { nb: "0", prix: "" },
            5: hotel.chambres[5] || { nb: "0", prix: "" },
          }
        }))
      }

      const normalizedMadina = normalizeHotelChambres(formData.hotelsMadina)
      const normalizedMakkah = normalizeHotelChambres(formData.hotelsMakkah)
      // Hôtels Autre : conserver nb nuits + ordre (ordre = position d'affichage = ordre de la liste)
      const normalizedAutre = formData.hotelsAutre.map((hotel, idx) => ({
        name: hotel.name,
        nbJours: hotel.nbJours ? parseInt(hotel.nbJours, 10) : 0,
        ordre: hotel.ordre ? parseInt(hotel.ordre, 10) : idx + 1,
        chambres: {
          1: hotel.chambres[1] || { nb: "0", prix: "" },
          2: hotel.chambres[2] || { nb: "0", prix: "" },
          3: hotel.chambres[3] || { nb: "0", prix: "" },
          4: hotel.chambres[4] || { nb: "0", prix: "" },
          5: hotel.chambres[5] || { nb: "0", prix: "" },
        },
      }))

      // Analyser les changements pour chaque hôtel
      const analyzeRoomChanges = (hotels: typeof normalizedMadina, city: string) => {
        console.log(`\n📊 === ANALYSE DES CHANGEMENTS - ${city} ===`)
        hotels.forEach(hotel => {
          console.log(`\n🏨 Hôtel: ${hotel.name}`)
          for (let type = 1; type <= 5; type++) {
            const config = hotel.chambres[type as 1 | 2 | 3 | 4 | 5]
            if (config) {
              const nb = parseInt(config.nb || "0", 10)
              const prix = parseFloat(config.prix || "0")
              const occupied = roomConstraints[city === "Madina" ? "Madina" : "Makkah"][hotel.name]?.[type]?.occupied || 0
              const total = roomConstraints[city === "Madina" ? "Madina" : "Makkah"][hotel.name]?.[type]?.total || 0
              
              const diff = nb - total
              let action = ""
              if (diff > 0) {
                action = `➕ AJOUT de ${diff} room(s)`
              } else if (diff < 0) {
                action = `➖ SUPPRESSION de ${Math.abs(diff)} room(s) (max ${Math.min(Math.abs(diff), total - occupied)} supprimables car ${occupied} occupées)`
              } else {
                action = `➡️ PAS DE CHANGEMENT de nombre`
              }
              
              const prixChange = prix > 0 ? ` | Prix: ${prix} DH` : ""
              console.log(`  Type ${type}: Total actuel=${total}, Occupées=${occupied}, Demandé=${nb} | ${action}${prixChange}`)
            }
          }
        })
      }

      analyzeRoomChanges(normalizedMadina, "Madina")
      analyzeRoomChanges(normalizedMakkah, "Makkah")

      const payload = {
        name: formData.nom,
        nbJoursMadina: formData.nbJoursMadina ? parseInt(formData.nbJoursMadina) : undefined,
        nbJoursMakkah: formData.nbJoursMakkah ? parseInt(formData.nbJoursMakkah) : undefined,
        exchange: formData.exchange ? parseFloat(formData.exchange) : undefined,
        prixAvionDH: formData.prixAvion ? parseFloat(formData.prixAvion) : undefined,
        prixVisaRiyal: formData.prixVisaRiyal ? parseFloat(formData.prixVisaRiyal) : undefined,
        profit: formData.profit ? parseFloat(formData.profit) : undefined,
        profitEconomique: formData.profitEconomique ? parseFloat(formData.profitEconomique) : undefined,
        profitNormal: formData.profitNormal ? parseFloat(formData.profitNormal) : undefined,
        profitVIP: formData.profitVIP ? parseFloat(formData.profitVIP) : undefined,
        dateDepart: formData.dateDepart ?? undefined,
        dateArrivee: formData.dateArrivee ?? undefined,
        // Les 4 dates limites sont alignées sur la date de départ : plus de saisie
        // manuelle, le bloc « Dates limites » a été retiré du formulaire.
        visaDeadline: formData.dateDepart ?? undefined,
        hotelDeadline: formData.dateDepart ?? undefined,
        flightDeadline: formData.dateDepart ?? undefined,
        passportDeadline: formData.dateDepart ?? undefined,
        hotelsMadina: normalizedMadina,
        hotelsMakkah: normalizedMakkah,
        hotelsAutre: normalizedAutre,
      }

      console.log(`\n📤 === REQUÊTE ENVOYÉE AU BACKEND ===`)
      console.log(`URL: PUT /api/programs/${id}`)
      console.log(`Payload:`, JSON.stringify(payload, null, 2))

      const res = await api.request(`/api/programs/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        console.error(`❌ Erreur backend:`, j)
        throw new Error(j.error || "Erreur lors de la mise à jour du programme")
      }
      
      const responseData = await res.json().catch(() => ({}))
      console.log(`\n✅ === RÉPONSE DU BACKEND ===`)
      console.log(`Réponse:`, responseData)
      
      // Analyser les rooms retournées pour vérifier le résultat
      if (responseData.rooms) {
        console.log(`\n📋 === ROOMS RETOURNÉES PAR LE BACKEND ===`)
        const roomsByHotel = responseData.rooms.reduce((acc: any, room: any) => {
          const key = `${room.hotel.city}:${room.hotel.name}:${room.roomType}`
          if (!acc[key]) acc[key] = []
          acc[key].push(room)
          return acc
        }, {})
        
        Object.entries(roomsByHotel).forEach(([key, rooms]: [string, any]) => {
          const [city, hotelName, roomType] = key.split(':')
          const free = rooms.filter((r: any) => r.nbrPlaceRestantes === r.nbrPlaceTotal).length
          const occupied = rooms.length - free
          console.log(`  ${city} - ${hotelName} - ${roomType}: Total=${rooms.length}, Libres=${free}, Occupées=${occupied}`)
        })
      }
      
      toast({ title: "Succès", description: "Programme mis à jour" })
      router.push("/programmes")
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-4">
            <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <CardTitle className="text-xl flex items-center gap-3">
                  <Sparkles className="h-6 w-6" />
                  Modifier le programme
                </CardTitle>
                <CardDescription className="text-blue-100">Mettez à jour les détails du programme</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {isLoading ? (
                  <div className="text-center text-gray-600">Chargement…</div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-xl border border-blue-200 mb-6">
                      <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Informations de base
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="nom" className="text-blue-700 font-medium flex items-center gap-2">
                            Nom du programme
                          </Label>
                          <Input id="nom" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className="h-12 border-2 border-blue-200 focus:border-blue-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dateCreation" className="text-blue-700 font-medium flex items-center gap-2">Date de création</Label>
                          <Input
                            id="dateCreation"
                            value={formData.dateCreation ? format(formData.dateCreation, "PPP", { locale: fr }) : ""}
                            readOnly
                            className="h-12 border-2 border-blue-200 bg-gray-50 rounded-lg cursor-not-allowed"
                          />
                        </div>
                        {([
                          { key: "dateDepart", label: "Date de départ", icon: Plane },
                          { key: "dateArrivee", label: "Date d'arrivée", icon: MapPin },
                        ] as const).map((item) => {
                          const dateValue = formData[item.key]
                          const Icon = item.icon
                          return (
                            <div key={item.key} className="space-y-2">
                              <Label className="text-blue-700 font-medium flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {item.label} *
                              </Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal h-12 border-2 border-blue-200 hover:border-blue-300 rounded-lg bg-white/80"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
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
                                    selected={dateValue ?? undefined}
                                    onSelect={(date) =>
                                      setFormData((prev) => ({ ...prev, [item.key]: date ?? null }))
                                    }
                                    initialFocus
                                    className="rounded-lg"
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          )
                        })}
                      </div>
                      <p className="mt-4 text-sm text-blue-700 bg-white/70 border border-blue-200 rounded-lg px-3 py-2 flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                        <span>
                          Les dates limites (passeport, visa, billets, hôtels) sont automatiquement
                          alignées sur la date de départ.
                        </span>
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-xl border border-green-200 mb-6">
                      <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        Détails financiers et durée
                      </h3>
                      
                      {/* Grille principale pour les champs standards.
                          (NB Jours Madina/Makkah déplacés dans leurs onglets ci-dessous.) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                        <div className="space-y-2">
                          <Label className="text-green-700 font-medium flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Exchange
                          </Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={formData.exchange} 
                            onChange={(e) => setFormData({ ...formData, exchange: e.target.value })} 
                            placeholder="Ex: 2.80"
                            className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-green-700 font-medium flex items-center gap-2">
                            <Plane className="h-4 w-4" />
                            Prix Avion (DH)
                          </Label>
                          <Input 
                            type="number" 
                            value={formData.prixAvion} 
                            onChange={(e) => setFormData({ ...formData, prixAvion: e.target.value })} 
                            placeholder="Ex: 7750"
                            className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-green-700 font-medium flex items-center gap-2">
                            <BadgeCheck className="h-4 w-4" />
                            Prix Visa (Riyal)
                          </Label>
                          <Input 
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
                            <Label className="text-green-700 font-medium flex items-center gap-2">
                              Profit Économique (DH)
                            </Label>
                            <Input 
                              type="number" 
                              value={formData.profitEconomique} 
                              onChange={(e) => setFormData({ ...formData, profitEconomique: e.target.value })} 
                              placeholder="Ex: 1000" 
                              className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all" 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-green-700 font-medium flex items-center gap-2">
                              Profit Normal (DH)
                            </Label>
                            <Input 
                              type="number" 
                              value={formData.profitNormal} 
                              onChange={(e) => setFormData({ ...formData, profitNormal: e.target.value })} 
                              placeholder="Ex: 1500" 
                              className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all" 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-green-700 font-medium flex items-center gap-2">
                              Profit VIP (DH)
                            </Label>
                            <Input 
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

                      {bedsMismatch && (
                        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                            <div>
                              <p className="font-semibold">
                                Nombre de places different entre les categories d'hotels.
                              </p>
                              <p className="mt-1">
                                {bedsMismatch.categories.map((c) => `${c.label} : ${c.beds} lits`).join(" — ")}
                                {" "}(ecart de {bedsMismatch.ecart} lit{bedsMismatch.ecart > 1 ? "s" : ""}).
                              </p>
                              <p className="mt-1 text-amber-800">
                                La capacite reelle du programme sera limitee a {bedsMismatch.min} place
                                {bedsMismatch.min > 1 ? "s" : ""} : les lits en trop ne seront pas reservables.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <TabsContent value="madina">
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
                          {hotelsMadina.map((hotel) => {
                            const selected = formData.hotelsMadina.some((h) => h.name === hotel.name)
                            return (
                              <div key={hotel.id} className="border border-yellow-200 rounded-lg p-3 bg-white/70">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={selected}
                                    disabled
                                    className="data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                                  />
                                  <span className="text-sm font-medium text-yellow-800">{hotel.name}</span>
                                </div>
                                {selected && (
                                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                    {[1, 2, 3, 4, 5].map((type) => {
                                      const occupied = roomConstraints.Madina[hotel.name]?.[type]?.occupied || 0;
                                      const total = roomConstraints.Madina[hotel.name]?.[type]?.total || 0;
                                      const currentValue = parseInt(formData.hotelsMadina.find((h) => h.name === hotel.name)?.chambres[type]?.nb || "0", 10);
                                      const canDecrement = currentValue > occupied;
                                      return (
                                      <div key={type} className="bg-white border border-yellow-200 rounded-lg p-4 shadow-sm">
                                        <div className="text-center mb-3">
                                          <div className="flex items-center justify-center gap-1 mb-2">
                                            {Array.from({ length: type }, (_, i) => (
                                              <div key={i} className="w-6 h-6 flex items-center justify-center">
                                                <User className="w-5 h-5 text-yellow-600" />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                        <div className="mb-3">
                                          <div className="text-sm text-yellow-700 mb-2 text-center font-semibold">Chambres</div>
                                          <div className="flex justify-center">
                                            <div className="inline-flex items-center bg-gray-50 border border-yellow-300 rounded-lg">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 hover:bg-yellow-100 text-yellow-600 border-r border-yellow-200 rounded-l-lg"
                                                disabled={!canDecrement}
                                                onClick={() => {
                                                  if (!canDecrement) return;
                                                  const newValue = Math.max(occupied, currentValue - 1);
                                                  setFormData(prev => ({
                                                    ...prev,
                                                    hotelsMadina: prev.hotelsMadina.map(h => h.name === hotel.name ? {
                                                      ...h,
                                                      chambres: { ...h.chambres, [type]: { ...h.chambres[type], nb: String(newValue) } }
                                                    } : h)
                                                  }))
                                                }}
                                              >
                                                <span className="text-sm font-semibold">−</span>
                                              </Button>
                                              <div className="h-8 w-12 flex items-center justify-center text-sm font-semibold text-yellow-800 bg-white">
                                                {currentValue}
                                              </div>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 hover:bg-yellow-100 text-yellow-600 border-l border-yellow-200 rounded-r-lg"
                                                onClick={() => {
                                                  const newValue = currentValue + 1;
                                                  setFormData(prev => ({
                                                    ...prev,
                                                    hotelsMadina: prev.hotelsMadina.map(h => h.name === hotel.name ? {
                                                      ...h,
                                                      chambres: { ...h.chambres, [type]: { ...h.chambres[type], nb: String(newValue) } }
                                                    } : h)
                                                  }))
                                                }}
                                              >
                                                <span className="text-sm font-semibold">+</span>
                                              </Button>
                                            </div>
                                          </div>
                                          <div className="mt-1 text-center text-[11px] text-gray-500">Occupées: {occupied} • Total actuel: {total}</div>
                                        </div>
                                        <div>
                                          <div className="text-sm text-yellow-700 mb-2 text-center font-semibold">Prix (Riyal)</div>
                                          <Input
                                            type="number"
                                            value={formData.hotelsMadina.find((h) => h.name === hotel.name)?.chambres[type]?.prix || ""}
                                            onChange={(e) => setFormData(prev => ({
                                              ...prev,
                                              hotelsMadina: prev.hotelsMadina.map(h => h.name === hotel.name ? {
                                                ...h,
                                                chambres: { ...h.chambres, [type]: { ...h.chambres[type], prix: e.target.value } }
                                              } : h)
                                            }))}
                                            className="h-9 w-full text-center border-yellow-300 focus:border-yellow-500 text-sm"
                                          />
                                        </div>
                                      </div>
                                    )})}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      </TabsContent>

                      <TabsContent value="makkah">
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
                          {hotelsMakkah.map((hotel) => {
                            const selected = formData.hotelsMakkah.some((h) => h.name === hotel.name)
                            return (
                              <div key={hotel.id} className="space-y-2">
                                <div className="flex items-center space-x-2 p-3 rounded-lg border border-blue-200 bg-blue-50">
                                  <Checkbox
                                    checked={selected}
                                    disabled
                                    className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                  />
                                  <span className="text-sm font-medium text-blue-800">{hotel.name}</span>
                                </div>
                                {selected && (
                                  <div className="bg-white rounded-lg border border-blue-200 p-4 ml-6">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                      {[1, 2, 3, 4, 5].map((type) => {
                                        const occupied = roomConstraints.Makkah[hotel.name]?.[type]?.occupied || 0;
                                        const total = roomConstraints.Makkah[hotel.name]?.[type]?.total || 0;
                                        const currentValue = parseInt(formData.hotelsMakkah.find((h) => h.name === hotel.name)?.chambres[type]?.nb || "0", 10);
                                        const canDecrement = currentValue > occupied;
                                        return (
                                        <div key={type} className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                                          <div className="flex justify-center mb-2">
                                            <div className="flex items-center gap-1">
                                              {Array.from({ length: type }, (_, i) => (
                                                <User key={i} className="w-4 h-4 text-blue-600" />
                                              ))}
                                            </div>
                                          </div>
                                          <div className="mb-3">
                                            <div className="text-sm text-blue-700 mb-2 text-center font-semibold">Chambres</div>
                                            <div className="flex justify-center">
                                              <div className="inline-flex items-center bg-gray-50 border border-blue-300 rounded-lg">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 hover:bg-blue-100 text-blue-600 border-r border-blue-200 rounded-l-lg"
                                                  disabled={!canDecrement}
                                                  onClick={() => {
                                                    if (!canDecrement) return;
                                                    const newValue = Math.max(occupied, currentValue - 1);
                                                    setFormData(prev => ({
                                                      ...prev,
                                                      hotelsMakkah: prev.hotelsMakkah.map(h => h.name === hotel.name ? {
                                                        ...h,
                                                        chambres: { ...h.chambres, [type]: { ...h.chambres[type], nb: String(newValue) } }
                                                      } : h)
                                                    }))
                                                  }}
                                                >
                                                  <span className="text-sm font-semibold">−</span>
                                                </Button>
                                                <div className="h-8 w-12 flex items-center justify-center text-sm font-semibold text-blue-800 bg-white">
                                                  {currentValue}
                                                </div>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 hover:bg-blue-100 text-blue-600 border-l border-blue-200 rounded-r-lg"
                                                  onClick={() => {
                                                    const newValue = currentValue + 1;
                                                    setFormData(prev => ({
                                                      ...prev,
                                                      hotelsMakkah: prev.hotelsMakkah.map(h => h.name === hotel.name ? {
                                                        ...h,
                                                        chambres: { ...h.chambres, [type]: { ...h.chambres[type], nb: String(newValue) } }
                                                      } : h)
                                                    }))
                                                  }}
                                                >
                                                  <span className="text-sm font-semibold">+</span>
                                                </Button>
                                              </div>
                                            </div>
                                            <div className="mt-1 text-center text-[11px] text-gray-500">Occupées: {occupied} • Total actuel: {total}</div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-blue-700 mb-2 text-center font-semibold">Prix (Riyal)</div>
                                            <Input
                                              type="number"
                                              value={formData.hotelsMakkah.find((h) => h.name === hotel.name)?.chambres[type]?.prix || ""}
                                              onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                hotelsMakkah: prev.hotelsMakkah.map(h => h.name === hotel.name ? {
                                                  ...h,
                                                  chambres: { ...h.chambres, [type]: { ...h.chambres[type], prix: e.target.value } }
                                                } : h)
                                              }))}
                                              className="h-9 w-full text-center border-blue-300 focus:border-blue-500 text-sm"
                                            />
                                          </div>
                                        </div>
                                      )})}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      </TabsContent>

                      <TabsContent value="autre">
                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl border border-emerald-200">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
                            <MapPin className="h-5 w-5" />
                            Hôtels Autre
                          </h3>
                          <div className="text-xs md:text-sm font-semibold text-emerald-900 bg-emerald-200/70 px-3 py-1.5 rounded-full">
                            {autreBedsCount} lits
                          </div>
                        </div>
                        <div className="flex flex-col gap-4">
                          {formData.hotelsAutre.length === 0 ? (
                            <div className="text-center py-4 text-gray-500 text-sm">
                              Ce programme ne contient aucun hôtel « Autre ».
                            </div>
                          ) : (
                          hotelsAutreList
                            .filter((hotel) => formData.hotelsAutre.some((h) => h.name === hotel.name))
                            .map((hotel) => {
                            const current = formData.hotelsAutre.find((h) => h.name === hotel.name)
                            return (
                              <div key={hotel.id} className="border border-emerald-200 rounded-lg p-3 bg-white/70">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked
                                    disabled
                                    className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                  />
                                  <span className="text-sm font-medium text-emerald-800">{hotel.name}</span>
                                </div>
                                <div className="mt-3 max-w-xs">
                                  <div className="text-xs text-emerald-700 mb-1 font-semibold">Nb de nuits *</div>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="Ex: 3"
                                    value={current?.nbJours || ""}
                                    onChange={(e) => setFormData(prev => ({
                                      ...prev,
                                      hotelsAutre: prev.hotelsAutre.map(h => h.name === hotel.name ? { ...h, nbJours: e.target.value } : h)
                                    }))}
                                    className="h-9 w-full text-center border-emerald-300 focus:border-emerald-500 text-sm"
                                  />
                                </div>
                                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                  {[1, 2, 3, 4, 5].map((type) => {
                                    const occupied = roomConstraints.Autre[hotel.name]?.[type]?.occupied || 0;
                                    const total = roomConstraints.Autre[hotel.name]?.[type]?.total || 0;
                                    const currentValue = parseInt(current?.chambres[type]?.nb || "0", 10);
                                    const canDecrement = currentValue > occupied;
                                    return (
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
                                                disabled={!canDecrement}
                                                onClick={() => {
                                                  if (!canDecrement) return;
                                                  const newValue = Math.max(occupied, currentValue - 1);
                                                  setFormData(prev => ({
                                                    ...prev,
                                                    hotelsAutre: prev.hotelsAutre.map(h => h.name === hotel.name ? {
                                                      ...h,
                                                      chambres: { ...h.chambres, [type]: { ...h.chambres[type], nb: String(newValue) } }
                                                    } : h)
                                                  }))
                                                }}
                                              >
                                                <span className="text-sm font-semibold">−</span>
                                              </Button>
                                              <div className="h-8 w-12 flex items-center justify-center text-sm font-semibold text-emerald-800 bg-white">
                                                {currentValue}
                                              </div>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 hover:bg-emerald-100 text-emerald-600 border-l border-emerald-200 rounded-r-lg"
                                                onClick={() => {
                                                  const newValue = currentValue + 1;
                                                  setFormData(prev => ({
                                                    ...prev,
                                                    hotelsAutre: prev.hotelsAutre.map(h => h.name === hotel.name ? {
                                                      ...h,
                                                      chambres: { ...h.chambres, [type]: { ...h.chambres[type], nb: String(newValue) } }
                                                    } : h)
                                                  }))
                                                }}
                                              >
                                                <span className="text-sm font-semibold">+</span>
                                              </Button>
                                            </div>
                                          </div>
                                          <div className="mt-1 text-center text-[11px] text-gray-500">Occupées: {occupied} • Total actuel: {total}</div>
                                        </div>
                                        <div>
                                          <div className="text-sm text-emerald-700 mb-2 text-center font-semibold">Prix (Riyal)</div>
                                          <Input
                                            type="number"
                                            value={current?.chambres[type]?.prix || ""}
                                            onChange={(e) => setFormData(prev => ({
                                              ...prev,
                                              hotelsAutre: prev.hotelsAutre.map(h => h.name === hotel.name ? {
                                                ...h,
                                                chambres: { ...h.chambres, [type]: { ...h.chambres[type], prix: e.target.value } }
                                              } : h)
                                            }))}
                                            className="h-9 w-full text-center border-emerald-300 focus:border-emerald-500 text-sm"
                                          />
                                        </div>
                                      </div>
                                    )})}
                                </div>
                              </div>
                            )
                          }))}
                        </div>
                      </div>
                      </TabsContent>
                    </Tabs>

                    {/* Le bloc « Dates limites » a été retiré : les 4 deadlines sont
                        désormais dérivées de la date de départ (voir Informations de base). */}

                    <div className="flex gap-4 mt-8">
                      <Button type="submit" disabled={!isFormValid || isSubmitting} className="flex-1 h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        <Save className="mr-2 h-5 w-5" />
                        Enregistrer les modifications
                      </Button>
                      <Link href="/programmes" className="flex-1">
                        <Button variant="outline" className="w-full h-12 border-2 border-gray-300 hover:border-gray-400">
                          <ArrowLeft className="mr-2 h-5 w-5" />
                          Annuler
                        </Button>
                      </Link>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Confirmation : nombre de lits different entre categories d'hotels */}
      <AlertDialog open={showBedsMismatchDialog} onOpenChange={setShowBedsMismatchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Nombre de places different
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>
                  Les categories d'hotels selectionnees n'offrent pas le meme nombre total de places.
                </p>
                {bedsMismatch && (
                  <>
                    <ul className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
                      {bedsMismatch.categories.map((c) => (
                        <li key={c.key} className="flex items-center justify-between gap-4">
                          <span className="font-medium text-amber-900">{c.label}</span>
                          <span
                            className={
                              c.beds === bedsMismatch.min
                                ? "font-semibold text-amber-900"
                                : "font-semibold text-red-700"
                            }
                          >
                            {c.beds} lit{c.beds > 1 ? "s" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p>
                      Ecart de {bedsMismatch.ecart} lit{bedsMismatch.ecart > 1 ? "s" : ""}. La capacite
                      reelle du programme sera limitee a {bedsMismatch.min} place
                      {bedsMismatch.min > 1 ? "s" : ""} : les lits en trop ne seront pas reservables.
                    </p>
                  </>
                )}
                <p className="font-medium">
                  Voulez-vous confirmer et enregistrer les modifications malgre cet ecart ?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Corriger les hotels</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                setShowBedsMismatchDialog(false)
                void saveProgram()
              }}
            >
              Confirmer quand meme
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
