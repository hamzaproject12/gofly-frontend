"use client"

import { useState, useRef, useMemo, useEffect } from "react"
import { Loader2 } from "lucide-react"
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
  Leaf,
  ShieldCheck,
  Crown,
  Download,
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

// Custom Hook: Blob Proxy for PDF Display
// Fetches PDF from Cloudinary and creates a blob with correct MIME type to force display
// Implements smart retry: tries exact URL first, then with .pdf extension if 404
const usePdfBlob = (url: string | null | undefined) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when URL changes
    setBlobUrl(null);
    setError(null);
    
    // Skip if no URL or if it's already a blob/data URL
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) {
      setBlobUrl(url || null);
      return;
    }

    // Skip if not a Cloudinary URL (for local files, use as-is)
    if (!url.includes('cloudinary.com')) {
      setBlobUrl(url);
      return;
    }

    // Smart fetch with retry mechanism
    let objectUrl: string | null = null;
    let isCancelled = false;
    
    const fetchPdf = async () => {
      setLoading(true);
      setError(null);

      try {
        // Attempt 1: Try exact URL first (most likely for files without extension)
        let response = await fetch(url);
        
        // Attempt 2: If 404 and URL doesn't already end with .pdf, try with .pdf extension
        if (!response.ok && response.status === 404 && !url.toLowerCase().endsWith('.pdf')) {
          console.log('🔄 Retrying PDF fetch with .pdf extension...');
          const urlWithExtension = `${url}.pdf`;
          response = await fetch(urlWithExtension);
        }

        // If still not ok, throw error
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }

        // Check if cancelled before processing
        if (isCancelled) return;

        const blob = await response.blob();
        // Force the MIME type to application/pdf
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(pdfBlob);
        
        if (!isCancelled) {
          setBlobUrl(objectUrl);
          setLoading(false);
        } else {
          // Cleanup if cancelled
          URL.revokeObjectURL(objectUrl);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('❌ Error fetching PDF blob:', err);
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
          setLoading(false);
          // Fallback to original URL (let browser handle it)
          setBlobUrl(url);
        }
      }
    };

    fetchPdf();

    // Cleanup function
    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  return { blobUrl, loading, error };
};

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
  date: string;
  recu: string | null;
  recuFileName?: string; // Nom du fichier pour détecter les PDFs
  receiptFileId?: number | null;
  id?: number; // ID optionnel pour identifier les paiements existants
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

const planThemesModifier = {
  Économique: { name: "Économique", icon: Leaf },
  Normal: { name: "Normal", icon: ShieldCheck },
  VIP: { name: "VIP", icon: Crown },
} as const;

const ROOM_CAPACITY_EDIT: Record<string, number> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  QUAD: 4,
  QUINT: 5,
};

type FormData = {
  programme: string;
  typeChambre: string;
  nom: string;
  prenom: string;
  telephone: string;
  passportNumber: string;
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

// PDF Preview Box Component with Blob Proxy (for inline preview)
const PdfPreviewBox = ({ url, title, onZoom }: { url: string | null; title: string; onZoom: () => void }) => {
  const { blobUrl, loading, error } = usePdfBlob(url);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <span className="text-sm text-gray-600">Chargement du PDF...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-2 text-red-600">
          <FileText className="h-8 w-8" />
          <span className="text-sm">Erreur de chargement</span>
        </div>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
        Aucun fichier
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <iframe
        src={blobUrl}
        className="w-full h-full border-0"
        title={title}
      />
      {/* Overlay cliquable pour ouvrir dans le modal */}
      <div 
        className="absolute inset-0 bg-transparent hover:bg-black/5 cursor-pointer transition-colors flex items-center justify-center opacity-0 hover:opacity-100"
        onClick={onZoom}
      >
        <div className="bg-white/90 rounded-lg p-2 shadow-lg">
          <ZoomIn className="h-5 w-5 text-blue-600" />
        </div>
      </div>
    </div>
  );
};

// PDF Preview Modal Component with Blob Proxy (for full-screen modal)
const PdfPreviewModal = ({ url, title }: { url: string; title: string }) => {
  const { blobUrl, loading, error } = usePdfBlob(url);

  if (loading) {
    return (
      <div className="w-full h-[calc(80vh-100px)] flex items-center justify-center bg-gray-50 border rounded-lg">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
          <span className="text-base text-gray-600">Chargement du PDF...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[calc(80vh-100px)] flex items-center justify-center bg-gray-50 border rounded-lg">
        <div className="flex flex-col items-center gap-4 text-red-600">
          <FileText className="h-16 w-16" />
          <div className="text-center">
            <p className="text-base font-medium">Erreur de chargement</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="w-full h-[calc(80vh-100px)] flex items-center justify-center bg-gray-100 text-gray-400 border rounded-lg">
        Aucun fichier disponible
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(80vh-100px)] border rounded-lg overflow-hidden">
      <iframe
        src={blobUrl}
        className="w-full h-full border-0"
        title={title}
      />
    </div>
  );
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
  const [customization, setCustomization] = useState({
    includeAvion: true,
    includeVisa: true,
    joursMadina: 0,
    joursMakkah: 0,
  })
  const [memberPassportFiles, setMemberPassportFiles] = useState<Record<number, File | null>>({})
  const [memberPassportDelete, setMemberPassportDelete] = useState<Record<number, number | null>>({})
  const [paymentReceiptsToDelete, setPaymentReceiptsToDelete] = useState<Record<number, number>>({})
  
  const [formData, setFormData] = useState<FormData & { groupe: string; remarque: string; transport: boolean }>({
    programme: "",
    typeChambre: "",
    nom: "",
    prenom: "",
    telephone: "",
    passportNumber: "",
    groupe: "",
    remarque: "",
    transport: false,
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

  // État pour stocker les valeurs initiales (pour détecter les changements)
  const [initialData, setInitialData] = useState<any>(null)

  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [previews, setPreviews] = useState<{ [key: string]: { url: string, type: string } }>({})
  const [reservationData, setReservationData] = useState<any>(null)
  const [accompagnants, setAccompagnants] = useState<
    Array<{
      id: number;
      firstName: string;
      lastName: string;
      phone: string;
      passportNumber: string | null;
      documents?: any[];
      payments?: any[];
    }>
  >([])
  const [passportToDelete, setPassportToDelete] = useState<number | null>(null) // ID du fichier passeport à supprimer
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

  const paymentDocuments = documents.payment;

  const parseAmount = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return 0;
    const raw = typeof value === "number" ? value : value.trim();
    if (typeof raw === "number") return raw;
    if (raw === "") return 0;
    const normalized = raw.replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

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
          setReservationData(reservationData)
          setAccompagnants((reservationData.accompagnants || []).map((a: any) => ({
            id: a.id,
            firstName: a.firstName || '',
            lastName: a.lastName || '',
            phone: a.phone || '',
            passportNumber: a.passportNumber || '',
            documents: a.documents || [],
            payments: a.payments || [],
          })))
          
          const initialFormData = {
            programme: reservationData.program?.name || "",
            typeChambre: reservationData.roomType || "",
            nom: reservationData.lastName || "",
            prenom: reservationData.firstName || "",
            telephone: reservationData.phone || "",
            passportNumber: reservationData.passportNumber || "",
            groupe: reservationData.groupe || "",
            remarque: reservationData.remarque || "",
            transport: reservationData.transport === 'Oui' || reservationData.transport === true,
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
          }
          
          console.log('📋 Données initiales chargées:', {
            statutVisa: reservationData.statutVisa,
            statutVol: reservationData.statutVol,
            statutHotel: reservationData.statutHotel,
            initialFormData
          })
          
          setFormData(initialFormData)
          // Stocker les données initiales complètes (formulaire + réservation)
          setInitialData({
            ...reservationData,
            formData: initialFormData
          })

          // Charger les paiements existants
          const initialPaiements = (reservationData.payments || []).map((p: any) => {
            const recuUrl = p.fichier?.cloudinaryUrl || p.fichier?.filePath || '';
            const recuFileName = p.fichier?.fileName || '';
            
            // Si on a un reçu, charger aussi dans previews pour la détection PDF correcte
            if (recuUrl && p.id) {
              const isPdf = isPdfFile(recuFileName || recuUrl);
              setPreviews(prev => ({
                ...prev,
                [`payment_existing_${p.id}`]: {
                  url: recuUrl,
                  type: isPdf ? 'application/pdf' : 'image/*'
                }
              }));
            }
            
            return {
              montant: p.amount?.toString() || '',
              type: p.paymentMethod || '',
              date: p.paymentDate?.split('T')[0] || '',
              recu: recuUrl,
              recuFileName: recuFileName, // Garder le fileName pour la détection PDF
              receiptFileId: p.fichier?.id ?? null,
              id: p.id // Garder l'ID pour identifier les paiements existants
            };
          })
          setPaiements(initialPaiements)
          setDocuments((prev) => ({
            ...prev,
            payment: initialPaiements.map(() => null),
          }))

          // Charger les documents existants
          const docObj: any = {}
          ;(reservationData.documents || reservationData.fichiers || []).forEach((d: any) => {
            console.log('🔍 Debug - Document found:', {
              fileType: d.fileType,
              cloudinaryUrl: d.cloudinaryUrl,
              filePath: d.filePath,
              fileName: d.fileName
            });
            
            docObj[d.fileType] = { 
              url: d.cloudinaryUrl || d.filePath, 
              type: d.fileType,
              fileName: d.fileName 
            }
          })
          
          // Set previews pour les documents existants
        Object.entries(docObj).forEach(([type, doc]: any) => {
            if (doc.url) {
              const isPdf = isPdfFile(doc.fileName || doc.url);
              
              // Normaliser les types pour la cohérence 
              const normalizedType = type === 'passeport' ? 'passport' : 
                                   type === 'paiement' ? 'payment' : type;
              
              // DO NOT modify the URL - use it exactly as it comes from the database
              // The usePdfBlob hook will handle the smart retry logic (try exact URL, then with .pdf if 404)
              console.log('🔍 Debug - Setting preview for:', {
                type,
                url: doc.url,
                fileName: doc.fileName,
                isPdf: isPdf
              });
              
              setPreviews(prev => ({ 
                ...prev, 
                [normalizedType]: { 
                  url: doc.url, // Use original URL exactly as stored
                  type: isPdf ? 'application/pdf' : 'image/*' 
                }
              }))
            }
          })

          // Charger seulement le programme de cette réservation
          if (reservationData.programId) {
            const programResponse = await fetch(api.url(`/api/programs/${reservationData.programId}`))
            const programData = await programResponse.json()
            console.log('🔍 Debug - Program loaded:', {
              id: programData.id,
              name: programData.name,
              hotelsMadina: programData.hotelsMadina?.length,
              hotelsMakkah: programData.hotelsMakkah?.length
            })
            setPrograms([programData]) // Un seul programme dans le tableau
            setCustomization((c) => ({
              ...c,
              joursMadina: programData.nbJoursMadina ?? c.joursMadina,
              joursMakkah: programData.nbJoursMakkah ?? c.joursMakkah,
            }))
          }

          ;(reservationData.accompagnants || []).forEach((a: any) => {
            const passDoc = (a.documents || []).find((d: any) =>
              ["passeport", "passport"].includes(d.fileType)
            );
            if (passDoc?.cloudinaryUrl || passDoc?.filePath) {
              const url = passDoc.cloudinaryUrl || passDoc.filePath;
              const fn = passDoc.fileName || url;
              const lower = typeof fn === "string" ? fn.toLowerCase() : "";
              const isPdf =
                lower.includes(".pdf") ||
                (typeof url === "string" && /\.pdf(\?|$|#)/i.test(url));
              setPreviews((prev) => ({
                ...prev,
                [`member_passport_${a.id}`]: {
                  url,
                  type: isPdf ? "application/pdf" : "image/*",
                },
              }));
            }
          });
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

    if (!arePaymentsValid) {
      toast({
        title: "Paiement incomplet",
        description: "Merci de renseigner le mode, le montant, la date et le reçu pour chaque paiement ajouté.",
        variant: "destructive",
      })
      return;
    }

    setIsSubmitting(true)

    try {
      const fileUploadErrors: string[] = []
      
      // 1. Créer les nouveaux paiements d'abord (pour que le paidAmount soit calculé correctement)
      const newPaymentIds: number[] = []
      if (reservationId) {
        for (let i = 0; i < paiements.length; i++) {
          const paiement = paiements[i];
          // Si le paiement n'a pas d'ID, c'est un nouveau paiement
          if (!paiement.id && paiement.montant && paiement.type && paiement.date) {
            console.log(`💰 Création nouveau paiement ${i + 1}:`, {
              montant: paiement.montant,
              type: paiement.type,
              date: paiement.date
            })

            const paymentBody = {
              reservationId: Number(reservationId),
              amount: parseFloat(paiement.montant),
              type: paiement.type,
              programId: reservationData.programId,
            }

            const paymentResponse = await fetch(api.url('/api/payments'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(paymentBody)
            })

            if (!paymentResponse.ok) {
              const error = await paymentResponse.json()
              console.error('❌ Erreur création paiement:', error)
              fileUploadErrors.push(`Erreur lors de l'ajout du paiement ${i + 1}`)
            } else {
              const paymentData = await paymentResponse.json()
              const newPaymentId = paymentData.id
              newPaymentIds.push(newPaymentId)
              
              console.log('✅ Paiement créé avec ID:', newPaymentId)
              
              // Upload le reçu si présent et le lier au paiement
              if (documents.payment[i]) {
                console.log(`📤 Upload reçu pour paiement ID ${newPaymentId}...`)
                const formDataPayment = new FormData();
                formDataPayment.append("file", documents.payment[i] as File);
                formDataPayment.append("reservationId", reservationId.toString());
                formDataPayment.append("paymentId", newPaymentId.toString());
                formDataPayment.append("fileType", "payment");

                const receiptResponse = await fetch(api.url(api.endpoints.uploadCloudinary), {
                  method: "POST",
                  body: formDataPayment,
                });
                
                if (!receiptResponse.ok) {
                  const error = await receiptResponse.json();
                  console.error('❌ Erreur upload reçu:', error)
                  fileUploadErrors.push(`Erreur lors de l'upload du reçu de paiement ${i + 1}: ${error.error || 'Erreur inconnue'}`);
                } else {
                  console.log('✅ Reçu uploadé et lié au paiement')
                }
              }
            }
          }
        }
      }

      // 2. Maintenant mettre à jour les informations de la réservation (avec le paidAmount recalculé)
      // Vérifier si un nouveau passeport est uploadé OU si un passeport existe déjà (et n'est pas marqué pour suppression)
      const hasNewPassport = documents.passport !== null;
      const hasExistingPassport = getDocumentUrl('passport') !== null && passportToDelete === null;
      const shouldUpdateStatutPasseport = hasNewPassport || hasExistingPassport;
      
      // Vérifier si la réservation est complète pour mettre le statut à "Complet"
      const isPassportAttached = shouldUpdateStatutPasseport;
      const isVisaComplete = formData.statutVisa;
      const isHotelComplete = formData.statutHotel;
      const isFlightComplete = formData.statutVol;
      
      // Le paidAmount sera recalculé côté backend avec tous les paiements (existants + nouveaux)
      const isPaymentComplete = (reservationData.paidAmount + newPaymentIds.reduce((sum, id) => sum + parseFloat(paiements.find(p => !p.id)?.montant || '0'), 0)) >= parseFloat(formData.prix);
      
      const isReservationComplete = isPassportAttached && 
                                   isVisaComplete && 
                                   isHotelComplete && 
                                   isFlightComplete && 
                                   isPaymentComplete;
      
      console.log('📊 Vérification statut complet:', {
        isPassportAttached,
        isVisaComplete,
        isHotelComplete,
        isFlightComplete,
        isPaymentComplete,
        paidAmount: reservationData.paidAmount,
        newPaymentsCount: newPaymentIds.length,
        price: parseFloat(formData.prix),
        isReservationComplete
      });
      
      const body = {
        price: parseFloat(formData.prix),
        reservationDate: formData.dateReservation,
        statutVisa: formData.statutVisa,
        statutHotel: formData.statutHotel,
        statutVol: formData.statutVol,
        statutPasseport: shouldUpdateStatutPasseport,
        passportNumber: formData.passportNumber || null,
        groupe: formData.groupe || null,
        remarque: formData.remarque || null,
        transport: formData.transport ? 'Oui' : null,
        // Mettre à jour le statut global si toutes les conditions sont remplies
        ...(isReservationComplete && { status: 'Complet' })
      }

      console.log('📝 Mise à jour réservation:', {
        reservationId,
        url: api.url(`/api/reservations/${reservationId}`),
        body,
        hasNewPassport,
        bodyJSON: JSON.stringify(body)
      })

      const response = await api.request(`/api/reservations/${reservationId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })

      console.log('📥 Réponse PUT:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }))
        console.error('❌ Erreur PUT:', errorData)
        throw new Error(`Erreur lors de la modification de la réservation: ${errorData.error || response.statusText}`)
      }

      const responseData = await response.json()
      console.log('✅ Réponse PUT succès:', responseData)

      // 3. Supprimer l'ancien passeport si on a un nouveau ou si on a marqué pour suppression
      const fileIdToDelete = passportToDelete || (documents.passport ? getPassportFileId() : null);
      if (fileIdToDelete !== null) {
        console.log('🗑️ Suppression de l\'ancien passeport...')
        try {
          const deleteResponse = await fetch(api.url(`${api.endpoints.uploadCloudinary}/${fileIdToDelete}`), {
            method: "DELETE",
          });
          
          if (!deleteResponse.ok) {
            const error = await deleteResponse.json().catch(() => ({ error: 'Erreur inconnue' }));
            console.error('⚠️ Erreur suppression ancien passeport:', error);
            fileUploadErrors.push(`Erreur lors de la suppression de l'ancien passeport: ${error.error || 'Erreur inconnue'}`);
          } else {
            console.log('✅ Ancien passeport supprimé avec succès');
          }
        } catch (error) {
          console.error('❌ Erreur lors de la suppression de l\'ancien passeport:', error);
          fileUploadErrors.push('Erreur lors de la suppression de l\'ancien passeport');
        }
      }

      // 4. Upload nouveau passeport si présent
      if (documents.passport && reservationId) {
        console.log('📤 Upload nouveau passeport vers Cloudinary...')
        const formDataPassport = new FormData();
        formDataPassport.append("file", documents.passport);
        formDataPassport.append("reservationId", reservationId.toString());
        formDataPassport.append("fileType", "passport");

        const passportResponse = await fetch(api.url(api.endpoints.uploadCloudinary), {
          method: "POST",
          body: formDataPassport,
        });
        
        if (!passportResponse.ok) {
          const error = await passportResponse.json();
          fileUploadErrors.push(`Erreur lors de l'upload du nouveau passeport: ${error.error || 'Erreur inconnue'}`);
        } else {
          console.log('✅ Nouveau passeport uploadé avec succès')
        }
      }

      // 5. Supprimer les reçus marqués pour suppression
      if (reservationId) {
        for (let i = 0; i < paiements.length; i++) {
          const paiement = paiements[i];
          if (!paiement.id) continue;
          const fileIdToDelete = paymentReceiptsToDelete[paiement.id];
          if (!fileIdToDelete || documents.payment[i]) continue;
          try {
            const delRes = await fetch(api.url(`${api.endpoints.uploadCloudinary}/${fileIdToDelete}`), {
              method: "DELETE",
            });
            if (!delRes.ok) {
              const error = await delRes.json().catch(() => ({ error: "Erreur inconnue" }));
              fileUploadErrors.push(`Erreur suppression reçu paiement ${i + 1}: ${error.error || "Erreur inconnue"}`);
            }
          } catch {
            fileUploadErrors.push(`Erreur suppression reçu paiement ${i + 1}`);
          }
        }
      }

      // 6. Gérer les remplacements de reçus pour les paiements existants
      if (reservationId) {
        for (let i = 0; i < paiements.length; i++) {
          const paiement = paiements[i];
          // Si le paiement a un ID (existant) ET qu'un nouveau fichier a été uploadé
          if (paiement.id && documents.payment[i]) {
            console.log(`📤 Remplacement du reçu pour paiement existant ID ${paiement.id}...`)
            
            // Récupérer l'ancien fichier pour le supprimer
            const existingPayment = reservationData?.payments?.find((p: any) => p.id === paiement.id);
            const existingFileId = paymentReceiptsToDelete[paiement.id] || existingPayment?.fichier?.id || paiement.receiptFileId;
            if (existingFileId) {
              console.log(`🗑️ Suppression de l'ancien reçu (fichier ID: ${existingFileId})...`)
              try {
                const deleteResponse = await fetch(api.url(`${api.endpoints.uploadCloudinary}/${existingFileId}`), {
                  method: "DELETE",
                });
                
                if (!deleteResponse.ok) {
                  const error = await deleteResponse.json().catch(() => ({ error: 'Erreur inconnue' }));
                  console.error('⚠️ Erreur suppression ancien reçu:', error);
                  fileUploadErrors.push(`Erreur lors de la suppression de l'ancien reçu: ${error.error || 'Erreur inconnue'}`);
                } else {
                  console.log('✅ Ancien reçu supprimé avec succès');
                }
              } catch (error) {
                console.error('❌ Erreur lors de la suppression de l\'ancien reçu:', error);
                fileUploadErrors.push('Erreur lors de la suppression de l\'ancien reçu');
              }
            }
            
            // Upload le nouveau reçu et le lier au paiement existant
            const formDataPayment = new FormData();
            formDataPayment.append("file", documents.payment[i] as File);
            formDataPayment.append("reservationId", reservationId.toString());
            formDataPayment.append("paymentId", paiement.id.toString());
            formDataPayment.append("fileType", "payment");

            try {
              const receiptResponse = await fetch(api.url(api.endpoints.uploadCloudinary), {
                method: "POST",
                body: formDataPayment,
              });
              
              if (!receiptResponse.ok) {
                const error = await receiptResponse.json();
                console.error('❌ Erreur upload nouveau reçu:', error)
                fileUploadErrors.push(`Erreur lors de l'upload du nouveau reçu pour le paiement ${i + 1}: ${error.error || 'Erreur inconnue'}`);
              } else {
                console.log('✅ Nouveau reçu uploadé et lié au paiement existant')
              }
            } catch (error) {
              console.error('❌ Erreur lors de l\'upload du nouveau reçu:', error);
              fileUploadErrors.push(`Erreur lors de l'upload du nouveau reçu pour le paiement ${i + 1}`);
            }
          }
        }
      }


      if (fileUploadErrors.length > 0) {
        toast({
          title: "Avertissement",
          description: `Réservation modifiée mais avec des erreurs: ${fileUploadErrors.join(', ')}`,
          variant: "destructive"
        })
      } else {
        toast({
          title: "Succès",
          description: "Réservation modifiée avec succès",
        })
      }

      // Si c'est un dossier leader, appliquer les mises à jour des accompagnants + fichiers passeport
      if (reservationData?.isLeader && accompagnants.length > 0) {
        for (const a of accompagnants) {
          const delMemberPass = memberPassportDelete[a.id];
          if (delMemberPass != null) {
            try {
              const delRes = await fetch(
                api.url(`${api.endpoints.uploadCloudinary}/${delMemberPass}`),
                { method: "DELETE" }
              );
              if (!delRes.ok) {
                fileUploadErrors.push(`Suppression passeport accompagnant ${a.id} impossible`);
              }
            } catch {
              fileUploadErrors.push(`Erreur suppression ancien passeport accompagnant`);
            }
          }

          const newPassFile = memberPassportFiles[a.id];
          if (newPassFile) {
            const fd = new FormData();
            fd.append("file", newPassFile);
            fd.append("reservationId", String(a.id));
            fd.append("fileType", "passport");
            const up = await fetch(api.url(api.endpoints.uploadCloudinary), {
              method: "POST",
              body: fd,
            });
            if (!up.ok) {
              const err = await up.json().catch(() => ({}));
              fileUploadErrors.push(
                `Upload passeport accompagnant: ${err.error || up.statusText}`
              );
            }
          }

          const existingPassDoc = (a.documents || []).find((d: any) =>
            ["passport", "passeport"].includes(d.fileType)
          );
          const statutPasseportMember =
            (!!existingPassDoc && delMemberPass == null) || !!newPassFile;
          const memberRes = await api.request(`/api/reservations/${a.id}`, {
            method: "PUT",
            body: JSON.stringify({
              firstName: a.firstName,
              lastName: a.lastName,
              phone: a.phone,
              passportNumber: a.passportNumber || null,
              reservationDate: formData.dateReservation,
              statutPasseport: statutPasseportMember,
            }),
          });
          if (!memberRes.ok) {
            console.warn(`Echec mise à jour accompagnant ${a.id}`);
          }
        }
      }
      
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

  const handlePaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(file.type === 'application/pdf' || file.type.startsWith('image/'))) {
      toast({
        title: "Erreur",
        description: "Format de fichier non supporté. Seuls les fichiers PDF et images sont acceptés.",
        variant: "destructive",
      });
      return;
    }
    
    if (paiements[index]?.id) {
      setPaymentReceiptsToDelete((prev) => {
        const next = { ...prev };
        delete next[paiements[index].id as number];
        return next;
      });
    }

    // Stocker le fichier localement pour l'aperçu
    setDocuments(prev => {
      const newPayments = [...(prev.payment || [])];
      newPayments[index] = file;
      return { ...prev, payment: newPayments };
    });
    mettreAJourPaiement(index, 'recu', file.name);
    
    // Créer l'aperçu local
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => ({
      ...prev,
          [`payment_${index}`]: { url: reader.result as string, type: file.type }
    }));
  };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      setPreviews(prev => ({
        ...prev,
        [`payment_${index}`]: { url: URL.createObjectURL(file), type: file.type }
      }));
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

  const getMemberPassportFileId = (a: (typeof accompagnants)[0]) => {
    const d = (a.documents || []).find((x: any) =>
      ["passport", "passeport"].includes(x.fileType)
    );
    return d?.id ?? null;
  };

  const handleMemberPassportChange = (
    memberId: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(file.type === "application/pdf" || file.type.startsWith("image/"))) {
      toast({
        title: "Erreur",
        description: "PDF ou image uniquement.",
        variant: "destructive",
      });
      return;
    }
    setMemberPassportFiles((prev) => ({ ...prev, [memberId]: file }));
    setMemberPassportDelete((prev) => ({ ...prev, [memberId]: null }));
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((p) => ({
          ...p,
          [`member_passport_${memberId}`]: {
            url: reader.result as string,
            type: file.type,
          },
        }));
      };
      reader.readAsDataURL(file);
    } else {
      setPreviews((p) => ({
        ...p,
        [`member_passport_${memberId}`]: {
          url: URL.createObjectURL(file),
          type: file.type,
        },
      }));
    }
  };

  const mettreAJourPaiement = <K extends keyof Paiement>(index: number, field: K, value: Paiement[K]) => {
    setPaiements(prev => {
      const totalPrice = parseAmount(formData.prix);

      return prev.map((p, i) => {
        if (i !== index) return p;

        if (field === 'montant') {
          const rawValue = typeof value === "string" ? value : value?.toString() ?? "";
          if (rawValue === "") {
            return { ...p, montant: "" };
          }

          let numericValue = parseAmount(rawValue);
          if (numericValue < 0) numericValue = 0;

          const sumOther = prev.reduce((sum, paiement, idx) => {
            if (idx === index) return sum;
            return sum + parseAmount(paiement.montant);
          }, 0);

          const allowedMax = Math.max(totalPrice - sumOther, 0);
          const clamped = Math.min(numericValue, allowedMax);

          const formatted = Number.isFinite(clamped) ? clamped : 0;
          return { ...p, montant: formatted.toString() };
        }

        if (field === 'recu') {
          const recuValue = typeof value === "string" ? value : (value ?? null);
          return { ...p, recu: recuValue as string | null };
        }

        return { ...p, [field]: value } as Paiement;
      });
    })
  }

  const ajouterPaiement = () => {
    // Ajouter un nouveau paiement avec la date actuelle
    const today = new Date().toISOString().split('T')[0]
    setPaiements([...paiements, { montant: '', type: '', date: today, recu: '' }])
    setDocuments(prev => ({
      ...prev,
      payment: [...(prev.payment || []), null]
    }))
  }

  const supprimerPaiement = (index: number) => {
    setPaiements(prev => prev.filter((_, i) => i !== index))
    setDocuments(prev => {
      const newPayments = [...(prev.payment || [])]
      newPayments.splice(index, 1)
      return { ...prev, payment: newPayments }
    })
    setPreviews(prev => {
      const newPreviews = { ...prev }
      delete newPreviews[`payment_${index}`]
      return newPreviews
    })
  }

  // Helper function pour vérifier si un fichier/URL est un PDF (case-insensitive)
  const isPdfFile = (fileNameOrUrl: string | null | undefined): boolean => {
    if (!fileNameOrUrl || typeof fileNameOrUrl !== 'string') return false;
    const lower = fileNameOrUrl.toLowerCase();
    return lower.includes('.pdf') || lower.endsWith('.pdf') || /\.pdf(\?|$|#)/i.test(fileNameOrUrl);
  };

  // Fonction pour corriger l'URL Cloudinary pour les PDFs
  // Ajoute l'extension .pdf si manquante pour forcer le bon Content-Type
  const fixCloudinaryUrlForPdf = (url: string | null, fileName?: string | null): string | null => {
    if (!url || typeof url !== 'string') return url;
    
    // Si ce n'est pas une URL Cloudinary, retourner telle quelle
    if (!url.includes('cloudinary.com')) return url;
    
    // Vérifier si c'est un PDF (par l'URL ou le nom de fichier)
    const isPdf = isPdfFile(fileName || url);
    
    if (!isPdf) return url;
    
    // Si l'URL se termine déjà par .pdf, retourner telle quelle
    if (url.toLowerCase().endsWith('.pdf') || url.match(/\.pdf(\?|$|#)/i)) {
      return url;
    }
    
    // Pour les URLs Cloudinary raw/upload, ajouter .pdf à la fin pour forcer le Content-Type
    if (url.includes('/raw/upload/')) {
      // Extraire la partie avant les paramètres de requête/ancre
      const urlParts = url.split(/[?#]/);
      const baseUrl = urlParts[0];
      const queryAndHash = urlParts.slice(1).join('');
      
      // Ajouter .pdf avant les paramètres de requête/ancre
      return baseUrl + '.pdf' + (queryAndHash ? (url.includes('?') ? '?' : '#') + queryAndHash : '');
    }
    
    // Pour les autres types d'URLs Cloudinary, retourner telle quelle
    return url;
  };

  // Helper function pour obtenir l'URL d'un document
  const getDocumentUrl = (type: string) => {
    // Si on a un nouveau fichier dans previews, l'utiliser
    if (previews[type]) {
      return previews[type].url;
    }
    
    // Si on a marqué le passeport pour suppression, ne pas afficher l'ancien
    if (type === 'passport' && passportToDelete !== null) {
      return null;
    }
    
    // Ensuite vérifier dans les documents existants de la réservation
    // Gérer les variations de types (passport/passeport, payment/paiement)
    const typeVariations = type === 'passport' ? ['passport', 'passeport'] : 
                          type === 'payment' ? ['payment', 'paiement'] : [type];
    
    const existingDoc = (reservationData.documents || reservationData.fichiers || []).find((d: any) => 
      typeVariations.includes(d.fileType)
    );
    
    if (existingDoc) {
      let url = existingDoc.cloudinaryUrl || existingDoc.filePath;
      
      // Pour les PDFs, garder l'URL telle quelle car Cloudinary peut servir les PDFs
      // depuis /image/upload/ si c'est là qu'ils ont été stockés
      // Ne pas essayer de corriger car cela peut causer des 404
      return url;
    }
    
    return null;
  }

  // Helper function pour obtenir l'ID du fichier passeport existant
  const getPassportFileId = (): number | null => {
    if (passportToDelete !== null) return passportToDelete;
    
    const existingDoc = (reservationData.documents || reservationData.fichiers || []).find((d: any) => 
      ['passport', 'passeport'].includes(d.fileType)
    );
    
    return existingDoc?.id || null;
  }

  // Helper function pour obtenir le type d'un document
  const getDocumentType = (type: string) => {
    // D'abord vérifier dans previews
    if (previews[type]) {
      return previews[type].type;
    }
    
    // Ensuite vérifier dans les documents existants
    // Gérer les variations de types (passport/passeport, payment/paiement)
    const typeVariations = type === 'passport' ? ['passport', 'passeport'] : 
                          type === 'payment' ? ['payment', 'paiement'] : [type];
    
    const existingDoc = (reservationData.documents || reservationData.fichiers || []).find((d: any) => 
      typeVariations.includes(d.fileType)
    );
    
    if (existingDoc) {
      return isPdfFile(existingDoc.fileName || existingDoc.cloudinaryUrl || existingDoc.filePath) ? 'application/pdf' : 'image/*';
    }
    
    return 'image/*';
  }

  // Helper function pour obtenir le nom d'un hôtel par son ID
  const getHotelName = (hotelId: string, city: 'madina' | 'makkah') => {
    console.log('🔍 getHotelName called:', { hotelId, city, programId: formData.programId, programsCount: programs.length });
    
    if (!hotelId || hotelId === 'none') return 'Sans hôtel';
    if (!formData.programId || programs.length === 0) {
      console.log('⚠️ No program loaded yet');
      return 'Chargement...';
    }
    
    const program = programs.find(p => p.id === parseInt(formData.programId));
    console.log('🔍 Program found:', program?.id, program?.name);
    
    if (!program) {
      console.log('⚠️ Program not found in programs array');
      return 'Chargement...';
    }
    
    const hotelsList = city === 'madina' ? program.hotelsMadina : program.hotelsMakkah;
    console.log('🔍 Hotels list:', { city, count: hotelsList?.length, hotelsList });
    
    const hotelRelation = hotelsList?.find((ph: { hotel: Hotel }) => ph.hotel.id.toString() === hotelId);
    console.log('🔍 Hotel relation found:', hotelRelation);
    
    if (!hotelRelation) {
      console.log('⚠️ Hotel not found with ID:', hotelId);
      return `Hôtel ID ${hotelId}`;
    }
    
    return hotelRelation.hotel.name;
  }

  const programDetail = programs[0] as
    | {
        rooms?: any[];
        hotelsMadina?: Array<{ hotel: Hotel }>;
        hotelsMakkah?: Array<{ hotel: Hotel }>;
        nbJoursMadina?: number;
        nbJoursMakkah?: number;
        exchange?: number;
        prixAvionDH?: number;
        prixVisaRiyal?: number;
        profit?: number;
        profitEconomique?: number;
        profitNormal?: number;
        profitVIP?: number;
      }
    | undefined;

  const resolveHotelId = (raw: string, city: "madina" | "makkah") => {
    if (!raw || raw === "none") return null;
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && String(n) === String(raw).trim()) return n;
    const list =
      city === "madina"
        ? programDetail?.hotelsMadina
        : programDetail?.hotelsMakkah;
    const found = list?.find((ph: { hotel: Hotel }) => ph.hotel?.name === raw);
    return found?.hotel?.id ?? null;
  };

  const sortRoomsByAlgorithm = (rooms: any[], selectedGender: string) => {
    return [...rooms].sort((a, b) => {
      const aIsSameGender = a.gender === selectedGender;
      const bIsSameGender = b.gender === selectedGender;
      if (aIsSameGender && !bIsSameGender) return -1;
      if (!aIsSameGender && bIsSameGender) return 1;
      const aOccupied = a.nbrPlaceTotal - a.nbrPlaceRestantes;
      const bOccupied = b.nbrPlaceTotal - b.nbrPlaceRestantes;
      if (aOccupied > 0 && bOccupied === 0) return -1;
      if (aOccupied === 0 && bOccupied > 0) return 1;
      if (aOccupied > 0 && bOccupied > 0) {
        return bOccupied - aOccupied;
      }
      if (aOccupied === 0 && bOccupied === 0) {
        return b.nbrPlaceRestantes - a.nbrPlaceRestantes;
      }
      return 0;
    });
  };

  const groupReservationIds = useMemo(() => {
    const ids: number[] = [Number(reservationId)];
    accompagnants.forEach((a) => ids.push(a.id));
    return ids;
  }, [reservationId, accompagnants]);

  const getGenderIconRoom = (gender: string) => {
    switch (gender) {
      case "Homme":
        return "👨";
      case "Femme":
        return "👩";
      case "Mixte":
        return "👥";
      default:
        return "👥";
    }
  };

  // Calculs de progression
  const section1Complete = formData.nom && formData.prenom && formData.telephone && formData.typeChambre && formData.prix && formData.gender
  const section2Complete = formData.programId && formData.hotelMadina && formData.hotelMakkah
  const arePaymentsValid = useMemo(() => {
    if (paiements.length === 0) {
      return true;
    }

    return paiements.every((paiement, index) => {
      // Si c'est un paiement existant (avec ID), il est déjà valide
      if (paiement.id) {
        return true;
      }
      
      // Pour les nouveaux paiements, vérifier que tous les champs sont remplis
      const montantRempli = paiement.montant !== "" && !Number.isNaN(parseAmount(paiement.montant));
      const typeRempli = paiement.type !== "";
      const dateRemplie = paiement.date !== "";
      // Le reçu n'est plus obligatoire
      const recuExiste = (paiement.recu && paiement.recu.trim() !== "") || !!paymentDocuments?.[index];

      return montantRempli && typeRempli && dateRemplie;
    });
  }, [paiements, paymentDocuments]);

  const totalPrice = useMemo(() => parseAmount(formData.prix), [formData.prix]);
  const totalPaid = useMemo(() => {
    return paiements.reduce((total, paiement) => total + parseAmount(paiement.montant), 0);
  }, [paiements]);
  const remainingAmount = useMemo(() => Math.max(totalPrice - totalPaid, 0), [totalPrice, totalPaid]);

  const canGeneratePaymentReceiptEdit = (index: number) => {
    const payment = paiements[index];
    if (!payment) return false;
    const amount = parseAmount(payment.montant);
    return Boolean(
      payment.type &&
      amount > 0 &&
      formData.nom?.trim() &&
      formData.prenom?.trim() &&
      formData.telephone?.trim()
    );
  };

  const handleGeneratePaymentReceiptEdit = async (index: number) => {
    if (!canGeneratePaymentReceiptEdit(index)) return;
    const payment = paiements[index];
    const amount = parseAmount(payment.montant);
    const paymentDate = new Date().toISOString().slice(0, 10);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le reçu pour le moment.",
        variant: "destructive",
      });
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 42px Arial";
    ctx.fillText("Recu de paiement", 60, 100);
    ctx.fillStyle = "#4b5563";
    ctx.font = "22px Arial";
    ctx.fillText(`Date: ${paymentDate}`, 60, 150);
    ctx.fillText(`Programme: ${formData.programme || "-"}`, 60, 190);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 28px Arial";
    ctx.fillText("Client", 60, 265);
    ctx.font = "22px Arial";
    ctx.fillText(`Nom complet: ${formData.nom} ${formData.prenom}`, 60, 310);
    ctx.fillText(`Telephone: ${formData.telephone}`, 60, 345);
    ctx.font = "bold 28px Arial";
    ctx.fillText("Paiement", 60, 430);
    ctx.font = "22px Arial";
    ctx.fillText(`Type: ${payment.type}`, 60, 475);
    ctx.fillText(`Montant: ${amount.toLocaleString("fr-FR")} DH`, 60, 510);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) {
      toast({
        title: "Erreur",
        description: "Génération du reçu échouée.",
        variant: "destructive",
      });
      return;
    }

    const file = new File([blob], `recu-${Date.now()}.png`, { type: "image/png" });
    setDocuments((prev) => {
      const np = [...(prev.payment || [])];
      while (np.length <= index) np.push(null);
      np[index] = file;
      return { ...prev, payment: np };
    });
    setPreviews((prev) => ({
      ...prev,
      [`payment_${index}`]: { url: URL.createObjectURL(file), type: file.type },
    }));
    toast({
      title: "Reçu généré",
      description: "Le reçu est joint à ce paiement et sera enregistré à la validation.",
    });
  };

  const section3Complete = paiements.length > 0 && arePaymentsValid
  const section4Complete = true // Les toggles sont toujours complétés

  // Détecter les changements dans le formulaire
  const hasChanges = useMemo(() => {
    // Vérifier les changements dans les documents (toujours disponible)
    const hasNewDocuments = 
      documents.passport !== null ||
      documents.visa !== null ||
      documents.hotelBooked !== null ||
      documents.flightBooked !== null ||
      documents.payment.some(f => f !== null);
    
    // Vérifier si un passeport est marqué pour suppression
    const passportToBeDeleted = passportToDelete !== null;
    
    // Si initialData n'est pas encore chargé, vérifier seulement les documents
    if (!initialData || !initialData.formData) {
      return hasNewDocuments || passportToBeDeleted;
    }
    
    const initialFormData = initialData.formData;
    const initialReservationData = initialData;
    
    // Vérifier les changements dans les champs du formulaire
    const formDataChanged = 
      formData.prix !== (initialFormData.prix || '') ||
      formData.dateReservation !== (initialFormData.dateReservation || '') ||
      formData.statutVisa !== (initialFormData.statutVisa || false) ||
      formData.statutHotel !== (initialFormData.statutHotel || false) ||
      formData.statutVol !== (initialFormData.statutVol || false) ||
      formData.passportNumber !== (initialFormData.passportNumber || '') ||
      formData.hotelMadina !== (initialFormData.hotelMadina || '') ||
      formData.hotelMakkah !== (initialFormData.hotelMakkah || '');
    
    // Vérifier les changements dans les paiements (nouveaux paiements ajoutés ou modifications)
    const hasNewPayments = paiements.some(p => !p.id);
    const paymentsChanged = paiements.length !== (initialReservationData.payments?.length || 0) ||
      paiements.some((p, index) => {
        const initialP = initialReservationData.payments?.[index];
        if (!initialP) return true; // Nouveau paiement
        return p.montant !== (initialP.amount?.toString() || '') ||
               p.type !== (initialP.paymentMethod || '') ||
               p.date !== (initialP.paymentDate?.split('T')[0] || '');
      });
    
    const hasMemberPassChanges =
      Object.values(memberPassportFiles).some(Boolean) ||
      Object.values(memberPassportDelete).some((v) => v != null);

    return (
      formDataChanged ||
      hasNewDocuments ||
      passportToBeDeleted ||
      hasNewPayments ||
      paymentsChanged ||
      hasMemberPassChanges
    );
  }, [
    formData,
    initialData,
    documents,
    passportToDelete,
    paiements,
    memberPassportFiles,
    memberPassportDelete,
  ]);

  const isFormValid = useMemo(() => {
    // Le formulaire est valide si :
    // 1. Les paiements sont valides (ou il n'y a pas de paiements)
    // 2. ET (il y a des changements OU le formulaire de base est valide)
    const baseFormValid = formData.prix && formData.programId && formData.typeChambre && formData.gender;
    // Si des changements sont détectés, activer le bouton même si certains champs ne sont pas remplis
    // (car on peut modifier juste une partie)
    if (hasChanges) {
      return arePaymentsValid; // Juste vérifier que les paiements sont valides
    }
    // Sinon, vérifier que le formulaire de base est valide
    return arePaymentsValid && baseFormValid;
  }, [arePaymentsValid, hasChanges, formData])

  const totalProgress = [section1Complete, section2Complete, section3Complete, section4Complete]
    .filter(Boolean).length * 25

  const isChambrePrivee = reservationData?.typeReservation === "CHAMBRE_PRIVEE"

  const renderLeaderPassportBlock = () => (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 space-y-3">
      <Label className="text-xs text-blue-700 font-medium">Passeport (obligatoire)</Label>
      {(!getDocumentUrl("passport") && !documents.passport) || passportToDelete !== null ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="file"
              ref={(el) => {
                if (el) fileInputs.current.passeport = el;
              }}
              onChange={(e) => {
                handleFileChange(e, "passport");
                if (e.target.files && e.target.files.length > 0) {
                  setPassportToDelete(null);
                }
              }}
              accept="image/*,.pdf"
              className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
            />
            {passportToDelete !== null && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setPassportToDelete(null)}
                className="text-gray-600 hover:text-gray-800"
              >
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
            )}
          </div>
          {passportToDelete !== null && (
            <p className="text-xs text-orange-600">
              L&apos;ancien passeport sera remplacé par le nouveau fichier
            </p>
          )}
        </div>
      ) : (
        <div className="mt-1 flex flex-col flex-1 min-h-0 rounded-xl border border-blue-200 bg-white p-3 shadow-sm h-full">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-2 shrink-0">
            <span className="text-sm font-semibold text-blue-800 shrink-0">
              {documents.passport ? "Nouveau passeport" : "Aperçu du passeport"}
            </span>
            <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
              {(previews.passport || getDocumentUrl("passport")) && (
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1.5 rounded-md text-sm inline-flex items-center gap-1 border border-transparent hover:border-blue-200"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const url = previews.passport?.url || getDocumentUrl("passport") || "";
                    const type = previews.passport?.type || getDocumentType("passport");
                    setPreviewImage({ url, title: "Passeport", type });
                  }}
                >
                  <ZoomIn className="h-4 w-4" />
                  Zoom
                </button>
              )}
              {(previews.passport?.url || getDocumentUrl("passport")) && (
                <a
                  href={(previews.passport?.url || getDocumentUrl("passport"))!}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1.5 rounded-md text-sm inline-flex items-center gap-1 border border-transparent hover:border-blue-200"
                >
                  <Download className="h-4 w-4" />
                  Télécharger
                </a>
              )}
              {(previews.passport || getDocumentUrl("passport")) && !documents.passport && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    const fileId = getPassportFileId();
                    if (fileId) {
                      setPassportToDelete(fileId);
                    }
                  }}
                  className="text-orange-600 hover:text-orange-800 hover:bg-orange-50 h-9"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Remplacer
                </Button>
              )}
              {documents.passport && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    handleRemoveDocument("passport");
                    if (passportToDelete) {
                      setPassportToDelete(null);
                    }
                  }}
                  className="text-red-600 hover:text-red-800 hover:bg-red-50 h-9"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer
                </Button>
              )}
            </div>
          </div>
          <div className="w-full min-h-0 max-h-[min(15rem,38vh)] h-[min(15rem,38vh)] sm:max-h-[min(17rem,40vh)] sm:h-[min(17rem,40vh)] flex-1 overflow-hidden rounded-lg border border-blue-200 bg-slate-50 flex items-center justify-center">
            {(() => {
              const passportUrl = documents.passport
                ? previews.passport?.url
                : previews.passport?.url || getDocumentUrl("passport");
              const passportType = documents.passport
                ? previews.passport?.type
                : previews.passport?.type || getDocumentType("passport");
              const isPdf = passportType === "application/pdf";

              if (documents.passport) {
                if (isPdf) {
                  if (
                    previews.passport?.url?.startsWith("blob:") ||
                    previews.passport?.url?.startsWith("data:")
                  ) {
                    return (
                      <embed
                        src={previews.passport.url}
                        type="application/pdf"
                        className="w-full h-full"
                      />
                    );
                  }
                  return (
                    <PdfPreviewBox
                      url={previews.passport?.url || null}
                      title="Nouveau passeport"
                      onZoom={() =>
                        setPreviewImage({
                          url: previews.passport?.url || "",
                          title: "Nouveau passeport",
                          type: "application/pdf",
                        })
                      }
                    />
                  );
                }
                return (
                  <img
                    src={previews.passport?.url || ""}
                    alt="Nouveau passeport"
                    className="max-w-full max-h-full w-auto h-auto object-contain cursor-pointer"
                    onClick={() =>
                      setPreviewImage({
                        url: previews.passport?.url || "",
                        title: "Nouveau passeport",
                        type: previews.passport?.type || "image/*",
                      })
                    }
                  />
                );
              }
              if (!passportUrl) {
                return (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
                    Aucun passeport attaché
                  </div>
                );
              }
              if (isPdf) {
                return (
                  <PdfPreviewBox
                    url={passportUrl}
                    title="Passeport"
                    onZoom={() => {
                      setPreviewImage({
                        url: passportUrl || "",
                        title: "Passeport",
                        type: "application/pdf",
                      });
                    }}
                  />
                );
              }
              return (
                <img
                  src={passportUrl}
                  alt="Passeport"
                  className="max-w-full max-h-full w-auto h-auto object-contain cursor-pointer"
                  onClick={() => {
                    setPreviewImage({ url: passportUrl, title: "Passeport", type: passportType });
                  }}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );

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
                <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-20 z-40 shadow-lg">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <CardTitle className="text-xl flex items-center gap-3">
                      <Sparkles className="h-6 w-6" />
                      Modifier la Réservation
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-3">
                      <div
                        className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 bg-emerald-500/25 backdrop-blur-sm px-3 py-2 rounded-xl border border-emerald-200/40 shadow-sm"
                        title="Montant total du dossier"
                      >
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-emerald-100 shrink-0" />
                          <span className="text-xs sm:text-sm text-emerald-50/95 font-semibold uppercase tracking-wide">
                            Prix engagé
                          </span>
                        </div>
                        <span className="text-lg font-bold text-white tabular-nums sm:ml-1">
                          {totalPrice.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          DH
                        </span>
                      </div>
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 px-3 py-2 rounded-xl border shadow-sm backdrop-blur-sm ${
                          remainingAmount <= 0
                            ? "bg-green-600/35 border-green-200/50"
                            : "bg-amber-500/30 border-amber-200/45"
                        }`}
                        title={
                          remainingAmount <= 0
                            ? "Dossier soldé"
                            : "Montant encore dû sur le dossier"
                        }
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard
                            className={`h-4 w-4 shrink-0 ${
                              remainingAmount <= 0 ? "text-green-100" : "text-amber-100"
                            }`}
                          />
                          <span
                            className={`text-xs sm:text-sm font-semibold uppercase tracking-wide ${
                              remainingAmount <= 0 ? "text-green-50/95" : "text-amber-50/95"
                            }`}
                          >
                            Reste à payer
                          </span>
                        </div>
                        <span className="text-lg font-bold tabular-nums text-white sm:ml-1">
                          {remainingAmount.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          DH
                        </span>
                        {remainingAmount <= 0 && (
                          <span className="text-[10px] sm:text-xs font-medium text-green-100/90 sm:ml-2">
                            Soldé
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
            <form onSubmit={handleSubmit}>
              {/* Section 1: Configuration du Voyage (alignée Nouvelle Réservation : Éditer + sous-bloc) */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Configuration du Voyage
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Programme *</Label>
                    <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                      <span className="text-gray-900 font-medium">{formData.programme || "N/A"}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Type de chambre *</Label>
                    <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                      <span className="text-gray-900 font-medium">
                        {formData.typeChambre === "SINGLE" && "1 personne"}
                        {formData.typeChambre === "DOUBLE" && "2 personnes"}
                        {formData.typeChambre === "TRIPLE" && "3 personnes"}
                        {formData.typeChambre === "QUAD" && "4 personnes"}
                        {formData.typeChambre === "QUINT" && "5 personnes"}
                        {!formData.typeChambre && "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Genre *</Label>
                    <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                      <span className="text-gray-900 font-medium">{formData.gender || "N/A"}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Plan *</Label>
                    <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center gap-2">
                      {(() => {
                        const rawPlan = reservationData?.plan || "Normal";
                        const th =
                          rawPlan in planThemesModifier
                            ? planThemesModifier[rawPlan as keyof typeof planThemesModifier]
                            : planThemesModifier.Normal;
                        const Icon = th.icon;
                        return (
                          <>
                            <Icon className="h-4 w-4 text-emerald-700" />
                            <span className="text-gray-900 font-medium">{th.name}</span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {isChambrePrivee ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🕌</span>
                          <Label className="text-blue-700 font-medium text-sm">Hôtel à Madina *</Label>
                          <button
                            type="button"
                            onClick={() => setShowRoomGuide(true)}
                            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                            title="Guide des chambres"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                          <span className="text-gray-900 font-medium">
                            {getHotelName(formData.hotelMadina, "madina")}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🕋</span>
                          <Label className="text-blue-700 font-medium text-sm">Hôtel à Makkah *</Label>
                          <button
                            type="button"
                            onClick={() => setShowRoomGuide(true)}
                            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                            title="Guide des chambres"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                          <span className="text-gray-900 font-medium">
                            {getHotelName(formData.hotelMakkah, "makkah")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-blue-700 font-medium text-sm">Prix total dossier (DH) *</Label>
                        <Input
                          value={formData.prix}
                          onChange={(e) => setFormData({ ...formData, prix: e.target.value })}
                          className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                          placeholder="Montant"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-blue-700 font-medium text-sm">Date de réservation *</Label>
                        <Input
                          type="date"
                          value={formData.dateReservation}
                          onChange={(e) =>
                            setFormData({ ...formData, dateReservation: e.target.value })
                          }
                          className="h-10 border-2 border-blue-200 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Hôtels & chambres — même présentation « points » que Nouvelle Réservation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🕌</span>
                      <Label className="text-blue-700 font-medium text-sm">Hôtel à Madina *</Label>
                      <button
                        type="button"
                        onClick={() => setShowRoomGuide(true)}
                        className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                        title="Guide des chambres"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                      <span className="text-gray-900 font-medium">
                        {getHotelName(formData.hotelMadina, "madina")}
                      </span>
                    </div>
                    {programDetail?.rooms &&
                      formData.hotelMadina &&
                      formData.hotelMadina !== "none" &&
                      formData.typeChambre &&
                      formData.gender && (
                        <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-green-700">
                              🕌 Chambres (aperçu des places)
                            </span>
                          </div>
                          <div className="grid gap-2">
                            {(() => {
                              const hid = resolveHotelId(formData.hotelMadina, "madina");
                              if (!hid)
                                return (
                                  <div className="text-xs text-gray-500 py-2">—</div>
                                );
                              const filteredRooms = programDetail.rooms.filter(
                                (room: any) =>
                                  room.hotelId === hid &&
                                  room.roomType === formData.typeChambre &&
                                  (room.gender === formData.gender ||
                                    room.gender === "Mixte" ||
                                    !room.gender)
                              );
                              if (filteredRooms.length === 0) {
                                return (
                                  <div className="text-xs text-gray-500 text-center py-2">
                                    Aucune chambre trouvée
                                  </div>
                                );
                              }
                              const sortedRooms = sortRoomsByAlgorithm(
                                filteredRooms,
                                formData.gender
                              );
                              return sortedRooms.map((room: any, index: number) => {
                                const placesOccupees =
                                  room.nbrPlaceTotal - room.nbrPlaceRestantes;
                                const placesDisponibles = room.nbrPlaceRestantes;
                                const isGroupRoom = (room.listeIdsReservation || []).some(
                                  (rid: number) => groupReservationIds.includes(rid)
                                );
                                return (
                                  <div
                                    key={index}
                                    className={`relative p-2 rounded border transition-all ${
                                      isGroupRoom
                                        ? "border-yellow-400 bg-yellow-50"
                                        : "border-gray-300 bg-white"
                                    }`}
                                  >
                                    <div className="flex items-center">
                                      <div className="flex items-center gap-2 w-20">
                                        <span className="text-sm">
                                          {getGenderIconRoom(room.gender)}
                                        </span>
                                        <span className="text-xs font-medium text-gray-700">
                                          ({placesDisponibles}/{room.nbrPlaceTotal})
                                        </span>
                                      </div>
                                      <div className="flex-1 flex justify-center">
                                        <div className="flex gap-1.5">
                                          {Array.from(
                                            { length: room.nbrPlaceTotal },
                                            (_, placeIndex) => {
                                              const gn = groupReservationIds.length;
                                              const take = isGroupRoom
                                                ? Math.min(gn, room.nbrPlaceRestantes)
                                                : 0;
                                              const y0 = placesOccupees;
                                              const y1 = y0 + take - 1;
                                              let placeColor = "bg-gray-300";
                                              let placeTitle = `Place ${placeIndex + 1}`;
                                              if (placeIndex < placesOccupees) {
                                                placeColor = "bg-red-500";
                                                placeTitle = `Place ${placeIndex + 1} occupée`;
                                              } else if (
                                                isGroupRoom &&
                                                take > 0 &&
                                                placeIndex >= y0 &&
                                                placeIndex <= y1
                                              ) {
                                                placeColor = "bg-yellow-400";
                                                placeTitle = `Place ${placeIndex + 1} — dossier groupe`;
                                              } else {
                                                placeColor = "bg-green-500";
                                                placeTitle = `Place ${placeIndex + 1} libre`;
                                              }
                                              return (
                                                <div
                                                  key={placeIndex}
                                                  className={`w-4 h-4 rounded-full ${placeColor} transition-all`}
                                                  title={placeTitle}
                                                />
                                              );
                                            }
                                          )}
                                        </div>
                                      </div>
                                      <div className="w-8 flex justify-end">
                                        {isGroupRoom && (
                                          <div className="w-3 h-3 bg-yellow-400 rounded-full" title="Chambre du dossier" />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🕋</span>
                      <Label className="text-blue-700 font-medium text-sm">Hôtel à Makkah *</Label>
                      <button
                        type="button"
                        onClick={() => setShowRoomGuide(true)}
                        className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                        title="Guide des chambres"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                      <span className="text-gray-900 font-medium">
                        {getHotelName(formData.hotelMakkah, "makkah")}
                      </span>
                    </div>
                    {programDetail?.rooms &&
                      formData.hotelMakkah &&
                      formData.hotelMakkah !== "none" &&
                      formData.typeChambre &&
                      formData.gender && (
                        <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-green-700">
                              🕋 Chambres (aperçu des places)
                            </span>
                          </div>
                          <div className="grid gap-2">
                            {(() => {
                              const hid = resolveHotelId(formData.hotelMakkah, "makkah");
                              if (!hid)
                                return (
                                  <div className="text-xs text-gray-500 py-2">—</div>
                                );
                              const filteredRooms = programDetail.rooms.filter(
                                (room: any) =>
                                  room.hotelId === hid &&
                                  room.roomType === formData.typeChambre &&
                                  (room.gender === formData.gender ||
                                    room.gender === "Mixte" ||
                                    !room.gender)
                              );
                              if (filteredRooms.length === 0) {
                                return (
                                  <div className="text-xs text-gray-500 text-center py-2">
                                    Aucune chambre trouvée
                                  </div>
                                );
                              }
                              const sortedRooms = sortRoomsByAlgorithm(
                                filteredRooms,
                                formData.gender
                              );
                              return sortedRooms.map((room: any, index: number) => {
                                const placesOccupees =
                                  room.nbrPlaceTotal - room.nbrPlaceRestantes;
                                const placesDisponibles = room.nbrPlaceRestantes;
                                const isGroupRoom = (room.listeIdsReservation || []).some(
                                  (rid: number) => groupReservationIds.includes(rid)
                                );
                                return (
                                  <div
                                    key={index}
                                    className={`relative p-2 rounded border transition-all ${
                                      isGroupRoom
                                        ? "border-yellow-400 bg-yellow-50"
                                        : "border-gray-300 bg-white"
                                    }`}
                                  >
                                    <div className="flex items-center">
                                      <div className="flex items-center gap-2 w-20">
                                        <span className="text-sm">
                                          {getGenderIconRoom(room.gender)}
                                        </span>
                                        <span className="text-xs font-medium text-gray-700">
                                          ({placesDisponibles}/{room.nbrPlaceTotal})
                                        </span>
                                      </div>
                                      <div className="flex-1 flex justify-center">
                                        <div className="flex gap-1.5">
                                          {Array.from(
                                            { length: room.nbrPlaceTotal },
                                            (_, placeIndex) => {
                                              const gn = groupReservationIds.length;
                                              const take = isGroupRoom
                                                ? Math.min(gn, room.nbrPlaceRestantes)
                                                : 0;
                                              const y0 = placesOccupees;
                                              const y1 = y0 + take - 1;
                                              let placeColor = "bg-gray-300";
                                              let placeTitle = `Place ${placeIndex + 1}`;
                                              if (placeIndex < placesOccupees) {
                                                placeColor = "bg-red-500";
                                                placeTitle = `Place ${placeIndex + 1} occupée`;
                                              } else if (
                                                isGroupRoom &&
                                                take > 0 &&
                                                placeIndex >= y0 &&
                                                placeIndex <= y1
                                              ) {
                                                placeColor = "bg-yellow-400";
                                                placeTitle = `Place ${placeIndex + 1} — dossier groupe`;
                                              } else {
                                                placeColor = "bg-green-500";
                                                placeTitle = `Place ${placeIndex + 1} libre`;
                                              }
                                              return (
                                                <div
                                                  key={placeIndex}
                                                  className={`w-4 h-4 rounded-full ${placeColor} transition-all`}
                                                  title={placeTitle}
                                                />
                                              );
                                            }
                                          )}
                                        </div>
                                      </div>
                                      <div className="w-8 flex justify-end">
                                        {isGroupRoom && (
                                          <div className="w-3 h-3 bg-yellow-400 rounded-full" title="Chambre du dossier" />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
                    </>
                  )}
              </div>

              {/* Section 2: Informations Client */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-6">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Informations Client
                      {section1Complete && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </h3>

                {isChambrePrivee ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch mb-4">
                    <div className="space-y-4 min-w-0 flex flex-col h-full min-h-0">
                      <div className="p-4 rounded-lg border border-blue-200 bg-white/80 flex-1 min-h-0 flex flex-col">
                        <div className="text-xs font-semibold text-blue-700 flex items-center gap-2 mb-3">
                          <User className="h-4 w-4" />
                          Leader
                        </div>
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-blue-700">Nom *</Label>
                              <div className="h-10 px-3 py-2 border-2 border-blue-100 rounded-lg bg-blue-50/80 flex items-center">
                                <span className="text-gray-900 font-medium">{formData.nom || "N/A"}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-blue-700">Prénom *</Label>
                              <div className="h-10 px-3 py-2 border-2 border-blue-100 rounded-lg bg-blue-50/80 flex items-center">
                                <span className="text-gray-900 font-medium">{formData.prenom || "N/A"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-blue-700">Téléphone *</Label>
                              <div className="h-10 px-3 py-2 border-2 border-blue-100 rounded-lg bg-blue-50/80 flex items-center">
                                <span className="text-gray-900 font-medium">{formData.telephone || "N/A"}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-blue-700">Groupe</Label>
                              <Input
                                value={formData.groupe}
                                onChange={(e) => setFormData({ ...formData, groupe: e.target.value })}
                                placeholder="Groupe (optionnel)"
                                className="h-10 border-2 border-blue-100 focus:border-blue-400"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                            <div className="space-y-1">
                              <Label className="text-xs text-blue-700">Genre</Label>
                              <Select
                                value={formData.gender}
                                onValueChange={(v) => setFormData({ ...formData, gender: v })}
                              >
                                <SelectTrigger className="h-10 border-2 border-blue-100 focus:border-blue-400">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Homme">Homme</SelectItem>
                                  <SelectItem value="Femme">Femme</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-blue-700">N° Passeport</Label>
                              <Input
                                value={formData.passportNumber}
                                onChange={(e) =>
                                  setFormData({ ...formData, passportNumber: e.target.value })
                                }
                                placeholder="Numéro passeport"
                                className="h-10 border-2 border-blue-100 focus:border-blue-400"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-blue-700">Transport</Label>
                              <div className="flex items-center gap-2 h-10 px-3 border-2 border-blue-100 rounded-lg bg-white">
                                <Switch
                                  checked={formData.transport || false}
                                  onCheckedChange={(checked) =>
                                    setFormData((prev) => ({ ...prev, transport: checked }))
                                  }
                                  className="data-[state=checked]:bg-blue-600"
                                />
                                <span className="text-sm text-gray-700">
                                  {formData.transport ? "Oui" : "Non"}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-blue-700">Remarque</Label>
                              <Input
                                value={formData.remarque}
                                onChange={(e) =>
                                  setFormData({ ...formData, remarque: e.target.value })
                                }
                                placeholder="Remarque (optionnel)"
                                className="h-10 border-2 border-blue-100 focus:border-blue-400"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex flex-col self-stretch justify-end min-h-0">
                      {renderLeaderPassportBlock()}
                    </div>
                  </div>
                ) : (
                  <>
                {/* Première ligne : groupe, nom, prénom, transport */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Groupe</Label>
                    <Input
                      value={formData.groupe}
                      onChange={(e) => setFormData({ ...formData, groupe: e.target.value })}
                      placeholder="Nom du groupe"
                      className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                    />
                      </div>

                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Nom *</Label>
                    <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                      <span className="text-gray-900 font-medium">{formData.nom || 'N/A'}</span>
                    </div>
                      </div>

                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Prénom *</Label>
                    <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                      <span className="text-gray-900 font-medium">{formData.prenom || 'N/A'}</span>
                    </div>
                      </div>

                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Transport</Label>
                    <div className="flex items-center gap-2 h-10 px-3 border-2 border-blue-200 rounded-lg bg-white">
                      <Switch
                        checked={formData.transport || false}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, transport: checked }))}
                        className="data-[state=checked]:bg-blue-600"
                      />
                      <span className="text-sm text-gray-700">
                        {formData.transport ? 'Oui' : 'Non'}
                      </span>
                    </div>
                      </div>
                </div>

                {/* Deuxième ligne : passport, remarque */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">N° passport</Label>
                    <Input
                      value={formData.passportNumber}
                      onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                      placeholder="Numéro de passeport"
                      className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                    />
                      </div>

                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Remarque</Label>
                    <Input
                      value={formData.remarque}
                      onChange={(e) => setFormData({ ...formData, remarque: e.target.value })}
                      placeholder="Remarques additionnelles"
                      className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                    />
                      </div>
                </div>

                {/* Téléphone - toujours nécessaire */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Téléphone *</Label>
                    <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                      <span className="text-gray-900 font-medium">{formData.telephone || 'N/A'}</span>
                      </div>
                      </div>
                </div>
                  </>
                )}

                {reservationData?.isLeader && accompagnants.length > 0 && (
                  <div className="mt-4 p-4 border border-blue-200 rounded-lg bg-white">
                    <div className="text-sm font-semibold text-blue-800 mb-3">
                      Accompagnants ({accompagnants.length}) - Informations personnelles
                    </div>
                    <div className="space-y-4">
                      {accompagnants.map((a, idx) => {
                        const passKey = `member_passport_${a.id}`;
                        const hasPreview = !!previews[passKey];
                        const fid = getMemberPassportFileId(a);
                        const markPassportReplace = memberPassportDelete[a.id] != null;
                        const pvUrl = previews[passKey]?.url;
                        const pvType = previews[passKey]?.type || "image/*";
                        const pvIsPdf = pvType === "application/pdf";
                        return (
                          <div
                            key={a.id}
                            className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3 space-y-3"
                          >
                            {isChambrePrivee ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                <div className="space-y-3 min-w-0">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs text-blue-700">Nom *</Label>
                                      <Input
                                        value={a.lastName}
                                        onChange={(e) =>
                                          setAccompagnants((prev) =>
                                            prev.map((item) =>
                                              item.id === a.id
                                                ? { ...item, lastName: e.target.value }
                                                : item
                                            )
                                          )
                                        }
                                        placeholder={`Nom accompagnant ${idx + 1}`}
                                        className="h-10 border-2 border-blue-100 focus:border-blue-400"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-blue-700">Prénom *</Label>
                                      <Input
                                        value={a.firstName}
                                        onChange={(e) =>
                                          setAccompagnants((prev) =>
                                            prev.map((item) =>
                                              item.id === a.id
                                                ? { ...item, firstName: e.target.value }
                                                : item
                                            )
                                          )
                                        }
                                        placeholder="Prénom"
                                        className="h-10 border-2 border-blue-100 focus:border-blue-400"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-blue-700">N° Passeport</Label>
                                    <Input
                                      value={a.passportNumber || ""}
                                      onChange={(e) =>
                                        setAccompagnants((prev) =>
                                          prev.map((item) =>
                                            item.id === a.id
                                              ? { ...item, passportNumber: e.target.value }
                                              : item
                                          )
                                        )
                                      }
                                      placeholder="Numéro passeport"
                                      className="h-10 border-2 border-blue-100 focus:border-blue-400"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2 min-w-0 flex flex-col">
                                  {(!(hasPreview && !markPassportReplace && pvUrl)) && (
                                    <>
                                      <Label className="text-xs text-blue-700 font-medium">
                                        Passeport (obligatoire)
                                      </Label>
                                      <div className="flex items-center gap-2">
                                        <Input
                                          type="file"
                                          accept="image/*,.pdf"
                                          onChange={(e) => handleMemberPassportChange(a.id, e)}
                                          className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg min-w-0 flex-1"
                                        />
                                        {memberPassportFiles[a.id] && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                              setMemberPassportFiles((prev) => ({
                                                ...prev,
                                                [a.id]: null,
                                              }));
                                              setPreviews((prev) => {
                                                const n = { ...prev };
                                                delete n[passKey];
                                                return n;
                                              });
                                            }}
                                            className="text-red-600 hover:text-red-800 shrink-0"
                                            title="Retirer le fichier"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                  {hasPreview && !markPassportReplace && pvUrl && (
                                    <div className="p-2 border border-blue-200 rounded-lg bg-white flex flex-col min-h-0 w-full">
                                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2 shrink-0">
                                        <span className="text-sm font-medium text-blue-700">
                                          Aperçu du passeport
                                        </span>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <button
                                            type="button"
                                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded text-sm flex items-center gap-1"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setPreviewImage({
                                                url: pvUrl,
                                                title: `Passeport accompagnant ${idx + 1}`,
                                                type: pvType,
                                              });
                                            }}
                                          >
                                            <ZoomIn className="h-3 w-3" />
                                            Aperçu
                                          </button>
                                          <a
                                            href={pvUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download={memberPassportFiles[a.id]?.name || "passeport"}
                                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded text-sm inline-flex items-center gap-1"
                                          >
                                            <Download className="h-3 w-3" />
                                            Télécharger
                                          </a>
                                          {memberPassportFiles[a.id] && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="text-red-600 hover:text-red-800 h-8 w-8 shrink-0"
                                              title="Retirer le fichier"
                                              onClick={() => {
                                                setMemberPassportFiles((prev) => ({
                                                  ...prev,
                                                  [a.id]: null,
                                                }));
                                                setPreviews((prev) => {
                                                  const n = { ...prev };
                                                  delete n[passKey];
                                                  return n;
                                                });
                                              }}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          )}
                                          {fid && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="text-orange-600"
                                              onClick={() => {
                                                if (fid)
                                                  setMemberPassportDelete((prev) => ({
                                                    ...prev,
                                                    [a.id]: fid,
                                                  }));
                                                setPreviews((prev) => {
                                                  const n = { ...prev };
                                                  delete n[passKey];
                                                  return n;
                                                });
                                              }}
                                            >
                                              <Edit className="h-3 w-3 mr-1" />
                                              Remplacer
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                      <div className="w-full min-h-0 max-h-[min(11rem,32vh)] h-[min(11rem,32vh)] sm:max-h-[min(12rem,34vh)] sm:h-[min(12rem,34vh)] overflow-hidden rounded-lg border border-blue-200 bg-slate-50 flex items-center justify-center">
                                        {pvIsPdf ? (
                                          pvUrl.startsWith("blob:") || pvUrl.startsWith("data:") ? (
                                            <embed
                                              src={pvUrl}
                                              type="application/pdf"
                                              className="w-full h-full min-h-0"
                                            />
                                          ) : (
                                            <PdfPreviewBox
                                              url={pvUrl}
                                              title={`Passeport accompagnant ${idx + 1}`}
                                              onZoom={() =>
                                                setPreviewImage({
                                                  url: pvUrl,
                                                  title: `Passeport accompagnant ${idx + 1}`,
                                                  type: "application/pdf",
                                                })
                                              }
                                            />
                                          )
                                        ) : (
                                          <img
                                            src={pvUrl}
                                            alt={`Passeport accompagnant ${idx + 1}`}
                                            className="max-w-full max-h-full w-auto h-auto object-contain cursor-pointer"
                                            onClick={() =>
                                              setPreviewImage({
                                                url: pvUrl,
                                                title: `Passeport accompagnant ${idx + 1}`,
                                                type: pvType,
                                              })
                                            }
                                          />
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {memberPassportFiles[a.id] && (
                                    <p className="text-xs text-emerald-700">
                                      Nouveau fichier prêt à être enregistré avec la réservation.
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                  <Input
                                    value={a.lastName}
                                    onChange={(e) =>
                                      setAccompagnants((prev) =>
                                        prev.map((item) =>
                                          item.id === a.id
                                            ? { ...item, lastName: e.target.value }
                                            : item
                                        )
                                      )
                                    }
                                    placeholder={`Nom accompagnant ${idx + 1}`}
                                    className="h-10 border-2 border-blue-200"
                                  />
                                  <Input
                                    value={a.firstName}
                                    onChange={(e) =>
                                      setAccompagnants((prev) =>
                                        prev.map((item) =>
                                          item.id === a.id
                                            ? { ...item, firstName: e.target.value }
                                            : item
                                        )
                                      )
                                    }
                                    placeholder="Prénom"
                                    className="h-10 border-2 border-blue-200"
                                  />
                                  <Input
                                    value={a.phone}
                                    onChange={(e) =>
                                      setAccompagnants((prev) =>
                                        prev.map((item) =>
                                          item.id === a.id
                                            ? { ...item, phone: e.target.value }
                                            : item
                                        )
                                      )
                                    }
                                    placeholder="Téléphone"
                                    className="h-10 border-2 border-blue-200"
                                    disabled
                                  />
                                  <Input
                                    value={a.passportNumber || ""}
                                    onChange={(e) =>
                                      setAccompagnants((prev) =>
                                        prev.map((item) =>
                                          item.id === a.id
                                            ? { ...item, passportNumber: e.target.value }
                                            : item
                                        )
                                      )
                                    }
                                    placeholder="N° passeport"
                                    className="h-10 border-2 border-blue-200"
                                    disabled
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-blue-700 font-medium text-sm">
                                    Passeport (fichier) — accompagnant {idx + 1}
                                  </Label>
                                  {(!hasPreview || markPassportReplace) && !memberPassportFiles[a.id] ? (
                                    <Input
                                      type="file"
                                      accept="image/*,.pdf"
                                      onChange={(e) => handleMemberPassportChange(a.id, e)}
                                      className="h-10 border-2 border-blue-200"
                                    />
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => handleMemberPassportChange(a.id, e)}
                                        className="h-10 border-2 border-blue-200 max-w-xs"
                                      />
                                      {hasPreview && !markPassportReplace && (
                                        <>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              const u = previews[passKey]?.url;
                                              const t = previews[passKey]?.type || "image/*";
                                              if (u) setPreviewImage({ url: u, title: "Passeport accompagnant", type: t });
                                            }}
                                          >
                                            <ZoomIn className="h-4 w-4 mr-1" />
                                            Aperçu
                                          </Button>
                                          {fid && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="text-orange-600"
                                              onClick={() => {
                                                if (fid)
                                                  setMemberPassportDelete((prev) => ({
                                                    ...prev,
                                                    [a.id]: fid,
                                                  }));
                                                setPreviews((prev) => {
                                                  const n = { ...prev };
                                                  delete n[passKey];
                                                  return n;
                                                });
                                              }}
                                            >
                                              <Edit className="h-4 w-4 mr-1" />
                                              Remplacer
                                            </Button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                  {memberPassportFiles[a.id] && (
                                    <p className="text-xs text-emerald-700">
                                      Nouveau fichier prêt à être enregistré avec la réservation.
                                    </p>
                                  )}
                                </div>
                              </>
                            )}
                            {(a.payments || []).length > 0 && (
                              <div className="text-xs text-gray-700 space-y-1">
                                <span className="font-semibold">Paiements liés à ce membre :</span>
                                {(a.payments || []).map((p: any) => (
                                  <div key={p.id} className="flex flex-wrap gap-2 items-center">
                                    <span>
                                      {p.amount} DH — {p.paymentMethod}
                                    </span>
                                    {(p.fichier?.cloudinaryUrl || p.fichier?.filePath) && (
                                      <Button
                                        type="button"
                                        variant="link"
                                        className="h-auto p-0 text-blue-600"
                                        onClick={() => {
                                          const u = p.fichier.cloudinaryUrl || p.fichier.filePath;
                                          const pdf = isPdfFile(p.fichier?.fileName || u);
                                          setPreviewImage({
                                            url: u,
                                            title: "Reçu paiement",
                                            type: pdf ? "application/pdf" : "image/*",
                                          });
                                        }}
                                      >
                                        Voir le reçu
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      Les champs structurels (programme, chambre, hôtels) restent verrouillés et gérés au niveau du dossier.
                    </p>
                  </div>
                )}

                {!isChambrePrivee && renderLeaderPassportBlock()}
              </div>

              {/* Section 3: Paiements */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-6">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Paiements
                      {section2Complete && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </h3>
                    <div className="space-y-4">
                      {paiements.map((paiement, index) => (
                        <div key={index} className="p-4 border border-blue-200 rounded-lg bg-white/60">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-3 space-y-2">
                          <Label className="text-blue-700 font-medium text-sm">Mode de paiement</Label>
                          {paiement.id ? (
                            <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                              <span className="text-gray-900 font-medium">
                                {paiement.type === 'especes' && 'Espèces'}
                                {paiement.type === 'virement' && 'Virement'}
                                {paiement.type === 'carte' && 'Carte'}
                                {paiement.type === 'cheque' && 'Chèque'}
                                {!['especes', 'virement', 'carte', 'cheque'].includes(paiement.type) && paiement.type}
                              </span>
                            </div>
                          ) : (
                            <Select
                              value={paiement.type}
                              onValueChange={(value) => mettreAJourPaiement(index, "type", value)}
                            >
                              <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                                <SelectValue placeholder="Sélectionner paiement" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="especes">Espèces</SelectItem>
                                <SelectItem value="virement">Virement</SelectItem>
                                <SelectItem value="carte">Carte</SelectItem>
                                <SelectItem value="cheque">Chèque</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                            </div>
                            <div className="md:col-span-3 space-y-2">
                          <Label className="text-blue-700 font-medium text-sm">Montant (DH)</Label>
                          {paiement.id ? (
                            <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                              <span className="text-gray-900 font-medium">{paiement.montant} DH</span>
                            </div>
                          ) : (
                            <Input
                              type="text"
                              value={paiement.montant}
                              onChange={(e) => mettreAJourPaiement(index, "montant", e.target.value)}
                              placeholder="Montant en dirhams"
                              className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          )}
                            </div>
                            <div className="md:col-span-6 space-y-2">
                              {!previews[`payment_${index}`] && !paiement.recu && (
                                <>
                                  <Label className="text-blue-700 font-medium text-sm">Reçu de paiement</Label>
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
                                    <Input
                                      type="file"
                                      data-payment-index={index}
                                      onChange={(e) => handlePaymentFileChange(e, index)}
                                      accept="image/*,.pdf"
                                      className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg flex-1 min-w-[200px]"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleGeneratePaymentReceiptEdit(index)}
                                      disabled={isSubmitting || !canGeneratePaymentReceiptEdit(index)}
                                      className="h-10 border-blue-300 text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                                    >
                                      <Download className="h-3.5 w-3.5 mr-1.5" />
                                      Generer recu
                                    </Button>
                                  </div>
                                </>
                              )}

                              {previews[`payment_${index}`] && (
                                <div className="p-2 border border-blue-200 rounded-lg bg-white">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-blue-700">
                                      {paiement.id && paiement.recu ? "Nouveau reçu (remplacera l'ancien)" : "Aperçu du reçu"}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded inline-flex items-center gap-1 text-sm"
                                        onClick={() =>
                                          setPreviewImage({
                                            url: previews[`payment_${index}`].url,
                                            title: "Reçu paiement",
                                            type: previews[`payment_${index}`].type,
                                          })
                                        }
                                      >
                                        <ZoomIn className="h-4 w-4" />
                                        Zoom
                                      </button>
                                      <a
                                        href={previews[`payment_${index}`].url}
                                        download={documents.payment?.[index]?.name || "recu-paiement"}
                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded text-sm inline-flex items-center gap-1"
                                      >
                                        <Download className="h-4 w-4" />
                                        Télécharger
                                      </a>
                                      {documents.payment?.[index] && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setPreviews((prev) => {
                                              const next = { ...prev };
                                              delete next[`payment_${index}`];
                                              if (paiement.id) delete next[`payment_existing_${paiement.id}`];
                                              return next;
                                            });
                                            setDocuments((prev) => {
                                              const newPayments = [...(prev.payment || [])];
                                              newPayments[index] = null;
                                              return { ...prev, payment: newPayments };
                                            });
                                            setPaiements((prev) =>
                                              prev.map((item, itemIdx) =>
                                                itemIdx === index ? { ...item, recu: null, recuFileName: undefined } : item
                                              )
                                            );
                                          }}
                                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                        >
                                          <Trash2 className="h-4 w-4 mr-1" />
                                          Supprimer
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="w-full h-[200px] overflow-hidden rounded-lg border border-blue-200">
                                    {previews[`payment_${index}`].type === "application/pdf" ? (
                                      previews[`payment_${index}`].url.startsWith("blob:") || previews[`payment_${index}`].url.startsWith("data:") ? (
                                        <embed
                                          src={previews[`payment_${index}`].url}
                                          type="application/pdf"
                                          className="w-full h-full"
                                        />
                                      ) : (
                                        <PdfPreviewBox
                                          url={previews[`payment_${index}`].url}
                                          title="Reçu de paiement"
                                          onZoom={() =>
                                            setPreviewImage({
                                              url: previews[`payment_${index}`].url,
                                              title: "Reçu paiement",
                                              type: previews[`payment_${index}`].type,
                                            })
                                          }
                                        />
                                      )
                                    ) : (
                                      <img
                                        src={previews[`payment_${index}`].url}
                                        alt="Reçu de paiement"
                                        className="w-full h-full object-contain"
                                      />
                                    )}
                                  </div>
                                </div>
                              )}

                              {paiement.id && paiement.recu && !previews[`payment_${index}`] && (
                                <div className="p-2 border border-blue-200 rounded-lg bg-white">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-blue-700">Aperçu du reçu</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded inline-flex items-center gap-1 text-sm"
                                        onClick={() => {
                                          const isPdf = isPdfFile(paiement.recuFileName || paiement.recu);
                                          setPreviewImage({ url: paiement.recu || "", title: "Reçu paiement", type: isPdf ? "application/pdf" : "image/*" });
                                        }}
                                      >
                                        <ZoomIn className="h-4 w-4" />
                                        Zoom
                                      </button>
                                      <a
                                        href={paiement.recu || ""}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={paiement.recuFileName || "recu-paiement"}
                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded text-sm inline-flex items-center gap-1"
                                      >
                                        <Download className="h-4 w-4" />
                                        Télécharger
                                      </a>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (paiement.id && paiement.receiptFileId) {
                                            setPaymentReceiptsToDelete((prev) => ({
                                              ...prev,
                                              [paiement.id as number]: paiement.receiptFileId as number,
                                            }));
                                          }
                                          setPreviews((prev) => {
                                            const next = { ...prev };
                                            delete next[`payment_${index}`];
                                            if (paiement.id) delete next[`payment_existing_${paiement.id}`];
                                            return next;
                                          });
                                          setPaiements((prev) =>
                                            prev.map((item, itemIdx) =>
                                              itemIdx === index ? { ...item, recu: null, recuFileName: undefined, receiptFileId: null } : item
                                            )
                                          );
                                        }}
                                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Supprimer
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="w-full h-[200px] overflow-hidden rounded-lg border border-blue-200">
                                    {isPdfFile(paiement.recuFileName || paiement.recu) ? (
                                      <PdfPreviewBox
                                        url={paiement.recu}
                                        title="Reçu de paiement"
                                        onZoom={() => {
                                          const isPdf = isPdfFile(paiement.recuFileName || paiement.recu);
                                          setPreviewImage({ url: paiement.recu || "", title: "Reçu paiement", type: isPdf ? "application/pdf" : "image/*" });
                                        }}
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
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => supprimerPaiement(index)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              disabled={!!paiement.id}
                              title={paiement.id ? "Impossible de supprimer un paiement existant" : "Supprimer ce paiement"}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer le paiement
                            </Button>
                          </div>
                        </div>
                      ))}
                  <Button
                    type="button"
                    onClick={ajouterPaiement}
                    className="mt-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un paiement
                  </Button>
                    </div>
                  </div>

              {/* Section 4: Documents Fournisseur - Statuts simplifiés */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-6">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Documents Fournisseur
                      {section3Complete && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </h3>
                <div className="space-y-4">
                  {/* Statuts des documents avec toggle switches */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Statut Visa */}
                    <div className="bg-white p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <Label className="text-blue-700 font-medium">Statut Visa</Label>
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
                    <div className="bg-white p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Calendar className="h-4 w-4 text-blue-600" />
                          </div>
                          <Label className="text-blue-700 font-medium">Statut Vol</Label>
                        </div>
                        <Switch
                          checked={formData.statutVol || false}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, statutVol: checked }))}
                          className="data-[state=checked]:bg-blue-600"
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
                    <div className="bg-white p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Hotel className="h-4 w-4 text-blue-600" />
                          </div>
                          <Label className="text-blue-700 font-medium">Statut Hôtel</Label>
                        </div>
                        <Switch
                          checked={formData.statutHotel || false}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, statutHotel: checked }))}
                          className="data-[state=checked]:bg-blue-600"
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
                  disabled={isSubmitting || (!isFormValid && !hasChanges)}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Edit className="h-4 w-4 mr-2" />
                      {isSubmitting ? "Modification..." : "Modifier la réservation"}
                    </Button>
                  </div>
            </form>
                </CardContent>
              </Card>
            </div>

      <Dialog open={showRoomGuide} onOpenChange={setShowRoomGuide}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Guide des chambres</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Les pastilles rouges indiquent les places déjà occupées, les vertes les places
            libres, et les jaunes les places attribuées à ce dossier (groupe). Le cadre jaune
            autour d&apos;une ligne correspond à la chambre où votre groupe est enregistré.
          </p>
        </DialogContent>
      </Dialog>

      {/* Dialog de prévisualisation */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewImage?.title}</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="mt-4">
              {isPdfFile(previewImage.url) || previewImage.type === 'application/pdf' ? (
                // Pour les PDFs locaux (blob/data), utiliser embed
                previewImage.url.startsWith('blob:') || previewImage.url.startsWith('data:') ? (
                  <embed
                    src={previewImage.url}
                    type="application/pdf"
                    className="w-full h-full min-h-[600px]"
                  />
                ) : (
                  // Pour les PDFs Cloudinary, utiliser Blob Proxy
                  <PdfPreviewModal url={previewImage.url} title={previewImage.title} />
                )
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