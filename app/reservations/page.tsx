"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Calendar,
  MapPin,
  Users,
  FileText,
  CreditCard,
  Bell,
  Settings,
  Wallet,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Trash2,
  BadgeCheck,
  Stamp,
  Hotel as HotelIcon,
  Plane,
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"
import { format } from "date-fns"

// Types
type Reservation = {
  id: number
  firstName: string
  lastName: string
  phone: string
  programId: number
  roomType: string
  hotelMadina: string
  hotelMakkah: string
  price: number
  paidAmount: number
  passport: boolean
  visa: boolean
  hotelBooked: boolean
  flightBooked: boolean
  status: string
  dateReservation: string
  statutPasseport: boolean
  statutVisa: boolean
  statutHotel: boolean
  statutVol: boolean
  program: {
    id: number
    name: string
    visaDeadline?: string
    hotelDeadline?: string
    flightDeadline?: string
    passportDeadline?: string
  }
}

type Program = {
  id: number
  name: string
}

type TransformedReservation = {
  id: number
  nom: string
  prenom: string
  telephone: string
  programme: string
  chambre: string
  hotelMadina: string
  hotelMakkah: string
  prixEngage: number
  paiementRecu: number
  dateReservation: string
  passeport: boolean
  visa: boolean
  reservationHotel: boolean
  billetAvion: boolean
  statut: string
  echeanceProche: boolean
  visaDeadline?: string
  hotelDeadline?: string
  flightDeadline?: string
  passportDeadline?: string
  urgentReason?: string
  urgentDate?: Date
}

type Stats = {
  total: number
  complete: number
  incomplete: number
  urgent: number
}

type Hotel = {
  id: number;
  name: string;
  city: string;
  programId?: number | null;
};

// Add status mapping
const statusMapping = {
  'Complet': 'Complet',
  'Incomplet': 'Incomplet',
  'Urgent': 'Urgent',
  'all': undefined
} as const;

export default function ReservationsPage() {
  const [mounted, setMounted] = useState(false)
  const [reservations, setReservations] = useState<TransformedReservation[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [programmeFilter, setProgrammeFilter] = useState("tous")
  const [statutFilter, setStatutFilter] = useState("all")
  const [chambreFilter, setChambreFilter] = useState("toutes")
  const [stats, setStats] = useState<Stats>({
    total: 0,
    complete: 0,
    incomplete: 0,
    urgent: 0
  })
  const [hotels, setHotels] = useState<Hotel[]>([])
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<number | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReservations, setTotalReservations] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  
  // Filtres avancés
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    search: ''
  });
  
  const DAYS_URGENCY_WINDOW = 18;

  // Fonction pour mapper les types de chambre en nombre de personnes
  const mapRoomTypeToPersons = (roomType: string): string => {
    const mapping: { [key: string]: string } = {
      'SINGLE': '2 personnes',
      'DOUBLE': '3 personnes', 
      'TRIPLE': '4 personnes',
      'QUAD': '5 personnes'
    };
    return mapping[roomType] || roomType;
  };

  const handleFilterChange = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent form submission
  };

  const handleProgrammeChange = (value: string) => {
    setProgrammeFilter(value);
  };

  const handleStatutChange = (value: string) => {
    setStatutFilter(value);
  };

  const handleChambreChange = (value: string) => {
    setChambreFilter(value);
  };

  // Fonctions de pagination
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchData(newPage);
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      handlePageChange(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (hasPrevPage) {
      handlePageChange(currentPage - 1);
    }
  };

  // Fonction de recherche et filtrage
  const handleSearch = (query: string) => {
    setFilters(prev => ({ ...prev, search: query }));
    setCurrentPage(1); // Retour à la première page
    fetchData(1);
  };

  const handleDateFilter = (from: string, to: string) => {
    setFilters(prev => ({ ...prev, dateFrom: from, dateTo: to }));
    setCurrentPage(1);
    fetchData(1);
  };

  const fetchData = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      
      // Construire l'URL avec tous les filtres et la pagination
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        program: programmeFilter,
        status: statutFilter,
        roomType: chambreFilter,
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
        ...(filters.search && { search: filters.search })
      });
      
      const [reservationsRes, programsRes, statsRes] = await Promise.all([
        fetch(`http://localhost:5000/api/reservations?${params}`),
        fetch('http://localhost:5000/api/programs'),
        fetch(`http://localhost:5000/api/reservations/stats?${params}`)
      ]);

      if (!reservationsRes.ok || !programsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const reservationsResponse = await reservationsRes.json();
      const programsData: Program[] = await programsRes.json();
      const statsData = await statsRes.json();

      // Extraire les données de pagination
      const { reservations: reservationsData, pagination } = reservationsResponse;
      
      setPrograms(programsData);
      setStats(statsData);
      
      // Mettre à jour l'état de pagination
      setCurrentPage(pagination.currentPage);
      setTotalPages(pagination.totalPages);
      setTotalReservations(pagination.totalReservations);
      setHasNextPage(pagination.hasNextPage);
      setHasPrevPage(pagination.hasPrevPage);

      // Transform reservations data
      const transformedReservations = reservationsData.map(reservation => {
        // Si la réservation est déjà complète, ne jamais la mettre en urgent
        if (reservation.status === "Complet") {
          return {
            id: reservation.id,
            nom: reservation.lastName,
            prenom: reservation.firstName,
            telephone: reservation.phone,
            programme: programsData.find(p => p.id === reservation.programId)?.name || '',
            chambre: reservation.roomType,
            hotelMadina: reservation.hotelMadina,
            hotelMakkah: reservation.hotelMakkah,
            prixEngage: reservation.price,
            paiementRecu: reservation.paidAmount,
            dateReservation: reservation.dateReservation,
            passeport: reservation.statutPasseport,
            visa: reservation.statutVisa,
            reservationHotel: reservation.statutHotel,
            billetAvion: reservation.statutVol,
            statut: "Complet",
            echeanceProche: false,
            visaDeadline: reservation.program?.visaDeadline,
            hotelDeadline: reservation.program?.hotelDeadline,
            flightDeadline: reservation.program?.flightDeadline,
            passportDeadline: reservation.program?.passportDeadline,
            urgentReason: undefined,
            urgentDate: undefined,
          };
        }
        // Nouvelle logique d'urgence : on teste dans l'ordre Passeport, Visa, Hôtel, Vol
        const now = new Date();
        let isUrgent = false;
        let urgentReason = undefined;
        let urgentDate = undefined;
        // Passeport
        if (!reservation.statutPasseport && reservation.program?.passportDeadline) {
          const date = new Date(reservation.program.passportDeadline);
          const diff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (diff >= 0 && diff <= DAYS_URGENCY_WINDOW) {
            isUrgent = true;
            urgentReason = "Passeport";
            urgentDate = date;
          }
        }
        // Visa
        if (!isUrgent && !reservation.statutVisa && reservation.program?.visaDeadline) {
          const date = new Date(reservation.program.visaDeadline);
          const diff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (diff >= 0 && diff <= DAYS_URGENCY_WINDOW) {
            isUrgent = true;
            urgentReason = "Visa";
            urgentDate = date;
          }
        }
        // Hôtel
        if (!isUrgent && !reservation.statutHotel && reservation.program?.hotelDeadline) {
          const date = new Date(reservation.program.hotelDeadline);
          const diff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (diff >= 0 && diff <= DAYS_URGENCY_WINDOW) {
            isUrgent = true;
            urgentReason = "Hôtel";
            urgentDate = date;
          }
        }
        // Vol
        if (!isUrgent && !reservation.statutVol && reservation.program?.flightDeadline) {
          const date = new Date(reservation.program.flightDeadline);
          const diff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (diff >= 0 && diff <= DAYS_URGENCY_WINDOW) {
            isUrgent = true;
            urgentReason = "Billet";
            urgentDate = date;
          }
        }
        return {
          id: reservation.id,
          nom: reservation.lastName,
          prenom: reservation.firstName,
          telephone: reservation.phone,
          programme: programsData.find(p => p.id === reservation.programId)?.name || '',
          chambre: reservation.roomType,
          hotelMadina: reservation.hotelMadina,
          hotelMakkah: reservation.hotelMakkah,
          prixEngage: reservation.price,
          paiementRecu: reservation.paidAmount,
          dateReservation: reservation.dateReservation,
          passeport: reservation.statutPasseport,
          visa: reservation.statutVisa,
          reservationHotel: reservation.statutHotel,
          billetAvion: reservation.statutVol,
          statut: isUrgent ? "Urgent" : reservation.status,
          echeanceProche: isUrgent,
          visaDeadline: reservation.program?.visaDeadline,
          hotelDeadline: reservation.program?.hotelDeadline,
          flightDeadline: reservation.program?.flightDeadline,
          passportDeadline: reservation.program?.passportDeadline,
          urgentReason,
          urgentDate,
        };
      });

      setReservations(transformedReservations);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [programmeFilter, statutFilter, chambreFilter]);

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      fetchData()
    }
  }, [mounted, fetchData])

  // Filtrage côté client après transformation
  const filteredReservations = useMemo(() => {
    return reservations.filter((reservation) => {
      // Filtre par recherche
      const searchMatch =
        reservation.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reservation.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reservation.telephone.includes(searchQuery) ||
        reservation.programme.toLowerCase().includes(searchQuery.toLowerCase());

      // Filtre par statut (utilise le statut final affiché)
      const statusMatch = statutFilter === "all" || reservation.statut === statutFilter;

      return searchMatch && statusMatch;
    });
  }, [reservations, searchQuery, statutFilter]);

  const getRowColor = (reservation: any) => {
    if (reservation.statut === "Complet") return "border-l-4 border-green-500 bg-green-50"
    if (reservation.statut === "Urgent" || reservation.echeanceProche) return "border-l-4 border-red-500 bg-red-50"
    return "border-l-4 border-yellow-500 bg-yellow-50"
  }

  const getStatusIcon = (value: boolean) => {
    return (
      <span className={`flex items-center justify-center w-6 h-6 rounded-full ${value ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{value ? '✓' : '!'}</span>
    )
  }

  const getPaiementStatus = (recu: number, engage: number) => {
    const pourcentage = (recu / engage) * 100

    if (pourcentage >= 100) {
      return (
        <div className="flex flex-col items-center">
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
            <div className="bg-green-600 h-2.5 rounded-full" style={{ width: "100%" }}></div>
          </div>
          <span className="text-xs font-medium text-green-600">100%</span>
        </div>
      )
    } else {
      return (
        <div className="flex flex-col items-center">
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
            <div
              className={`${pourcentage < 50 ? "bg-red-600" : "bg-yellow-500"} h-2.5 rounded-full`}
              style={{ width: `${pourcentage}%` }}
            ></div>
          </div>
          <span className={`text-xs font-medium ${pourcentage < 50 ? "text-red-600" : "text-yellow-500"}`}>
            {pourcentage.toFixed(0)}%
          </span>
        </div>
      )
    }
  }

  // Avant le map sur filteredReservations, on trie pour mettre les urgentes en haut
  const sortedReservations = [...filteredReservations].sort((a, b) => {
    if (a.statut === "Urgent" && b.statut !== "Urgent") return -1;
    if (a.statut !== "Urgent" && b.statut === "Urgent") return 1;
    return 0;
  });

  // Add computed stats based on filtered reservations
  const computedStats = useMemo(() => {
    const filtered = reservations.filter(reservation => {
      const searchMatch =
        reservation.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reservation.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reservation.telephone.includes(searchQuery) ||
        reservation.programme.toLowerCase().includes(searchQuery.toLowerCase());

      return searchMatch;
    });

    return {
      total: filtered.length,
      complete: filtered.filter(r => r.statut === 'Complet').length,
      incomplete: filtered.filter(r => r.statut === 'Incomplet').length,
      urgent: filtered.filter(r => r.statut === 'Urgent').length
    };
  }, [reservations, searchQuery]);

  const handleDeleteReservation = async (id: number) => {
    setDeleteDialogOpen(false);
    try {
      const res = await fetch(`http://localhost:5000/api/reservations/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la suppression');
      }
      toast({
        title: "Suppression réussie",
        description: "La réservation a bien été supprimée.",
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || 'Erreur lors de la suppression',
        variant: "destructive",
      });
    }
  };

  if (!mounted) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading reservations...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center text-red-600">
            <p>Error: {error}</p>
            <Button 
              onClick={() => fetchData()} 
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Navigation moderne */}
      <nav className="bg-white/95 backdrop-blur-lg shadow-xl border-b border-blue-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-yellow-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">G</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent">
                    GoFly
                  </h1>
                  <p className="text-xs text-gray-500">Gestion Réservations</p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-1">
              <Link href="/">
                <Button
                  variant="ghost"
                  className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/programmes">
                <Button
                  variant="ghost"
                  className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Programmes
                </Button>
              </Link>
              <Link href="/depenses">
                <Button
                  variant="ghost"
                  className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Dépenses
                </Button>
              </Link>
              <Link href="/solde">
                <Button
                  variant="ghost"
                  className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Solde Caisse
                </Button>
              </Link>
            </div>

            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" className="rounded-xl">
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Réservations</h1>
            <p className="text-gray-500 mt-1">Gérez et suivez toutes vos réservations Omra</p>
          </div>
          <Link href="/reservations/nouvelle">
            <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Réservation
            </Button>
          </Link>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <Users className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{computedStats.total}</div>
                  <div className="text-xs text-white/80">réservations</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Total Réservations</h3>
                <p className="text-xs text-white/80">Filtres appliqués</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <CheckCircle className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{computedStats.complete}</div>
                  <div className="text-xs text-white/80">complètes</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Complètes</h3>
                <p className="text-xs text-white/80">Filtres appliqués</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-yellow-500 via-yellow-600 to-yellow-700 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <AlertCircle className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{computedStats.incomplete}</div>
                  <div className="text-xs text-white/80">incomplètes</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Incomplètes</h3>
                <p className="text-xs text-white/80">Filtres appliqués</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <AlertTriangle className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{computedStats.urgent}</div>
                  <div className="text-xs text-white/80">urgentes</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Urgentes</h3>
                <p className="text-xs text-white/80">Filtres appliqués</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres */}
        <Card className="mb-8 border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 pb-2">
            <CardTitle className="text-blue-800 flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5 text-blue-600" />
              Filtres et recherche
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleFilterChange} className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Rechercher par nom, téléphone, programme..."
                  value={filters.search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 h-12 border-2 focus:border-blue-500"
                />
              </div>

              <Select value={programmeFilter} onValueChange={handleProgrammeChange}>
                <SelectTrigger className="h-12 border-2 focus:border-blue-500">
                  <SelectValue placeholder="Programme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les programmes</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.name}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statutFilter} onValueChange={handleStatutChange}>
                <SelectTrigger className="h-12 border-2 focus:border-blue-500">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="Complet">Complète</SelectItem>
                  <SelectItem value="Incomplet">Incomplète</SelectItem>
                  <SelectItem value="Urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>

              <Select value={chambreFilter} onValueChange={handleChambreChange}>
                <SelectTrigger className="h-12 border-2 focus:border-blue-500">
                  <SelectValue placeholder="Type de chambre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="toutes">Toutes les chambres</SelectItem>
                  <SelectItem value="SINGLE">2 personnes</SelectItem>
                  <SelectItem value="DOUBLE">3 personnes</SelectItem>
                  <SelectItem value="TRIPLE">4 personnes</SelectItem>
                  <SelectItem value="QUAD">5 personnes</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                placeholder="Date de début"
                value={filters.dateFrom}
                onChange={(e) => handleDateFilter(e.target.value, filters.dateTo)}
                className="h-12 border-2 focus:border-blue-500"
              />

              <Input
                type="date"
                placeholder="Date de fin"
                value={filters.dateTo}
                onChange={(e) => handleDateFilter(filters.dateFrom, e.target.value)}
                className="h-12 border-2 focus:border-blue-500"
              />
            </form>
          </CardContent>
        </Card>

        {/* Liste des Réservations */}
        <Card className="border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-blue-800 flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-blue-600" />
                Liste des Réservations
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-blue-700">
                <ArrowUpDown className="h-4 w-4 mr-1" />
                Trier
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {sortedReservations.map((reservation) => {
                // Détermination de la deadline urgente et de la raison
                let urgentInfo = null;
                if (reservation.statut === "Urgent" && reservation.urgentReason && reservation.urgentDate) {
                  urgentInfo = { date: reservation.urgentDate, label: reservation.urgentReason };
                }
                // Détermine la classe de fond selon le statut
                const urgentBg = reservation.statut === "Urgent" ? "bg-red-50" : "";
                return (
                  <div key={reservation.id} className="mx-2 mb-3">
                    <div className={`relative group transition-all duration-300 rounded-xl shadow border hover:scale-[1.01] hover:shadow-xl ${getRowColor(reservation)} ${urgentBg}`}> 
                      {/* Premier niveau : NOM, PROGRAMME, TYPE DE CHAMBRE, STATUT */}
                      <div className="flex flex-col md:flex-row md:items-center gap-2 p-3 border-b border-blue-100">
                        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-3 min-w-[180px]">
                          <span className="font-bold text-xl text-blue-900 tracking-tight uppercase">{reservation.nom} {reservation.prenom}</span>
                          <span className="inline-flex items-center gap-1 text-base font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-1">
                            <Calendar className="h-5 w-5 text-blue-400" /> {reservation.programme}
                          </span>
                          <span className="inline-flex items-center gap-1 text-base font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-1">
                            <Users className="h-5 w-5 text-yellow-400" /> {mapRoomTypeToPersons(reservation.chambre)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          {reservation.statut === "Complet" && (
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 border border-green-200 rounded px-4 py-1 text-lg font-bold">
                              <CheckCircle className="h-5 w-5" /> Complet
                            </span>
                          )}
                          {reservation.statut === "Incomplet" && (
                            <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded px-4 py-1 text-lg font-bold">
                              <AlertCircle className="h-5 w-5" /> Incomplet
                            </span>
                          )}
                          {reservation.statut === "Urgent" && (
                            <span className="inline-flex items-center gap-2 bg-red-100 text-red-800 border border-red-200 rounded px-4 py-1 text-lg font-bold">
                              <AlertTriangle className="h-5 w-5 animate-bounce text-red-600" />
                              Urgent
                              {urgentInfo && (
                                <span className="ml-2 text-xs font-semibold text-red-700 flex flex-col items-start">
                                  <span>Échéance : {format(urgentInfo.date, 'dd/MM/yyyy')}</span>
                                  <span>Raison : {urgentInfo.label}</span>
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Deuxième niveau : hôtels, paiement, statuts attachements */}
                      <div className="flex flex-col md:flex-row md:items-center gap-2 px-3 py-2">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-[18%_32%_32%_18%] gap-2 text-sm items-stretch">
                          {/* Colonne 1 : Hôtels avec description */}
                          <div className="flex flex-col items-start justify-between h-full px-1">
                            <div>
                              <div className="text-xs text-blue-700 font-semibold mb-1">Hôtel Madina</div>
                              <div className="flex items-center gap-1 mb-2">
                                <span className="text-blue-700 text-lg"><span role='img' aria-label='madina'>🕌</span></span>
                                <span className="font-semibold text-gray-900">{hotels.find(h => h.id.toString() === reservation.hotelMadina)?.name || reservation.hotelMadina}</span>
                              </div>
                              <div className="text-xs text-blue-700 font-semibold mb-1">Hôtel Makkah</div>
                              <div className="flex items-center gap-1">
                                <span className="text-blue-700 text-lg"><span role='img' aria-label='makkah'>🕋</span></span>
                                <span className="font-semibold text-gray-900">{hotels.find(h => h.id.toString() === reservation.hotelMakkah)?.name || reservation.hotelMakkah}</span>
                              </div>
                            </div>
                          </div>
                          {/* Colonne 2 : Statuts documents */}
                          <div className="flex flex-col items-center justify-center h-full px-1">
                            <div className="grid grid-cols-4 gap-0 w-full justify-items-center">
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-700 font-semibold mb-0.5">Passeport</span>
                                <span title="Passeport">
                                  {reservation.passeport ? (
                                    <CheckCircle className="w-6 h-6 text-green-600 hover:scale-110 hover:shadow-lg transition-all duration-200" />
                                  ) : (
                                    <AlertCircle className="w-6 h-6 text-red-500 hover:scale-110 hover:shadow-lg transition-all duration-200" />
                                  )}
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-700 font-semibold mb-0.5">Visa</span>
                                <span title="Visa">
                                  {reservation.visa ? (
                                    <CheckCircle className="w-6 h-6 text-green-600 hover:scale-110 hover:shadow-lg transition-all duration-200" />
                                  ) : (
                                    <AlertCircle className="w-6 h-6 text-red-500 hover:scale-110 hover:shadow-lg transition-all duration-200" />
                                  )}
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-700 font-semibold mb-0.5">Vol</span>
                                <span title="Vol">
                                  {reservation.billetAvion ? (
                                    <CheckCircle className="w-6 h-6 text-green-600 hover:scale-110 hover:shadow-lg transition-all duration-200" />
                                  ) : (
                                    <AlertCircle className="w-6 h-6 text-red-500 hover:scale-110 hover:shadow-lg transition-all duration-200" />
                                  )}
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-700 font-semibold mb-0.5">Hôtel</span>
                                <span title="Hôtel">
                                  {reservation.reservationHotel ? (
                                    <CheckCircle className="w-6 h-6 text-green-600 hover:scale-110 hover:shadow-lg transition-all duration-200" />
                                  ) : (
                                    <AlertCircle className="w-6 h-6 text-red-500 hover:scale-110 hover:shadow-lg transition-all duration-200" />
                                  )}
                                </span>
                              </div>
                              
                            </div>
                          </div>
                          {/* Colonne 3 : Paiement */}
                          <div className="flex flex-col items-start justify-between h-full px-1">
                            <div className="text-xs text-green-700 font-semibold mb-1">Paiement</div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1 mb-2">
                              <div
                                className={`h-2 rounded-full ${reservation.paiementRecu >= reservation.prixEngage ? 'bg-green-500' : reservation.paiementRecu > 0 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                style={{ width: `${Math.min(100, (reservation.paiementRecu / reservation.prixEngage) * 100)}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between items-center w-full">
                              <span className="font-bold text-gray-800 text-base">{reservation.paiementRecu.toLocaleString()} DH</span>
                              <span className="text-xs text-gray-500">/ {reservation.prixEngage.toLocaleString()} DH</span>
                              <span className={`ml-2 text-xs font-semibold ${reservation.paiementRecu >= reservation.prixEngage ? 'text-green-600' : reservation.paiementRecu > 0 ? 'text-yellow-600' : 'text-red-600'}`}>{Math.round((reservation.paiementRecu / reservation.prixEngage) * 100)}%</span>
                            </div>
                          </div>
                          {/* Colonne 4 : Actions (boutons) */}
                          <div className="flex flex-col items-center justify-center h-full px-1">
                            <div className="flex flex-row items-center justify-center gap-2 w-full h-full">
                              <Link href={`/reservations/${reservation.id}`} legacyBehavior>
                                <a title="Afficher détails" className="group">
                                  <button type="button" className="rounded-full p-1.5 bg-white shadow hover:bg-blue-100 transition-all border border-blue-200 group-hover:scale-110">
                                    <Search className="h-4 w-4 text-blue-600 group-hover:text-blue-800 transition-colors" />
                                  </button>
                                </a>
                              </Link>
                              <Link href={`/reservations/modifier/${reservation.id}`} legacyBehavior>
                                <a title="Modifier" className="group">
                                  <button type="button" className="rounded-full p-1.5 bg-white shadow hover:bg-yellow-100 transition-all border border-yellow-200 group-hover:scale-110">
                                    <Settings className="h-4 w-4 text-yellow-600 group-hover:text-yellow-800 transition-colors" />
                                  </button>
                                </a>
                              </Link>
                              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                                <DialogTrigger asChild>
                                  <button
                                    type="button"
                                    title="Supprimer"
                                    className="rounded-full p-1.5 bg-white shadow hover:bg-red-100 transition-all border border-red-200 group-hover:scale-110"
                                    onClick={e => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setReservationToDelete(reservation.id);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600 group-hover:text-red-800 transition-colors" />
                                  </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-sm rounded-2xl bg-white p-8 shadow-2xl border border-gray-100">
                                  <DialogHeader>
                                    <DialogTitle className="text-lg font-semibold text-gray-800 text-center mb-2">Supprimer la réservation ?</DialogTitle>
                                    <DialogDescription className="text-center text-gray-500 mb-4">
                                      Cette action est irréversible.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter className="flex flex-row justify-center gap-4 mt-2">
                                    <DialogClose asChild>
                                      <button className="px-5 py-2 rounded border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-100 transition">Annuler</button>
                                    </DialogClose>
                                    <button
                                      className="px-5 py-2 rounded bg-red-500 text-white font-medium hover:bg-red-600 transition"
                                      onClick={() => reservationToDelete && handleDeleteReservation(reservationToDelete)}
                                    >
                                      Supprimer
                                    </button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Troisième niveau : numéro de téléphone discret */}
                      <div className="px-3 pb-2 pt-1 text-xs text-gray-400 font-mono">{reservation.telephone}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Affichage de {((currentPage - 1) * 10) + 1} à {Math.min(currentPage * 10, totalReservations)} sur {totalReservations} réservations</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={!hasPrevPage}
                    className="flex items-center gap-1"
                  >
                    ← Précédent
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-10 h-10"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!hasNextPage}
                    className="flex items-center gap-1"
                  >
                    Suivant →
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
