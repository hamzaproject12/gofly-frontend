"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import RoleProtectedRoute from "../components/RoleProtectedRoute"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
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
  PieChart,
  LineChart,
  Award,
  Star,
} from "lucide-react"
import Link from "next/link"

type BalanceData = {
  // 📊 Statistiques principales
  statistics: {
    totalPaiements: number
    totalDepenses: number
    soldeFinal: number
    countPaiements: number
    countDepenses: number
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

  // 📋 Détails des transactions
  details: Array<{
    id: string
    date: string
    type: string
    description: string
    montant: number
    programme: string
    reservationId?: number
    programId?: number
    methodePaiement?: string
    typeDepense?: string
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

// 🎯 Plus besoin de fonctions côté client - tout est géré par l'API Balance optimisée !
/*function buildBalanceDataFromExistingAPIs(paymentsData: any[], expensesData: any[], dateDebut: string, dateFin: string, programmeFilter: string, periodeFilter: string): BalanceData {
  console.log('Building balance data with:', {
    paymentsCount: paymentsData.length,
    expensesCount: expensesData.length,
    paymentsSample: paymentsData.slice(0, 2),
    expensesSample: expensesData.slice(0, 2),
    dateDebut,
    dateFin,
    programmeFilter,
    periodeFilter
  })
  
  // Appliquer les filtres de date
  let filteredPayments = paymentsData
  let filteredExpenses = expensesData

  if (dateDebut || dateFin) {
    const startDate = dateDebut ? new Date(dateDebut) : null
    const endDate = dateFin ? new Date(dateFin) : null

    filteredPayments = paymentsData.filter(p => {
      const paymentDate = new Date(p.paymentDate)
      return (!startDate || paymentDate >= startDate) && (!endDate || paymentDate <= endDate)
    })

    filteredExpenses = expensesData.filter(e => {
      const expenseDate = new Date(e.date)
      return (!startDate || expenseDate >= startDate) && (!endDate || expenseDate <= endDate)
    })
  }

  // Appliquer le filtre de programme
  if (programmeFilter !== 'tous') {
    filteredPayments = filteredPayments.filter(p => p.reservation?.program?.name === programmeFilter)
    filteredExpenses = filteredExpenses.filter(e => e.program?.name === programmeFilter)
  }

  // Calculer les statistiques globales avec vérifications
  const totalPaiements = filteredPayments.reduce((sum, p) => {
    const amount = parseFloat(p.amount) || 0
    return sum + amount
  }, 0)
  
  const totalDepenses = filteredExpenses.reduce((sum, e) => {
    const amount = parseFloat(e.amount) || 0
    return sum + amount
  }, 0)
  
  const soldeFinal = totalPaiements - totalDepenses

  console.log('Calculs:', {
    totalPaiements,
    totalDepenses,
    soldeFinal,
    filteredPaymentsCount: filteredPayments.length,
    filteredExpensesCount: filteredExpenses.length
  })

  // Calculer les données par mois
  const moisData = calculateMonthlyData(filteredPayments, filteredExpenses, periodeFilter)

  // Créer les détails des transactions
  const detailsData = createTransactionDetails(filteredPayments, filteredExpenses)

  // Trouver le mois avec le plus grand bénéfice
  const moisMaxBenefice = moisData.reduce((max, item) => (item.solde > max.solde ? item : max), { mois: "", solde: 0 })

  // Calculer les totaux pour le résumé
  const totalPaiementsMois = moisData.reduce((sum, item) => sum + item.paiements, 0)
  const totalDepensesMois = moisData.reduce((sum, item) => sum + item.depenses, 0)
  const soldeTotalMois = moisData.reduce((sum, item) => sum + item.solde, 0)

  return {
    statistics: {
      totalPaiements,
      totalDepenses,
      soldeFinal
    },
    moisData,
    detailsData,
    moisMaxBenefice,
    summary: {
      totalPaiements: totalPaiementsMois,
      totalDepenses: totalDepensesMois,
      soldeTotal: soldeTotalMois
    }
  }
}*/

/*// Fonction pour calculer les données par mois
function calculateMonthlyData(payments: any[], expenses: any[], periode: string) {
  const moisData: any[] = []
  
  // Déterminer le nombre de mois à analyser
  const monthsToAnalyze = periode === 'trimestre' ? 3 : periode === 'annee' ? 12 : 6
  
  // Générer les mois à analyser (les X derniers mois)
  const currentDate = new Date()
  for (let i = monthsToAnalyze - 1; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
    const mois = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    const moisCapitalized = mois.charAt(0).toUpperCase() + mois.slice(1)
    
    // Filtrer les paiements pour ce mois
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)
    
    const paiementsMois = payments.filter(p => {
      const paymentDate = new Date(p.paymentDate)
      return paymentDate >= monthStart && paymentDate <= monthEnd
    })
    
    const depensesMois = expenses.filter(e => {
      const expenseDate = new Date(e.date)
      return expenseDate >= monthStart && expenseDate <= monthEnd
    })
    
    const totalPaiementsMois = paiementsMois.reduce((sum, p) => {
      const amount = parseFloat(p.amount) || 0
      return sum + amount
    }, 0)
    
    const totalDepensesMois = depensesMois.reduce((sum, e) => {
      const amount = parseFloat(e.amount) || 0
      return sum + amount
    }, 0)
    
    const soldeMois = totalPaiementsMois - totalDepensesMois
    
    moisData.push({
      mois: moisCapitalized,
      paiements: totalPaiementsMois,
      depenses: totalDepensesMois,
      solde: soldeMois
    })
  }
  
  return moisData
}*/

/*// Fonction pour créer les détails des transactions
function createTransactionDetails(payments: any[], expenses: any[]) {
  const details: any[] = []
  
  // Ajouter les paiements
  payments.forEach(payment => {
    details.push({
      id: `payment_${payment.id}`,
      date: payment.paymentDate,
      type: 'paiement',
      description: `Paiement - ${payment.reservation?.firstName || 'N/A'} ${payment.reservation?.lastName || 'N/A'}`,
      montant: parseFloat(payment.amount) || 0,
      programme: payment.reservation?.program?.name || 'Programme non spécifié',
      reservationId: payment.reservationId
    })
  })
  
  // Ajouter les dépenses
  expenses.forEach(expense => {
    details.push({
      id: `expense_${expense.id}`,
      date: expense.date,
      type: 'depense',
      description: expense.description,
      montant: -(parseFloat(expense.amount) || 0), // Négatif pour les dépenses
      programme: expense.program?.name || 'Programme non spécifié',
      programId: expense.programId
    })
  })
  
  // Trier par date (plus récent en premier)
  return details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}*/

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

      console.log('✅ Balance API - Données reçues:', balanceData)
      console.log('✅ Analytics API - Données reçues:', analyticsResult)
      console.log('✅ Programs API - Données reçues:', programsData)
      
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

  // Charger les données au montage et quand les filtres changent
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Données par défaut si pas encore chargées
  const data = balanceData || {
    statistics: { totalPaiements: 0, totalDepenses: 0, soldeFinal: 0, countPaiements: 0, countDepenses: 0 },
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

  console.log('🔍 Debug - balanceData:', balanceData)
  console.log('🔍 Debug - analyticsData:', analyticsData)
  console.log('🔍 Debug - programmes:', programmes)
  console.log('🔍 Debug - data object:', data)

  const { statistics, parMois, details, summary, parMethodePaiement, parTypeDepense, parAgent } = data
  const { totalPaiements, totalDepenses, soldeFinal } = statistics || { totalPaiements: 0, totalDepenses: 0, soldeFinal: 0 }
  const { moisMaxBenefice } = summary || { moisMaxBenefice: { mois: "", solde: 0 } }

  // 🔍 Debug des données pour les graphiques
  console.log('🔍 Debug - Données pour graphiques:', {
    parMois: parMois || [],
    parTypeDepense: parTypeDepense || [],
    analyticsData: analyticsData || {},
    cashflowData: analyticsData?.cashflow?.data || []
  })

  // Filtrage des données par programme (fait côté serveur maintenant)
  const filteredDetails = details

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

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Total Paiements</p>
                  <p className="text-3xl font-bold text-green-800">{totalPaiements.toLocaleString()} DH</p>
                </div>
                <div className="bg-green-200 p-3 rounded-full">
                  <CreditCard className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">Total Dépenses</p>
                  <p className="text-3xl font-bold text-red-800">{Math.abs(totalDepenses).toLocaleString()} DH</p>
                </div>
                <div className="bg-red-200 p-3 rounded-full">
                  <FileText className="h-6 w-6 text-red-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Solde Final</p>
                  <p className="text-3xl font-bold text-blue-800">{soldeFinal.toLocaleString()} DH</p>
                </div>
                <div className="bg-blue-200 p-3 rounded-full">
                  <Wallet className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres */}
        <Card className="mb-6 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-500" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateDebut">Date début</Label>
                <Input
                  id="dateDebut"
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFin">Date fin</Label>
                <Input
                  id="dateFin"
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="programme">Programme</Label>
                <Select value={programmeFilter} onValueChange={(value) => setProgrammeFilter(value)}>
                  <SelectTrigger id="programme" className="border-2">
                    <SelectValue placeholder="Tous les programmes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tous les programmes</SelectItem>
                    {(programmes || []).map((programme) => (
                      <SelectItem key={programme.id} value={programme.name}>
                        {programme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="periode">Période</Label>
                <Select value={periodeFilter} onValueChange={(value) => setPeriodeFilter(value)}>
                  <SelectTrigger id="periode" className="border-2">
                    <SelectValue placeholder="Par mois" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mois">Par mois</SelectItem>
                    <SelectItem value="trimestre">Par trimestre</SelectItem>
                    <SelectItem value="annee">Par année</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analyse par mois */}
        {/* 🧪 Test Graphique Simple */}
        <div className="mb-6">
          <Card className="border-2 border-blue-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                Test Graphique Simple (Données Statiques)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { mois: "Jan", paiements: 100, depenses: 80 },
                    { mois: "Fév", paiements: 150, depenses: 120 },
                    { mois: "Mar", paiements: 200, depenses: 150 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mois" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="paiements" fill="#10b981" name="Paiements" />
                    <Bar dataKey="depenses" fill="#ef4444" name="Dépenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Si vous voyez ce graphique, Recharts fonctionne correctement.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={parMois || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="mois" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value?.substring(0, 3) || value}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k DH`}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          `${value.toLocaleString()} DH`, 
                          name === 'paiements' ? 'Paiements' : 'Dépenses'
                        ]}
                        labelFormatter={(label) => `Mois: ${label}`}
                      />
                      <Legend />
                      <Bar dataKey="paiements" fill="#10b981" name="Paiements" />
                      <Bar dataKey="depenses" fill="#ef4444" name="Dépenses" />
                    </BarChart>
                    {(parMois || []).length === 0 && (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <p>Aucune donnée disponible pour cette période</p>
                      </div>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pie Chart - Répartition des Dépenses */}
          <div>
            <Card className="border-0 shadow-lg h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-blue-500" />
                  Répartition des Dépenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Pie Chart */}
                  <div className="h-64 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={parTypeDepense || []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="total"
                        >
                          {(parTypeDepense || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={[
                              '#ef4444', // Rouge - Vol
                              '#f97316', // Orange - Hotel Madina  
                              '#eab308', // Jaune - Hotel Makkah
                              '#22c55e', // Vert - Visa
                              '#6366f1'  // Indigo - Autre
                            ][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => [`${value.toLocaleString()} DH`, 'Montant']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {(parTypeDepense || []).length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
                        <p className="text-gray-500 text-sm">Aucune donnée disponible</p>
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

        {/* 🎯 NOUVELLES SECTIONS ANALYTICS DÉCISIONNELLES */}
        {analyticsData && analyticsData.programRanking && analyticsData.agentRanking && (
          <>
            {/* 📊 Classements et Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
                    <LineChart className="h-5 w-5 text-purple-500" />
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

                    {/* Graphique Line Chart */}
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analyticsData.cashflow?.data || []}>
                          <defs>
                            <linearGradient id="colorCashflow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => value?.substring(5) || value}
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => `${value.toLocaleString()} DH`}
                          />
                          <Tooltip 
                            formatter={(value: any) => [`${value.toLocaleString()} DH`, 'Solde Net']}
                            labelFormatter={(label) => `Mois: ${label}`}
                          />
                          <Area
                            type="monotone"
                            dataKey="netCashflow"
                            stroke="#10b981"
                            strokeWidth={2}
                            fill="url(#colorCashflow)"
                            name="Solde Net"
                          />
                        </AreaChart>
                        {(analyticsData.cashflow?.data || []).length === 0 && (
                          <div className="flex items-center justify-center h-full text-gray-500">
                            <p>Aucune donnée de cashflow disponible</p>
                          </div>
                        )}
                      </ResponsiveContainer>
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

        {/* Détails des transactions */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-500" />
                Détails des transactions
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-gray-700">
                <ArrowUpDown className="h-4 w-4 mr-1" />
                Trier
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Description</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Programme</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(filteredDetails || []).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">
                        {new Date(item.date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            item.type === "paiement" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}
                        >
                          {item.type === "paiement" ? "Paiement" : "Dépense"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">{item.description}</td>
                      <td className="py-3 px-4 text-sm">{item.programme}</td>
                      <td
                        className={`py-3 px-4 text-sm font-medium text-right ${
                          item.montant > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {item.montant.toLocaleString()} DH
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </RoleProtectedRoute>
  )
}
