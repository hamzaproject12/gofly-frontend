"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import {
  CalendarIcon,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle,
  Bell,
  Settings,
  Search,
  Calendar,
  Users,
  FileText,
  Wallet,
  Plane,
  DollarSign,
  BadgeCheck,
  PiggyBank,
  User,
  Bed,
} from "lucide-react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import Link from "next/link"

interface Hotel {
  id: number;
  name: string;
  city: 'Madina' | 'Makkah';
}

export default function NouveauProgramme() {
  const { toast } = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hotelsMadina, setHotelsMadina] = useState<Hotel[]>([])
  const [hotelsMakkah, setHotelsMakkah] = useState<Hotel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Remplacer la structure du state pour les hôtels
  const [formData, setFormData] = useState({
    nom: "",
    nbJoursMadina: "",
    nbJoursMakkah: "",
    exchange: "",
    prixAvion: "",
    prixVisaRiyal: "",
    profit: "",
    dateCreation: new Date(),
    hotelsMadina: [] as Array<{
      name: string,
      chambres: {
        [key: number]: { nb: string, prix: string }
      }
    }>,
    hotelsMakkah: [] as Array<{
      name: string,
      chambres: {
        [key: number]: { nb: string, prix: string }
      }
    }>,
    datesLimites: {
      visa: null as Date | null,
      hotels: null as Date | null,
      billets: null as Date | null,
      passport: null as Date | null,
    },
  })

  const [autreHotelMadina, setAutreHotelMadina] = useState("");
  const [showAutreMadinaInput, setShowAutreMadinaInput] = useState(false);
  const [autreHotelMakkah, setAutreHotelMakkah] = useState("");
  const [showAutreMakkahInput, setShowAutreMakkahInput] = useState(false);

  // Charger les hôtels disponibles
  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const [madinaResponse, makkahResponse] = await Promise.all([
          fetch(api.url('/api/hotels/available?city=Madina')),
          fetch(api.url('/api/hotels/available?city=Makkah'))
        ]);

        if (!madinaResponse.ok || !makkahResponse.ok) {
          throw new Error('Erreur lors du chargement des hôtels');
        }

        const madinaHotels = await madinaResponse.json();
        const makkahHotels = await makkahResponse.json();

        console.log('Hôtels Madina chargés:', madinaHotels);
        console.log('Hôtels Makkah chargés:', makkahHotels);

        setHotelsMadina(madinaHotels || []);
        setHotelsMakkah(makkahHotels || []);
      } catch (error) {
        console.error('Erreur:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les hôtels. Vérifiez que le serveur backend est démarré.',
          variant: 'destructive',
        });
        // Initialiser avec des tableaux vides en cas d'erreur
        setHotelsMadina([]);
        setHotelsMakkah([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHotels();
  }, [toast]);

  // Nouvelle fonction pour gérer la sélection d'un hôtel Madina
  const toggleHotelMadina = (hotelName: string) => {
    setFormData(prev => {
      const exists = prev.hotelsMadina.find(h => h.name === hotelName);
      if (exists) {
        return {
          ...prev,
          hotelsMadina: prev.hotelsMadina.filter(h => h.name !== hotelName)
        };
      } else {
        return {
          ...prev,
          hotelsMadina: [
            ...prev.hotelsMadina,
            {
              name: hotelName,
              chambres: {
                1: { nb: "", prix: "" },
                2: { nb: "", prix: "" },
                3: { nb: "", prix: "" },
                4: { nb: "", prix: "" },
                5: { nb: "", prix: "" },
              }
            }
          ]
        };
      }
    });
  }

  // Nouvelle fonction pour modifier les chambres/prix d'un hôtel Madina
  const handleChambreChangeMadina = (hotelName: string, type: number, field: 'nb' | 'prix', value: string) => {
    setFormData(prev => ({
      ...prev,
      hotelsMadina: prev.hotelsMadina.map(hotel =>
        hotel.name === hotelName
          ? {
              ...hotel,
              chambres: {
                ...hotel.chambres,
                [type]: {
                  ...hotel.chambres[type],
                  [field]: value
                }
              }
            }
          : hotel
      )
    }));
  }

  // Nouvelle fonction pour modifier les chambres/prix d'un hôtel Makkah
  const handleChambreChangeMakkah = (hotelName: string, type: number, field: 'nb' | 'prix', value: string) => {
    setFormData(prev => ({
      ...prev,
      hotelsMakkah: prev.hotelsMakkah.map(hotel =>
        hotel.name === hotelName
          ? {
              ...hotel,
              chambres: {
                ...hotel.chambres,
                [type]: {
                  ...hotel.chambres[type],
                  [field]: value
                }
              }
            }
          : hotel
      )
    }));
  }

  const toggleHotelMakkah = (hotelName: string) => {
    setFormData(prev => {
      const isSelected = prev.hotelsMakkah.some(hotel => hotel.name === hotelName);
      
      if (isSelected) {
        // Retirer l'hôtel
        return {
          ...prev,
          hotelsMakkah: prev.hotelsMakkah.filter(hotel => hotel.name !== hotelName)
        };
      } else {
        // Ajouter l'hôtel avec configuration par défaut
        return {
          ...prev,
          hotelsMakkah: [
            ...prev.hotelsMakkah,
            {
              name: hotelName,
              chambres: {
                1: { nb: "", prix: "" },
                2: { nb: "", prix: "" },
                3: { nb: "", prix: "" },
                4: { nb: "", prix: "" },
                5: { nb: "", prix: "" },
              }
            }
          ]
        };
      }
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    setIsSubmitting(true)

    try {
      const programData = {
        name: formData.nom,
        nbJoursMadina: formData.nbJoursMadina ? parseInt(formData.nbJoursMadina) : 0,
        nbJoursMakkah: formData.nbJoursMakkah ? parseInt(formData.nbJoursMakkah) : 0,
        exchange: formData.exchange ? parseFloat(formData.exchange) : 1.0,
        prixAvionDH: formData.prixAvion ? parseFloat(formData.prixAvion) : 0,
        prixVisaRiyal: formData.prixVisaRiyal ? parseFloat(formData.prixVisaRiyal) : 0,
        profit: formData.profit ? parseFloat(formData.profit) : 0,
        visaDeadline: formData.datesLimites.visa,
        hotelDeadline: formData.datesLimites.hotels,
        flightDeadline: formData.datesLimites.billets,
        passportDeadline: formData.datesLimites.passport,
        hotelsMadina: formData.hotelsMadina,
        hotelsMakkah: formData.hotelsMakkah
      }

      const response = await fetch(api.url(api.endpoints.programs), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(programData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la création du programme')
      }

      toast({
        title: 'Succès',
        description: 'Le programme a été créé avec succès',
      })

      router.push('/programmes')
    } catch (error) {
      console.error('Erreur:', error)
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Une erreur est survenue lors de la création du programme',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid =
    formData.nom &&
    formData.hotelsMadina.length > 0 &&
    formData.hotelsMakkah.length > 0 &&
    formData.datesLimites.visa &&
    formData.datesLimites.hotels &&
    formData.datesLimites.billets &&
    formData.datesLimites.passport

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 gap-6">
          {/* Colonne principale - Formulaire */}
          <div className="space-y-4">
            <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <CardTitle className="text-xl flex items-center gap-3">
                  <Sparkles className="h-6 w-6" />
                  Créer un nouveau programme
                </CardTitle>
                <CardDescription className="text-blue-100">Configurez les détails du programme</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <form onSubmit={handleSubmit}>
                  {/* Informations de base */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-xl border border-blue-200 mb-6">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Informations de base
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="nom" className="text-blue-700 font-medium flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Nom du programme *
                        </Label>
                        <Input
                          id="nom"
                          value={formData.nom}
                          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                          placeholder="Ex: Omra Ramadan 15/03 - 02/04"
                          className="h-12 border-2 border-blue-200 focus:border-blue-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dateCreation" className="text-blue-700 font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Date de création
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal h-12 border-2 border-blue-200 hover:border-blue-300 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                              {formData.dateCreation ? (
                                format(formData.dateCreation, "PPP", { locale: fr })
                              ) : (
                                <span>Sélectionner une date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 shadow-xl border-0">
                            <CalendarComponent
                              mode="single"
                              selected={formData.dateCreation}
                              onSelect={(date) => setFormData({ ...formData, dateCreation: date || new Date() })}
                              initialFocus
                              className="rounded-lg"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>

                  {/* Nouveaux champs ajoutés */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-xl border border-green-200 mb-6">
                    <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Détails financiers et durée
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="nbJoursMadina" className="text-green-700 font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          NB Jours Madina
                        </Label>
                        <Input
                          id="nbJoursMadina"
                          type="number"
                          value={formData.nbJoursMadina}
                          onChange={(e) => setFormData({ ...formData, nbJoursMadina: e.target.value })}
                          placeholder="Ex: 4"
                          className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nbJoursMakkah" className="text-green-700 font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          NB Jours Makkah
                        </Label>
                        <Input
                          id="nbJoursMakkah"
                          type="number"
                          value={formData.nbJoursMakkah}
                          onChange={(e) => setFormData({ ...formData, nbJoursMakkah: e.target.value })}
                          placeholder="Ex: 15"
                          className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="exchange" className="text-green-700 font-medium flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Exchange
                        </Label>
                        <Input
                          id="exchange"
                          type="number"
                          step="0.01"
                          value={formData.exchange}
                          onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                          placeholder="Ex: 2.80"
                          className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prixAvion" className="text-green-700 font-medium flex items-center gap-2">
                          <Plane className="h-4 w-4" />
                          Prix Avion (DH)
                        </Label>
                        <Input
                          id="prixAvion"
                          type="number"
                          value={formData.prixAvion}
                          onChange={(e) => setFormData({ ...formData, prixAvion: e.target.value })}
                          placeholder="Ex: 7750"
                          className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prixVisaRiyal" className="text-green-700 font-medium flex items-center gap-2">
                          <BadgeCheck className="h-4 w-4" />
                          Prix Visa (Riyal)
                        </Label>
                        <Input
                          id="prixVisaRiyal"
                          type="number"
                          value={formData.prixVisaRiyal}
                          onChange={(e) => setFormData({ ...formData, prixVisaRiyal: e.target.value })}
                          placeholder="Ex: 550"
                          className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profit" className="text-green-700 font-medium flex items-center gap-2">
                          <PiggyBank className="h-4 w-4" />
                          Profit (DH)
                        </Label>
                        <Input
                          id="profit"
                          type="number"
                          value={formData.profit}
                          onChange={(e) => setFormData({ ...formData, profit: e.target.value })}
                          placeholder="Ex: 1500"
                          className="h-12 border-2 border-green-200 focus:border-green-500 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hôtels - Layout en 2 colonnes */}
                  <div className="flex flex-col gap-6 mb-6">
                    {/* Hôtels à Madina */}
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200 mb-6 w-full">
                      <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Hôtels à Madina
                      </h3>
                      <div className="flex flex-col gap-4">
                        {hotelsMadina.length === 0 ? (
                          <div className="text-center py-4 text-gray-500">
                            <p>Aucun hôtel trouvé pour Madina.</p>
                            <p className="text-sm">Vous pouvez ajouter un hôtel personnalisé ci-dessous.</p>
                          </div>
                        ) : (
                          hotelsMadina.map((hotel, index) => {
                            const selected = formData.hotelsMadina.some(h => h.name === hotel.name);
                            return (
                              <div key={index} className="border border-yellow-200 rounded-lg p-3 bg-white/70">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox
                                    checked={selected}
                                    onCheckedChange={() => toggleHotelMadina(hotel.name)}
                                    className="data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                                  />
                                  <span className="text-sm font-medium text-yellow-800">{hotel.name}</span>
                                </label>
                                {selected && (
                                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                    {[1,2,3,4,5].map(type => (
                                      <div key={type} className="bg-white border border-yellow-200 rounded-lg p-4 shadow-sm">
                                        {/* Icônes de personnes */}
                                        <div className="text-center mb-3">
                                          <div className="flex items-center justify-center gap-1 mb-2">
                                            {Array.from({ length: type }, (_, i) => (
                                              <div key={i} className="w-6 h-6 flex items-center justify-center">
                                                <User className="w-5 h-5 text-yellow-600" />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                        
                                        {/* Compteur de chambres */}
                                        <div className="mb-3">
                                          <div className="text-sm text-yellow-700 mb-2 text-center font-semibold">Chambres</div>
                                          <div className="flex justify-center">
                                            <div className="inline-flex items-center bg-gray-50 border border-yellow-300 rounded-lg">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 hover:bg-yellow-100 text-yellow-600 border-r border-yellow-200 rounded-l-lg"
                                                onClick={() => {
                                                  const currentValue = parseInt(formData.hotelsMadina.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0");
                                                  const newValue = Math.max(0, currentValue - 1);
                                                  handleChambreChangeMadina(hotel.name, type, 'nb', newValue.toString());
                                                }}
                                              >
                                                <span className="text-sm font-semibold">−</span>
                                              </Button>
                                              <div className="h-8 w-10 flex items-center justify-center text-sm font-semibold text-yellow-800 bg-white">
                                                {formData.hotelsMadina.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0"}
                                              </div>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 hover:bg-yellow-100 text-yellow-600 border-l border-yellow-200 rounded-r-lg"
                                                onClick={() => {
                                                  const currentValue = parseInt(formData.hotelsMadina.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0");
                                                  const newValue = currentValue + 1;
                                                  handleChambreChangeMadina(hotel.name, type, 'nb', newValue.toString());
                                                }}
                                              >
                                                <span className="text-sm font-semibold">+</span>
                                              </Button>
                                            </div>
                                          </div>
                                          
                                          {/* Icônes de chambres */}
                                          <div className="mt-2 flex justify-center">
                                            <div className="flex flex-wrap items-center gap-1 max-w-32">
                                              {Array.from({ length: parseInt(formData.hotelsMadina.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0") }, (_, i) => (
                                                <div key={i} className="w-4 h-4 text-yellow-600">
                                                  <Bed className="w-4 h-4" />
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Prix */}
                                        <div>
                                          <div className="text-sm text-yellow-700 mb-2 text-center font-semibold">Prix (DH)</div>
                                          <Input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={formData.hotelsMadina.find(h => h.name === hotel.name)?.chambres[type]?.prix || ""}
                                            onChange={e => handleChambreChangeMadina(hotel.name, type, 'prix', e.target.value)}
                                            className="h-9 w-full text-center border-yellow-300 focus:border-yellow-500 text-sm"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        {/* Option Autre */}
                        <div className="border border-yellow-200 rounded-lg p-3 bg-white/70 mt-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={showAutreMadinaInput}
                              onCheckedChange={() => setShowAutreMadinaInput((v) => !v)}
                              className="data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                            />
                            <span className="text-sm font-medium text-yellow-800">Autre</span>
                          </label>
                          {showAutreMadinaInput && (
                            <div className="mt-2 flex gap-2 items-center">
                              <Input
                                type="text"
                                placeholder="Nom de l'hôtel"
                                value={autreHotelMadina}
                                onChange={e => setAutreHotelMadina(e.target.value)}
                                className="h-9 border-2 border-yellow-200 focus:border-yellow-400 rounded-lg text-sm"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                                onClick={() => {
                                  const trimmed = autreHotelMadina.trim();
                                  if (trimmed && !formData.hotelsMadina.some(h => h.name === trimmed)) {
                                    // Ajouter l'hôtel à la liste des hôtels disponibles
                                    const newHotel = {
                                      id: Date.now(), // ID unique
                                      name: trimmed,
                                      city: 'Madina' as const
                                    };
                                    setHotelsMadina(prev => [...prev, newHotel]);
                                    
                                    // Ajouter l'hôtel aux hôtels sélectionnés avec configuration
                                    setFormData(prev => ({
                                      ...prev,
                                      hotelsMadina: [
                                        ...prev.hotelsMadina,
                                        {
                                          name: trimmed,
                                          chambres: {
                                            1: { nb: "", prix: "" },
                                            2: { nb: "", prix: "" },
                                            3: { nb: "", prix: "" },
                                            4: { nb: "", prix: "" },
                                          }
                                        }
                                      ]
                                    }));
                                    setAutreHotelMadina("");
                                    setShowAutreMadinaInput(false);
                                  }
                                }}
                                disabled={!autreHotelMadina.trim() || formData.hotelsMadina.some(h => h.name === autreHotelMadina.trim())}
                              >
                                Ajouter
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Hôtels à Makkah */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                      <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Hôtels à Makkah
                      </h3>

                      <div className="space-y-3">
                        {hotelsMakkah.length === 0 ? (
                          <div className="text-center py-4 text-gray-500">
                            <p>Aucun hôtel trouvé pour Makkah.</p>
                            <p className="text-sm">Vous pouvez ajouter un hôtel personnalisé ci-dessous.</p>
                          </div>
                        ) : (
                          hotelsMakkah.map((hotel, index) => {
                            const isSelected = formData.hotelsMakkah.some(h => h.name === hotel.name);
                            return (
                              <div key={index} className="space-y-2">
                                <label className="flex items-center space-x-2 p-3 rounded-lg border border-blue-200 hover:bg-blue-50 transition-all cursor-pointer">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleHotelMakkah(hotel.name)}
                                    className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                  />
                                  <span className="text-sm font-medium text-blue-800">{hotel.name}</span>
                                </label>
                                
                                {/* Configuration des chambres - affichage direct comme pour Madina */}
                                {isSelected && (
                                  <div className="bg-white rounded-lg border border-blue-200 p-4 ml-6">
                                    <h5 className="text-sm font-semibold text-blue-800 mb-3">{hotel.name}</h5>
                                    
                                                                  {/* Types de chambres */}
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {[1, 2, 3, 4, 5].map((type) => (
                                        <div key={type} className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                                          {/* Icône de personne */}
                                          <div className="flex justify-center mb-2">
                                            <div className="flex items-center gap-1">
                                              {Array.from({ length: type }, (_, i) => (
                                                <User key={i} className="w-4 h-4 text-blue-600" />
                                              ))}
                                            </div>
                                          </div>
                                          
                                          {/* Compteur de chambres */}
                                          <div className="mb-3">
                                            <div className="text-sm text-blue-700 mb-2 text-center font-semibold">Chambres</div>
                                            <div className="flex justify-center">
                                              <div className="inline-flex items-center bg-gray-50 border border-blue-300 rounded-lg">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 hover:bg-blue-100 text-blue-600 border-r border-blue-200 rounded-l-lg"
                                                  onClick={() => {
                                                    const currentValue = parseInt(formData.hotelsMakkah.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0");
                                                    const newValue = Math.max(0, currentValue - 1);
                                                    handleChambreChangeMakkah(hotel.name, type, 'nb', newValue.toString());
                                                  }}
                                                >
                                                  <span className="text-sm font-semibold">−</span>
                                                </Button>
                                                <div className="h-8 w-10 flex items-center justify-center text-sm font-semibold text-blue-800 bg-white">
                                                  {formData.hotelsMakkah.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0"}
                                                </div>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 hover:bg-blue-100 text-blue-600 border-l border-blue-200 rounded-r-lg"
                                                  onClick={() => {
                                                    const currentValue = parseInt(formData.hotelsMakkah.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0");
                                                    const newValue = currentValue + 1;
                                                    handleChambreChangeMakkah(hotel.name, type, 'nb', newValue.toString());
                                                  }}
                                                >
                                                  <span className="text-sm font-semibold">+</span>
                                                </Button>
                                              </div>
                                            </div>
                                            
                                            {/* Icônes de chambres */}
                                            <div className="mt-2 flex justify-center">
                                              <div className="flex flex-wrap items-center gap-1 max-w-32">
                                                {Array.from({ length: parseInt(formData.hotelsMakkah.find(h => h.name === hotel.name)?.chambres[type]?.nb || "0") }, (_, i) => (
                                                  <div key={i} className="w-4 h-4 text-blue-600">
                                                    <Bed className="w-4 h-4" />
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {/* Prix */}
                                          <div>
                                            <div className="text-sm text-blue-700 mb-2 text-center font-semibold">Prix (DH)</div>
                                            <Input
                                              type="number"
                                              min="0"
                                              placeholder="0"
                                              value={formData.hotelsMakkah.find(h => h.name === hotel.name)?.chambres[type]?.prix || ""}
                                              onChange={e => handleChambreChangeMakkah(hotel.name, type, 'prix', e.target.value)}
                                              className="h-9 w-full text-center border-blue-300 focus:border-blue-500 text-sm"
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        {/* Option Autre */}
                        <div className="border border-blue-200 rounded-lg p-3 bg-white/70 mt-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={showAutreMakkahInput}
                              onCheckedChange={() => setShowAutreMakkahInput((v) => !v)}
                              className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                            />
                            <span className="text-sm font-medium text-blue-800">Autre</span>
                          </label>
                          {showAutreMakkahInput && (
                            <div className="mt-2 flex gap-2 items-center">
                              <Input
                                type="text"
                                placeholder="Nom de l'hôtel"
                                value={autreHotelMakkah}
                                onChange={e => setAutreHotelMakkah(e.target.value)}
                                className="h-9 border-2 border-blue-200 focus:border-blue-400 rounded-lg text-sm"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                                onClick={() => {
                                  const trimmed = autreHotelMakkah.trim();
                                  if (trimmed && !formData.hotelsMakkah.some(h => h.name === trimmed)) {
                                    // Ajouter l'hôtel à la liste des hôtels disponibles
                                    const newHotel = {
                                      id: Date.now(), // ID unique
                                      name: trimmed,
                                      city: 'Makkah' as const
                                    };
                                    setHotelsMakkah(prev => [...prev, newHotel]);

                                    // Ajouter l'hôtel aux hôtels sélectionnés avec configuration
                                    setFormData(prev => ({
                                      ...prev,
                                      hotelsMakkah: [
                                        ...prev.hotelsMakkah,
                                        {
                                          name: trimmed,
                                          chambres: {
                                            1: { nb: "", prix: "" },
                                            2: { nb: "", prix: "" },
                                            3: { nb: "", prix: "" },
                                            4: { nb: "", prix: "" },
                                          }
                                        }
                                      ]
                                    }));
                                    setAutreHotelMakkah("");
                                    setShowAutreMakkahInput(false);
                                  }
                                }}
                                disabled={!autreHotelMakkah.trim() || formData.hotelsMakkah.some(h => h.name === autreHotelMakkah.trim())}
                              >
                                Ajouter
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dates limites */}
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                    <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Dates limites
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {([
                        { key: "passport", label: "Date limite passeport", color: "purple" },
                        { key: "visa", label: "Date limite visa", color: "red" },
                        { key: "billets", label: "Date limite billets", color: "green" },
                        { key: "hotels", label: "Date limite hôtels", color: "blue" },                        
                        
                      ] as const).map((item) => {
                        type Key = "visa" | "hotels" | "billets" | "passport";
                        const key = item.key as Key;
                        const dateValue = formData.datesLimites[key];
                        const selectedDate: Date | undefined = dateValue ?? undefined;
                        return (
                          <div key={item.key} className="space-y-2">
                            <Label className="text-orange-700 font-medium text-sm">{item.label}</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal h-10 border-2 border-orange-200 hover:border-orange-300 rounded-lg text-sm"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 text-orange-500" />
                                  {dateValue ? (
                                    format(dateValue, "PPP", { locale: fr })
                                  ) : (
                                    <span>Sélectionner une date</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 shadow-xl border-0">
                                <CalendarComponent
                                  mode="single"
                                  selected={selectedDate}
                                  onSelect={(date) =>
                                    setFormData({
                                      ...formData,
                                      datesLimites: { ...formData.datesLimites, [key]: date },
                                    })
                                  }
                                  initialFocus
                                  className="rounded-lg"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex gap-4 mt-8">
                    <Button
                      onClick={handleSubmit}
                      disabled={!isFormValid}
                      className="flex-1 h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="mr-2 h-5 w-5" />
                      Enregistrer le programme
                    </Button>
                    <Link href="/programmes" className="flex-1">
                      <Button variant="outline" className="w-full h-12 border-2 border-gray-300 hover:border-gray-400">
                        <ArrowLeft className="mr-2 h-5 w-5" />
                        Annuler
                      </Button>
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Colonne droite - Récapitulatif */}
          {/* 
          <div className="space-y-4">
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
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Nom:</span>
                    <span className="font-medium text-xs">{formData.nom || "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Date création:</span>
                    <span className="font-medium text-xs">
                      {formData.dateCreation
                        ? format(formData.dateCreation, "dd/MM/yyyy", { locale: fr })
                        : "Non définie"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Jours Madina:</span>
                    <span className="font-medium text-xs">{formData.nbJoursMadina || "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Jours Makkah:</span>
                    <span className="font-medium text-xs">{formData.nbJoursMakkah || "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Exchange:</span>
                    <span className="font-medium text-xs">{formData.exchange || "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Prix Avion:</span>
                    <span className="font-medium text-xs">{formData.prixAvion ? `${formData.prixAvion} DH` : "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Prix Visa:</span>
                    <span className="font-medium text-xs">{formData.prixVisaRiyal ? `${formData.prixVisaRiyal} Riyal` : "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Profit:</span>
                    <span className="font-medium text-xs">{formData.profit ? `${formData.profit} DH` : "Non défini"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Hôtels Madina:</span>
                    <span className="font-medium text-xs">{formData.hotelsMadina.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Hôtels Makkah:</span>
                    <span className="font-medium text-xs">{formData.hotelsMakkah.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Dates limites:</span>
                    <span className="font-medium text-xs">
                      {Object.values(formData.datesLimites).filter(Boolean).length}/4
                    </span>
                  </div>
                </div>

                {(formData.hotelsMadina.length > 0 || formData.hotelsMakkah.length > 0) && (
                  <div className="border-t pt-3 space-y-2">
                    {formData.hotelsMadina.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-yellow-700 mb-1">Madina:</p>
                        <div className="flex flex-wrap gap-1">
                          {formData.hotelsMadina.slice(0, 2).map((hotel, index) => (
                            <span key={index} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                              {hotel.name}
                            </span>
                          ))}
                          {formData.hotelsMadina.length > 2 && (
                            <span className="text-xs text-gray-500">+{formData.hotelsMadina.length - 2}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {formData.hotelsMakkah.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-blue-700 mb-1">Makkah:</p>
                        <div className="flex flex-wrap gap-1">
                          {formData.hotelsMakkah.slice(0, 2).map((hotel, index) => (
                            <span key={index} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {hotel}
                            </span>
                          ))}
                          {formData.hotelsMakkah.length > 2 && (
                            <span className="text-xs text-gray-500">+{formData.hotelsMakkah.length - 2}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white">
              <CardContent className="p-4 space-y-3">
                <Button
                  onClick={handleSubmit}
                  disabled={!isFormValid}
                  className="w-full h-11 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer le programme
                </Button>
                <Link href="/programmes">
                  <Button variant="outline" className="w-full h-11 border-2 border-gray-300 hover:border-gray-400">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Annuler
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
          */}
        </div>
      </div>
    </div>
  )
}
