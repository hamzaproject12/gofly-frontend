"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, ArrowLeft, CreditCard, Calendar, DollarSign, AlertCircle } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/hooks/useAuth"

type ReservationOption = {
  id: number
  firstName: string
  lastName: string
  phone: string
  program: { id: number; name: string }
}

export default function NouveauPaiementPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isAdmin, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [reservations, setReservations] = useState<ReservationOption[]>([])

  const [formData, setFormData] = useState({
    reservationId: "",
    amount: "",
    type: "especes",
    paymentDate: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(api.url("/api/reservations?limit=500&page=1"))
        if (!response.ok) return
        const data = await response.json()
        const list = Array.isArray(data.reservations) ? data.reservations : []
        setReservations(list)
      } catch (e) {
        console.error("Error fetching reservations:", e)
      }
    }
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.reservationId) {
      toast({
        title: "Erreur",
        description: "Sélectionnez une réservation.",
        variant: "destructive",
      })
      return
    }
    setLoading(true)
    try {
      const paymentDateIso = formData.paymentDate
        ? `${formData.paymentDate}T12:00:00.000Z`
        : undefined
      const response = await fetch(api.url("/api/payments"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: parseInt(formData.reservationId, 10),
          amount: parseFloat(formData.amount),
          type: formData.type,
          ...(paymentDateIso ? { paymentDate: paymentDateIso } : {}),
        }),
      })

      if (response.ok) {
        toast({
          title: "Succès",
          description: "Le paiement a été enregistré.",
        })
        router.push("/paiements")
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast({
          title: "Erreur",
          description: errorData.error || "Erreur lors de la création du paiement",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating payment:", error)
      toast({
        title: "Erreur",
        description: "Erreur de connexion au serveur",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="p-8 text-center border-2 border-red-200 bg-red-50">
            <CardContent>
              <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-red-800 mb-2">Accès refusé</h2>
              <p className="text-gray-700">Cette page est réservée aux administrateurs.</p>
              <Link href="/">
                <Button className="mt-6">Retour au tableau de bord</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/paiements">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Nouveau paiement</h1>
                <p className="text-indigo-100 text-lg">Enregistrer un paiement pour une réservation</p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-full p-3">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Gestion des paiements</p>
                    <p className="text-indigo-100 text-sm">Saisie manuelle</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="bg-white/20 rounded-full p-2">
                <CreditCard className="h-6 w-6" />
              </div>
              Informations du paiement
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2 space-y-3">
                  <Label htmlFor="reservationId" className="text-base font-bold text-gray-800 flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <CreditCard className="h-5 w-5 text-indigo-600" />
                    </div>
                    Réservation (client leader)
                  </Label>
                  <Select
                    value={formData.reservationId}
                    onValueChange={(value) => setFormData({ ...formData, reservationId: value })}
                  >
                    <SelectTrigger className="h-14 text-base border-2 border-gray-200 rounded-2xl">
                      <SelectValue placeholder="Choisir une réservation" />
                    </SelectTrigger>
                    <SelectContent>
                      {reservations.map((r) => (
                        <SelectItem key={r.id} value={r.id.toString()}>
                          #{r.id} — {r.firstName} {r.lastName} · {r.phone} · {r.program?.name ?? "—"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="amount" className="text-base font-bold text-gray-800 flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    Montant (DH)
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="h-14 text-lg font-semibold border-2 border-gray-200 rounded-2xl"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-bold text-gray-800 flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <CreditCard className="h-5 w-5 text-purple-600" />
                    </div>
                    Mode de paiement
                  </Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger className="h-14 text-base border-2 border-gray-200 rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="especes">Espèces</SelectItem>
                      <SelectItem value="carte">Carte</SelectItem>
                      <SelectItem value="virement">Virement</SelectItem>
                      <SelectItem value="cheque">Chèque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 md:col-span-2">
                  <Label htmlFor="paymentDate" className="text-base font-bold text-gray-800 flex items-center gap-3">
                    <div className="bg-cyan-100 p-2 rounded-lg">
                      <Calendar className="h-5 w-5 text-cyan-600" />
                    </div>
                    Date du paiement
                  </Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    required
                    value={formData.paymentDate}
                    onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                    className="h-14 text-base border-2 border-gray-200 rounded-2xl max-w-xs"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-8 border-t-2 border-gray-100">
                <Link href="/paiements">
                  <Button type="button" variant="outline" className="h-12 px-8 rounded-2xl">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 px-8 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white rounded-2xl"
                >
                  {loading ? (
                    <>Enregistrement…</>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 mr-3 inline" />
                      Enregistrer le paiement
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
