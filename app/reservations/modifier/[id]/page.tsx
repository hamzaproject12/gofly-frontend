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
  date: string;
  recu: string | null;
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

  // État pour stocker les valeurs initiales (pour détecter les changements)
  const [initialData, setInitialData] = useState<any>(null)

  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [previews, setPreviews] = useState<{ [key: string]: { url: string, type: string } }>({})
  const [reservationData, setReservationData] = useState<any>(null)
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
          
          const initialFormData = {
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
          }
          
          console.log('📋 Données initiales chargées:', {
            statutVisa: reservationData.statutVisa,
            statutVol: reservationData.statutVol,
            statutHotel: reservationData.statutHotel,
            initialFormData
          })
          
          setFormData(initialFormData)
          setInitialData(initialFormData) // Stocker les données initiales

          // Charger les paiements existants
          const initialPaiements = (reservationData.payments || []).map((p: any) => ({
            montant: p.amount?.toString() || '',
            type: p.paymentMethod || '',
            date: p.paymentDate?.split('T')[0] || '',
            recu: p.fichier?.cloudinaryUrl || p.fichier?.filePath || '',
            id: p.id // Garder l'ID pour identifier les paiements existants
          }))
          setPaiements(initialPaiements)

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
              console.log('🔍 Debug - Setting preview for:', {
                type,
                url: doc.url,
                fileName: doc.fileName,
                isPdf: doc.fileName?.includes('.pdf')
              });
              
              // Normaliser les types pour la cohérence 
              const normalizedType = type === 'passeport' ? 'passport' : 
                                   type === 'paiement' ? 'payment' : type;
              
              setPreviews(prev => ({ 
                ...prev, 
                [normalizedType]: { 
                  url: doc.url, 
                  type: doc.fileName?.includes('.pdf') ? 'application/pdf' : 'image/*' 
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
      // Vérifier si un nouveau passeport est uploadé OU si un passeport existe déjà
      const hasNewPassport = documents.passport !== null;
      const hasExistingPassport = getDocumentUrl('passport') !== null;
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

      const response = await fetch(api.url(`/api/reservations/${reservationId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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

      // 3. Upload nouveau passeport si présent
      if (documents.passport && reservationId) {
        console.log('📤 Upload passeport vers Cloudinary...')
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
          fileUploadErrors.push(`Erreur lors de l'upload du passeport: ${error.error || 'Erreur inconnue'}`);
        } else {
          console.log('✅ Passeport uploadé avec succès')
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
          const recuValue = typeof value === "string" ? value : value ?? null;
          return { ...p, recu: recuValue };
        }

        return { ...p, [field]: value };
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

  // Helper function pour obtenir l'URL d'un document
  const getDocumentUrl = (type: string) => {
    // D'abord vérifier dans previews (pour les nouveaux fichiers)
    if (previews[type]) {
      return previews[type].url;
    }
    
    // Ensuite vérifier dans les documents existants de la réservation
    // Gérer les variations de types (passport/passeport, payment/paiement)
    const typeVariations = type === 'passport' ? ['passport', 'passeport'] : 
                          type === 'payment' ? ['payment', 'paiement'] : [type];
    
    const existingDoc = (reservationData.documents || reservationData.fichiers || []).find((d: any) => 
      typeVariations.includes(d.fileType)
    );
    
    if (existingDoc) {
      console.log('🔍 Debug - Found document for type:', {
        requestedType: type,
        foundType: existingDoc.fileType,
        url: existingDoc.cloudinaryUrl || existingDoc.filePath
      });
      return existingDoc.cloudinaryUrl || existingDoc.filePath;
    }
    
    return null;
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
      return existingDoc.fileName?.includes('.pdf') ? 'application/pdf' : 'image/*';
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

  // Calculs de progression
  const section1Complete = formData.nom && formData.prenom && formData.telephone && formData.typeChambre && formData.prix && formData.gender
  const section2Complete = formData.programId && formData.hotelMadina && formData.hotelMakkah
  const arePaymentsValid = useMemo(() => {
    if (paiements.length === 0) {
      return true;
    }

    return paiements.every((paiement, index) => {
      const montantRempli = paiement.montant !== "" && !Number.isNaN(parseAmount(paiement.montant));
      const typeRempli = paiement.type !== "";
      const dateRemplie = paiement.date !== "";
      const recuExiste = (paiement.recu && paiement.recu.trim() !== "") || !!paymentDocuments?.[index];

      return montantRempli && typeRempli && dateRemplie && recuExiste;
    });
  }, [paiements, paymentDocuments]);

  const totalPrice = useMemo(() => parseAmount(formData.prix), [formData.prix]);
  const totalPaid = useMemo(() => {
    return paiements.reduce((total, paiement) => total + parseAmount(paiement.montant), 0);
  }, [paiements]);
  const remainingAmount = useMemo(() => Math.max(totalPrice - totalPaid, 0), [totalPrice, totalPaid]);

  const section3Complete = paiements.length > 0 && arePaymentsValid
  const section4Complete = true // Les toggles sont toujours complétés

  const isFormValid = useMemo(() => arePaymentsValid, [arePaymentsValid])

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
                <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-40 shadow-lg">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <CardTitle className="text-xl flex items-center gap-3">
                      <Sparkles className="h-6 w-6" />
                      Modifier la Réservation
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/30">
                        <Wallet className="h-4 w-4 text-white" />
                        <span className="text-sm text-white/80 font-medium">Prix</span>
                        <span className="text-lg font-bold text-white">
                          {totalPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH
                        </span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/30">
                        <CreditCard className="h-4 w-4 text-white" />
                        <span className="text-sm text-white/80 font-medium">Reste à payer</span>
                        <span className="text-lg font-bold text-white">
                          {remainingAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
            <form onSubmit={handleSubmit}>
              {/* Section 1: Configuration du Voyage */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-6">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Configuration du Voyage
                    </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Programme *</Label>
                        <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                          <span className="text-gray-900 font-medium">{formData.programme || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Type de chambre *</Label>
                        <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                          <span className="text-gray-900 font-medium">
                            {formData.typeChambre === 'SINGLE' && '1 personne'}
                            {formData.typeChambre === 'DOUBLE' && '2 personnes'}
                            {formData.typeChambre === 'TRIPLE' && '3 personnes'}
                            {formData.typeChambre === 'QUAD' && '4 personnes'}
                            {formData.typeChambre === 'QUINT' && '5 personnes'}
                            {!formData.typeChambre && 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Genre *</Label>
                        <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                          <span className="text-gray-900 font-medium">{formData.gender || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                    <Label className="text-blue-700 font-medium text-sm">Plan *</Label>
                        <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                          <span className="text-gray-900 font-medium">{reservationData?.plan || 'Normal'}</span>
                        </div>
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
                        <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                          <span className="text-gray-900 font-medium">
                            {getHotelName(formData.hotelMadina, 'madina')}
                          </span>
                        </div>
                      </div>

                  {/* Hôtel à Makkah */}
                      <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🕋</span>
                      <Label className="text-blue-700 font-medium text-sm">Hôtel à Makkah *</Label>
                    </div>
                        <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                          <span className="text-gray-900 font-medium">
                            {getHotelName(formData.hotelMakkah, 'makkah')}
                          </span>
                        </div>
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
                    <Label className="text-blue-700 font-medium text-sm">Téléphone *</Label>
                    <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                      <span className="text-gray-900 font-medium">{formData.telephone || 'N/A'}</span>
                      </div>
                      </div>

                  {/* Passeport - Ajouté dans Informations Client */}
                  <div className="space-y-2 md:col-span-3">
                    <Label className="text-blue-700 font-medium text-sm">Passeport *</Label>
                    {!getDocumentUrl('passport') ? (
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
                    ) : (
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
                                setPreviewImage({ url: getDocumentUrl('passport') || '', title: 'Passeport', type: getDocumentType('passport') });
                              }}
                            >
                              <ZoomIn className="h-3 w-3 mr-1" />
                              Zoom
                            </button>
                      </div>
                    </div>
                        <div className="w-full h-[200px] overflow-hidden rounded-lg border border-blue-200">
                          {getDocumentType('passport') === 'application/pdf' ? (
                            <embed
                              src={`${getDocumentUrl('passport')}#toolbar=0&navpanes=0&scrollbar=0`}
                              type="application/pdf"
                              className="w-full h-full"
                            />
                          ) : (
                            <img
                              src={getDocumentUrl('passport')}
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
                              type="number"
                              value={paiement.montant}
                              onChange={(e) => mettreAJourPaiement(index, "montant", e.target.value)}
                              placeholder="Montant en dirhams"
                              max={(() => {
                                const sumOther = paiements.reduce((sum, p, idx) => idx === index ? sum : sum + parseAmount(p.montant), 0);
                                return Math.max(totalPrice - sumOther, 0);
                              })()}
                              className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                            />
                          )}
                            </div>
                            <div className="md:col-span-3 space-y-2">
                          <Label className="text-blue-700 font-medium text-sm">Date</Label>
                          {paiement.id ? (
                            <div className="h-10 px-3 py-2 border-2 border-blue-200 rounded-lg bg-blue-50 flex items-center">
                              <span className="text-gray-900 font-medium">{paiement.date}</span>
                            </div>
                          ) : (
                            <Input
                              type="date"
                              value={paiement.date}
                              readOnly
                              disabled
                              className="h-10 border-2 border-blue-200 bg-blue-50 text-gray-700 rounded-lg cursor-not-allowed"
                            />
                          )}
                        </div>
                        <div className="md:col-span-3 flex items-center justify-center">
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => supprimerPaiement(index)}
                            className="flex items-center gap-2"
                            disabled={!!paiement.id}
                            title={paiement.id ? "Impossible de supprimer un paiement existant" : "Supprimer ce paiement"}
                          >
                            <Trash2 className="h-4 w-4" />
                            Supprimer
                          </Button>
                        </div>
                            </div>

                      {/* Upload de reçu de paiement */}
                      {!paiement.recu && (
                        <div className="mt-3 space-y-2">
                          <Label className="text-blue-700 font-medium text-sm">Reçu de paiement</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              onChange={(e) => handlePaymentFileChange(e, index)}
                              accept="image/*,.pdf"
                              className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                            />
                            {documents.payment?.[index] && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setPreviews(prev => {
                                    const newPreviews = { ...prev };
                                    delete newPreviews[`payment_${index}`];
                                    return newPreviews;
                                  });
                                  setDocuments(prev => {
                                    const newPayments = [...(prev.payment || [])];
                                    newPayments[index] = null;
                                    return { ...prev, payment: newPayments };
                                  });
                                }}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Aperçu du nouveau reçu uploadé */}
                      {previews[`payment_${index}`] && (
                        <div className="mt-3 p-2 border border-blue-200 rounded-lg bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-700">Aperçu du nouveau reçu</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded"
                                onClick={() => setPreviewImage({ 
                                  url: previews[`payment_${index}`].url, 
                                  title: 'Nouveau reçu paiement', 
                                  type: previews[`payment_${index}`].type 
                                })}
                              >
                                <ZoomIn className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="w-full h-[150px] overflow-hidden rounded-lg border border-blue-200">
                            {previews[`payment_${index}`].type === 'application/pdf' ? (
                              <embed
                                src={`${previews[`payment_${index}`].url}#toolbar=0&navpanes=0&scrollbar=0`}
                                type="application/pdf"
                                className="w-full h-full"
                              />
                            ) : (
                              <img
                                src={previews[`payment_${index}`].url}
                                alt="Nouveau reçu de paiement"
                                className="w-full h-full object-contain"
                              />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Reçu existant */}
                      {paiement.id && paiement.recu && (
                        <div className="mt-3 p-2 border border-blue-200 rounded-lg bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-700">Reçu de paiement</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded"
                                onClick={() => setPreviewImage({ url: paiement.recu || '', title: 'Reçu paiement', type: 'image/*' })}
                              >
                                <ZoomIn className="h-4 w-4" />
                              </button>
                            </div>
                            </div>
                          <div className="w-full h-[150px] overflow-hidden rounded-lg border border-blue-200">
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
                  disabled={isSubmitting || !isFormValid}
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