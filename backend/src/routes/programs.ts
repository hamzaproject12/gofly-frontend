import express from 'express';
import { PrismaClient } from '@prisma/client';
import { ProgramOverviewController } from '../controllers/programOverviewController';

const router = express.Router();
const prisma = new PrismaClient();

// Get all programs with their hotels (excluding soft deleted)
router.get('/', async (req, res) => {
  try {
    const programs = await prisma.program.findMany({
      where: {
        isDeleted: false
      },
      include: {
        hotelsMadina: { include: { hotel: true } },
        hotelsMakkah: { include: { hotel: true } },
        rooms: { include: { hotel: true } }
      }
    });
    res.json(programs);
  } catch (error) {
    console.error('Error fetching programs:', error);
    res.status(500).json({ error: 'Error fetching programs' });
  }
});

// Get a single program with its hotels (excluding soft deleted)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const program = await prisma.program.findFirst({
      where: { 
        id: Number(id),
        isDeleted: false
      },
      include: {
        hotelsMadina: { include: { hotel: true } },
        hotelsMakkah: { include: { hotel: true } },
        rooms: { include: { hotel: true } }
      }
    });

    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }

    res.json(program);
  } catch (error) {
    console.error('Error fetching program:', error);
    res.status(500).json({ error: 'Error fetching program' });
  }
});

// Create a new program
router.post('/', async (req, res) => {
  try {
    const {
      name,
      nbJoursMadina,
      nbJoursMakkah,
      exchange,
      prixAvionDH,
      prixVisaRiyal,
      profit,
      visaDeadline,
      hotelDeadline,
      flightDeadline,
      passportDeadline,
      hotelsMadina,
      hotelsMakkah
    } = req.body;

    // Create the program with new financial/logistical fields
    const program = await prisma.program.create({
      data: {
        name,
        nbJoursMadina: Number(nbJoursMadina) || 0,
        nbJoursMakkah: Number(nbJoursMakkah) || 0,
        exchange: exchange !== undefined ? parseFloat(exchange) : 1.0,
        prixAvionDH: prixAvionDH !== undefined ? parseFloat(prixAvionDH) : 0,
        prixVisaRiyal: prixVisaRiyal !== undefined ? parseFloat(prixVisaRiyal) : 0,
        profit: profit !== undefined ? parseFloat(profit) : 0,
        visaDeadline: visaDeadline ? new Date(visaDeadline) : null,
        hotelDeadline: hotelDeadline ? new Date(hotelDeadline) : null,
        flightDeadline: flightDeadline ? new Date(flightDeadline) : null,
        passportDeadline: passportDeadline ? new Date(passportDeadline) : null,
      }
    });

    const mapTypeToRoomType = (type: number) => {
      switch (type) {
        case 1: return 'SINGLE' as const;
        case 2: return 'DOUBLE' as const;
        case 3: return 'TRIPLE' as const;
        case 4: return 'QUAD' as const;
        case 5: return 'QUINT' as const;
        default: return undefined;
      }
    };

    // Helper to find or create a hotel by city and name
    async function findOrCreateHotel(city: 'Madina' | 'Makkah', name: string) {
      try {
        // Essayer de trouver l'hôtel existant
        const existing = await prisma.hotel.findFirst({ 
          where: { 
            city: city,
            name: name
          } 
        });
        
        if (existing) {
          console.log(`Hôtel existant trouvé: ${name} (${city}) - ID: ${existing.id}`);
          return existing;
        }
        
        // Créer un nouvel hôtel
        const newHotel = await prisma.hotel.create({ 
          data: { 
            name: name, 
            city: city 
          } 
        });
        console.log(`Nouvel hôtel créé: ${name} (${city}) - ID: ${newHotel.id}`);
        return newHotel;
      } catch (error) {
        console.error(`Erreur lors de la création/recherche de l'hôtel ${name} (${city}):`, error);
        // En cas d'erreur de contrainte d'unicité, essayer de récupérer l'hôtel existant
        const existing = await prisma.hotel.findFirst({ 
          where: { 
            city: city,
            name: name
          } 
        });
        if (existing) {
          return existing;
        }
        throw error;
      }
    }

    // Link hotels for Madina and create rooms if provided
    if (Array.isArray(hotelsMadina)) {
      for (const entry of hotelsMadina) {
        const hotelName = typeof entry === 'string' ? entry : entry.name;
        if (!hotelName) continue;
        const hotel = await findOrCreateHotel('Madina', hotelName);
        // Create join row (ignore if already exists)
        try {
          await prisma.programHotelMadina.create({ data: { programId: program.id, hotelId: hotel.id } });
        } catch {}

        // Create rooms from configuration
        if (entry && typeof entry === 'object' && entry.chambres) {
          for (const key of Object.keys(entry.chambres)) {
            const type = Number(key);
            const roomType = mapTypeToRoomType(type);
            if (!roomType) continue; // ignore unsupported types
            const config = entry.chambres[type];
            const nb = config?.nb ? Number(config.nb) : 0;
            const prix = config?.prix ? parseFloat(config.prix) : 0;
            if (nb > 0 && prix > 0) {
              // Supprimer les anciennes rooms de ce type pour ce programme et hôtel
              await prisma.room.deleteMany({
                where: {
                  programId: program.id,
                  hotelId: hotel.id,
                  roomType,
                  gender: 'Mixte',
                }
              });
              
              // Créer le nombre exact de rooms demandé
              for (let i = 0; i < nb; i++) {
                await prisma.room.create({
                  data: {
                    programId: program.id,
                    hotelId: hotel.id,
                    roomType,
                    gender: 'Mixte',
                    nbrPlaceTotal: type, // Capacité selon le type (1=SINGLE, 2=DOUBLE, 3=TRIPLE, etc.)
                    nbrPlaceRestantes: type, // Capacité selon le type
                    prixRoom: prix,
                    listeIdsReservation: [],
                  }
                });
              }
            }
          }
        }
      }
    }

    // Link hotels for Makkah and create rooms if provided
    if (Array.isArray(hotelsMakkah)) {
      for (const entry of hotelsMakkah) {
        const hotelName = typeof entry === 'string' ? entry : entry.name;
        if (!hotelName) continue;
        const hotel = await findOrCreateHotel('Makkah', hotelName);
        // Create join row (ignore if already exists)
        try {
          await prisma.programHotelMakkah.create({ data: { programId: program.id, hotelId: hotel.id } });
        } catch {}

        // Create rooms from configuration
        if (entry && typeof entry === 'object' && entry.chambres) {
          for (const key of Object.keys(entry.chambres)) {
            const type = Number(key);
            const roomType = mapTypeToRoomType(type);
            if (!roomType) continue; // ignore unsupported types
            const config = entry.chambres[type];
            const nb = config?.nb ? Number(config.nb) : 0;
            const prix = config?.prix ? parseFloat(config.prix) : 0;
            if (nb > 0 && prix > 0) {
              // Supprimer les anciennes rooms de ce type pour ce programme et hôtel
              await prisma.room.deleteMany({
                where: {
                  programId: program.id,
                  hotelId: hotel.id,
                  roomType,
                  gender: 'Mixte',
                }
              });
              
              // Créer le nombre exact de rooms demandé
              for (let i = 0; i < nb; i++) {
                await prisma.room.create({
                  data: {
                    programId: program.id,
                    hotelId: hotel.id,
                    roomType,
                    gender: 'Mixte',
                    nbrPlaceTotal: type, // Capacité selon le type (1=SINGLE, 2=DOUBLE, 3=TRIPLE, etc.)
                    nbrPlaceRestantes: type, // Capacité selon le type
                    prixRoom: prix,
                    listeIdsReservation: [],
                  }
                });
              }
            }
          }
        }
      }
    }

    // Return the created program with relations
    const createdProgram = await prisma.program.findUnique({
      where: { id: program.id },
      include: {
        hotelsMadina: { include: { hotel: true } },
        hotelsMakkah: { include: { hotel: true } },
        rooms: { include: { hotel: true } },
      }
    });

    res.status(201).json(createdProgram);
  } catch (error) {
    console.error('Error creating program:', error);
    res.status(500).json({ error: 'Error creating program' });
  }
});

// Update program
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      nbJoursMadina,
      nbJoursMakkah,
      exchange,
      prixAvionDH,
      prixVisaRiyal,
      profit,
      visaDeadline,
      hotelDeadline,
      flightDeadline,
      passportDeadline,
      hotelsMadina,
      hotelsMakkah,
    } = req.body;

    const program = await prisma.program.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        nbJoursMadina: nbJoursMadina !== undefined ? Number(nbJoursMadina) : undefined,
        nbJoursMakkah: nbJoursMakkah !== undefined ? Number(nbJoursMakkah) : undefined,
        exchange: exchange !== undefined ? parseFloat(exchange) : undefined,
        prixAvionDH: prixAvionDH !== undefined ? parseFloat(prixAvionDH) : undefined,
        prixVisaRiyal: prixVisaRiyal !== undefined ? parseFloat(prixVisaRiyal) : undefined,
        profit: profit !== undefined ? parseFloat(profit) : undefined,
        visaDeadline: visaDeadline ? new Date(visaDeadline) : undefined,
        hotelDeadline: hotelDeadline ? new Date(hotelDeadline) : undefined,
        flightDeadline: flightDeadline ? new Date(flightDeadline) : undefined,
        passportDeadline: passportDeadline ? new Date(passportDeadline) : undefined,
      },
    });

    // ---------- Mise à jour non destructive des ROOMS (création/suppression de chambres libres, MAJ prix) ----------
    const mapTypeToRoomType = (type: number) => {
      switch (type) {
        case 1: return 'SINGLE' as const;
        case 2: return 'DOUBLE' as const;
        case 3: return 'TRIPLE' as const;
        case 4: return 'QUAD' as const;
        case 5: return 'QUINT' as const;
        default: return undefined;
      }
    };

    async function findOrCreateHotel(city: 'Madina' | 'Makkah', name: string) {
      const existing = await prisma.hotel.findFirst({ where: { city, name } });
      if (existing) return existing;
      try {
        return await prisma.hotel.create({ data: { name, city } });
      } catch {
        // Conflit d'unicité, relire
        const retry = await prisma.hotel.findFirst({ where: { city, name } });
        if (retry) return retry;
        throw new Error('Unable to create or find hotel');
      }
    }

    async function upsertRoomsForEntries(city: 'Madina' | 'Makkah', entries: any[]) {
      if (!Array.isArray(entries)) return;
      for (const entry of entries) {
        const hotelName = typeof entry === 'string' ? entry : entry?.name;
        if (!hotelName) continue;
        const hotel = await findOrCreateHotel(city, hotelName);

        // S'assurer que la table de liaison existe
        try {
          if (city === 'Madina') {
            await prisma.programHotelMadina.create({ data: { programId: program.id, hotelId: hotel.id } });
          } else {
            await prisma.programHotelMakkah.create({ data: { programId: program.id, hotelId: hotel.id } });
          }
        } catch {}

        if (!entry || typeof entry !== 'object' || !entry.chambres) continue;
        
        // Parcourir toutes les clés (1, 2, 3, 4, 5) pour s'assurer qu'elles sont toutes traitées
        for (let type = 1; type <= 5; type++) {
          const config = entry.chambres[type];
          if (!config) continue; // Si pas de configuration pour ce type, passer au suivant
          
          const roomType = mapTypeToRoomType(type);
          if (!roomType) continue;
          
          const desiredCount = config?.nb ? Number(config.nb) : 0;
          const desiredPrice = config?.prix ? parseFloat(config.prix) : 0;

          // Lire rooms existantes
          const existingRooms = await prisma.room.findMany({
            where: {
              programId: program.id,
              hotelId: hotel.id,
              roomType,
              gender: 'Mixte',
            }
          });

          const freeRooms = existingRooms.filter(r => r.nbrPlaceRestantes === r.nbrPlaceTotal);
          const occupiedRooms = existingRooms.filter(r => r.nbrPlaceRestantes < r.nbrPlaceTotal);
          const currentTotal = existingRooms.length;

          console.log(`[Room Update] Hotel: ${hotelName}, Type: ${roomType}, desiredCount: ${desiredCount}, currentTotal: ${currentTotal}, freeRooms: ${freeRooms.length}, occupiedRooms: ${occupiedRooms.length}`);

          // Ajuster le prix de TOUTES les chambres (libres ET occupées) si un prix valide est fourni
          if (desiredPrice > 0) {
            if (freeRooms.length > 0) {
              await prisma.room.updateMany({
                where: { id: { in: freeRooms.map(r => r.id) } },
                data: { prixRoom: desiredPrice }
              });
              console.log(`[Room Update] Updated price for ${freeRooms.length} free rooms to ${desiredPrice}`);
            }
            // Mettre à jour aussi le prix des rooms occupées
            if (occupiedRooms.length > 0) {
              await prisma.room.updateMany({
                where: { id: { in: occupiedRooms.map(r => r.id) } },
                data: { prixRoom: desiredPrice }
              });
              console.log(`[Room Update] Updated price for ${occupiedRooms.length} occupied rooms to ${desiredPrice}`);
            }
          }

          // Si desiredCount est 0, supprimer toutes les chambres libres de ce type
          if (desiredCount <= 0) {
            if (freeRooms.length > 0) {
              await prisma.room.deleteMany({ where: { id: { in: freeRooms.map(r => r.id) } } });
              console.log(`[Room Update] Deleted ${freeRooms.length} free rooms (desiredCount = 0)`);
            }
            continue;
          }

          if (desiredCount > currentTotal) {
            // Créer des rooms supplémentaires
            const toCreate = desiredCount - currentTotal;
            console.log(`[Room Update] Need to create ${toCreate} new rooms`);
            for (let i = 0; i < toCreate; i++) {
              await prisma.room.create({
                data: {
                  programId: program.id,
                  hotelId: hotel.id,
                  roomType,
                  gender: 'Mixte',
                  nbrPlaceTotal: type,
                  nbrPlaceRestantes: type,
                  prixRoom: desiredPrice > 0 ? desiredPrice : (freeRooms[0]?.prixRoom ?? 0),
                  listeIdsReservation: [],
                }
              });
            }
            console.log(`[Room Update] Created ${toCreate} new rooms`);
          } else if (desiredCount < currentTotal) {
            // Supprimer uniquement des rooms libres en trop
            const toRemove = currentTotal - desiredCount;
            console.log(`[Room Update] Need to remove ${toRemove} rooms (available free: ${freeRooms.length})`);
            if (toRemove > 0 && freeRooms.length > 0) {
              const deletable = freeRooms.slice(0, Math.min(toRemove, freeRooms.length));
              await prisma.room.deleteMany({ where: { id: { in: deletable.map(r => r.id) } } });
              console.log(`[Room Update] Deleted ${deletable.length} free rooms`);
            }
          } else {
            console.log(`[Room Update] No room count change needed (desiredCount = currentTotal = ${currentTotal})`);
          }
        }
      }
    }

    // Appliquer les changements Rooms dans une transaction
    await prisma.$transaction(async () => {
      await upsertRoomsForEntries('Madina', hotelsMadina);
      await upsertRoomsForEntries('Makkah', hotelsMakkah);
    });

    const updated = await prisma.program.findUnique({
      where: { id: program.id },
      include: { hotelsMadina: { include: { hotel: true } }, hotelsMakkah: { include: { hotel: true } }, rooms: { include: { hotel: true } } }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating program' });
  }
});

// Soft delete program
router.delete('/:id', async (req, res) => {
  try {
    const programId = parseInt(req.params.id);
    
    // Vérifier que le programme existe et n'est pas déjà supprimé
    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, name: true, isDeleted: true }
    });

    if (!program) {
      return res.status(404).json({ error: 'Programme non trouvé' });
    }

    if (program.isDeleted) {
      return res.status(400).json({ error: 'Le programme est déjà supprimé' });
    }

    // Effectuer le soft delete
    await prisma.program.update({
      where: { id: programId },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    res.json({ 
      message: 'Programme supprimé avec succès',
      program: {
        id: program.id,
        name: program.name,
        deletedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du programme:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du programme' });
  }
});

// Hard delete program (suppression définitive avec gestion des dépendances)
router.delete('/:id/hard', async (req, res) => {
  try {
    const programId = parseInt(req.params.id);
    
    // Vérifier que le programme existe
    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { 
        id: true, 
        name: true,
        isDeleted: true
      }
    });

    if (!program) {
      return res.status(404).json({ error: 'Programme non trouvé' });
    }

    // Note: Toutes les réservations liées au programme seront supprimées définitivement
    // peu importe leur statut, comme les autres dépendances

    // Effectuer la suppression en cascade dans une transaction
    await prisma.$transaction(async (tx) => {
      // 1. Supprimer les dépenses liées au programme
      await tx.expense.deleteMany({
        where: { programId: programId }
      });

      // 2. Supprimer les paiements liés au programme
      await tx.payment.deleteMany({
        where: { programId: programId }
      });

      // 3. Supprimer les réservations liées au programme
      await tx.reservation.deleteMany({
        where: { programId: programId }
      });

      // 4. Supprimer les relations programme-hôtels
      await tx.programHotelMadina.deleteMany({
        where: { programId: programId }
      });

      await tx.programHotelMakkah.deleteMany({
        where: { programId: programId }
      });

      // 5. Supprimer les chambres du programme
      await tx.room.deleteMany({
        where: { programId: programId }
      });

      // 6. Supprimer le programme lui-même
      await tx.program.delete({
        where: { id: programId }
      });
    });

    res.json({ 
      message: 'Programme supprimé définitivement avec succès',
      program: {
        id: program.id,
        name: program.name,
        deletedAt: new Date()
      },
      deletedItems: {
        expenses: 'Supprimées',
        payments: 'Supprimés',
        reservations: 'Supprimées',
        programHotels: 'Supprimées',
        rooms: 'Supprimées',
        program: 'Supprimé'
      }
    });
  } catch (error) {
    console.error('Erreur lors de la suppression définitive du programme:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la suppression définitive du programme',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// ===== NOUVELLES ROUTES POUR LA GESTION DES PROGRAMMES =====

// Récupérer un programme avec toutes ses statistiques détaillées
router.get('/:id/overview', ProgramOverviewController.getProgramOverview);

// Récupérer tous les programmes avec leurs statistiques
router.get('/overview/all', ProgramOverviewController.getAllProgramsOverview);

// Récupérer les statistiques globales de tous les programmes
router.get('/stats/global', ProgramOverviewController.getGlobalStats);

export default router; 