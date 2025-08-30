import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Users,
  CreditCard,
  FileText,
  Calendar,
  MapPin,
  ArrowUpRight,
  ChevronRight,
  Wallet,
  Bell,
  Settings,
  Search,
} from "lucide-react"
import Link from "next/link"

// Add types for our API data
type Program = {
  id: number
  name: string
  startDate: string
  endDate: string
  hotelsMadina: string[]
  hotelsMakkah: string[]
  visaDeadline: string
  hotelsDeadline: string
  ticketsDeadline: string
  totalAmount: number
  reservations: {
    couple: number
    three: number
    four: number
    five: number
  }
  totalReservations: number
}

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
}

type Expense = {
  id: number
  description: string
  amount: number
  date: string
  category: string
}

type TransformedProgram = {
  id: number
  nom: string
  dateCreation: string
  hotelsMadina: string[]
  hotelsMakkah: string[]
  datesLimites: {
    visa: string
    hotels: string
    billets: string
  }
  reservations: {
    couple: number
    three: number
    four: number
    five: number
  }
  totalReservations: number
  montantTotal: number
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
}

// Add async function to fetch data
async function getData() {
  const [programsRes, reservationsRes, expensesRes] = await Promise.all([
    fetch('http://localhost:5000/api/programs'),
    fetch('http://localhost:5000/api/reservations'),
    fetch('http://localhost:5000/api/expenses')
  ]);

  const programs = await programsRes.json();
  const reservations = await reservationsRes.json();
  const expenses = await expensesRes.json();

  // Calculate stats
  const totalExpenses = expenses.reduce((sum: number, exp: Expense) => sum + exp.amount, 0);
  const totalPayments = reservations.reduce((sum: number, res: Reservation) => sum + res.paidAmount, 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyExpenses = expenses
    .filter((exp: Expense) => {
      const expDate = new Date(exp.date);
      return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
    })
    .reduce((sum: number, exp: Expense) => sum + exp.amount, 0);

  const monthlyPayments = reservations
    .filter((res: Reservation) => {
      const resDate = new Date(res.dateReservation);
      return resDate.getMonth() === currentMonth && resDate.getFullYear() === currentYear;
    })
    .reduce((sum: number, res: Reservation) => sum + res.paidAmount, 0);

  const monthlyReservations = reservations
    .filter((res: Reservation) => {
      const resDate = new Date(res.dateReservation);
      return resDate.getMonth() === currentMonth && resDate.getFullYear() === currentYear;
    }).length;

  return {
    programs,
    reservations,
    expenses,
    stats: {
      soldeCaisse: totalPayments - totalExpenses,
      paiementsMois: monthlyPayments,
      depensesMois: monthlyExpenses,
      reservationsMois: monthlyReservations,
    }
  };
}

export default async function Dashboard() {
  const { programs, reservations, stats } = await getData();

  const getDateStatus = (dateLimit: string) => {
    const today = new Date()
    const limit = new Date(dateLimit)
    const diffTime = limit.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return { status: "expired", text: "Expiré", color: "bg-red-100 text-red-800" }
    if (diffDays <= 10)
      return { status: "urgent", text: `${diffDays}j restants`, color: "bg-orange-100 text-orange-800" }
    return { status: "ok", text: `${diffDays}j restants`, color: "bg-green-100 text-green-800" }
  }

  const getStatusIcon = (value: boolean) => {
    return value ? "✅" : "⚠️"
  }

  const getPaiementStatus = (recu: number, engage: number) => {
    return recu >= engage ? "✅" : "⚠️"
  }

  // Valeurs statiques fallback pour le dashboard
  const derniersProgrammes = Array.isArray(programs) && programs.length > 0 ? programs.map((program: Program) => ({
    id: program.id,
    nom: program.name,
    dateCreation: program.startDate,
    hotelsMadina: program.hotelsMadina,
    hotelsMakkah: program.hotelsMakkah,
    datesLimites: {
      visa: program.visaDeadline,
      hotels: program.hotelsDeadline,
      billets: program.ticketsDeadline,
    },
    reservations: program.reservations,
    totalReservations: program.totalReservations,
    montantTotal: program.totalAmount,
  })) : [
    {
      id: 1,
      nom: "Omra Ramadan 2025",
      dateCreation: "2025-03-01",
      hotelsMadina: ["Imane Palace", "Al Haram"],
      hotelsMakkah: ["Meezab Al Biban", "Hilton"],
      datesLimites: {
        visa: "2025-03-10",
        hotels: "2025-03-15",
        billets: "2025-03-20"
      },
      reservations: { couple: 5, three: 8, four: 3, five: 2 },
      totalReservations: 18,
      montantTotal: 120000
    }
  ];

  const dernieresReservations = Array.isArray(reservations) && reservations.length > 0 ? reservations.map((reservation: Reservation) => ({
    id: reservation.id,
    nom: reservation.lastName,
    prenom: reservation.firstName,
    telephone: reservation.phone,
    programme: Array.isArray(programs) ? (programs.find((p: Program) => p.id === reservation.programId)?.name || '') : '',
    chambre: reservation.roomType,
    hotelMadina: reservation.hotelMadina,
    hotelMakkah: reservation.hotelMakkah,
    prixEngage: reservation.price,
    paiementRecu: reservation.paidAmount,
    dateReservation: reservation.dateReservation,
    passeport: reservation.passport,
    visa: reservation.visa,
    reservationHotel: reservation.hotelBooked,
    billetAvion: reservation.flightBooked,
    statut: reservation.status.toLowerCase(),
    echeanceProche: false,
  })) : [
    {
      id: 1,
      nom: "SAMI",
      prenom: "HAMZA",
      telephone: "0652147898",
      programme: "Omra Ramadan 2025",
      chambre: "DOUBLE",
      hotelMadina: "Imane Palace",
      hotelMakkah: "Meezab Al Biban",
      prixEngage: 30000,
      paiementRecu: 15000,
      dateReservation: "2025-03-01",
      passeport: true,
      visa: false,
      reservationHotel: true,
      billetAvion: false,
      statut: "incomplet",
      echeanceProche: false
    }
  ];

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
                  <p className="text-xs text-gray-500">Gestion Caisse</p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-1">
              <Link href="/reservations">
                <Button
                  variant="ghost"
                  className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Réservations
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
        {/* Indicateurs globaux redesignés */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Solde Caisse */}
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <Wallet className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{stats.soldeCaisse.toLocaleString()}</div>
                  <div className="text-xs text-white/80">DH</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Solde Caisse</h3>
                <p className="text-xs text-white/80">Encaissements - Dépenses</p>
              </div>
            </CardContent>
          </Card>

          {/* Paiements */}
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <CreditCard className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{stats.paiementsMois.toLocaleString()}</div>
                  <div className="text-xs text-white/80">DH</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Paiements</h3>
                <p className="text-xs text-white/80">Mois courant</p>
              </div>
            </CardContent>
          </Card>

          {/* Dépenses */}
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <FileText className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{stats.depensesMois.toLocaleString()}</div>
                  <div className="text-xs text-white/80">DH</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Dépenses</h3>
                <p className="text-xs text-white/80">Mois courant</p>
              </div>
            </CardContent>
          </Card>

          {/* Réservations */}
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white transform hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <Users className="h-8 w-8 text-white/90" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{stats.reservationsMois}</div>
                  <div className="text-xs text-white/80">nouvelles</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Réservations</h3>
                <p className="text-xs text-white/80">Mois courant</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides - simplified design */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/reservations/nouvelle">
            <Button
              size="lg"
              className="w-full h-16 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm hover:shadow-md transition-all"
            >
              <Users className="mr-2 h-6 w-6 text-blue-600" />
              Nouvelle Réservation
            </Button>
          </Link>
          <Link href="/programmes/nouveau">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-16 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm hover:shadow-md transition-all"
            >
              <Calendar className="mr-2 h-6 w-6 text-green-600" />
              Nouveau Programme
            </Button>
          </Link>
          <Link href="/depenses/nouvelle">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-16 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm hover:shadow-md transition-all"
            >
              <FileText className="mr-2 h-6 w-6 text-red-600" />
              Nouvelle Dépense
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Derniers Programmes - redesigned as boxes with Réservations par chambre */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl">
              <div className="flex justify-between items-center">
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Derniers Programmes
                </CardTitle>
                <Link href="/programmes">
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    Voir tous
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <CardDescription className="text-blue-100">Programmes les plus récents</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {(Array.isArray(derniersProgrammes) ? derniersProgrammes.slice(0, 2) : []).map((programme: TransformedProgram, index: number) => (
                  <div
                    key={index}
                    className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold text-blue-800">{programme.nom}</h3>
                      <div className="text-right">
                        <div className="text-xl font-bold text-yellow-600">
                          {programme.montantTotal !== undefined && programme.montantTotal !== null
                            ? programme.montantTotal.toLocaleString() + ' DH'
                            : '-'}
                        </div>
                        <p className="text-sm text-blue-700">{programme.totalReservations} réservations</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs font-medium text-yellow-700 mb-1">Madina</p>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(programme.hotelsMadina) ? programme.hotelsMadina.slice(0, 2) : []).map((hotel: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-yellow-50">
                              {hotel}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-blue-700 mb-1">Makkah</p>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(programme.hotelsMakkah) ? programme.hotelsMakkah.slice(0, 2) : []).map((hotel: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-blue-50">
                              {hotel}
                            </Badge>
                          ))}
                          {Array.isArray(programme.hotelsMakkah) && programme.hotelsMakkah.length > 2 && (
                            <Badge variant="outline" className="text-xs bg-gray-50">
                              +{programme.hotelsMakkah.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Réservations par chambre */}
                    <div className="mb-3 bg-white/60 p-2 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-2">Réservations par chambre</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs">Couple</span>
                          <Badge variant="outline" className="bg-blue-50 border-blue-200 text-xs">
                            {programme.reservations?.couple ?? 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs">3 pers.</span>
                          <Badge variant="outline" className="bg-blue-50 border-blue-200 text-xs">
                            {programme.reservations?.three ?? 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs">4 pers.</span>
                          <Badge variant="outline" className="bg-blue-50 border-blue-200 text-xs">
                            {programme.reservations?.four ?? 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs">5 pers.</span>
                          <Badge variant="outline" className="bg-blue-50 border-blue-200 text-xs">
                            {programme.reservations?.five ?? 0}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center">
                        <span className="text-xs">Visa</span>
                        <div className="text-xs mt-1 text-gray-700">
                          {new Date(programme.datesLimites.visa).toLocaleDateString("fr-FR")}
                        </div>
                        <Badge className={`${getDateStatus(programme.datesLimites.visa).color} text-xs block mt-1`}>
                          {getDateStatus(programme.datesLimites.visa).text}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <span className="text-xs">Hôtels</span>
                        <div className="text-xs mt-1 text-gray-700">
                          {new Date(programme.datesLimites.hotels).toLocaleDateString("fr-FR")}
                        </div>
                        <Badge className={`${getDateStatus(programme.datesLimites.hotels).color} text-xs block mt-1`}>
                          {getDateStatus(programme.datesLimites.hotels).text}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <span className="text-xs">Billets</span>
                        <div className="text-xs mt-1 text-gray-700">
                          {new Date(programme.datesLimites.billets).toLocaleDateString("fr-FR")}
                        </div>
                        <Badge className={`${getDateStatus(programme.datesLimites.billets).color} text-xs block mt-1`}>
                          {getDateStatus(programme.datesLimites.billets).text}
                        </Badge>
                      </div>
                    </div>

                    <Link href={`/programmes/${programme.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        Voir détails
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Dernières Réservations - redesigned as boxes with spacing */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-xl">
              <div className="flex justify-between items-center">
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Dernières Réservations
                </CardTitle>
                <Link href="/reservations">
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    Voir toutes
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <CardDescription className="text-green-100">Réservations les plus récentes</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {(Array.isArray(dernieresReservations) ? dernieresReservations.slice(0, 3) : []).map((reservation: TransformedReservation, index: number) => (
                  <Link key={index} href={`/reservations/${reservation.id}`}>
                    <div
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer rounded-lg border ${
                        reservation.statut === "complete"
                          ? "border-l-4 border-green-500 bg-green-50"
                          : reservation.statut === "urgent"
                            ? "border-l-4 border-red-500 bg-red-50"
                            : "border-l-4 border-yellow-500 bg-yellow-50"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {reservation.nom} {reservation.prenom}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{reservation.telephone}</span>
                            <span>•</span>
                            <span>{new Date(reservation.dateReservation).toLocaleDateString("fr-FR")}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Badge
                            variant={reservation.paiementRecu >= reservation.prixEngage ? "default" : "destructive"}
                            className="rounded-full"
                          >
                            {reservation.paiementRecu.toLocaleString()} / {reservation.prixEngage.toLocaleString()} DH
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500">Programme & Chambre</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="bg-blue-50 text-xs">
                              {reservation.programme}
                            </Badge>
                            <Badge variant="outline" className="bg-yellow-50 text-xs">
                              {reservation.chambre}
                            </Badge>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-gray-500">Hôtels</p>
                          <div className="grid grid-cols-2 gap-1 mt-1">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-blue-600" />
                              <span className="text-xs truncate">{reservation.hotelMadina}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-blue-600" />
                              <span className="text-xs truncate">{reservation.hotelMakkah}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-dashed">
                        <div className="flex gap-3">
                          <div className="text-center">
                            <div className={`text-sm ${reservation.passeport ? "text-green-600" : "text-red-600"}`}>
                              {getStatusIcon(reservation.passeport)}
                            </div>
                            <p className="text-xs text-gray-500">Passeport</p>
                          </div>
                          <div className="text-center">
                            <div className={`text-sm ${reservation.visa ? "text-green-600" : "text-red-600"}`}>
                              {getStatusIcon(reservation.visa)}
                            </div>
                            <p className="text-xs text-gray-500">Visa</p>
                          </div>
                          <div className="text-center">
                            <div
                              className={`text-sm ${reservation.reservationHotel ? "text-green-600" : "text-red-600"}`}
                            >
                              {getStatusIcon(reservation.reservationHotel)}
                            </div>
                            <p className="text-xs text-gray-500">Hôtel</p>
                          </div>
                          <div className="text-center">
                            <div className={`text-sm ${reservation.billetAvion ? "text-green-600" : "text-red-600"}`}>
                              {getStatusIcon(reservation.billetAvion)}
                            </div>
                            <p className="text-xs text-gray-500">Vol</p>
                          </div>
                        </div>

                        <div>
                          {reservation.echeanceProche && (
                            <Badge variant="destructive" className="rounded-full animate-pulse">
                              Échéance proche
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
