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
  ComposedChart,
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
const signedLog = (value: number) => {
  if (value === 0) return 0
  return Math.sign(value) * Math.log10(Math.abs(value) + 1)
}
const formatAxisTick = (value: number, mode: "raw" | "indexed") =>
  mode === "raw" ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`
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

export default function SoldeCaissePage() {
  const { toast } = useToast()
  const chartPrefsStorageKey = "solde-caisse-chart-prefs-v1"

  // États pour les filtres
  const [dateDebut, setDateDebut] = useState("")
  const [dateFin, setDateFin] = useState("")
  const [programmeFilter, setProgrammeFilter] = useState("tous")
  const [periodeFilter, setPeriodeFilter] = useState("mois")
  const [chartScaleMode, setChartScaleMode] = useState<"linear" | "log">("linear")
  const [chartViewMode, setChartViewMode] = useState<"raw" | "indexed">("raw")
  const [exporting, setExporting] = useState(false)

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
  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([])
  const [monthlyComparisonData, setMonthlyComparisonData] = useState<MonthlyComparisonData[]>([])
  const [programComparisonData, setProgramComparisonData] = useState<ProgramComparisonData[]>([])
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
      const params = new URLSearchParams()
      params.append('programme', programmeFilter || 'tous')
      if (dateDebut) params.append('dateDebut', dateDebut)
      if (dateFin) params.append('dateFin', dateFin)
      
      // Récupérer toutes les données des graphiques en parallèle
      const [
        roomsRes,
        hotelsRes,
        genderRes,
        soldeRes,
        timelineRes,
        monthlyRes,
        programRes
      ] = await Promise.all([
        fetch(api.url(`/api/balance/charts/rooms?${params.toString()}`)),
        fetch(api.url(`/api/balance/charts/hotels?${params.toString()}`)),
        fetch(api.url(`/api/balance/charts/gender?${params.toString()}`)),
        fetch(api.url(`/api/balance/charts/solde?${params.toString()}`)),
        fetch(api.url(`/api/balance/charts/timeline?${params.toString()}`)),
        fetch(api.url(`/api/balance/charts/monthly-comparison?${params.toString()}`)),
        fetch(api.url(`/api/balance/charts/program-comparison?${params.toString()}`))
      ])

      const allResponses = [roomsRes, hotelsRes, genderRes, soldeRes, timelineRes, monthlyRes, programRes]
      if (allResponses.some((res) => !res.ok)) {
        throw new Error('Erreur lors du chargement des données des graphiques')
      }

      const [roomsData, hotelsData, genderData, soldeData, timelineChartData, monthlyChartData, programChartData] = await Promise.all([
        roomsRes.json(),
        hotelsRes.json(),
        genderRes.json(),
        soldeRes.json(),
        timelineRes.json(),
        monthlyRes.json(),
        programRes.json()
      ])

      setRoomsData(roomsData.data || [])
      setHotelsData(hotelsData.data || [])
      setGenderData(genderData.data || [])
      setSoldeData(soldeData.data || [])
      setTimelineData(timelineChartData.data || [])
      setMonthlyComparisonData(monthlyChartData.data || [])
      setProgramComparisonData(programChartData.data || [])

      console.log('✅ Graphiques chargés:', {
        rooms: roomsData.data?.length || 0,
        hotels: hotelsData.data?.length || 0,
        gender: genderData.data?.length || 0,
        solde: soldeData.data?.length || 0,
        timeline: timelineChartData.data?.length || 0,
        monthly: monthlyChartData.data?.length || 0,
        program: programChartData.data?.length || 0
      })
    } catch (err) {
      console.error('❌ Erreur fetchChartsData:', err)
    } finally {
      setChartsLoading(false)
    }
  }, [programmeFilter, dateDebut, dateFin])

  // Charger les données au montage et quand les filtres changent
  useEffect(() => {
    fetchData()
    fetchChartsData()
  }, [fetchData, fetchChartsData])

  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(chartPrefsStorageKey)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as {
        scaleMode?: "linear" | "log"
        viewMode?: "raw" | "indexed"
      }
      if (parsed.scaleMode === "linear" || parsed.scaleMode === "log") {
        setChartScaleMode(parsed.scaleMode)
      }
      if (parsed.viewMode === "raw" || parsed.viewMode === "indexed") {
        setChartViewMode(parsed.viewMode)
      }
    } catch {
      // Ignore corrupted local preference values.
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      chartPrefsStorageKey,
      JSON.stringify({ scaleMode: chartScaleMode, viewMode: chartViewMode })
    )
  }, [chartPrefsStorageKey, chartScaleMode, chartViewMode])

  const resetChartView = () => {
    setChartScaleMode("linear")
    setChartViewMode("raw")
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(chartPrefsStorageKey)
    }
  }

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

  const toIndexed = useCallback((values: number[]) => {
    const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1)
    return values.map((v) => (v / maxAbs) * 100)
  }, [])

  const timelineDisplayData = useMemo(() => {
    if (chartViewMode === "raw" && chartScaleMode === "linear") return timelineData
    const p = timelineData.map((d) => d.paiements)
    const e = timelineData.map((d) => d.depenses)
    const r = timelineData.map((d) => d.profit)
    const [p2, e2, r2] =
      chartViewMode === "indexed"
        ? [toIndexed(p), toIndexed(e), toIndexed(r)]
        : [p, e, r]
    return timelineData.map((d, i) => ({
      ...d,
      paiements: chartScaleMode === "log" ? signedLog(p2[i]) : p2[i],
      depenses: chartScaleMode === "log" ? signedLog(e2[i]) : e2[i],
      profit: chartScaleMode === "log" ? signedLog(r2[i]) : r2[i],
    }))
  }, [chartScaleMode, chartViewMode, timelineData, toIndexed])

  const monthlyDisplayData = useMemo(() => {
    if (chartViewMode === "raw" && chartScaleMode === "linear") return monthlyComparisonData
    const p = monthlyComparisonData.map((d) => d.paiements)
    const e = monthlyComparisonData.map((d) => d.depenses)
    const pp = monthlyComparisonData.map((d) => d.paiementsPrevus)
    const [p2, e2, pp2] =
      chartViewMode === "indexed"
        ? [toIndexed(p), toIndexed(e), toIndexed(pp)]
        : [p, e, pp]
    return monthlyComparisonData.map((d, i) => ({
      ...d,
      paiements: chartScaleMode === "log" ? signedLog(p2[i]) : p2[i],
      depenses: chartScaleMode === "log" ? signedLog(e2[i]) : e2[i],
      paiementsPrevus: chartScaleMode === "log" ? signedLog(pp2[i]) : pp2[i],
    }))
  }, [chartScaleMode, chartViewMode, monthlyComparisonData, toIndexed])

  const programDisplayData = useMemo(() => {
    if (chartViewMode === "raw" && chartScaleMode === "linear") return programComparisonData
    const p = programComparisonData.map((d) => d.paiements)
    const e = programComparisonData.map((d) => d.depenses)
    const pp = programComparisonData.map((d) => d.paiementsPrevus)
    const [p2, e2, pp2] =
      chartViewMode === "indexed"
        ? [toIndexed(p), toIndexed(e), toIndexed(pp)]
        : [p, e, pp]
    return programComparisonData.map((d, i) => ({
      ...d,
      paiements: chartScaleMode === "log" ? signedLog(p2[i]) : p2[i],
      depenses: chartScaleMode === "log" ? signedLog(e2[i]) : e2[i],
      paiementsPrevus: chartScaleMode === "log" ? signedLog(pp2[i]) : pp2[i],
    }))
  }, [chartScaleMode, chartViewMode, programComparisonData, toIndexed])

  const parMoisDisplayData = useMemo(() => {
    if (chartViewMode === "raw" && chartScaleMode === "linear") return parMois
    const p = parMois.map((d) => d.paiements)
    const e = parMois.map((d) => d.depenses)
    const s = parMois.map((d) => d.solde)
    const [p2, e2, s2] =
      chartViewMode === "indexed"
        ? [toIndexed(p), toIndexed(e), toIndexed(s)]
        : [p, e, s]
    return parMois.map((d, i) => ({
      ...d,
      paiements: chartScaleMode === "log" ? signedLog(p2[i]) : p2[i],
      depenses: chartScaleMode === "log" ? signedLog(e2[i]) : e2[i],
      solde: chartScaleMode === "log" ? signedLog(s2[i]) : s2[i],
    }))
  }, [chartScaleMode, chartViewMode, parMois, toIndexed])

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
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
              <div className="space-y-3">
                <Label htmlFor="chartScale" className="text-sm font-semibold text-gray-700">
                  ⚙️ Échelle graphe
                </Label>
                <Select value={chartScaleMode} onValueChange={(value: "linear" | "log") => setChartScaleMode(value)}>
                  <SelectTrigger id="chartScale" className="border-2 border-gray-200 focus:border-blue-500 rounded-lg h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linéaire</SelectItem>
                    <SelectItem value="log">Log signée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="chartViewMode" className="text-sm font-semibold text-gray-700">
                  🎯 Mode de vue
                </Label>
                <Select value={chartViewMode} onValueChange={(value: "raw" | "indexed") => setChartViewMode(value)}>
                  <SelectTrigger id="chartViewMode" className="border-2 border-gray-200 focus:border-blue-500 rounded-lg h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">Valeurs brutes</SelectItem>
                    <SelectItem value="indexed">Indice (base 100)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700">🧹 Réinitialiser</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 border-2"
                  onClick={resetChartView}
                >
                  Reset vue graphe
                </Button>
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
                <ChartContainer config={timelineChartConfig} className="h-full w-full aspect-auto">
                  <LineChart data={timelineDisplayData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
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
                      tickFormatter={(value) => formatAxisTick(Number(value), chartViewMode)}
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
                                {chartViewMode === "raw" ? formatCurrency(Number(value)) : `${Number(value).toFixed(1)} idx`}
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
          </CardContent>
        </Card>

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
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatAxisTick(Number(value), chartViewMode)} />
                      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent formatter={(value) => chartViewMode === "raw" ? formatCurrency(Number(value)) : `${Number(value).toFixed(1)} idx`} />}
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
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatAxisTick(Number(value), chartViewMode)} />
                      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent formatter={(value) => chartViewMode === "raw" ? formatCurrency(Number(value)) : `${Number(value).toFixed(1)} idx`} />}
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
                      <XAxis dataKey="programName" tickLine={false} axisLine={false} tickMargin={8} angle={-20} textAnchor="end" interval={0} height={52} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatAxisTick(Number(value), chartViewMode)} />
                      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent formatter={(value) => chartViewMode === "raw" ? formatCurrency(Number(value)) : `${Number(value).toFixed(1)} idx`} />}
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
                      <XAxis dataKey="programName" tickLine={false} axisLine={false} tickMargin={8} angle={-20} textAnchor="end" interval={0} height={52} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatAxisTick(Number(value), chartViewMode)} />
                      <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent formatter={(value) => chartViewMode === "raw" ? formatCurrency(Number(value)) : `${Number(value).toFixed(1)} idx`} />}
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
                <div className="h-80 p-1">
                  {(parMois || []).length > 0 ? (
                    <ChartContainer config={timelineChartConfig} className="h-full w-full aspect-auto">
                      <ComposedChart data={parMoisDisplayData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="mois" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatAxisTick(Number(value), chartViewMode)} />
                        <ChartTooltip content={<ChartTooltipContent formatter={(value) => chartViewMode === "raw" ? formatCurrency(Number(value)) : `${Number(value).toFixed(1)} idx`} />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="paiements" fill="var(--color-paiements)" name="Paiements" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="depenses" fill="var(--color-depenses)" name="Dépenses" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="solde" stroke="var(--color-profit)" strokeWidth={2.5} dot={{ r: 3 }} name="Solde" />
                      </ComposedChart>
                    </ChartContainer>
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
                  <div className="h-64 p-1">
                    {(parTypeDepense || []).length > 0 ? (
                      <ChartContainer
                        config={{
                          total: { label: "Montant", color: "#dc2626" },
                        }}
                        className="h-full w-full aspect-auto"
                      >
                        <PieChart>
                          <Pie
                            data={parTypeDepense}
                            dataKey="total"
                            nameKey="type"
                            innerRadius={40}
                            outerRadius={95}
                            paddingAngle={3}
                          >
                            {parTypeDepense.map((_, index) => {
                              const palette = ["#dc2626", "#ea580c", "#eab308", "#16a34a", "#2563eb", "#7c3aed"]
                              return <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
                            })}
                          </Pie>
                          <ChartTooltip
                            content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />}
                          />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ChartContainer>
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

        {/* 📈 ANALYSES AVANCÉES */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-gray-800">📈 Analyses Avancées</h2>
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
              <div className="h-80 p-1">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : roomsData.length > 0 ? (
                  <ChartContainer
                    config={{
                      nbRoomsReserver: { label: "Réservées", color: "#dc2626" },
                      nbRoomsRestant: { label: "Disponibles", color: "#16a34a" },
                    }}
                    className="h-full w-full aspect-auto"
                  >
                    <BarChart data={roomsData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="roomType" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="nbRoomsReserver" fill="var(--color-nbRoomsReserver)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="nbRoomsRestant" fill="var(--color-nbRoomsRestant)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
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
                <HotelIcon className="h-5 w-5 text-green-500" />
                Répartition par Hôtel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 p-1">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  </div>
                ) : hotelsData.length > 0 ? (
                  <ChartContainer
                    config={{ nbPersonnes: { label: "Personnes", color: "#16a34a" } }}
                    className="h-full w-full aspect-auto"
                  >
                    <BarChart data={hotelsData.slice(0, 10)} margin={{ bottom: 24 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="hotelName" tickLine={false} axisLine={false} angle={-20} textAnchor="end" interval={0} height={52} />
                      <YAxis tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="nbPersonnes" fill="var(--color-nbPersonnes)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Aucune donnée disponible</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 👥 Graphique Genres */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                Répartition par Genre
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 p-1">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : genderData.length > 0 ? (
                  <ChartContainer
                    config={{ nbReservations: { label: "Réservations", color: "#7c3aed" } }}
                    className="h-full w-full aspect-auto"
                  >
                    <BarChart data={genderData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="gender" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="nbReservations" fill="var(--color-nbReservations)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Aucune donnée disponible</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 💰 Graphique Solde Financier */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-yellow-500" />
                Solde Financier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 p-1">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
                  </div>
                ) : soldeData.length > 0 ? (
                  <ChartContainer
                    config={{ montant: { label: "Montant", color: "#eab308" } }}
                    className="h-full w-full aspect-auto"
                  >
                    <BarChart data={soldeData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="type" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatAxisTick(Number(value), chartViewMode)} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                      <Bar dataKey="montant" fill="var(--color-montant)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Aucune donnée disponible</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 🏆 TABLEAUX & CLASSEMENTS */}
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

      </div>
    </div>
    </RoleProtectedRoute>
  )
}
