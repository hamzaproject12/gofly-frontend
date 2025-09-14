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
  Plane,
  FileText,
  Bell,
  Settings,
} from "lucide-react"
import Link from "next/link"

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
}

export default function ProgrammesPage() {
  // États pour les filtres
  const [searchQuery, setSearchQuery] = useState("")
  const [programmeFilter, setProgrammeFilter] = useState("tous")
  const [programmes, setProgrammes] = useState<ProgramOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        setProgrammes(data.programs || [])
      } catch (err) {
        console.error('Error fetching programmes:', err)
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    fetchProgrammes()
  }, [])

  // Liste des programmes pour le filtre
  const programmesNoms = ["Tous", ...programmes.map((p) => p.name)]

  // Filtrage des programmes
  const filteredProgrammes = programmes.filter((programme) => {
    const searchMatch = programme.name.toLowerCase().includes(searchQuery.toLowerCase())
    const programmeMatch = programmeFilter === "tous" || programme.name === programmeFilter
    return searchMatch && programmeMatch
  })

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
      <div className="flex justify-between items-center animate-fadeInUp" style={{ animationDelay: `${index * 100}ms` }}>
        <span className="text-sm font-medium text-gray-700">{roomType}</span>
        <div className="flex items-center gap-3">
          <div className="w-32 bg-gray-200 rounded-full h-3 overflow-hidden">
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
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-blue-700 font-medium">{data.occupied}</span>
            </div>
            <span className="text-gray-400">/</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-green-700 font-medium">{data.available}</span>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Programmes</h1>
            <p className="text-gray-500 mt-1">Créez et gérez vos programmes de voyage Omra</p>
          </div>
          <Link href="/programmes/nouveau">
            <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau Programme
            </Button>
          </Link>
        </div>

        {/* Filtres et recherche */}
        <Card className="mb-6 border-none shadow-lg overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher un programme..."
                    className="pl-10 border-2 focus:border-blue-500 h-12"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="w-full md:w-64">
                <Select value={programmeFilter} onValueChange={(value) => setProgrammeFilter(value)}>
                  <SelectTrigger className="border-2 border-blue-200 text-blue-700 hover:bg-blue-50 h-12">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white shadow-md border-none hover:shadow-lg transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-full">
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Programmes</p>
                <p className="text-2xl font-bold">{filteredProgrammes.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md border-none hover:shadow-lg transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Réservations</p>
                <p className="text-2xl font-bold">
                  {filteredProgrammes.reduce((sum, p) => sum + (p.reservationsByRoom?.total?.occupied || 0), 0)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md border-none hover:shadow-lg transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-full">
                <Wallet className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Revenus Total</p>
                <p className="text-2xl font-bold">
                  {filteredProgrammes.reduce((sum, p) => sum + (p.totalRevenue || 0), 0).toLocaleString()} DH
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md border-none hover:shadow-lg transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-full">
                <Building className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Hôtels Partenaires</p>
                <p className="text-2xl font-bold">8</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liste des programmes */}
        <div className="space-y-6">
          {filteredProgrammes.map((programme) => (
            <Card key={programme.id} className="border-none shadow-lg hover:shadow-xl transition-all overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl text-blue-800">{programme.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Créé le {new Date(programme.created_at).toLocaleDateString("fr-FR")}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-600">
                      {(programme.totalRevenue || 0).toLocaleString()} DH
                    </div>
                    <p className="text-sm text-blue-700">{programme.reservationsByRoom?.total?.occupied || 0} réservations</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="w-full justify-start bg-gray-50 px-6 pt-2 border-b">
                    <TabsTrigger value="details" className="data-[state=active]:bg-white">
                      Détails
                    </TabsTrigger>
                    <TabsTrigger value="reservations" className="data-[state=active]:bg-white">
                      Réservations
                    </TabsTrigger>
                    <TabsTrigger value="finances" className="data-[state=active]:bg-white">
                      Finances
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="p-6 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Hôtels */}
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                        <h4 className="font-medium mb-3 flex items-center gap-2 text-blue-700">
                          <MapPin className="h-5 w-5" />
                          Hôtels
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium text-blue-700 mb-2">Madina</p>
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
                          <div>
                            <p className="text-sm font-medium text-blue-700 mb-2">Makkah</p>
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
                      </div>

                      {/* Réservations par type de chambre */}
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                        <h4 className="font-medium mb-3 flex items-center gap-2 text-blue-700">
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
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
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

                  <TabsContent value="reservations" className="p-6">
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                          <h4 className="text-sm font-medium text-gray-500 mb-3">Par type de chambre</h4>
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

                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                          <h4 className="text-sm font-medium text-gray-500 mb-3">Statistiques</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-blue-50 rounded-lg">
                              <p className="text-sm text-gray-500">Total</p>
                              <p className="text-xl font-bold text-blue-700">{programme.reservationsByRoom?.total?.occupied || 0}</p>
                            </div>
                            <div className="text-center p-3 bg-green-50 rounded-lg">
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

                  <TabsContent value="finances" className="p-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Revenus</h4>
                          <p className="text-2xl font-bold text-green-600">
                            {(programme.totalRevenue || 0).toLocaleString()} DH
                          </p>
                          <p className="text-xs text-gray-500">Total des paiements</p>
                        </div>

                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Dépenses</h4>
                          <p className="text-2xl font-bold text-red-600">
                            {(programme.totalExpenses || 0).toLocaleString()} DH
                          </p>
                          <p className="text-xs text-gray-500">Total des coûts</p>
                        </div>

                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Bénéfice</h4>
                          <p className="text-2xl font-bold text-blue-600">
                            {(programme.netProfit || 0).toLocaleString()} DH
                          </p>
                          <p className="text-xs text-gray-500">Revenus - Dépenses</p>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Répartition des dépenses</h4>
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
                </Tabs>

                <div className="p-6 pt-0 flex flex-wrap gap-2">
                  <Link href={`/programmes/${programme.id}`}>
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
                  </Link>
                  <Link href={`/reservations?programme=${programme.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                    >
                      Voir réservations
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/depenses?programme=${programme.id}`}>
                    <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50">
                      Voir dépenses
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
    </>
  )
}
