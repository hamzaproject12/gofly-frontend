"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { api } from "@/lib/api"
import RoleProtectedRoute from "../components/RoleProtectedRoute"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FileText,
  Download,
  Filter,
  CreditCard,
  TrendingUp,
  Trophy,
  DollarSign,
  Award,
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

type TimelinePoint = {
  day: number
  label: string
  paiements: number
  depenses: number
  profit: number
}

type MonthlyComparisonData = {
  month: string
  label: string
  paiements: number
  depenses: number
  paiementsPrevus: number
}

type ProgramComparisonData = {
  programName: string
  paiements: number
  depenses: number
  paiementsPrevus: number
}

type TimelineDayDetails = {
  date: string
  paiements: Array<{
    id: number
    amount: number
    paymentMethod: string
    paymentDate: string
    reservation: { id: number; clientName: string; programName: string | null } | null
    agent: { id: number; nom: string } | null
  }>
  depenses: Array<{
    id: number
    amount: number
    type: string
    description: string
    expenseDate: string
    program: { id: number; name: string } | null
    reservation: { id: number; clientName: string } | null
  }>
  summary: {
    totalPaiements: number
    totalDepenses: number
    profit: number
    countPaiements: number
    countDepenses: number
  }
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

// Fonction helper pour formater les nombres avec des points comme séparateurs de milliers
const formatNumberWithDots = (num: number): string => {
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const formatCurrency = (num: number) => `${formatNumberWithDots(num)} DH`
const formatSignedCurrency = (num: number) =>
  `${num >= 0 ? "+" : "-"}${formatNumberWithDots(Math.abs(num))} DH`
const formatAxisTick = (value: number) => `${Math.round(value / 1000)}k`
const formatDateLabel = (isoDate?: string) => {
  if (!isoDate) return ""
  const [y, m, d] = isoDate.split("-")
  if (!y || !m || !d) return isoDate
  return `${d}/${m}/${y}`
}

const timelineChartConfig: ChartConfig = {
  paiements: { label: "Paiements", color: "#16a34a" },
  depenses: { label: "Dépenses", color: "#dc2626" },
  profit: { label: "Profit", color: "#2563eb" },
}

const monthlyActualConfig: ChartConfig = {
  paiements: { label: "Paiements", color: "#16a34a" },
  depenses: { label: "Dépenses", color: "#dc2626" },
}

const monthlyExpectedConfig: ChartConfig = {
  paiementsPrevus: { label: "Paiements prévus", color: "#eab308" },
  depenses: { label: "Dépenses", color: "#dc2626" },
}

const agentsAmountConfig: ChartConfig = {
  totalAmount: { label: "Montant encaissé", color: "#2563eb" },
}

const agentsCountConfig: ChartConfig = {
  countPayments: { label: "Transactions", color: "#7c3aed" },
}

export default function SoldeCaissePage() {
  const { toast } = useToast()

  // États pour les filtres
  const [dateDebut, setDateDebut] = useState("")
  const [dateFin, setDateFin] = useState("")
  const [programmeFilter, setProgrammeFilter] = useState("tous")
  const [periodeFilter, setPeriodeFilter] = useState("mois")
  const [exporting, setExporting] = useState(false)

  // 📆 Le filtre par dates n'est appliqué que lorsque "De" ET "À" sont remplis.
  //    Saisir seulement "De" ne déclenche donc aucune requête.
  const datesReady = Boolean(dateDebut && dateFin)
  const appliedDateDebut = datesReady ? dateDebut : ""
  const appliedDateFin = datesReady ? dateFin : ""

  // États pour les données
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [programmes, setProgrammes] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([])
  const [monthlyComparisonData, setMonthlyComparisonData] = useState<MonthlyComparisonData[]>([])
  const [programComparisonData, setProgramComparisonData] = useState<ProgramComparisonData[]>([])
  const [chartsLoading, setChartsLoading] = useState(false)
  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string | null>(null)
  const [timelineDetailsOpen, setTimelineDetailsOpen] = useState(false)
  const [timelineDetailsLoading, setTimelineDetailsLoading] = useState(false)
  const [timelineDayDetails, setTimelineDayDetails] = useState<TimelineDayDetails | null>(null)

  // 🎯 Fonction optimisée pour récupérer les données via l'API Balance
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 🚀 UNE SEULE requête vers l'API Balance optimisée
      const params = new URLSearchParams()
      if (appliedDateDebut) params.append('dateDebut', appliedDateDebut)
      if (appliedDateFin) params.append('dateFin', appliedDateFin)
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
  }, [appliedDateDebut, appliedDateFin, programmeFilter, periodeFilter])

  // 🎯 Fonction pour récupérer les données des graphiques
  const fetchChartsData = useCallback(async () => {
    try {
      setChartsLoading(true)
      const params = new URLSearchParams()
      params.append('programme', programmeFilter || 'tous')
      if (appliedDateDebut) params.append('dateDebut', appliedDateDebut)
      if (appliedDateFin) params.append('dateFin', appliedDateFin)

      const [timelineRes, monthlyRes, programRes] = await Promise.all([
        fetch(api.url(`/api/balance/charts/timeline?${params.toString()}`)),
        fetch(api.url(`/api/balance/charts/monthly-comparison?${params.toString()}`)),
        fetch(api.url(`/api/balance/charts/program-comparison?${params.toString()}`))
      ])

      if ([timelineRes, monthlyRes, programRes].some((res) => !res.ok)) {
        throw new Error('Erreur lors du chargement des données des graphiques')
      }

      const [timelineChartData, monthlyChartData, programChartData] = await Promise.all([
        timelineRes.json(),
        monthlyRes.json(),
        programRes.json()
      ])

      setTimelineData(timelineChartData.data || [])
      setMonthlyComparisonData(monthlyChartData.data || [])
      setProgramComparisonData(programChartData.data || [])
    } catch (err) {
      console.error('❌ Erreur fetchChartsData:', err)
    } finally {
      setChartsLoading(false)
    }
  }, [programmeFilter, appliedDateDebut, appliedDateFin])

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
  const peakTimelinePayment = timelineData.reduce((max, item) => (item.paiements > max.paiements ? item : max), timelineData[0] || { day: 0, paiements: 0, depenses: 0, profit: 0, label: "" })
  const peakTimelineExpense = timelineData.reduce((max, item) => (item.depenses > max.depenses ? item : max), timelineData[0] || { day: 0, paiements: 0, depenses: 0, profit: 0, label: "" })
  const bestTimelineProfit = timelineData.reduce((max, item) => (item.profit > max.profit ? item : max), timelineData[0] || { day: 0, paiements: 0, depenses: 0, profit: 0, label: "" })
  const monthlyAverageProfit = monthlyComparisonData.length > 0
    ? monthlyComparisonData.reduce((sum, item) => sum + (item.paiements - item.depenses), 0) / monthlyComparisonData.length
    : 0
  const topProgramByActual = programComparisonData.reduce(
    (max, item) => ((item.paiements - item.depenses) > (max.paiements - max.depenses) ? item : max),
    programComparisonData[0] || { programName: "-", paiements: 0, depenses: 0, paiementsPrevus: 0 }
  )
  const profitDiffs = timelineData.slice(1).map((item, idx) => ({
    day: item.day,
    label: item.label,
    diff: item.profit - timelineData[idx].profit,
  }))
  const maxGrowth = profitDiffs.reduce(
    (max, item) => (item.diff > max.diff ? item : max),
    profitDiffs[0] || { day: 0, label: "", diff: 0 }
  )
  const maxDrop = profitDiffs.reduce(
    (min, item) => (item.diff < min.diff ? item : min),
    profitDiffs[0] || { day: 0, label: "", diff: 0 }
  )

  // Sans plage de dates (mode vue d'ensemble) : « par mois » est limité aux 4
  // mois les plus récents et « par programme » aux 4 premiers (les plus gros),
  // faute de place. Avec une plage de dates remplie, ces graphiques sont masqués.
  // Les totaux du résumé en haut restent toujours généraux.
  const hasPeriodFilter = datesReady

  const timelineDisplayData = timelineData

  const monthlyDisplayData = useMemo(
    () => (hasPeriodFilter ? monthlyComparisonData : monthlyComparisonData.slice(-4)),
    [hasPeriodFilter, monthlyComparisonData]
  )

  const programDisplayData = useMemo(
    () => (hasPeriodFilter ? programComparisonData : programComparisonData.slice(0, 4)),
    [hasPeriodFilter, programComparisonData]
  )

  const agentIndicativeData = useMemo(() => {
    const details = analyticsData?.agentRanking?.details || []
    return details.slice(0, 8).map((agent) => ({
      agentName: agent.agentName,
      totalAmount: agent.totalAmount || 0,
      countPayments: agent.countPayments || 0,
      avgAmount: agent.avgAmount || 0,
    }))
  }, [analyticsData])

  const monthlyActualDiffByLabel = useMemo(
    () => new Map(monthlyComparisonData.map((item) => [item.label, item.paiements - item.depenses])),
    [monthlyComparisonData]
  )
  const monthlyExpectedDiffByLabel = useMemo(
    () => new Map(monthlyComparisonData.map((item) => [item.label, item.paiementsPrevus - item.depenses])),
    [monthlyComparisonData]
  )

  const loadTimelineDayDetails = useCallback(async (date: string) => {
    try {
      setTimelineDetailsLoading(true)
      const params = new URLSearchParams()
      params.append("date", date)
      if (programmeFilter && programmeFilter !== "tous") {
        params.append("programme", programmeFilter)
      }
      const res = await fetch(api.url(`/api/balance/charts/timeline/details?${params.toString()}`))
      if (!res.ok) {
        throw new Error("Erreur lors du chargement du détail journalier")
      }
      const data = await res.json()
      setTimelineDayDetails(data.data || null)
      setTimelineDetailsOpen(true)
    } catch (error) {
      toast({
        title: "Chargement impossible",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      })
    } finally {
      setTimelineDetailsLoading(false)
    }
  }, [programmeFilter, toast])

  const getFilenameFromDisposition = (contentDisposition: string | null): string | null => {
    if (!contentDisposition) return null;
    const utf8Name = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    if (utf8Name) return decodeURIComponent(utf8Name.replace(/["']/g, ""));
    const basicName = contentDisposition.match(/filename="?([^"]+)"?/i)?.[1];
    return basicName ? basicName.trim() : null;
  };

  const isIOSDevice = (): boolean => {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/i.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  };

  const downloadBlob = useCallback(
    async (blob: Blob, fallbackFilename: string, contentDisposition?: string | null) => {
      const filename = getFilenameFromDisposition(contentDisposition || null) || fallbackFilename;
      const nav = window.navigator as Navigator & {
        msSaveOrOpenBlob?: (blobToSave: Blob, defaultName?: string) => boolean;
        canShare?: (data?: ShareData) => boolean;
      };

      if (typeof nav.msSaveOrOpenBlob === "function") {
        nav.msSaveOrOpenBlob(blob, filename);
        return;
      }

      if (typeof File !== "undefined" && nav.share && nav.canShare) {
        try {
          const file = new File([blob], filename, { type: blob.type || "text/csv;charset=utf-8;" });
          if (nav.canShare({ files: [file] })) {
            await nav.share({ files: [file], title: "Export Solde de Caisse" });
            return;
          }
        } catch {
          // Continue with fallback.
        }
      }

      const url = URL.createObjectURL(blob);
      if (isIOSDevice()) {
        const opened = window.open(url, "_blank", "noopener,noreferrer");
        if (!opened) window.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    []
  );

  const handleExportData = useCallback(async () => {
    try {
      setExporting(true);

      const lines: string[] = [];
      const toCsv = (value: string | number | null | undefined) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;

      lines.push("Section,Champ,Valeur");
      lines.push(`"Resume","Total paiements",${toCsv(totalPaiements)}`);
      lines.push(`"Resume","Total depenses",${toCsv(totalDepenses)}`);
      lines.push(`"Resume","Gain prevu",${toCsv(gainPrevu)}`);
      lines.push(`"Resume","Solde final",${toCsv(soldeFinal)}`);
      lines.push(`"Resume","Solde final prevu",${toCsv(soldeFinalPrevu)}`);
      lines.push(`"Resume","Mois max benefice",${toCsv(moisMaxBenefice?.mois || "")}`);
      lines.push(`"Resume","Valeur mois max benefice",${toCsv(moisMaxBenefice?.solde || 0)}`);

      lines.push("");
      lines.push("Par mois,Mois,Paiements,Depenses,Solde");
      (parMois || []).forEach((m) => {
        lines.push([toCsv("Par mois"), toCsv(m.mois), toCsv(m.paiements), toCsv(m.depenses), toCsv(m.solde)].join(","));
      });

      lines.push("");
      lines.push("Methode paiement,Methode,Total,Count");
      (parMethodePaiement || []).forEach((item) => {
        lines.push([toCsv("Methode paiement"), toCsv(item.methode), toCsv(item.total), toCsv(item.count)].join(","));
      });

      lines.push("");
      lines.push("Type depense,Type,Total,Count");
      (parTypeDepense || []).forEach((item) => {
        lines.push([toCsv("Type depense"), toCsv(item.type), toCsv(item.total), toCsv(item.count)].join(","));
      });

      lines.push("");
      lines.push("Par agent,Agent,Total,Count");
      (parAgent || []).forEach((item) => {
        lines.push([toCsv("Par agent"), toCsv(item.agentName), toCsv(item.total), toCsv(item.count)].join(","));
      });

      const csv = "\uFEFF" + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadBlob(blob, `solde-caisse-${stamp}.csv`);

      toast({
        title: "Export reussi",
        description: "Le fichier CSV a ete telecharge.",
      });
    } catch (e) {
      toast({
        title: "Export impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }, [
    downloadBlob,
    gainPrevu,
    moisMaxBenefice?.mois,
    moisMaxBenefice?.solde,
    parAgent,
    parMethodePaiement,
    parMois,
    parTypeDepense,
    soldeFinal,
    soldeFinalPrevu,
    toast,
    totalDepenses,
    totalPaiements,
  ]);



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
      {/* Page d'analyse en lecture seule : ses filtres ne doivent pas
          déclencher l'alerte "modifications non enregistrées". */}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100" data-skip-unsaved-dirty>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calcul du Solde de Caisse</h1>
            <p className="text-gray-500 mt-1">Analysez les paiements et dépenses pour calculer le solde</p>
          </div>
          <Button
            onClick={handleExportData}
            disabled={exporting}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Export..." : "Exporter les donnees"}
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
                  {formatNumberWithDots(soldeFinal)} DH
                </div>
                <p className="text-slate-300 text-sm">Solde Final</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Total Paiements */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-300 text-sm">Total Paiements</p>
                    <p className="text-2xl font-bold text-green-400">{formatNumberWithDots(totalPaiements)} DH</p>
                </div>
                  <CreditCard className="h-8 w-8 text-green-400" />
                </div>
              </div>

              {/* Total Paiement Prévu */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-300 text-sm">Total Paiement Prévu</p>
                    <p className="text-2xl font-bold text-yellow-400">{formatNumberWithDots(gainPrevu)} DH</p>
                </div>
                  <DollarSign className="h-8 w-8 text-yellow-400" />
                </div>
              </div>

              {/* Total Dépenses */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-300 text-sm">Total Dépenses</p>
                    <p className="text-2xl font-bold text-red-400">{formatNumberWithDots(Math.abs(totalDepenses))} DH</p>
                </div>
                  <FileText className="h-8 w-8 text-red-400" />
                </div>
              </div>

              {/* Solde Final Prévu */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-300 text-sm">Solde Final Prévu</p>
                    <p className="text-2xl font-bold text-blue-400">{formatNumberWithDots(soldeFinalPrevu)} DH</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <Label htmlFor="dateDebut" className="text-sm font-semibold text-gray-700">
                  📆 De
                </Label>
                <Input
                  id="dateDebut"
                  type="date"
                  value={dateDebut}
                  max={dateFin || undefined}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="border-2 border-gray-200 focus:border-blue-500 rounded-lg h-11"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="dateFin" className="text-sm font-semibold text-gray-700">
                  📆 À
                </Label>
                <Input
                  id="dateFin"
                  type="date"
                  value={dateFin}
                  min={dateDebut || undefined}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="border-2 border-gray-200 focus:border-blue-500 rounded-lg h-11"
                />
              </div>
            </div>
            {(dateDebut || dateFin) && (
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 border-2"
                  onClick={() => {
                    setDateDebut("")
                    setDateFin("")
                  }}
                >
                  Effacer les dates
                </Button>
              </div>
            )}
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

        <Card className="border-0 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Paiements vs Dépenses vs Profit (du premier au dernier mouvement)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 p-2">
              {chartsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : timelineData.length > 1 ? (
                <div className="relative group h-full">
                  <ChartContainer config={timelineChartConfig} className="h-full w-full aspect-auto cursor-pointer">
                    <LineChart
                      data={timelineDisplayData}
                      margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                      onClick={(state: any) => {
                        const date = state?.activeLabel as string | undefined
                        if (!date) return
                        setSelectedTimelineDate(date)
                        void loadTimelineDayDetails(date)
                      }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => formatDateLabel(String(value))}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => formatAxisTick(Number(value))}
                      />
                      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            labelFormatter={(_, payload) => {
                              const item = payload?.[0]?.payload as TimelinePoint | undefined
                              return item ? `${formatDateLabel(item.label)} (index J${item.day})` : ""
                            }}
                            formatter={(value, name) => (
                              <div className="flex w-full items-center justify-between gap-4">
                                <span className="text-muted-foreground">{timelineChartConfig[name as string]?.label || name}</span>
                                <span className="font-mono font-semibold">
                                  {formatCurrency(Number(value))}
                                </span>
                              </div>
                            )}
                          />
                        }
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line type="monotone" dataKey="paiements" stroke="var(--color-paiements)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="depenses" stroke="var(--color-depenses)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="profit" stroke="var(--color-profit)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                      {maxGrowth.day > 0 && (
                        <ReferenceDot x={maxGrowth.label} y={timelineDisplayData.find((d) => d.day === maxGrowth.day)?.profit || 0} r={5} fill="#16a34a" stroke="#fff" />
                      )}
                      {maxDrop.day > 0 && (
                        <ReferenceDot x={maxDrop.label} y={timelineDisplayData.find((d) => d.day === maxDrop.day)?.profit || 0} r={5} fill="#dc2626" stroke="#fff" />
                      )}
                      <Brush dataKey="label" tickFormatter={(value) => formatDateLabel(String(value))} height={20} stroke="#64748b" travellerWidth={10} />
                    </LineChart>
                  </ChartContainer>
                  <div className="pointer-events-none absolute top-2 right-2 rounded-md bg-blue-600/90 text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Cliquez sur un jour pour voir le détail
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>Aucune donnée disponible</p>
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div className="rounded-md bg-green-50 p-2">
                <span className="text-green-800 font-medium">Pic Paiements</span>
                <div className="text-green-700">{formatDateLabel(peakTimelinePayment.label)} • {formatCurrency(peakTimelinePayment.paiements)}</div>
              </div>
              <div className="rounded-md bg-red-50 p-2">
                <span className="text-red-800 font-medium">Pic Dépenses</span>
                <div className="text-red-700">{formatDateLabel(peakTimelineExpense.label)} • {formatCurrency(peakTimelineExpense.depenses)}</div>
              </div>
              <div className="rounded-md bg-blue-50 p-2">
                <span className="text-blue-800 font-medium">Meilleur Profit</span>
                <div className="text-blue-700">{formatDateLabel(bestTimelineProfit.label)} • {formatCurrency(bestTimelineProfit.profit)}</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-emerald-50 p-2 text-emerald-800">
                Croissance max du profit: {formatDateLabel(maxGrowth.label)} • {formatCurrency(maxGrowth.diff)}
              </div>
              <div className="rounded-md bg-rose-50 p-2 text-rose-800">
                Chute max du profit: {formatDateLabel(maxDrop.label)} • {formatCurrency(maxDrop.diff)}
              </div>
            </div>
            {timelineData.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Période affichée: {formatDateLabel(timelineData[0]?.label)} → {formatDateLabel(timelineData[timelineData.length - 1]?.label)}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Clique sur un point/jour pour afficher le détail des paiements et dépenses de cette date.
            </p>
          </CardContent>
        </Card>

        {!datesReady && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Total Paiements vs Dépenses (par mois)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 p-1">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  </div>
                ) : monthlyComparisonData.length > 0 ? (
                  <ChartContainer config={monthlyActualConfig} className="h-full w-full aspect-auto">
                    <BarChart data={monthlyDisplayData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tick={(props: any) => {
                          const { x, y, payload } = props
                          const label = String(payload?.value || "")
                          const diff = monthlyActualDiffByLabel.get(label) || 0
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={0} dy={10} textAnchor="middle" fill="#64748b" fontSize={11}>
                                {label}
                              </text>
                              <text x={0} y={0} dy={25} textAnchor="middle" fill={diff >= 0 ? "#16a34a" : "#dc2626"} fontSize={12} fontWeight={700}>
                                {formatSignedCurrency(diff)}
                              </text>
                            </g>
                          )
                        }}
                        height={44}
                      />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatAxisTick(Number(value))} />
                      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="paiements" fill="var(--color-paiements)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="depenses" fill="var(--color-depenses)" radius={[4, 4, 0, 0]} />
                      <Brush dataKey="label" height={18} stroke="#64748b" travellerWidth={10} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500"><p>Aucune donnée disponible</p></div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Total Paiements Prévus vs Dépenses (par mois)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 p-1">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
                  </div>
                ) : monthlyComparisonData.length > 0 ? (
                  <ChartContainer config={monthlyExpectedConfig} className="h-full w-full aspect-auto">
                    <BarChart data={monthlyDisplayData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tick={(props: any) => {
                          const { x, y, payload } = props
                          const label = String(payload?.value || "")
                          const diff = monthlyExpectedDiffByLabel.get(label) || 0
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={0} dy={10} textAnchor="middle" fill="#64748b" fontSize={11}>
                                {label}
                              </text>
                              <text x={0} y={0} dy={25} textAnchor="middle" fill={diff >= 0 ? "#16a34a" : "#dc2626"} fontSize={12} fontWeight={700}>
                                {formatSignedCurrency(diff)}
                              </text>
                            </g>
                          )
                        }}
                        height={44}
                      />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatAxisTick(Number(value))} />
                      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="paiementsPrevus" fill="var(--color-paiementsPrevus)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="depenses" fill="var(--color-depenses)" radius={[4, 4, 0, 0]} />
                      <Brush dataKey="label" height={18} stroke="#64748b" travellerWidth={10} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500"><p>Aucune donnée disponible</p></div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Moyenne du profit mensuel: {formatCurrency(monthlyAverageProfit)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Total Paiements vs Dépenses (par programme)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 p-1">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : programComparisonData.length > 0 ? (
                  <ChartContainer config={monthlyActualConfig} className="h-full w-full aspect-auto">
                    <BarChart data={programDisplayData.slice(0, 10)} margin={{ left: 8, right: 8, top: 8, bottom: 24 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="programName"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        angle={-20}
                        textAnchor="end"
                        interval={0}
                        height={74}
                        tick={(props: any) => {
                          const { x, y, payload } = props
                          const name = String(payload?.value || "")
                          const item = programComparisonData.find((p) => p.programName === name)
                          const diff = item ? item.paiements - item.depenses : 0
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={0} dy={10} textAnchor="end" transform="rotate(-20)" fill="#64748b" fontSize={10}>
                                {name}
                              </text>
                              <text x={0} y={0} dy={32} textAnchor="middle" fill={diff >= 0 ? "#16a34a" : "#dc2626"} fontSize={11} fontWeight={700}>
                                {formatSignedCurrency(diff)}
                              </text>
                            </g>
                          )
                        }}
                      />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatAxisTick(Number(value))} />
                      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="paiements" fill="var(--color-paiements)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="depenses" fill="var(--color-depenses)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500"><p>Aucune donnée disponible</p></div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Total Paiements Prévus vs Dépenses (par programme)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 p-1">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                  </div>
                ) : programComparisonData.length > 0 ? (
                  <ChartContainer config={monthlyExpectedConfig} className="h-full w-full aspect-auto">
                    <BarChart data={programDisplayData.slice(0, 10)} margin={{ left: 8, right: 8, top: 8, bottom: 24 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="programName"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        angle={-20}
                        textAnchor="end"
                        interval={0}
                        height={74}
                        tick={(props: any) => {
                          const { x, y, payload } = props
                          const name = String(payload?.value || "")
                          const item = programComparisonData.find((p) => p.programName === name)
                          const diff = item ? item.paiementsPrevus - item.depenses : 0
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={0} dy={10} textAnchor="end" transform="rotate(-20)" fill="#64748b" fontSize={10}>
                                {name}
                              </text>
                              <text x={0} y={0} dy={32} textAnchor="middle" fill={diff >= 0 ? "#16a34a" : "#dc2626"} fontSize={11} fontWeight={700}>
                                {formatSignedCurrency(diff)}
                              </text>
                            </g>
                          )
                        }}
                      />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatAxisTick(Number(value))} />
                      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="paiementsPrevus" fill="var(--color-paiementsPrevus)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="depenses" fill="var(--color-depenses)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500"><p>Aucune donnée disponible</p></div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Top programme (réel): {topProgramByActual.programName} • Profit {formatCurrency(topProgramByActual.paiements - topProgramByActual.depenses)}</p>
            </CardContent>
          </Card>
        </div>

        </>
        )}

        {/* 🏆 TABLEAUX & CLASSEMENTS */}
        {analyticsData && analyticsData.programRanking && analyticsData.agentRanking && (
          <>
            {!datesReady && (
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

            </>
            )}

            {/* 👥 Indicateurs Agents */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">👥 Indicateurs Agents</h2>
                <Badge variant="outline" className="text-blue-600 border-blue-200">
                  Graphes indicatifs
                </Badge>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-base">Encaissement par agent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      {agentIndicativeData.length > 0 ? (
                        <ChartContainer config={agentsAmountConfig} className="h-full w-full aspect-auto">
                          <BarChart data={agentIndicativeData} margin={{ left: 8, right: 8, top: 8, bottom: 24 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="agentName" tickLine={false} axisLine={false} angle={-20} textAnchor="end" interval={0} height={52} />
                            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                            <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                            <Bar dataKey="totalAmount" fill="var(--color-totalAmount)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée agent</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-base">Transactions par agent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      {agentIndicativeData.length > 0 ? (
                        <ChartContainer config={agentsCountConfig} className="h-full w-full aspect-auto">
                          <BarChart data={agentIndicativeData} margin={{ left: 8, right: 8, top: 8, bottom: 24 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="agentName" tickLine={false} axisLine={false} angle={-20} textAnchor="end" interval={0} height={52} />
                            <YAxis tickLine={false} axisLine={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="countPayments" fill="var(--color-countPayments)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée agent</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-base">Répartition encaissement agents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      {agentIndicativeData.length > 0 ? (
                        <ChartContainer config={{ totalAmount: { label: "Encaissement", color: "#2563eb" } }} className="h-full w-full aspect-auto">
                          <PieChart>
                            <Pie data={agentIndicativeData} dataKey="totalAmount" nameKey="agentName" innerRadius={38} outerRadius={90} paddingAngle={2}>
                              {agentIndicativeData.map((_, index) => {
                                const palette = ["#2563eb", "#7c3aed", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444", "#e11d48"]
                                return <Cell key={`agent-pie-${index}`} fill={palette[index % palette.length]} />
                              })}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée agent</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

          </>
        )}

        <Dialog open={timelineDetailsOpen} onOpenChange={setTimelineDetailsOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Détail journalier — {formatDateLabel(selectedTimelineDate || timelineDayDetails?.date || "")}</DialogTitle>
              <DialogDescription>
                Historique détaillé des paiements et dépenses du jour sélectionné.
              </DialogDescription>
            </DialogHeader>

            {timelineDetailsLoading ? (
              <div className="py-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            ) : timelineDayDetails ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-xs text-green-800">Total paiements</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(timelineDayDetails.summary.totalPaiements)}</p>
                    <p className="text-xs text-green-700">{timelineDayDetails.summary.countPaiements} opérations</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3">
                    <p className="text-xs text-red-800">Total dépenses</p>
                    <p className="text-lg font-bold text-red-700">{formatCurrency(timelineDayDetails.summary.totalDepenses)}</p>
                    <p className="text-xs text-red-700">{timelineDayDetails.summary.countDepenses} opérations</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs text-blue-800">Profit du jour</p>
                    <p className={`text-lg font-bold ${timelineDayDetails.summary.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {formatCurrency(timelineDayDetails.summary.profit)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Paiements ({timelineDayDetails.paiements.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {timelineDayDetails.paiements.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucun paiement ce jour.</p>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {timelineDayDetails.paiements.map((p) => (
                            <div key={p.id} className="rounded-md border p-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-green-700">{formatCurrency(p.amount)}</span>
                                <span className="text-xs text-muted-foreground">{new Date(p.paymentDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Méthode: {p.paymentMethod}</p>
                              <p className="text-xs">Client: {p.reservation?.clientName || "N/A"}</p>
                              <p className="text-xs text-muted-foreground">Programme: {p.reservation?.programName || "N/A"} • Agent: {p.agent?.nom || "N/A"}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Dépenses ({timelineDayDetails.depenses.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {timelineDayDetails.depenses.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucune dépense ce jour.</p>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {timelineDayDetails.depenses.map((d) => (
                            <div key={d.id} className="rounded-md border p-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-red-700">{formatCurrency(d.amount)}</span>
                                <span className="text-xs text-muted-foreground">{new Date(d.expenseDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              <p className="text-xs">Type: {d.type}</p>
                              <p className="text-xs text-muted-foreground">{d.description}</p>
                              <p className="text-xs text-muted-foreground">Programme: {d.program?.name || "N/A"} • Réservation: {d.reservation?.clientName || "N/A"}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">Aucun détail trouvé pour ce jour.</p>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </div>
    </RoleProtectedRoute>
  )
}
