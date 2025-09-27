"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import RoleProtectedRoute from "../components/RoleProtectedRoute"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
} from "lucide-react"
import Link from "next/link"

type BalanceData = {
  statistics: {
    totalPaiements: number
    totalDepenses: number
    soldeFinal: number
  }
  moisData: Array<{
    mois: string
    paiements: number
    depenses: number
    solde: number
  }>
  detailsData: Array<{
    id: string
    date: string
    type: string
    description: string
    montant: number
    programme: string
  }>
  moisMaxBenefice: {
    mois: string
    solde: number
  }
  summary: {
    totalPaiements: number
    totalDepenses: number
    soldeTotal: number
  }
}

type Program = {
  id: number
  name: string
}

export default function SoldeCaissePage() {
  // États pour les filtres
  const [dateDebut, setDateDebut] = useState("")
  const [dateFin, setDateFin] = useState("")
  const [programmeFilter, setProgrammeFilter] = useState("tous")
  const [periodeFilter, setPeriodeFilter] = useState("mois")

  // États pour les données
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null)
  const [programmes, setProgrammes] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fonction pour récupérer les données
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Construire les paramètres de requête
      const params = new URLSearchParams()
      if (dateDebut) params.append('dateDebut', dateDebut)
      if (dateFin) params.append('dateFin', dateFin)
      if (programmeFilter !== 'tous') params.append('programme', programmeFilter)
      if (periodeFilter) params.append('periode', periodeFilter)
      
      const [balanceResponse, programsResponse] = await Promise.all([
        fetch(`${api.url('/api/balance')}?${params}`),
        fetch(api.url(api.endpoints.programs))
      ])

      if (!balanceResponse.ok || !programsResponse.ok) {
        throw new Error('Erreur lors du chargement des données')
      }

      const [balanceData, programsData] = await Promise.all([
        balanceResponse.json(),
        programsResponse.json()
      ])

      setBalanceData(balanceData)
      setProgrammes(programsData)
    } catch (err) {
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
    statistics: { totalPaiements: 0, totalDepenses: 0, soldeFinal: 0 },
    moisData: [],
    detailsData: [],
    moisMaxBenefice: { mois: "", solde: 0 },
    summary: { totalPaiements: 0, totalDepenses: 0, soldeTotal: 0 }
  }

  const { statistics, moisData, detailsData, moisMaxBenefice, summary } = data
  const { totalPaiements, totalDepenses, soldeFinal } = statistics

  // Filtrage des données par programme (fait côté serveur maintenant)
  const filteredDetails = detailsData

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
                    {programmes.map((programme) => (
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-gray-500" />
                  Analyse par mois
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {moisData.map((item, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">{item.mois}</h3>
                        <span className="font-bold text-blue-700">{item.solde.toLocaleString()} DH</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Paiements</p>
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${(item.paiements / 200000) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium text-green-700">
                              {item.paiements.toLocaleString()} DH
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Dépenses</p>
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-red-600 h-2 rounded-full"
                                style={{ width: `${(item.depenses / 200000) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium text-red-700">
                              {item.depenses.toLocaleString()} DH
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-0 shadow-lg h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-gray-500" />
                  Résumé
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
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
          </div>
        </div>

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
                  {filteredDetails.map((item, index) => (
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
