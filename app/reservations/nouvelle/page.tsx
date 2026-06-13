"use client"

import { useState, useRef, useMemo, useEffect } from "react"
import { api } from "@/lib/api"
import { generatePaymentReceiptFile, downloadReceipt } from "@/lib/generateReceipt"
import { BlockersTooltip } from "@/components/blockers-tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HotelCategoryBlock } from "@/components/reservations/HotelCategoryBlock"
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
  hotelsAutre?: Array<{ hotel: Hotel; nbJours: number; ordre: number }>;
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
  // Hôtels Autre : sélection de chambre par hôtel + valeur du Select par hôtel ("none" ou id)
  const [selectedPlacesAutre, setSelectedPlacesAutre] = useState<{[hotelId: number]: {[roomId: number]: number[]}}>({});
  const [hotelsAutreSelection, setHotelsAutreSelection] = useState<{[hotelId: number]: string}>({});

  // États pour la personnalisation du calcul de prix
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [customization, setCustomization] = useState({
    includeAvion: true,
    includeVisa: true,
    // Activation par catégorie (ON = hôtel obligatoire ; OFF = exclu du prix + non requis).
    includeMadina: true,
    includeMakkah: true,
    joursMadina: 0, // Sera initialisé avec les valeurs du programme
    joursMakkah: 0, // Sera initialisé avec les valeurs du programme
    plan: "Normal" // Plan par défaut: Économique, Normal, VIP
  });
  // Hôtels « Autre » : activation (ON par défaut = obligatoire) + durée éditable par hôtel.
  const [autreActive, setAutreActive] = useState<{ [hotelId: number]: boolean }>({});
  const [autreJours, setAutreJours] = useState<{ [hotelId: number]: number }>({});

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
  // Hôtels Autre du programme, triés par ordre d'affichage (séquence Turquie→X→Y)
  const hotelsAutreProgramme = [...(programmeSelectionne?.hotelsAutre || [])].sort((a, b) => a.ordre - b.ordre);

  // Blocs hôtels réellement affichés (catégorie présente ET activée via le panneau « Éditer »).
  const showMadinaBlock = hotelsMadina.length > 0 && customization.includeMadina;
  const showMakkahBlock = hotelsMakkah.length > 0 && customization.includeMakkah;
  const hotelsAutreActifs = hotelsAutreProgramme.filter((ph) => autreActive[ph.hotel.id] !== false);

  // Disposition des blocs hôtels : Madina = 1 bloc, Makkah = 1 bloc, chaque Autre = 1 bloc.
  // 1 hôtel → pleine largeur, 2 → côte à côte, 3+ → max 3 par ligne (les suivants passent à la ligne).
  const hotelBlockCount =
    (showMadinaBlock ? 1 : 0) +
    (showMakkahBlock ? 1 : 0) +
    hotelsAutreActifs.length;
  const hotelGridColsClass =
    hotelBlockCount >= 3 ? "md:grid-cols-3" : hotelBlockCount === 2 ? "md:grid-cols-2" : "md:grid-cols-1";

  // Hôtels actifs (obligatoires) sans chambre sélectionnée → motifs de blocage de l'enregistrement.
  const hotelsRequisManquants: string[] = [];
  if (showMadinaBlock && Object.keys(selectedPlacesMadina).length === 0) {
    hotelsRequisManquants.push("Sélectionnez une chambre pour l'hôtel à Madina");
  }
  if (showMakkahBlock && Object.keys(selectedPlacesMakkah).length === 0) {
    hotelsRequisManquants.push("Sélectionnez une chambre pour l'hôtel à Makkah");
  }
  for (const ph of hotelsAutreActifs) {
    if (Object.keys(selectedPlacesAutre[ph.hotel.id] || {}).length === 0) {
      hotelsRequisManquants.push(`Sélectionnez une chambre pour l'hôtel « ${ph.hotel.name} »`);
    }
  }
  const hotelsComplets = hotelsRequisManquants.length === 0;

  // Fonction pour calculer le prix automatiquement
  const calculatePrice = useMemo(() => {
    // Garde-fou assoupli : seules les bases (programme, type, genre) sont requises.
    // Chaque catégorie d'hôtel (Madina / Makkah / Autre) est OPTIONNELLE et vaut 0
    // si absente ou non sélectionnée.
    if (!programInfo || !formData.typeChambre || !formData.gender) {
      return 0;
    }

    const roomType = formData.typeChambre;
    const gender = formData.gender;

    // Une valeur d'hôtel vide ("") ou "none" = catégorie non sélectionnée.
    // Une catégorie désactivée (switch OFF du panneau « Éditer ») est exclue du prix.
    const hasMadina = customization.includeMadina && !!formData.hotelMadina && formData.hotelMadina !== "none";
    const hasMakkah = customization.includeMakkah && !!formData.hotelMakkah && formData.hotelMakkah !== "none";

    // Résoudre la chambre sélectionnée (ou la première compatible) pour une catégorie
    const resolveRoom = (
      hotelIdStr: string,
      selectedPlaces: { [roomId: number]: number[] }
    ) => {
      let room: typeof programInfo.rooms[number] | null = null;
      const selectedRoomId = Object.keys(selectedPlaces)[0];
      if (selectedRoomId) {
        room = programInfo.rooms.find((r) => r.id === parseInt(selectedRoomId)) || null;
      }
      if (!room) {
        room =
          programInfo.rooms.find(
            (r) =>
              r.hotelId === parseInt(hotelIdStr) &&
              r.roomType === roomType &&
              (r.gender === gender || r.gender === "Mixte")
          ) || null;
      }
      return room;
    };

    const roomMadina = hasMadina
      ? resolveRoom(formData.hotelMadina, selectedPlacesMadina)
      : null;
    const roomMakkah = hasMakkah
      ? resolveRoom(formData.hotelMakkah, selectedPlacesMakkah)
      : null;

    // Si une catégorie Madina/Makkah est sélectionnée mais sans chambre trouvée
    // ou sans place dispo → comportement historique : prix 0.
    if ((hasMadina && !roomMadina) || (hasMakkah && !roomMakkah)) {
      return 0;
    }
    if (
      (roomMadina && roomMadina.nbrPlaceRestantes <= 0) ||
      (roomMakkah && roomMakkah.nbrPlaceRestantes <= 0)
    ) {
      return 0;
    }

    const nbPersonnes =
      ({ SINGLE: 1, DOUBLE: 2, TRIPLE: 3, QUAD: 4, QUINT: 5 } as Record<string, number>)[
        roomType
      ] || 1;

    const prixAvion = customization.includeAvion ? programInfo.prixAvionDH : 0;
    const prixVisa = customization.includeVisa ? programInfo.prixVisaRiyal : 0;
    const joursUtilisesMadina = customization.joursMadina;
    const joursUtilisesMakkah = customization.joursMakkah;

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

    const prixHotelMadina = roomMadina
      ? (roomMadina.prixRoom / nbPersonnes) * joursUtilisesMadina
      : 0;
    const prixHotelMakkah = roomMakkah
      ? (roomMakkah.prixRoom / nbPersonnes) * joursUtilisesMakkah
      : 0;

    // Hôtels Autre : Σ (prixRoom / nbPersonnes) * nbJours(hôtel) pour chaque hôtel ACTIVÉ sélectionné.
    // La durée utilisée est celle éditée dans le panneau (autreJours), sinon celle du programme.
    let prixHotelAutre = 0;
    const hotelsAutreProgrammePrix = programmeSelectionne?.hotelsAutre || [];
    for (const ph of hotelsAutreProgrammePrix) {
      if (autreActive[ph.hotel.id] === false) continue;
      const sel = selectedPlacesAutre[ph.hotel.id];
      if (!sel) continue;
      const roomId = Object.keys(sel)[0];
      if (!roomId) continue;
      const room = programInfo.rooms.find((r) => r.id === parseInt(roomId));
      if (!room) continue;
      const nuits = autreJours[ph.hotel.id] ?? ph.nbJours ?? 0;
      prixHotelAutre += (room.prixRoom / nbPersonnes) * nuits;
    }

    const prixFinal =
      prixAvion +
      profit +
      (prixVisa + prixHotelMakkah + prixHotelMadina + prixHotelAutre) *
        programInfo.exchange;

    return Math.round(prixFinal);
  }, [
    programInfo,
    formData.typeChambre,
    formData.gender,
    formData.hotelMadina,
    formData.hotelMakkah,
    selectedPlacesMadina,
    selectedPlacesMakkah,
    selectedPlacesAutre,
    programmeSelectionne,
    customization,
    autreActive,
    autreJours,
  ]);

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

  // Auto-sélection du premier hôtel Madina/Makkah quand la catégorie est active (modifiable ensuite).
  // La place libre est ensuite auto-sélectionnée par les effets dédiés.
  useEffect(() => {
    if (!formData.programId) return;
    if (customization.includeMadina && hotelsMadina.length > 0 && !formData.hotelMadina) {
      setFormData(prev => ({ ...prev, hotelMadina: hotelsMadina[0].id.toString() }));
    }
    if (customization.includeMakkah && hotelsMakkah.length > 0 && !formData.hotelMakkah) {
      setFormData(prev => ({ ...prev, hotelMakkah: hotelsMakkah[0].id.toString() }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.programId, customization.includeMadina, customization.includeMakkah, formData.hotelMadina, formData.hotelMakkah]);

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
        // Nouveau programme → toutes les catégories présentes redeviennent obligatoires (ON).
        includeMadina: true,
        includeMakkah: true,
        plan: prev.plan || "Normal" // Garder le plan existant ou utiliser "Normal" par défaut
      }));
    }
  }, [programInfo]);

  // Initialiser l'activation (tous ON = obligatoire) et la durée éditable de chaque hôtel Autre,
  // et pré-sélectionner l'hôtel pour que ses chambres s'affichent (la chambre sera auto-choisie).
  useEffect(() => {
    const active: { [hotelId: number]: boolean } = {};
    const jours: { [hotelId: number]: number } = {};
    const selection: { [hotelId: number]: string } = {};
    for (const ph of hotelsAutreProgramme) {
      active[ph.hotel.id] = true;
      jours[ph.hotel.id] = ph.nbJours || 0;
      selection[ph.hotel.id] = ph.hotel.id.toString();
    }
    setAutreActive(active);
    setAutreJours(jours);
    setHotelsAutreSelection(selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.programId]);

  // --- Bascule d'activation par catégorie d'hôtel (panneau « Éditer ») ---
  // OFF → l'hôtel est exclu du prix et n'est plus obligatoire ; on nettoie sa sélection.
  // ON  → le bloc réapparaît et la chambre est auto-sélectionnée.
  const toggleIncludeMadina = (checked: boolean) => {
    setCustomization(prev => ({ ...prev, includeMadina: checked }));
    if (!checked) {
      setFormData(prev => ({ ...prev, hotelMadina: "none" }));
      setSelectedPlacesMadina({});
    } else {
      setFormData(prev => ({ ...prev, hotelMadina: prev.hotelMadina === "none" ? "" : prev.hotelMadina }));
    }
  };

  const toggleIncludeMakkah = (checked: boolean) => {
    setCustomization(prev => ({ ...prev, includeMakkah: checked }));
    if (!checked) {
      setFormData(prev => ({ ...prev, hotelMakkah: "none" }));
      setSelectedPlacesMakkah({});
    } else {
      setFormData(prev => ({ ...prev, hotelMakkah: prev.hotelMakkah === "none" ? "" : prev.hotelMakkah }));
    }
  };

  const toggleAutreActive = (hotelId: number, checked: boolean) => {
    setAutreActive(prev => ({ ...prev, [hotelId]: checked }));
    if (!checked) {
      setHotelsAutreSelection(prev => ({ ...prev, [hotelId]: "none" }));
      setSelectedPlacesAutre(prev => {
        const next = { ...prev };
        delete next[hotelId];
        return next;
      });
    } else {
      setHotelsAutreSelection(prev => ({ ...prev, [hotelId]: hotelId.toString() }));
    }
  };

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

  // Sélectionner automatiquement la première place libre pour chaque hôtel Autre activé
  useEffect(() => {
    if (!programInfo || !programInfo.rooms || !formData.typeChambre || !formData.gender) return;
    for (const ph of hotelsAutreProgramme) {
      const hotelId = ph.hotel.id;
      if ((hotelsAutreSelection[hotelId] ?? "none") === "none") continue;
      const filteredRooms = programInfo.rooms.filter(room =>
        room.hotelId === hotelId &&
        room.roomType === formData.typeChambre &&
        (room.gender === formData.gender || room.gender === 'Mixte' || !room.gender)
      );
      if (filteredRooms.length === 0) continue;
      const currentSelection = Object.entries(selectedPlacesAutre[hotelId] || {})[0];
      if (currentSelection) {
        const room = filteredRooms.find(r => r.id === parseInt(currentSelection[0]));
        if (!room || room.nbrPlaceRestantes === 0) {
          const sortedRooms = sortRoomsByAlgorithm(filteredRooms, formData.gender);
          const firstRoom = sortedRooms.find(r => r.nbrPlaceRestantes > 0);
          if (firstRoom) {
            setSelectedPlacesAutre(prev => ({ ...prev, [hotelId]: { [firstRoom.id]: [getFirstAvailablePlace(firstRoom)] } }));
          }
        }
      } else {
        const sortedRooms = sortRoomsByAlgorithm(filteredRooms, formData.gender);
        const firstRoom = sortedRooms.find(r => r.nbrPlaceRestantes > 0);
        if (firstRoom) {
          setSelectedPlacesAutre(prev => ({ ...prev, [hotelId]: { [firstRoom.id]: [getFirstAvailablePlace(firstRoom)] } }));
        }
      }
    }
  }, [programInfo, formData.typeChambre, formData.gender, hotelsAutreSelection, selectedPlacesAutre, programmeSelectionne]);

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
      PHONE_REGEX.test((formData.telephone || "").trim()) &&
      formData.prix !== "";

    // Si le document passeport est joint, le n° de passeport devient obligatoire
    const passportNumberOk =
      !documents.passport ||
      PASSPORT_REGEX.test((formData.passportNumber || "").trim());

    return baseFieldsValid && passportNumberOk && arePaymentsValid && hotelsComplets;
  }, [formData, documents.passport, arePaymentsValid, hotelsComplets]);

  // Raisons pour lesquelles la réservation ne peut pas encore être enregistrée
  // (miroir de isFormValid + contrainte du prix proposé).
  const getSubmitBlockers = (): string[] => {
    const reasons: string[] = [];
    if (!formData.programme) reasons.push("Le programme n'est pas sélectionné");
    if (!formData.typeChambre) reasons.push("Le type de chambre n'est pas sélectionné");
    if (!formData.gender) reasons.push("Le genre n'est pas sélectionné");
    if (!formData.nom?.trim()) reasons.push("Le nom n'est pas saisi");
    if (!formData.prenom?.trim()) reasons.push("Le prénom n'est pas saisi");
    if (!formData.telephone?.trim()) reasons.push("Le téléphone n'est pas saisi");
    else if (!PHONE_REGEX.test(formData.telephone.trim())) reasons.push("Le téléphone n'est pas valide");
    if (!formData.prix) reasons.push("Le prix n'est pas généré");
    if (documents.passport && !PASSPORT_REGEX.test((formData.passportNumber || "").trim())) {
      reasons.push("Le n° de passeport est invalide (2 lettres + 7 chiffres)");
    }
    if (!arePaymentsValid) reasons.push("Un paiement est incomplet (mode et montant requis)");
    // Chaque hôtel actif (non désactivé dans « Éditer ») doit avoir une chambre choisie.
    reasons.push(...hotelsRequisManquants);
    if (prixMode === 'proposition' && prixPropose !== null && prixPropose < calculatePrice) {
      reasons.push("Le prix proposé est inférieur au prix calculé");
    }
    return reasons;
  };

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
    setPaiements(prev => prev.filter((_, i) => i !== index))
    // Retire aussi le reçu/document attaché et son aperçu, puis réindexe les paiements suivants
    setDocuments(prev => {
      const newPayment = [...(prev.payment || [])]
      newPayment.splice(index, 1)
      return { ...prev, payment: newPayment }
    })
    setPreviews(prev => {
      const next: typeof prev = {}
      for (const key of Object.keys(prev)) {
        const match = key.match(/^payment_(\d+)$/)
        if (!match) {
          next[key] = prev[key]
          continue
        }
        const i = Number(match[1])
        if (i === index) continue
        next[i > index ? `payment_${i - 1}` : key] = prev[key]
      }
      return next
    })
  }

  const mettreAJourPaiement = <K extends keyof Paiement>(index: number, field: K, value: Paiement[K]) => {
    if (field === "montant" && typeof value === "string") {
      const prixSuggere = Number(formData.prix) || 0;

      setPaiements(prev => {
        const newPaiements = [...prev];

        if (value.trim() === "") {
          newPaiements[index] = { ...newPaiements[index], montant: "" };
          return newPaiements;
        }

        let numericValue = Number(value);
        if (Number.isNaN(numericValue)) return prev;
        if (numericValue < 0) numericValue = 0;

        const sumOther = prev.reduce(
          (sum, p, i) => sum + (i === index ? 0 : Number(p.montant) || 0),
          0
        );

        // Sans prix dossier valide, ne pas plafonner (sinon montant forcé à 0 → saisie impossible)
        const canCapToRemaining = prixSuggere > 0;
        const allowedMax = Math.max(prixSuggere - sumOther, 0);
        const clamped = canCapToRemaining
          ? Math.min(numericValue, allowedMax)
          : numericValue;
        if (canCapToRemaining && numericValue > allowedMax) {
          toast({
            title: "Montant dépasse le prix suggéré",
            description: `Le total des paiements ne doit pas dépasser ${prixSuggere.toLocaleString(
              "fr-FR"
            )} DH.`,
            variant: "destructive",
          });
        }

        newPaiements[index] = { ...newPaiements[index], montant: String(clamped) };
        return newPaiements;
      });
      return;
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

  // Champs de la réservation présents sur le reçu professionnel : tant qu'ils ne
  // sont pas remplis, on ne peut ni ajouter de paiement ni générer de reçu.
  const getReservationBlockers = (): string[] => {
    const reasons: string[] = [];
    if (!formData.prix) reasons.push("Le prix n'est pas généré");
    if (!formData.programme?.trim()) reasons.push("Le programme n'est pas sélectionné");
    if (!formData.typeChambre) reasons.push("Le type de chambre n'est pas sélectionné");
    if (!formData.gender) reasons.push("Le genre n'est pas sélectionné");
    if (!formData.nom?.trim()) reasons.push("Le nom n'est pas saisi");
    if (!formData.prenom?.trim()) reasons.push("Le prénom n'est pas saisi");
    if (!formData.telephone?.trim()) reasons.push("Le téléphone n'est pas saisi");
    return reasons;
  };

  // Raisons pour lesquelles le reçu d'un paiement précis ne peut pas être généré.
  const getPaymentReceiptBlockers = (index: number): string[] => {
    const reasons = getReservationBlockers();
    const paiement = paiements[index];
    if (!paiement?.type) reasons.push("Le mode de paiement n'est pas sélectionné");
    const montant = Number(paiement?.montant);
    if (!paiement?.montant || Number.isNaN(montant) || montant <= 0) {
      reasons.push("Le montant du paiement n'est pas saisi");
    }
    return reasons;
  };

  const canGeneratePaymentReceipt = (index: number) =>
    getPaymentReceiptBlockers(index).length === 0;

  const handleGeneratePaymentReceipt = async (index: number) => {
    const paiement = paiements[index];
    if (!paiement || !canGeneratePaymentReceipt(index)) return;

    const prixEngage = Number(formData.prix) || 0;
    const totalPaye = paiements.reduce((total, p) => total + (Number(p.montant) || 0), 0);

    let file: File;
    try {
      file = await generatePaymentReceiptFile({
        nom: formData.nom,
        prenom: formData.prenom,
        telephone: formData.telephone,
        passportNumber: formData.passportNumber,
        programme: formData.programme,
        type: paiement.type,
        montant: Number(paiement.montant) || 0,
        date: paiement.date,
        prixEngage,
        typeChambre: formData.typeChambre,
        genre: formData.gender,
        resteAPayer: Math.max(0, prixEngage - totalPaye),
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de générer le reçu pour le moment.",
        variant: "destructive",
      });
      return;
    }

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

  // Télécharge le reçu (généré ou importé) affiché dans l'aperçu
  const handleDownloadPaymentReceipt = async (index: number) => {
    const preview = previews[`payment_${index}`];
    const source = documents.payment?.[index] || preview?.url || null;
    const ok = await downloadReceipt(source, `recu-paiement-${index + 1}.png`, preview?.type);
    if (!ok) {
      toast({
        title: "Téléchargement impossible",
        description: "Aucun reçu disponible à télécharger.",
        variant: "destructive",
      });
    }
  };

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
    if (documents.passport && !PASSPORT_REGEX.test(passportNumber)) {
      toast({
        title: "N° de passeport requis",
        description:
          "Le document passeport est joint : renseignez le numéro de passeport (2 lettres + 7 chiffres) avant d'enregistrer.",
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
          statutHotel: (formData.hotelMadina !== "none" || formData.hotelMakkah !== "none" || Object.keys(selectedPlacesAutre).length > 0) ? formData.statutHotel : false,
          statutVol: customization.includeAvion ? formData.statutVol : false,
          paidAmount: paidAmount,
          plan: customization.plan,
          // Ajouter les IDs des chambres sélectionnées
          roomMadinaId: Object.keys(selectedPlacesMadina)[0] ? parseInt(Object.keys(selectedPlacesMadina)[0]) : null,
          roomMakkahId: Object.keys(selectedPlacesMakkah)[0] ? parseInt(Object.keys(selectedPlacesMakkah)[0]) : null,
          // Hôtels Autre actifs et sélectionnés : [{ hotelId, roomId, hotelName }]
          hotelsAutre: hotelsAutreProgramme
            .filter((ph) => autreActive[ph.hotel.id] !== false && (hotelsAutreSelection[ph.hotel.id] ?? "none") !== "none")
            .map((ph) => {
              const roomIdStr = Object.keys(selectedPlacesAutre[ph.hotel.id] || {})[0];
              return roomIdStr
                ? { hotelId: ph.hotel.id, roomId: parseInt(roomIdStr), hotelName: ph.hotel.name }
                : null;
            })
            .filter((e): e is { hotelId: number; roomId: number; hotelName: string } => e !== null)
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

      // Passeport - Upload vers Cloudinary et création du fichier (en parallèle)
      if (documents.passport) {
        const formDataPassport = new FormData();
        formDataPassport.append("file", documents.passport);
        formDataPassport.append("reservationId", reservationId.toString());
        formDataPassport.append("fileType", "passport");

        fileUploadPromises.push(
          fetch(api.url(api.endpoints.uploadCloudinary), {
            method: "POST",
            body: formDataPassport,
          })
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                const uploadedFile = data.results && data.results[0];
                const fichierId = uploadedFile && uploadedFile.id;
                if (fichierId) {
                  newUploadedStatus.passport = true;
                } else {
                  fileUploadErrors.push('Erreur: Aucun fichierId retourné pour le passeport');
                }
              } else {
                const error = await response.json().catch(() => ({}));
                fileUploadErrors.push(`Erreur lors de l'upload du passeport vers Cloudinary: ${error.error || 'Erreur inconnue'}`);
              }
            })
            .catch((error) => {
              console.error('❌ Erreur upload passeport:', error);
              fileUploadErrors.push('Erreur lors de l\'upload du passeport');
            })
        );
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

      // 3. Expense pour l'hôtel Madina (si activé et sélectionné)
      if (customization.includeMadina && formData.hotelMadina !== "none" && programInfo) {
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

      // 4. Expense pour l'hôtel Makkah (si activé et sélectionné)
      if (customization.includeMakkah && formData.hotelMakkah !== "none" && programInfo) {
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

      // 5. Expenses pour les hôtels Autre actifs et sélectionnés
      if (programInfo) {
        const nbPersonnesAutre = {
          'SINGLE': 1, 'DOUBLE': 2, 'TRIPLE': 3, 'QUAD': 4, 'QUINT': 5
        }[formData.typeChambre] || 1;
        for (const ph of hotelsAutreProgramme) {
          if (autreActive[ph.hotel.id] === false) continue;
          const sel = selectedPlacesAutre[ph.hotel.id];
          const roomIdStr = sel ? Object.keys(sel)[0] : undefined;
          if (!roomIdStr) continue;
          const roomAutre = programInfo.rooms.find(r => r.id === parseInt(roomIdStr));
          if (!roomAutre) continue;
          const nuits = autreJours[ph.hotel.id] ?? ph.nbJours ?? 0;
          const montantHotelAutre = (roomAutre.prixRoom / nbPersonnesAutre) * nuits;
          expensesToCreate.push({
            description: `Service hôtel ${ph.hotel.name} pour ${formData.prenom} ${formData.nom}`,
            amount: montantHotelAutre * programInfo.exchange, // Montant en Dirhams (Riyal * exchange)
            date: new Date().toISOString(),
            type: 'Hotel Autre',
            fichierId: fichierIds.hotelBooked || null,
            programId: parseInt(formData.programId),
            reservationId: reservationId
          });
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

      if (fileUploadErrors.length > 0 || paymentErrors.length > 0 || expenseErrors.length > 0) {
        throw new Error([...fileUploadErrors, ...paymentErrors, ...expenseErrors].join('\n'));
      }

      // PATCH la réservation pour mettre à jour les statuts
      await api.request(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          statutPasseport: newUploadedStatus.passport,
          statutVisa: customization.includeVisa ? formData.statutVisa : false,
          statutHotel: (formData.hotelMadina !== "none" || formData.hotelMakkah !== "none" || Object.keys(selectedPlacesAutre).length > 0) ? formData.statutHotel : false,
          statutVol: customization.includeAvion ? formData.statutVol : false
        }),
      });

      toast({
        title: "Succès",
        description: "La réservation, les documents et les dépenses fournisseur ont été enregistrés avec succès",
      });

      // Rediriger uniquement après que tout a été enregistré avec succès
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
                            // Réinitialiser aussi les sélections Madina/Makkah/Autre
                            setSelectedPlacesMadina({});
                            setSelectedPlacesMakkah({});
                            setSelectedPlacesAutre({});
                            setHotelsAutreSelection({});

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
                  {isCustomizationOpen && formData.programId && programInfo && (() => {
                    // Descripteurs des hôtels du programme : Madina / Makkah (si présents) + chaque Autre.
                    // active = ON (obligatoire) ; OFF = exclu du prix + non requis. jours = nuits éditables.
                    const hotelToggles = [
                      ...(hotelsMadina.length > 0 ? [{
                        key: "madina",
                        icon: "🕌",
                        label: "Madina",
                        active: customization.includeMadina,
                        onToggle: toggleIncludeMadina,
                        jours: customization.joursMadina,
                        onJours: (v: number) => setCustomization(prev => ({ ...prev, joursMadina: v })),
                        defJours: programInfo.nbJoursMadina,
                      }] : []),
                      ...(hotelsMakkah.length > 0 ? [{
                        key: "makkah",
                        icon: "🕋",
                        label: "Makkah",
                        active: customization.includeMakkah,
                        onToggle: toggleIncludeMakkah,
                        jours: customization.joursMakkah,
                        onJours: (v: number) => setCustomization(prev => ({ ...prev, joursMakkah: v })),
                        defJours: programInfo.nbJoursMakkah,
                      }] : []),
                      ...hotelsAutreProgramme.map((ph) => ({
                        key: `autre-${ph.hotel.id}`,
                        icon: "🏨",
                        label: ph.hotel.name,
                        active: autreActive[ph.hotel.id] !== false,
                        onToggle: (checked: boolean) => toggleAutreActive(ph.hotel.id, checked),
                        jours: autreJours[ph.hotel.id] ?? ph.nbJours ?? 0,
                        onJours: (v: number) => setAutreJours(prev => ({ ...prev, [ph.hotel.id]: v })),
                        defJours: ph.nbJours ?? 0,
                      })),
                    ];

                    return (
                    <div className="mt-4 mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                      {/* Services inclus + réinitialiser */}
                      <div className="flex items-center flex-wrap gap-x-6 gap-y-2">
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
                        <Button
                          type="button"
                          onClick={() => {
                            setCustomization(prev => ({
                              ...prev,
                              includeAvion: true,
                              includeVisa: true,
                              includeMadina: true,
                              includeMakkah: true,
                              joursMadina: programInfo.nbJoursMadina,
                              joursMakkah: programInfo.nbJoursMakkah,
                            }));
                            // Réactiver tous les hôtels Autre + restaurer leur durée et leur sélection.
                            const active: { [hotelId: number]: boolean } = {};
                            const jours: { [hotelId: number]: number } = {};
                            const selection: { [hotelId: number]: string } = {};
                            for (const ph of hotelsAutreProgramme) {
                              active[ph.hotel.id] = true;
                              jours[ph.hotel.id] = ph.nbJours || 0;
                              selection[ph.hotel.id] = ph.hotel.id.toString();
                            }
                            setAutreActive(active);
                            setAutreJours(jours);
                            setHotelsAutreSelection(selection);
                            setFormData(prev => ({
                              ...prev,
                              hotelMadina: prev.hotelMadina === "none" ? "" : prev.hotelMadina,
                              hotelMakkah: prev.hotelMakkah === "none" ? "" : prev.hotelMakkah,
                            }));
                          }}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 ml-auto"
                        >
                          Réinitialiser
                        </Button>
                      </div>

                      {/* Hôtels : activation (ON = obligatoire) + durée (nuits) éditable par hôtel */}
                      {hotelToggles.length > 0 && (
                        <div className="pt-3 border-t border-blue-200">
                          <div className="flex items-start flex-wrap gap-x-6 gap-y-3">
                            <span className="text-sm font-semibold text-blue-700 pt-1.5">Hôtels:</span>
                            {hotelToggles.map((h) => (
                              <div key={h.key} className="flex items-center gap-2">
                                <span className="text-lg">{h.icon}</span>
                                <span className={`text-sm font-medium ${h.active ? "text-blue-700" : "text-gray-400 line-through"}`}>
                                  {h.label}
                                </span>
                                <Switch
                                  checked={h.active}
                                  onCheckedChange={(checked) => h.onToggle(checked)}
                                  className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                />
                                {h.active && (
                                  <>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={h.jours}
                                      onChange={(e) => h.onJours(parseInt(e.target.value) || 0)}
                                      className="w-14 h-8 text-xs border border-blue-200 focus:border-blue-500 rounded text-center"
                                      placeholder="Nuits"
                                    />
                                    <span className="text-xs text-blue-500">nuits (déf: {h.defJours})</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-blue-500 mt-2">
                            Désactivez un hôtel pour le rendre optionnel (exclu du prix). Les hôtels actifs sont obligatoires.
                          </p>
                        </div>
                      )}
                    </div>
                    );
                  })()}

                  {/* Choix des hôtels — grille unique adaptative (max 3 par ligne) */}
                    <div className={`grid grid-cols-1 ${hotelGridColsClass} gap-4`}>
                      {showMadinaBlock && (
                        <HotelCategoryBlock
                          labelIcon="🕌"
                          labelText="Hôtel à Madina *"
                          headerIcon="🕌"
                          headerText="Chambres disponibles à Madina"
                          hotels={hotelsMadina}
                          value={formData.hotelMadina}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, hotelMadina: value }))}
                          disabled={!formData.programId}
                          rooms={programInfo?.rooms || []}
                          roomType={formData.typeChambre}
                          gender={formData.gender}
                          selectedPlaces={selectedPlacesMadina}
                          onSelectRoom={(roomId, place) => setSelectedPlacesMadina({ [roomId]: [place] })}
                          sortRoomsByAlgorithm={sortRoomsByAlgorithm}
                          getFirstAvailablePlace={getFirstAvailablePlace}
                          onShowGuide={() => setShowRoomGuide(true)}
                          hoverBorderClass="hover:border-blue-300"
                          placeholderText="Sélectionner un hôtel à Madina"
                          allowNone={false}
                        />
                      )}

                      {showMakkahBlock && (
                        <HotelCategoryBlock
                          labelIcon="🕋"
                          labelText="Hôtel à Makkah *"
                          headerIcon="🕋"
                          headerText="Chambres disponibles à Makkah"
                          hotels={hotelsMakkah}
                          value={formData.hotelMakkah}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, hotelMakkah: value }))}
                          disabled={!formData.programId}
                          rooms={programInfo?.rooms || []}
                          roomType={formData.typeChambre}
                          gender={formData.gender}
                          selectedPlaces={selectedPlacesMakkah}
                          onSelectRoom={(roomId, place) => setSelectedPlacesMakkah({ [roomId]: [place] })}
                          sortRoomsByAlgorithm={sortRoomsByAlgorithm}
                          getFirstAvailablePlace={getFirstAvailablePlace}
                          onShowGuide={() => setShowRoomGuide(true)}
                          hoverBorderClass="hover:border-green-300"
                          placeholderText="Sélectionner un hôtel à Makkah"
                          allowNone={false}
                        />
                      )}

                      {/* Hôtels Autre actifs (obligatoires) — désactivables via le panneau « Éditer » */}
                      {hotelsAutreActifs.map((ph) => {
                          const hotelId = ph.hotel.id;
                          const value = hotelsAutreSelection[hotelId] ?? hotelId.toString();
                          return (
                            <HotelCategoryBlock
                              key={hotelId}
                              labelIcon="🏨"
                              labelText={`${ph.hotel.name} *`}
                              headerIcon="🏨"
                              headerText={`Chambres disponibles — ${ph.hotel.name}`}
                              hotels={[ph.hotel]}
                              value={value}
                              onValueChange={(v) => {
                                setHotelsAutreSelection(prev => ({ ...prev, [hotelId]: v }));
                                if (v === "none") {
                                  setSelectedPlacesAutre(prev => {
                                    const next = { ...prev };
                                    delete next[hotelId];
                                    return next;
                                  });
                                }
                              }}
                              disabled={!formData.programId}
                              rooms={programInfo?.rooms || []}
                              roomType={formData.typeChambre}
                              gender={formData.gender}
                              selectedPlaces={selectedPlacesAutre[hotelId] || {}}
                              onSelectRoom={(roomId, place) => setSelectedPlacesAutre(prev => ({ ...prev, [hotelId]: { [roomId]: [place] } }))}
                              sortRoomsByAlgorithm={sortRoomsByAlgorithm}
                              getFirstAvailablePlace={getFirstAvailablePlace}
                              onShowGuide={() => setShowRoomGuide(true)}
                              hoverBorderClass="hover:border-green-300"
                              placeholderText={`Sélectionner ${ph.hotel.name}`}
                              allowNone={false}
                            />
                          );
                        })}
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
                                    <BlockersTooltip
                                      blockers={getPaymentReceiptBlockers(index)}
                                      enabledHint="Génère un reçu de paiement professionnel"
                                      title="Reçu indisponible :"
                                    >
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleGeneratePaymentReceipt(index)}
                                        disabled={isSubmitting || !canGeneratePaymentReceipt(index)}
                                        className="h-10 border-orange-300 text-orange-700 hover:bg-orange-50 whitespace-nowrap"
                                      >
                                        <Download className="h-3.5 w-3.5 mr-1.5" />
                                        Generer recu
                                      </Button>
                                    </BlockersTooltip>
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
                                        className="flex items-center text-orange-600 hover:text-orange-800 hover:bg-orange-50 p-2 rounded"
                                        onClick={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setPreviewImage({ url: previews[`payment_${index}`]?.url, title: 'Reçu paiement', type: previews[`payment_${index}`]?.type || 'image/*' });
                                        }}
                                      >
                                        <ZoomIn className="h-3 w-3 mr-1" />
                                        Zoom
                                      </button>
                                      <button
                                        type="button"
                                        className="flex items-center text-orange-600 hover:text-orange-800 hover:bg-orange-50 p-2 rounded"
                                        onClick={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleDownloadPaymentReceipt(index);
                                        }}
                                      >
                                        <Download className="h-3 w-3 mr-1" />
                                        Télécharger
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
                      <BlockersTooltip
                        blockers={getReservationBlockers()}
                        title="Paiement indisponible :"
                        className="block w-full"
                      >
                        <Button
                          type="button"
                          onClick={ajouterPaiement}
                          disabled={getReservationBlockers().length > 0}
                          variant="outline"
                          size="sm"
                          className="w-full border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 h-12"
                        >
                          <Plus className="mr-2 h-5 w-5" />
                          Ajouter un paiement
                        </Button>
                      </BlockersTooltip>
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
                    <BlockersTooltip
                      blockers={isSubmitting ? [] : getSubmitBlockers()}
                      title="Enregistrement indisponible :"
                    >
                      <Button
                        type="submit"
                        disabled={!isFormValid || isSubmitting || (prixMode === 'proposition' && prixPropose !== null && prixPropose < calculatePrice)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                      </Button>
                    </BlockersTooltip>
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
              <BlockersTooltip
                blockers={isSubmitting ? [] : getSubmitBlockers()}
                title="Enregistrement indisponible :"
              >
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
              </BlockersTooltip>
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
