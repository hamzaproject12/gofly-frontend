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

export default function EditReservation() {
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const reservationId = params?.id

  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [programs, setPrograms] = useState<Program[]>([])
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; type: string } | null>(null)
  const [showRoomGuide, setShowRoomGuide] = useState(false)
  
  const [formData, setFormData] = useState<FormData>({
    programme: "",
    typeChambre: "",
    nom: "",
    prenom: "",
    telephone: "",
    prix: "",
    hotelMadina: "",
    hotelMakkah: "",
    dateReservation: new Date().toISOString().split('T')[0],
    programId: "",
    gender: "",
    statutVisa: false,
    statutVol: false,
    statutHotel: false,
    paiements: []
  })

  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [previews, setPreviews] = useState<{ [key: string]: { url: string, type: string } }>({})
  const [documents, setDocuments] = useState<{
    passport: File | null;
    visa: File | null;
    hotelBooked: File | null;
    flightBooked: File | null;
    payment: (File | null)[];
  }>({
    passport: null,
    visa: null,
    hotelBooked: null,
    flightBooked: null,
    payment: []
  })

  const fileInputs = useRef<FileInputs>({
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
        // Charger la réservation existante d'abord
        if (reservationId) {
          const reservationResponse = await fetch(api.url(`/api/reservations/${reservationId}`))
          const reservationData = await reservationResponse.json()
          
          setFormData({
            programme: reservationData.program?.name || "",
            typeChambre: reservationData.roomType || "",
            nom: reservationData.lastName || "",
            prenom: reservationData.firstName || "",
            telephone: reservationData.phone || "",
            prix: reservationData.price?.toString() || "",
            hotelMadina: reservationData.hotelMadinaId?.toString() || reservationData.hotelMadina || "",
            hotelMakkah: reservationData.hotelMakkahId?.toString() || reservationData.hotelMakkah || "",
            dateReservation: reservationData.reservationDate?.split('T')[0] || new Date().toISOString().split('T')[0],
            programId: reservationData.programId?.toString() || "",
            gender: reservationData.gender || "",
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
          
          // Set previews pour les documents existants
          Object.entries(docObj).forEach(([type, doc]: any) => {
            if (doc.url) {
              setPreviews(prev => ({ 
                ...prev, 
                [type]: { url: doc.url, type: doc.fileName?.includes('.pdf') ? 'application/pdf' : 'image/*' }
              }))
            }
          })

          // Charger seulement le programme de cette réservation
          if (reservationData.programId) {
            const programResponse = await fetch(api.url(`/api/programs/${reservationData.programId}`))
            const programData = await programResponse.json()
            setPrograms([programData]) // Un seul programme dans le tableau
          }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const body = {
        firstName: formData.prenom,
        lastName: formData.nom,
        phone: formData.telephone,
        programId: Number(formData.programId),
        roomType: formData.typeChambre,
        hotelMadinaId: formData.hotelMadina ? Number(formData.hotelMadina) : null,
        hotelMakkahId: formData.hotelMakkah ? Number(formData.hotelMakkah) : null,
        price: parseFloat(formData.prix),
        reservationDate: formData.dateReservation,
        gender: formData.gender,
        statutPasseport: documents.passport !== null,
        statutVisa: formData.statutVisa,
        statutHotel: formData.statutHotel,
        statutVol: formData.statutVol,
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

  // Fonctions de gestion des fichiers (alignées avec Nouvelle Réservation)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: DocumentType) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      setDocuments(prev => ({
        ...prev,
        [type]: file
      }));
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviews(prev => ({
            ...prev,
            [type]: { url: reader.result as string, type: file.type }
          }));
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        setPreviews(prev => ({
          ...prev,
          [type]: { url: URL.createObjectURL(file), type: file.type }
        }));
      }
    }
  }

  const handleRemoveDocument = (type: string) => {
    if (type === 'passport') {
      setDocuments(prev => ({ ...prev, passport: null }))
      setPreviews(prev => {
        const newPreviews = { ...prev }
        delete newPreviews[type]
        return newPreviews
      })
    }
  }

  const mettreAJourPaiement = (index: number, field: string, value: string) => {
    setPaiements(paiements => paiements.map((p, i) => 
      i === index ? { ...p, [field]: value } : p
    ))
  }

  const ajouterPaiement = () => {
    setPaiements([...paiements, { montant: '', type: '', date: '', recu: '' }])
  }

  const supprimerPaiement = (index: number) => {
    setPaiements(paiements => paiements.filter((_, i) => i !== index))
  }

  // Calculs de progression
  const section1Complete = formData.nom && formData.prenom && formData.telephone && formData.typeChambre && formData.prix && formData.gender
  const section2Complete = formData.programId && formData.hotelMadina && formData.hotelMakkah
  const section3Complete = paiements.length > 0 && paiements.every(p => p.montant && p.type && p.date)
  const section4Complete = true // Les toggles sont toujours complétés

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

        {/* Structure identique à Nouvelle Réservation */}
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <CardTitle className="text-xl flex items-center gap-3">
                    <Sparkles className="h-6 w-6" />
                    Modifier la Réservation
              {formData.prix && (
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/30 ml-auto">
                  <Wallet className="h-4 w-4 text-white" />
                  <span className="text-sm text-white/80 font-medium">Prix:</span>
                  <span className="text-lg font-bold text-white">
                    {parseFloat(formData.prix).toLocaleString('fr-FR')} DH
                  </span>
                </div>
              )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
            <form onSubmit={handleSubmit}>
              {/* Section 1: Configuration du Voyage */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-6">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Configuration du Voyage
                    </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Programme *</Label>
                        <Select
                      value={formData.programme}
                      onValueChange={async (value) => {
                        // Si on change de programme, charger le nouveau programme
                        if (value && value !== formData.programme) {
                          try {
                            // Chercher d'abord dans les programmes déjà chargés
                            let selectedProgram = programs.find(p => p.name === value);
                            
                            // Si pas trouvé, charger depuis l'API
                            if (!selectedProgram) {
                              const programResponse = await fetch(api.url(`/api/programs`))
                              const allPrograms = await programResponse.json()
                              selectedProgram = allPrograms.find((p: any) => p.name === value)
                              
                              if (selectedProgram) {
                                setPrograms([selectedProgram]) // Remplacer par le nouveau programme
                              }
                            }
                            
                            setFormData(prev => ({
                              ...prev,
                              programme: value,
                              programId: selectedProgram?.id.toString() || "",
                              hotelMadina: "",
                              hotelMakkah: ""
                            }));
                          } catch (error) {
                            console.error('Erreur lors du chargement du programme:', error)
                            toast({
                              title: "Erreur",
                              description: "Impossible de charger les données du programme",
                              variant: "destructive"
                            })
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                        <SelectValue placeholder="Sélectionner un programme" />
                          </SelectTrigger>
                      <SelectContent>
                        {programs.map((program) => (
                          <SelectItem key={program.id} value={program.name}>
                            {program.name}
                          </SelectItem>
                        ))}
                        {/* Option pour charger d'autres programmes si nécessaire */}
                        {programs.length === 1 && (
                          <SelectItem value="__load_other__" disabled>
                            Autres programmes disponibles...
                          </SelectItem>
                        )}
                      </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Type de chambre *</Label>
                        <Select
                      value={formData.typeChambre}
                      onValueChange={(value) => setFormData({ ...formData, typeChambre: value })}
                        >
                      <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                            <SelectValue placeholder="Sélectionner le type" />
                          </SelectTrigger>
                          <SelectContent>
                        <SelectItem value="SINGLE">1 personne</SelectItem>
                        <SelectItem value="DOUBLE">2 personnes</SelectItem>
                        <SelectItem value="TRIPLE">3 personnes</SelectItem>
                        <SelectItem value="QUAD">4 personnes</SelectItem>
                        <SelectItem value="QUINT">5 personnes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Genre *</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    >
                      <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                        <SelectValue placeholder="Sélectionner le genre" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Homme">Homme</SelectItem>
                        <SelectItem value="Femme">Femme</SelectItem>
                      </SelectContent>
                    </Select>
                      </div>
                      </div>

                {/* Choix des hôtels */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Hôtel à Madina */}
                      <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🕌</span>
                      <Label className="text-blue-700 font-medium text-sm">Hôtel à Madina *</Label>
                    </div>
                        <Select
                      value={formData.hotelMadina}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, hotelMadina: value }))}
                      disabled={!formData.programId}
                    >
                      <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                        <SelectValue placeholder={formData.programId ? "Sélectionner un hôtel à Madina" : "Sélectionnez d'abord un programme"} />
                          </SelectTrigger>
                          <SelectContent>
                        <SelectItem value="none">Sans hôtel</SelectItem>
                        {programs
                          .find(p => p.id === parseInt(formData.programId))
                          ?.hotelsMadina
                          ?.map((ph: { hotel: Hotel }) => (
                            <SelectItem key={ph.hotel.id} value={ph.hotel.id.toString()}>
                              {ph.hotel.name}
                            </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                  {/* Hôtel à Makkah */}
                      <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🕋</span>
                      <Label className="text-blue-700 font-medium text-sm">Hôtel à Makkah *</Label>
                    </div>
                        <Select
                      value={formData.hotelMakkah}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, hotelMakkah: value }))}
                      disabled={!formData.programId}
                    >
                      <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                        <SelectValue placeholder={formData.programId ? "Sélectionner un hôtel à Makkah" : "Sélectionnez d'abord un programme"} />
                          </SelectTrigger>
                          <SelectContent>
                        <SelectItem value="none">Sans hôtel</SelectItem>
                        {programs
                          .find(p => p.id === parseInt(formData.programId))
                          ?.hotelsMakkah
                          ?.map((ph: { hotel: Hotel }) => (
                            <SelectItem key={ph.hotel.id} value={ph.hotel.id.toString()}>
                              {ph.hotel.name}
                            </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

              {/* Section 2: Informations Client */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-6">
                <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informations Client
                  {section1Complete && <CheckCircle className="h-5 w-5 text-green-500" />}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Nom *</Label>
                    <Input
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      placeholder="Nom du client"
                      className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Prénom *</Label>
                    <Input
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      placeholder="Prénom du client"
                      className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Téléphone *</Label>
                    <Input
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      placeholder="Numéro de téléphone"
                      className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                    />
                  </div>

                  {/* Passeport - Ajouté dans Informations Client */}
                  <div className="space-y-2 md:col-span-3">
                    <Label className="text-blue-700 font-medium text-sm">Passeport *</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        ref={(el) => {
                          if (el) fileInputs.current.passeport = el;
                        }}
                        onChange={(e) => handleFileChange(e, 'passport')}
                        accept="image/*,.pdf"
                        className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                      />
                      {documents.passport && (
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
                      <div className="mt-2 p-2 border border-blue-200 rounded-lg bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700">Aperçu du passeport</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded"
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPreviewImage({ url: previews.passport.url, title: 'Passeport', type: previews.passport.type });
                              }}
                            >
                              <ZoomIn className="h-3 w-3 mr-1" />
                              Zoom
                            </button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveDocument('passport')}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Supprimer
                            </Button>
                          </div>
                        </div>
                        <div className="w-full h-[200px] overflow-hidden rounded-lg border border-blue-200">
                          {previews.passport.type === 'application/pdf' ? (
                            <embed
                              src={`${previews.passport.url}#toolbar=0&navpanes=0&scrollbar=0`}
                              type="application/pdf"
                              className="w-full h-full"
                            />
                          ) : (
                            <img
                              src={previews.passport.url}
                              alt="Passeport"
                              className="w-full h-full object-contain"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Paiements */}
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200 mb-6">
                    <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Paiements
                      {section2Complete && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </h3>
                    <div className="space-y-4">
                      {paiements.map((paiement, index) => (
                        <div key={index} className="p-4 border border-orange-200 rounded-lg bg-white/60">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-3 space-y-2">
                          <Label className="text-orange-700 font-medium text-sm">Mode de paiement</Label>
                          <Select
                            value={paiement.type}
                            onValueChange={(value) => mettreAJourPaiement(index, "type", value)}
                          >
                            <SelectTrigger className="h-10 border-2 border-orange-200 focus:border-orange-500 rounded-lg">
                              <SelectValue placeholder="Sélectionner paiement" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="especes">Espèces</SelectItem>
                              <SelectItem value="virement">Virement</SelectItem>
                              <SelectItem value="carte">Carte</SelectItem>
                              <SelectItem value="cheque">Chèque</SelectItem>
                            </SelectContent>
                          </Select>
                            </div>
                            <div className="md:col-span-3 space-y-2">
                          <Label className="text-orange-700 font-medium text-sm">Montant (DH)</Label>
                          <Input
                            type="number"
                            value={paiement.montant}
                            onChange={(e) => mettreAJourPaiement(index, "montant", e.target.value)}
                            placeholder="Montant en dirhams"
                            className="h-10 border-2 border-orange-200 focus:border-orange-500 rounded-lg"
                          />
                            </div>
                            <div className="md:col-span-3 space-y-2">
                          <Label className="text-orange-700 font-medium text-sm">Date</Label>
                          <Input
                            type="date"
                            value={paiement.date}
                            onChange={(e) => mettreAJourPaiement(index, "date", e.target.value)}
                            className="h-10 border-2 border-orange-200 focus:border-orange-500 rounded-lg"
                          />
                        </div>
                        <div className="md:col-span-3 flex items-center justify-center">
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => supprimerPaiement(index)}
                            className="flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Supprimer
                          </Button>
                        </div>
                            </div>
                      {paiement.recu && (
                        <div className="mt-3 p-2 border border-orange-200 rounded-lg bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-orange-700">Reçu de paiement</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="text-orange-600 hover:text-orange-800 hover:bg-orange-50 p-1 rounded"
                                onClick={() => setPreviewImage({ url: paiement.recu || '', title: 'Reçu paiement', type: 'image/*' })}
                              >
                                <ZoomIn className="h-4 w-4" />
                              </button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => mettreAJourPaiement(index, 'recu', '')}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="w-full h-[150px] overflow-hidden rounded-lg border border-orange-200">
                            {paiement.recu.includes('.pdf') ? (
                              <embed
                                src={`${paiement.recu}#toolbar=0&navpanes=0&scrollbar=0`}
                                type="application/pdf"
                                className="w-full h-full"
                              />
                            ) : (
                              <img
                                src={paiement.recu}
                                alt="Reçu de paiement"
                                className="w-full h-full object-contain"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    onClick={ajouterPaiement}
                    className="mt-2 bg-orange-600 hover:bg-orange-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un paiement
                  </Button>
                    </div>
                  </div>

              {/* Section 4: Documents Fournisseur - Statuts simplifiés */}
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200 mb-6">
                    <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Documents Fournisseur
                      {section3Complete && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </h3>
                <div className="space-y-4">
                  {/* Statuts des documents avec toggle switches */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Statut Visa */}
                    <div className="bg-white p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <Label className="text-purple-700 font-medium">Statut Visa</Label>
                        </div>
                        <Switch
                          checked={formData.statutVisa || false}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, statutVisa: checked }))}
                          className="data-[state=checked]:bg-blue-600"
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        {formData.statutVisa ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Visa obtenu
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-orange-600">
                            <Bell className="h-4 w-4" />
                            En attente
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Statut Vol */}
                    <div className="bg-white p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Calendar className="h-4 w-4 text-green-600" />
                          </div>
                          <Label className="text-purple-700 font-medium">Statut Vol</Label>
                        </div>
                        <Switch
                          checked={formData.statutVol || false}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, statutVol: checked }))}
                          className="data-[state=checked]:bg-green-600"
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        {formData.statutVol ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Billet réservé
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-orange-600">
                            <Bell className="h-4 w-4" />
                            En attente
                          </div>
                          )}
                        </div>
                      </div>

                    {/* Statut Hôtel */}
                    <div className="bg-white p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Hotel className="h-4 w-4 text-purple-600" />
                          </div>
                          <Label className="text-purple-700 font-medium">Statut Hôtel</Label>
                        </div>
                        <Switch
                          checked={formData.statutHotel || false}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, statutHotel: checked }))}
                          className="data-[state=checked]:bg-purple-600"
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        {formData.statutHotel ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Hôtel réservé
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-orange-600">
                            <Bell className="h-4 w-4" />
                            En attente
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

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
            </form>
                </CardContent>
              </Card>
            </div>

      {/* Dialog de prévisualisation */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewImage?.title}</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="mt-4">
              {previewImage.url.includes('.pdf') ? (
                <iframe
                  src={previewImage.url}
                  className="w-full h-96 border rounded"
                  title={previewImage.title}
                />
              ) : (
                <img
                  src={previewImage.url}
                  alt={previewImage.title}
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