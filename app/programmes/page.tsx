"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Calendar,
  MapPin,
  Users,
  Search,
  Filter,
  ArrowUpRight,
  ChevronRight,
  Clock,
  Wallet,
  Building,
  Pencil,
  Plane,
  FileText,
  Bell,
  Settings,
  Trash2,
  AlertTriangle,
  Download,
  Bus,
  Lock,
  Archive,
  RotateCcw,
  Percent,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { DeleteConfirmation } from "@/components/ui/delete-confirmation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import RoleProtectedRoute from "../components/RoleProtectedRoute"
import { useToast } from "@/hooks/use-toast"

// Types pour les données de l'API
interface ProgramOverview {
  id: number;
  name: string;
  created_at: string;
  flightDeadline: string | null;
  hotelDeadline: string | null;
  visaDeadline: string | null;
  passportDeadline: string | null;
  exchange: number;
  nbJoursMadina: number;
  nbJoursMakkah: number;
  prixAvionDH: number;
  prixVisaRiyal: number;
  profit: number;
  
  hotelsMadina: Array<{
    id: number;
    name: string;
    city: string;
  }>;
  hotelsMakkah: Array<{
    id: number;
    name: string;
    city: string;
  }>;
  
  reservationsByRoom: {
    couple: {
      occupied: number;
      available: number;
      total: number;
    };
    three: {
      occupied: number;
      available: number;
      total: number;
    };
    four: {
      occupied: number;
      available: number;
      total: number;
    };
    five: {
      occupied: number;
      available: number;
      total: number;
    };
    total: {
      occupied: number;
      available: number;
      total: number;
    };
  };
  
  totalExpenses: number;
  totalRevenue: number;
  netProfit: number;
  
  expensesBreakdown: {
    hotel: number;
    flight: number;
    visa: number;
    other: number;
  };
  
  totalReservations: number;
  completedReservations: number;
  pendingReservations: number;
  transportStats: {
    withTransport: number;
    withoutTransport: number;
    total: number;
  };
  isDeleted?: boolean;
  deletedAt?: string | null;
  status?: 'ACTIF' | 'CLOTURE' | 'ARCHIVE';
  dateCloture?: string | null;
  dateArchivage?: string | null;
}

type ProgramStatusValue = 'ACTIF' | 'CLOTURE' | 'ARCHIVE';

// Badge de statut du cycle de vie : Actif (vert), Clôturé (orange), Archivé (gris)
const STATUS_BADGE: Record<ProgramStatusValue, { label: string; className: string }> = {
  ACTIF: { label: 'Actif', className: 'bg-green-100 text-green-800 border-green-200' },
  CLOTURE: { label: 'Clôturé', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  ARCHIVE: { label: 'Archivé', className: 'bg-gray-200 text-gray-700 border-gray-300' },
}

// Liserés de couleur attribués aux cartes de programme pour les distinguer en un coup d'œil
const PROGRAM_ACCENTS = [
  'border-l-indigo-500',
  'border-l-emerald-500',
  'border-l-sky-500',
  'border-l-violet-500',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-teal-500',
]

const getProgramAccentBorder = (index: number) => PROGRAM_ACCENTS[index % PROGRAM_ACCENTS.length]

// Dégradé de la barre de remplissage selon le taux (identique au Dashboard)
const getOccupancyGradient = (rate: number) => {
  if (rate >= 80) {
    // Presque complet → vert émeraude (objectif atteint)
    return {
      gradient: 'linear-gradient(90deg, #10b981 0%, #22c55e 100%)',
      glow: 'rgba(16, 185, 129, 0.45)',
    }
  }
  if (rate >= 40) {
    // En progression → bleu / indigo (couleurs du header)
    return {
      gradient: 'linear-gradient(90deg, #6366f1 0%, #3b82f6 50%, #0ea5e9 100%)',
      glow: 'rgba(99, 102, 241, 0.4)',
    }
  }
  // Faible remplissage → ambre (à remplir)
  return {
    gradient: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
    glow: 'rgba(245, 158, 11, 0.4)',
  }
}

// Barre de progression du remplissage d'un programme (réservations / places totales),
// même rendu que la barre d'occupation du Dashboard.
function ReservationProgressBar({
  occupied,
  total,
}: {
  occupied: number
  total: number
}) {
  const rate = total > 0 ? Math.min(Math.round((occupied / total) * 100), 100) : 0
  const { gradient, glow } = getOccupancyGradient(rate)
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
        <span className="flex items-center gap-1.5 text-blue-800">
          <Users className="h-3.5 w-3.5" />
          {occupied} réservation{occupied > 1 ? 's' : ''} sur {total} place{total > 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1 tabular-nums text-blue-700">
          <Percent className="h-3.5 w-3.5" />
          {rate}% rempli
        </span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-slate-200/70 shadow-inner ring-1 ring-black/5"
        style={{
          backgroundImage: 'linear-gradient(90deg, rgba(100, 116, 139, 0.12) 1px, transparent 1px)',
          backgroundSize: '12px 100%',
        }}
      >
        <div
          className="relative h-full overflow-hidden rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${rate}%`,
            backgroundImage: gradient,
            boxShadow: `0 1px 6px ${glow}`,
          }}
        >
          {/* Reflet brillant en surface */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </div>
    </div>
  )
}

export default function ProgrammesPage() {
  // Hook pour gérer l'authentification
  const { isAdmin, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [exportingProgramId, setExportingProgramId] = useState<number | null>(null)
  
  // États pour les filtres
  const [searchQuery, setSearchQuery] = useState("")
  const [programmeFilter, setProgrammeFilter] = useState("tous")
  // Filtre de statut du cycle de vie (distinct de la corbeille isDeleted). Défaut : Actifs.
  const [statusFilter, setStatusFilter] = useState<ProgramStatusValue | 'TOUS'>('ACTIF')
  const [programmes, setProgrammes] = useState<ProgramOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Confirmation de changement de statut (Radix AlertDialog)
  const [statusChange, setStatusChange] = useState<{
    isOpen: boolean
    programme: ProgramOverview | null
    target: ProgramStatusValue | null
  }>({ isOpen: false, programme: null, target: null })
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // Avertissement de clôture avec réservations non complètes (jamais bloquant)
  const [closeWarning, setCloseWarning] = useState<{
    isOpen: boolean
    programme: ProgramOverview | null
    incomplete: { id: number; name: string; reason: string }[]
  }>({ isOpen: false, programme: null, incomplete: [] })
  // Id du programme dont on vérifie les réservations avant clôture (spinner bouton)
  const [checkingCloseId, setCheckingCloseId] = useState<number | null>(null)
  
  // États pour la confirmation de suppression
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean
    programme: ProgramOverview | null
    isHardDelete?: boolean
  }>({
    isOpen: false,
    programme: null,
    isHardDelete: false
  })
  const [isDeleting, setIsDeleting] = useState(false)

  // Charger les programmes depuis l'API
  useEffect(() => {
    const fetchProgrammes = async () => {
      try {
        setLoading(true)
        
        const response = await fetch(api.url(api.endpoints.allProgramsOverview))
        if (!response.ok) {
          throw new Error('Erreur lors du chargement des programmes')
        }
        const data = await response.json()
        console.log('📥 Programmes reçus:', data.programs)
        console.log('📥 TOTAL PROGRAMMES:', data.programs?.length || 0)
        
        // Filtrer les programmes supprimés si l'agent n'est pas ADMIN
        const filteredPrograms = isAdmin 
          ? data.programs || []
          : (data.programs || []).filter((p: any) => !p.isDeleted)
        
        const deletedProgs = filteredPrograms.filter((p: any) => p.isDeleted) || []
        console.log('🗑️ PROGRAMMES SUPPRIMÉS dans les données:', deletedProgs.length)
        console.log('🗑️ Détail programmes supprimés:', deletedProgs)
        setProgrammes(filteredPrograms)
        
        // Log supplémentaire pour voir si les programmes sont bien filtrés
        const activeProgs = filteredPrograms.filter((p: any) => !p.isDeleted) || []
        console.log('✅ PROGRAMMES ACTIFS:', activeProgs.length)
      } catch (err) {
        console.error('Error fetching programmes:', err)
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    fetchProgrammes()
  }, [isAdmin])

  // Liste des programmes pour le filtre
  const programmesNoms = ["Tous", ...programmes.map((p) => p.name)]

  // Filtrage des programmes (actifs et supprimés séparés)
  const filteredProgrammes = programmes.filter((programme) => {
    const searchMatch = programme.name.toLowerCase().includes(searchQuery.toLowerCase())
    const programmeMatch = programmeFilter === "tous" || programme.name === programmeFilter
    return searchMatch && programmeMatch
  })
  
  // Séparer les programmes actifs et supprimés (axe corbeille, inchangé)
  const activeProgrammes = filteredProgrammes.filter(p => !p.isDeleted)
  const deletedProgrammes = filteredProgrammes.filter(p => p.isDeleted)

  // Filtrage par statut de cycle de vie (parmi les non supprimés)
  const visibleProgrammes = activeProgrammes.filter(p => {
    const st = (p.status || 'ACTIF') as ProgramStatusValue
    if (statusFilter === 'TOUS') return true
    return st === statusFilter
  })

  // Compteurs par statut pour les onglets
  const statusCounts = {
    ACTIF: activeProgrammes.filter(p => (p.status || 'ACTIF') === 'ACTIF').length,
    CLOTURE: activeProgrammes.filter(p => p.status === 'CLOTURE').length,
    ARCHIVE: activeProgrammes.filter(p => p.status === 'ARCHIVE').length,
    TOUS: activeProgrammes.length,
  }

  // Appliquer un changement de statut via PATCH /api/programs/:id/status
  const performStatusChange = async (programme: ProgramOverview, target: ProgramStatusValue) => {
    setIsUpdatingStatus(true)
    try {
      const response = await api.request(`/api/programs/${programme.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: target }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Erreur lors du changement de statut')
      }
      const updated = await response.json()
      setProgrammes(prev =>
        prev.map(p =>
          p.id === programme.id
            ? {
                ...p,
                status: updated.status,
                dateCloture: updated.dateCloture ?? null,
                dateArchivage: updated.dateArchivage ?? null,
              }
            : p
        )
      )
      const labels: Record<ProgramStatusValue, string> = {
        ACTIF: 'remis en actif',
        CLOTURE: 'clôturé',
        ARCHIVE: 'archivé',
      }
      toast({
        title: 'Statut mis à jour',
        description: `Programme « ${programme.name} » ${labels[target]}.`,
      })
      setStatusChange({ isOpen: false, programme: null, target: null })
      setCloseWarning({ isOpen: false, programme: null, incomplete: [] })
    } catch (e) {
      toast({
        title: 'Changement impossible',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleStatusChangeConfirm = async () => {
    if (!statusChange.programme || !statusChange.target) return
    await performStatusChange(statusChange.programme, statusChange.target)
  }

  // Raison courte d'incomplétude d'une réservation (première pertinente)
  const incompleteReason = (r: any): string => {
    if (!r.statutPasseport) return 'passeport en attente'
    if (!r.statutVisa) return 'visa en attente'
    if (!r.statutHotel) return 'hôtel en attente'
    if (!r.statutVol) return 'vol en attente'
    if (typeof r.paidAmount === 'number' && typeof r.price === 'number' && r.paidAmount < r.price)
      return 'paiement en attente'
    return 'dossier incomplet'
  }

  // Clic « Clôturer » : vérifier d'abord les réservations non complètes du programme.
  const handleCloturerClick = async (programme: ProgramOverview) => {
    setCheckingCloseId(programme.id)
    try {
      const res = await api.request(`/api/reservations?programId=${programme.id}&limit=1000`)
      if (!res.ok) throw new Error('fetch reservations failed')
      const data = await res.json()
      const list: any[] = Array.isArray(data?.reservations) ? data.reservations : []
      const incomplete = list
        .filter(r => r.status !== 'Complet')
        .map(r => ({
          id: r.id,
          name: `${String(r.lastName || '').toUpperCase()} ${r.firstName || ''}`.trim(),
          reason: incompleteReason(r),
        }))

      if (incomplete.length === 0) {
        // Toutes complètes → confirmation de clôture habituelle
        setStatusChange({ isOpen: true, programme, target: 'CLOTURE' })
      } else {
        setCloseWarning({ isOpen: true, programme, incomplete })
      }
    } catch {
      // En cas d'échec de vérification, ne pas bloquer : proposer la confirmation standard
      setStatusChange({ isOpen: true, programme, target: 'CLOTURE' })
    } finally {
      setCheckingCloseId(null)
    }
  }

  // Texte de confirmation selon le SENS de la transition (réouverture vs fermeture)
  const statusDialogText = (): { title: string; description: string } => {
    const rank: Record<ProgramStatusValue, number> = { ACTIF: 0, CLOTURE: 1, ARCHIVE: 2 }
    const current = (statusChange.programme?.status || 'ACTIF') as ProgramStatusValue
    const target = statusChange.target
    if (!target) return { title: '', description: '' }
    const isReopen = rank[target] < rank[current]
    if (isReopen) {
      return {
        title: 'Rouvrir ce programme ?',
        description:
          target === 'ACTIF'
            ? 'Il repassera en actif et redeviendra entièrement modifiable.'
            : 'Il repassera en clôturé : encaissements et statuts fournisseur redeviennent possibles.',
      }
    }
    if (target === 'CLOTURE') {
      return {
        title: 'Clôturer ce programme ?',
        description:
          "Il sortira de vos programmes actifs. Vous pourrez encore encaisser les paiements en attente.",
      }
    }
    return {
      title: 'Archiver ce programme ?',
      description: 'Il passera en lecture seule.',
    }
  }
  
  // Log pour debug
  console.log('🔍 Filtrage - Actifs:', activeProgrammes.length, 'Supprimés:', deletedProgrammes.length)

  // Fonctions pour la suppression
  const handleDeleteClick = (programme: ProgramOverview) => {
    setDeleteConfirmation({
      isOpen: true,
      programme,
      isHardDelete: false
    })
  }

  const handleHardDeleteClick = (programme: ProgramOverview) => {
    setDeleteConfirmation({
      isOpen: true,
      programme,
      isHardDelete: true
    })
  }

  const handleExportProgram = async (programId: number, programName: string) => {
    try {
      setExportingProgramId(programId)
      const params = new URLSearchParams({ programId: String(programId) })
      const res = await api.request(
        `${api.endpoints.exportReservationsAgency}?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Export échoué")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const safe = programName.replace(/[/\\?%*:[\]]/g, "_").slice(0, 40)
      a.download = `export-${safe}-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({
        title: "Export Excel",
        description: `Programme « ${programName} » exporté.`,
      })
    } catch (e) {
      toast({
        title: "Export impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      })
    } finally {
      setExportingProgramId(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation.programme) return
    
    setIsDeleting(true)
    try {
      const isHardDelete = deleteConfirmation.isHardDelete
      const endpoint = isHardDelete 
        ? `/api/programs/${deleteConfirmation.programme.id}/hard`
        : `/api/programs/${deleteConfirmation.programme.id}`
      
      // Appel à l'API de suppression
      const response = await api.request(api.url(endpoint), {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la suppression')
      }
      
      const result = await response.json()
      console.log('Programme supprimé:', result)
      
      // Mettre à jour la liste locale : supprimer le programme pour hard delete, marquer comme supprimé pour soft delete
      if (isHardDelete) {
        // Supprimer complètement de la liste pour hard delete
        setProgrammes(prev => prev.filter(p => p.id !== deleteConfirmation.programme!.id))
      } else {
        // Marquer comme supprimé pour soft delete
        setProgrammes(prev => prev.map(p => 
          p.id === deleteConfirmation.programme!.id 
            ? { ...p, isDeleted: true, deletedAt: result.program.deletedAt }
            : p
        ))
      }
      
      // Fermer la confirmation
      setDeleteConfirmation({ isOpen: false, programme: null, isHardDelete: false })
      
      // Message de succès
      const message = isHardDelete 
        ? `Programme "${deleteConfirmation.programme.name}" supprimé définitivement avec succès`
        : `Programme "${deleteConfirmation.programme.name}" supprimé avec succès`
      alert(message)
      
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      alert(`Erreur lors de la suppression: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmation({ isOpen: false, programme: null })
  }

  const getDateStatus = (dateLimit: string | null) => {
    if (!dateLimit) return { status: "unknown", text: "Non défini", color: "bg-gray-100 text-gray-800" }
    
    const today = new Date()
    const limit = new Date(dateLimit)
    const diffTime = limit.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return { status: "expired", text: "Expiré", color: "bg-red-100 text-red-800" }
    if (diffDays <= 10)
      return { status: "urgent", text: `${diffDays}j restants`, color: "bg-orange-100 text-orange-800" }
    return { status: "ok", text: `${diffDays}j restants`, color: "bg-green-100 text-green-800" }
  }

  // Fonction pour formater les dépenses pour l'affichage
  const getExpensesForDisplay = (programme: ProgramOverview) => {
    const breakdown = programme.expensesBreakdown || { hotel: 0, flight: 0, visa: 0, other: 0 }
    return [
      { type: "hotel", montant: breakdown.hotel || 0 },
      { type: "vol", montant: breakdown.flight || 0 },
      { type: "visa", montant: breakdown.visa || 0 },
      { type: "autre", montant: breakdown.other || 0 },
    ].filter(expense => expense.montant > 0)
  }

  // Composant pour afficher les places avec animation
  const RoomCapacityDisplay = ({ 
    roomType, 
    data, 
    index 
  }: { 
    roomType: string; 
    data: { occupied: number; available: number; total: number }; 
    index: number;
  }) => {
    const occupiedPercentage = data.total > 0 ? (data.occupied / data.total) * 100 : 0;
    const availablePercentage = data.total > 0 ? (data.available / data.total) * 100 : 0;
    
    return (
      <div
        className="flex justify-between items-center gap-3 rounded-lg px-1 py-0.5 transition-colors hover:bg-blue-50/60 animate-fadeInUp"
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <span className="text-sm font-medium text-gray-700">{roomType}</span>
        <div className="flex items-center gap-3">
          <div className="w-32 bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner ring-1 ring-black/5">
            <div className="h-full flex">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000 ease-out"
                style={{ width: `${occupiedPercentage}%` }}
              ></div>
              <div
                className="bg-gradient-to-r from-green-400 to-green-500 transition-all duration-1000 ease-out"
                style={{ width: `${availablePercentage}%` }}
              ></div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs tabular-nums">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-blue-700 font-semibold">{data.occupied}</span>
            </div>
            <span className="text-gray-400">/</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-green-700 font-semibold">{data.available}</span>
            </div>
            <span className="text-gray-500">({data.total})</span>
          </div>
        </div>
      </div>
    )
  }

  // Affichage de chargement
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des programmes...</p>
        </div>
      </div>
    )
  }

  // Affichage d'erreur
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erreur de chargement</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <RoleProtectedRoute allowedRoles={['ADMIN']} fallbackPath="/reservations">
      <>
        <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* En-tête */}
        <div className="mb-3 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 shadow-lg">
          <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 ring-1 ring-white/30">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight tracking-tight text-white">Gestion des Programmes</h1>
                <p className="text-sm leading-tight text-white/85">Créez et gérez vos programmes de voyage Omra</p>
              </div>
            </div>
            {isAdmin && (
              <Link href="/programmes/nouveau">
                <Button className="bg-white text-blue-700 shadow-md transition-all hover:bg-blue-50 hover:shadow-lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau Programme
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Filtres et recherche */}
        <Card className="mb-3 overflow-hidden border border-slate-200 shadow-sm">
          <CardContent className="p-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher un programme..."
                    className="h-9 rounded-lg border-slate-200 bg-slate-50/70 pl-10 transition-colors focus:border-blue-500 focus:bg-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="w-full md:w-64">
                <Select value={programmeFilter} onValueChange={(value) => setProgrammeFilter(value)}>
                  <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/70 text-blue-700 transition-colors hover:bg-blue-50">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Tous les programmes" />
                  </SelectTrigger>
                  <SelectContent>
                    {programmesNoms.map((programme, index) => (
                      <SelectItem key={index} value={index === 0 ? "tous" : programme}>
                        {programme}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistiques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <Card className="border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Programmes</p>
                <p className="text-xl font-bold leading-tight text-indigo-600">{filteredProgrammes.length}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Réservations</p>
                <p className="text-xl font-bold leading-tight text-blue-600">
                  {filteredProgrammes.reduce((sum, p) => sum + (p.reservationsByRoom?.total?.occupied || 0), 0)}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-gray-600">Revenus Total</p>
                <p className="text-xl font-bold leading-tight text-green-600">
                  {filteredProgrammes.reduce((sum, p) => sum + (p.totalRevenue || 0), 0).toLocaleString()} DH
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-gray-600">Hôtels Partenaires</p>
                <p className="text-xl font-bold leading-tight text-amber-600">8</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                <Building className="h-5 w-5 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Onglets de statut du cycle de vie (distincts de la corbeille) */}
        <div className="mb-3 inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {([
            { key: 'ACTIF', label: 'Actifs' },
            { key: 'CLOTURE', label: 'Clôturés' },
            { key: 'ARCHIVE', label: 'Archivés' },
            { key: 'TOUS', label: 'Tous' },
          ] as const).map(({ key, label }) => (
            <Button
              key={key}
              type="button"
              variant="ghost"
              size="sm"
              className={
                statusFilter === key
                  ? 'rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 hover:text-white'
                  : 'rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-700'
              }
              onClick={() => setStatusFilter(key)}
            >
              {label}
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                  statusFilter === key ? 'bg-white/25 text-white' : 'bg-slate-100 text-gray-600'
                }`}
              >
                {statusCounts[key]}
              </span>
            </Button>
          ))}
        </div>

        {/* Liste des programmes (filtrés par statut) */}
        <div className="space-y-3">
          {visibleProgrammes.length === 0 && (
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-8 text-center">
                <div className="mb-3 text-5xl">🗓️</div>
                <h3 className="mb-1 text-lg font-semibold text-gray-900">Aucun programme dans cette vue</h3>
                <p className="text-sm text-gray-500">Changez de filtre ou créez un nouveau programme.</p>
              </CardContent>
            </Card>
          )}
          {visibleProgrammes.map((programme, programmeIndex) => (
            <Card
              key={programme.id}
              className={`overflow-hidden border border-slate-200 border-l-4 ${getProgramAccentBorder(programmeIndex)} shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all`}
            >
              <CardHeader className="bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 px-4 py-3 border-b border-blue-100/60">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-lg shadow-sm ring-1 ring-blue-100">
                      🎯
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg text-blue-800">{programme.name}</CardTitle>
                        <Badge
                          variant="outline"
                          className={STATUS_BADGE[(programme.status || 'ACTIF') as ProgramStatusValue].className}
                        >
                          {STATUS_BADGE[(programme.status || 'ACTIF') as ProgramStatusValue].label}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Créé le {new Date(programme.created_at).toLocaleDateString("fr-FR")}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-100/70 px-2 py-1">
                      <Users className="h-4 w-4 text-blue-700" />
                      <div>
                        <p className="text-xs font-medium text-blue-800">Réservations</p>
                        <p className="text-sm font-bold tabular-nums text-blue-900">
                          {programme.reservationsByRoom?.total?.occupied || 0} /{" "}
                          {programme.reservationsByRoom?.total?.total || 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-100/70 px-2 py-1">
                      <Wallet className="h-4 w-4 text-yellow-700" />
                      <div>
                        <p className="text-xs font-medium text-yellow-800">Revenus</p>
                        <p className="text-sm font-bold tabular-nums text-yellow-900">
                          {(programme.totalRevenue || 0).toLocaleString()} DH
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barre de progression des réservations (même rendu que le Dashboard) */}
                <ReservationProgressBar
                  occupied={programme.reservationsByRoom?.total?.occupied || 0}
                  total={programme.reservationsByRoom?.total?.total || 0}
                />
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="h-auto w-full justify-start rounded-none border-b border-blue-100 bg-gradient-to-r from-slate-50 to-blue-50 px-4 pb-0 pt-1">
                    <TabsTrigger
                      value="details"
                      className="rounded-b-none border-b-2 border-transparent px-3 pb-2 text-gray-600 data-[state=active]:border-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-none"
                    >
                      Détails
                    </TabsTrigger>
                    <TabsTrigger
                      value="reservations"
                      className="rounded-b-none border-b-2 border-transparent px-3 pb-2 text-gray-600 data-[state=active]:border-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-none"
                    >
                      Réservations
                    </TabsTrigger>
                    {isAdmin && (
                      <TabsTrigger
                        value="finances"
                        className="rounded-b-none border-b-2 border-transparent px-3 pb-2 text-gray-600 data-[state=active]:border-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-none"
                      >
                        Finances
                      </TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="details" className="p-3 space-y-3">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      {/* Hôtels */}
                      <div className="bg-gradient-to-br from-white to-blue-50/40 p-3 rounded-lg shadow-sm border border-blue-100">
                        <h4 className="font-medium mb-2 flex items-center gap-2 text-blue-700">
                          <MapPin className="h-4 w-4" />
                          Hôtels
                        </h4>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-blue-700 mb-1">Madina</p>
                            <div className="flex flex-wrap gap-2">
                              {programme.hotelsMadina.map((hotel, index) => (
                                <Badge
                                  key={index}
                                  variant="outline"
                                  className="bg-yellow-50 text-yellow-700 border-yellow-200 py-1"
                                >
                                  {hotel.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-blue-700 mb-1">Makkah</p>
                            <div className="flex flex-wrap gap-2">
                              {programme.hotelsMakkah.map((hotel, index) => (
                                <Badge
                                  key={index}
                                  variant="outline"
                                  className="bg-blue-50 text-blue-700 border-blue-200 py-1"
                                >
                                  {hotel.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-indigo-700 flex items-center gap-2">
                              <Bus className="h-4 w-4" />
                              Transport
                            </p>
                            <Badge className="bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">
                              {(programme.transportStats?.withTransport || 0)}/{(programme.transportStats?.total || 0)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-indigo-700/80">
                            Avec transport: {programme.transportStats?.withTransport || 0} • Sans transport:{" "}
                            {programme.transportStats?.withoutTransport || 0}
                          </p>
                        </div>
                      </div>

                      {/* Réservations par type de chambre */}
                      <div className="bg-gradient-to-br from-white to-indigo-50/30 p-3 rounded-lg shadow-sm border border-blue-100">
                        <h4 className="font-medium mb-2 flex items-center gap-2 text-blue-700">
                          <Users className="h-5 w-5" />
                          Réservations par chambre
                        </h4>
                        <div className="space-y-4">
                          <RoomCapacityDisplay 
                            roomType="Couple" 
                            data={programme.reservationsByRoom?.couple || { occupied: 0, available: 0, total: 0 }} 
                            index={0}
                          />
                          <RoomCapacityDisplay 
                            roomType="3 personnes" 
                            data={programme.reservationsByRoom?.three || { occupied: 0, available: 0, total: 0 }} 
                            index={1}
                          />
                          <RoomCapacityDisplay 
                            roomType="4 personnes" 
                            data={programme.reservationsByRoom?.four || { occupied: 0, available: 0, total: 0 }} 
                            index={2}
                          />
                          <RoomCapacityDisplay 
                            roomType="5 personnes" 
                            data={programme.reservationsByRoom?.five || { occupied: 0, available: 0, total: 0 }} 
                            index={3}
                          />
                        </div>
                      </div>

                      {/* Dates limites */}
                      <div className="bg-gradient-to-br from-white to-orange-50/40 p-4 rounded-lg shadow-sm border border-orange-100">
                        <h4 className="font-medium mb-3 flex items-center gap-2 text-orange-700">
                          <Clock className="h-5 w-5" />
                          Échéances
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Visa
                            </span>
                            <div className="text-right">
                              <Badge className={getDateStatus(programme.visaDeadline).color}>
                                {getDateStatus(programme.visaDeadline).text}
                              </Badge>
                              {programme.visaDeadline && (
                              <p className="text-xs text-gray-500 mt-1">
                                  {new Date(programme.visaDeadline).toLocaleDateString("fr-FR")}
                              </p>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm flex items-center gap-1">
                              <Building className="h-4 w-4" />
                              Hôtels
                            </span>
                            <div className="text-right">
                              <Badge className={getDateStatus(programme.hotelDeadline).color}>
                                {getDateStatus(programme.hotelDeadline).text}
                              </Badge>
                              {programme.hotelDeadline && (
                              <p className="text-xs text-gray-500 mt-1">
                                  {new Date(programme.hotelDeadline).toLocaleDateString("fr-FR")}
                              </p>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm flex items-center gap-1">
                              <Plane className="h-4 w-4" />
                              Billets
                            </span>
                            <div className="text-right">
                              <Badge className={getDateStatus(programme.flightDeadline).color}>
                                {getDateStatus(programme.flightDeadline).text}
                              </Badge>
                              {programme.flightDeadline && (
                              <p className="text-xs text-gray-500 mt-1">
                                  {new Date(programme.flightDeadline).toLocaleDateString("fr-FR")}
                              </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="reservations" className="p-3">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">Répartition des réservations</h3>
                        <Link href={`/reservations?programme=${programme.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-200 text-blue-700 hover:bg-blue-50"
                          >
                            Voir toutes les réservations
                            <ArrowUpRight className="ml-1 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-gradient-to-br from-white to-blue-50/40 p-3 rounded-lg shadow-sm border border-blue-100">
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Par type de chambre</h4>
                          <div className="space-y-3">
                            <RoomCapacityDisplay 
                              roomType="Couple" 
                              data={programme.reservationsByRoom?.couple || { occupied: 0, available: 0, total: 0 }} 
                              index={0}
                            />
                            <RoomCapacityDisplay 
                              roomType="3 personnes" 
                              data={programme.reservationsByRoom?.three || { occupied: 0, available: 0, total: 0 }} 
                              index={1}
                            />
                            <RoomCapacityDisplay 
                              roomType="4 personnes" 
                              data={programme.reservationsByRoom?.four || { occupied: 0, available: 0, total: 0 }} 
                              index={2}
                            />
                            <RoomCapacityDisplay 
                              roomType="5 personnes" 
                              data={programme.reservationsByRoom?.five || { occupied: 0, available: 0, total: 0 }} 
                              index={3}
                            />
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-white to-indigo-50/30 p-3 rounded-lg shadow-sm border border-blue-100">
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Statistiques</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="text-center p-2 bg-blue-50 rounded-lg">
                              <p className="text-sm text-gray-500">Total</p>
                              <p className="text-xl font-bold text-blue-700">{programme.reservationsByRoom?.total?.occupied || 0}</p>
                            </div>
                            <div className="text-center p-2 bg-green-50 rounded-lg">
                              <p className="text-sm text-gray-500">Montant</p>
                              <p className="text-xl font-bold text-green-700">
                                {(programme.totalRevenue || 0).toLocaleString()} DH
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {isAdmin && (
                    <TabsContent value="finances" className="p-3">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-gradient-to-br from-white to-green-50/30 p-3 rounded-lg shadow-sm border border-green-100">
                            <h4 className="text-sm font-medium text-gray-500 mb-2">Revenus</h4>
                            <p className="text-xl font-bold leading-tight text-green-600">
                              {(programme.totalRevenue || 0).toLocaleString()} DH
                            </p>
                            <p className="text-xs text-gray-500">Total des paiements</p>
                          </div>

                          <div className="bg-gradient-to-br from-white to-red-50/30 p-3 rounded-lg shadow-sm border border-red-100">
                            <h4 className="text-sm font-medium text-gray-500 mb-2">Dépenses</h4>
                            <p className="text-xl font-bold leading-tight text-red-600">
                              {(programme.totalExpenses || 0).toLocaleString()} DH
                            </p>
                            <p className="text-xs text-gray-500">Total des coûts</p>
                          </div>

                          <div className="bg-gradient-to-br from-white to-blue-50/30 p-3 rounded-lg shadow-sm border border-blue-100">
                            <h4 className="text-sm font-medium text-gray-500 mb-2">Bénéfice</h4>
                            <p className="text-xl font-bold leading-tight text-blue-600">
                              {(programme.netProfit || 0).toLocaleString()} DH
                            </p>
                            <p className="text-xs text-gray-500">Revenus - Dépenses</p>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-white to-slate-50 p-3 rounded-lg shadow-sm border border-slate-200">
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Répartition des dépenses</h4>
                          <div className="space-y-3">
                            {getExpensesForDisplay(programme).map((depense, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {depense.type === "hotel" && <Building className="h-4 w-4 text-yellow-600" />}
                                  {depense.type === "vol" && <Plane className="h-4 w-4 text-blue-600" />}
                                  {depense.type === "visa" && <FileText className="h-4 w-4 text-green-600" />}
                                  {depense.type === "autre" && <FileText className="h-4 w-4 text-gray-600" />}
                                  <span className="text-sm capitalize">{depense.type}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`${
                                        depense.type === "hotel"
                                          ? "bg-yellow-600"
                                          : depense.type === "vol"
                                            ? "bg-blue-600"
                                            : depense.type === "visa"
                                              ? "bg-green-600"
                                              : "bg-gray-600"
                                      } h-2 rounded-full`}
                                      style={{
                                        width: `${(programme.totalExpenses || 0) > 0 ? (depense.montant / (programme.totalExpenses || 1)) * 100 : 0}%`,
                                      }}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-medium">{depense.montant.toLocaleString()} DH</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
                  {/* Boutons à gauche */}
                  <div className="flex flex-wrap gap-2">
                    {/* Boutons commentés temporairement */}
                    {/* <Link href={`/programmes/${programme.id}`}>
                      <Button variant="outline" size="sm" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                        Voir détails
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/programmes/${programme.id}/edit`}>
                      <Button variant="outline" size="sm" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                        Modifier
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link> */}
                    
                    <Link href={`/reservations?programme=${programme.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                      >
                        <Users className="mr-1 h-4 w-4" />
                        Voir les réservations
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                    
                    {/* Bouton "Voir dépenses" visible seulement pour les ADMIN */}
                    {isAdmin && (
                      <Link href={`/depenses?programme=${programme.id}`}>
                        <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50">
                          Voir dépenses
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                      disabled={exportingProgramId === programme.id}
                      onClick={() => handleExportProgram(programme.id, programme.name)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      {exportingProgramId === programme.id ? "Export…" : "Excel agence"}
                    </Button>
                  </div>
                  
                {/* Boutons d'action à droite */}
                <div className="flex gap-2 flex-wrap">
                  {/* Actions de cycle de vie (Radix AlertDialog) */}
                  {isAdmin && (programme.status || 'ACTIF') === 'ACTIF' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-orange-300 text-orange-700 hover:bg-orange-50"
                      disabled={checkingCloseId === programme.id}
                      onClick={() => handleCloturerClick(programme)}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      {checkingCloseId === programme.id ? 'Vérification…' : 'Clôturer'}
                    </Button>
                  )}
                  {isAdmin && programme.status === 'CLOTURE' && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-gray-300 text-gray-700 hover:bg-gray-100"
                        onClick={() =>
                          setStatusChange({ isOpen: true, programme, target: 'ARCHIVE' })
                        }
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archiver
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() =>
                          setStatusChange({ isOpen: true, programme, target: 'ACTIF' })
                        }
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Rouvrir
                      </Button>
                    </>
                  )}
                  {isAdmin && programme.status === 'ARCHIVE' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() =>
                        setStatusChange({ isOpen: true, programme, target: 'CLOTURE' })
                      }
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Rouvrir
                    </Button>
                  )}
                  {/* Éditer */}
                  {isAdmin && (
                    <Link href={`/programmes/modifier/${programme.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Éditer
                      </Button>
                    </Link>
                  )}
                  {/* Soft Delete - Commenté */}
                  {/* <Button
                    variant="outline"
                    size="sm"
                    className="border-orange-200 text-orange-700 hover:bg-orange-50"
                    onClick={() => handleDeleteClick(programme)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button> */}
                  
                  {/* Hard Delete - Visible seulement pour les ADMIN */}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => handleHardDeleteClick(programme)}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Supprimer définitivement
                    </Button>
                  )}
                </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Liste des programmes supprimés */}
        {deletedProgrammes.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Programmes supprimés (Soft Delete)
            </h2>
            <div className="space-y-3">
              {deletedProgrammes.map((programme) => (
                <Card key={programme.id} className="border-2 border-yellow-300 bg-yellow-50 shadow-lg hover:shadow-xl transition-all overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-yellow-100 to-yellow-200 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-yellow-500 text-white">Supprimé</Badge>
                          <CardTitle className="text-xl text-yellow-800">{programme.name}</CardTitle>
                        </div>
                        <CardDescription className="mt-1">
                          Créé le {new Date(programme.created_at).toLocaleDateString("fr-FR")}
                          {programme.deletedAt && (
                            <span className="ml-2 text-orange-700">
                              - Supprimé le {new Date(programme.deletedAt).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-yellow-700">
                          {(programme.totalRevenue || 0).toLocaleString()} DH
                        </div>
                        <p className="text-sm text-yellow-800">{programme.reservationsByRoom?.total?.occupied || 0} réservations</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
                      <p className="text-sm text-yellow-900">
                        <AlertTriangle className="h-4 w-4 inline mr-2" />
                        Ce programme a été supprimé temporairement (soft delete). Les données sont préservées et peuvent être récupérées si nécessaire.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Composant de confirmation de suppression */}
        <DeleteConfirmation
          isOpen={deleteConfirmation.isOpen}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          title={deleteConfirmation.isHardDelete ? "Supprimer définitivement le programme" : "Supprimer le programme"}
          description={deleteConfirmation.isHardDelete 
            ? "⚠️ ATTENTION : Cette action supprimera DÉFINITIVEMENT le programme et TOUTES ses données associées. Cette action est IRRÉVERSIBLE et ne peut pas être annulée."
            : "Cette action masquera le programme de la liste. Les données seront préservées et pourront être récupérées si nécessaire."
          }
          itemName={deleteConfirmation.programme?.name || ""}
          loading={isDeleting}
          isHardDelete={deleteConfirmation.isHardDelete}
        />

      {/* Confirmation de changement de statut du cycle de vie */}
      <AlertDialog
        open={statusChange.isOpen}
        onOpenChange={(open) => {
          if (!open && !isUpdatingStatus) {
            setStatusChange({ isOpen: false, programme: null, target: null })
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{statusDialogText().title}</AlertDialogTitle>
            <AlertDialogDescription>
              {statusChange.programme ? `Programme « ${statusChange.programme.name} ». ` : ''}
              {statusDialogText().description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingStatus}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleStatusChangeConfirm()
              }}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? 'En cours…' : 'Confirmer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Avertissement de clôture : réservations non complètes (informatif, jamais bloquant) */}
      <AlertDialog
        open={closeWarning.isOpen}
        onOpenChange={(open) => {
          if (!open && !isUpdatingStatus) {
            setCloseWarning({ isOpen: false, programme: null, incomplete: [] })
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer malgré des réservations non complètes ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {closeWarning.programme ? (
                  <p className="mb-2">
                    Le programme « {closeWarning.programme.name} » compte{' '}
                    <strong>{closeWarning.incomplete.length}</strong> réservation
                    {closeWarning.incomplete.length > 1 ? 's' : ''} non complète
                    {closeWarning.incomplete.length > 1 ? 's' : ''}. Vous pourrez toujours encaisser
                    les paiements et mettre à jour les statuts après la clôture.
                  </p>
                ) : null}
                <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-2">
                  <ul className="space-y-1 text-sm">
                    {closeWarning.incomplete.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-800">{r.name}</span>
                        <span className="text-xs text-orange-700 whitespace-nowrap">{r.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingStatus}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (closeWarning.programme) {
                  performStatusChange(closeWarning.programme, 'CLOTURE')
                }
              }}
              disabled={isUpdatingStatus}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isUpdatingStatus ? 'Clôture…' : 'Clôturer quand même'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </>
    </RoleProtectedRoute>
  )
}
