"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Plane, Building, Receipt, Bell, Settings, Calendar, Users, Wallet, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"

// Types
type Expense = {
  id: number
  date: string
  programme: string
  type: string
  description: string
  montant: number
  statut: string
  reservation?: {
    id: number
    nom: string
  }
}

type Program = {
  id: number
  name: string
}

type Stats = {
  total: number
  count: number
  byType: {
    Vol: number
    'Hotel Madina': number
    'Hotel Makkah': number
    Visa: number
    Autre: number
  }
}

export default function DepensesPage() {
  // Hook pour gérer l'authentification
  const { isAdmin, loading: authLoading } = useAuth()
  
  // États pour les données
  const [depenses, setDepenses] = useState<Expense[]>([])
  const [programmes, setProgrammes] = useState<Program[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0,
    count: 0,
    byType: { Vol: 0, 'Hotel Madina': 0, 'Hotel Makkah': 0, Visa: 0, Autre: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // États pour les filtres
  const [searchQuery, setSearchQuery] = useState("")
  const [programmeFilter, setProgrammeFilter] = useState("tous")
  const [typeFilter, setTypeFilter] = useState("tous")

  const typesDepense = ["Tous", "Vol", "Hotel Madina", "Hotel Makkah", "Visa", "Autre"]

  // Fonction pour charger les données
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Construire les paramètres de requête
      const params = new URLSearchParams({
        search: searchQuery,
        program: programmeFilter,
        type: typeFilter,
        page: '1',
        limit: '100' // Charger toutes les dépenses pour l'instant
      })

      const [expensesRes, programsRes, statsRes] = await Promise.all([
        fetch(api.url(`/api/expenses?${params}`)),
        fetch(api.url(api.endpoints.programs)),
        fetch(api.url(`/api/expenses/stats?${params}`))
      ])

      if (!expensesRes.ok || !programsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const expensesData = await expensesRes.json()
      const programsData = await programsRes.json()
      const statsData = await statsRes.json()

      setDepenses(expensesData.expenses)
      setProgrammes(programsData)
      setStats(statsData)

    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, programmeFilter, typeFilter])

  // Charger les données au montage du composant
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtrage des dépenses (maintenant côté client pour la recherche instantanée)
  const filteredDepenses = depenses.filter((depense) => {
    const searchMatch =
      depense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      depense.programme.toLowerCase().includes(searchQuery.toLowerCase()) ||
      depense.type.toLowerCase().includes(searchQuery.toLowerCase())

    const programmeMatch = programmeFilter === "tous" || depense.programme === programmeFilter
    const typeMatch = typeFilter === "tous" || depense.type === typeFilter

    return searchMatch && programmeMatch && typeMatch
  })

  // Utiliser les statistiques de l'API ou calculer côté client
  const totalDepenses = (typeof stats.total === 'number' ? stats.total : (stats.total as any)?.amount) || filteredDepenses.reduce((sum, depense) => sum + depense.montant, 0)
  const depensesVol = stats.byType?.Vol || filteredDepenses.filter((d) => d.type === "Vol").reduce((sum, d) => sum + d.montant, 0)
  const depensesHotelMadina = stats.byType?.['Hotel Madina'] || filteredDepenses.filter((d) => d.type === "Hotel Madina").reduce((sum, d) => sum + d.montant, 0)
  const depensesHotelMakkah = stats.byType?.['Hotel Makkah'] || filteredDepenses.filter((d) => d.type === "Hotel Makkah").reduce((sum, d) => sum + d.montant, 0)
  const depensesVisa = stats.byType?.Visa || filteredDepenses.filter((d) => d.type === "Visa").reduce((sum, d) => sum + d.montant, 0)
  const depensesAutre = stats.byType?.Autre || filteredDepenses.filter((d) => d.type === "Autre").reduce((sum, d) => sum + d.montant, 0)

  const depensesPayees = filteredDepenses
    .filter((d) => d.statut === "payé")
    .reduce((sum, depense) => sum + depense.montant, 0)
  const depensesEnAttente = filteredDepenses
    .filter((d) => d.statut === "en_attente")
    .reduce((sum, depense) => sum + depense.montant, 0)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Vol":
        return <Plane className="h-4 w-4" />
      case "Hotel Madina":
      case "Hotel Makkah":
        return <Building className="h-4 w-4" />
      case "Visa":
        return <Receipt className="h-4 w-4" />
      default:
        return <Receipt className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Vol":
        return "bg-blue-100 text-blue-800"
      case "Hotel Madina":
        return "bg-green-100 text-green-800"
      case "Hotel Makkah":
        return "bg-emerald-100 text-emerald-800"
      case "Visa":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case "payé":
        return "bg-green-100 text-green-800"
      case "en_attente":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement des dépenses...</p>
          </div>
        </div>
      </div>
    );
  }

  // Contrôle d'accès ADMIN uniquement
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="p-8 text-center border-2 border-red-200 bg-red-50">
            <CardContent>
              <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-red-800 mb-2">Accès Refusé</h2>
              <p className="text-gray-700">
                Cette page est réservée aux administrateurs uniquement.
              </p>
              <Link href="/">
                <Button className="mt-6">
                  Retour au Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center text-red-600">
            <p>Erreur: {error}</p>
            <Button 
              onClick={() => fetchData()} 
              className="mt-4"
            >
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Dépenses</h1>
          <Link href="/depenses/nouvelle">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Dépense
            </Button>
          </Link>
        </div>

        {/* Statistiques - 6 cards : Total, Vol, Hôtel Madina, Hôtel Makkah, Visa, Autre */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <Receipt className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{totalDepenses.toLocaleString()} DH</div>
                  <div className="text-xs text-white/80">dépenses</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Total Dépenses</h3>
                <p className="text-xs text-white/80">Filtres appliqués</p>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <Plane className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{depensesVol.toLocaleString()} DH</div>
                  <div className="text-xs text-white/80">vol</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Dépenses Vol</h3>
                <p className="text-xs text-white/80">Filtres appliqués</p>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <Building className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{depensesHotelMadina.toLocaleString()} DH</div>
                  <div className="text-xs text-white/80">Madina</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Hôtel Madina</h3>
                <p className="text-xs text-white/80">Filtres appliqués</p>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <Building className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{depensesHotelMakkah.toLocaleString()} DH</div>
                  <div className="text-xs text-white/80">Makkah</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Hôtel Makkah</h3>
                <p className="text-xs text-white/80">Filtres appliqués</p>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <Receipt className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{depensesVisa.toLocaleString()} DH</div>
                  <div className="text-xs text-white/80">visa</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Dépenses Visa</h3>
                <p className="text-xs text-white/80">Filtres appliqués</p>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-gray-500 via-gray-600 to-gray-700 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <Receipt className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{depensesAutre.toLocaleString()} DH</div>
                  <div className="text-xs text-white/80">autre</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Dépenses Autre</h3>
                <p className="text-xs text-white/80">Filtres appliqués</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres */}
        <Card className="mb-6">
          <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select value={programmeFilter} onValueChange={(value) => setProgrammeFilter(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les programmes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tous les programmes</SelectItem>
                    {programmes.map((programme) => (
                      <SelectItem key={programme.id} value={programme.name}>
                        {programme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    {typesDepense.map((type, index) => (
                      <SelectItem key={index} value={index === 0 ? "tous" : type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
          </CardContent>
        </Card>

        {/* Liste des Dépenses - design amélioré et colonnes stables */}
        <Card className="border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-blue-800 flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5 text-blue-600" />
                Liste des Dépenses
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Header de colonnes */}
            <div className="hidden md:grid grid-cols-5 gap-2 px-6 py-2 bg-blue-100 border-b border-blue-200 rounded-t-xl font-semibold text-blue-900 text-sm uppercase tracking-wide">
              <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Date</div>
              <div className="flex items-center gap-1"><Users className="h-4 w-4" /> Programme</div>
              <div className="flex items-center gap-1"><Receipt className="h-4 w-4" /> Type</div>
              <div>Description</div>
              <div className="text-right">Montant</div>
            </div>
            <div className="divide-y">
              {filteredDepenses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
                    <Receipt className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune dépense trouvée</h3>
                  <p className="text-gray-500 mb-4">
                    {searchQuery || programmeFilter !== "tous" || typeFilter !== "tous" 
                      ? "Aucune dépense ne correspond aux filtres appliqués."
                      : "Commencez par ajouter une nouvelle dépense."
                    }
                  </p>
                  <Link href="/depenses/nouvelle">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter une dépense
                    </Button>
                  </Link>
                </div>
              ) : (
                filteredDepenses.map((depense) => (
                <div key={depense.id} className="mx-2 mb-3">
                  <div className="relative group transition-all duration-300 rounded-xl shadow border hover:scale-[1.01] hover:shadow-xl bg-white grid grid-cols-1 md:grid-cols-5 gap-2 p-4 items-center">
                    {/* Date */}
                    <div className="flex items-center gap-2 min-w-[110px]">
                      <Calendar className="h-5 w-5 text-blue-400" />
                      <span className="font-medium text-gray-700">{new Date(depense.date).toLocaleDateString("fr-FR")}</span>
                    </div>
                    {/* Programme */}
                    <div className="flex items-center gap-2 min-w-[180px]">
                      <Users className="h-5 w-5 text-blue-400" />
                      <span className="font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-1">{depense.programme}</span>
                    </div>
                    {/* Type */}
                    <div className="flex items-center gap-2 min-w-[100px]">
                      {getTypeIcon(depense.type)}
                      <span className={`font-semibold rounded px-3 py-1 ${depense.type === "Vol" ? "bg-blue-100 text-blue-800 border border-blue-200" : depense.type === "Hôtel" ? "bg-green-100 text-green-800 border border-green-200" : "bg-gray-100 text-gray-800 border border-gray-200"}`}>{depense.type}</span>
                    </div>
                    {/* Description */}
                    <div className="flex-1 min-w-[180px]">
                      <span className="text-gray-900 font-medium text-base">{depense.description}</span>
                    </div>
                    {/* Montant */}
                    <div className="flex flex-col items-end min-w-[120px]">
                      <span className="font-bold text-xl text-blue-900">{depense.montant.toLocaleString()} DH</span>
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
