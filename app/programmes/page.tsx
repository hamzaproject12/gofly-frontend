"use client"

import { useState } from "react"
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

export default function ProgrammesPage() {
  // États pour les filtres
  const [searchQuery, setSearchQuery] = useState("")
  const [programmeFilter, setProgrammeFilter] = useState("tous")

  // Données simulées
  const programmes = [
    {
      id: 1,
      nom: "Omra Ramadan 15/03 - 02/04",
      dateCreation: "2024-01-15",
      hotelsMadina: ["Groupe Imane"],
      hotelsMakkah: ["Meezab Al Biban", "Abraj al Tayseer", "SAMA AL-KHAIR"],
      datesLimites: {
        visa: "2024-03-01",
        hotels: "2024-02-15",
        billets: "2024-02-20",
      },
      reservations: {
        couple: 12,
        trois: 8,
        quatre: 5,
        cinq: 3,
      },
      totalReservations: 28,
      montantTotal: 840000,
      depenses: [
        { type: "hotel", montant: 300000 },
        { type: "vol", montant: 400000 },
        { type: "autre", montant: 50000 },
      ],
    },
    {
      id: 2,
      nom: "Omra Mawlid Nabawi 02/09 - 16/09",
      dateCreation: "2024-06-10",
      hotelsMadina: ["Groupe Imane", "Shaza Regency"],
      hotelsMakkah: ["Borj Al Deafah", "Emaar Grand", "Al Shohada", "Swissôtel Al Maqam"],
      datesLimites: {
        visa: "2024-08-15",
        hotels: "2024-08-01",
        billets: "2024-08-05",
      },
      reservations: {
        couple: 15,
        trois: 10,
        quatre: 6,
        cinq: 4,
      },
      totalReservations: 35,
      montantTotal: 1050000,
      depenses: [
        { type: "hotel", montant: 350000 },
        { type: "vol", montant: 500000 },
        { type: "autre", montant: 60000 },
      ],
    },
    {
      id: 3,
      nom: "Omra Mawlid Nabawi 16/09 - 30/09",
      dateCreation: "2024-06-15",
      hotelsMadina: ["Groupe Imane", "Shaza Regency"],
      hotelsMakkah: ["Borj Al Deafah", "Emaar Grand", "Al Shohada", "Swissôtel Al Maqam"],
      datesLimites: {
        visa: "2024-08-20",
        hotels: "2024-08-10",
        billets: "2024-08-15",
      },
      reservations: {
        couple: 18,
        trois: 12,
        quatre: 7,
        cinq: 5,
      },
      totalReservations: 42,
      montantTotal: 1260000,
      depenses: [
        { type: "hotel", montant: 420000 },
        { type: "vol", montant: 600000 },
        { type: "autre", montant: 70000 },
      ],
    },
    {
      id: 4,
      nom: "Omra Mawlid Nabawi 12/10 - 28/10",
      dateCreation: "2024-07-01",
      hotelsMadina: ["Groupe Imane", "Shaza Regency"],
      hotelsMakkah: ["Borj Al Deafah", "Emaar Grand", "Al Shohada", "Swissôtel Al Maqam"],
      datesLimites: {
        visa: "2024-09-15",
        hotels: "2024-09-01",
        billets: "2024-09-05",
      },
      reservations: {
        couple: 20,
        trois: 14,
        quatre: 8,
        cinq: 6,
      },
      totalReservations: 48,
      montantTotal: 1440000,
      depenses: [
        { type: "hotel", montant: 480000 },
        { type: "vol", montant: 720000 },
        { type: "autre", montant: 80000 },
      ],
    },
    {
      id: 5,
      nom: "Omra Mawlid Nabawi 16/10 - 30/10",
      dateCreation: "2024-07-05",
      hotelsMadina: ["Groupe Imane", "Shaza Regency"],
      hotelsMakkah: ["Borj Al Deafah", "Emaar Grand", "Al Shohada", "Swissôtel Al Maqam"],
      datesLimites: {
        visa: "2024-09-20",
        hotels: "2024-09-10",
        billets: "2024-09-15",
      },
      reservations: {
        couple: 16,
        trois: 11,
        quatre: 6,
        cinq: 4,
      },
      totalReservations: 37,
      montantTotal: 1110000,
      depenses: [
        { type: "hotel", montant: 370000 },
        { type: "vol", montant: 555000 },
        { type: "autre", montant: 65000 },
      ],
    },
    {
      id: 6,
      nom: "Omra Aout 05/08 - 19/08",
      dateCreation: "2024-05-20",
      hotelsMadina: ["Groupe Imane", "Shaza Regency"],
      hotelsMakkah: ["Borj Al Deafah", "Emaar Grand", "Al Shohada", "Swissôtel Al Maqam"],
      datesLimites: {
        visa: "2024-07-15",
        hotels: "2024-07-01",
        billets: "2024-07-05",
      },
      reservations: {
        couple: 22,
        trois: 16,
        quatre: 9,
        cinq: 7,
      },
      totalReservations: 54,
      montantTotal: 1620000,
      depenses: [
        { type: "hotel", montant: 540000 },
        { type: "vol", montant: 810000 },
        { type: "autre", montant: 90000 },
      ],
    },
    {
      id: 7,
      nom: "Omra Aout 12/08 - 26/08",
      dateCreation: "2024-05-25",
      hotelsMadina: ["Groupe Imane", "Shaza Regency"],
      hotelsMakkah: ["Borj Al Deafah", "Emaar Grand", "Al Shohada", "Swissôtel Al Maqam"],
      datesLimites: {
        visa: "2024-07-20",
        hotels: "2024-07-10",
        billets: "2024-07-15",
      },
      reservations: {
        couple: 19,
        trois: 13,
        quatre: 7,
        cinq: 5,
      },
      totalReservations: 44,
      montantTotal: 1320000,
      depenses: [
        { type: "hotel", montant: 440000 },
        { type: "vol", montant: 660000 },
        { type: "autre", montant: 75000 },
      ],
    },
    {
      id: 8,
      nom: "Omra Aout 26/08 - 09/09",
      dateCreation: "2024-06-01",
      hotelsMadina: ["Groupe Imane", "Shaza Regency"],
      hotelsMakkah: ["Borj Al Deafah", "Emaar Grand", "Al Shohada", "Swissôtel Al Maqam"],
      datesLimites: {
        visa: "2024-08-01",
        hotels: "2024-07-20",
        billets: "2024-07-25",
      },
      reservations: {
        couple: 17,
        trois: 12,
        quatre: 6,
        cinq: 4,
      },
      totalReservations: 39,
      montantTotal: 1170000,
      depenses: [
        { type: "hotel", montant: 390000 },
        { type: "vol", montant: 585000 },
        { type: "autre", montant: 70000 },
      ],
    },
    {
      id: 9,
      nom: "Omra Juillet 03/07 - 16/07",
      dateCreation: "2024-04-15",
      hotelsMadina: ["Groupe Imane", "Shaza Regency"],
      hotelsMakkah: ["Borj Al Deafah", "Emaar Grand", "Al Shohada", "Swissôtel Al Maqam"],
      datesLimites: {
        visa: "2024-06-15",
        hotels: "2024-06-01",
        billets: "2024-06-05",
      },
      reservations: {
        couple: 14,
        trois: 9,
        quatre: 5,
        cinq: 3,
      },
      totalReservations: 31,
      montantTotal: 930000,
      depenses: [
        { type: "hotel", montant: 310000 },
        { type: "vol", montant: 465000 },
        { type: "autre", montant: 55000 },
      ],
    },
    {
      id: 10,
      nom: "Omra Juillet 15/07 - 29/07",
      dateCreation: "2024-04-20",
      hotelsMadina: ["Groupe Imane", "Shaza Regency"],
      hotelsMakkah: ["Borj Al Deafah", "Emaar Grand", "Al Shohada", "Swissôtel Al Maqam"],
      datesLimites: {
        visa: "2024-06-20",
        hotels: "2024-06-10",
        billets: "2024-06-15",
      },
      reservations: {
        couple: 21,
        trois: 15,
        quatre: 8,
        cinq: 6,
      },
      totalReservations: 50,
      montantTotal: 1500000,
      depenses: [
        { type: "hotel", montant: 500000 },
        { type: "vol", montant: 750000 },
        { type: "autre", montant: 85000 },
      ],
    },
    {
      id: 11,
      nom: "Omra Juillet 29/07 - 12/08",
      dateCreation: "2024-05-01",
      hotelsMadina: ["Groupe Imane", "Shaza Regency"],
      hotelsMakkah: ["Borj Al Deafah", "Emaar Grand", "Al Shohada", "Swissôtel Al Maqam"],
      datesLimites: {
        visa: "2024-07-01",
        hotels: "2024-06-20",
        billets: "2024-06-25",
      },
      reservations: {
        couple: 18,
        trois: 13,
        quatre: 7,
        cinq: 5,
      },
      totalReservations: 43,
      montantTotal: 1290000,
      depenses: [
        { type: "hotel", montant: 430000 },
        { type: "vol", montant: 645000 },
        { type: "autre", montant: 75000 },
      ],
    },
  ]

  // Liste des programmes pour le filtre
  const programmesNoms = ["Tous", ...programmes.map((p) => p.nom)]

  // Filtrage des programmes
  const filteredProgrammes = programmes.filter((programme) => {
    const searchMatch = programme.nom.toLowerCase().includes(searchQuery.toLowerCase())
    const programmeMatch = programmeFilter === "tous" || programme.nom === programmeFilter
    return searchMatch && programmeMatch
  })

  const getDateStatus = (dateLimit: string) => {
    const today = new Date()
    const limit = new Date(dateLimit)
    const diffTime = limit.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return { status: "expired", text: "Expiré", color: "bg-red-100 text-red-800" }
    if (diffDays <= 10)
      return { status: "urgent", text: `${diffDays}j restants`, color: "bg-orange-100 text-orange-800" }
    return { status: "ok", text: `${diffDays}j restants`, color: "bg-green-100 text-green-800" }
  }

  const getTotalDepenses = (depenses) => {
    return depenses.reduce((sum, depense) => sum + depense.montant, 0)
  }

  const getBenefice = (programme) => {
    const totalDepenses = getTotalDepenses(programme.depenses)
    return programme.montantTotal - totalDepenses
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Navigation moderne */}
      <nav className="bg-white/95 backdrop-blur-lg shadow-xl border-b border-blue-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-yellow-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">G</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent">
                    GoodFly
                  </h1>
                  <p className="text-xs text-gray-500">Gestion Programmes</p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-1">
              <Link href="/">
                <Button
                  variant="ghost"
                  className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/reservations">
                <Button
                  variant="ghost"
                  className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Réservations
                </Button>
              </Link>
              <Link href="/depenses">
                <Button
                  variant="ghost"
                  className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Dépenses
                </Button>
              </Link>
              <Link href="/solde">
                <Button
                  variant="ghost"
                  className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Solde Caisse
                </Button>
              </Link>
            </div>

            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" className="rounded-xl">
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

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
                  {filteredProgrammes.reduce((sum, p) => sum + p.totalReservations, 0)}
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
                <p className="text-sm text-gray-500">Montant Total</p>
                <p className="text-2xl font-bold">
                  {filteredProgrammes.reduce((sum, p) => sum + p.montantTotal, 0).toLocaleString()} DH
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
                    <CardTitle className="text-xl text-blue-800">{programme.nom}</CardTitle>
                    <CardDescription className="mt-1">
                      Créé le {new Date(programme.dateCreation).toLocaleDateString("fr-FR")}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-600">
                      {programme.montantTotal.toLocaleString()} DH
                    </div>
                    <p className="text-sm text-blue-700">{programme.totalReservations} réservations</p>
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
                                  {hotel}
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
                                  {hotel}
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
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Couple</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{
                                    width: `${(programme.reservations.couple / programme.totalReservations) * 100}%`,
                                  }}
                                ></div>
                              </div>
                              <Badge variant="outline" className="bg-blue-50 border-blue-200">
                                {programme.reservations.couple}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">3 personnes</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{
                                    width: `${(programme.reservations.trois / programme.totalReservations) * 100}%`,
                                  }}
                                ></div>
                              </div>
                              <Badge variant="outline" className="bg-blue-50 border-blue-200">
                                {programme.reservations.trois}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">4 personnes</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{
                                    width: `${(programme.reservations.quatre / programme.totalReservations) * 100}%`,
                                  }}
                                ></div>
                              </div>
                              <Badge variant="outline" className="bg-blue-50 border-blue-200">
                                {programme.reservations.quatre}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">5 personnes</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{
                                    width: `${(programme.reservations.cinq / programme.totalReservations) * 100}%`,
                                  }}
                                ></div>
                              </div>
                              <Badge variant="outline" className="bg-blue-50 border-blue-200">
                                {programme.reservations.cinq}
                              </Badge>
                            </div>
                          </div>
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
                              <Badge className={getDateStatus(programme.datesLimites.visa).color}>
                                {getDateStatus(programme.datesLimites.visa).text}
                              </Badge>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(programme.datesLimites.visa).toLocaleDateString("fr-FR")}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm flex items-center gap-1">
                              <Building className="h-4 w-4" />
                              Hôtels
                            </span>
                            <div className="text-right">
                              <Badge className={getDateStatus(programme.datesLimites.hotels).color}>
                                {getDateStatus(programme.datesLimites.hotels).text}
                              </Badge>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(programme.datesLimites.hotels).toLocaleDateString("fr-FR")}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm flex items-center gap-1">
                              <Plane className="h-4 w-4" />
                              Billets
                            </span>
                            <div className="text-right">
                              <Badge className={getDateStatus(programme.datesLimites.billets).color}>
                                {getDateStatus(programme.datesLimites.billets).text}
                              </Badge>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(programme.datesLimites.billets).toLocaleDateString("fr-FR")}
                              </p>
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
                          <div className="space-y-2">
                            {Object.entries(programme.reservations).map(([type, count], index) => (
                              <div key={index} className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                <span className="text-sm">{type === "couple" ? "Couple" : `${type} personnes`}</span>
                                <span className="text-sm font-medium ml-auto">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                          <h4 className="text-sm font-medium text-gray-500 mb-3">Statistiques</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-blue-50 rounded-lg">
                              <p className="text-sm text-gray-500">Total</p>
                              <p className="text-xl font-bold text-blue-700">{programme.totalReservations}</p>
                            </div>
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                              <p className="text-sm text-gray-500">Montant</p>
                              <p className="text-xl font-bold text-green-700">
                                {programme.montantTotal.toLocaleString()} DH
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
                            {programme.montantTotal.toLocaleString()} DH
                          </p>
                          <p className="text-xs text-gray-500">Total des réservations</p>
                        </div>

                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Dépenses</h4>
                          <p className="text-2xl font-bold text-red-600">
                            {getTotalDepenses(programme.depenses).toLocaleString()} DH
                          </p>
                          <p className="text-xs text-gray-500">Total des coûts</p>
                        </div>

                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Bénéfice</h4>
                          <p className="text-2xl font-bold text-blue-600">
                            {getBenefice(programme).toLocaleString()} DH
                          </p>
                          <p className="text-xs text-gray-500">Revenus - Dépenses</p>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Répartition des dépenses</h4>
                        <div className="space-y-3">
                          {programme.depenses.map((depense, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {depense.type === "hotel" && <Building className="h-4 w-4 text-yellow-600" />}
                                {depense.type === "vol" && <Plane className="h-4 w-4 text-blue-600" />}
                                {depense.type === "autre" && <FileText className="h-4 w-4 text-yellow-600" />}
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
                                          : "bg-yellow-600"
                                    } h-2 rounded-full`}
                                    style={{
                                      width: `${(depense.montant / getTotalDepenses(programme.depenses)) * 100}%`,
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
  )
}
