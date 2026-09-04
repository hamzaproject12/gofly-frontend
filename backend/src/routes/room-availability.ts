import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// GET /api/room-availability - Récupérer la disponibilité des chambres par programme
router.get('/', async (req, res) => {
  try {
    console.log('🏠 Fetching room availability data...')

    // Récupérer les programmes ACTIFS (non supprimés) avec leurs chambres et réservations.
    // Les programmes clôturés/archivés ne doivent pas gonfler les places occupées du présent.
    const programs = await prisma.program.findMany({
      where: {
        isDeleted: false,
        status: 'ACTIF'
      },
      include: {
        rooms: {
          include: {
            hotel: true,
            program: true
          }
        },
        hotelsAutre: true,
        reservations: {
          where: {
            status: {
              not: 'Annulé'
            }
          },
          include: {
            program: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    // Occupants des chambres : `Room.listeIdsReservation` liste, dans l'ordre
    // d'arrivée, les réservations rattachées à la chambre (1 réservation = 1 place,
    // cf. getPlacesByRoomType). On résout ces IDs en une seule requête pour pouvoir
    // afficher le nom du pèlerin sur chaque place occupée du dashboard.
    const allReservationIds = Array.from(
      new Set(programs.flatMap(p => p.rooms.flatMap(r => r.listeIdsReservation || [])))
    )
    const occupantsById = new Map<number, { id: number; nom: string; status: string }>()
    if (allReservationIds.length > 0) {
      const occupants = await prisma.reservation.findMany({
        where: { id: { in: allReservationIds } },
        select: { id: true, firstName: true, lastName: true, status: true }
      })
      for (const o of occupants) {
        occupantsById.set(o.id, {
          id: o.id,
          nom: `${o.firstName} ${o.lastName}`.trim(),
          status: o.status
        })
      }
    }

    // Transformer les données pour l'affichage
    const programsWithAvailability = programs.map(program => {
      // Calculer les statistiques du programme
      const totalRooms = program.rooms.length
      // Somme brute des places sur toutes les chambres. Un même pèlerin occupe un lit
      // dans PLUSIEURS hôtels (1 à Madina + 1 à Makkah + 1 dans chaque hôtel "Autre"),
      // donc cette somme compte chaque personne plusieurs fois. Pour obtenir un nombre
      // de PERSONNES, on divise par le nombre d'étapes qu'un pèlerin occupe simultanément :
      //  - Madina compte pour 1 étape même si le programme propose plusieurs hôtels Madina
      //    (hôtels d'une même ville = ALTERNATIVES, les pèlerins s'y répartissent).
      //  - Makkah : idem, 1 étape.
      //  - Chaque hôtel "Autre" est une étape distincte (séjours SÉQUENTIELS : le pèlerin
      //    loge dans tous les hôtels Autre — cf. boucle de booking + champ `ordre`).
      const rawTotalPlaces = program.rooms.reduce((sum, room) => sum + room.nbrPlaceTotal, 0)
      const rawPlacesRestantes = program.rooms.reduce((sum, room) => sum + room.nbrPlaceRestantes, 0)
      const hasMadina = program.rooms.some(room => room.hotel.city === 'Madina')
      const hasMakkah = program.rooms.some(room => room.hotel.city === 'Makkah')
      const nbHotelsAutre = new Set(
        program.rooms.filter(room => room.hotel.city === 'Autre').map(room => room.hotelId)
      ).size
      const nbEtapes = (hasMadina ? 1 : 0) + (hasMakkah ? 1 : 0) + nbHotelsAutre
      const diviseur = nbEtapes > 0 ? nbEtapes : 1
      const totalPlaces = Math.round(rawTotalPlaces / diviseur)
      const totalPlacesRestantes = Math.round(rawPlacesRestantes / diviseur)
      const placesOccupees = totalPlaces - totalPlacesRestantes

      // Calculer le montant restant à payer pour le programme
      const totalPrice = program.reservations.reduce((sum, res) => sum + (res.price || 0), 0)
      const totalPaid = program.reservations.reduce((sum, res) => sum + (res.paidAmount || 0), 0)
      const remainingAmount = totalPrice - totalPaid

      // Durée du séjour = jours Madina + jours Makkah + jours des hôtels "Autre"
      const dureeAutre = program.hotelsAutre.reduce((sum, h) => sum + (h.nbJours || 0), 0)
      const dureeJours = program.nbJoursMadina + program.nbJoursMakkah + dureeAutre

      // Grouper les chambres par hôtel
      const roomsByHotel = program.rooms.reduce((acc, room) => {
        const hotelKey = `${room.hotel.name} (${room.hotel.city})`
        if (!acc[hotelKey]) {
          acc[hotelKey] = []
        }
        acc[hotelKey].push(room)
        return acc
      }, {} as Record<string, any[]>)

      // Transformer les chambres pour l'affichage visuel
      const hotelsWithRooms = Object.entries(roomsByHotel).map(([hotelName, rooms]) => ({
        hotelName,
        rooms: rooms.map(room => ({
          id: room.id,
          roomType: room.roomType,
          gender: room.gender,
          totalPlaces: room.nbrPlaceTotal,
          placesRestantes: room.nbrPlaceRestantes,
          placesOccupees: room.nbrPlaceTotal - room.nbrPlaceRestantes,
          prixRoom: room.prixRoom,
          // Générer les couleurs pour l'affichage visuel. Chaque place occupée
          // porte son occupant (nom du pèlerin) quand la réservation est
          // retrouvable — `occupant` reste null si les données ont dérivé.
          visualPlaces: Array.from({ length: room.nbrPlaceTotal }, (_, index) => {
            const isOccupied = index < (room.nbrPlaceTotal - room.nbrPlaceRestantes)
            const reservationId = (room.listeIdsReservation || [])[index]
            const occupant = isOccupied && reservationId != null
              ? occupantsById.get(reservationId) || null
              : null
            return {
              isOccupied,
              color: isOccupied ? 'red' : 'green',
              occupant
            }
          })
        }))
      }))

      return {
        id: program.id,
        name: program.name,
        created_at: program.created_at,
        // Dates de voyage : alimentent l'affichage et les alertes d'imminence du dashboard.
        dateDepart: program.dateDepart,
        dateArrivee: program.dateArrivee,
        dureeJours,
        isDeleted: (program as any).isDeleted || false,
        deletedAt: (program as any).deletedAt || null,
        statistics: {
          totalRooms,
          totalPlaces,
          placesOccupees,
          placesRestantes: totalPlacesRestantes,
          occupancyRate: totalPlaces > 0 ? ((placesOccupees / totalPlaces) * 100).toFixed(1) : '0',
          remainingAmount: remainingAmount
        },
        hotels: hotelsWithRooms
      }
    })

    console.log(`✅ Found ${programsWithAvailability.length} programs with room availability`)

    res.json({
      success: true,
      data: programsWithAvailability,
      summary: {
        totalPrograms: programsWithAvailability.length,
        totalRooms: programsWithAvailability.reduce((sum, p) => sum + p.statistics.totalRooms, 0),
        totalPlaces: programsWithAvailability.reduce((sum, p) => sum + p.statistics.totalPlaces, 0),
        totalOccupied: programsWithAvailability.reduce((sum, p) => sum + p.statistics.placesOccupees, 0),
        totalAvailable: programsWithAvailability.reduce((sum, p) => sum + p.statistics.placesRestantes, 0)
      }
    })

  } catch (error) {
    console.error('❌ Error fetching room availability:', error)
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la disponibilité des chambres',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router
