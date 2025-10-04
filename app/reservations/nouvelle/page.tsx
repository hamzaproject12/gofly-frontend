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
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
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

type Documents = {
  passport: File | null;
  visa: File | null;
  billet: File | null;
  hotel: File | null;
  paiements: File[];
};

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
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; type: string } | null>(null);
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
    joursMakkah: 0  // Sera initialisé avec les valeurs du programme
  });

  // État pour la réduction du prix
  const [reduction, setReduction] = useState(0);

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
        profit: data.profit,
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
      
      // LOGS DÉTAILLÉS DU CALCUL SANS HÔTEL
      console.log('🔍 === DÉTAIL DU CALCUL DU PRIX (SANS HÔTEL) ===');
      console.log('📊 Données de base:');
      console.log('   - Taux de change:', programInfo.exchange, 'DH/Riyal');
      console.log('   - Profit fixe:', programInfo.profit, 'DH');
      
      console.log('✈️ Prix Avion:');
      console.log('   - Inclus:', customization.includeAvion ? 'OUI' : 'NON');
      console.log('   - Prix:', prixAvion, 'DH');
      
      console.log('📄 Prix Visa:');
      console.log('   - Inclus:', customization.includeVisa ? 'OUI' : 'NON');
      console.log('   - Prix:', prixVisa, 'Riyals');
      console.log('   - Conversion en DH:', prixVisa * programInfo.exchange, 'DH');
      
      console.log('🧮 Calcul détaillé:');
      console.log('   - Prix Avion:', prixAvion, 'DH');
      console.log('   - Profit:', programInfo.profit, 'DH');
      console.log('   - Visa converti:', prixVisa * programInfo.exchange, 'DH');
      
      const prixFinal = prixAvion + programInfo.profit + (prixVisa * programInfo.exchange);
      
      console.log('💰 === RÉSULTAT FINAL (SANS HÔTEL) ===');
      console.log('   - Prix Avion:', prixAvion, 'DH');
      console.log('   - Profit:', programInfo.profit, 'DH');
      console.log('   - Visa converti:', prixVisa * programInfo.exchange, 'DH');
      console.log('   - PRIX FINAL:', prixFinal, 'DH');
      console.log('✅ Prix calculé (sans hôtel):', prixFinal);
      return Math.round(prixFinal * 100) / 100;
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

    // Calculer le prix des hôtels selon la sélection
    const prixHotelMadina = (formData.hotelMadina !== "none" && roomMadina) ? (prixRoomMadina / nbPersonnes) * joursUtilisesMadina : 0;
    const prixHotelMakkah = (formData.hotelMakkah !== "none" && roomMakkah) ? (prixRoomMakkah / nbPersonnes) * joursUtilisesMakkah : 0;

    // LOGS DÉTAILLÉS DU CALCUL
    console.log('🔍 === DÉTAIL DU CALCUL DU PRIX ===');
    console.log('📊 Données de base:');
    console.log('   - Type de chambre:', roomType, `(${nbPersonnes} personne${nbPersonnes > 1 ? 's' : ''})`);
    console.log('   - Genre:', gender);
    console.log('   - Taux de change:', programInfo.exchange, 'DH/Riyal');
    console.log('   - Profit fixe:', programInfo.profit, 'DH');
    
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
    console.log('   - Profit:', programInfo.profit, 'DH');
    console.log('   - Total Riyals (Visa + Hôtels):', (prixVisa + prixHotelMakkah + prixHotelMadina), 'Riyals');
    console.log('   - Conversion en DH:', (prixVisa + prixHotelMakkah + prixHotelMadina) * programInfo.exchange, 'DH');
    
    const prixFinal = prixAvion 
      + programInfo.profit 
      + (prixVisa + prixHotelMakkah + prixHotelMadina) * programInfo.exchange;

    console.log('💰 === RÉSULTAT FINAL ===');
    console.log('   - Prix Avion:', prixAvion, 'DH');
    console.log('   - Profit:', programInfo.profit, 'DH');
    console.log('   - Services (Visa + Hôtels) convertis:', (prixVisa + prixHotelMakkah + prixHotelMadina) * programInfo.exchange, 'DH');
    console.log('   - PRIX FINAL:', prixFinal, 'DH');
    console.log('✅ Prix calculé:', prixFinal);
    return Math.round(prixFinal * 100) / 100; // Arrondir à 2 décimales
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

  // Mettre à jour le prix automatiquement quand le calcul ou la réduction change
  useEffect(() => {
    if (calculatePrice > 0) {
      const prixFinal = calculatePrice - reduction;
      setFormData(prev => ({ ...prev, prix: prixFinal.toString() }));
    }
  }, [calculatePrice, reduction]);

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
        joursMakkah: programInfo.nbJoursMakkah
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
  const isFormValid = useMemo(() => {
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
    return paiements.length > 0 && paiements.every(p => p.montant && p.type)
  }, [paiements])

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
    setPaiements([...paiements, { montant: "", type: "", recu: null }])
  }

  const supprimerPaiement = (index: number) => {
    setPaiements(paiements.filter((_, i) => i !== index))
  }

  const mettreAJourPaiement = (index: number, field: keyof Paiement, value: string) => {
    setPaiements(prev => {
      const newPaiements = [...prev]
      newPaiements[index] = {
        ...newPaiements[index],
        [field]: value
      }
      return newPaiements
    })
  }

  // Fonction pour vérifier si le fichier est une image
  const isImageFile = (url: string) => {
    return url.match(/\.(jpeg|jpg|gif|png)$/) != null;
  };

  // Fonction pour uploader vers Cloudinary
  const uploadToCloudinary = async (file: File, type: DocumentType): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', type);
      formData.append('fileCategory', 'reservation');

      const response = await fetch(api.url(api.endpoints.uploadCloudinary), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Erreur lors de l\'upload');

      const result = await response.json();
      return result.data.cloudinaryUrl;
    } catch (error) {
      console.error('Erreur upload Cloudinary:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'uploader le fichier vers Cloudinary",
        variant: "destructive"
      });
      return null;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: DocumentType) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      // Upload vers Cloudinary pour le passeport
      if (type === 'passport') {
        const cloudinaryUrl = await uploadToCloudinary(file, type);
        if (cloudinaryUrl) {
          setDocuments(prev => ({
            ...prev,
            [type]: file
          }));
          setAttachmentStatus(prev => ({
            ...prev,
            [type]: true
          }));
          setPreviews(prev => ({
            ...prev,
            [type]: { url: cloudinaryUrl, type: file.type }
          }));
          toast({
            title: "Succès",
            description: "Passeport uploadé avec succès vers Cloudinary",
          });
        }
      } else {
        // Pour les autres types de documents, garder l'ancienne logique
        setDocuments(prev => ({
          ...prev,
          [type]: file
        }));
        setAttachmentStatus(prev => ({
          ...prev,
          [type]: true
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
    } else {
      toast({
        title: "Erreur",
        description: "Format de fichier non supporté. Seuls les fichiers PDF et images sont acceptés.",
        variant: "destructive",
      });
    }
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
  const handlePaymentFileChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
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

    // Upload vers Cloudinary pour les reçus de paiement
    const cloudinaryUrl = await uploadToCloudinary(file, 'payment');
    if (cloudinaryUrl) {
      // Mettre à jour le fichier de paiement à l'index
      setDocuments(prev => {
        const newPayments = [...(prev.payment || [])];
        newPayments[index] = file;
        return { ...prev, payment: newPayments };
      });
      
      // Créer l'aperçu avec l'URL Cloudinary
      setPreviews(prev => ({
        ...prev,
        [`payment_${index}`]: { url: cloudinaryUrl, type: file.type }
      }));

      // Mettre à jour le paiement avec l'URL Cloudinary
      mettreAJourPaiement(index, 'recu', cloudinaryUrl);
      
      toast({
        title: "Succès",
        description: "Reçu de paiement uploadé avec succès vers Cloudinary",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('handleSubmit appelé');
    console.log('paiements:', paiements);
    console.log('documents.payment:', documents.payment);
    e.preventDefault();
    setIsSubmitting(true);

    // Calculer la somme des montants des paiements juste avant l'insertion
    const paidAmount = paiements.reduce((total, p) => total + (Number(p.montant) || 0), 0);

    // Déterminer le statut de la réservation
    const allDocsAttached = attachmentStatus.passport && attachmentStatus.visa && attachmentStatus.flightBooked && attachmentStatus.hotelBooked;
    const isPaid = paidAmount === parseFloat(formData.prix);
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
      const reservationResponse = await fetch(api.url(api.endpoints.reservations), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: formData.prenom,
          lastName: formData.nom,
          phone: formData.telephone,
          programId: parseInt(formData.programId),
          roomType: formData.typeChambre,
          gender: formData.gender,
          hotelMadina: hotelsMadina.find(h => h.id.toString() === formData.hotelMadina)?.name || formData.hotelMadina,
          hotelMakkah: hotelsMakkah.find(h => h.id.toString() === formData.hotelMakkah)?.name || formData.hotelMakkah,
          price: parseFloat(formData.prix),
          reduction: reduction || 0,
          reservationDate: formData.dateReservation,
          status: reservationStatus,
          statutPasseport: attachmentStatus.passport,
          statutVisa: customization.includeVisa ? formData.statutVisa : false,
          statutHotel: (formData.hotelMadina !== "none" || formData.hotelMakkah !== "none") ? formData.statutHotel : false,
          statutVol: customization.includeAvion ? formData.statutVol : false,
          paidAmount: paidAmount,
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

      // Passeport
      if (documents.passport) {
        const formDataPassport = new FormData();
        formDataPassport.append("passport", documents.passport);
        formDataPassport.append("reservationId", reservationId.toString());
        fileUploadPromises.push(
          fetch(api.url(api.endpoints.upload), {
            method: "POST",
            body: formDataPassport,
          }).then(async (response) => {
            if (response.ok) {
              newUploadedStatus.passport = true;
            } else {
              const error = await response.json();
              fileUploadErrors.push(`Erreur lors de l'upload du passeport: ${error.error}`);
            }
            return response;
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
          console.log('🚀 Traitement fichier paiement avec Cloudinary:', { file, index });
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
            
            console.log('✅ Résultat upload Cloudinary:', {
              data,
              uploadedFile,
              fichierId,
              paiement: paiements[index],
              cloudinaryInfo: uploadedFile?.cloudinaryInfo
            });
            
            // Insérer le paiement avec le fichierId
            const paiement = paiements[index];
            if (paiement && fichierId) {
              console.log('💰 Paiement à insérer (avec fichier Cloudinary):', {
                paiement,
                fichierId,
                cloudinaryUrl: uploadedFile?.cloudinaryUrl,
                index,
                paiements,
                documentsPayment: documents.payment
              });
              
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
              console.log('✅ Réponse API /api/payments (avec fichier Cloudinary):', paymentData);
              
              if (!paymentResponse.ok || !paymentData.id) {
                paymentErrors.push(`Erreur lors de l'insertion du paiement ${index + 1}: ${paymentData.error || 'Aucune confirmation de la base'}`);
              } else {
                console.log('🎉 Paiement créé avec succès avec fichier Cloudinary:', {
                  paymentId: paymentData.id,
                  cloudinaryUrl: uploadedFile?.cloudinaryUrl,
                  fichierId
                });
              }
            }
          } else {
            const error = await response.json();
            console.error('❌ Erreur upload Cloudinary:', error);
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
            console.log('Paiement à insérer (sans fichier):', {
              paiement,
              index,
              paiements
            });
            const paymentResponse = await fetch('http://localhost:5000/api/payments', {
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
            console.log('Réponse API /api/payments (sans fichier):', paymentData);
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
        console.log('Expense Vol à créer:', volExpense);
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
        console.log('Expense Visa à créer:', visaExpense);
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
          console.log('Expense Hotel Madina à créer:', hotelMadinaExpense);
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
          console.log('Expense Hotel Makkah à créer:', hotelMakkahExpense);
        }
      }

      // Créer toutes les expenses
      console.log('=== CRÉATION DES EXPENSES ===');
      console.log('Expenses à créer:', expensesToCreate);
      
      await Promise.all(expensesToCreate.map(async (expense, index) => {
        console.log(`Création de l'expense ${index + 1}:`, expense);
        
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
        
        console.log('Réponse API /api/expenses:', expenseData, 'status:', expenseResponse.status);
        
        if (!expenseResponse.ok || !expenseData || !expenseData.id) {
          console.error('Erreur lors de l\'insertion de la dépense:', expenseData);
          expenseErrors.push(`Erreur lors de l'insertion de la dépense ${expense.type}: ${expenseData?.error || 'Aucune confirmation de la base'}`);
        } else {
          console.log(`✅ Expense ${expense.type} créée avec succès, ID:`, expenseData.id);
        }
      }));

      if (expenseErrors.length > 0) {
        throw new Error([...fileUploadErrors, ...paymentErrors, ...expenseErrors].join('\n'));
      }

      // PATCH la réservation pour mettre à jour les statuts
      await fetch(api.url(`/api/reservations/${reservationId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/30">
                      <Wallet className="h-4 w-4 text-white" />
                      <span className="text-sm text-white/80 font-medium">Prix:</span>
                      <span className="text-lg font-bold text-white">
                        {formData.prix ? parseFloat(formData.prix).toLocaleString('fr-FR') : calculatePrice.toLocaleString('fr-FR')} DH
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

                {/* Section 2: Informations Client restantes */}
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
                          disabled={isSubmitting}
                        />
                        {documents.passport && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveDocument('passport')}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            disabled={isSubmitting}
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
                            <div className="md:col-span-6 space-y-2">
                              <Label className="text-orange-700 font-medium text-sm">Reçu de paiement</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="file"
                                  onChange={e => handlePaymentFileChange(e, index)}
                                  accept="image/*,.pdf"
                                  className="h-10 border-2 border-orange-200 focus:border-orange-500 rounded-lg"
                                  disabled={isSubmitting}
                                />
                                {previews[`payment_${index}`] && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      mettreAJourPaiement(index, 'recu', '');
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
                                          setPreviewImage({ url: previews[`payment_${index}`].url, title: 'Reçu paiement', type: previews[`payment_${index}`].type });
                                        }}
                                      >
                                        <ZoomIn className="h-3 w-3 mr-1" />
                                        Zoom
                                      </button>
                                    </div>
                                  </div>
                                  <div className="w-full h-[200px] overflow-hidden rounded-lg border border-orange-200 flex items-center justify-center bg-orange-50">
                                    {previews[`payment_${index}`].type === 'application/pdf' ? (
                                      <embed
                                        src={`${previews[`payment_${index}`].url}#toolbar=0&navpanes=0&scrollbar=0`}
                                        type="application/pdf"
                                        className="w-full h-full"
                                      />
                                    ) : (
                                      <img
                                        src={previews[`payment_${index}`].url}
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
                      disabled={!isFormValid || isSubmitting}
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
              {/* Section calcul du prix - Réduction et Total seulement */}
              <div className="flex items-center gap-4">
                {/* Champ de réduction */}
                <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                  <X className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700">Réduction:</span>
                  <Input
                    type="number"
                    min="0"
                    max={calculatePrice}
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
                    className="w-24 h-7 text-sm border border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-200 rounded text-center bg-white font-medium"
                    placeholder="0"
                  />
                  <span className="text-sm text-red-600 font-medium">DH</span>
                </div>
                
                {/* Prix final */}
                <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-100 to-teal-100 px-3 py-2 rounded-lg border border-emerald-300">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">Total:</span>
                  <span className="font-bold text-emerald-700 text-lg">{(calculatePrice - reduction).toLocaleString('fr-FR')} DH</span>
                </div>

                {/* Indicateur d'économie si réduction */}
                {reduction > 0 && (
                  <div className="px-2 py-1 bg-red-100 border border-red-200 rounded text-xs text-red-600 font-medium">
                    -{reduction.toLocaleString('fr-FR')} DH
                  </div>
                )}
              </div>
              
              {/* Bouton de confirmation */}
              <Button
                type="submit"
                disabled={!isFormValid || isSubmitting}
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
                  <embed
                    src={`${previewImage.url}#toolbar=0&navpanes=0&scrollbar=0`}
                    type="application/pdf"
                    className="w-full h-full"
                  />
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
