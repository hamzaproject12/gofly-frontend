"use client"

import { useState } from "react"
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
import { useToast } from "@/hooks/use-toast"

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
  useState(() => {
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
          programId: formData.programId ? parseInt(formData.programId) : null
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/depenses">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nouvelle Dépense</h1>
            <p className="text-gray-600">Ajouter une nouvelle dépense au système</p>
          </div>
        </div>

        <Card className="border-none shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Receipt className="h-5 w-5" />
              Informations de la dépense
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Description */}
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="description" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="min-h-[100px] text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm"
                    placeholder="Ex: Réservation hôtel pour groupe de 15 personnes"
                  />
                </div>

                {/* Montant */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Montant (DH)
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="h-12 text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm"
                    placeholder="0.00"
                  />
                </div>

                {/* Type */}
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Type de dépense
                  </Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger className="h-12 text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vol">
                        <div className="flex items-center gap-2">
                          <Plane className="h-4 w-4" />
                          Vol
                        </div>
                      </SelectItem>
                      <SelectItem value="Hôtel">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Hôtel
                        </div>
                      </SelectItem>
                      <SelectItem value="Autre">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-4 w-4" />
                          Autre
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Programme */}
                <div className="space-y-2">
                  <Label htmlFor="program" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Programme (optionnel)
                  </Label>
                  <Select value={formData.programId} onValueChange={(value) => setFormData({ ...formData, programId: value })}>
                    <SelectTrigger className="h-12 text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm">
                      <SelectValue placeholder="Sélectionner un programme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucun programme</SelectItem>
                      {programmes.map((program) => (
                        <SelectItem key={program.id} value={program.id.toString()}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="h-12 text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm"
                  />
                </div>
              </div>

              {/* Boutons */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <Link href="/depenses">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-6 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 rounded-xl font-medium transition-all duration-200"
                  >
                    Annuler
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Création...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Créer la dépense
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