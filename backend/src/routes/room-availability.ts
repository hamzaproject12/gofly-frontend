import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth'

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


/**
 * Plan de chambres (rooming list) d'un programme.
 *
 * `Room.listeIdsReservation` liste les réservations rattachées à la chambre dans
 * l'ordre d'arrivée (1 réservation = 1 place, cf. getPlacesByRoomType). L'index
 * dans ce tableau EST le numéro de place : on reconstitue donc le placement réel
 * de chaque pèlerin, hôtel par hôtel, ce qui permet aux agents de répartir
 * physiquement les personnes dans les chambres.
 */

const CITY_ORDER: Record<string, number> = { Madina: 1, Makkah: 2, Autre: 3 }

const ROOM_TYPE_ORDER: Record<string, number> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  QUAD: 4,
  QUINT: 5,
}

const ROOM_TYPE_LABEL: Record<string, string> = {
  SINGLE: 'Simple',
  DOUBLE: 'Double',
  TRIPLE: 'Triple',
  QUAD: 'Quadruple',
  QUINT: 'Quintuple',
}

type RoomingOccupant = {
  place: number
  reservationId: number
  nom: string
  prenom: string
  nomFamille: string
  gender: string
  phone: string
  passportNumber: string
  groupe: string
  status: string
  typeReservation: string
  groupKey: string
  isLeader: boolean
}

router.get('/:programId/rooming', authenticateToken, async (req, res) => {
  try {
    const programId = parseInt(req.params.programId, 10)
    if (Number.isNaN(programId)) {
      return res.status(400).json({ success: false, error: 'Identifiant de programme invalide' })
    }

    const program = await prisma.program.findUnique({
      where: { id: programId },
      include: {
        rooms: { include: { hotel: true } },
        hotelsAutre: true,
      },
    })

    if (!program) {
      return res.status(404).json({ success: false, error: 'Programme introuvable' })
    }

    // Occupants : une seule requête pour toutes les chambres du programme.
    const reservationIds = Array.from(
      new Set(program.rooms.flatMap((room) => room.listeIdsReservation || []))
    )
    const occupantRows = reservationIds.length > 0
      ? await prisma.reservation.findMany({
          where: { id: { in: reservationIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
            phone: true,
            passportNumber: true,
            groupe: true,
            status: true,
            typeReservation: true,
            groupId: true,
            isLeader: true,
          },
        })
      : []
    const occupantsById = new Map(occupantRows.map((o) => [o.id, o]))

    // Ordre d'affichage des hôtels « Autre » : celui du programme (séjours séquentiels).
    const ordreAutre = new Map(program.hotelsAutre.map((h) => [h.hotelId, h.ordre]))

    type RoomRow = (typeof program.rooms)[number]
    const roomsByHotel = new Map<number, RoomRow[]>()
    for (const room of program.rooms) {
      if (!roomsByHotel.has(room.hotelId)) roomsByHotel.set(room.hotelId, [])
      roomsByHotel.get(room.hotelId)!.push(room)
    }

    const hotels = [...roomsByHotel.entries()]
      .map(([hotelId, rooms]) => {
        const hotel = rooms[0].hotel
        // Numérotation des chambres stable : par type puis par id, comme à l'affichage.
        const sorted = [...rooms].sort((a, b) => {
          const byType = (ROOM_TYPE_ORDER[a.roomType] || 99) - (ROOM_TYPE_ORDER[b.roomType] || 99)
          return byType !== 0 ? byType : a.id - b.id
        })

        const roomsPayload = sorted.map((room, roomIndex) => {
          const ids = room.listeIdsReservation || []
          const occupants: RoomingOccupant[] = []

          for (let place = 0; place < room.nbrPlaceTotal; place += 1) {
            const reservationId = ids[place]
            const occupant = reservationId != null ? occupantsById.get(reservationId) : undefined
            if (!occupant) continue
            occupants.push({
              place: place + 1,
              reservationId: occupant.id,
              nom: `${occupant.firstName || ''} ${occupant.lastName || ''}`.trim(),
              prenom: occupant.firstName || '',
              nomFamille: occupant.lastName || '',
              gender: occupant.gender,
              phone: occupant.phone || '',
              passportNumber: occupant.passportNumber || '',
              groupe: occupant.groupe || '',
              status: occupant.status,
              typeReservation: occupant.typeReservation as string,
              // Clé de famille : une réservation solo n'a pas de groupId, on lui en
              // fabrique une pour que le front colore sans cas particulier.
              groupKey: occupant.groupId || `solo-${occupant.id}`,
              isLeader: occupant.isLeader,
            })
          }

          const occupees = occupants.length
          const placesPrises = new Set(occupants.map((o) => o.place))
          const placesLibres: number[] = []
          for (let place = 1; place <= room.nbrPlaceTotal; place += 1) {
            if (!placesPrises.has(place)) placesLibres.push(place)
          }

          // Chambre privatisée : toutes les places occupées le sont par une même
          // famille ayant réservé en « chambre privée » (aucun tiers ne s'y ajoute).
          const groupKeys = new Set(occupants.map((o) => o.groupKey))
          const estChambrePrivee =
            occupees > 0
            && groupKeys.size === 1
            && occupants.every((o) => o.typeReservation === 'CHAMBRE_PRIVEE')

          return {
            id: room.id,
            numero: roomIndex + 1,
            roomType: room.roomType as string,
            roomTypeLabel: ROOM_TYPE_LABEL[room.roomType] || (room.roomType as string),
            gender: room.gender,
            prixRoom: room.prixRoom,
            totalPlaces: room.nbrPlaceTotal,
            placesOccupees: occupees,
            placesRestantes: room.nbrPlaceTotal - occupees,
            estChambrePrivee,
            estComplete: occupees >= room.nbrPlaceTotal,
            estVide: occupees === 0,
            occupants,
            placesLibres,
          }
        })

        return {
          hotelId,
          hotelName: hotel.name,
          city: hotel.city as string,
          ordre: ordreAutre.get(hotelId) ?? 0,
          totalPlaces: roomsPayload.reduce((s, r) => s + r.totalPlaces, 0),
          placesOccupees: roomsPayload.reduce((s, r) => s + r.placesOccupees, 0),
          placesRestantes: roomsPayload.reduce((s, r) => s + r.placesRestantes, 0),
          rooms: roomsPayload,
        }
      })
      .sort((a, b) => {
        const byCity = (CITY_ORDER[a.city] || 99) - (CITY_ORDER[b.city] || 99)
        if (byCity !== 0) return byCity
        const byOrdre = a.ordre - b.ordre
        return byOrdre !== 0 ? byOrdre : a.hotelName.localeCompare(b.hotelName, 'fr')
      })

    const villesMap = new Map<string, typeof hotels>()
    for (const hotel of hotels) {
      if (!villesMap.has(hotel.city)) villesMap.set(hotel.city, [])
      villesMap.get(hotel.city)!.push(hotel)
    }
    const villes = [...villesMap.entries()].map(([key, hotelsDeLaVille]) => ({
      key,
      label: key === 'Autre' ? 'Autres étapes' : key,
      totalPlaces: hotelsDeLaVille.reduce((s, h) => s + h.totalPlaces, 0),
      placesOccupees: hotelsDeLaVille.reduce((s, h) => s + h.placesOccupees, 0),
      placesRestantes: hotelsDeLaVille.reduce((s, h) => s + h.placesRestantes, 0),
      hotels: hotelsDeLaVille,
    }))

    const allRooms = hotels.flatMap((h) => h.rooms)
    const dureeAutre = program.hotelsAutre.reduce((sum, h) => sum + (h.nbJours || 0), 0)

    res.json({
      success: true,
      program: {
        id: program.id,
        name: program.name,
        status: program.status,
        dateDepart: program.dateDepart,
        dateArrivee: program.dateArrivee,
        dureeJours: program.nbJoursMadina + program.nbJoursMakkah + dureeAutre,
        isDeleted: program.isDeleted,
      },
      summary: {
        totalHotels: hotels.length,
        totalRooms: allRooms.length,
        totalPlaces: allRooms.reduce((s, r) => s + r.totalPlaces, 0),
        placesOccupees: allRooms.reduce((s, r) => s + r.placesOccupees, 0),
        placesRestantes: allRooms.reduce((s, r) => s + r.placesRestantes, 0),
        chambresCompletes: allRooms.filter((r) => r.estComplete).length,
        chambresPartielles: allRooms.filter((r) => !r.estComplete && !r.estVide).length,
        chambresVides: allRooms.filter((r) => r.estVide).length,
        // Nombre de pèlerins distincts : un même pèlerin occupe une place dans
        // chaque hôtel du parcours, il ne doit être compté qu'une seule fois.
        pelerins: new Set(allRooms.flatMap((r) => r.occupants.map((o) => o.reservationId))).size,
      },
      villes,
    })
  } catch (error) {
    console.error('❌ Error building rooming plan:', error)
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la construction du plan de chambres',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router
