'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { siteConfig } from '@/lib/config';
import { 
  Hotel, 
  Users, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  MapPin,
  Bed,
  UserCheck,
  UserX,
  LayoutDashboard,
  List,
  Wallet,
  Percent,
  Calendar as CalendarIcon,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface Agent {
  id: number;
  nom: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
  isActive: boolean;
  createdAt: string;
}

interface Room {
  id: number;
  roomType: string;
  gender: string;
  totalPlaces: number;
  placesRestantes: number;
  placesOccupees: number;
  prixRoom: number;
  visualPlaces: Array<{
    isOccupied: boolean;
    color: 'green' | 'red';
  }>;
}

interface HotelData {
  hotelName: string;
  rooms: Room[];
}

interface Program {
  id: number;
  name: string;
  created_at: string;
  statistics: {
    totalRooms: number;
    totalPlaces: number;
    placesOccupees: number;
    placesRestantes: number;
    occupancyRate: string;
    remainingAmount?: number;
  };
  hotels: HotelData[];
  isDeleted: boolean;
  deletedAt?: string;
}

interface RoomAvailabilityData {
  success: boolean;
  data: Program[];
  summary: {
    totalPrograms: number;
    totalRooms: number;
    totalPlaces: number;
    totalOccupied: number;
    totalAvailable: number;
  };
}

// Configuration visuelle d'une ville (Madina / Makkah / Autre)
interface CityConfig {
  key: string;
  label: string;
  icon: string;
  order: number;
  headerGradient: string;
  sectionBg: string;
  sectionBorder: string;
  accentText: string;
}

// Liserés de couleur attribués aux cartes de programme pour les distinguer en un coup d'œil
const PROGRAM_ACCENTS = [
  'border-l-indigo-500',
  'border-l-emerald-500',
  'border-l-sky-500',
  'border-l-violet-500',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-teal-500',
];

// En-tête coloré d'un bloc ville : icône, nom, nombre d'hôtels et places libres
function CityHeader({
  config,
  hotelCount,
  stats,
}: {
  config: CityConfig;
  hotelCount: number;
  stats: { totalPlaces: number; placesRestantes: number };
}) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r ${config.headerGradient}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-2xl shadow-inner ring-1 ring-white/30">
          {config.icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold leading-none tracking-tight text-white">{config.label}</h3>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
              {hotelCount} hôtel{hotelCount > 1 ? 's' : ''}
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-white/85">
            {stats.placesRestantes} place{stats.placesRestantes > 1 ? 's' : ''} libre
            {stats.placesRestantes > 1 ? 's' : ''} sur {stats.totalPlaces}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 ring-1 ring-white/25">
        <Bed className="h-4 w-4 text-white" />
        <span className="text-sm font-bold tabular-nums text-white">
          {stats.placesRestantes}/{stats.totalPlaces}
        </span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [roomData, setRoomData] = useState<RoomAvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'dashboard' | 'hotel-detail'>('dashboard');
  const [collapsedPrograms, setCollapsedPrograms] = useState<Set<number>>(new Set());

  const toggleProgram = (programId: number) => {
    setCollapsedPrograms((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(programId)) {
        newSet.delete(programId);
      } else {
        newSet.add(programId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer les données du profil et la disponibilité des chambres en parallèle
      const [profileResponse, roomResponse] = await Promise.all([
        api.request('/api/auth/profile'),
        fetch(api.url(api.endpoints.roomAvailability))
      ]);

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setAgent(profileData.agent);
        
        // Filtrer et trier les programmes après avoir reçu l'agent
        if (roomResponse.ok) {
          const roomData = await roomResponse.json();
          const isAdmin = profileData.agent?.role === 'ADMIN';
          
          // Filtrer les programmes supprimés si pas admin
          let filteredPrograms = isAdmin 
            ? roomData.data 
            : roomData.data.filter((p: Program) => !p.isDeleted);
          
          // Trier : actifs en premier, supprimés en bas
          filteredPrograms = filteredPrograms.sort((a: Program, b: Program) => {
            if (a.isDeleted && !b.isDeleted) return 1;
            if (!a.isDeleted && b.isDeleted) return -1;
            return 0;
          });
          
          const filteredData = {
            ...roomData,
            data: filteredPrograms
          };
          setRoomData(filteredData);
        }
      }

      if (!profileResponse.ok) {
        // Si l'agent n'est pas connecté, récupérer quand même les données
        if (roomResponse.ok) {
          const roomData = await roomResponse.json();
          setRoomData(roomData);
        }
      } else if (!roomResponse.ok) {
        throw new Error('Erreur lors du chargement de la disponibilité des chambres');
      }
    } catch (error) {
      console.error('Erreur de récupération des données:', error);
      setError(error instanceof Error ? error.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const getRoomTypeIcon = (roomType: string) => {
    switch (roomType) {
      case 'SINGLE': return '🏠';
      case 'DOUBLE': return '🏘️';
      case 'TRIPLE': return '🏢';
      case 'QUAD': return '🏬';
      case 'QUINT': return '🏭';
      default: return '🏨';
    }
  };

  const getRoomTypeStyle = (roomType: string) => {
    switch (roomType) {
      case 'SINGLE':
        return {
          borderColor: 'border-blue-500',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-700',
          badgeColor: 'bg-blue-100 text-blue-800'
        };
      case 'DOUBLE':
        return {
          borderColor: 'border-green-500',
          bgColor: 'bg-green-50',
          textColor: 'text-green-700',
          badgeColor: 'bg-green-100 text-green-800'
        };
      case 'TRIPLE':
        return {
          borderColor: 'border-purple-500',
          bgColor: 'bg-purple-50',
          textColor: 'text-purple-700',
          badgeColor: 'bg-purple-100 text-purple-800'
        };
      case 'QUAD':
        return {
          borderColor: 'border-orange-500',
          bgColor: 'bg-orange-50',
          textColor: 'text-orange-700',
          badgeColor: 'bg-orange-100 text-orange-800'
        };
      case 'QUINT':
        return {
          borderColor: 'border-red-500',
          bgColor: 'bg-red-50',
          textColor: 'text-red-700',
          badgeColor: 'bg-red-100 text-red-800'
        };
      default:
        return {
          borderColor: 'border-gray-500',
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-700',
          badgeColor: 'bg-gray-100 text-gray-800'
        };
    }
  };

  const getRoomTypeOrder = (roomType: string) => {
    switch (roomType) {
      case 'SINGLE': return 1;
      case 'DOUBLE': return 2;
      case 'TRIPLE': return 3;
      case 'QUAD': return 4;
      case 'QUINT': return 5;
      default: return 99;
    }
  };

  const getGenderIcon = (gender: string) => {
    return gender === 'Homme' ? '👨' : gender === 'Femme' ? '👩' : '👥';
  };

  // Dégradé de la barre d'occupation selon le taux (palette des pages)
  const getOccupancyGradient = (rate: number) => {
    if (rate >= 80) {
      // Presque complet → vert émeraude (objectif atteint)
      return {
        gradient: 'linear-gradient(90deg, #10b981 0%, #22c55e 100%)',
        glow: 'rgba(16, 185, 129, 0.45)'
      };
    }
    if (rate >= 40) {
      // En progression → bleu / indigo (couleurs du header)
      return {
        gradient: 'linear-gradient(90deg, #6366f1 0%, #3b82f6 50%, #0ea5e9 100%)',
        glow: 'rgba(99, 102, 241, 0.4)'
      };
    }
    // Faible occupation → ambre (à remplir)
    return {
      gradient: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
      glow: 'rgba(245, 158, 11, 0.4)'
    };
  };

  const getRoomTypeLabel = (roomType: string) => {
    switch (roomType) {
      case 'SINGLE': return '1 Personne';
      case 'DOUBLE': return '2 Personnes';
      case 'TRIPLE': return '3 Personnes';
      case 'QUAD': return '4 Personnes';
      case 'QUINT': return '5 Personnes';
      default: return roomType;
    }
  };

  // --- Regroupement des hôtels par ville (Madina / Makkah / Autre) ---
  // Le backend renvoie hotelName au format "Nom de l'hôtel (Ville)"
  const parseHotelCity = (hotelName: string): string => {
    const match = hotelName.match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim() : 'Autre';
  };

  // Nom de l'hôtel sans le suffixe "(Ville)" devenu redondant dans un bloc ville
  const getHotelDisplayName = (hotelName: string): string => {
    return hotelName.replace(/\s*\([^)]*\)\s*$/, '').trim() || hotelName;
  };

  const getCityConfig = (city: string): CityConfig => {
    const c = city.toLowerCase();
    if (c.includes('madina') || c.includes('médine') || c.includes('medine')) {
      return {
        key: 'Madina',
        label: 'Madina',
        icon: '🕌',
        order: 1,
        headerGradient: 'from-emerald-500 to-green-600',
        sectionBg: 'bg-emerald-50/60',
        sectionBorder: 'border-emerald-200',
        accentText: 'text-emerald-600',
      };
    }
    if (c.includes('makkah') || c.includes('makka') || c.includes('mecque') || c.includes('mecca')) {
      return {
        key: 'Makkah',
        label: 'Makkah',
        icon: '🕋',
        order: 2,
        headerGradient: 'from-blue-600 to-indigo-600',
        sectionBg: 'bg-blue-50/60',
        sectionBorder: 'border-blue-200',
        accentText: 'text-blue-600',
      };
    }
    return {
      key: city || 'Autre',
      label: city || 'Autre',
      icon: '🏨',
      order: 3,
      headerGradient: 'from-slate-500 to-gray-600',
      sectionBg: 'bg-slate-50/70',
      sectionBorder: 'border-slate-200',
      accentText: 'text-slate-600',
    };
  };

  // Regroupe les hôtels d'un programme par ville, triés Madina → Makkah → Autre
  const groupHotelsByCity = (hotels: HotelData[]) => {
    const groups: Record<string, { config: CityConfig; hotels: HotelData[] }> = {};
    hotels.forEach((hotel) => {
      const config = getCityConfig(parseHotelCity(hotel.hotelName));
      if (!groups[config.key]) groups[config.key] = { config, hotels: [] };
      groups[config.key].hotels.push(hotel);
    });
    return Object.values(groups).sort((a, b) => a.config.order - b.config.order);
  };

  // Total des places (totales / restantes) pour un groupe d'hôtels d'une ville
  const getCityStats = (hotels: HotelData[]) =>
    hotels.reduce(
      (acc, h) => {
        h.rooms.forEach((r) => {
          acc.totalPlaces += r.totalPlaces;
          acc.placesRestantes += r.placesRestantes;
        });
        return acc;
      },
      { totalPlaces: 0, placesRestantes: 0 }
    );

  // Liseré de couleur d'une carte programme (rotation sur la palette)
  const getProgramAccentBorder = (index: number) =>
    PROGRAM_ACCENTS[index % PROGRAM_ACCENTS.length];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de la disponibilité des chambres...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Erreur</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header avec informations de l'agent */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                🏨 {siteConfig.name} Dashboard
              </h1>
              <p className="text-lg text-gray-600">
                Gestion des programmes Omra - Disponibilité des chambres
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Toggle des vues avec design amélioré */}
              <div className="flex bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-1 shadow-lg border border-blue-200">
                <Button
                  variant={viewMode === 'dashboard' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('dashboard')}
                  className={`flex items-center gap-2 px-4 py-2 transition-all duration-200 ${
                    viewMode === 'dashboard' 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-700 hover:to-indigo-700' 
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="font-medium">Vue Dashboard</span>
                </Button>
                <Button
                  variant={viewMode === 'hotel-detail' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('hotel-detail')}
                  className={`flex items-center gap-2 px-4 py-2 transition-all duration-200 ${
                    viewMode === 'hotel-detail' 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-700 hover:to-indigo-700' 
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <List className="h-4 w-4" />
                  <span className="font-medium">Vue Types Chambres</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques globales */}
        {roomData?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Programmes Actifs</p>
                    <p className="text-2xl font-bold text-indigo-600">{roomData.summary.totalPrograms}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
                    <Calendar className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Chambres</p>
                    <p className="text-2xl font-bold text-blue-600">{roomData.summary.totalRooms}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                    <Hotel className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Places Occupées</p>
                    <p className="text-2xl font-bold text-green-600">{roomData.summary.totalOccupied}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
                    <UserCheck className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Places Disponibles</p>
                    <p className="text-2xl font-bold text-red-600">{roomData.summary.totalAvailable}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
                    <UserX className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contenu conditionnel selon la vue */}
        {viewMode === 'dashboard' ? (
          /* Vue Dashboard - Liste des programmes */
          <div className="space-y-6">
            {roomData?.data.map((program, programIndex) => (
              <Card
                key={program.id}
                className={`overflow-hidden border border-slate-200 border-l-4 shadow-md transition-shadow hover:shadow-lg ${
                  program.isDeleted
                    ? 'border-l-yellow-400 bg-yellow-50'
                    : `${getProgramAccentBorder(programIndex)} bg-white`
                }`}
              >
                <CardHeader className={`${program.isDeleted ? 'bg-gradient-to-r from-yellow-100 to-yellow-200' : 'bg-gradient-to-r from-indigo-50 to-blue-50'} py-3`}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    {/* Nom du programme et date */}
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎯</span>
                      <div>
                        {program.isDeleted && (
                          <Badge className="bg-yellow-500 text-white text-xs mb-1">Supprimé</Badge>
                        )}
                        <h2 className={`text-lg font-bold ${program.isDeleted ? 'text-yellow-900' : 'text-gray-900'}`}>
                          {program.name}
                        </h2>
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {new Date(program.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>

                    {/* Statistiques compactes en ligne */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Montant restant à payer */}
                      {program.statistics.remainingAmount !== undefined && (
                        <div className="flex items-center gap-2 bg-yellow-100 border border-yellow-300 rounded-lg px-3 py-1.5">
                          <Wallet className="h-4 w-4 text-yellow-700" />
                          <div>
                            <p className="text-xs text-yellow-800 font-medium">Restant</p>
                            <p className="text-sm font-bold text-yellow-900">
                              {program.statistics.remainingAmount.toLocaleString('fr-FR', { 
                                minimumFractionDigits: 0, 
                                maximumFractionDigits: 0 
                              })} DH
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Places disponibles */}
                      <div className="flex items-center gap-2 bg-blue-100 border border-blue-300 rounded-lg px-3 py-1.5">
                        <Users className="h-4 w-4 text-blue-700" />
                        <div>
                          <p className="text-xs text-blue-800 font-medium">Places</p>
                          <p className="text-sm font-bold text-blue-900">
                            {program.statistics.placesRestantes} / {program.statistics.totalPlaces}
                          </p>
                        </div>
                      </div>

                      {/* Taux d'occupation */}
                      <div className="flex items-center gap-2 bg-green-100 border border-green-300 rounded-lg px-3 py-1.5">
                        <Percent className="h-4 w-4 text-green-700" />
                        <div>
                          <p className="text-xs text-green-800 font-medium">Occupation</p>
                          <p className="text-sm font-bold text-green-900">
                            {program.statistics.occupancyRate}%
                          </p>
                        </div>
                      </div>

                      {/* Bouton de réduction/développement */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleProgram(program.id)}
                        className="h-8 w-8 p-0 hover:bg-gray-200"
                        aria-label={collapsedPrograms.has(program.id) ? "Développer le programme" : "Réduire le programme"}
                      >
                        {collapsedPrograms.has(program.id) ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronUp className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Barre de progression de l'occupation - juste sous les nom et stats */}
                  {(() => {
                    const rate = parseInt(program.statistics.occupancyRate);
                    const { gradient, glow } = getOccupancyGradient(rate);
                    return (
                      <div className="w-full mt-3 mb-0 overflow-hidden rounded-full h-3 bg-slate-200/70 shadow-inner ring-1 ring-black/5"
                           style={{
                             backgroundImage: 'linear-gradient(90deg, rgba(100, 116, 139, 0.12) 1px, transparent 1px)',
                             backgroundSize: '12px 100%'
                           }}>
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                          style={{
                            width: `${rate}%`,
                            backgroundImage: gradient,
                            boxShadow: `0 1px 6px ${glow}`
                          }}
                        >
                          {/* Reflet brillant en surface */}
                          <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
                        </div>
                      </div>
                    );
                  })()}
                </CardHeader>

                {!collapsedPrograms.has(program.id) && (
                <CardContent className="p-6">
                  <div className="space-y-5">
                    {groupHotelsByCity(program.hotels).map((group) => {
                      const cityStats = getCityStats(group.hotels);
                      return (
                        <div
                          key={group.config.key}
                          className={`overflow-hidden rounded-2xl border ${group.config.sectionBorder} ${group.config.sectionBg} shadow-sm`}
                        >
                          <CityHeader
                            config={group.config}
                            hotelCount={group.hotels.length}
                            stats={cityStats}
                          />
                          <div className="space-y-4 p-3 sm:p-4">
                            {group.hotels.map((hotel, hotelIndex) => (
                              <div key={hotelIndex} className="rounded-xl border bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                  <MapPin className={`h-5 w-5 ${group.config.accentText}`} />
                                  <h3 className="font-semibold text-gray-900">{getHotelDisplayName(hotel.hotelName)}</h3>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                          {hotel.rooms
                            .sort((a, b) => getRoomTypeOrder(a.roomType) - getRoomTypeOrder(b.roomType))
                            .map((room) => {
                            const roomStyle = getRoomTypeStyle(room.roomType);
                            return (
                              <div 
                                key={room.id} 
                                className={`${roomStyle.bgColor} rounded-lg p-4 border-2 ${roomStyle.borderColor} shadow-sm hover:shadow-md transition-shadow`}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{getRoomTypeIcon(room.roomType)}</span>
                                    <span className={`font-medium ${roomStyle.textColor}`}>
                                      {getRoomTypeLabel(room.roomType)} {getGenderIcon(room.gender)}
                                    </span>
                                  </div>
                                  <Badge className={`text-xs ${roomStyle.badgeColor}`}>
                                    {room.placesOccupees}/{room.totalPlaces}
                                  </Badge>
                                </div>
                                
                                {/* Affichage visuel des places */}
                                <div className="flex items-center gap-1 mb-3">
                                  {room.visualPlaces.map((place, index) => (
                                    <div
                                      key={index}
                                  className={`w-6 h-6 rounded-full border-2 ${
                                    place.isOccupied 
                                      ? 'bg-red-500 border-red-600' 
                                      : 'bg-green-500 border-green-600'
                                  }`}
                                  title={place.isOccupied ? 'Réservé' : 'Disponible'}
                                    />
                                  ))}
                                </div>
                                
                                <div className="flex items-center justify-between text-sm">
                                  <span className={roomStyle.textColor}>
                                    {room.placesOccupees} occupé{room.placesOccupees > 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
                )}
              </Card>
            ))}
          </div>
        ) : (
          /* Vue Détail Hôtels - Programmes → Hôtels → Types de chambres horizontaux */
          <div className="space-y-6">
            {roomData?.data.map((program, programIndex) => (
              <Card
                key={program.id}
                className={`overflow-hidden border border-slate-200 border-l-4 shadow-md transition-shadow hover:shadow-lg ${
                  program.isDeleted
                    ? 'border-l-yellow-400 bg-yellow-50'
                    : `${getProgramAccentBorder(programIndex)} bg-white`
                }`}
              >
                <CardHeader className={`${program.isDeleted ? 'bg-gradient-to-r from-yellow-100 to-yellow-200' : 'bg-gradient-to-r from-indigo-50 to-blue-50'} py-3`}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    {/* Nom du programme et date */}
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎯</span>
                      <div>
                        {program.isDeleted && (
                          <Badge className="bg-yellow-500 text-white text-xs mb-1">Supprimé</Badge>
                        )}
                        <h2 className={`text-lg font-bold ${program.isDeleted ? 'text-yellow-900' : 'text-gray-900'}`}>
                          {program.name}
                        </h2>
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {new Date(program.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>

                    {/* Statistiques compactes en ligne */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Montant restant à payer */}
                      {program.statistics.remainingAmount !== undefined && (
                        <div className="flex items-center gap-2 bg-yellow-100 border border-yellow-300 rounded-lg px-3 py-1.5">
                          <Wallet className="h-4 w-4 text-yellow-700" />
                          <div>
                            <p className="text-xs text-yellow-800 font-medium">Restant</p>
                            <p className="text-sm font-bold text-yellow-900">
                              {program.statistics.remainingAmount.toLocaleString('fr-FR', { 
                                minimumFractionDigits: 0, 
                                maximumFractionDigits: 0 
                              })} DH
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Places disponibles */}
                      <div className="flex items-center gap-2 bg-blue-100 border border-blue-300 rounded-lg px-3 py-1.5">
                        <Users className="h-4 w-4 text-blue-700" />
                        <div>
                          <p className="text-xs text-blue-800 font-medium">Places</p>
                          <p className="text-sm font-bold text-blue-900">
                            {program.statistics.placesRestantes} / {program.statistics.totalPlaces}
                          </p>
                        </div>
                      </div>

                      {/* Taux d'occupation */}
                      <div className="flex items-center gap-2 bg-green-100 border border-green-300 rounded-lg px-3 py-1.5">
                        <Percent className="h-4 w-4 text-green-700" />
                        <div>
                          <p className="text-xs text-green-800 font-medium">Occupation</p>
                          <p className="text-sm font-bold text-green-900">
                            {program.statistics.occupancyRate}%
                          </p>
                        </div>
                      </div>

                      {/* Bouton de réduction/développement */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleProgram(program.id)}
                        className="h-8 w-8 p-0 hover:bg-gray-200"
                        aria-label={collapsedPrograms.has(program.id) ? "Développer le programme" : "Réduire le programme"}
                      >
                        {collapsedPrograms.has(program.id) ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronUp className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Barre de progression de l'occupation - juste sous les nom et stats */}
                  {(() => {
                    const rate = parseInt(program.statistics.occupancyRate);
                    const { gradient, glow } = getOccupancyGradient(rate);
                    return (
                      <div className="w-full mt-3 mb-0 overflow-hidden rounded-full h-3 bg-slate-200/70 shadow-inner ring-1 ring-black/5"
                           style={{
                             backgroundImage: 'linear-gradient(90deg, rgba(100, 116, 139, 0.12) 1px, transparent 1px)',
                             backgroundSize: '12px 100%'
                           }}>
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                          style={{
                            width: `${rate}%`,
                            backgroundImage: gradient,
                            boxShadow: `0 1px 6px ${glow}`
                          }}
                        >
                          {/* Reflet brillant en surface */}
                          <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
                        </div>
                      </div>
                    );
                  })()}
                </CardHeader>

                {!collapsedPrograms.has(program.id) && (
                <CardContent className="p-6">
                  <div className="space-y-5">
                    {groupHotelsByCity(program.hotels).map((group) => {
                      const cityStats = getCityStats(group.hotels);
                      return (
                        <div
                          key={group.config.key}
                          className={`overflow-hidden rounded-2xl border ${group.config.sectionBorder} ${group.config.sectionBg} shadow-sm`}
                        >
                          <CityHeader
                            config={group.config}
                            hotelCount={group.hotels.length}
                            stats={cityStats}
                          />
                          <div className="space-y-6 p-3 sm:p-4">
                            {group.hotels.map((hotel, hotelIndex) => {
                      // Grouper les chambres par type seulement (fusionner tous les genres)
                      const roomsByType = hotel.rooms.reduce((acc, room) => {
                        const typeKey = room.roomType;
                        if (!acc[typeKey]) {
                          acc[typeKey] = {
                            roomType: room.roomType,
                            rooms: [],
                            totalPlaces: 0,
                            placesOccupees: 0,
                            placesRestantes: 0,
                            totalReservations: 0
                          };
                        }
                        acc[typeKey].rooms.push(room);
                        acc[typeKey].totalPlaces += room.totalPlaces;
                        acc[typeKey].placesOccupees += room.placesOccupees;
                        acc[typeKey].placesRestantes += room.placesRestantes;
                        acc[typeKey].totalReservations += room.placesOccupees; // Chaque place occupée = 1 réservation
                        return acc;
                      }, {} as any);

                      return (
                        <div key={hotelIndex} className="rounded-xl border bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            <MapPin className={`h-5 w-5 ${group.config.accentText}`} />
                            <h3 className="font-semibold text-gray-900 text-lg">{getHotelDisplayName(hotel.hotelName)}</h3>
                          </div>
                          
                          {/* Types de chambres en horizontal - Triés et sans séparation de genre */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                            {Object.values(roomsByType)
                              .sort((a: any, b: any) => getRoomTypeOrder(a.roomType) - getRoomTypeOrder(b.roomType))
                              .map((roomType: any, typeIndex: number) => {
                              const roomStyle = getRoomTypeStyle(roomType.roomType);
                              return (
                                <div key={typeIndex} className={`${roomStyle.bgColor} rounded-lg p-4 border-2 ${roomStyle.borderColor} shadow-sm hover:shadow-md transition-shadow`}>
                                  {/* Header du type de chambre */}
                                  <div className="text-center mb-3">
                                    <span className="text-2xl">{getRoomTypeIcon(roomType.roomType)}</span>
                                    <h4 className={`font-semibold ${roomStyle.textColor} mt-1`}>
                                      {getRoomTypeLabel(roomType.roomType)}
                                    </h4>
                                  </div>
                                  
                                  {/* Statistiques */}
                                  <div className="space-y-2 mb-3">
                                    <div className="flex justify-between text-sm">
                                      <span className={roomStyle.textColor}>Chambres:</span>
                                      <span className={`font-medium ${roomStyle.textColor}`}>
                                        {roomType.rooms.length}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className={roomStyle.textColor}>Réservations:</span>
                                      <span className={`font-medium ${roomStyle.textColor}`}>
                                        {roomType.totalReservations}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className={roomStyle.textColor}>Places libres:</span>
                                      <span className={`font-medium ${roomStyle.textColor}`}>
                                        {roomType.placesRestantes}
                                      </span>
                  </div>
                </div>
                                  
                                  {/* Indicateur visuel global */}
                                  <div className="mb-3">
                                    <div className="flex justify-center gap-1 flex-wrap">
                                      {Array.from({ length: Math.min(roomType.totalPlaces, 10) }, (_, index) => {
                                        const isOccupied = index < roomType.placesOccupees;
                                        return (
                                          <div
                                            key={index}
                                            className={`w-4 h-4 rounded-full border ${
                                              isOccupied 
                                                ? 'bg-red-500 border-red-600' 
                                                : 'bg-green-500 border-green-600'
                                            }`}
                                            title={isOccupied ? 'Réservé' : 'Disponible'}
                                          />
                                        );
                                      })}
                                      {roomType.totalPlaces > 10 && (
                                        <span className={`text-xs ${roomStyle.textColor} ml-1`}>
                                          +{roomType.totalPlaces - 10}
                                        </span>
              )}
            </div>
                                    <p className={`text-xs text-center mt-1 ${roomStyle.textColor}`}>
                                      {roomType.placesOccupees}/{roomType.totalPlaces} places
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Résumé de l'hôtel */}
                          <div className="mt-4 p-3 bg-white rounded-lg border">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div className="text-center">
                                <p className="font-semibold text-gray-900">
                                  {hotel.rooms.length}
                                </p>
                                <p className="text-gray-600">Chambres totales</p>
                              </div>
                              <div className="text-center">
                                <p className="font-semibold text-green-600">
                                  {hotel.rooms.reduce((sum, room) => sum + room.placesOccupees, 0)}
                                </p>
                                <p className="text-gray-600">Réservations</p>
                              </div>
                              <div className="text-center">
                                <p className="font-semibold text-red-600">
                                  {hotel.rooms.reduce((sum, room) => sum + room.placesRestantes, 0)}
                                </p>
                                <p className="text-gray-600">Places libres</p>
                              </div>
                              <div className="text-center">
                                <p className="font-semibold text-blue-600">
                                  {Math.round((hotel.rooms.reduce((sum, room) => sum + room.placesOccupees, 0) / hotel.rooms.reduce((sum, room) => sum + room.totalPlaces, 0)) * 100)}%
                                </p>
                                <p className="text-gray-600">Taux occupation</p>
                                </div>
                              </div>
                            </div>
                          </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {roomData?.data.length === 0 && (
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🏨</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun programme trouvé</h3>
              <p className="text-gray-600">Aucun programme avec des chambres n'est disponible pour le moment.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}