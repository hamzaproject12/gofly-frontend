import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// GET /api/room-availability - Récupérer la disponibilité des chambres par programme
router.get('/', async (req, res) => {
  try {
    console.log('🏠 Fetching room availability data...')

    // Récupérer tous les programmes avec leurs chambres et réservations
    const programs = await prisma.program.findMany({
      include: {
        rooms: {
          include: {
            hotel: true,
            program: true
          }
        },
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

    // Transformer les données pour l'affichage
    const programsWithAvailability = programs.map(program => {
      // Calculer les statistiques du programme
      const totalRooms = program.rooms.length
      const totalPlaces = program.rooms.reduce((sum, room) => sum + room.nbrPlaceTotal, 0)
      const totalPlacesRestantes = program.rooms.reduce((sum, room) => sum + room.nbrPlaceRestantes, 0)
      const placesOccupees = totalPlaces - totalPlacesRestantes

      // Calculer le montant restant à payer pour le programme
      const totalPrice = program.reservations.reduce((sum, res) => sum + (res.price || 0), 0)
      const totalPaid = program.reservations.reduce((sum, res) => sum + (res.paidAmount || 0), 0)
      const remainingAmount = totalPrice - totalPaid

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
          // Générer les couleurs pour l'affichage visuel
          visualPlaces: Array.from({ length: room.nbrPlaceTotal }, (_, index) => ({
            isOccupied: index < (room.nbrPlaceTotal - room.nbrPlaceRestantes),
            color: index < (room.nbrPlaceTotal - room.nbrPlaceRestantes) ? 'red' : 'green'
          }))
        }))
      }))

      return {
        id: program.id,
        name: program.name,
        created_at: program.created_at,
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
