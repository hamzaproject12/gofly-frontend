"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import RoleProtectedRoute from "../components/RoleProtectedRoute"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Calendar,
  Users,
  FileText,
  Wallet,
  Bell,
  Settings,
  Search,
  BarChart3,
  ArrowUpDown,
  Download,
  Filter,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  Activity,
  DollarSign,
  Award,
  Star,
  Bed,
  Hotel as HotelIcon,
} from "lucide-react"
import Link from "next/link"

// Types pour les nouveaux graphiques
type RoomsChartData = {
  roomType: string
  nbRoomsReserver: number
  nbRoomsRestant: number
  totalRooms: number
}

type HotelsChartData = {
  hotelName: string
  nbPersonnes: number
}

type GenderChartData = {
  gender: string
  nbReservations: number
}

type SoldeChartData = {
  type: string
  montant: number
}

type BalanceData = {
  // 📊 Statistiques principales
  statistics: {
    totalPaiements: number
    totalDepenses: number
    gainPrevu: number
    soldeFinal: number
    soldeFinalPrevu: number
    countPaiements: number
    countDepenses: number
    countReservations: number
  }

  // 📈 Données par mois
  parMois: Array<{
    mois: string
    paiements: number
    depenses: number
    solde: number
  }>

  // 🏆 Statistiques détaillées
  parMethodePaiement: Array<{
    methode: string
    total: number
    count: number
  }>

  parTypeDepense: Array<{
    type: string
    total: number
    count: number
  }>

  parAgent: Array<{
    agentId: number
    agentName: string
    total: number
    count: number
  }>


  // 🏆 Résumé et métriques
  summary: {
    moisMaxBenefice: {
      mois: string
      solde: number
    }
    totalPaiements: number
    totalDepenses: number
    soldeTotal: number
  }

  // 🔧 Métadonnées
  metadata: {
    periode: string
    dateDebut: string | null
    dateFin: string | null
    programme: string
    generatedAt: string
  }
}

// 🎯 Types pour les analyses décisionnelles
type AnalyticsData = {
  programRanking: {
    summary: {
      totalPrograms: number
      totalRevenue: number
      totalPayments: number
    }
    details: Array<{
      programId: number | null
      programName: string
      totalAmount: number
      countPayments: number
      avgAmount: number
    }>
  }
  
  agentRanking: {
    summary: {
      totalAgents: number
      totalCollected: number
      totalTransactions: number
    }
    details: Array<{
      agentId: number | null
      agentName: string
      agentEmail: string
      totalAmount: number
      countPayments: number
      avgAmount: number
    }>
  }
  
  trends: {
    period: string
    data: {
      paymentsTrend: Array<{
        period: string
        totalPayments: number
        countPayments: number
      }>
      expensesTrend: Array<{
        period: string
        totalExpenses: number
        countExpenses: number
      }>
    }
    insights: {
      message: string
      recommendation: string
      risk: string
    }
  }
  
  cashflow: {
    data: Array<{
      month: string
      payments: number
      expenses: number
      netCashflow: number
    }>
    summary: {
      totalPayments: number
      totalExpenses: number
      totalCashflow: number
      avgMonthly: number
      trend: string
      volatility: number
    }
  }
  
  performance: {
    trend: {
      direction: string
      percentage: number
      lastMonth: number
      thisMonth: number
      change: number
    }
    bestPeriod: {
      date: string
      total: number
    } | null
    expenseRatio: {
      ratio: number
      payments: number
      expenses: number
      net: number
    }
    programDiversity: {
      activePrograms: number
      totalPrograms: number
      diversity: number
    }
  }
  
  metadata: {
    generatedAt: string
    period: string
    dateDebut: string | null
    dateFin: string | null
    programme: string | null
    filters: any
  }
}

type Program = {
  id: number
  name: string
}

// 🎯 API Balance optimisée - toutes les données viennent du backend


export default function SoldeCaissePage() {
  // États pour les filtres
  const [dateDebut, setDateDebut] = useState("")
  const [dateFin, setDateFin] = useState("")
  const [programmeFilter, setProgrammeFilter] = useState("tous")
  const [periodeFilter, setPeriodeFilter] = useState("mois")

  // États pour les données
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [programmes, setProgrammes] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // États pour les nouveaux graphiques
  const [roomsData, setRoomsData] = useState<RoomsChartData[]>([])
  const [hotelsData, setHotelsData] = useState<HotelsChartData[]>([])
  const [genderData, setGenderData] = useState<GenderChartData[]>([])
  const [soldeData, setSoldeData] = useState<SoldeChartData[]>([])
  const [chartsLoading, setChartsLoading] = useState(false)

  // 🎯 Fonction optimisée pour récupérer les données via l'API Balance
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 🚀 UNE SEULE requête vers l'API Balance optimisée
      const params = new URLSearchParams()
      if (dateDebut) params.append('dateDebut', dateDebut)
      if (dateFin) params.append('dateFin', dateFin)
      if (programmeFilter && programmeFilter !== 'tous') params.append('programme', programmeFilter)
      if (periodeFilter) params.append('periode', periodeFilter)

      // 🚀 Récupérer les données de balance ET les analytics en parallèle
      const [balanceResponse, analyticsResponse, programsResponse] = await Promise.all([
        fetch(api.url(`/api/balance?${params.toString()}`)),
        fetch(api.url(`/api/analytics/dashboard?${params.toString()}`)),
        fetch(api.url(api.endpoints.programs))
      ])
      
      if (!balanceResponse.ok) {
        throw new Error('Erreur lors du chargement des données de balance')
      }
      if (!analyticsResponse.ok) {
        throw new Error('Erreur lors du chargement des analytics')
      }
      if (!programsResponse.ok) {
        throw new Error('Erreur lors du chargement des programmes')
      }

      const [balanceData, analyticsResult, programsData] = await Promise.all([
        balanceResponse.json(),
        analyticsResponse.json(),
        programsResponse.json()
      ])

      
      setBalanceData(balanceData)
      setAnalyticsData(analyticsResult.data)
      setProgrammes(programsData)
    } catch (err) {
      console.error('❌ Erreur fetchData:', err)
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }, [dateDebut, dateFin, programmeFilter, periodeFilter])

  // 🎯 Fonction pour récupérer les données des graphiques
  const fetchChartsData = useCallback(async () => {
    try {
      setChartsLoading(true)
      
      // Récupérer toutes les données des graphiques en parallèle
      const [roomsRes, hotelsRes, genderRes, soldeRes] = await Promise.all([
        fetch(api.url(`/api/balance/charts/rooms?programme=${programmeFilter}`)),
        fetch(api.url(`/api/balance/charts/hotels?programme=${programmeFilter}`)),
        fetch(api.url(`/api/balance/charts/gender?programme=${programmeFilter}`)),
        fetch(api.url(`/api/balance/charts/solde?programme=${programmeFilter}`))
      ])

      const [roomsData, hotelsData, genderData, soldeData] = await Promise.all([
        roomsRes.json(),
        hotelsRes.json(),
        genderRes.json(),
        soldeRes.json()
      ])

      setRoomsData(roomsData.data || [])
      setHotelsData(hotelsData.data || [])
      setGenderData(genderData.data || [])
      setSoldeData(soldeData.data || [])

      console.log('✅ Graphiques chargés:', {
        rooms: roomsData.data?.length || 0,
        hotels: hotelsData.data?.length || 0,
        gender: genderData.data?.length || 0,
        solde: soldeData.data?.length || 0
      })
    } catch (err) {
      console.error('❌ Erreur fetchChartsData:', err)
    } finally {
      setChartsLoading(false)
    }
  }, [programmeFilter])

  // Charger les données au montage et quand les filtres changent
  useEffect(() => {
    fetchData()
    fetchChartsData()
  }, [fetchData, fetchChartsData])

  // Données par défaut si pas encore chargées
  const data = balanceData || {
    statistics: { totalPaiements: 0, totalDepenses: 0, gainPrevu: 0, soldeFinal: 0, soldeFinalPrevu: 0, countPaiements: 0, countDepenses: 0, countReservations: 0 },
    parMois: [],
    details: [],
    summary: { 
      moisMaxBenefice: { mois: "", solde: 0 },
      totalPaiements: 0, 
      totalDepenses: 0, 
      soldeTotal: 0 
    },
    parMethodePaiement: [],
    parTypeDepense: [],
    parAgent: [],
    metadata: { periode: 'mois', dateDebut: null, dateFin: null, programme: 'tous', generatedAt: new Date().toISOString() }
  }


  const { statistics, parMois, summary, parMethodePaiement, parTypeDepense, parAgent } = data
  const { totalPaiements, totalDepenses, gainPrevu, soldeFinal, soldeFinalPrevu } = statistics || { totalPaiements: 0, totalDepenses: 0, gainPrevu: 0, soldeFinal: 0, soldeFinalPrevu: 0 }
  const { moisMaxBenefice } = summary || { moisMaxBenefice: { mois: "", solde: 0 } }



  if (loading) {
    return (
      <RoleProtectedRoute allowedRoles={['ADMIN']}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement du solde de caisse...</p>
          </div>
        </div>
      </RoleProtectedRoute>
    )
  }

  if (error) {
    return (
      <RoleProtectedRoute allowedRoles={['ADMIN']}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Erreur
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={fetchData} className="w-full">
                Réessayer
              </Button>
            </CardContent>
          </Card>
        </div>
      </RoleProtectedRoute>
    )
  }

  return (
    <RoleProtectedRoute allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calcul du Solde de Caisse</h1>
            <p className="text-gray-500 mt-1">Analysez les paiements et dépenses pour calculer le solde</p>
          </div>
          <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
            <Download className="mr-2 h-4 w-4" />
            Exporter les données
          </Button>
        </div>

        {/* 1️⃣ RÉSUMÉ GLOBAL (Header) */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold mb-2">💰 Calcul du Solde de Caisse</h1>
                <p className="text-slate-300">État financier en temps réel</p>
              </div>
              <div className="text-right">
                <div className={`text-4xl font-bold ${soldeFinal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {soldeFinal.toLocaleString()} DH
                </div>
                <p className="text-slate-300 text-sm">Solde Final</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Paiements */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-300 text-sm">Total Paiements</p>
                    <p className="text-2xl font-bold text-green-400">{totalPaiements.toLocaleString()} DH</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-green-400" />
                </div>
              </div>

              {/* Total Dépenses */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-300 text-sm">Total Dépenses</p>
                    <p className="text-2xl font-bold text-red-400">{Math.abs(totalDepenses).toLocaleString()} DH</p>
                  </div>
                  <FileText className="h-8 w-8 text-red-400" />
                </div>
              </div>

              {/* Solde Final Prévu */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-300 text-sm">Solde Final Prévu</p>
                    <p className="text-2xl font-bold text-blue-400">{soldeFinalPrevu.toLocaleString()} DH</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2️⃣ FILTRES */}
        <Card className="mb-8 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-3">
              <Filter className="h-6 w-6 text-blue-600" />
              <span>Filtres d'analyse</span>
              <Badge variant="secondary" className="ml-auto">
                Analyse ciblée
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-3">
                <Label htmlFor="dateDebut" className="text-sm font-semibold text-gray-700">
                  📅 Date début
                </Label>
                <Input
                  id="dateDebut"
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="border-2 border-gray-200 focus:border-blue-500 rounded-lg h-11"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="dateFin" className="text-sm font-semibold text-gray-700">
                  📅 Date fin
                </Label>
                <Input
                  id="dateFin"
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="border-2 border-gray-200 focus:border-blue-500 rounded-lg h-11"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="programme" className="text-sm font-semibold text-gray-700">
                  🏢 Programme
                </Label>
                <Select value={programmeFilter} onValueChange={(value) => setProgrammeFilter(value)}>
                  <SelectTrigger id="programme" className="border-2 border-gray-200 focus:border-blue-500 rounded-lg h-11">
                    <SelectValue placeholder="Tous les programmes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">🌐 Tous les programmes</SelectItem>
                    {(programmes || []).map((programme) => (
                      <SelectItem key={programme.id} value={programme.name}>
                        {programme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="periode" className="text-sm font-semibold text-gray-700">
                  📊 Période
                </Label>
                <Select value={periodeFilter} onValueChange={(value) => setPeriodeFilter(value)}>
                  <SelectTrigger id="periode" className="border-2 border-gray-200 focus:border-blue-500 rounded-lg h-11">
                    <SelectValue placeholder="Par mois" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mois">📅 Par mois</SelectItem>
                    <SelectItem value="trimestre">📊 Par trimestre</SelectItem>
                    <SelectItem value="annee">📈 Par année</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>


        {/* 3️⃣ GRAPHIQUES */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-gray-800">📊 Visualisation des Tendances</h2>
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              Données en temps réel
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Bar Chart - Entrées vs Sorties */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-gray-500" />
                  Entrées vs Sorties par Période
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 p-4">
                  {(parMois || []).length > 0 ? (
                    <div className="flex items-end justify-center gap-2 h-full">
                      {(parMois || []).map((item, index) => {
                        const maxValue = Math.max(...(parMois || []).map(m => Math.max(m.paiements, m.depenses)))
                        const paiementsHeight = maxValue > 0 ? (item.paiements / maxValue) * 200 : 0
                        const depensesHeight = maxValue > 0 ? (item.depenses / maxValue) * 200 : 0
                        
                        return (
                          <div key={index} className="flex flex-col items-center gap-2 flex-1">
                            <div className="flex flex-col items-center gap-1 w-full">
                              {/* Barre Paiements */}
                              <div 
                                className="w-full bg-green-500 rounded-t-sm" 
                                style={{ height: `${paiementsHeight}px`, minHeight: '4px' }}
                                title={`Paiements: ${item.paiements.toLocaleString()} DH`}
                              ></div>
                              {/* Barre Dépenses */}
                              <div 
                                className="w-full bg-red-500 rounded-b-sm" 
                                style={{ height: `${depensesHeight}px`, minHeight: '4px' }}
                                title={`Dépenses: ${item.depenses.toLocaleString()} DH`}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600 font-medium">
                              {item.mois.substring(0, 3)}
                            </span>
                            <div className="text-xs text-center">
                              <div className="text-green-600">{item.paiements.toLocaleString()} DH</div>
                              <div className="text-red-600">{item.depenses.toLocaleString()} DH</div>
                            </div>
                          </div>
                        )
                      })}
                        </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <p>Aucune donnée disponible pour cette période</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pie Chart - Répartition des Dépenses */}
          <div>
            <Card className="border-0 shadow-lg h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  Répartition des Dépenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Pie Chart */}
                  <div className="h-64 p-4">
                    {(parTypeDepense || []).length > 0 ? (
                      <div className="space-y-3">
                        {(parTypeDepense || []).map((item, index) => {
                          const totalDepenses = (parTypeDepense || []).reduce((sum, d) => sum + d.total, 0)
                          const percentage = totalDepenses > 0 ? (item.total / totalDepenses) * 100 : 0
                          const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-blue-500']
                          
                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{item.type}</span>
                                <span className="text-sm font-bold">{item.total.toLocaleString()} DH</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div 
                                  className={`h-3 rounded-full ${colors[index % colors.length]}`}
                                  style={{ width: `${percentage}%` }}
                                  title={`${percentage.toFixed(1)}%`}
                                ></div>
                              </div>
                              <div className="text-xs text-gray-600 text-center">
                                {percentage.toFixed(1)}% ({item.total.toLocaleString()} DH)
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <p className="text-sm">Aucune donnée disponible</p>
                      </div>
                    )}
                  </div>

                  {/* Résumé rapide */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Total Dépenses</h3>
                    <p className="text-lg font-bold text-red-700">
                      {summary.totalDepenses.toLocaleString()} DH
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 📊 Résumé des Métriques Clés */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-gray-500" />
              Résumé des Métriques Clés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-700 mb-2">Mois le plus rentable</h3>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">{moisMaxBenefice.mois}</span>
                      <span className="text-lg font-bold text-green-600">
                        {moisMaxBenefice.solde.toLocaleString()} DH
                      </span>
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-700 mb-2">Total des paiements</h3>
                    <p className="text-2xl font-bold text-green-700">
                  {summary.totalPaiements.toLocaleString()} DH
                    </p>
                  </div>

                  <div className="bg-red-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-red-700 mb-2">Total des dépenses</h3>
                    <p className="text-2xl font-bold text-red-700">
                  {summary.totalDepenses.toLocaleString()} DH
                    </p>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-yellow-700 mb-2">Solde total</h3>
                    <p className="text-2xl font-bold text-yellow-700">
                  {summary.soldeTotal.toLocaleString()} DH
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

        {/* 4️⃣ TABLEAUX & CLASSEMENTS */}
        {analyticsData && analyticsData.programRanking && analyticsData.agentRanking && (
          <>
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">🏆 Tableaux & Classements</h2>
                <Badge variant="outline" className="text-purple-600 border-purple-200">
                  Analyses décisionnelles
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* 🏆 Classement par Programme */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Classement Programmes
                    <Badge variant="secondary" className="ml-auto">
                      {analyticsData.programRanking?.summary?.totalPrograms || 0} programmes
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(analyticsData.programRanking?.details || []).slice(0, 5).map((program, index) => (
                      <div key={program.programId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            index === 0 ? 'bg-yellow-500' : 
                            index === 1 ? 'bg-gray-400' : 
                            index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{program.programName}</p>
                            <p className="text-sm text-gray-500">{program.countPayments} paiements</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{program.totalAmount.toLocaleString()} DH</p>
                          <p className="text-sm text-gray-500">Moy: {program.avgAmount.toLocaleString()} DH</p>
          </div>
        </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 👥 Classement par Agent */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-blue-500" />
                    Top Agents
                    <Badge variant="secondary" className="ml-auto">
                      {analyticsData.agentRanking?.summary?.totalAgents || 0} agents
                    </Badge>
              </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(() => {
                      console.log('🔍 Debug - Rendering agent ranking, details:', analyticsData.agentRanking?.details)
                      return (analyticsData.agentRanking?.details || []).slice(0, 5)
                    })().map((agent, index) => {
                      console.log('🔍 Debug - Rendering agent item:', agent, 'index:', index)
                      return (
                      <div key={agent.agentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            index === 0 ? 'bg-yellow-500' : 
                            index === 1 ? 'bg-gray-400' : 
                            index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{agent.agentName}</p>
                            <p className="text-sm text-gray-500">{agent.countPayments} transactions</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{agent.totalAmount.toLocaleString()} DH</p>
                          <p className="text-sm text-gray-500">Moy: {agent.avgAmount.toLocaleString()} DH</p>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 📈 Tendances et Cashflow */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 📊 Évolution Cashflow - Line Chart */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                    Évolution du Solde dans le Temps
                    <Badge variant={analyticsData.cashflow?.summary?.trend === 'positive' ? 'default' : 'destructive'} className="ml-auto">
                      {analyticsData.cashflow?.summary?.trend === 'positive' ? '↗' : '↘'} {Math.abs(analyticsData.cashflow?.summary?.avgMonthly || 0).toLocaleString()} DH/mois
                    </Badge>
                  </CardTitle>
          </CardHeader>
          <CardContent>
                  <div className="space-y-4">
                    {/* Métriques clés */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-green-700">Total Cashflow</p>
                        <p className="text-xl font-bold text-green-700">{(analyticsData.cashflow?.summary?.totalCashflow || 0).toLocaleString()} DH</p>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-blue-700">Volatilité</p>
                        <p className="text-xl font-bold text-blue-700">{(analyticsData.cashflow?.summary?.volatility || 0).toLocaleString()} DH</p>
                      </div>
                    </div>

                    {/* Graphique Line Chart - HTML/CSS */}
                    <div className="h-80 p-4">
                      {(analyticsData.cashflow?.data || []).length > 0 ? (
                        <div className="flex items-end justify-center gap-4 h-full">
                          {(analyticsData.cashflow?.data || []).map((item, index) => {
                            const maxValue = Math.max(...(analyticsData.cashflow?.data || []).map(d => Math.abs(d.netCashflow || 0)))
                            const height = maxValue > 0 ? Math.abs((item.netCashflow || 0) / maxValue) * 200 : 0
                            const isPositive = (item.netCashflow || 0) >= 0
                            
                            return (
                              <div key={index} className="flex flex-col items-center gap-2">
                                <div 
                                  className={`w-8 rounded-t-sm ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                                  style={{ height: `${height}px`, minHeight: '4px' }}
                                  title={`${item.netCashflow.toLocaleString()} DH`}
                                ></div>
                                <span className="text-xs text-gray-600 font-medium">
                                  {item.month?.substring(5) || 'N/A'}
                                </span>
                                <span className={`text-xs font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {item.netCashflow.toLocaleString()} DH
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          <p>Aucune donnée de cashflow disponible</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 📊 Métriques de Performance */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    Performance
                    <Badge variant={analyticsData.performance?.trend?.direction === 'up' ? 'default' : 'destructive'} className="ml-auto">
                      {analyticsData.performance?.trend?.direction === 'up' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {(analyticsData.performance?.trend?.percentage || 0).toFixed(1)}%
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Tendance mois */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-blue-700 mb-2">Tendance Mensuelle</h3>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-gray-600">Mois précédent: {(analyticsData.performance?.trend?.lastMonth || 0).toLocaleString()} DH</p>
                          <p className="text-sm text-gray-600">Ce mois: {(analyticsData.performance?.trend?.thisMonth || 0).toLocaleString()} DH</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-700">
                            {(analyticsData.performance?.trend?.change || 0) >= 0 ? '+' : ''}{(analyticsData.performance?.trend?.change || 0).toLocaleString()} DH
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Ratio dépenses */}
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-orange-700 mb-2">Ratio Dépenses/Paiements</h3>
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-bold text-orange-700">{(analyticsData.performance?.expenseRatio?.ratio || 0).toFixed(1)}%</span>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Paiements: {(analyticsData.performance?.expenseRatio?.payments || 0).toLocaleString()} DH</p>
                          <p className="text-sm text-gray-600">Dépenses: {(analyticsData.performance?.expenseRatio?.expenses || 0).toLocaleString()} DH</p>
                        </div>
                      </div>
                    </div>

                    {/* Diversité programmes */}
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-purple-700 mb-2">Diversité Programmes</h3>
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-bold text-purple-700">{(analyticsData.performance?.programDiversity?.diversity || 0).toFixed(1)}%</span>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">{analyticsData.performance?.programDiversity?.activePrograms || 0}/{analyticsData.performance?.programDiversity?.totalPrograms || 0} actifs</p>
                        </div>
          </div>
        </div>

                    {/* Meilleur jour */}
                    {analyticsData.performance?.bestPeriod && (
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-yellow-700 mb-2">Meilleur Jour</h3>
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-yellow-700">{analyticsData.performance.bestPeriod.date}</span>
                          <span className="text-lg font-bold text-yellow-700">{(analyticsData.performance.bestPeriod.total || 0).toLocaleString()} DH</span>
                        </div>
                      </div>
                    )}
            </div>
          </CardContent>
        </Card>
            </div>
          </>
        )}

        {/* 📈 Graphiques Avancés */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-xl font-bold text-gray-700">📈 Analyses Avancées</h3>
            <Badge variant="outline" className="text-green-600 border-green-200">
              Filtrage par programme
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 📊 Graphique Types de Chambres */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bed className="h-5 w-5 text-blue-500" />
                Occupation des Chambres par Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 p-4">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : roomsData.length > 0 ? (
                  <div className="flex items-end justify-center gap-2 h-full">
                    {roomsData.map((item, index) => {
                      const maxValue = Math.max(...roomsData.map(r => Math.max(r.nbRoomsReserver, r.nbRoomsRestant)))
                      const reservedHeight = maxValue > 0 ? (item.nbRoomsReserver / maxValue) * 200 : 0
                      const availableHeight = maxValue > 0 ? (item.nbRoomsRestant / maxValue) * 200 : 0
                      
                      return (
                        <div key={index} className="flex flex-col items-center gap-2 flex-1">
                          <div className="flex flex-col items-center gap-1 w-full">
                            {/* Barre Chambres Réservées */}
                            <div 
                              className="w-full bg-red-500 rounded-t-sm" 
                              style={{ height: `${reservedHeight}px`, minHeight: '4px' }}
                              title={`Réservées: ${item.nbRoomsReserver}`}
                            ></div>
                            {/* Barre Chambres Disponibles */}
                            <div 
                              className="w-full bg-green-500 rounded-b-sm" 
                              style={{ height: `${availableHeight}px`, minHeight: '4px' }}
                              title={`Disponibles: ${item.nbRoomsRestant}`}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-600 font-medium">
                            {item.roomType}
                          </span>
                          <div className="text-xs text-center">
                            <div className="text-red-600">{item.nbRoomsReserver} réservées</div>
                            <div className="text-green-600">{item.nbRoomsRestant} libres</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Aucune donnée disponible</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 🏨 Graphique Hôtels */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HotelIcon className="h-5 w-5 text-purple-500" />
                Répartition par Hôtel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 p-4">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : hotelsData.length > 0 ? (
                  <div className="flex items-end justify-center gap-2 h-full">
                    {hotelsData.slice(0, 8).map((item, index) => {
                      const maxValue = Math.max(...hotelsData.map(h => h.nbPersonnes))
                      const height = maxValue > 0 ? (item.nbPersonnes / maxValue) * 200 : 0
                      const colors = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-yellow-500']
                      
                      return (
                        <div key={index} className="flex flex-col items-center gap-2 flex-1">
                          <div 
                            className={`w-full ${colors[index % colors.length]} rounded-t-sm`}
                            style={{ height: `${height}px`, minHeight: '4px' }}
                            title={`${item.hotelName}: ${item.nbPersonnes} personnes`}
                          ></div>
                          <span className="text-xs text-gray-600 font-medium text-center">
                            {item.hotelName.length > 12 ? item.hotelName.substring(0, 12) + '...' : item.hotelName}
                          </span>
                          <div className="text-xs text-center font-bold">
                            {item.nbPersonnes} pers.
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Aucune donnée disponible</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 📊 Deuxième ligne de graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 👥 Graphique Genres */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                Répartition par Genre
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 p-4">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  </div>
                ) : genderData.length > 0 ? (
                  <div className="flex items-end justify-center gap-4 h-full">
                    {genderData.map((item, index) => {
                      const maxValue = Math.max(...genderData.map(g => g.nbReservations))
                      const height = maxValue > 0 ? (item.nbReservations / maxValue) * 200 : 0
                      const colors = ['bg-blue-500', 'bg-pink-500']
                      const icons = ['👨', '👩']
                      
                      return (
                        <div key={index} className="flex flex-col items-center gap-2 flex-1">
                          <div className="text-2xl mb-2">{icons[index] || '👤'}</div>
                          <div 
                            className={`w-16 ${colors[index % colors.length]} rounded-t-lg`}
                            style={{ height: `${height}px`, minHeight: '4px' }}
                            title={`${item.gender}: ${item.nbReservations} réservations`}
                          ></div>
                          <span className="text-sm text-gray-600 font-medium">
                            {item.gender}
                          </span>
                          <div className="text-sm text-center font-bold">
                            {item.nbReservations}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Aucune donnée disponible</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 💰 Graphique Solde */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-yellow-500" />
                Vue d'ensemble Financière
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 p-4">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
                  </div>
                ) : soldeData.length > 0 ? (
                  <div className="flex items-end justify-center gap-4 h-full">
                    {soldeData.map((item, index) => {
                      const maxValue = Math.max(...soldeData.map(s => s.montant))
                      const height = maxValue > 0 ? (item.montant / maxValue) * 200 : 0
                      const colors = ['bg-blue-500', 'bg-green-500', 'bg-red-500']
                      const icons = ['💰', '💳', '💸']
                      
                      return (
                        <div key={index} className="flex flex-col items-center gap-2 flex-1">
                          <div className="text-2xl mb-2">{icons[index] || '💼'}</div>
                          <div 
                            className={`w-20 ${colors[index % colors.length]} rounded-t-lg`}
                            style={{ height: `${height}px`, minHeight: '4px' }}
                            title={`${item.type}: ${item.montant.toLocaleString()} DH`}
                          ></div>
                          <span className="text-sm text-gray-600 font-medium text-center">
                            {item.type}
                          </span>
                          <div className="text-sm text-center font-bold">
                            {item.montant.toLocaleString()} DH
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Aucune donnée disponible</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
    </RoleProtectedRoute>
  )
}
