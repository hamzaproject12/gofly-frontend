"use client"

/**
 * Plan de chambres d'un programme : qui dort où, hôtel par hôtel.
 *
 * Deux lectures complémentaires, pensées pour le travail de placement :
 *  - « Plan des chambres » : chaque chambre avec ses places numérotées, ses
 *    occupants et ses places encore libres (cliquables pour réserver).
 *  - « Index des pèlerins » : la liste alphabétique avec la chambre de chacun
 *    dans chaque hôtel du parcours.
 *
 * Une famille (réservation de 2 personnes ou plus) porte une couleur unique,
 * conservée d'un hôtel à l'autre — et reprise à l'identique dans l'export PDF.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import ProgramStatusBanner from "@/components/ProgramStatusBanner"
import { CompteARebours, DateVoyageChip } from "@/components/voyage-dates"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/api"
import { exportRoomingPdf } from "@/lib/roomingPdf"
import {
  buildFamilies,
  buildPilgrimIndex,
  iconeGenre,
  initialeGenre,
  libelleGenre,
  libellePlacement,
  nomHotelCourt,
  styleVille,
  type Famille,
  type RoomingPlan,
  type RoomingRoom,
} from "@/lib/rooming"
import {
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  Building2,
  Crown,
  DoorOpen,
  FileDown,
  Layers,
  Loader2,
  Lock,
  Phone,
  Search,
  Users,
} from "lucide-react"

type Onglet = "plan" | "index"

/** Retire accents et casse : la recherche doit trouver « Aïcha » en tapant « aicha ». */
function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function CarteStat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone: string
}) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardContent className="flex items-center gap-3 p-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium leading-tight text-gray-500">{label}</p>
          <p className="text-xl font-bold leading-tight text-gray-900">{value}</p>
          {hint && <p className="text-[11px] leading-tight text-gray-400">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function PlanChambresPage() {
  const params = useParams()
  const programId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined)
  const { toast } = useToast()

  const [plan, setPlan] = useState<RoomingPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<Onglet>("plan")
  const [recherche, setRecherche] = useState("")
  const [exporting, setExporting] = useState(false)

  const chargerPlan = useCallback(async () => {
    if (!programId) return
    try {
      setLoading(true)
      setError(null)
      const res = await api.request(api.endpoints.roomingPlan(programId))
      const data = await res.json().catch(() => ({}))
      if (res.status === 401 || res.status === 403) {
        throw new Error("Session expirée — reconnectez-vous pour consulter le plan de chambres.")
      }
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Impossible de charger le plan de chambres")
      }
      setPlan(data as RoomingPlan)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    chargerPlan()
  }, [chargerPlan])

  const familles = useMemo(
    () => (plan ? buildFamilies(plan.villes) : new Map<string, Famille>()),
    [plan]
  )
  const pelerins = useMemo(() => (plan ? buildPilgrimIndex(plan.villes) : []), [plan])

  const famillesColorees = useMemo(
    () =>
      [...familles.values()]
        .filter((f): f is Famille & { colorIndex: number } => f.colorIndex !== null)
        .sort((a, b) => a.colorIndex - b.colorIndex),
    [familles]
  )

  const termeRecherche = normalise(recherche)

  /** Une chambre correspond si l'un de ses occupants (nom, tél., passeport, groupe) correspond. */
  const chambreCorrespond = useCallback(
    (room: RoomingRoom): boolean => {
      if (!termeRecherche) return true
      return room.occupants.some((o) => {
        const famille = familles.get(o.groupKey)
        return (
          normalise(o.nom).includes(termeRecherche)
          || normalise(o.phone).includes(termeRecherche)
          || normalise(o.passportNumber).includes(termeRecherche)
          || normalise(o.groupe).includes(termeRecherche)
          || (famille ? normalise(famille.label).includes(termeRecherche) : false)
        )
      })
    },
    [familles, termeRecherche]
  )

  const villesFiltrees = useMemo(() => {
    if (!plan) return []
    if (!termeRecherche) return plan.villes
    return plan.villes
      .map((ville) => ({
        ...ville,
        hotels: ville.hotels
          .map((hotel) => ({ ...hotel, rooms: hotel.rooms.filter(chambreCorrespond) }))
          .filter((hotel) => hotel.rooms.length > 0),
      }))
      .filter((ville) => ville.hotels.length > 0)
  }, [plan, termeRecherche, chambreCorrespond])

  const pelerinsFiltres = useMemo(() => {
    if (!termeRecherche) return pelerins
    return pelerins.filter(
      (p) =>
        normalise(p.nom).includes(termeRecherche)
        || normalise(p.phone).includes(termeRecherche)
        || normalise(p.passportNumber).includes(termeRecherche)
    )
  }, [pelerins, termeRecherche])

  const handleExportPdf = useCallback(async () => {
    if (!plan) return
    try {
      setExporting(true)
      const filename = await exportRoomingPdf(plan)
      toast({
        title: "Plan de chambres exporté",
        description: `${filename} — plan par hôtel + index alphabétique des pèlerins.`,
      })
    } catch (e) {
      toast({
        title: "Export impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }, [plan, toast])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
          <p className="mt-4 text-gray-600">Chargement du plan de chambres…</p>
        </div>
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-2xl font-bold text-gray-900">Plan indisponible</h2>
          <p className="mt-1 text-gray-600">{error}</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button onClick={chargerPlan}>Réessayer</Button>
            <Button variant="outline" asChild>
              <Link href="/">Retour au dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const { program, summary } = plan
  const programmeActif = program.status === "ACTIF" && !program.isDeleted

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <div className="mb-3">
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1 h-8 text-gray-600">
            <Link href="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Retour au dashboard
            </Link>
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold leading-tight text-gray-900">
                  🛏️ Plan de chambres
                </h1>
                {program.isDeleted && <Badge className="bg-yellow-500 text-white">Supprimé</Badge>}
                {program.status === "CLOTURE" && (
                  <Badge className="bg-orange-500 text-white">Clôturé</Badge>
                )}
                {program.status === "ARCHIVE" && (
                  <Badge className="bg-gray-500 text-white">Archivé</Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {program.name}
                {program.dureeJours > 0 && ` — ${program.dureeJours} jours`}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <DateVoyageChip type="depart" value={program.dateDepart} />
                <DateVoyageChip type="arrivee" value={program.dateArrivee} />
                <CompteARebours dateDepart={program.dateDepart} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un pèlerin, un téléphone…"
                  className="h-9 w-64 pl-8"
                />
              </div>
              <Button onClick={handleExportPdf} disabled={exporting} className="h-9">
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                {exporting ? "Export…" : "Exporter en PDF"}
              </Button>
            </div>
          </div>
        </div>

        <ProgramStatusBanner status={program.status as "ACTIF" | "CLOTURE" | "ARCHIVE"} />

        {/* Statistiques */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <CarteStat
            icon={<Users className="h-5 w-5 text-indigo-600" />}
            label="Pèlerins placés"
            value={String(summary.pelerins)}
            hint={`${summary.totalHotels} hôtel${summary.totalHotels > 1 ? "s" : ""}`}
            tone="bg-indigo-100"
          />
          <CarteStat
            icon={<BedDouble className="h-5 w-5 text-emerald-600" />}
            label="Places occupées"
            value={`${summary.placesOccupees} / ${summary.totalPlaces}`}
            hint={`${summary.placesRestantes} place${summary.placesRestantes > 1 ? "s" : ""} libre${
              summary.placesRestantes > 1 ? "s" : ""
            }`}
            tone="bg-emerald-100"
          />
          <CarteStat
            icon={<Layers className="h-5 w-5 text-blue-600" />}
            label="Chambres"
            value={String(summary.totalRooms)}
            hint={`${summary.chambresCompletes} complètes · ${summary.chambresPartielles} partielles`}
            tone="bg-blue-100"
          />
          <CarteStat
            icon={<DoorOpen className="h-5 w-5 text-amber-600" />}
            label="Chambres vides"
            value={String(summary.chambresVides)}
            hint="aucune place attribuée"
            tone="bg-amber-100"
          />
        </div>

        {/* Onglets */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <Button
              variant={onglet === "plan" ? "default" : "ghost"}
              size="sm"
              onClick={() => setOnglet("plan")}
              className="h-8 gap-2"
            >
              <BedDouble className="h-4 w-4" />
              Plan des chambres
            </Button>
            <Button
              variant={onglet === "index" ? "default" : "ghost"}
              size="sm"
              onClick={() => setOnglet("index")}
              className="h-8 gap-2"
            >
              <Users className="h-4 w-4" />
              Index des pèlerins
            </Button>
          </div>
          {recherche && (
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setRecherche("")}>
              Effacer la recherche
            </Button>
          )}
        </div>

        {/* Légende des familles */}
        {famillesColorees.length > 0 && (
          <Card className="mb-3 border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Familles / groupes — même couleur = même réservation, dans tous les hôtels
              </p>
              <div className="flex flex-wrap gap-1.5">
                {famillesColorees.map((famille) => (
                  <span
                    key={famille.groupKey}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: famille.color.bg,
                      borderColor: famille.color.accent,
                      color: famille.color.text,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: famille.color.accent }}
                    />
                    {famille.label}
                    <span className="opacity-70">({famille.taille})</span>
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Réservation individuelle
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contenu */}
        {onglet === "plan" ? (
          villesFiltrees.length === 0 ? (
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-8 text-center">
                <div className="mb-3 text-5xl">🛏️</div>
                <h3 className="mb-1 text-xl font-semibold text-gray-900">
                  {recherche ? "Aucun résultat" : "Aucune chambre pour ce programme"}
                </h3>
                <p className="text-gray-600">
                  {recherche
                    ? "Aucun pèlerin ne correspond à cette recherche."
                    : "Ajoutez des hôtels et des chambres au programme pour construire le plan."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {villesFiltrees.map((ville) => {
                const style = styleVille(ville.key)
                return (
                  <div
                    key={ville.key}
                    className={`overflow-hidden rounded-2xl border ${style.border} ${style.bg} shadow-sm`}
                  >
                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r ${style.gradient} px-3 py-2`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-lg ring-1 ring-white/30">
                          {style.icon}
                        </span>
                        <div>
                          <h2 className="text-base font-bold leading-none text-white">
                            {ville.label}
                          </h2>
                          <p className="mt-0.5 text-xs text-white/85">
                            {ville.hotels.length} hôtel{ville.hotels.length > 1 ? "s" : ""} ·{" "}
                            {ville.placesOccupees}/{ville.totalPlaces} places occupées
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 p-2 sm:p-3">
                      {ville.hotels.map((hotel) => (
                        <div
                          key={hotel.hotelId}
                          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Building2 className={`h-4 w-4 ${style.text}`} />
                              <h3 className="font-semibold text-gray-900">
                                {nomHotelCourt(hotel.hotelName)}
                              </h3>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {hotel.rooms.length} chambre{hotel.rooms.length > 1 ? "s" : ""} ·{" "}
                              {hotel.placesOccupees}/{hotel.totalPlaces} places
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
                            {hotel.rooms.map((room) => (
                              <CarteChambre
                                key={room.id}
                                room={room}
                                familles={familles}
                                programId={program.id}
                                reservationPossible={programmeActif}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          <TableauPelerins
            lignes={pelerinsFiltres}
            familles={familles}
            vide={
              recherche
                ? "Aucun pèlerin ne correspond à cette recherche."
                : "Aucun pèlerin n'est encore placé dans une chambre."
            }
          />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Carte d'une chambre                                                 */
/* ------------------------------------------------------------------ */

function CarteChambre({
  room,
  familles,
  programId,
  reservationPossible,
}: {
  room: RoomingRoom
  familles: Map<string, Famille>
  programId: number
  reservationPossible: boolean
}) {
  const occupantParPlace = new Map(room.occupants.map((o) => [o.place, o]))

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 bg-slate-50 px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-xs font-bold text-white">
            {room.numero}
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight text-gray-900">
              {room.roomTypeLabel}{" "}
              <span className="font-normal text-gray-500">({room.totalPlaces} places)</span>
            </p>
            <p className="text-[11px] leading-tight text-gray-500">
              {iconeGenre(room.gender)} {libelleGenre(room.gender)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {room.estChambrePrivee && (
            <Badge className="gap-1 bg-violet-600 text-[10px] text-white hover:bg-violet-600">
              <Lock className="h-3 w-3" />
              Privée
            </Badge>
          )}
          <Badge
            className={`text-[11px] ${
              room.estComplete
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                : room.estVide
                  ? "bg-slate-100 text-slate-600 hover:bg-slate-100"
                  : "bg-amber-100 text-amber-800 hover:bg-amber-100"
            }`}
          >
            {room.placesOccupees}/{room.totalPlaces}
          </Badge>
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {Array.from({ length: room.totalPlaces }, (_, i) => i + 1).map((place) => {
          const occupant = occupantParPlace.get(place)

          if (!occupant) {
            const contenu = (
              <>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-emerald-400 text-[11px] font-bold text-emerald-600">
                  {place}
                </span>
                <span className="text-sm italic text-emerald-700">Place libre</span>
              </>
            )
            return (
              <li key={place}>
                {reservationPossible ? (
                  <Link
                    href={`/reservations/nouvelle?programId=${programId}&roomId=${room.id}&place=${place - 1}`}
                    className="flex items-center gap-2 px-2.5 py-1.5 transition-colors hover:bg-emerald-50"
                    title="Réserver cette place"
                  >
                    {contenu}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 px-2.5 py-1.5">{contenu}</div>
                )}
              </li>
            )
          }

          const famille = familles.get(occupant.groupKey)
          const color = famille?.color
          const enFamille = Boolean(famille && famille.taille > 1)

          return (
            <li
              key={place}
              className="flex items-start gap-2 border-l-4 px-2.5 py-1.5"
              style={{
                backgroundColor: color?.bg,
                borderLeftColor: color?.accent,
              }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
                style={{ backgroundColor: color?.accent }}
              >
                {place}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="text-base font-semibold leading-tight"
                    style={{ color: color?.text }}
                  >
                    {occupant.nom}
                  </span>
                  <span className="text-xs text-gray-500">{initialeGenre(occupant.gender)}</span>
                  {enFamille && occupant.isLeader && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full bg-white/70 px-1.5 py-px text-[10px] font-semibold"
                      style={{ color: color?.text }}
                      title="Chef de groupe"
                    >
                      <Crown className="h-3 w-3" />
                      Chef
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-600">
                  {occupant.phone && (
                    <span className="inline-flex items-center gap-0.5">
                      <Phone className="h-3 w-3" />
                      {occupant.phone}
                    </span>
                  )}
                  {occupant.passportNumber && <span>N° {occupant.passportNumber}</span>}
                  {enFamille && famille && <span className="font-medium">{famille.label}</span>}
                  <span
                    className={
                      occupant.status === "Complet" ? "text-emerald-700" : "text-amber-700"
                    }
                  >
                    {occupant.status}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Index des pèlerins                                                  */
/* ------------------------------------------------------------------ */

function TableauPelerins({
  lignes,
  familles,
  vide,
}: {
  lignes: ReturnType<typeof buildPilgrimIndex>
  familles: Map<string, Famille>
  vide: string
}) {
  if (lignes.length === 0) {
    return (
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-8 text-center">
          <div className="mb-3 text-5xl">🔎</div>
          <p className="text-gray-600">{vide}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Nom et prénom</th>
              <th className="px-3 py-2 text-center font-semibold">H/F</th>
              <th className="px-3 py-2 text-left font-semibold">Téléphone</th>
              <th className="px-3 py-2 text-left font-semibold">Placement par hôtel</th>
              <th className="px-3 py-2 text-center font-semibold">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lignes.map((ligne) => {
              const famille = familles.get(ligne.groupKey)
              const enFamille = Boolean(famille && famille.taille > 1)
              return (
                <tr key={ligne.reservationId} style={{ backgroundColor: famille?.color.bg }}>
                  <td className="px-3 py-2">
                    <p className="font-semibold text-gray-900">{ligne.nom}</p>
                    {enFamille && famille && (
                      <p className="text-[11px]" style={{ color: famille.color.text }}>
                        {famille.label}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700">
                    {initialeGenre(ligne.gender)}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{ligne.phone || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {ligne.placements.map((p, i) => (
                        <span
                          key={`${p.ville}-${p.hotelName}-${i}`}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/80 px-1.5 py-0.5 text-[11px] text-gray-700"
                        >
                          <span className="font-semibold">{nomHotelCourt(p.hotelName)}</span>
                          <span className="text-gray-400">·</span>
                          {libellePlacement(p)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge
                      className={
                        ligne.status === "Complet"
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                      }
                    >
                      {ligne.status}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
