"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Plane,
  Building,
  Receipt,
  Save,
  ArrowLeft,
  Sparkles,
  CheckCircle,
  Bell,
  Settings,
  Search,
  Calendar,
  Users,
  FileText,
} from "lucide-react"
import Link from "next/link"

export default function NouvelleDepense() {
  const [formData, setFormData] = useState({
    programme: "",
    type: "",
    description: "",
    montant: "",
    date: new Date().toISOString().split("T")[0],
  })

  // Programmes disponibles
  const programmes = ["Omra Ramadan 2024", "Omra Février 2024", "Omra Décembre 2023", "Autre"]

  const typesDepense = [
    { value: "hotel", label: "Hôtel", icon: Building, color: "yellow", description: "Réservations et frais d'hôtels" },
    { value: "vol", label: "Vol", icon: Plane, color: "blue", description: "Billets d'avion et frais de transport" },
    { value: "autre", label: "Autre", icon: Receipt, color: "gray", description: "Autres frais et dépenses diverses" },
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Nouvelle dépense:", formData)
  }

  const typeSelectionne = typesDepense.find((t) => t.value === formData.type)
  const isFormValid = formData.programme && formData.type && formData.description && formData.montant

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
          {/* Colonne gauche - Formulaire principal */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm h-full">
              <CardHeader className="bg-gradient-to-r from-red-600 to-red-700 text-white">
                <CardTitle className="text-xl flex items-center gap-3">
                  <Sparkles className="h-5 w-5" />
                  Informations de la dépense
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Informations de base */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-gray-700 font-medium">
                      Date *
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="h-11 border-2 border-gray-200 focus:border-red-500 rounded-lg"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="programme" className="text-gray-700 font-medium">
                      Programme *
                    </Label>
                    <Select
                      value={formData.programme}
                      onValueChange={(value) => setFormData({ ...formData, programme: value })}
                    >
                      <SelectTrigger className="h-11 border-2 border-gray-200 focus:border-red-500 rounded-lg">
                        <SelectValue placeholder="Sélectionner un programme" />
                      </SelectTrigger>
                      <SelectContent>
                        {programmes.map((programme) => (
                          <SelectItem key={programme} value={programme}>
                            {programme}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Type de dépense */}
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium">Type de dépense *</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {typesDepense.map((type) => (
                      <label
                        key={type.value}
                        className={`group cursor-pointer p-4 rounded-xl border-2 transition-all duration-300 ${
                          formData.type === type.value
                            ? `border-${type.color}-400 bg-${type.color}-50 shadow-md`
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="type"
                          value={type.value}
                          checked={formData.type === type.value}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                          className="sr-only"
                        />
                        <div className="text-center">
                          <type.icon
                            className={`h-6 w-6 mx-auto mb-2 ${formData.type === type.value ? `text-${type.color}-600` : "text-gray-400"}`}
                          />
                          <h4
                            className={`font-medium text-sm ${formData.type === type.value ? `text-${type.color}-800` : "text-gray-700"}`}
                          >
                            {type.label}
                          </h4>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Montant */}
                <div className="space-y-2">
                  <Label htmlFor="montant" className="text-gray-700 font-medium">
                    Montant (DH) *
                  </Label>
                  <div className="relative">
                    <Input
                      id="montant"
                      type="number"
                      value={formData.montant}
                      onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                      placeholder="0"
                      className="h-12 text-lg font-semibold border-2 border-gray-200 focus:border-green-500 rounded-lg pl-4 pr-12"
                      required
                    />
                    <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-green-600 font-medium">
                      DH
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-gray-700 font-medium">
                    Description *
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description détaillée de la dépense"
                    rows={4}
                    className="border-2 border-gray-200 focus:border-blue-500 rounded-lg resize-none"
                    required
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Colonne droite - Récapitulatif et actions */}
          <div className="space-y-4">
            {/* Récapitulatif */}
            <Card
              className={`border-0 shadow-xl transition-all ${isFormValid ? "bg-gradient-to-br from-green-50 to-green-100 border-green-200" : "bg-white"}`}
            >
              <CardHeader
                className={`${isFormValid ? "bg-gradient-to-r from-green-600 to-green-700" : "bg-gradient-to-r from-gray-600 to-gray-700"} text-white rounded-t-xl`}
              >
                <CardTitle className="text-lg flex items-center gap-2">
                  {isFormValid ? <CheckCircle className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                  Récapitulatif
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Programme:</span>
                    <span className="font-medium text-sm">{formData.programme || "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Type:</span>
                    <span className="font-medium text-sm">
                      {typeSelectionne ? typeSelectionne.label : "Non défini"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Date:</span>
                    <span className="font-medium text-sm">
                      {formData.date ? new Date(formData.date).toLocaleDateString("fr-FR") : "Non définie"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-3">
                    <span className="text-sm text-gray-600">Montant:</span>
                    <span className="font-bold text-lg text-green-600">
                      {formData.montant ? `${Number.parseFloat(formData.montant).toLocaleString()} DH` : "0 DH"}
                    </span>
                  </div>
                </div>

                {formData.description && (
                  <div className="border-t pt-3">
                    <span className="text-sm text-gray-600">Description:</span>
                    <p className="text-sm text-gray-800 mt-1 italic bg-gray-50 p-2 rounded">
                      {formData.description.substring(0, 100)}
                      {formData.description.length > 100 && "..."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="border-0 shadow-xl bg-white">
              <CardContent className="p-6 space-y-4">
                <Button
                  onClick={handleSubmit}
                  disabled={!isFormValid}
                  className="w-full h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="mr-2 h-5 w-5" />
                  Enregistrer la dépense
                </Button>
                <Link href="/depenses">
                  <Button variant="outline" className="w-full h-12 border-2 border-gray-300 hover:border-gray-400">
                    <ArrowLeft className="mr-2 h-5 w-5" />
                    Annuler
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Aide */}
            <Card className="border-0 shadow-xl bg-blue-50">
              <CardContent className="p-4">
                <h4 className="font-medium text-blue-800 mb-2">💡 Conseils</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Soyez précis dans la description</li>
                  <li>• Vérifiez le montant avant validation</li>
                  <li>• Associez la dépense au bon programme</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
