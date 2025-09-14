"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Plane, Building, Receipt, Bell, Settings, Calendar, Users, Wallet, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"

export default function DepensesPage() {
  // États pour les filtres
  const [searchQuery, setSearchQuery] = useState("")
  const [programmeFilter, setProgrammeFilter] = useState("tous")
  const [typeFilter, setTypeFilter] = useState("tous")

  // Données simulées
  const depenses = [
    {
      id: 1,
      date: "2024-01-20",
      programme: "Omra Ramadan 15/03 - 02/04",
      type: "Hôtel",
      description: "Réservation Groupe Imane - Madina",
      montant: 25000,
      statut: "payé",
    },
    {
      id: 2,
      date: "2024-01-18",
      programme: "Omra Ramadan 15/03 - 02/04",
      type: "Vol",
      description: "Billets d'avion groupe 15 personnes",
      montant: 45000,
      statut: "payé",
    },
    {
      id: 3,
      date: "2024-06-15",
      programme: "Omra Mawlid Nabawi 02/09 - 16/09",
      type: "Hôtel",
      description: "Réservation Swissôtel Al Maqam - Makkah",
      montant: 18000,
      statut: "en_attente",
    },
    {
      id: 4,
      date: "2024-01-12",
      programme: "Autre",
      type: "Autre",
      description: "Frais de visa consulat",
      montant: 3500,
      statut: "payé",
    },
    {
      id: 5,
      date: "2024-05-10",
      programme: "Omra Aout 05/08 - 19/08",
      type: "Vol",
      description: "Modification billets d'avion",
      montant: 2800,
      statut: "payé",
    },
    {
      id: 6,
      date: "2024-06-20",
      programme: "Omra Mawlid Nabawi 16/09 - 30/09",
      type: "Hôtel",
      description: "Réservation Borj Al Deafah - Makkah",
      montant: 32000,
      statut: "payé",
    },
    {
      id: 7,
      date: "2024-04-25",
      programme: "Omra Juillet 03/07 - 16/07",
      type: "Vol",
      description: "Billets d'avion groupe 20 personnes",
      montant: 60000,
      statut: "en_attente",
    },
    {
      id: 8,
      date: "2024-05-30",
      programme: "Omra Aout 12/08 - 26/08",
      type: "Hôtel",
      description: "Réservation Emaar Grand - Makkah",
      montant: 28000,
      statut: "payé",
    },
  ]

  // Liste des programmes pour le filtre
  const programmes = [
    "Tous",
    "Omra Ramadan 15/03 - 02/04",
    "Omra Mawlid Nabawi 02/09 - 16/09",
    "Omra Mawlid Nabawi 16/09 - 30/09",
    "Omra Mawlid Nabawi 12/10 - 28/10",
    "Omra Mawlid Nabawi 16/10 - 30/10",
    "Omra Aout 05/08 - 19/08",
    "Omra Aout 12/08 - 26/08",
    "Omra Aout 26/08 - 09/09",
    "Omra Juillet 03/07 - 16/07",
    "Omra Juillet 15/07 - 29/07",
    "Omra Juillet 29/07 - 12/08",
    "Autre",
  ]

  const typesDepense = ["Tous", "Vol", "Hôtel", "Autre"]

  // Filtrage des dépenses
  const filteredDepenses = depenses.filter((depense) => {
    const searchMatch =
      depense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      depense.programme.toLowerCase().includes(searchQuery.toLowerCase()) ||
      depense.type.toLowerCase().includes(searchQuery.toLowerCase())

    const programmeMatch = programmeFilter === "tous" || depense.programme === programmeFilter
    const typeMatch = typeFilter === "tous" || depense.type === typeFilter

    return searchMatch && programmeMatch && typeMatch
  })

  const totalDepenses = filteredDepenses.reduce((sum, depense) => sum + depense.montant, 0)
  const depensesPayees = filteredDepenses
    .filter((d) => d.statut === "payé")
    .reduce((sum, depense) => sum + depense.montant, 0)
  const depensesEnAttente = filteredDepenses
    .filter((d) => d.statut === "en_attente")
    .reduce((sum, depense) => sum + depense.montant, 0)

  // Calculs pour les nouvelles stats
  const depensesVol = filteredDepenses.filter((d) => d.type === "Vol").reduce((sum, d) => sum + d.montant, 0)
  const depensesHotel = filteredDepenses.filter((d) => d.type === "Hôtel").reduce((sum, d) => sum + d.montant, 0)
  const depensesAutre = filteredDepenses.filter((d) => d.type === "Autre").reduce((sum, d) => sum + d.montant, 0)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Vol":
        return <Plane className="h-4 w-4" />
      case "Hôtel":
        return <Building className="h-4 w-4" />
      default:
        return <Receipt className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Vol":
        return "bg-blue-100 text-blue-800"
      case "Hôtel":
        return "bg-green-100 text-green-800"
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

        {/* Statistiques - 4 cards : Total, Vol, Hôtel, Autre */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                  <div className="text-2xl font-bold">{depensesHotel.toLocaleString()} DH</div>
                  <div className="text-xs text-white/80">hôtel</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Dépenses Hôtels</h3>
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

        {/* Filtres et recherche */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="w-full">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par programme, description..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select value={programmeFilter} onValueChange={(value) => setProgrammeFilter(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les programmes" />
                  </SelectTrigger>
                  <SelectContent>
                    {programmes.map((programme, index) => (
                      <SelectItem key={index} value={index === 0 ? "tous" : programme}>
                        {programme}
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
              <div className="text-right">Montant & Statut</div>
            </div>
            <div className="divide-y">
              {filteredDepenses.map((depense) => (
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
                    {/* Montant et Statut */}
                    <div className="flex flex-col items-end min-w-[120px]">
                      <span className="font-bold text-xl text-blue-900">{depense.montant.toLocaleString()} DH</span>
                      <span className={`mt-1 px-3 py-1 rounded-full text-xs font-semibold ${depense.statut === "payé" ? "bg-green-100 text-green-800 border border-green-200" : "bg-yellow-100 text-yellow-800 border border-yellow-200"}`}>{depense.statut === "payé" ? "Payé" : "En attente"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
