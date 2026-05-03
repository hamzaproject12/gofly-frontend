"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  Users,
  User,
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
  Download,
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/useAuth"
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
  groupSize: number
  typeReservation?: "LIT" | "CHAMBRE_PRIVEE"
  /** Agent assigné au dossier (affiché sous Hôtel Makkah) */
  agentNom: string | null
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
  const { isAdmin } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [reservations, setReservations] = useState<TransformedReservation[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  const [exporting, setExporting] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReservations, setTotalReservations] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
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
      'SINGLE': '1 personne',
      'DOUBLE': '2 personnes', 
      'TRIPLE': '3 personnes',
      'QUAD': '4 personnes',
      'QUINT': '5 personnes'
    };
    return mapping[roomType] || roomType;
  };

  const handleFilterChange = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent form submission
  };

  const handleProgrammeChange = (value: string) => {
    setProgrammeFilter(value.trim());
  };

  const handleStatutChange = (value: string) => {
    setStatutFilter(value);
  };

  const handleChambreChange = (value: string) => {
    setChambreFilter(value);
  };

  const getFilenameFromDisposition = (contentDisposition: string | null): string | null => {
    if (!contentDisposition) return null;

    // Support RFC5987 (filename*=UTF-8'')
    const utf8Name = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    if (utf8Name) return decodeURIComponent(utf8Name.replace(/["']/g, ""));

    // Fallback: filename="..."
    const basicName = contentDisposition.match(/filename="?([^"]+)"?/i)?.[1];
    if (basicName) return basicName.trim();

    return null;
  };

  const isIOSDevice = (): boolean => {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/i.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  };

  const handleExportAgency = useCallback(async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        program: programmeFilter,
        status: statutFilter,
        roomType: chambreFilter,
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
        ...(filters.search && { search: filters.search }),
      });
      const res = await api.request(
        `${api.endpoints.exportReservationsAgency}?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Export échoué");
      }

      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        throw new Error("Le fichier exporté est vide");
      }

      const fallbackFilename = `export-agence-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const filename =
        getFilenameFromDisposition(res.headers.get("content-disposition")) || fallbackFilename;

      const nav = window.navigator as Navigator & {
        msSaveOrOpenBlob?: (blobToSave: Blob, defaultName?: string) => boolean;
        canShare?: (data?: ShareData) => boolean;
      };

      // Legacy Edge/IE compatibility.
      if (typeof nav.msSaveOrOpenBlob === "function") {
        nav.msSaveOrOpenBlob(blob, filename);
        toast({
          title: "Export Excel",
          description: "Le fichier a été téléchargé (une feuille par programme).",
        });
        return;
      }

      // Mobile-friendly fallback: native share sheet when files sharing is available.
      if (typeof File !== "undefined" && nav.share && nav.canShare) {
        try {
          const file = new File([blob], filename, {
            type:
              blob.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          if (nav.canShare({ files: [file] })) {
            await nav.share({
              files: [file],
              title: "Export Excel",
              text: "Export des réservations",
            });
            toast({
              title: "Export Excel",
              description: "Fichier prêt à être enregistré/partagé.",
            });
            return;
          }
        } catch {
          // Continue with anchor/blob fallback if share is cancelled or unavailable.
        }
      }

      const url = URL.createObjectURL(blob);

      if (isIOSDevice()) {
        // iOS Safari / embedded browsers often ignore `download`.
        const opened = window.open(url, "_blank", "noopener,noreferrer");
        if (!opened) {
          window.location.href = url;
        }
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      // Avoid revoking too early on slow/mobile browsers.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast({
        title: "Export Excel",
        description: "Le fichier a été téléchargé (une feuille par programme).",
      });
    } catch (e) {
      toast({
        title: "Export impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }, [
    programmeFilter,
    statutFilter,
    chambreFilter,
    filters.dateFrom,
    filters.dateTo,
    filters.search,
    toast,
  ]);

  // Déclarer fetchData en premier pour éviter les problèmes d'ordre
  const fetchData = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      
      // Construire l'URL avec tous les filtres et la pagination
      const params = new URLSearchParams({
        page: page.toString(),
        limit: rowsPerPage.toString(),
        program: programmeFilter,
        status: statutFilter,
        roomType: chambreFilter,
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo })
      });
      const statsParams = new URLSearchParams({
        program: programmeFilter,
        status: statutFilter,
        roomType: chambreFilter,
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo })
      });
      
      const [reservationsRes, programsRes, statsRes] = await Promise.all([
        fetch(api.url(`/api/reservations?${params}`)),
        fetch(api.url(api.endpoints.programs)),
        fetch(api.url(`/api/reservations/stats?${statsParams}`))
      ]);

      if (!reservationsRes.ok || !programsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const reservationsResponse = await reservationsRes.json();
      const programsData: Program[] = await programsRes.json();
      const statsData = await statsRes.json();

      // Extraire les données de pagination
      const { reservations: reservationsData, pagination } = reservationsResponse;
      
      setPrograms(programsData.map((program) => ({ ...program, name: program.name.trim() })));
      setStats(statsData);
      
      // Mettre à jour l'état de pagination
      setCurrentPage(pagination.currentPage);
      setTotalPages(pagination.totalPages);
      setTotalReservations(pagination.totalReservations);
      setHasNextPage(pagination.hasNextPage);
      setHasPrevPage(pagination.hasPrevPage);

      // Transform reservations data
      const transformedReservations = reservationsData.map((reservation: any) => {
        const members = [reservation, ...(reservation.accompagnants || [])];
        const groupSize = members.length;
        const passportGroupOk = members.every((m: any) => Boolean(m.statutPasseport));
        const visaGroupOk = members.every((m: any) => Boolean(m.statutVisa));
        const hotelGroupOk = members.every((m: any) => Boolean(m.statutHotel));
        const flightGroupOk = members.every((m: any) => Boolean(m.statutVol));

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
            passeport: passportGroupOk,
            visa: visaGroupOk,
            reservationHotel: hotelGroupOk,
            billetAvion: flightGroupOk,
            statut: "Complet",
            echeanceProche: false,
            visaDeadline: reservation.program?.visaDeadline,
            hotelDeadline: reservation.program?.hotelDeadline,
            flightDeadline: reservation.program?.flightDeadline,
            passportDeadline: reservation.program?.passportDeadline,
            urgentReason: undefined,
            urgentDate: undefined,
            groupSize,
            typeReservation: reservation.typeReservation,
            agentNom: reservation.agent?.nom ?? null,
          };
        }
        // Nouvelle logique d'urgence : on teste dans l'ordre Passeport, Visa, Hôtel, Vol
        const now = new Date();
        let isUrgent = false;
        let urgentReason = undefined;
        let urgentDate = undefined;
        // Passeport
        if (!passportGroupOk && reservation.program?.passportDeadline) {
          const date = new Date(reservation.program.passportDeadline);
          const diff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (diff >= 0 && diff <= DAYS_URGENCY_WINDOW) {
            isUrgent = true;
            urgentReason = "Passeport";
            urgentDate = date;
          }
        }
        // Visa
        if (!isUrgent && !visaGroupOk && reservation.program?.visaDeadline) {
          const date = new Date(reservation.program.visaDeadline);
          const diff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (diff >= 0 && diff <= DAYS_URGENCY_WINDOW) {
            isUrgent = true;
            urgentReason = "Visa";
            urgentDate = date;
          }
        }
        // Hôtel
        if (!isUrgent && !hotelGroupOk && reservation.program?.hotelDeadline) {
          const date = new Date(reservation.program.hotelDeadline);
          const diff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (diff >= 0 && diff <= DAYS_URGENCY_WINDOW) {
            isUrgent = true;
            urgentReason = "Hôtel";
            urgentDate = date;
          }
        }
        // Vol
        if (!isUrgent && !flightGroupOk && reservation.program?.flightDeadline) {
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
          passeport: passportGroupOk,
          visa: visaGroupOk,
          reservationHotel: hotelGroupOk,
          billetAvion: flightGroupOk,
          statut: isUrgent ? "Urgent" : reservation.status,
          echeanceProche: isUrgent,
          visaDeadline: reservation.program?.visaDeadline,
          hotelDeadline: reservation.program?.hotelDeadline,
          flightDeadline: reservation.program?.flightDeadline,
          passportDeadline: reservation.program?.passportDeadline,
          urgentReason,
          urgentDate,
          groupSize,
          typeReservation: reservation.typeReservation,
          agentNom: reservation.agent?.nom ?? null,
        };
      });

      setReservations(transformedReservations);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [programmeFilter, statutFilter, chambreFilter, filters.dateFrom, filters.dateTo, rowsPerPage]);

  // Fonction de suppression de réservation (après fetchData)
  const handleDeleteReservation = useCallback(async (id: number) => {
    try {
      setLoading(true);
      setDeleteDialogOpen(false);

      const response = await fetch(api.url(`/api/reservations/${id}`), {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erreur lors de la suppression de la réservation");
      }

      toast({
        title: "Réservation supprimée",
        description: "La réservation a été supprimée avec succès.",
      });

      await fetchData(currentPage);
    } catch (error) {
      console.error("Erreur suppression réservation:", error);
      toast({
        title: "Erreur",
        description:
          error instanceof Error ? error.message : "Impossible de supprimer la réservation",
        variant: "destructive",
      });
    } finally {
      setReservationToDelete(null);
      setLoading(false);
    }
  }, [currentPage, fetchData, toast]);

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
    // Ne pas appeler fetchData immédiatement, attendre que l'utilisateur arrête de taper
  };

  const handleDateFilter = (from: string, to: string) => {
    setFilters(prev => ({ ...prev, dateFrom: from, dateTo: to }));
    setCurrentPage(1);
    fetchData(1);
  };

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
        reservation.nom.toLowerCase().includes(filters.search.toLowerCase()) ||
        reservation.prenom.toLowerCase().includes(filters.search.toLowerCase()) ||
        reservation.telephone.includes(filters.search) ||
        reservation.programme.toLowerCase().includes(filters.search.toLowerCase());

      // Filtre par statut (utilise le statut final affiché)
      const statusMatch = statutFilter === "all" || reservation.statut === statutFilter;

      return searchMatch && statusMatch;
    });
  }, [reservations, filters.search, statutFilter]);

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
    <div
      data-skip-unsaved-dirty
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100"
    >

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Réservations</h1>
            <p className="text-gray-500 mt-1">Gérez et suivez toutes vos réservations Omra</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/reservations/nouvelle">
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle Réservation
              </Button>
            </Link>
            <Link href="/reservations/nouvelle-chambre">
              <Button
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all"
              >
                <HotelIcon className="mr-2 h-4 w-4" />
                Chambre Privée
              </Button>
            </Link>
          </div>
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
                  <div className="text-2xl font-bold">{stats.total}</div>
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
                  <div className="text-2xl font-bold">{stats.complete}</div>
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
                  <div className="text-2xl font-bold">{stats.incomplete}</div>
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
                  <div className="text-2xl font-bold">{stats.urgent}</div>
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
        <Card className="mb-8 border-none shadow-lg overflow-hidden bg-white/95 backdrop-blur">
          <CardContent className="p-4 md:p-5">
            <form onSubmit={handleFilterChange} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-10 gap-3 lg:gap-4 items-end">
              <div className="relative xl:col-span-3 min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-gray-600">Recherche</span>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Rechercher par nom, téléphone, programme..."
                  value={filters.search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 h-11 rounded-lg border border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-blue-500/40"
                />
              </div>

              <div className="xl:col-span-2 min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-gray-600">Programme</span>
                <Select value={programmeFilter} onValueChange={handleProgrammeChange}>
                <SelectTrigger className="h-11 rounded-lg border border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-blue-500/40 pl-3">
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
              </div>

              <div className="xl:col-span-2 min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-gray-600">Statut</span>
                <Select value={statutFilter} onValueChange={handleStatutChange}>
                <SelectTrigger className="h-11 rounded-lg border border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-blue-500/40">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="Complet">Complète</SelectItem>
                  <SelectItem value="Incomplet">Incomplète</SelectItem>
                  <SelectItem value="Urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
              </div>

              <div className="xl:col-span-2 min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-gray-600">Chambre</span>
                <Select value={chambreFilter} onValueChange={handleChambreChange}>
                  <SelectTrigger className="h-11 rounded-lg border border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-blue-500/40">
                    <SelectValue placeholder="Toutes les chambres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="toutes">Toutes les chambres</SelectItem>
                    <SelectItem value="FAMILLE">Chambre (privée)</SelectItem>
                    <SelectItem value="SINGLE">1 personne</SelectItem>
                    <SelectItem value="DOUBLE">2 personnes</SelectItem>
                    <SelectItem value="TRIPLE">3 personnes</SelectItem>
                    <SelectItem value="QUAD">4 personnes</SelectItem>
                    <SelectItem value="QUINT">5 personnes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="xl:col-span-1 min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-gray-600">Lignes</span>
                <Select
                  value={rowsPerPage.toString()}
                  onValueChange={(value) => {
                    setRowsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-11 rounded-lg border border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-blue-500/40 min-w-[110px]">
                    <SelectValue placeholder="10/page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10/page</SelectItem>
                    <SelectItem value="30">30/page</SelectItem>
                    <SelectItem value="50">50/page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Liste des Réservations */}
        <Card className="border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-blue-800 flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-blue-600" />
                Liste des Réservations
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 shrink-0 whitespace-nowrap"
                disabled={exporting}
                onClick={handleExportAgency}
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting ? "Export…" : "Exporter Excel (agence)"}
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
                      {/* Premier niveau : NOM, PROGRAMME, TYPE DE CHAMBRE, NUMERO, STATUT */}
                      <div className="flex flex-col md:flex-row md:items-center gap-2 p-3 border-b border-blue-100">
                        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-3 min-w-[180px]">
                          <span className="font-bold text-xl text-blue-900 tracking-tight uppercase">{reservation.nom} {reservation.prenom}</span>
                          {reservation.typeReservation === "CHAMBRE_PRIVEE" ? (
                            <span
                              className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-emerald-400/70 bg-gradient-to-r from-emerald-50 to-emerald-100/90 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-900 shadow-sm ring-1 ring-emerald-200/60"
                              title="Dossier chambre privée"
                            >
                              <HotelIcon className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                              Chambre
                            </span>
                          ) : reservation.groupSize > 1 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-1">
                              Groupe: {reservation.groupSize} pers.
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1 text-base font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-1">
                            <Calendar className="h-5 w-5 text-blue-400" /> {reservation.programme}
                          </span>
                          <span className="inline-flex items-center gap-1 text-base font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-1">
                            <Users className="h-5 w-5 text-yellow-400" /> {mapRoomTypeToPersons(reservation.chambre)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-base font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded px-3 py-1">
                            <FileText className="h-5 w-5 text-purple-400" /> {reservation.telephone}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          {/* Afficher le reste à payer seulement si le statut n'est pas "Complet" */}
                          {reservation.statut !== "Complet" && (() => {
                            const resteAPayer = reservation.prixEngage - reservation.paiementRecu;
                            if (resteAPayer > 0) {
                              return (
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 border border-orange-200 rounded px-3 py-1 text-lg font-bold">
                                  <Wallet className="h-4 w-4" />
                                  -{resteAPayer.toLocaleString()} DH
                                </span>
                              );
                            }
                            return null;
                          })()}
                          
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
                              <div className="text-xs text-slate-600 font-semibold mt-2 mb-0.5">Agent</div>
                              <div className="flex items-center gap-1.5 text-sm text-gray-800">
                                <User className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden />
                                <span className="font-medium">{reservation.agentNom ?? "—"}</span>
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
                              {/* <Link href={`/reservations/${reservation.id}`} legacyBehavior>
                                <a title="Afficher détails" className="group">
                                  <button type="button" className="rounded-full p-1.5 bg-white shadow hover:bg-blue-100 transition-all border border-blue-200 group-hover:scale-110">
                                    <Search className="h-4 w-4 text-blue-600 group-hover:text-blue-800 transition-colors" />
                                  </button>
                                </a>
                              </Link> */}
                              <Link
                                href={
                                  reservation.typeReservation === "CHAMBRE_PRIVEE"
                                    ? `/reservations/modifier-chambre/${reservation.id}`
                                    : `/reservations/modifier-simple/${reservation.id}`
                                }
                                legacyBehavior
                              >
                                <a title="Modifier" className="group">
                                  <button type="button" className="rounded-full p-1.5 bg-white shadow hover:bg-yellow-100 transition-all border border-yellow-200 group-hover:scale-110">
                                    <Settings className="h-4 w-4 text-yellow-600 group-hover:text-yellow-800 transition-colors" />
                                  </button>
                                </a>
                              </Link>
                              {isAdmin && (
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
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Affichage de {((currentPage - 1) * rowsPerPage) + 1} à {Math.min(currentPage * rowsPerPage, totalReservations)} sur {totalReservations} réservations</span>
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
