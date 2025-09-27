"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, ArrowLeft, Receipt, Calendar, DollarSign, Building, Plane } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"

type Program = {
  id: number
  name: string
}

export default function NouvelleDepensePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [programmes, setProgrammes] = useState<Program[]>([])

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: '',
    programId: '',
    date: new Date().toISOString().split('T')[0]
  })

  // Charger les programmes
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const response = await fetch(api.url(api.endpoints.programs))
        if (response.ok) {
          const data = await response.json()
          setProgrammes(data)
        }
      } catch (error) {
        console.error('Error fetching programs:', error)
      }
    }
    fetchPrograms()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(api.url('/api/expenses'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          programId: formData.programId && formData.programId !== "none" ? parseInt(formData.programId) : null
        }),
      })

      if (response.ok) {
        toast({
          title: "Succès",
          description: "La dépense a été créée avec succès.",
        })
        router.push('/depenses')
      } else {
        const errorData = await response.json()
        toast({
          title: "Erreur",
          description: errorData.error || "Erreur lors de la création de la dépense",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error creating expense:', error)
      toast({
        title: "Erreur",
        description: "Erreur de connexion au serveur",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Vol":
        return <Plane className="h-4 w-4" />
      case "Hôtel":
        return <Building className="h-4 w-4" />
      default:
        return <Receipt className="h-4 w-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      {/* Header avec gradient */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/depenses">
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
                <h1 className="text-3xl font-bold text-white mb-2">Nouvelle Dépense</h1>
                <p className="text-indigo-100 text-lg">Ajouter une nouvelle dépense au système</p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-full p-3">
                    <Receipt className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Gestion des Dépenses</p>
                    <p className="text-indigo-100 text-sm">Système de suivi</p>
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
                <Receipt className="h-6 w-6" />
              </div>
              Informations de la dépense
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Description */}
                <div className="md:col-span-2 space-y-3">
                  <Label htmlFor="description" className="text-base font-bold text-gray-800 flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <Receipt className="h-5 w-5 text-indigo-600" />
                    </div>
                    Description de la dépense
                  </Label>
                  <Textarea
                    id="description"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="min-h-[120px] text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-300 shadow-lg hover:shadow-xl bg-white"
                    placeholder="Ex: Réservation hôtel pour groupe de 15 personnes, Service de visa pour M. Ahmed..."
                  />
                </div>

                {/* Montant */}
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
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="h-14 text-lg font-semibold border-2 border-gray-200 rounded-2xl focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-300 shadow-lg hover:shadow-xl bg-white"
                    placeholder="0.00"
                  />
                </div>

                {/* Type */}
                <div className="space-y-3">
                  <Label htmlFor="type" className="text-base font-bold text-gray-800 flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <Receipt className="h-5 w-5 text-purple-600" />
                    </div>
                    Type de dépense
                  </Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger className="h-14 text-base font-medium border-2 border-gray-200 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-300 shadow-lg hover:shadow-xl bg-white">
                      <SelectValue placeholder="Sélectionner un type de dépense" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 shadow-xl">
                      <SelectItem value="Vol" className="rounded-xl">
                        <div className="flex items-center gap-3 py-2">
                          <div className="bg-blue-100 p-1 rounded-lg">
                            <Plane className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="font-medium">Vol</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Hotel Madina" className="rounded-xl">
                        <div className="flex items-center gap-3 py-2">
                          <div className="bg-green-100 p-1 rounded-lg">
                            <Building className="h-4 w-4 text-green-600" />
                          </div>
                          <span className="font-medium">Hotel Madina</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Hotel Makkah" className="rounded-xl">
                        <div className="flex items-center gap-3 py-2">
                          <div className="bg-emerald-100 p-1 rounded-lg">
                            <Building className="h-4 w-4 text-emerald-600" />
                          </div>
                          <span className="font-medium">Hotel Makkah</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Visa" className="rounded-xl">
                        <div className="flex items-center gap-3 py-2">
                          <div className="bg-orange-100 p-1 rounded-lg">
                            <Receipt className="h-4 w-4 text-orange-600" />
                          </div>
                          <span className="font-medium">Visa</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Autre" className="rounded-xl">
                        <div className="flex items-center gap-3 py-2">
                          <div className="bg-gray-100 p-1 rounded-lg">
                            <Receipt className="h-4 w-4 text-gray-600" />
                          </div>
                          <span className="font-medium">Autre</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Programme */}
                <div className="space-y-3">
                  <Label htmlFor="program" className="text-base font-bold text-gray-800 flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    Programme (optionnel)
                  </Label>
                  <Select value={formData.programId} onValueChange={(value) => setFormData({ ...formData, programId: value })}>
                    <SelectTrigger className="h-14 text-base font-medium border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-300 shadow-lg hover:shadow-xl bg-white">
                      <SelectValue placeholder="Sélectionner un programme" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 shadow-xl">
                      <SelectItem value="none" className="rounded-xl">
                        <div className="flex items-center gap-3 py-2">
                          <div className="bg-gray-100 p-1 rounded-lg">
                            <Calendar className="h-4 w-4 text-gray-600" />
                          </div>
                          <span className="font-medium">Aucun programme</span>
                        </div>
                      </SelectItem>
                      {programmes.map((program) => (
                        <SelectItem key={program.id} value={program.id.toString()} className="rounded-xl">
                          <div className="flex items-center gap-3 py-2">
                            <div className="bg-blue-100 p-1 rounded-lg">
                              <Calendar className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="font-medium">{program.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div className="space-y-3">
                  <Label htmlFor="date" className="text-base font-bold text-gray-800 flex items-center gap-3">
                    <div className="bg-cyan-100 p-2 rounded-lg">
                      <Calendar className="h-5 w-5 text-cyan-600" />
                    </div>
                    Date de la dépense
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="h-14 text-base font-medium border-2 border-gray-200 rounded-2xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all duration-300 shadow-lg hover:shadow-xl bg-white"
                  />
                </div>
              </div>

              {/* Boutons */}
              <div className="flex justify-between items-center pt-8 border-t-2 border-gray-100">
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="bg-gray-100 p-2 rounded-lg">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Prêt à créer la dépense ?</p>
                    <p className="text-sm">Vérifiez toutes les informations avant de continuer</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <Link href="/depenses">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 px-8 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 rounded-2xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Annuler
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-12 px-8 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-700 hover:via-purple-700 hover:to-blue-700 text-white rounded-2xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        Création en cours...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5 mr-3" />
                        Créer la dépense
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}