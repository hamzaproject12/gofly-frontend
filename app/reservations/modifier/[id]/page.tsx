"use client"

import { useState, useRef, useMemo, useEffect } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  CheckCircle,
  Upload,
  Plus,
  Trash2,
  User,
  CreditCard,
  FileText,
  Sparkles,
  Bell,
  Settings,
  Search,
  Calendar,
  Users,
  Wallet,
  ZoomIn,
  X,
  Hotel,
  Info,
  ChevronDown,
  ChevronUp,
  Edit,
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { useRouter, useParams } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Types
type DocumentType = 'passport' | 'visa' | 'flightBooked' | 'hotelBooked' | 'payment';

interface Program {
  id: number;
  name: string;
  hotelsMadina: Array<{ hotel: Hotel }>;
  hotelsMakkah: Array<{ hotel: Hotel }>;
}

interface Hotel {
  id: number;
  name: string;
  city: string;
}

interface Paiement {
  type: string;
  montant: string;
  recu: string | null;
}

interface FileInputs {
  passeport: HTMLInputElement | null;
  visa: HTMLInputElement | null;
  billetAller: HTMLInputElement | null;
  billetRetour: HTMLInputElement | null;
  reservationMadina: HTMLInputElement | null;
  reservationMakkah: HTMLInputElement | null;
  paiements: (HTMLInputElement | null)[];
  flightBooked: HTMLInputElement | null;
  hotelBooked: HTMLInputElement | null;
}

type FormData = {
  programme: string;
  typeChambre: string;
  nom: string;
  prenom: string;
  telephone: string;
  prix: string;
  hotelMadina: string;
  hotelMakkah: string;
  dateReservation: string;
  programId: string;
  gender: string;
  statutVisa: boolean;
  statutVol: boolean;
  statutHotel: boolean;
  paiements: Array<{
    amount: string;
    type: string;
    date: string;
  }>;
};

const ROOM_TYPES = [
  { value: 'SINGLE', label: 'Simple (1 personne)', icon: '🏠' },
  { value: 'DOUBLE', label: 'Double (2 personnes)', icon: '🏘️' },
  { value: 'TRIPLE', label: 'Triple (3 personnes)', icon: '🏢' },
  { value: 'QUAD', label: 'Quadruple (4 personnes)', icon: '🏬' },
  { value: 'QUINT', label: 'Quintuple (5 personnes)', icon: '🏭' },
];

const GENDER_OPTIONS = [
  { value: 'Homme', label: 'Homme', icon: '👨' },
  { value: 'Femme', label: 'Femme', icon: '👩' },
  { value: 'Mixte', label: 'Mixte', icon: '👥' },
];

export default function EditReservation() {
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const reservationId = params?.id

  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [programs, setPrograms] = useState<Program[]>([])
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)
  
  const [form, setForm] = useState<FormData>({
    programme: '',
    typeChambre: '',
    nom: '',
    prenom: '',
    telephone: '',
    prix: '',
    hotelMadina: '',
    hotelMakkah: '',
    dateReservation: '',
    programId: '',
    gender: '',
    statutVisa: false,
    statutVol: false,
    statutHotel: false,
    paiements: []
  })

  const [paiements, setPaiements] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [previews, setPreviews] = useState<{ [key: string]: string }>({})
  const [fileInputs, setFileInputs] = useState<FileInputs>({
    passeport: null,
    visa: null,
    billetAller: null,
    billetRetour: null,
    reservationMadina: null,
    reservationMakkah: null,
    paiements: [],
    flightBooked: null,
    hotelBooked: null,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Charger les programmes
        const programsResponse = await fetch(api.url(api.endpoints.programs))
        const programsData = await programsResponse.json()
        setPrograms(programsData)

        // Charger la réservation existante
        if (reservationId) {
          const reservationResponse = await fetch(api.url(`/api/reservations/${reservationId}`))
          const reservationData = await reservationResponse.json()
          
          setForm({
            programme: reservationData.program?.name || '',
            typeChambre: reservationData.roomType || '',
            nom: reservationData.lastName || '',
            prenom: reservationData.firstName || '',
            telephone: reservationData.phone || '',
            prix: reservationData.price?.toString() || '',
            hotelMadina: reservationData.hotelMadina || '',
            hotelMakkah: reservationData.hotelMakkah || '',
            dateReservation: reservationData.reservationDate?.split('T')[0] || '',
            programId: reservationData.programId?.toString() || '',
            gender: reservationData.gender || '',
            statutVisa: reservationData.statutVisa || false,
            statutVol: reservationData.statutVol || false,
            statutHotel: reservationData.statutHotel || false,
            paiements: []
          })

          // Charger les paiements existants
          setPaiements((reservationData.payments || []).map((p: any) => ({
            montant: p.amount?.toString() || '',
            type: p.paymentMethod || '',
            date: p.paymentDate?.split('T')[0] || '',
            recu: p.fichier?.cloudinaryUrl || p.fichier?.filePath || ''
          })))

          // Charger les documents existants
          const docObj: any = {}
          ;(reservationData.documents || reservationData.fichiers || []).forEach((d: any) => {
            docObj[d.fileType] = { 
              url: d.cloudinaryUrl || d.filePath, 
              type: d.fileType,
              fileName: d.fileName 
            }
          })
          
          setDocuments([
            docObj['passport'] ? { type: 'passport', url: docObj['passport'].url, fileName: docObj['passport'].fileName } : null,
            docObj['visa'] ? { type: 'visa', url: docObj['visa'].url, fileName: docObj['visa'].fileName } : null,
            docObj['hotelBooked'] ? { type: 'hotelBooked', url: docObj['hotelBooked'].url, fileName: docObj['hotelBooked'].fileName } : null,
            docObj['flightBooked'] ? { type: 'flightBooked', url: docObj['flightBooked'].url, fileName: docObj['flightBooked'].fileName } : null,
          ].filter(Boolean))

          // Previews pour les documents existants
          Object.entries(docObj).forEach(([type, doc]: any) => {
            if (doc.url) setPreviews(prev => ({ ...prev, [type]: doc.url }))
          })
        }
      } catch (error) {
        console.error('Erreur lors du chargement:', error)
        toast({
          title: "Erreur",
          description: "Impossible de charger les données de la réservation",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [reservationId, toast])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleProgramChange = (value: string) => {
    const selectedProgram = programs.find(p => p.id.toString() === value)
    setForm(prev => ({
      ...prev,
      programId: value,
      programme: selectedProgram?.name || '',
      hotelMadina: '',
      hotelMakkah: '',
    }))
  }

  const handlePaiementChange = (index: number, field: string, value: string) => {
    setPaiements(paiements => paiements.map((p, i) => 
      i === index ? { ...p, [field]: value } : p
    ))
  }

  const handleAddPaiement = () => {
    setPaiements([...paiements, { montant: '', type: '', date: '', recu: '' }])
  }

  const handleRemovePaiement = (index: number) => {
    setPaiements(paiements => paiements.filter((_, i) => i !== index))
  }

  const handleDocumentUpload = async (file: File, type: DocumentType) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileType', type)
      formData.append('fileCategory', 'reservation')

      const response = await fetch(api.url(api.endpoints.uploadCloudinary), {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Erreur lors de l\'upload')

      const result = await response.json()
      return result.data.cloudinaryUrl
    } catch (error) {
      console.error('Erreur upload:', error)
      toast({
        title: "Erreur",
        description: "Impossible d'uploader le fichier",
        variant: "destructive"
      })
      return null
    }
  }

  const handleDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>, type: DocumentType) => {
    const file = e.target.files?.[0]
    if (!file) return

    const cloudinaryUrl = await handleDocumentUpload(file, type)
    if (cloudinaryUrl) {
      setDocuments(prev => [
        ...prev.filter(d => d.type !== type),
        { type, url: cloudinaryUrl, fileName: file.name }
      ])
      setPreviews(prev => ({ ...prev, [type]: cloudinaryUrl }))
    }
  }

  const handleRemoveDocument = (type: string) => {
    setDocuments(prev => prev.filter(d => d.type !== type))
    setPreviews(prev => {
      const newPreviews = { ...prev }
      delete newPreviews[type]
      return newPreviews
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const body = {
        firstName: form.prenom,
        lastName: form.nom,
        phone: form.telephone,
        programId: Number(form.programId),
        roomType: form.typeChambre,
        hotelMadina: form.hotelMadina,
        hotelMakkah: form.hotelMakkah,
        price: parseFloat(form.prix),
        reservationDate: form.dateReservation,
        gender: form.gender,
        statutPasseport: documents.some(d => d.type === 'passport'),
        statutVisa: form.statutVisa,
        statutHotel: form.statutHotel,
        statutVol: form.statutVol,
      }

      const response = await fetch(api.url(`/api/reservations/${reservationId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) throw new Error('Erreur lors de la modification')

      toast({
        title: "Succès",
        description: "Réservation modifiée avec succès",
      })
      
      router.push('/reservations')
    } catch (error) {
      console.error('Erreur modification:', error)
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la modification",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculs de progression
  const selectedProgram = programs.find(p => p.id.toString() === form.programId)
  const hotelsMadina = selectedProgram?.hotelsMadina?.map(h => h.hotel) || []
  const hotelsMakkah = selectedProgram?.hotelsMakkah?.map(h => h.hotel) || []

  const section1Complete = form.nom && form.prenom && form.telephone && form.typeChambre && form.prix && form.gender
  const section2Complete = form.programId && form.hotelMadina && form.hotelMakkah
  const section3Complete = paiements.length > 0 && paiements.every(p => p.montant && p.type && p.date)
  const section4Complete = documents.length > 0

  const totalProgress = [section1Complete, section2Complete, section3Complete, section4Complete]
    .filter(Boolean).length * 25

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de la réservation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/reservations">
              <Button variant="outline" className="flex items-center gap-2">
                <ChevronDown className="h-4 w-4 rotate-90" />
                Retour
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Modifier la Réservation</h1>
              <p className="text-gray-600">Mise à jour des informations de la réservation #{reservationId}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Colonne principale - Formulaire */}
          <div className="lg:col-span-3 space-y-6">
            {/* Section 1: Informations Client */}
            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <CardTitle className="text-xl flex items-center gap-3">
                  <User className="h-6 w-6" />
                  Informations Client
                  {section1Complete && <CheckCircle className="h-5 w-5 text-green-300" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium">Programme *</Label>
                    <Select
                      value={form.programId}
                      onValueChange={handleProgramChange}
                    >
                      <SelectTrigger className="h-12 border-2 border-blue-200 rounded-lg">
                        <SelectValue placeholder="Sélectionnez un programme" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((program) => (
                          <SelectItem key={program.id} value={program.id.toString()}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium">Type de chambre *</Label>
                    <Select
                      value={form.typeChambre}
                      onValueChange={(value) => setForm({ ...form, typeChambre: value })}
                    >
                      <SelectTrigger className="h-12 border-2 border-blue-200 rounded-lg">
                        <SelectValue placeholder="Sélectionner le type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROOM_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <span>{type.icon}</span>
                              <span>{type.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium">Nom *</Label>
                    <Input
                      name="nom"
                      value={form.nom}
                      onChange={handleChange}
                      className="h-12 border-2 border-blue-200 rounded-lg"
                      placeholder="Nom de famille"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium">Prénom *</Label>
                    <Input
                      name="prenom"
                      value={form.prenom}
                      onChange={handleChange}
                      className="h-12 border-2 border-blue-200 rounded-lg"
                      placeholder="Prénom"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium">Téléphone *</Label>
                    <Input
                      name="telephone"
                      value={form.telephone}
                      onChange={handleChange}
                      className="h-12 border-2 border-blue-200 rounded-lg"
                      placeholder="Numéro de téléphone"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium">Genre *</Label>
                    <Select
                      value={form.gender}
                      onValueChange={(value) => setForm({ ...form, gender: value })}
                    >
                      <SelectTrigger className="h-12 border-2 border-blue-200 rounded-lg">
                        <SelectValue placeholder="Sélectionner le genre" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <span>{option.icon}</span>
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium">Prix du voyage (DH) *</Label>
                    <Input
                      name="prix"
                      value={form.prix}
                      onChange={handleChange}
                      className="h-12 border-2 border-blue-200 rounded-lg"
                      placeholder="Prix total"
                      type="number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium">Date de réservation</Label>
                    <Input
                      name="dateReservation"
                      value={form.dateReservation}
                      onChange={handleChange}
                      className="h-12 border-2 border-blue-200 rounded-lg"
                      type="date"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Sélection des Hôtels */}
            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                <CardTitle className="text-xl flex items-center gap-3">
                  <Hotel className="h-6 w-6" />
                  Sélection des Hôtels
                  {section2Complete && <CheckCircle className="h-5 w-5 text-green-300" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-green-700 font-medium">Hôtel à Madina *</Label>
                    <Select
                      value={form.hotelMadina}
                      onValueChange={(value) => setForm({ ...form, hotelMadina: value })}
                      disabled={!form.programId}
                    >
                      <SelectTrigger className="h-12 border-2 border-green-200 rounded-lg">
                        <SelectValue placeholder={form.programId ? "Sélectionner un hôtel à Madina" : "Sélectionnez d'abord un programme"} />
                      </SelectTrigger>
                      <SelectContent>
                        {hotelsMadina.map((hotel) => (
                          <SelectItem key={hotel.id} value={hotel.name}>
                            {hotel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-700 font-medium">Hôtel à Makkah *</Label>
                    <Select
                      value={form.hotelMakkah}
                      onValueChange={(value) => setForm({ ...form, hotelMakkah: value })}
                      disabled={!form.programId}
                    >
                      <SelectTrigger className="h-12 border-2 border-green-200 rounded-lg">
                        <SelectValue placeholder={form.programId ? "Sélectionner un hôtel à Makkah" : "Sélectionnez d'abord un programme"} />
                      </SelectTrigger>
                      <SelectContent>
                        {hotelsMakkah.map((hotel) => (
                          <SelectItem key={hotel.id} value={hotel.name}>
                            {hotel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Paiements */}
            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-orange-600 to-orange-700 text-white">
                <CardTitle className="text-xl flex items-center gap-3">
                  <CreditCard className="h-6 w-6" />
                  Paiements
                  {section3Complete && <CheckCircle className="h-5 w-5 text-green-300" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {paiements.map((paiement, index) => (
                    <div key={index} className="p-4 border border-orange-200 rounded-lg bg-white/60">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="md:col-span-3 space-y-2">
                          <Label className="text-orange-700 font-medium text-sm">Type de paiement</Label>
                          <Input
                            value={paiement.type}
                            onChange={(e) => handlePaiementChange(index, 'type', e.target.value)}
                            className="h-10 border-2 border-orange-200 rounded-lg"
                            placeholder="Espèces, Virement, etc."
                          />
                        </div>
                        <div className="md:col-span-3 space-y-2">
                          <Label className="text-orange-700 font-medium text-sm">Montant (DH)</Label>
                          <Input
                            value={paiement.montant}
                            onChange={(e) => handlePaiementChange(index, 'montant', e.target.value)}
                            className="h-10 border-2 border-orange-200 rounded-lg"
                            placeholder="Montant"
                            type="number"
                          />
                        </div>
                        <div className="md:col-span-3 space-y-2">
                          <Label className="text-orange-700 font-medium text-sm">Date</Label>
                          <Input
                            type="date"
                            value={paiement.date}
                            onChange={(e) => handlePaiementChange(index, 'date', e.target.value)}
                            className="h-10 border-2 border-orange-200 rounded-lg"
                          />
                        </div>
                        <div className="md:col-span-2 flex items-center justify-center">
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => handleRemovePaiement(index)}
                            className="flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    onClick={handleAddPaiement}
                    className="mt-2 bg-orange-600 hover:bg-orange-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un paiement
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Documents */}
            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                <CardTitle className="text-xl flex items-center gap-3">
                  <FileText className="h-6 w-6" />
                  Documents
                  {section4Complete && <CheckCircle className="h-5 w-5 text-green-300" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Passeport */}
                  <div className="space-y-2">
                    <Label className="text-purple-700 font-medium">Passeport</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        onChange={(e) => handleDocumentChange(e, 'passport')}
                        accept="image/*,.pdf"
                        className="h-10 border-2 border-purple-200 focus:border-purple-500 rounded-lg"
                      />
                      {documents.find(d => d.type === 'passport') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDocument('passport')}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {previews.passport && (
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-xs">
                          Document uploadé
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Visa */}
                  <div className="space-y-2">
                    <Label className="text-purple-700 font-medium">Visa</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        onChange={(e) => handleDocumentChange(e, 'visa')}
                        accept=".pdf,image/*"
                        className="h-10 border-2 border-purple-200 focus:border-purple-500 rounded-lg"
                      />
                      {documents.find(d => d.type === 'visa') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDocument('visa')}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {previews.visa && (
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-xs">
                          Document uploadé
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Billet d'avion */}
                  <div className="space-y-2">
                    <Label className="text-purple-700 font-medium">Billet d'avion</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        onChange={(e) => handleDocumentChange(e, 'flightBooked')}
                        accept=".pdf"
                        className="h-10 border-2 border-purple-200 focus:border-purple-500 rounded-lg"
                      />
                      {documents.find(d => d.type === 'flightBooked') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDocument('flightBooked')}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {previews.flightBooked && (
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-xs">
                          Document uploadé
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Réservation hôtel */}
                  <div className="space-y-2">
                    <Label className="text-purple-700 font-medium">Réservation hôtel</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        onChange={(e) => handleDocumentChange(e, 'hotelBooked')}
                        accept=".pdf"
                        className="h-10 border-2 border-purple-200 focus:border-purple-500 rounded-lg"
                      />
                      {documents.find(d => d.type === 'hotelBooked') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDocument('hotelBooked')}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {previews.hotelBooked && (
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-xs">
                          Document uploadé
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Boutons d'action */}
            <div className="flex justify-end gap-4">
              <Link href="/reservations">
                <Button variant="outline" size="lg">
                  Annuler
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Edit className="h-4 w-4 mr-2" />
                {isSubmitting ? "Modification..." : "Modifier la réservation"}
              </Button>
            </div>
          </div>

          {/* Colonne droite - Progression */}
          <div className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm sticky top-6">
              <CardHeader className="bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-t-xl">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Progression
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className={`flex items-center gap-3 ${section1Complete ? "text-green-600" : "text-gray-400"}`}>
                    {section1Complete ? <CheckCircle className="h-5 w-5" /> : <User className="h-5 w-5" />}
                    <span className="text-sm font-medium">Informations Client</span>
                  </div>
                  <div className={`flex items-center gap-3 ${section2Complete ? "text-green-600" : "text-gray-400"}`}>
                    {section2Complete ? <CheckCircle className="h-5 w-5" /> : <Hotel className="h-5 w-5" />}
                    <span className="text-sm font-medium">Hôtels</span>
                  </div>
                  <div className={`flex items-center gap-3 ${section3Complete ? "text-green-600" : "text-gray-400"}`}>
                    {section3Complete ? <CheckCircle className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                    <span className="text-sm font-medium">Paiements</span>
                  </div>
                  <div className={`flex items-center gap-3 ${section4Complete ? "text-green-600" : "text-gray-400"}`}>
                    {section4Complete ? <CheckCircle className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    <span className="text-sm font-medium">Documents</span>
                  </div>
                </div>
                
                <div className="mt-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Complétion</span>
                    <span>{totalProgress}%</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${totalProgress}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>

      {/* Dialog de prévisualisation */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="mt-4">
              {preview.url.includes('.pdf') ? (
                <iframe
                  src={preview.url}
                  className="w-full h-96 border rounded"
                  title={preview.title}
                />
              ) : (
                <img
                  src={preview.url}
                  alt={preview.title}
                  className="w-full h-auto rounded"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}