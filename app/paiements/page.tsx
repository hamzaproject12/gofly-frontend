"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  CreditCard,
  DollarSign,
  Calendar,
  User,
  Search,
  Filter,
  Plus,
  FileText,
  Building,
  Plane,
  Receipt,
  Download,
  Eye
} from "lucide-react"
import Link from "next/link"

type Payment = {
  id: number
  amount: number
  paymentMethod: string
  paymentDate: string
  reservationId: number
  programId?: number
  fichier?: {
    id: number
    fileName: string
    filePath: string
    fileType: string
  }
  reservation: {
    id: number
    firstName: string
    lastName: string
    phone: string
    program: {
      id: number
      name: string
    }
  }
}

type Program = {
  id: number
  name: string
}

export default function PaiementsPage() {
  const [paiements, setPaiements] = useState<Payment[]>([])
  const [programmes, setProgrammes] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [programFilter, setProgramFilter] = useState("tous")
  const [methodFilter, setMethodFilter] = useState("tous")

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [paymentsResponse, programsResponse] = await Promise.all([
        fetch(api.url('/api/payments')),
        fetch(api.url(api.endpoints.programs))
      ])

      if (!paymentsResponse.ok || !programsResponse.ok) {
        throw new Error('Erreur lors du chargement des données')
      }

      const [paymentsData, programsData] = await Promise.all([
        paymentsResponse.json(),
        programsResponse.json()
      ])

      setPaiements(paymentsData)
      setProgrammes(programsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtrage des paiements
  const filteredPaiements = paiements.filter((paiement) => {
    const searchMatch = !searchTerm || 
      paiement.reservation.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paiement.reservation.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paiement.reservation.phone.includes(searchTerm)

    const programMatch = programFilter === "tous" || 
      paiement.reservation.program?.name === programFilter

    const methodMatch = methodFilter === "tous" || 
      paiement.paymentMethod === methodFilter

    return searchMatch && programMatch && methodMatch
  })

  // Calcul des statistiques
  const totalPaiements = paiements.reduce((sum, p) => sum + p.amount, 0)
  const paiementsParCarte = paiements.filter(p => p.paymentMethod === "Carte").reduce((sum, p) => sum + p.amount, 0)
  const paiementsParEspeces = paiements.filter(p => p.paymentMethod === "especes").reduce((sum, p) => sum + p.amount, 0)
  const paiementsParVirement = paiements.filter(p => p.paymentMethod === "Virement").reduce((sum, p) => sum + p.amount, 0)
  const paiementsParCheque = paiements.filter(p => p.paymentMethod === "Chèque").reduce((sum, p) => sum + p.amount, 0)

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "Carte":
        return <CreditCard className="h-4 w-4" />
      case "especes":
        return <DollarSign className="h-4 w-4" />
      case "Virement":
        return <FileText className="h-4 w-4" />
      case "Chèque":
        return <Receipt className="h-4 w-4" />
      default:
        return <CreditCard className="h-4 w-4" />
    }
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case "Carte":
        return "bg-blue-100 text-blue-800"
      case "especes":
        return "bg-green-100 text-green-800"
      case "Virement":
        return "bg-purple-100 text-purple-800"
      case "Chèque":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des paiements...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
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
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Paiements</h1>
          <Link href="/paiements/nouveau">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau Paiement
            </Button>
          </Link>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total Paiements</p>
                  <p className="text-2xl font-bold">{totalPaiements.toLocaleString()} DH</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Carte</p>
                  <p className="text-2xl font-bold">{paiementsParCarte.toLocaleString()} DH</p>
                </div>
                <CreditCard className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Espèces</p>
                  <p className="text-2xl font-bold">{paiementsParEspeces.toLocaleString()} DH</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Virement</p>
                  <p className="text-2xl font-bold">{paiementsParVirement.toLocaleString()} DH</p>
                </div>
                <FileText className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm font-medium">Chèque</p>
                  <p className="text-2xl font-bold">{paiementsParCheque.toLocaleString()} DH</p>
                </div>
                <Receipt className="h-8 w-8 text-red-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres */}
        <Card className="mb-8 border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <Filter className="h-5 w-5" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Recherche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Nom, prénom ou téléphone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Programme</label>
                <Select value={programFilter} onValueChange={setProgramFilter}>
                  <SelectTrigger className="border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tous les programmes</SelectItem>
                    {programmes.map((program) => (
                      <SelectItem key={program.id} value={program.name}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Méthode de paiement</label>
                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger className="border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Toutes les méthodes</SelectItem>
                    <SelectItem value="Carte">Carte</SelectItem>
                    <SelectItem value="especes">Espèces</SelectItem>
                    <SelectItem value="Virement">Virement</SelectItem>
                    <SelectItem value="Chèque">Chèque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des paiements */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <CreditCard className="h-5 w-5" />
              Liste des Paiements ({filteredPaiements.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPaiements.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun paiement trouvé</h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm || programFilter !== "tous" || methodFilter !== "tous"
                    ? "Aucun paiement ne correspond aux filtres appliqués."
                    : "Aucun paiement n'a encore été enregistré."}
                </p>
                {(searchTerm || programFilter !== "tous" || methodFilter !== "tous") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("")
                      setProgramFilter("tous")
                      setMethodFilter("tous")
                    }}
                  >
                    Réinitialiser les filtres
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPaiements.map((paiement) => (
                  <div
                    key={paiement.id}
                    className="flex items-center justify-between p-6 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-100 p-3 rounded-xl">
                        {getMethodIcon(paiement.paymentMethod)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {paiement.reservation.firstName} {paiement.reservation.lastName}
                        </h3>
                        <p className="text-sm text-gray-600">{paiement.reservation.phone}</p>
                        <p className="text-sm text-gray-500">
                          {paiement.reservation.program.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {paiement.amount.toLocaleString()} DH
                        </p>
                        <Badge className={`${getMethodColor(paiement.paymentMethod)} border-0`}>
                          {paiement.paymentMethod}
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-2">
                        {paiement.fichier && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() => window.open(`http://localhost:5000/uploads/${paiement.fichier.filePath}`, '_blank')}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Reçu
                          </Button>
                        )}
                        {paiement.fichier && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={() => window.open(`http://localhost:5000/uploads/${paiement.fichier.filePath}`, '_blank')}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Voir
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
