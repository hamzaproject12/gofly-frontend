"use client"

import { useState, useRef, useEffect } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useRouter, useParams } from "next/navigation"
import { CheckCircle, User, CreditCard, FileText, Sparkles, Hotel, Wallet, Bell, Settings, Search, Calendar, Users } from "lucide-react"
import Link from "next/link"

// Types (reprendre ceux de nouvelle/page.tsx)
// ... (types DocumentType, Program, Hotel, Paiement, etc.)

// Types de chambre dynamiques
const ROOM_TYPES = [
  { value: 'SINGLE', label: 'Simple' },
  { value: 'DOUBLE', label: 'Double' },
  { value: 'TRIPLE', label: 'Triple' },
  { value: 'QUAD', label: 'Quadruple' },
];

export default function EditReservation() {
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams();
  const reservationId = params?.id;

  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<any>(null)
  const [paiements, setPaiements] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [programs, setPrograms] = useState<any[]>([])
  const [previews, setPreviews] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    // Charger la liste des programmes
    fetch(api.url(api.endpoints.programs))
      .then(res => res.json())
      .then(data => setPrograms(data))
      .catch(() => setPrograms([]))
    // Charger la réservation
    if (!reservationId) return;
    setLoading(true);
    fetch(api.url(`/api/reservations/${reservationId}`))
      .then(res => res.json())
      .then(data => {
        setForm({
          nom: data.lastName,
          prenom: data.firstName,
          telephone: data.phone,
          programme: data.program?.name || '',
          programId: data.programId?.toString() || '',
          typeChambre: data.roomType,
          prix: data.price,
          hotelMadina: data.hotelMadina,
          hotelMakkah: data.hotelMakkah,
          dateReservation: data.reservationDate?.split('T')[0] || '',
          statut: data.status,
          passeport: data.statutPasseport,
          visa: data.statutVisa,
          reservationHotel: data.statutHotel,
          billetAvion: data.statutVol,
        });
        setPaiements((data.payments || []).map((p: any) => ({ montant: p.amount, type: p.paymentMethod, date: p.paymentDate?.split('T')[0] || '', recu: p.fichier?.filePath || '' })));
        // Documents mapping
        const docObj: any = {};
        (data.documents || data.fichiers || []).forEach((d: any) => {
          docObj[d.fileType] = { url: d.filePath, type: d.fileType };
        });
        setDocuments([
          docObj['passport'] ? { type: 'passport', url: docObj['passport'].url } : null,
          docObj['visa'] ? { type: 'visa', url: docObj['visa'].url } : null,
          docObj['hotelBooked'] ? { type: 'hotelBooked', url: docObj['hotelBooked'].url } : null,
          docObj['flightBooked'] ? { type: 'flightBooked', url: docObj['flightBooked'].url } : null,
        ].filter(Boolean));
        // Previews pour les documents existants
        Object.entries(docObj).forEach(([type, doc]: any) => {
          if (doc.url) setPreviews(prev => ({ ...prev, [type]: doc.url }));
        });
      })
      .finally(() => setLoading(false));
  }, [reservationId]);

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePaiementChange = (index: number, field: string, value: string) => {
    setPaiements(paiements => paiements.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleAddPaiement = () => {
    setPaiements([...paiements, { montant: '', type: '', date: '', recu: '' }]);
  };

  const handleRemovePaiement = (index: number) => {
    setPaiements(paiements => paiements.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setIsSubmitting(true);
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
        statutPasseport: form.passeport,
        statutVisa: form.visa,
        statutHotel: form.reservationHotel,
        statutVol: form.billetAvion,
        paiements: paiements.map(p => ({ montant: p.montant, type: p.type, date: p.date, recu: p.recu })),
        // documents: ... (à compléter pour upload/remplacement)
      };
      const res = await fetch(api.url(`/api/reservations/${reservationId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Erreur lors de la modification');
      toast({ title: 'Succès', description: 'Réservation modifiée avec succès' });
      router.push('/reservations');
    } catch (err) {
      toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Erreur lors de la modification', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !form) return <div className="p-8 text-center text-gray-500">Chargement...</div>;

  // Progression logic (sections complétées)
  const section1Complete = form.nom && form.prenom && form.telephone && form.typeChambre && form.prix;
  const section2Complete = paiements.length > 0 && paiements.every(p => p.montant && p.type);
  const section3Complete = documents && documents.length > 0;

  // Documents Fournisseur handlers (simplifié, à adapter selon besoin)
  const handleDocumentChange = (e: any, type: string) => {
    const file = e.target.files[0];
    if (!file) return;
    setDocuments(prev => ([...prev.filter(d => d.type !== type), { type, url: URL.createObjectURL(file), file }]));
  };
  const handleRemoveDocument = (type: string) => {
    setDocuments(prev => prev.filter(d => d.type !== type));
  };

  // Trouver le programme sélectionné
  const selectedProgram = programs.find((p) => p.id.toString() === form?.programId);
  const hotelsMadina = selectedProgram?.hotels?.filter((h: any) => h.city === 'Madina') || [];
  const hotelsMakkah = selectedProgram?.hotels?.filter((h: any) => h.city === 'Makkah') || [];

  // Lors du changement de programme, réinitialiser les hôtels
  const handleProgramChange = (value: string) => {
    const selected = programs.find((p) => p.id.toString() === value);
    setForm((prev: any) => ({
      ...prev,
      programId: value,
      programme: selected?.name || '',
      hotelMadina: '',
      hotelMakkah: '',
    }));
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Colonne principale - Formulaire */}
            <div className="lg:col-span-3 space-y-4">
              <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm h-full">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <CardTitle className="text-xl flex items-center gap-3">
                    <Sparkles className="h-6 w-6" />
                    Modifier la Réservation
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Section 1: Informations Client */}
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Informations Client
                      {section1Complete && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-blue-700 font-medium text-sm">Programme</span>
                        <Select
                          value={form.programId}
                          onValueChange={(value) => handleProgramChange(value)}
                        >
                          <SelectTrigger className="h-10 border-2 border-blue-200 rounded-lg">
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
                        <span className="text-blue-700 font-medium text-sm">Type de chambre</span>
                        <Select
                          value={form.typeChambre}
                          onValueChange={(value) => setForm((prev: any) => ({ ...prev, typeChambre: value }))}
                        >
                          <SelectTrigger className="h-10 border-2 border-blue-200 rounded-lg">
                            <SelectValue placeholder="Sélectionner le type" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROOM_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <span className="text-blue-700 font-medium text-sm">Nom</span>
                        <Input name="nom" value={form.nom} onChange={handleChange} className="h-10 border-2 border-blue-200 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <span className="text-blue-700 font-medium text-sm">Prénom</span>
                        <Input name="prenom" value={form.prenom} onChange={handleChange} className="h-10 border-2 border-blue-200 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <span className="text-blue-700 font-medium text-sm">Téléphone</span>
                        <Input name="telephone" value={form.telephone} onChange={handleChange} className="h-10 border-2 border-blue-200 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <span className="text-blue-700 font-medium text-sm">Prix du voyage (DH)</span>
                        <Input name="prix" value={form.prix} onChange={handleChange} className="h-10 border-2 border-blue-200 rounded-lg" />
                      </div>
                    </div>
                  </div>
                  {/* Section Hôtels */}
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                    <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <Hotel className="h-5 w-5" />
                      Hôtels
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-green-700 font-medium text-sm">Hôtel à Madina</span>
                        <Select
                          value={form.hotelMadina}
                          onValueChange={(value) => setForm((prev: any) => ({ ...prev, hotelMadina: value }))}
                          disabled={!form.programId}
                        >
                          <SelectTrigger className="h-10 border-2 border-green-200 rounded-lg">
                            <SelectValue placeholder={form.programId ? "Sélectionner un hôtel à Madina" : "Sélectionnez d'abord un programme"} />
                          </SelectTrigger>
                          <SelectContent>
                            {hotelsMadina.map((hotel: any) => (
                              <SelectItem key={hotel.id} value={hotel.name}>{hotel.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <span className="text-green-700 font-medium text-sm">Hôtel à Makkah</span>
                        <Select
                          value={form.hotelMakkah}
                          onValueChange={(value) => setForm((prev: any) => ({ ...prev, hotelMakkah: value }))}
                          disabled={!form.programId}
                        >
                          <SelectTrigger className="h-10 border-2 border-green-200 rounded-lg">
                            <SelectValue placeholder={form.programId ? "Sélectionner un hôtel à Makkah" : "Sélectionnez d'abord un programme"} />
                          </SelectTrigger>
                          <SelectContent>
                            {hotelsMakkah.map((hotel: any) => (
                              <SelectItem key={hotel.id} value={hotel.name}>{hotel.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  {/* Section Paiements détaillés */}
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                    <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Paiements
                      {section2Complete && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </h3>
                    <div className="space-y-4">
                      {paiements.map((paiement, index) => (
                        <div key={index} className="p-4 border border-orange-200 rounded-lg bg-white/60">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <div className="md:col-span-3 space-y-2">
                              <span className="text-orange-700 font-medium text-sm">Type de paiement</span>
                              <Input value={paiement.type} onChange={e => handlePaiementChange(index, 'type', e.target.value)} className="h-10 border-2 border-orange-200 rounded-lg" />
                            </div>
                            <div className="md:col-span-3 space-y-2">
                              <span className="text-orange-700 font-medium text-sm">Montant (DH)</span>
                              <Input value={paiement.montant} onChange={e => handlePaiementChange(index, 'montant', e.target.value)} className="h-10 border-2 border-orange-200 rounded-lg" />
                            </div>
                            <div className="md:col-span-3 space-y-2">
                              <span className="text-orange-700 font-medium text-sm">Date</span>
                              <Input type="date" value={paiement.date} onChange={e => handlePaiementChange(index, 'date', e.target.value)} className="h-10 border-2 border-orange-200 rounded-lg" />
                            </div>
                            <div className="md:col-span-2 flex items-center justify-center">
                              <Button type="button" variant="destructive" onClick={() => handleRemovePaiement(index)}>Supprimer</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button type="button" onClick={handleAddPaiement} className="mt-2">Ajouter un paiement</Button>
                    </div>
                  </div>
                  {/* Section Documents Fournisseur */}
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                    <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Documents Fournisseur
                      {section3Complete && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Passeport */}
                      <div className="space-y-2">
                        <Label className="text-purple-700 font-medium text-sm">Passeport</Label>
                        <div className="flex items-center gap-2">
                          <Input type="file" onChange={e => handleDocumentChange(e, 'passport')} accept="image/*" className="h-10 border-2 border-purple-200 focus:border-purple-500 rounded-lg" />
                          {documents.find(d => d.type === 'passport') && (
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveDocument('passport')} className="text-red-600 hover:text-red-800 hover:bg-red-50">
                              Supprimer
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* Visa */}
                      <div className="space-y-2">
                        <Label className="text-purple-700 font-medium text-sm">Visa</Label>
                        <div className="flex items-center gap-2">
                          <Input type="file" onChange={e => handleDocumentChange(e, 'visa')} accept=".pdf" className="h-10 border-2 border-purple-200 focus:border-purple-500 rounded-lg" />
                          {documents.find(d => d.type === 'visa') && (
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveDocument('visa')} className="text-red-600 hover:text-red-800 hover:bg-red-50">
                              Supprimer
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* Billet d'avion */}
                      <div className="space-y-2">
                        <Label className="text-purple-700 font-medium text-sm">Billet d'avion</Label>
                        <div className="flex items-center gap-2">
                          <Input type="file" onChange={e => handleDocumentChange(e, 'flightBooked')} accept=".pdf" className="h-10 border-2 border-purple-200 focus:border-purple-500 rounded-lg" />
                          {documents.find(d => d.type === 'flightBooked') && (
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveDocument('flightBooked')} className="text-red-600 hover:text-red-800 hover:bg-red-50">
                              Supprimer
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* Réservation hôtel */}
                      <div className="space-y-2">
                        <Label className="text-purple-700 font-medium text-sm">Réservation hôtel</Label>
                        <div className="flex items-center gap-2">
                          <Input type="file" onChange={e => handleDocumentChange(e, 'hotelBooked')} accept=".pdf" className="h-10 border-2 border-purple-200 focus:border-purple-500 rounded-lg" />
                          {documents.find(d => d.type === 'hotelBooked') && (
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveDocument('hotelBooked')} className="text-red-600 hover:text-red-800 hover:bg-red-50">
                              Supprimer
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Bouton de soumission */}
                  <div className="flex justify-end gap-4">
                    <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                      {isSubmitting ? "Modification..." : "Modifier la réservation"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* Colonne droite - Progression */}
            <div className="space-y-4">
              <Card className="border-0 shadow-xl bg-white">
                <CardHeader className="bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-t-xl">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Progression
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-2">
                    <div className={`flex items-center gap-2 ${section1Complete ? "text-green-600" : "text-gray-400"}`}>
                      {section1Complete ? <CheckCircle className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      <span className="text-sm font-medium">Informations Client</span>
                    </div>
                    <div className={`flex items-center gap-2 ${section2Complete ? "text-green-600" : "text-gray-400"}`}>
                      {section2Complete ? <CheckCircle className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                      <span className="text-sm font-medium">Paiements</span>
                    </div>
                    <div className={`flex items-center gap-2 ${section3Complete ? "text-green-600" : "text-gray-400"}`}>
                      {section3Complete ? <CheckCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      <span className="text-sm font-medium">Documents</span>
                    </div>
                  </div>
                  <div className="mt-4 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${((section1Complete ? 1 : 0) + (section2Complete ? 1 : 0) + (section3Complete ? 1 : 0)) * 33.33}%`,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </>
  )
} 