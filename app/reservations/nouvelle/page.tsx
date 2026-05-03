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
  Leaf,
  ShieldCheck,
  Crown,
  Download,
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

type Documents = {
  passport: File | null;
  visa: File | null;
  billet: File | null;
  hotel: File | null;
  paiements: File[];
};

type OcrExtractData = {
  first_name?: string;
  last_name?: string;
  passport?: string;
  personal_id_number?: string;
  sex?: string;
};

const PHONE_REGEX = /^\+\d{3}\s\d{9}$/;
const PASSPORT_REGEX = /^[A-Z]{2}\d{7}$/;

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  const country = digits.slice(0, 3);
  const local = digits.slice(3, 12);
  return local ? `+${country} ${local}` : `+${country}`;
}

function formatPassportInput(value: string): string {
  const chars = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const letters = chars.replace(/[^A-Z]/g, "").slice(0, 2);
  const numbers = chars.replace(/[^0-9]/g, "").slice(0, 7);
  return `${letters}${numbers}`;
}

function mapOcrSexToGender(sex: string | undefined): "Homme" | "Femme" | null {
  if (!sex || typeof sex !== "string") return null;
  const u = sex.trim().toUpperCase();
  if (u === "F" || u === "FEMALE" || u === "FÉMININ") return "Femme";
  if (u === "M" || u === "MALE" || u === "MASCULIN") return "Homme";
  return null;
}

export default function NouvelleReservation() {
  const { toast } = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
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
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [previews, setPreviews] = useState<{ [key: string]: { url: string, type: string } }>({})
  const [formData, setFormData] = useState<{
    programme: string;
    typeChambre: string;
    nom: string;
    prenom: string;
    telephone: string;
    passportNumber: string;
    groupe: string;
    remarque: string;
    transport: boolean;
    prix: string;
    hotelMadina: string;
    hotelMakkah: string;
    dateReservation: string;
    programId: string;
    gender: string;
    statutVisa: boolean;
    statutVol: boolean;
    statutHotel: boolean;
    paiements: Array<{ montant: string; type: string; date: string; recu?: string }>;
  }>({
    programme: "",
    typeChambre: "",
    nom: "",
    prenom: "",
    telephone: "+212",
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
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; type: string } | null>(null);
  const [ocrProcessingPassport, setOcrProcessingPassport] = useState(false);
  const [ocrValidation, setOcrValidation] = useState<{
    firstName: string;
    lastName: string;
    passport: string;
    sex?: string;
  } | null>(null);
  const [showRoomGuide, setShowRoomGuide] = useState(false);
  const [selectedPlaces, setSelectedPlaces] = useState<{[roomId: number]: number[]}>({});
  
  // État pour stocker les informations du programme et les prix des chambres
  const [programInfo, setProgramInfo] = useState<{
    nbJoursMadina: number;
    nbJoursMakkah: number;
    exchange: number;
    prixAvionDH: number;
    prixVisaRiyal: number;
    profit: number;
    profitEconomique: number;
    profitNormal: number;
    profitVIP: number;
    rooms: Array<{
      id: number;
      hotelId: number;
      roomType: string;
      gender: string;
      prixRoom: number;
      nbrPlaceTotal: number;
      nbrPlaceRestantes: number;
      listeIdsReservation: number[];
    }>;
  } | null>(null);

  // États séparés pour les places sélectionnées à Madina et Makkah
  const [selectedPlacesMadina, setSelectedPlacesMadina] = useState<{[roomId: number]: number[]}>({});
  const [selectedPlacesMakkah, setSelectedPlacesMakkah] = useState<{[roomId: number]: number[]}>({});

  // États pour la personnalisation du calcul de prix
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [customization, setCustomization] = useState({
    includeAvion: true,
    includeVisa: true,
    joursMadina: 0, // Sera initialisé avec les valeurs du programme
    joursMakkah: 0, // Sera initialisé avec les valeurs du programme
    plan: "Normal" // Plan par défaut: Économique, Normal, VIP
  });

  // Dynamic Theme Engine - Configuration des thèmes pour chaque plan
  const planThemes = useMemo(() => ({
    "Économique": {
      name: "Économique",
      icon: Leaf,
      colors: {
        primary: "slate",
        secondary: "blue",
        bg: "bg-slate-50",
        border: "border-slate-300",
        borderActive: "border-slate-500",
        ring: "ring-slate-400",
        text: "text-slate-700",
        textActive: "text-slate-900",
        badge: "bg-slate-100 text-slate-700 border-slate-300",
        glow: "shadow-slate-400/50",
      }
    },
    "Normal": {
      name: "Normal",
      icon: ShieldCheck,
      colors: {
        primary: "emerald",
        secondary: "green",
        bg: "bg-emerald-50",
        border: "border-emerald-300",
        borderActive: "border-emerald-500",
        ring: "ring-emerald-400",
        text: "text-emerald-700",
        textActive: "text-emerald-900",
        badge: "bg-emerald-100 text-emerald-700 border-emerald-300",
        glow: "shadow-emerald-400/50",
      }
    },
    "VIP": {
      name: "VIP",
      icon: Crown,
      colors: {
        primary: "amber",
        secondary: "yellow",
        bg: "bg-amber-50",
        border: "border-amber-300",
        borderActive: "border-amber-500",
        ring: "ring-amber-400",
        text: "text-amber-700",
        textActive: "text-amber-900",
        badge: "bg-amber-100 text-amber-700 border-amber-300",
        glow: "shadow-amber-400/50",
      }
    }
  }), []);

  // Get active theme based on selected plan
  const activeTheme = useMemo(() => {
    return planThemes[customization.plan as keyof typeof planThemes] || planThemes["Normal"];
  }, [customization.plan, planThemes]);

  // État pour la réduction du prix
  const [reduction, setReduction] = useState(0);
  
  // État pour le mode d'ajustement du prix ('reduction' | 'proposition' | null)
  const [prixMode, setPrixMode] = useState<'reduction' | 'proposition' | null>(null);
  
  // État pour le prix proposé (prix plus élevé que le prix calculé)
  const [prixPropose, setPrixPropose] = useState<number | null>(null);

  const paymentDocuments = documents.payment;

  // Références pour les inputs de fichiers
  const fileInputs = useRef<FileInputs>({
    passeport: null,
    visa: null,
    billetAller: null,
    billetRetour: null,
    reservationMadina: null,
    reservationMakkah: null,
    paiements: [],
    flightBooked: null,
    hotelBooked: null
  })

  // Ajout d'un état pour suivre les statuts d'upload réels
  const [uploadedStatus, setUploadedStatus] = useState({
    passport: false,
    visa: false,
    hotelBooked: false,
    flightBooked: false,
    payment: false
  });

  // Ajout d'un état pour suivre si un fichier a été sélectionné pour chaque type
  const [attachmentStatus, setAttachmentStatus] = useState({
    passport: false,
    visa: false,
    hotelBooked: false,
    flightBooked: false
  });

  // Ajout des montants pour chaque document dans l'état
  const [documentsMontants, setDocumentsMontants] = useState({
    visa: '',
    flightBooked: '',
    hotelBooked: ''
  });

  // Charger les programmes au montage du composant
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const response = await fetch(api.url(api.endpoints.programs));
        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des programmes');
        }
        const data = await response.json();
        setPrograms(data);
      } catch (error) {
        console.error('Erreur:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les programmes',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPrograms();
  }, [toast]);

  // Fonction pour récupérer les informations détaillées du programme
  const fetchProgramDetails = async (programId: string) => {
    try {
      console.log('🔄 Chargement des détails du programme:', programId);
      const response = await fetch(api.url(`/api/programs/${programId}`));
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des détails du programme');
      }
      const data = await response.json();
      console.log('📦 Données reçues du programme:', data);
      
      const programInfoData = {
        nbJoursMadina: data.nbJoursMadina,
        nbJoursMakkah: data.nbJoursMakkah,
        exchange: data.exchange,
        prixAvionDH: data.prixAvionDH,
        prixVisaRiyal: data.prixVisaRiyal,
        profit: data.profit || 0,
        profitEconomique: data.profitEconomique || 0,
        profitNormal: data.profitNormal || 0,
        profitVIP: data.profitVIP || 0,
        rooms: data.rooms || []
      };
      
      console.log('🏨 Chambres trouvées:', programInfoData.rooms);
      setProgramInfo(programInfoData);
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les détails du programme',
        variant: 'destructive',
      });
    }
  };

  const programmeSelectionne = programs.find((p) => p.id.toString() === formData.programId);

  // Filtrer les hôtels par ville avec la nouvelle modélisation
  const hotelsMadina = programmeSelectionne?.hotelsMadina?.map((ph: { hotel: Hotel }) => ph.hotel) || [];
  const hotelsMakkah = programmeSelectionne?.hotelsMakkah?.map((ph: { hotel: Hotel }) => ph.hotel) || [];

  // Fonction pour calculer le prix automatiquement
  const calculatePrice = useMemo(() => {
    console.log('=== DEBUG CALCUL PRIX ===');
    console.log('programInfo:', programInfo);
    console.log('formData.typeChambre:', formData.typeChambre);
    console.log('formData.gender:', formData.gender);
    console.log('formData.hotelMadina:', formData.hotelMadina);
    console.log('formData.hotelMakkah:', formData.hotelMakkah);
    
    if (!programInfo || !formData.typeChambre || !formData.gender || !formData.hotelMadina || !formData.hotelMakkah) {
      console.log('❌ Conditions non remplies pour le calcul');
      return 0;
    }

    const roomType = formData.typeChambre;
    const gender = formData.gender;
    const hotelMadinaId = parseInt(formData.hotelMadina);
    const hotelMakkahId = parseInt(formData.hotelMakkah);

    console.log('Recherche chambres pour:', { roomType, gender, hotelMadinaId, hotelMakkahId });
    console.log('Rooms disponibles:', programInfo.rooms);

    // Vérifier d'abord si des hôtels sont sélectionnés
    if (formData.hotelMadina === "none" && formData.hotelMakkah === "none") {
      console.log('✅ Aucun hôtel sélectionné - calcul sans hébergement');
      // Si aucun hôtel n'est sélectionné, on peut quand même calculer le prix
      const prixAvion = customization.includeAvion ? programInfo.prixAvionDH : 0;
      const prixVisa = customization.includeVisa ? programInfo.prixVisaRiyal : 0;
      
      // Récupérer le profit selon le plan sélectionné
      const getProfitByPlan = () => {
        switch (customization.plan) {
          case "Économique":
            return programInfo.profitEconomique || programInfo.profit || 0;
          case "VIP":
            return programInfo.profitVIP || programInfo.profit || 0;
          case "Normal":
          default:
            return programInfo.profitNormal || programInfo.profit || 0;
        }
      };
      
      const profit = getProfitByPlan();
      
      // LOGS DÉTAILLÉS DU CALCUL SANS HÔTEL
      console.log('🔍 === DÉTAIL DU CALCUL DU PRIX (SANS HÔTEL) ===');
      console.log('📊 Données de base:');
      console.log('   - Taux de change:', programInfo.exchange, 'DH/Riyal');
      console.log('   - Plan sélectionné:', customization.plan);
      
      console.log('✈️ Prix Avion:');
      console.log('   - Inclus:', customization.includeAvion ? 'OUI' : 'NON');
      console.log('   - Prix:', prixAvion, 'DH');
      
      console.log('📄 Prix Visa:');
      console.log('   - Inclus:', customization.includeVisa ? 'OUI' : 'NON');
      console.log('   - Prix:', prixVisa, 'Riyals');
      console.log('   - Conversion en DH:', prixVisa * programInfo.exchange, 'DH');
      
      console.log('🧮 Calcul détaillé:');
      console.log('   - Prix Avion:', prixAvion, 'DH');
      console.log('   - Plan:', customization.plan);
      console.log('   - Profit:', profit, 'DH');
      console.log('   - Visa converti:', prixVisa * programInfo.exchange, 'DH');
      
      const prixFinal = prixAvion + profit + (prixVisa * programInfo.exchange);

      console.log('💰 === RÉSULTAT FINAL (SANS HÔTEL) ===');
      console.log('   - Prix Avion:', prixAvion, 'DH');
      console.log('   - Plan:', customization.plan);
      console.log('   - Profit:', profit, 'DH');
      console.log('   - Visa converti:', prixVisa * programInfo.exchange, 'DH');
      console.log('   - PRIX FINAL:', prixFinal, 'DH');
      console.log('✅ Prix calculé (sans hôtel):', prixFinal);
      return Math.round(prixFinal);
    }

    // Utiliser les chambres sélectionnées par l'utilisateur
    let roomMadina = null;
    let roomMakkah = null;

    if (formData.hotelMadina !== "none") {
      // Récupérer l'ID de la chambre sélectionnée
      const selectedRoomMadinaId = Object.keys(selectedPlacesMadina)[0];
      if (selectedRoomMadinaId) {
        roomMadina = programInfo.rooms.find(r => r.id === parseInt(selectedRoomMadinaId));
        console.log('🏨 Chambre Madina sélectionnée par l\'utilisateur:', selectedRoomMadinaId);
      }
      
      // Si aucune chambre n'est sélectionnée, utiliser la première disponible
      if (!roomMadina) {
        roomMadina = programInfo.rooms.find(r => 
          r.hotelId === hotelMadinaId && 
          r.roomType === roomType && 
          (r.gender === gender || r.gender === 'Mixte')
        );
        console.log('⚠️ Aucune chambre Madina sélectionnée, utilisation de la première trouvée');
      }
    }

    if (formData.hotelMakkah !== "none") {
      // Récupérer l'ID de la chambre sélectionnée
      const selectedRoomMakkahId = Object.keys(selectedPlacesMakkah)[0];
      if (selectedRoomMakkahId) {
        roomMakkah = programInfo.rooms.find(r => r.id === parseInt(selectedRoomMakkahId));
        console.log('🏨 Chambre Makkah sélectionnée par l\'utilisateur:', selectedRoomMakkahId);
      }
      
      // Si aucune chambre n'est sélectionnée, utiliser la première disponible
      if (!roomMakkah) {
        roomMakkah = programInfo.rooms.find(r => 
          r.hotelId === hotelMakkahId && 
          r.roomType === roomType && 
          (r.gender === gender || r.gender === 'Mixte')
        );
        console.log('⚠️ Aucune chambre Makkah sélectionnée, utilisation de la première trouvée');
      }
    }

    console.log('🏨 === CHAMBRES TROUVÉES ===');
    if (roomMadina) {
      console.log('   - Room Madina ID:', roomMadina.id);
      console.log('   - Hôtel ID:', roomMadina.hotelId);
      console.log('   - Type:', roomMadina.roomType);
      console.log('   - Genre:', roomMadina.gender);
      console.log('   - Prix par room:', roomMadina.prixRoom, 'Riyals');
      console.log('   - Places totales:', roomMadina.nbrPlaceTotal);
      console.log('   - Places restantes AVANT réservation:', roomMadina.nbrPlaceRestantes);
    } else {
      console.log('   - Aucune room Madina trouvée');
    }
    
    if (roomMakkah) {
      console.log('   - Room Makkah ID:', roomMakkah.id);
      console.log('   - Hôtel ID:', roomMakkah.hotelId);
      console.log('   - Type:', roomMakkah.roomType);
      console.log('   - Genre:', roomMakkah.gender);
      console.log('   - Prix par room:', roomMakkah.prixRoom, 'Riyals');
      console.log('   - Places totales:', roomMakkah.nbrPlaceTotal);
      console.log('   - Places restantes AVANT réservation:', roomMakkah.nbrPlaceRestantes);
    } else {
      console.log('   - Aucune room Makkah trouvée');
    }

    // Vérifier que les chambres nécessaires sont trouvées
    if ((formData.hotelMadina !== "none" && !roomMadina) || (formData.hotelMakkah !== "none" && !roomMakkah)) {
      console.log('❌ Chambres non trouvées pour les hôtels sélectionnés');
      return 0;
    }

    // Vérifier qu'il reste des places dans les chambres sélectionnées
    if ((roomMadina && roomMadina.nbrPlaceRestantes <= 0) || (roomMakkah && roomMakkah.nbrPlaceRestantes <= 0)) {
      console.log('❌ Pas de places disponibles');
      return 0;
    }

    // Calcul selon la formule
    const prixRoomMadina = roomMadina?.prixRoom || 0;
    const prixRoomMakkah = roomMakkah?.prixRoom || 0;
    
    // Convertir le type de chambre en nombre de personnes
    const nbPersonnes = {
      'SINGLE': 1,
      'DOUBLE': 2,
      'TRIPLE': 3,
      'QUAD': 4,
      'QUINT': 5
    }[roomType] || 1;

    // Utiliser les valeurs personnalisées ou les valeurs par défaut du programme
    const prixAvion = customization.includeAvion ? programInfo.prixAvionDH : 0;
    const prixVisa = customization.includeVisa ? programInfo.prixVisaRiyal : 0;
    const joursUtilisesMadina = customization.joursMadina;
    const joursUtilisesMakkah = customization.joursMakkah;

    // Récupérer le profit selon le plan sélectionné
    const getProfitByPlan = () => {
      switch (customization.plan) {
        case "Économique":
          return programInfo.profitEconomique || programInfo.profit || 0;
        case "VIP":
          return programInfo.profitVIP || programInfo.profit || 0;
        case "Normal":
        default:
          return programInfo.profitNormal || programInfo.profit || 0;
      }
    };
    
    const profit = getProfitByPlan();

    // Calculer le prix des hôtels selon la sélection
    const prixHotelMadina = (formData.hotelMadina !== "none" && roomMadina) ? (prixRoomMadina / nbPersonnes) * joursUtilisesMadina : 0;
    const prixHotelMakkah = (formData.hotelMakkah !== "none" && roomMakkah) ? (prixRoomMakkah / nbPersonnes) * joursUtilisesMakkah : 0;

    // LOGS DÉTAILLÉS DU CALCUL
    console.log('🔍 === DÉTAIL DU CALCUL DU PRIX ===');
    console.log('📊 Données de base:');
    console.log('   - Type de chambre:', roomType, `(${nbPersonnes} personne${nbPersonnes > 1 ? 's' : ''})`);
    console.log('   - Genre:', gender);
    console.log('   - Taux de change:', programInfo.exchange, 'DH/Riyal');
    console.log('   - Plan sélectionné:', customization.plan);
    
    console.log('✈️ Prix Avion:');
    console.log('   - Inclus:', customization.includeAvion ? 'OUI' : 'NON');
    console.log('   - Prix:', prixAvion, 'DH');
    
    console.log('📄 Prix Visa:');
    console.log('   - Inclus:', customization.includeVisa ? 'OUI' : 'NON');
    console.log('   - Prix:', prixVisa, 'Riyals');
    
    console.log('🏨 Prix Hôtel Madina:');
    if (formData.hotelMadina !== "none" && roomMadina) {
      console.log('   - Prix par room:', prixRoomMadina, 'Riyals');
      console.log('   - Divisé par:', nbPersonnes, 'personne(s)');
      console.log('   - Multiplié par:', joursUtilisesMadina, 'jour(s)');
      console.log('   - Total:', prixHotelMadina, 'Riyals');
    } else {
      console.log('   - Aucun hôtel sélectionné');
    }
    
    console.log('🏨 Prix Hôtel Makkah:');
    if (formData.hotelMakkah !== "none" && roomMakkah) {
      console.log('   - Prix par room:', prixRoomMakkah, 'Riyals');
      console.log('   - Divisé par:', nbPersonnes, 'personne(s)');
      console.log('   - Multiplié par:', joursUtilisesMakkah, 'jour(s)');
      console.log('   - Total:', prixHotelMakkah, 'Riyals');
    } else {
      console.log('   - Aucun hôtel sélectionné');
    }
    
    console.log('🧮 Calcul détaillé:');
    console.log('   - Prix Avion:', prixAvion, 'DH');
    console.log('   - Plan sélectionné:', customization.plan);
    console.log('   - Profit:', profit, 'DH');
    console.log('   - Total Riyals (Visa + Hôtels):', (prixVisa + prixHotelMakkah + prixHotelMadina), 'Riyals');
    console.log('   - Conversion en DH:', (prixVisa + prixHotelMakkah + prixHotelMadina) * programInfo.exchange, 'DH');
    
    const prixFinal = prixAvion 
      + profit 
      + (prixVisa + prixHotelMakkah + prixHotelMadina) * programInfo.exchange;

    console.log('💰 === RÉSULTAT FINAL ===');
    console.log('   - Prix Avion:', prixAvion, 'DH');
    console.log('   - Plan:', customization.plan);
    console.log('   - Profit:', profit, 'DH');
    console.log('   - Services (Visa + Hôtels) convertis:', (prixVisa + prixHotelMakkah + prixHotelMadina) * programInfo.exchange, 'DH');
    console.log('   - PRIX FINAL:', prixFinal, 'DH');
    console.log('✅ Prix calculé:', prixFinal);
    return Math.round(prixFinal); // Arrondir à l'entier le plus proche
  }, [programInfo, formData.typeChambre, formData.gender, formData.hotelMadina, formData.hotelMakkah, customization]);

  // Fonction pour trier les rooms selon l'algorithme spécifié
  const sortRoomsByAlgorithm = (rooms: any[], selectedGender: string) => {
    return rooms.sort((a, b) => {
      // 1. Priorité aux rooms avec le même genre que celui sélectionné
      const aIsSameGender = a.gender === selectedGender;
      const bIsSameGender = b.gender === selectedGender;
      
      if (aIsSameGender && !bIsSameGender) return -1;
      if (!aIsSameGender && bIsSameGender) return 1;
      
      // 2. Parmi les rooms compatibles, rooms déjà entamées (o > 0) d'abord, triées par o décroissant
      const aOccupied = a.nbrPlaceTotal - a.nbrPlaceRestantes;
      const bOccupied = b.nbrPlaceTotal - b.nbrPlaceRestantes;
      
      if (aOccupied > 0 && bOccupied === 0) return -1;
      if (aOccupied === 0 && bOccupied > 0) return 1;
      
      if (aOccupied > 0 && bOccupied > 0) {
        return bOccupied - aOccupied; // Décroissant
      }
      
      // 3. Puis les rooms vierges (o = 0)
      if (aOccupied === 0 && bOccupied === 0) {
        return b.nbrPlaceRestantes - a.nbrPlaceRestantes; // Par places restantes décroissant
      }
      
      return 0;
    });
  };

  // Fonction pour obtenir la première place libre d'une room
  const getFirstAvailablePlace = (room: any) => {
    const placesOccupees = room.nbrPlaceTotal - room.nbrPlaceRestantes;
    return placesOccupees; // Index de la première place libre
  };

  // Fonction pour sélectionner automatiquement la première place libre de la première room compatible
  const autoSelectFirstAvailablePlace = (rooms: any[], selectedGender: string, destination: 'madina' | 'makkah') => {
    if (rooms.length === 0) return;
    
    const sortedRooms = sortRoomsByAlgorithm(rooms, selectedGender);
    
    // Trouver la première room avec au moins 1 place libre (r > 0)
    const firstAvailableRoom = sortedRooms.find(room => room.nbrPlaceRestantes > 0);
    
    if (firstAvailableRoom) {
      const firstAvailablePlace = getFirstAvailablePlace(firstAvailableRoom);
      if (destination === 'madina') {
        setSelectedPlacesMadina({ [firstAvailableRoom.id]: [firstAvailablePlace] });
      } else {
        setSelectedPlacesMakkah({ [firstAvailableRoom.id]: [firstAvailablePlace] });
      }
    }
  };

  // Fonction pour gérer la sélection des places
  const handlePlaceSelection = (roomId: number, placeIndex: number, roomGender: string, destination: 'madina' | 'makkah') => {
    // Vérifier que le gender de la room correspond à celui sélectionné
    if (roomGender !== formData.gender && roomGender !== 'Mixte' && roomGender !== null) {
      toast({
        title: 'Erreur',
        description: `Cette room est réservée aux ${roomGender === 'Homme' ? 'hommes' : 'femmes'}`,
        variant: 'destructive',
      });
      return;
    }

    // Vérifier que la place est libre
    const room = programInfo?.rooms.find(r => r.id === roomId);
    if (room) {
      const placesOccupees = room.nbrPlaceTotal - room.nbrPlaceRestantes;
      if (placeIndex < placesOccupees) {
        toast({
          title: 'Erreur',
          description: 'Cette place est déjà occupée',
          variant: 'destructive',
        });
        return;
      }
    }

    if (destination === 'madina') {
      setSelectedPlacesMadina(prev => {
        // Vérifier si la place est déjà sélectionnée
        const isSelected = prev[roomId]?.includes(placeIndex);
        
        if (isSelected) {
          // Désélectionner la place
          const { [roomId]: removed, ...rest } = prev;
          return rest;
        } else {
          // Sélectionner la nouvelle place (remplace toute sélection précédente)
          return { [roomId]: [placeIndex] };
        }
      });
    } else {
      setSelectedPlacesMakkah(prev => {
        // Vérifier si la place est déjà sélectionnée
        const isSelected = prev[roomId]?.includes(placeIndex);
        
        if (isSelected) {
          // Désélectionner la place
          const { [roomId]: removed, ...rest } = prev;
          return rest;
        } else {
          // Sélectionner la nouvelle place (remplace toute sélection précédente)
          return { [roomId]: [placeIndex] };
        }
      });
    }
  };

  // Mettre à jour le prix automatiquement quand le calcul, la réduction ou le prix proposé change
  useEffect(() => {
    if (calculatePrice > 0) {
      let prixFinal: number;
      if (prixMode === 'proposition' && prixPropose !== null && prixPropose >= calculatePrice) {
        // Utiliser le prix proposé si le mode est activé et supérieur ou égal au prix calculé
        prixFinal = Math.max(0, Math.round(prixPropose));
      } else if (prixMode === 'reduction') {
        // Utiliser le prix calculé moins la réduction
        prixFinal = Math.max(0, Math.round(calculatePrice - reduction));
      } else {
        // Sinon utiliser le prix calculé normal
        prixFinal = Math.max(0, Math.round(calculatePrice));
      }
      setFormData(prev => ({ ...prev, prix: prixFinal.toString() }));
    }
  }, [calculatePrice, reduction, prixPropose, prixMode]);

  // Réinitialiser la sélection des places quand les critères de base changent
  useEffect(() => {
    setSelectedPlacesMadina({});
    setSelectedPlacesMakkah({});
  }, [formData.programId, formData.typeChambre, formData.gender]);

  // Charger les détails du programme quand il est sélectionné
  useEffect(() => {
    console.log('🔄 useEffect - programId changé:', formData.programId);
    if (formData.programId) {
      fetchProgramDetails(formData.programId);
    } else {
      setProgramInfo(null);
    }
  }, [formData.programId]);

  // Initialiser les valeurs de personnalisation avec les valeurs du programme
  useEffect(() => {
    if (programInfo) {
      setCustomization(prev => ({
        ...prev,
        joursMadina: programInfo.nbJoursMadina,
        joursMakkah: programInfo.nbJoursMakkah,
        plan: prev.plan || "Normal" // Garder le plan existant ou utiliser "Normal" par défaut
      }));
    }
  }, [programInfo]);

  // Réinitialiser les statuts quand les services sont désactivés
  useEffect(() => {
    if (!customization.includeVisa) {
      setFormData(prev => ({ ...prev, statutVisa: false }));
    }
  }, [customization.includeVisa]);

  useEffect(() => {
    if (!customization.includeAvion) {
      setFormData(prev => ({ ...prev, statutVol: false }));
    }
  }, [customization.includeAvion]);

  useEffect(() => {
    if (formData.hotelMadina === "none" && formData.hotelMakkah === "none") {
      setFormData(prev => ({ ...prev, statutHotel: false }));
    }
  }, [formData.hotelMadina, formData.hotelMakkah]);

  // Sélectionner automatiquement la première place libre quand les rooms changent
  useEffect(() => {
    if (programInfo && programInfo.rooms && formData.hotelMadina && formData.typeChambre && formData.gender) {
      const filteredRooms = programInfo.rooms.filter(room => 
        room.hotelId === parseInt(formData.hotelMadina) && 
        room.roomType === formData.typeChambre && 
        (room.gender === formData.gender || room.gender === 'Mixte' || !room.gender)
      );
      
      if (filteredRooms.length > 0) {
        // Vérifier si la sélection actuelle est toujours valide
        const currentSelection = Object.entries(selectedPlacesMadina)[0];
        if (currentSelection) {
          const [roomId, places] = currentSelection;
          const room = filteredRooms.find(r => r.id === parseInt(roomId));
          
          // Si la room n'existe plus ou n'a plus de places libres, réinitialiser
          if (!room || room.nbrPlaceRestantes === 0) {
            setSelectedPlacesMadina({});
            autoSelectFirstAvailablePlace(filteredRooms, formData.gender, 'madina');
          }
        } else {
          // Aucune sélection, sélectionner automatiquement
          autoSelectFirstAvailablePlace(filteredRooms, formData.gender, 'madina');
        }
      }
    }
  }, [programInfo, formData.hotelMadina, formData.typeChambre, formData.gender, selectedPlacesMadina]);

  // Sélectionner automatiquement la première place libre pour Makkah quand les rooms changent
  useEffect(() => {
    if (programInfo && programInfo.rooms && formData.hotelMakkah && formData.typeChambre && formData.gender) {
      const filteredRooms = programInfo.rooms.filter(room => 
        room.hotelId === parseInt(formData.hotelMakkah) && 
        room.roomType === formData.typeChambre && 
        (room.gender === formData.gender || room.gender === 'Mixte' || !room.gender)
      );
      
      if (filteredRooms.length > 0) {
        // Vérifier si la sélection actuelle est toujours valide
        const currentSelection = Object.entries(selectedPlacesMakkah)[0];
        if (currentSelection) {
          const [roomId, places] = currentSelection;
          const room = filteredRooms.find(r => r.id === parseInt(roomId));
          
          // Si la room n'existe plus ou n'a plus de places libres, réinitialiser
          if (!room || room.nbrPlaceRestantes === 0) {
            setSelectedPlacesMakkah({});
            autoSelectFirstAvailablePlace(filteredRooms, formData.gender, 'makkah');
          }
        } else {
          // Aucune sélection, sélectionner automatiquement
          autoSelectFirstAvailablePlace(filteredRooms, formData.gender, 'makkah');
        }
      }
    }
  }, [programInfo, formData.hotelMakkah, formData.typeChambre, formData.gender, selectedPlacesMakkah]);

  // Vérifier si les champs obligatoires sont remplis
  const arePaymentsValid = useMemo(() => {
    if (paiements.length === 0) {
      return true;
    }

    return paiements.every((p) => {
      const montantRempli = p.montant !== "" && !Number.isNaN(Number(p.montant));
      const typeRempli = p.type !== "";

      return montantRempli && typeRempli;
    });
  }, [paiements]);

  const isFormValid = useMemo(() => {
    const baseFieldsValid =
      formData.programme !== "" &&
      formData.typeChambre !== "" &&
      formData.gender !== "" &&
      formData.nom !== "" &&
      formData.prenom !== "" &&
      formData.telephone !== "" &&
      formData.prix !== "";

    return baseFieldsValid && arePaymentsValid;
  }, [formData, arePaymentsValid]);

  // Calculer la progression des sections
  const section1Complete = useMemo(() => {
    return (
      formData.programme !== "" &&
      formData.typeChambre !== "" &&
      formData.gender !== "" &&
      formData.nom !== "" &&
      formData.prenom !== "" &&
      formData.telephone !== "" &&
      formData.prix !== ""
    )
  }, [formData])

  const section2Complete = useMemo(() => {
    return paiements.length > 0 && arePaymentsValid;
  }, [paiements, arePaymentsValid]);

  const section3Complete = useMemo(() => {
    return Object.values(documents).some(doc => doc !== null)
  }, [documents])

  const section4Complete = useMemo(() => {
    return formData.hotelMadina !== "" && formData.hotelMakkah !== "";
  }, [formData.hotelMadina, formData.hotelMakkah]);

  // Calculer le total des paiements
  const totalPaiements = useMemo(() => {
    return paiements.reduce((total, p) => total + (Number(p.montant) || 0), 0)
  }, [paiements])

  const ajouterPaiement = () => {
    setPaiements([...paiements, { montant: "", type: "", date: new Date().toISOString().split("T")[0], recu: null }])
    setDocuments(prev => ({
      ...prev,
      payment: [...(prev.payment || []), null]
    }))
  }

  const supprimerPaiement = (index: number) => {
    setPaiements(paiements.filter((_, i) => i !== index))
  }

  const mettreAJourPaiement = <K extends keyof Paiement>(index: number, field: K, value: Paiement[K]) => {
    if (field === "montant" && typeof value === "string") {
      const montantSaisi = Number(value);
      const prixSuggere = Number(formData.prix) || 0;

      if (value.trim() !== "" && !Number.isNaN(montantSaisi) && prixSuggere > 0) {
        const totalHorsLigne = paiements.reduce(
          (sum, p, i) => sum + (i === index ? 0 : Number(p.montant) || 0),
          0
        );
        if (totalHorsLigne + montantSaisi > prixSuggere) {
          toast({
            title: "Montant dépasse le prix suggéré",
            description: `Le total des paiements ne doit pas dépasser ${prixSuggere.toLocaleString(
              "fr-FR"
            )} DH.`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    setPaiements(prev => {
      const newPaiements = [...prev]
      newPaiements[index] = {
        ...newPaiements[index],
        [field]: value
      }
      return newPaiements
    })
  }

  // Helper function pour vérifier si un fichier/URL est un PDF (case-insensitive)
  const isPdfFile = (fileNameOrUrl: string | null | undefined): boolean => {
    if (!fileNameOrUrl || typeof fileNameOrUrl !== 'string') return false;
    const lower = fileNameOrUrl.toLowerCase();
    return lower.includes('.pdf') || lower.endsWith('.pdf') || /\.pdf(\?|$|#)/i.test(fileNameOrUrl);
  };

  // Fonction pour vérifier si le fichier est une image
  const isImageFile = (url: string) => {
    return url.match(/\.(jpeg|jpg|gif|png)$/i) != null;
  };

  // Fonction pour corriger l'URL Cloudinary pour les PDFs
  const fixCloudinaryUrlForPdf = (url: string): string => {
    if (!url || typeof url !== 'string') return url;
    
    // Si c'est une URL Cloudinary avec /image/upload/ et que c'est un PDF
    // Ne pas corriger car le fichier est vraiment stocké dans /image/upload/
    // Cloudinary peut servir les PDFs depuis /image/upload/ aussi
    // On garde l'URL originale
    if (url.includes('cloudinary.com') && url.includes('/image/upload/') && isPdfFile(url)) {
      // L'URL est correcte, Cloudinary peut servir les PDFs depuis /image/upload/
      return url;
    }
    return url;
  };

  // Fonction pour uploader vers Cloudinary

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: DocumentType) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      // Stocker le fichier localement pour l'aperçu (pas d'upload vers Cloudinary maintenant)
      setDocuments(prev => ({
        ...prev,
        [type]: file
      }));
      setAttachmentStatus(prev => ({
        ...prev,
        [type]: true
      }));
      
      // Créer l'aperçu local
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviews(prev => ({
            ...prev,
            [type]: { url: reader.result as string, type: file.type }
          }));
        };
        reader.readAsDataURL(file);

        if (type === "passport") {
          void (async () => {
            setOcrProcessingPassport(true);
            try {
              const fd = new FormData();
              fd.append("file", file);
              const res = await fetch("/api/passport-ocr", {
                method: "POST",
                body: fd,
              });
              const json = (await res.json()) as {
                status?: string;
                data?: OcrExtractData;
                error?: string;
              };
              if (!res.ok) {
                throw new Error(json.error || "Service OCR indisponible");
              }
              const raw = json.data || {};
              setOcrValidation({
                firstName: String(raw.first_name ?? "").trim(),
                lastName: String(raw.last_name ?? "").trim(),
                passport: formatPassportInput(
                  String(raw.passport ?? raw.personal_id_number ?? "").trim()
                ),
                sex: typeof raw.sex === "string" ? raw.sex : undefined,
              });
            } catch (err) {
              toast({
                title: "Lecture automatique du passeport",
                description:
                  err instanceof Error
                    ? err.message
                    : "Impossible d’analyser l’image. Vous pouvez saisir les champs manuellement.",
                variant: "destructive",
              });
            } finally {
              setOcrProcessingPassport(false);
            }
          })();
        }
      } else if (file.type === 'application/pdf') {
        setPreviews(prev => ({
          ...prev,
          [type]: { url: URL.createObjectURL(file), type: file.type }
        }));
      }
      
      console.log('🔍 Debug - File selected locally:', {
        type,
        fileName: file.name,
        fileType: file.type,
        localPreview: true
      });
    } else {
      toast({
        title: "Erreur",
        description: "Format de fichier non supporté. Seuls les fichiers PDF et images sont acceptés.",
        variant: "destructive",
      });
    }
  };

  const applyOcrValidation = () => {
    if (!ocrValidation) return;
    const genderFromOcr = mapOcrSexToGender(ocrValidation.sex);
    setFormData((prev) => ({
      ...prev,
      nom: ocrValidation.lastName || prev.nom,
      prenom: ocrValidation.firstName || prev.prenom,
      passportNumber: ocrValidation.passport
        ? formatPassportInput(ocrValidation.passport)
        : prev.passportNumber,
      ...(genderFromOcr ? { gender: genderFromOcr } : {}),
    }));
    setOcrValidation(null);
    toast({
      title: "Données appliquées",
      description: "Les informations extraites du passeport ont été appliquées.",
    });
  };

  const handleRemoveDocument = (type: DocumentType) => {
    setDocuments(prev => ({
      ...prev,
      [type]: null
    }))
    setPreviews(prev => {
      const newPreviews = { ...prev }
      delete newPreviews[type]
      return newPreviews
    })
    setAttachmentStatus(prev => ({
      ...prev,
      [type]: false
    }));
    
  }

  // Composant pour afficher la prévisualisation d'un document
  const DocumentPreview = ({ url, title, onZoom }: { url: string; title: string; onZoom: () => void }) => {
    if (!url) return null;

    return (
      <div className="relative group">
        {isImageFile(url) ? (
          <div className="relative w-full rounded-lg overflow-hidden border-2 border-blue-200">
            <img
              src={url}
              alt={title}
              className="w-full h-auto object-contain cursor-pointer"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onZoom();
              }}
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                type="button"
                className="text-white hover:text-white hover:bg-white/20 p-2 rounded"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onZoom();
                }}
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full rounded-lg border-2 border-blue-200 flex items-center justify-center bg-blue-50 p-4">
            <FileText className="h-8 w-8 text-blue-500" />
          </div>
        )}
      </div>
    );
  };

  // Correction du handler pour gérer un fichier par paiement
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
    
    // Stocker le fichier localement pour l'aperçu (pas d'upload vers Cloudinary maintenant)
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
    
    console.log('🔍 Debug - Payment file selected locally:', {
      index,
      fileName: file.name,
      fileType: file.type,
      localPreview: true
    });
  };

  const canGeneratePaymentReceipt = (index: number) => {
    const paiement = paiements[index];
    if (!paiement) return false;
    const montant = Number(paiement.montant);
    return Boolean(
      paiement.type &&
      !Number.isNaN(montant) &&
      montant > 0 &&
      formData.nom.trim() &&
      formData.prenom.trim() &&
      formData.telephone.trim()
    );
  };

  const handleGeneratePaymentReceipt = async (index: number) => {
    const paiement = paiements[index];
    if (!paiement || !canGeneratePaymentReceipt(index)) return;

    const montant = Number(paiement.montant) || 0;
    const paymentDate = paiement.date || new Date().toISOString().slice(0, 10);
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
    ctx.fillText(`Type: ${paiement.type}`, 60, 475);
    ctx.fillText(`Montant: ${montant.toLocaleString("fr-FR")} DH`, 60, 510);

    ctx.fillStyle = "#6b7280";
    ctx.font = "18px Arial";
    ctx.fillText("Document genere automatiquement depuis la page Nouvelle reservation.", 60, 610);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) {
      toast({
        title: "Erreur",
        description: "Generation du recu echouee.",
        variant: "destructive",
      });
      return;
    }

    const fileName = `recu-${Date.now()}.png`;
    const file = new File([blob], fileName, { type: "image/png" });

    setDocuments((prev) => {
      const newPayments = [...(prev.payment || [])];
      newPayments[index] = file;
      return { ...prev, payment: newPayments };
    });
    mettreAJourPaiement(index, "recu", file.name);
    setPreviews((prev) => ({
      ...prev,
      [`payment_${index}`]: { url: URL.createObjectURL(file), type: file.type },
    }));

    toast({
      title: "Recu genere",
      description: "Le recu est attache et sera enregistre avec la reservation.",
    });
  };

  const handleRemovePayment = (index: number) => {
    setPaiements(prev => prev.filter((_, i) => i !== index))
    setDocuments(prev => {
      const newPayment = [...(prev.payment || [])]
      newPayment.splice(index, 1)
      return { ...prev, payment: newPayment }
    })
    setPreviews(prev => {
      const newPreviews = { ...prev }
      delete newPreviews[`payment_${index}`]
      return newPreviews
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const telephone = (formData.telephone || "").trim();
    const passportNumber = (formData.passportNumber || "").trim();
    if (!PHONE_REGEX.test(telephone)) {
      toast({
        title: "Téléphone invalide",
        description: "Format attendu: +XXX XXXXXXXXX (ex: +212 123456789).",
        variant: "destructive",
      });
      return;
    }
    if (passportNumber && !PASSPORT_REGEX.test(passportNumber)) {
      toast({
        title: "Passeport invalide",
        description: "Format attendu: 2 lettres + 7 chiffres (ex: AB1234567).",
        variant: "destructive",
      });
      return;
    }

    const hasIncompletePayment = paiements.some((paiement, index) => {
      const montantVide = paiement.montant === "" || Number.isNaN(Number(paiement.montant));
      const typeVide = paiement.type === "";

      return montantVide || typeVide;
    });

    if (hasIncompletePayment) {
      toast({
        title: "Paiement incomplet",
        description: "Merci de renseigner le mode et le montant pour chaque paiement ajouté.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Calculer la somme des montants des paiements juste avant l'insertion
    const paidAmount = paiements.reduce((total, p) => total + (Number(p.montant) || 0), 0);
    const suggestedPrice = Number(formData.prix) || 0;
    if (suggestedPrice > 0 && paidAmount > suggestedPrice) {
      toast({
        title: "Montant de paiements invalide",
        description: `Le total des paiements (${paidAmount.toLocaleString(
          "fr-FR"
        )} DH) dépasse le prix suggéré (${suggestedPrice.toLocaleString(
          "fr-FR"
        )} DH).`,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Déterminer le statut de la réservation
    const allDocsAttached = attachmentStatus.passport && attachmentStatus.visa && attachmentStatus.flightBooked && attachmentStatus.hotelBooked;
    const isPaid = paidAmount === parseInt(formData.prix, 10);
    const reservationStatus = allDocsAttached && isPaid ? "Complet" : "Incomplet";

    // Réinitialiser les statuts d'upload
    setUploadedStatus({
      passport: false,
      visa: false,
      hotelBooked: false,
      flightBooked: false,
      payment: false
    });

    // Déclare l'objet local fichierIds ici
    const fichierIds: { visa: number | null, flightBooked: number | null, hotelBooked: number | null } = { visa: null, flightBooked: null, hotelBooked: null };

    try {
      // Construire l'objet documents pour indiquer les statuts d'attachement
      const documentsStatus = {
        passport: !!documents.passport,
        visa: !!documents.visa,
        hotelBooked: !!documents.hotelBooked,
        flightBooked: !!documents.flightBooked,
        payment: documents.payment && documents.payment.length > 0
      };

      // 1. Créer d'abord la réservation
      
      const reservationResponse = await api.request(api.url(api.endpoints.reservations), {
        method: "POST",
        body: JSON.stringify({
          firstName: formData.prenom,
          lastName: formData.nom,
          phone: formData.telephone,
          passportNumber: formData.passportNumber || null,
          groupe: formData.groupe || null,
          remarque: formData.remarque || null,
          transport: formData.transport ? 'Oui' : null,
          programId: parseInt(formData.programId),
          roomType: formData.typeChambre,
          gender: formData.gender,
          hotelMadina: hotelsMadina.find(h => h.id.toString() === formData.hotelMadina)?.name || formData.hotelMadina,
          hotelMakkah: hotelsMakkah.find(h => h.id.toString() === formData.hotelMakkah)?.name || formData.hotelMakkah,
          price: parseInt(formData.prix, 10),
          reduction: reduction || 0,
          reservationDate: formData.dateReservation,
          status: reservationStatus,
          statutPasseport: attachmentStatus.passport,
          statutVisa: customization.includeVisa ? formData.statutVisa : false,
          statutHotel: (formData.hotelMadina !== "none" || formData.hotelMakkah !== "none") ? formData.statutHotel : false,
          statutVol: customization.includeAvion ? formData.statutVol : false,
          paidAmount: paidAmount,
          plan: customization.plan,
          // Ajouter les IDs des chambres sélectionnées
          roomMadinaId: Object.keys(selectedPlacesMadina)[0] ? parseInt(Object.keys(selectedPlacesMadina)[0]) : null,
          roomMakkahId: Object.keys(selectedPlacesMakkah)[0] ? parseInt(Object.keys(selectedPlacesMakkah)[0]) : null
        }),
      });

      if (!reservationResponse.ok) {
        const errorData = await reservationResponse.json();
        throw new Error(errorData.error || "Erreur lors de la création de la réservation");
      }

      const reservation = await reservationResponse.json();
      const reservationId = reservation.id;

      // 2. Upload all files with the reservation ID
      const fileUploadPromises = [];
      const fileUploadErrors: string[] = [];
      const newUploadedStatus = { ...uploadedStatus };

      // Passeport - Upload vers Cloudinary et création du fichier
      if (documents.passport) {
        try {
          const formDataPassport = new FormData();
          formDataPassport.append("file", documents.passport);
          formDataPassport.append("reservationId", reservationId.toString());
          formDataPassport.append("fileType", "passport");

          const response = await fetch(api.url(api.endpoints.uploadCloudinary), {
            method: "POST",
            body: formDataPassport,
          });
          
          if (response.ok) {
            const data = await response.json();
            const uploadedFile = data.results && data.results[0];
            const fichierId = uploadedFile && uploadedFile.id;
            
            if (fichierId) {
              console.log('✅ Passport uploaded to Cloudinary with fichierId:', fichierId);
              newUploadedStatus.passport = true;
            } else {
              fileUploadErrors.push('Erreur: Aucun fichierId retourné pour le passeport');
            }
          } else {
            const error = await response.json();
            fileUploadErrors.push(`Erreur lors de l'upload du passeport vers Cloudinary: ${error.error || 'Erreur inconnue'}`);
          }
        } catch (error) {
          console.error('❌ Erreur upload passeport:', error);
          fileUploadErrors.push('Erreur lors de l\'upload du passeport');
        }
      }

      // Visa
      if (documents.visa) {
        const formDataVisa = new FormData();
        formDataVisa.append("visa", documents.visa);
        formDataVisa.append("reservationId", reservationId.toString());
        fileUploadPromises.push(
          fetch(api.url(api.endpoints.upload), {
            method: "POST",
            body: formDataVisa,
          }).then(async (response) => {
            if (response.ok) {
              newUploadedStatus.visa = true;
              const data = await response.json();
              fichierIds.visa = data.files && data.files[0] && data.files[0].id;
            } else {
              const error = await response.json();
              fileUploadErrors.push(`Erreur lors de l'upload du visa: ${error.error}`);
            }
            return response;
          })
        );
      }

      // Billet d'avion
      if (documents.flightBooked) {
        const formDataBillet = new FormData();
        formDataBillet.append("flightBooked", documents.flightBooked);
        formDataBillet.append("reservationId", reservationId.toString());
        fileUploadPromises.push(
          fetch(api.url(api.endpoints.upload), {
            method: "POST",
            body: formDataBillet,
          }).then(async (response) => {
            if (response.ok) {
              newUploadedStatus.flightBooked = true;
              const data = await response.json();
              fichierIds.flightBooked = data.files && data.files[0] && data.files[0].id;
            } else {
              const error = await response.json();
              fileUploadErrors.push(`Erreur lors de l'upload du billet: ${error.error}`);
            }
            return response;
          })
        );
      }

      // Réservation hôtel
      if (documents.hotelBooked) {
        const formDataHotel = new FormData();
        formDataHotel.append("hotelBooked", documents.hotelBooked);
        formDataHotel.append("reservationId", reservationId.toString());
        fileUploadPromises.push(
          fetch(api.url(api.endpoints.upload), {
            method: "POST",
            body: formDataHotel,
          }).then(async (response) => {
            if (response.ok) {
              newUploadedStatus.hotelBooked = true;
              const data = await response.json();
              fichierIds.hotelBooked = data.files && data.files[0] && data.files[0].id;
            } else {
              const error = await response.json();
              fileUploadErrors.push(`Erreur lors de l'upload de la réservation hôtel: ${error.error}`);
            }
            return response;
          })
        );
      }

      // Reçus de paiement (paiements avec fichier) - Utilisation de Cloudinary
      let paymentErrors: string[] = [];
      if (documents.payment && documents.payment.length > 0) {
        let paymentUploaded = false;
        await Promise.all(documents.payment.map(async (file, index) => {
          if (!file) return;
          
          const formDataPaiement = new FormData();
          formDataPaiement.append("file", file);
          formDataPaiement.append("reservationId", reservationId.toString());
          formDataPaiement.append("fileType", "payment");

          // Utiliser le nouvel endpoint Cloudinary
          const response = await fetch(api.url(api.endpoints.uploadCloudinary), {
            method: "POST",
            body: formDataPaiement,
          });
          
          if (response.ok) {
            paymentUploaded = true;
            // Récupérer les données du fichier uploadé vers Cloudinary
            const data = await response.json();
            const uploadedFile = data.results && data.results[0];
            const fichierId = uploadedFile && uploadedFile.id;
            
            
            // Insérer le paiement avec le fichierId
            const paiement = paiements[index];
            if (paiement && fichierId) {
              
              const paymentResponse = await fetch(api.url(api.endpoints.payments), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  amount: parseFloat(paiement.montant),
                  type: paiement.type,
                  reservationId: reservationId,
                  fichierId: fichierId,
                  programId: formData.programId
                })
              });
              
              const paymentData = await paymentResponse.clone().json();
              
              if (!paymentResponse.ok || !paymentData.id) {
                paymentErrors.push(`Erreur lors de l'insertion du paiement ${index + 1}: ${paymentData.error || 'Aucune confirmation de la base'}`);
              } else {
              }
            }
          } else {
            const error = await response.json();
            fileUploadErrors.push(`Erreur lors de l'upload du reçu de paiement ${index + 1} vers Cloudinary: ${error.error || error.details || 'Erreur inconnue'}`);
          }
        }));
        if (paymentUploaded) newUploadedStatus.payment = true;
      }

      // Paiements SANS fichier (toujours après la création de la réservation)
      await Promise.all(paiements.map(async (paiement, index) => {
        // Si ce paiement n'a pas de fichier associé dans documents.payment
        if (!documents.payment || !documents.payment[index]) {
          if (paiement.montant && paiement.type) {
            const paymentResponse = await fetch(api.url(api.endpoints.payments), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount: parseFloat(paiement.montant),
                type: paiement.type,
                reservationId: reservationId,
                programId: formData.programId
              })
            });
            const paymentData = await paymentResponse.clone().json();
            if (!paymentResponse.ok || !paymentData.id) {
              paymentErrors.push(`Erreur lors de l'insertion du paiement ${index + 1}: ${paymentData.error || 'Aucune confirmation de la base'}`);
            }
          }
        }
      }));

      // Attendre que tous les fichiers soient uploadés
      await Promise.all(fileUploadPromises);
      setUploadedStatus(newUploadedStatus);

      // Insertion des Expenses automatiques basées sur les services activés
      const expenseErrors: string[] = [];
      const expensesToCreate = [];

      // 1. Expense pour le service de vol (si activé)
      if (customization.includeAvion && programInfo) {
        const volExpense = {
          description: `Service de vol pour ${formData.prenom} ${formData.nom}`,
          amount: programInfo.prixAvionDH, // Montant en Dirhams
          date: new Date().toISOString(),
          type: 'Vol',
          fichierId: fichierIds.flightBooked || null,
          programId: parseInt(formData.programId),
          reservationId: reservationId
        };
        expensesToCreate.push(volExpense);
      }

      // 2. Expense pour le service de visa (si activé)
      if (customization.includeVisa && programInfo) {
        const visaExpense = {
          description: `Service de visa pour ${formData.prenom} ${formData.nom}`,
          amount: programInfo.prixVisaRiyal * programInfo.exchange, // Montant en Dirhams (Riyal * exchange)
          date: new Date().toISOString(),
          type: 'Visa',
          fichierId: fichierIds.visa || null,
          programId: parseInt(formData.programId),
          reservationId: reservationId
        };
        expensesToCreate.push(visaExpense);
      }

      // 3. Expense pour l'hôtel Madina (si sélectionné)
      if (formData.hotelMadina !== "none" && programInfo) {
        const roomMadina = programInfo.rooms.find(r => 
          r.hotelId === parseInt(formData.hotelMadina) && 
          r.roomType === formData.typeChambre && 
          (r.gender === formData.gender || r.gender === 'Mixte')
        );
        
        if (roomMadina) {
          const nbPersonnes = {
            'SINGLE': 1, 'DOUBLE': 2, 'TRIPLE': 3, 'QUAD': 4, 'QUINT': 5
          }[formData.typeChambre] || 1;
          
          const montantHotelMadina = (roomMadina.prixRoom / nbPersonnes) * customization.joursMadina;
          
          const hotelMadinaExpense = {
            description: `Service hôtel Madina pour ${formData.prenom} ${formData.nom}`,
            amount: montantHotelMadina * programInfo.exchange, // Montant en Dirhams (Riyal * exchange)
            date: new Date().toISOString(),
            type: 'Hotel Madina',
            fichierId: fichierIds.hotelBooked || null,
            programId: parseInt(formData.programId),
            reservationId: reservationId
          };
          expensesToCreate.push(hotelMadinaExpense);
        }
      }

      // 4. Expense pour l'hôtel Makkah (si sélectionné)
      if (formData.hotelMakkah !== "none" && programInfo) {
        const roomMakkah = programInfo.rooms.find(r => 
          r.hotelId === parseInt(formData.hotelMakkah) && 
          r.roomType === formData.typeChambre && 
          (r.gender === formData.gender || r.gender === 'Mixte')
        );
        
        if (roomMakkah) {
          const nbPersonnes = {
            'SINGLE': 1, 'DOUBLE': 2, 'TRIPLE': 3, 'QUAD': 4, 'QUINT': 5
          }[formData.typeChambre] || 1;
          
          const montantHotelMakkah = (roomMakkah.prixRoom / nbPersonnes) * customization.joursMakkah;
          
          const hotelMakkahExpense = {
            description: `Service hôtel Makkah pour ${formData.prenom} ${formData.nom}`,
            amount: montantHotelMakkah * programInfo.exchange, // Montant en Dirhams (Riyal * exchange)
            date: new Date().toISOString(),
            type: 'Hotel Makkah',
            fichierId: fichierIds.hotelBooked || null,
            programId: parseInt(formData.programId),
            reservationId: reservationId
          };
          expensesToCreate.push(hotelMakkahExpense);
        }
      }

      // Créer toutes les expenses
      
      await Promise.all(expensesToCreate.map(async (expense, index) => {
        
        const expenseResponse = await fetch(api.url(api.endpoints.expenses), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expense)
        });
        
        let expenseData = null;
        try {
          expenseData = await expenseResponse.clone().json();
        } catch (e) {
          console.error('Erreur parsing JSON Expense:', e);
        }
        
        
        if (!expenseResponse.ok || !expenseData || !expenseData.id) {
          console.error('Erreur lors de l\'insertion de la dépense:', expenseData);
          expenseErrors.push(`Erreur lors de l'insertion de la dépense ${expense.type}: ${expenseData?.error || 'Aucune confirmation de la base'}`);
        } else {
        }
      }));

      if (expenseErrors.length > 0) {
        throw new Error([...fileUploadErrors, ...paymentErrors, ...expenseErrors].join('\n'));
      }

      // PATCH la réservation pour mettre à jour les statuts
      await api.request(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          statutPasseport: newUploadedStatus.passport,
          statutVisa: customization.includeVisa ? formData.statutVisa : false,
          statutHotel: (formData.hotelMadina !== "none" || formData.hotelMakkah !== "none") ? formData.statutHotel : false,
          statutVol: customization.includeAvion ? formData.statutVol : false
        }),
      });

      toast({
        title: "Succès",
        description: "La réservation, les documents et les dépenses fournisseur ont été enregistrés avec succès",
      });

      // Attendre un court instant pour que le toast soit visible
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Rediriger vers la page des réservations
      router.push("/reservations");
    } catch (error) {
      console.error("Erreur lors de la création de la réservation:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de la création de la réservation",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {/* Layout en 1 colonne : Formulaire prend toute la page */}
        <div className="grid grid-cols-1 gap-6">
          {/* Colonne principale - Formulaire */}
          <div className="w-full">
            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm h-full">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4">
                <CardTitle className="text-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6" />
                  Nouvelle Réservation
                  </div>
                  {calculatePrice > 0 && (
                    <div className={`
                      flex items-center gap-2 backdrop-blur-sm px-3 py-1.5 rounded-lg border-2 transition-all duration-300
                      ${activeTheme.colors.bg} ${activeTheme.colors.border} ${activeTheme.colors.glow} shadow-lg
                    `}>
                      <Wallet className={`h-4 w-4 ${activeTheme.colors.textActive}`} />
                      <span className={`text-sm font-medium ${activeTheme.colors.text}`}>Prix:</span>
                      <span className={`text-lg font-bold ${activeTheme.colors.textActive}`}>
                        {formData.prix
                          ? parseInt(formData.prix, 10).toLocaleString('fr-FR')
                          : Math.round(calculatePrice).toLocaleString('fr-FR')} DH
                      </span>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <form onSubmit={handleSubmit}>
                {/* Section 1: Champs pour calculer le prix */}
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        Configuration du Voyage
                      </h3>
                      {formData.programId && programInfo && (
                        <Button
                          type="button"
                          onClick={() => setIsCustomizationOpen(!isCustomizationOpen)}
                          variant="ghost"
                          size="sm"
                          className="text-blue-700 hover:bg-blue-200 hover:text-blue-800 transition-all"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          {isCustomizationOpen ? 'Masquer' : 'Éditer'}
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-blue-700 font-medium text-sm">Programme *</Label>
                        <Select
                          value={formData.programme}
                          onValueChange={(value) => {
                            console.log('🔄 Programme sélectionné:', value);
                            const selectedProgram = programs.find(p => p.name === value);
                            console.log('📦 Programme trouvé:', selectedProgram);
                            
                            setFormData(prev => ({
                              ...prev,
                              programme: value,
                              programId: selectedProgram?.id.toString() || "",
                              hotelMadina: "", // Réinitialiser les hôtels lors du changement de programme
                              hotelMakkah: ""
                            }));
                            
                            console.log('✅ FormData mis à jour avec programId:', selectedProgram?.id.toString());
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

                      <div className="space-y-2">
                        <Label className="text-blue-700 font-medium text-sm">Plan *</Label>
                        {/* Enhanced Plan Selection - Compact Segmented Control */}
                        <div 
                          className={`
                            relative h-10 rounded-lg border-2 transition-all duration-300 ease-in-out
                            ${activeTheme.colors.border} ${activeTheme.colors.bg}
                            ${activeTheme.colors.glow} shadow-md
                            hover:shadow-lg
                          `}
                        >
                          <div className="grid grid-cols-3 h-full gap-1 p-1">
                            {Object.entries(planThemes).map(([planKey, theme]) => {
                              const Icon = theme.icon;
                              const isSelected = customization.plan === planKey;
                              
                              return (
                                <button
                                  key={planKey}
                                  type="button"
                                  onClick={() => {
                                    setCustomization(prev => ({ ...prev, plan: planKey }));
                                  }}
                                  className={`
                                    relative flex items-center justify-center gap-1.5 rounded-md
                                    transition-all duration-300 ease-in-out
                                    ${isSelected 
                                      ? `${activeTheme.colors.bg} ${activeTheme.colors.borderActive} border shadow-sm` 
                                      : 'bg-white border border-transparent hover:border-gray-300 hover:bg-gray-50'
                                    }
                                    focus:outline-none focus:ring-2 ${activeTheme.colors.ring} focus:ring-offset-1
                                  `}
                                >
                                  {/* Icon */}
                                  <Icon 
                                    className={`
                                      h-4 w-4 transition-all duration-300
                                      ${isSelected 
                                        ? `${activeTheme.colors.textActive}` 
                                        : 'text-gray-400'
                                      }
                                    `}
                                  />
                                  
                                  {/* Plan Name */}
                                  <span className={`
                                    text-xs font-medium transition-colors duration-300
                                    ${isSelected 
                                      ? activeTheme.colors.textActive 
                                      : 'text-gray-500'
                                    }
                                  `}>
                                    {theme.name}
                                  </span>
                                  
                                  {/* Active Indicator */}
                                  {isSelected && (
                                    <div 
                                      className={`
                                        absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full
                                        ${activeTheme.colors.badge} border ${activeTheme.colors.borderActive}
                                      `}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                  {/* Section de personnalisation compacte */}
                  {isCustomizationOpen && formData.programId && programInfo && (
                    <div className="mt-4 mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-8">
                        {/* Services inclus */}
                        <div className="flex items-center gap-6">
                          <span className="text-sm font-semibold text-blue-700">Services:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">✈️</span>
                            <span className="text-sm font-medium text-blue-700">Avion</span>
                            <Switch
                              checked={customization.includeAvion}
                              onCheckedChange={(checked) => 
                                setCustomization(prev => ({ ...prev, includeAvion: checked }))
                              }
                              className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📄</span>
                            <span className="text-sm font-medium text-blue-700">Visa</span>
                            <Switch
                              checked={customization.includeVisa}
                              onCheckedChange={(checked) => 
                                setCustomization(prev => ({ ...prev, includeVisa: checked }))
                              }
                              className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                          </div>
                        </div>
                        
                        {/* Séparateur */}
                        <div className="w-px h-8 bg-blue-300"></div>
                        
                        {/* Durée du séjour */}
                        <div className="flex items-center gap-6">
                          <span className="text-sm font-semibold text-blue-700">Durée:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🕌</span>
                            <span className="text-sm font-medium text-blue-700">Madina</span>
                            <Input
                              type="number"
                              min="0"
                              value={customization.joursMadina}
                              onChange={(e) => 
                                setCustomization(prev => ({ 
                                  ...prev, 
                                  joursMadina: parseInt(e.target.value) || 0 
                                }))
                              }
                              className="w-16 h-8 text-xs border border-blue-200 focus:border-blue-500 rounded text-center"
                              placeholder="Jours"
                            />
                            <span className="text-xs text-blue-500">(déf: {programInfo.nbJoursMadina})</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🕋</span>
                            <span className="text-sm font-medium text-blue-700">Makkah</span>
                            <Input
                              type="number"
                              min="0"
                              value={customization.joursMakkah}
                              onChange={(e) => 
                                setCustomization(prev => ({ 
                                  ...prev, 
                                  joursMakkah: parseInt(e.target.value) || 0 
                                }))
                              }
                              className="w-16 h-8 text-xs border border-blue-200 focus:border-blue-500 rounded text-center"
                              placeholder="Jours"
                            />
                            <span className="text-xs text-blue-500">(déf: {programInfo.nbJoursMakkah})</span>
                          </div>
                        </div>
                        
                        {/* Séparateur */}
                        <div className="w-px h-8 bg-blue-300"></div>
                        
                        {/* Bouton réinitialiser */}
                        <Button
                          type="button"
                          onClick={() => {
                            setCustomization({
                              ...customization,
                              includeAvion: true,
                              includeVisa: true,
                              joursMadina: programInfo.nbJoursMadina,
                              joursMakkah: programInfo.nbJoursMakkah
                            });
                          }}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          Réinitialiser
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Choix des hôtels */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Hôtel à Madina */}
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
                          {formData.hotelMadina === "none" && (
                            <span className="text-xs text-red-600 font-medium px-2 py-1 bg-red-50 rounded-full border border-red-200">
                              Désactivé
                            </span>
                          )}
                        </div>
                                                <Select
                          value={formData.hotelMadina}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, hotelMadina: value }))}
                          disabled={!formData.programId} // Désactiver si aucun programme n'est sélectionné
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
                        
                        {/* Chambres disponibles pour Madina */}
                        {programInfo && programInfo.rooms && formData.hotelMadina && formData.hotelMadina !== "none" && formData.typeChambre && formData.gender && (
                          <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-green-700">🕌 Chambres disponibles à Madina</span>
                            </div>
                            <div className="grid gap-2">
                              {(() => {
                                // Filtrer les rooms selon le type et l'hôtel, incluant les rooms Mixte
                                const filteredRooms = programInfo.rooms.filter(room => 
                                  room.hotelId === parseInt(formData.hotelMadina) && 
                                  room.roomType === formData.typeChambre && 
                                  (room.gender === formData.gender || room.gender === 'Mixte' || !room.gender)
                                );
                                
                                if (filteredRooms.length === 0) {
                                  return (
                                    <div className="text-xs text-gray-500 text-center py-2">
                                      Aucune chambre trouvée
                                    </div>
                                  );
                                }
                                
                                // Trier les rooms selon l'algorithme spécifié
                                const sortedRooms = sortRoomsByAlgorithm(filteredRooms, formData.gender);
                                
                                return sortedRooms.map((room, index) => {
                                  const placesOccupees = room.nbrPlaceTotal - room.nbrPlaceRestantes;
                                  const placesDisponibles = room.nbrPlaceRestantes;
                                  const isSelected = Object.keys(selectedPlacesMadina).includes(room.id.toString());
                                  
                                  // Déterminer l'icône selon le gender
                                  const getGenderIcon = (gender: string) => {
                                    switch (gender) {
                                      case 'Homme': return '👨';
                                      case 'Femme': return '👩';
                                      case 'Mixte': return '👥';
                                      default: return '👥';
                                    }
                                  };
                                  
                                  return (
                                    <div 
                                      key={index} 
                                      className={`relative p-2 rounded border transition-all cursor-pointer ${
                                        isSelected 
                                          ? 'border-yellow-400 bg-yellow-50' 
                                          : 'border-gray-300 bg-white hover:border-blue-300'
                                      }`}
                                      onClick={() => {
                                        if (room.nbrPlaceRestantes > 0) {
                                          const firstAvailablePlace = getFirstAvailablePlace(room);
                                          setSelectedPlacesMadina({ [room.id]: [firstAvailablePlace] });
                                        }
                                      }}
                                    >
                                      {/* Disposition optimisée : ratio à gauche, points centrés, choix à droite */}
                                      <div className="flex items-center">
                                        {/* Ratio à gauche */}
                                        <div className="flex items-center gap-2 w-20">
                                          <span className="text-sm">{getGenderIcon(room.gender)}</span>
                                          <span className="text-xs font-medium text-gray-700">
                                            ({placesDisponibles}/{room.nbrPlaceTotal})
                                          </span>
                                        </div>
                                        
                                        {/* Points des places centrés absolument */}
                                        <div className="flex-1 flex justify-center">
                                          <div className="flex gap-1.5">
                                            {Array.from({ length: room.nbrPlaceTotal }, (_, placeIndex) => {
                                              let placeColor = 'bg-gray-300';
                                              let placeTitle = `Place ${placeIndex + 1}`;
                                              
                                              if (placeIndex < placesOccupees) {
                                                placeColor = 'bg-red-500';
                                                placeTitle = `Place ${placeIndex + 1} occupée`;
                                              } else if (isSelected && selectedPlacesMadina[room.id]?.includes(placeIndex)) {
                                                placeColor = 'bg-yellow-400';
                                                placeTitle = `Place ${placeIndex + 1} - Votre réservation`;
                                              } else {
                                                placeColor = 'bg-green-500';
                                                placeTitle = `Place ${placeIndex + 1} libre`;
                                              }
                                              
                                              return (
                                                <div
                                                  key={placeIndex}
                                                  className={`w-4 h-4 rounded-full ${placeColor} transition-all`}
                                                  title={placeTitle}
                                                />
                                              );
                                            })}
                                          </div>
                                        </div>
                                        
                                        {/* Point de choix à droite */}
                                        <div className="w-8 flex justify-end">
                                          {isSelected && (
                                            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
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

                                            {/* Hôtel à Makkah */}
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
                          {formData.hotelMakkah === "none" && (
                            <span className="text-xs text-red-600 font-medium px-2 py-1 bg-red-50 rounded-full border border-red-200">
                              Désactivé
                            </span>
                          )}
                        </div>
                                                <Select
                          value={formData.hotelMakkah}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, hotelMakkah: value }))}
                          disabled={!formData.programId} // Désactiver si aucun programme n'est sélectionné
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
                        
                        {/* Chambres disponibles pour Makkah */}
                        {programInfo && programInfo.rooms && formData.hotelMakkah && formData.hotelMakkah !== "none" && formData.typeChambre && formData.gender && (
                          <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-green-700">🕋 Chambres disponibles à Makkah</span>
                            </div>
                            <div className="grid gap-2">
                              {(() => {
                                // Filtrer les rooms selon le type et l'hôtel, incluant les rooms Mixte
                                const filteredRooms = programInfo.rooms.filter(room => 
                                  room.hotelId === parseInt(formData.hotelMakkah) && 
                                  room.roomType === formData.typeChambre && 
                                  (room.gender === formData.gender || room.gender === 'Mixte' || !room.gender)
                                );
                                
                                if (filteredRooms.length === 0) {
                                  return (
                                    <div className="text-xs text-gray-500 text-center py-2">
                                      Aucune chambre trouvée
                                    </div>
                                  );
                                }
                                
                                // Trier les rooms selon l'algorithme spécifié
                                const sortedRooms = sortRoomsByAlgorithm(filteredRooms, formData.gender);
                                
                                return sortedRooms.map((room, index) => {
                                  const placesOccupees = room.nbrPlaceTotal - room.nbrPlaceRestantes;
                                  const placesDisponibles = room.nbrPlaceRestantes;
                                  const isSelected = Object.keys(selectedPlacesMakkah).includes(room.id.toString());
                                  
                                  // Déterminer l'icône selon le gender
                                  const getGenderIcon = (gender: string) => {
                                    switch (gender) {
                                      case 'Homme': return '👨';
                                      case 'Femme': return '👩';
                                      case 'Mixte': return '👥';
                                      default: return '👥';
                                    }
                                  };
                                  
                                  return (
                                    <div 
                                      key={index} 
                                      className={`relative p-2 rounded border transition-all cursor-pointer ${
                                        isSelected 
                                          ? 'border-yellow-400 bg-yellow-50' 
                                          : 'border-gray-300 bg-white hover:border-green-300'
                                      }`}
                                      onClick={() => {
                                        if (room.nbrPlaceRestantes > 0) {
                                          const firstAvailablePlace = getFirstAvailablePlace(room);
                                          setSelectedPlacesMakkah({ [room.id]: [firstAvailablePlace] });
                                        }
                                      }}
                                    >
                                      {/* Disposition optimisée : ratio à gauche, points centrés, choix à droite */}
                                      <div className="flex items-center">
                                        {/* Ratio à gauche */}
                                        <div className="flex items-center gap-2 w-20">
                                          <span className="text-sm">{getGenderIcon(room.gender)}</span>
                                          <span className="text-xs font-medium text-gray-700">
                                            ({placesDisponibles}/{room.nbrPlaceTotal})
                                          </span>
                                        </div>
                                        
                                        {/* Points des places centrés absolument */}
                                        <div className="flex-1 flex justify-center">
                                          <div className="flex gap-1.5">
                                            {Array.from({ length: room.nbrPlaceTotal }, (_, placeIndex) => {
                                              let placeColor = 'bg-gray-300';
                                              let placeTitle = `Place ${placeIndex + 1}`;
                                              
                                              if (placeIndex < placesOccupees) {
                                                placeColor = 'bg-red-500';
                                                placeTitle = `Place ${placeIndex + 1} occupée`;
                                              } else if (isSelected && selectedPlacesMakkah[room.id]?.includes(placeIndex)) {
                                                placeColor = 'bg-yellow-400';
                                                placeTitle = `Place ${placeIndex + 1} - Votre réservation`;
                                              } else {
                                                placeColor = 'bg-green-500';
                                                placeTitle = `Place ${placeIndex + 1} libre`;
                                              }
                                              
                                              return (
                                                <div
                                                  key={placeIndex}
                                                  className={`w-4 h-4 rounded-full ${placeColor} transition-all`}
                                                  title={placeTitle}
                                                />
                                              );
                                            })}
                                          </div>
                                        </div>
                                        
                                        {/* Point de choix à droite */}
                                        <div className="w-8 flex justify-end">
                                          {isSelected && (
                                            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
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
                  </div>





                {/* Indicateur des places sélectionnées - MASQUÉ car remplacé par le popup */}
                {/* 
                {(Object.keys(selectedPlacesMadina).length > 0 || Object.keys(selectedPlacesMakkah).length > 0) && (
                  <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200 mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Users className="h-6 w-6 text-blue-600" />
                      <span className="text-lg font-semibold text-blue-800">Places sélectionnées</span>
                    </div>
                    <div className="space-y-3">
                      {Object.keys(selectedPlacesMadina).length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-blue-700 flex items-center gap-2">
                            🕌 Hôtel à Madina
                          </h5>
                          {Object.entries(selectedPlacesMadina).map(([roomId, places]) => (
                            <div key={roomId} className="flex items-center gap-2 text-sm ml-4">
                              <span className="font-medium">Room {roomId}:</span>
                              <div className="flex gap-1">
                                {places.map((placeIndex) => (
                                  <div
                                    key={placeIndex}
                                    className="w-3 h-3 rounded-full bg-yellow-400 border border-yellow-500"
                                    title={`Place ${placeIndex + 1} sélectionnée`}
                                  />
                                ))}
                              </div>
                              <span className="text-gray-600">({places.length} place{places.length > 1 ? 's' : ''})</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {Object.keys(selectedPlacesMakkah).length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-blue-700 flex items-center gap-2">
                            🕋 Hôtel à Makkah
                          </h5>
                          {Object.entries(selectedPlacesMakkah).map(([roomId, places]) => (
                            <div key={roomId} className="flex items-center gap-2 text-sm ml-4">
                              <span className="font-medium">Room {roomId}:</span>
                              <div className="flex gap-1">
                                {places.map((placeIndex) => (
                                  <div
                                    key={placeIndex}
                                    className="w-3 h-3 rounded-full bg-yellow-400 border border-yellow-500"
                                    title={`Place ${placeIndex + 1} sélectionnée`}
                                  />
                                ))}
                              </div>
                              <span className="text-gray-600">({places.length} place{places.length > 1 ? 's' : ''})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                */}

                {/* Légende du système de couleurs - MASQUÉ car remplacé par le popup */}
                {/* 
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Guide des chambres
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <span className="text-gray-700">🟡 Votre réservation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-gray-700">🟢 Place libre</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-gray-700">🔴 Place occupée</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    <p><strong>Note :</strong> Cliquez sur une room pour sélectionner automatiquement la première place libre. 
                    Sélection indépendante pour Madina et Makkah.</p>
                  </div>
                </div>
                */}

                {/* Section 2: Informations Client */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informations Client
                    {section1Complete && <CheckCircle className="h-5 w-5 text-green-500" />}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-blue-700">Nom *</Label>
                          <Input
                            value={formData.nom}
                            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                            placeholder="Nom du client"
                            className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-blue-700">Prénom *</Label>
                          <Input
                            value={formData.prenom}
                            onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                            placeholder="Prénom du client"
                            className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-blue-700">Téléphone *</Label>
                          <div className="flex items-center gap-2">
                            <div className="relative w-24">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 font-semibold">
                                +
                              </span>
                              <Input
                                placeholder="212"
                                value={(formData.telephone || "").match(/^\+(\d{0,3})/)?.[1] || ""}
                                onChange={(e) => {
                                  const code = e.target.value.replace(/\D/g, "").slice(0, 3);
                                  const local = ((formData.telephone || "").replace(/^\+\d{0,3}\s?/, ""))
                                    .replace(/\D/g, "")
                                    .slice(0, 9);
                                  setFormData({
                                    ...formData,
                                    telephone: formatPhoneInput(code || local ? `+${code}${local}` : ""),
                                  });
                                }}
                                inputMode="numeric"
                                maxLength={3}
                                className="h-10 pl-7 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                              />
                            </div>
                            <Input
                              placeholder="123456789"
                              value={(formData.telephone || "").replace(/^\+\d{0,3}\s?/, "")}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  telephone: formatPhoneInput(
                                    `+${
                                      (formData.telephone || "").match(/^\+(\d{0,3})/)?.[1] || ""
                                    }${e.target.value.replace(/\D/g, "").slice(0, 9)}`
                                  ),
                                })
                              }
                              inputMode="numeric"
                              maxLength={9}
                              className="h-10 flex-1 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-blue-700">Groupe</Label>
                          <Input
                            value={formData.groupe}
                            onChange={(e) => setFormData({ ...formData, groupe: e.target.value })}
                            placeholder="Nom du groupe"
                            className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 items-end">
                        <div className="space-y-1">
                          <Label className="text-xs text-blue-700">Genre</Label>
                          <Select
                            value={formData.gender}
                            onValueChange={(value) =>
                              setFormData({ ...formData, gender: value })
                            }
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
                        <div className="space-y-1">
                          <Label className="text-xs text-blue-700">N° passeport</Label>
                          <Input
                            value={formData.passportNumber}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                passportNumber: formatPassportInput(e.target.value),
                              })
                            }
                            placeholder="AB1234567"
                            maxLength={9}
                            className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <div className="space-y-1">
                          <Label className="text-xs text-blue-700">Transport</Label>
                          <div className="flex items-center gap-2 h-10 px-3 border-2 border-blue-200 rounded-lg bg-white">
                            <Switch
                              checked={formData.transport || false}
                              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, transport: checked }))}
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
                            onChange={(e) => setFormData({ ...formData, remarque: e.target.value })}
                            placeholder="Remarques additionnelles"
                            className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-blue-700 font-medium text-sm">Passeport *</Label>
                      {!documents.passport && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            ref={(el) => {
                              if (el) fileInputs.current.passeport = el;
                            }}
                            onChange={(e) => handleFileChange(e, "passport")}
                            accept="image/*,.pdf"
                            className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                            disabled={isSubmitting}
                          />
                        </div>
                      )}
                      {ocrProcessingPassport && (
                        <p className="text-xs text-blue-600 animate-pulse">
                          Analyse OCR du passeport en cours…
                        </p>
                      )}
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
                                  setPreviewImage({ url: previews.passport.url, title: "Passeport", type: previews.passport.type });
                                }}
                              >
                                <ZoomIn className="h-3 w-3 mr-1" />
                                Zoom
                              </button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveDocument("passport")}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Supprimer
                              </Button>
                            </div>
                          </div>
                          <div className="w-full h-[190px] overflow-hidden rounded-lg border border-blue-200">
                            {previews.passport?.type === "application/pdf" ? (
                              previews.passport.url.startsWith("blob:") || previews.passport.url.startsWith("data:") ? (
                                <embed
                                  src={previews.passport.url}
                                  type="application/pdf"
                                  className="w-full h-full"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                  <a
                                    href={previews.passport.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-col items-center justify-center gap-2 p-4 hover:bg-blue-50 rounded-lg transition-colors"
                                  >
                                    <FileText className="h-16 w-16 text-red-600" />
                                    <span className="text-sm font-medium text-blue-700">Voir le PDF</span>
                                  </a>
                                </div>
                              )
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
                                type="text"
                                value={paiement.montant}
                                onChange={(e) => mettreAJourPaiement(index, "montant", e.target.value)}
                                placeholder="Montant en dirhams"
                                className="h-10 border-2 border-orange-200 focus:border-orange-500 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                            <div className="md:col-span-6 space-y-2">
                              <Label className="text-orange-700 font-medium text-sm">Reçu de paiement</Label>
                              <div className="flex items-center gap-2">
                                {!documents.payment?.[index] && (
                                  <>
                                    <Input
                                      type="file"
                                      onChange={e => handlePaymentFileChange(e, index)}
                                      accept="image/*,.pdf"
                                      className="h-10 border-2 border-orange-200 focus:border-orange-500 rounded-lg"
                                      disabled={isSubmitting}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleGeneratePaymentReceipt(index)}
                                      disabled={isSubmitting || !canGeneratePaymentReceipt(index)}
                                      className="h-10 border-orange-300 text-orange-700 hover:bg-orange-50 whitespace-nowrap"
                                      title="Genere un recu automatique"
                                    >
                                      <Download className="h-3.5 w-3.5 mr-1.5" />
                                      Generer recu
                                    </Button>
                                  </>
                                )}
                                {documents.payment?.[index] && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      mettreAJourPaiement(index, 'recu', null);
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
                              {previews[`payment_${index}`] && (
                                <div className="mt-2 p-2 border border-orange-200 rounded-lg bg-white">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-orange-700">Aperçu du reçu</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        className="text-orange-600 hover:text-orange-800 hover:bg-orange-50 p-2 rounded"
                                        onClick={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setPreviewImage({ url: previews[`payment_${index}`]?.url, title: 'Reçu paiement', type: previews[`payment_${index}`]?.type || 'image/*' });
                                        }}
                                      >
                                        <ZoomIn className="h-3 w-3 mr-1" />
                                        Zoom
                                      </button>
                                    </div>
                                  </div>
                                  <div className="w-full h-[200px] overflow-hidden rounded-lg border border-orange-200">
                                    {previews[`payment_${index}`]?.type === 'application/pdf' ? (
                                      // Pour les PDFs locaux, utiliser embed pour l'aperçu
                                      previews[`payment_${index}`]?.url.startsWith('blob:') || previews[`payment_${index}`]?.url.startsWith('data:') ? (
                                        <embed
                                          src={previews[`payment_${index}`]?.url}
                                          type="application/pdf"
                                          className="w-full h-full"
                                        />
                                      ) : (
                                        // Pour les URLs Cloudinary, utiliser un lien
                                        <div className="w-full h-full flex items-center justify-center bg-orange-50">
                                          <a
                                            href={previews[`payment_${index}`]?.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex flex-col items-center justify-center gap-2 p-4 hover:bg-orange-100 rounded-lg transition-colors"
                                          >
                                            <FileText className="h-16 w-16 text-red-600" />
                                            <span className="text-sm font-medium text-orange-700">Voir le PDF</span>
                                          </a>
                                        </div>
                                      )
                                    ) : (
                                      <img
                                        src={previews[`payment_${index}`]?.url}
                                        alt="Reçu paiement"
                                        className="max-h-full max-w-full object-contain"
                                      />
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => supprimerPaiement(index)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
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
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 h-12"
                      >
                        <Plus className="mr-2 h-5 w-5" />
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
                        {/* Statut Visa - Masqué si Visa est désactivé */}
                        {customization.includeVisa && (
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
                            <div className="text-center">
                              <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                                formData.statutVisa 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {formData.statutVisa ? '✅ Prêt' : '⏳ En attente'}
                              </span>
                            </div>
                        </div>
                        )}

                        {/* Statut Vol - Masqué si Avion est désactivé */}
                        {customization.includeAvion && (
                          <div className="bg-white p-4 rounded-lg border border-purple-200">
                            <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-green-100 rounded-lg">
                                  <FileText className="h-4 w-4 text-green-600" />
                            </div>
                                <Label className="text-purple-700 font-medium">Statut Vol</Label>
                                  </div>
                              <Switch
                                checked={formData.statutVol || false}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, statutVol: checked }))}
                                className="data-[state=checked]:bg-green-600"
                              />
                                </div>
                            <div className="text-center">
                              <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                                formData.statutVol 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {formData.statutVol ? '✅ Prêt' : '⏳ En attente'}
                              </span>
                          </div>
                        </div>
                        )}

                        {/* Statut Hôtel - Masqué si les deux hôtels sont "Sans hôtel" */}
                        {(formData.hotelMadina !== "none" || formData.hotelMakkah !== "none") && (
                          <div className="bg-white p-4 rounded-lg border border-purple-200">
                            <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                  <FileText className="h-4 w-4 text-orange-600" />
                            </div>
                                <Label className="text-purple-700 font-medium">Statut Hôtel</Label>
                                  </div>
                              <Switch
                                checked={formData.statutHotel || false}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, statutHotel: checked }))}
                                className="data-[state=checked]:bg-orange-600"
                              />
                                </div>
                            <div className="text-center">
                              <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                                formData.statutHotel 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {formData.statutHotel ? '✅ Prêt' : '⏳ En attente'}
                              </span>
                              </div>
                          </div>
                        )}
                      </div>

                      {/* Note informative mise à jour */}
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-600" />
                          <span className="text-sm text-blue-700 font-medium">Note :</span>
                          </div>
                        <p className="text-xs text-blue-600 mt-1">
                          Les statuts s'affichent uniquement pour les services activés. 
                          Le passeport est géré dans la section "Informations Client".
                        </p>
                                </div>



                    </div>
                  </div>

                  {/* Bouton de soumission */}
                  <div className="flex justify-end gap-4 mt-8">
                    <Link href="/reservations">
                      <Button variant="outline" type="button">
                        Annuler
                      </Button>
                    </Link>
                    <Button
                      type="submit"
                      disabled={!isFormValid || isSubmitting || (prixMode === 'proposition' && prixPropose !== null && prixPropose < calculatePrice)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Colonne de droite - Résumé fixe - COMMENTÉE */}
          {/* La boîte de résumé a été commentée pour que le formulaire prenne toute la page */}
        </div>
      </div>

      {/* Footer flottant avec prix, réduction et bouton de confirmation */}
      {calculatePrice > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-emerald-200 shadow-2xl z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              {/* Section calcul du prix - Toggle entre Réduction et Proposition */}
              <div className="flex items-center gap-4">
                {/* Prix final avec toggle */}
                <div className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all duration-300
                  ${activeTheme.colors.bg} ${activeTheme.colors.border} ${activeTheme.colors.glow} shadow-lg
                `}>
                  <Wallet className={`h-4 w-4 ${activeTheme.colors.textActive}`} />
                  <span className={`text-sm font-medium ${activeTheme.colors.text}`}>Total:</span>
                  <span className={`font-bold ${activeTheme.colors.textActive} text-lg`}>
                    {(() => {
                      if (prixMode === 'proposition' && prixPropose !== null && prixPropose >= calculatePrice) {
                        return Math.max(0, Math.round(prixPropose)).toLocaleString('fr-FR');
                      } else if (prixMode === 'reduction') {
                        return Math.max(0, Math.round(calculatePrice - reduction)).toLocaleString('fr-FR');
                      } else {
                        return Math.max(0, Math.round(calculatePrice)).toLocaleString('fr-FR');
                      }
                    })()} DH
                  </span>
                  
                  {/* Toggle pour Réduction/Proposition */}
                  <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-300">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-medium text-gray-600">Réduc.</span>
                      <Switch
                        checked={prixMode === 'reduction'}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setPrixMode('reduction');
                            setPrixPropose(null);
                          } else {
                            setPrixMode(null);
                            setReduction(0);
                          }
                        }}
                        className="data-[state=checked]:bg-red-500 scale-75"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-medium text-gray-600">Propos.</span>
                      <Switch
                        checked={prixMode === 'proposition'}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setPrixMode('proposition');
                            setReduction(0);
                            // Laisser null pour que l'utilisateur puisse saisir librement
                            // Le placeholder affichera le prix calculé comme suggestion
                          } else {
                            setPrixMode(null);
                            setPrixPropose(null);
                          }
                        }}
                        className="data-[state=checked]:bg-green-500 scale-75"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Box de réduction - affiché seulement si mode réduction est activé */}
                {prixMode === 'reduction' && (
                  <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                    <X className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Réduction:</span>
                    <Input
                      type="text"
                      value={reduction === 0 ? '' : reduction}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                        setReduction(Math.min(value, calculatePrice));
                      }}
                      onFocus={(e) => {
                        if (e.target.value === '0') {
                          e.target.value = '';
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '') {
                          setReduction(0);
                        }
                      }}
                      className="w-24 h-7 text-sm border border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-200 rounded text-center bg-white font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                    />
                    <span className="text-sm text-red-600 font-medium">DH</span>
                  </div>
                )}
                
                {/* Box de proposition - affiché seulement si mode proposition est activé */}
                {prixMode === 'proposition' && (
                  <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                    <ChevronUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Proposition:</span>
                    <Input
                      type="text"
                      value={prixPropose === null ? '' : prixPropose}
                      onChange={(e) => {
                        const value = e.target.value === '' ? null : parseInt(e.target.value) || null;
                        setPrixPropose(value);
                      }}
                      onFocus={(e) => {
                        if (e.target.value === '0' || e.target.value === '') {
                          e.target.value = '';
                        }
                      }}
                      className="w-24 h-7 text-sm border border-green-300 focus:border-green-500 focus:ring-1 focus:ring-green-200 rounded text-center bg-white font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder={calculatePrice.toString()}
                    />
                    <span className="text-sm text-green-600 font-medium">DH</span>
                  </div>
                )}
              </div>
              
              {/* Bouton de confirmation - désactivé si proposition avec prix inférieur au total */}
              <Button
                type="submit"
                disabled={!isFormValid || isSubmitting || (prixMode === 'proposition' && prixPropose !== null && prixPropose < calculatePrice)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3 text-lg"
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector('form')?.requestSubmit();
                }}
              >
                {isSubmitting ? 'Enregistrement...' : 'Confirmer la Réservation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de prévisualisation */}
      <Dialog
        open={ocrValidation !== null}
        onOpenChange={(open) => {
          if (!open) setOcrValidation(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Valider les données extraites du passeport</DialogTitle>
            <DialogDescription>
              Vérifiez le nom, le prénom et le numéro de passeport avant de les appliquer au formulaire.
            </DialogDescription>
          </DialogHeader>
          {ocrValidation && (
            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="ocr-lastName">Nom</Label>
                <Input
                  id="ocr-lastName"
                  value={ocrValidation.lastName}
                  onChange={(e) =>
                    setOcrValidation((prev) =>
                      prev ? { ...prev, lastName: e.target.value } : null
                    )
                  }
                  placeholder="Nom"
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ocr-firstName">Prénom</Label>
                <Input
                  id="ocr-firstName"
                  value={ocrValidation.firstName}
                  onChange={(e) =>
                    setOcrValidation((prev) =>
                      prev ? { ...prev, firstName: e.target.value } : null
                    )
                  }
                  placeholder="Prénom"
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ocr-passport">N° Passeport</Label>
                <Input
                  id="ocr-passport"
                  value={ocrValidation.passport}
                  onChange={(e) =>
                    setOcrValidation((prev) =>
                      prev
                        ? { ...prev, passport: formatPassportInput(e.target.value) }
                        : null
                    )
                  }
                  placeholder="AB1234567"
                  className="h-10"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOcrValidation(null)}
            >
              Ignorer
            </Button>
            <Button type="button" onClick={applyOcrValidation}>
              OK — Appliquer aux champs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center justify-between">
              <span>{previewImage?.title}</span>
              <button
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPreviewImage(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-2 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-[calc(90vh-80px)] flex items-center justify-center bg-gray-100 overflow-auto">
            {previewImage && (
              <div className="w-full h-full flex items-center justify-center p-4">
                {previewImage.type === 'application/pdf' ? (
                  // Pour les PDFs locaux, utiliser embed, sinon lien vers Cloudinary
                  previewImage.url.startsWith('blob:') || previewImage.url.startsWith('data:') ? (
                    <embed
                      src={previewImage.url}
                      type="application/pdf"
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 p-8">
                      <FileText className="h-24 w-24 text-red-600" />
                      <a
                        href={fixCloudinaryUrlForPdf(previewImage.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Ouvrir le PDF dans un nouvel onglet
                      </a>
                    </div>
                  )
                ) : (
                  <img
                    src={previewImage.url}
                    alt={previewImage.title}
                    className="max-w-full max-h-full object-contain cursor-zoom-in"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      const img = e.currentTarget;
                      if (img.style.transform === 'scale(1.5)') {
                        img.style.transform = 'scale(1)';
                        img.style.cursor = 'zoom-in';
                      } else {
                        img.style.transform = 'scale(1.5)';
                        img.style.cursor = 'zoom-out';
                      }
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal du Guide des chambres */}
      <Dialog open={showRoomGuide} onOpenChange={setShowRoomGuide}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Info className="h-6 w-6 text-blue-600" />
              </div>
              Guide des chambres
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Types de chambres */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Hotel className="h-5 w-5 text-blue-600" />
                Types de chambres disponibles
              </h3>
              <div className="grid gap-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-blue-800">Chambre Simple</span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">1 personne</Badge>
                  </div>
                  <p className="text-sm text-blue-600 mt-1">Chambre individuelle avec lit simple</p>
                </div>
                
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-800">Chambre Double</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">2 personnes</Badge>
                  </div>
                  <p className="text-sm text-green-600 mt-1">Chambre avec 2 lits simples ou 1 lit double</p>
                </div>
                
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-purple-800">Chambre Triple</span>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700">3 personnes</Badge>
                  </div>
                  <p className="text-sm text-purple-600 mt-1">Chambre avec 3 lits simples</p>
                </div>
                
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-orange-800">Chambre Quadruple</span>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">4 personnes</Badge>
                  </div>
                  <p className="text-sm text-orange-600 mt-1">Chambre avec 4 lits simples</p>
                </div>
                
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-red-800">Chambre Quintuple</span>
                    <Badge variant="secondary" className="bg-red-100 text-red-700">5 personnes</Badge>
                  </div>
                  <p className="text-sm text-red-600 mt-1">Chambre avec 5 lits simples</p>
                </div>
              </div>
            </div>

            {/* Types de genre */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Types de genre des chambres
              </h3>
              <div className="grid gap-3">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👨</span>
                    <span className="font-medium text-gray-800">Chambre Homme</span>
                    <Badge variant="outline" className="ml-auto">Hommes uniquement</Badge>
                  </div>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👩</span>
                    <span className="font-medium text-gray-800">Chambre Femme</span>
                    <Badge variant="outline" className="ml-auto">Femmes uniquement</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Informations importantes */}
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="text-lg font-semibold text-yellow-800 flex items-center gap-2 mb-2">
                <Bell className="h-5 w-5 text-yellow-600" />
                Informations importantes
              </h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Les chambres sont attribuées selon le genre sélectionné</li>
                <li>• Les chambres sont séparées par genre (Homme/Femme)</li>
                <li>• La sélection se fait automatiquement selon les places disponibles</li>
                <li>• Les prix varient selon le type de chambre choisi</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
