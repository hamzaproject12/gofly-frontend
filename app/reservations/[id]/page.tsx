'use client';
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, User, CreditCard, FileText, Sparkles, Hotel, ZoomIn, X } from "lucide-react";
import Link from "next/link";

// Ajout des types explicites
interface ReservationDocument {
  type: string;
  url: string;
}

interface Reservation {
  nom: string;
  prenom: string;
  telephone: string;
  programme: string;
  typeChambre: string;
  prix: string | number;
  hotelMadina: string;
  hotelMakkah: string;
  dateReservation: string;
  statut: string;
  paiementRecu: number;
  prixEngage: number;
  passeport: boolean;
  visa: boolean;
  reservationHotel: boolean;
  billetAvion: boolean;
  paiements?: { montant: string; type: string; date: string; recu?: string }[];
  documents?: ReservationDocument[];
  program?: {
    name: string;
    description?: string;
    hotels?: { name: string }[];
  };
}

export default function ReservationDetails() {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/');
      const id = parts[parts.length - 1];
      fetch(api.url(`/api/reservations/${id}`))
        .then(res => res.json())
        .then(data => {
          setReservation({
            nom: data.lastName,
            prenom: data.firstName,
            telephone: data.phone,
            typeChambre: data.roomType,
            prix: data.price,
            programme: data.program?.name || '',
            hotelMadina: data.hotelMadina,
            hotelMakkah: data.hotelMakkah,
            dateReservation: data.reservationDate,
            statut: data.status,
            paiementRecu: data.paidAmount,
            prixEngage: data.price,
            passeport: data.statutPasseport,
            visa: data.statutVisa,
            reservationHotel: data.statutHotel,
            billetAvion: data.statutVol,
            paiements: data.payments?.map((p: any) => ({
              montant: p.amount,
              type: p.paymentMethod,
              date: p.paymentDate,
              recu: p.fichier?.filePath,
              recuType: p.fichier?.fileType,
              recuName: p.fichier?.fileName
            })) || [],
            documents: (data.documents || data.fichiers || []).filter((d: any) => d.fileType !== 'payment').map((d: any) => ({
              type: d.fileType,
              url: d.filePath
            })),
            program: data.program ? {
              name: data.program.name,
              description: data.program.description,
              hotels: data.program.hotels || []
            } : undefined
          });
        })
        .finally(() => setLoading(false));
    }
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement...</div>;
  if (!reservation) return <div className="p-8 text-center text-red-500">Réservation introuvable</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm h-full">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <CardTitle className="text-xl flex items-center gap-3">
                <Sparkles className="h-6 w-6" />
                Détail Réservation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Section 1: Informations Client */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informations Client
                  {reservation.statut === 'Complet' && <CheckCircle className="h-5 w-5 text-green-500" />}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-blue-700 font-medium text-sm">Programme</span>
                    <div className="h-10 border-2 border-blue-200 rounded-lg flex items-center px-3 bg-white">{reservation.programme}</div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-blue-700 font-medium text-sm">Type de chambre</span>
                    <div className="h-10 border-2 border-blue-200 rounded-lg flex items-center px-3 bg-white">{reservation.typeChambre}</div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-blue-700 font-medium text-sm">Nom</span>
                    <div className="h-10 border-2 border-blue-200 rounded-lg flex items-center px-3 bg-white">{reservation.nom}</div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-blue-700 font-medium text-sm">Prénom</span>
                    <div className="h-10 border-2 border-blue-200 rounded-lg flex items-center px-3 bg-white">{reservation.prenom}</div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-blue-700 font-medium text-sm">Téléphone</span>
                    <div className="h-10 border-2 border-blue-200 rounded-lg flex items-center px-3 bg-white">{reservation.telephone}</div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-blue-700 font-medium text-sm">Prix du voyage (DH)</span>
                    <div className="h-10 border-2 border-blue-200 rounded-lg flex items-center px-3 bg-white">{reservation.prix}</div>
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
                    <div className="h-10 border-2 border-green-200 rounded-lg flex items-center px-3 bg-white">{reservation.hotelMadina}</div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-green-700 font-medium text-sm">Hôtel à Makkah</span>
                    <div className="h-10 border-2 border-green-200 rounded-lg flex items-center px-3 bg-white">{reservation.hotelMakkah}</div>
                  </div>
                </div>
              </div>
              {/* Section Paiements détaillés */}
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Paiements
                </h3>
                <div className="space-y-4">
                  {reservation.paiements && reservation.paiements.length > 0 ? reservation.paiements.map((paiement, index) => {
                    const recuUrl = paiement.recu
                      ? paiement.recu.startsWith('http')
                        ? paiement.recu
                        : `${api.url('')}${paiement.recu.startsWith('/') ? paiement.recu : '/' + paiement.recu}`
                      : '';
                    return (
                      <div key={index} className="p-4 border border-orange-200 rounded-lg bg-white/60">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          <div className="md:col-span-3 space-y-2">
                            <span className="text-orange-700 font-medium text-sm">Type de paiement</span>
                            <div className="h-10 border-2 border-orange-200 rounded-lg flex items-center px-3 bg-white">{paiement.type}</div>
                          </div>
                          <div className="md:col-span-3 space-y-2">
                            <span className="text-orange-700 font-medium text-sm">Montant (DH)</span>
                            <div className="h-10 border-2 border-orange-200 rounded-lg flex items-center px-3 bg-white">{paiement.montant?.toLocaleString() || 0} DH</div>
                          </div>
                          <div className="md:col-span-3 space-y-2">
                            <span className="text-orange-700 font-medium text-sm">Date</span>
                            <div className="h-10 border-2 border-orange-200 rounded-lg flex items-center px-3 bg-white">{paiement.date ? new Date(paiement.date).toLocaleDateString() : '-'}</div>
                          </div>
                          <div className="md:col-span-3 space-y-2">
                            <span className="text-orange-700 font-medium text-sm">Reçu</span>
                            {recuUrl ? (
                              recuUrl.endsWith('.pdf') ? (
                                <div className="w-24 h-28 rounded-lg overflow-hidden border-2 border-orange-100 bg-gradient-to-br from-orange-50 to-white flex items-center justify-center cursor-pointer" onClick={() => setPreview({ url: recuUrl, title: paiement.recuName || 'Reçu paiement' })}>
                                  <embed src={`${recuUrl}#toolbar=0&navpanes=0&scrollbar=0`} type="application/pdf" className="w-full h-full" />
                                </div>
                              ) : (
                                <img src={recuUrl} alt={paiement.recuName || 'Reçu paiement'} className="w-20 h-20 object-cover rounded-lg border-2 border-orange-100 cursor-pointer" onClick={() => setPreview({ url: recuUrl, title: paiement.recuName || 'Reçu paiement' })} />
                              )
                            ) : (
                              <span className="text-gray-400">Aucun reçu</span>
                            )}
                            {recuUrl && (
                              <Button variant="ghost" size="icon" className="mt-2 text-orange-600 hover:text-orange-900" onClick={e => { e.stopPropagation(); setPreview({ url: recuUrl, title: paiement.recuName || 'Reçu paiement' }); }}>
                                <ZoomIn className="h-5 w-5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }) : <span className="text-gray-400">Aucun paiement enregistré</span>}
                </div>
              </div>
              {/* Section Documents attachés */}
              <div className="bg-gradient-to-br from-purple-50 via-fuchsia-50 to-white p-6 rounded-2xl border border-purple-200 shadow-lg">
                <h3 className="text-2xl font-bold text-purple-900 mb-6 flex items-center gap-3 tracking-tight">
                  <FileText className="h-7 w-7 text-purple-500" />
                  <span>Documents attachés</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {reservation.documents && reservation.documents.length > 0 ? reservation.documents.map((doc, idx) => {
                    const url = doc.url
                      ? doc.url.startsWith('http')
                        ? doc.url
                        : `${api.url('')}${doc.url.startsWith('/') ? doc.url : '/' + doc.url}`
                      : '';
                    return (
                      <div
                        key={idx}
                        className="group flex flex-col items-center gap-2 bg-white rounded-xl shadow-md border border-purple-100 p-4 transition-transform hover:scale-105 hover:shadow-xl cursor-pointer"
                        onClick={() => url && setPreview({ url, title: doc.type })}
                      >
                        <span className="text-xs font-semibold text-purple-700 mb-1 uppercase tracking-wide group-hover:text-purple-900 transition-colors">{doc.type}</span>
                        {url ? (url.endsWith('.pdf') ? (
                          <div className="w-28 h-36 rounded-lg overflow-hidden border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-white flex items-center justify-center group-hover:border-purple-400">
                            <embed src={`${url}#toolbar=0&navpanes=0&scrollbar=0`} type="application/pdf" className="w-full h-full" />
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt={doc.type}
                            className="w-24 h-24 object-cover rounded-lg border-2 border-purple-100 group-hover:border-purple-400 shadow-sm transition-all"
                          />
                        )) : <span className="text-gray-400">Aucun fichier</span>}
                        <Button variant="ghost" size="icon" className="mt-2 text-purple-600 group-hover:text-purple-900" onClick={e => { e.stopPropagation(); setPreview({ url, title: doc.type }); }}>
                          <ZoomIn className="h-5 w-5" />
                        </Button>
                      </div>
                    );
                  }) : <span className="text-gray-400 col-span-full">Aucun document attaché</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Modal de prévisualisation */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-lg p-4 max-w-2xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center w-full mb-2">
              <span className="font-semibold text-blue-800">{preview.title}</span>
              <Button variant="ghost" size="icon" onClick={() => setPreview(null)}><span className="text-xl">×</span></Button>
            </div>
            {preview.url.endsWith('.pdf') ? (
              <embed src={`${preview.url}#toolbar=0&navpanes=0&scrollbar=0`} type="application/pdf" className="max-w-full max-h-[70vh] object-contain" />
            ) : (
              <img src={preview.url} alt={preview.title} className="max-w-full max-h-[70vh] object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
} 