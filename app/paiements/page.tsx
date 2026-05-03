"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  CreditCard,
  DollarSign,
  Calendar,
  Search,
  Filter,
  Plus,
  FileText,
  Receipt,
  Download,
  Eye,
  X
} from "lucide-react"
import Link from "next/link"

type Payment = {
  id: number
  amount: number
  paymentMethod: string
  paymentDate: string
  reservationId: number
  programId?: number
  agent?: { id: number; nom: string } | null
  fichier?: {
    id: number
    fileName: string
    filePath: string
    fileType: string
    cloudinaryId?: string
    cloudinaryUrl?: string
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
    agent?: { id: number; nom: string } | null
  }
}

function paymentRowAgentLabel(p: Payment): string {
  return p.agent?.nom ?? p.reservation?.agent?.nom ?? "—"
}

type Program = {
  id: number
  name: string
}

const normalizePaymentMethod = (method: string | null | undefined): string => {
  if (!method) return ""
  const normalized = method
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()

  if (normalized === "cash" || normalized === "espece" || normalized === "especes") return "especes"
  if (normalized === "card" || normalized === "carte") return "carte"
  if (normalized === "wire" || normalized === "transfer" || normalized === "virement") return "virement"
  if (normalized === "cheque" || normalized === "check") return "cheque"

  return normalized
}

const getPaymentMethodLabel = (method: string): string => {
  switch (normalizePaymentMethod(method)) {
    case "carte":
      return "Carte"
    case "especes":
      return "Espèces"
    case "virement":
      return "Virement"
    case "cheque":
      return "Chèque"
    default:
      return method
  }
}

export default function PaiementsPage() {
  const [paiements, setPaiements] = useState<Payment[]>([])
  const [programmes, setProgrammes] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [programFilter, setProgramFilter] = useState("tous")
  const [methodFilter, setMethodFilter] = useState("tous")
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; type: string } | null>(null)

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

      const sorted = [...paymentsData].sort(
        (a: Payment, b: Payment) =>
          new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      )
      setPaiements(sorted)
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
      paiement.reservation.program?.id.toString() === programFilter

    const methodMatch = methodFilter === "tous" || 
      normalizePaymentMethod(paiement.paymentMethod) === methodFilter

    return searchMatch && programMatch && methodMatch
  })

  const sortedFilteredPaiements = useMemo(
    () =>
      [...filteredPaiements].sort(
        (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      ),
    [filteredPaiements]
  )

  // Calcul des statistiques
  const totalPaiements = paiements.reduce((sum, p) => sum + p.amount, 0)
  const paiementsParCarte = paiements
    .filter(p => normalizePaymentMethod(p.paymentMethod) === "carte")
    .reduce((sum, p) => sum + p.amount, 0)
  const paiementsParEspeces = paiements
    .filter(p => normalizePaymentMethod(p.paymentMethod) === "especes")
    .reduce((sum, p) => sum + p.amount, 0)
  const paiementsParVirement = paiements
    .filter(p => normalizePaymentMethod(p.paymentMethod) === "virement")
    .reduce((sum, p) => sum + p.amount, 0)
  const paiementsParCheque = paiements
    .filter(p => normalizePaymentMethod(p.paymentMethod) === "cheque")
    .reduce((sum, p) => sum + p.amount, 0)

  const getMethodIcon = (method: string) => {
    switch (normalizePaymentMethod(method)) {
      case "carte":
        return <CreditCard className="h-4 w-4" />
      case "especes":
        return <DollarSign className="h-4 w-4" />
      case "virement":
        return <FileText className="h-4 w-4" />
      case "cheque":
        return <Receipt className="h-4 w-4" />
      default:
        return <CreditCard className="h-4 w-4" />
    }
  }

  const getMethodColor = (method: string) => {
    switch (normalizePaymentMethod(method)) {
      case "carte":
        return "bg-blue-100 text-blue-800"
      case "especes":
        return "bg-green-100 text-green-800"
      case "virement":
        return "bg-purple-100 text-purple-800"
      case "cheque":
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
    <div
      data-skip-unsaved-dirty
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Paiements</h1>
          <Button asChild>
            <Link href="/paiements/nouveau">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau Paiement
            </Link>
          </Button>
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
                      <SelectItem key={program.id} value={program.id.toString()}>
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
                    <SelectItem value="carte">Carte</SelectItem>
                    <SelectItem value="especes">Espèces</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                    <SelectItem value="cheque">Chèque</SelectItem>
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
              Liste des Paiements ({sortedFilteredPaiements.length}) — plus récents en haut
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedFilteredPaiements.length === 0 ? (
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
              <div className="space-y-2">
                {sortedFilteredPaiements.map((paiement) => (
                  <div
                    key={paiement.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all text-sm"
                  >
                    <span className="text-gray-500 whitespace-nowrap shrink-0 tabular-nums" title="Date du paiement">
                      <Calendar className="h-3.5 w-3.5 inline mr-1 -mt-0.5 opacity-70" />
                      {new Date(paiement.paymentDate).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="hidden sm:inline text-gray-300">|</span>
                    <span className="font-medium text-gray-900 whitespace-nowrap">
                      {paiement.reservation.firstName} {paiement.reservation.lastName}
                    </span>
                    <span className="text-gray-500 whitespace-nowrap">{paiement.reservation.phone}</span>
                    <span className="text-gray-600 truncate max-w-[140px] sm:max-w-[200px]" title={paiement.reservation.program.name}>
                      {paiement.reservation.program.name}
                    </span>
                    <Badge className={`${getMethodColor(paiement.paymentMethod)} border-0 shrink-0 text-xs`}>
                      <span className="inline-flex items-center gap-1">
                        {getMethodIcon(paiement.paymentMethod)}
                        {getPaymentMethodLabel(paiement.paymentMethod)}
                      </span>
                    </Badge>
                    <span className="text-gray-500 truncate max-w-[100px] sm:max-w-none" title={paymentRowAgentLabel(paiement)}>
                      Agent: {paymentRowAgentLabel(paiement)}
                    </span>
                    <span className="font-semibold text-gray-900 whitespace-nowrap ml-auto sm:ml-0">
                      {paiement.amount.toLocaleString("fr-FR")} DH
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto sm:ml-auto justify-end">
                      {paiement.fichier && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-green-200 text-green-700 hover:bg-green-50 px-2"
                            onClick={() => {
                              const fileUrl =
                                paiement.fichier?.cloudinaryUrl ||
                                `http://localhost:5000/uploads/${paiement.fichier?.filePath}`;
                              window.open(fileUrl, "_blank");
                            }}
                          >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            Reçu
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50 px-2"
                            onClick={() => {
                              const fileUrl =
                                paiement.fichier?.cloudinaryUrl ||
                                `http://localhost:5000/uploads/${paiement.fichier?.filePath}`;
                              const fileName = paiement.fichier?.fileName || "Reçu de paiement";
                              const extension = fileName.split(".").pop()?.toLowerCase();
                              let mimeType = "image/jpeg";
                              if (extension === "pdf") mimeType = "application/pdf";
                              else if (extension === "png") mimeType = "image/png";
                              else if (extension === "gif") mimeType = "image/gif";
                              else if (extension === "webp") mimeType = "image/webp";
                              setPreviewImage({ url: fileUrl, title: fileName, type: mimeType });
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Voir
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de prévisualisation d'image */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">
                {previewImage?.title}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewImage(null)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          
          <div className="p-6 pt-4">
            {previewImage && (
              <div className="flex justify-center items-center min-h-[400px] bg-gray-50 rounded-lg">
                {previewImage.type === 'application/pdf' ? (
                  <iframe
                    src={`${previewImage.url}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-full h-[600px] border-0 rounded-lg"
                    title={previewImage.title}
                  />
                ) : (
                  <img
                    src={previewImage.url}
                    alt={previewImage.title}
                    className="max-w-full max-h-[600px] object-contain rounded-lg shadow-lg"
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
