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
    console.log(`\n🔵 === PUT /api/programs/${req.params.id} - REÇU ===`);
    console.log(`Body:`, JSON.stringify(req.body, null, 2));
    
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
    
    console.log(`\n📥 Données extraites:`);
    console.log(`  hotelsMadina:`, hotelsMadina?.length || 0, 'hôtel(s)');
    console.log(`  hotelsMakkah:`, hotelsMakkah?.length || 0, 'hôtel(s)');

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
    const mapTypeToRoomType = (type: number): 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'QUAD' | 'QUINT' | undefined => {
      switch (type) {
        case 1: return 'SINGLE';
        case 2: return 'DOUBLE';
        case 3: return 'TRIPLE';
        case 4: return 'QUAD';
        case 5: return 'QUINT';
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

          // Lire rooms existantes - FORCER une lecture fraîche depuis la DB
          // Utiliser findMany avec un cache désactivé pour éviter les problèmes de synchronisation
          const existingRooms = await prisma.room.findMany({
            where: {
              programId: program.id,
              hotelId: hotel.id,
              roomType,
              gender: 'Mixte',
            },
            // Pas d'options de cache, lecture directe
          });
          
          console.log(`[Room Update] DB Query - Found ${existingRooms.length} existing rooms for ${hotelName} ${roomType}`);
          if (existingRooms.length > 0) {
            console.log(`[Room Update] Room IDs: ${existingRooms.map(r => r.id).join(', ')}`);
            console.log(`[Room Update] Room details:`, existingRooms.map(r => ({
              id: r.id,
              nbrPlaceTotal: r.nbrPlaceTotal,
              nbrPlaceRestantes: r.nbrPlaceRestantes,
              prixRoom: r.prixRoom,
              gender: r.gender
            })));
          }

          const freeRooms = existingRooms.filter(r => r.nbrPlaceRestantes === r.nbrPlaceTotal);
          const occupiedRooms = existingRooms.filter(r => r.nbrPlaceRestantes < r.nbrPlaceTotal || (r.listeIdsReservation && r.listeIdsReservation.length > 0));
          let currentTotal = existingRooms.length;
          
          console.log(`[Room Update] Breakdown - Free: ${freeRooms.length}, Occupied: ${occupiedRooms.length}, Total: ${currentTotal}`);

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
            console.log(`[Room Update] Need to create ${toCreate} new rooms (desiredCount=${desiredCount}, currentTotal=${currentTotal})`);
            
            // IMPORTANT: Vérifier à nouveau APRÈS la mise à jour du prix
            // mais AVANT de créer, pour éviter les doublons dans la même transaction
            const verifyAfterPriceUpdate = await prisma.room.findMany({
              where: {
                programId: program.id,
                hotelId: hotel.id,
                roomType,
                gender: 'Mixte',
              }
            });
            const actualCurrentTotal = verifyAfterPriceUpdate.length;
            console.log(`[Room Update] Verification after price update: actualCurrentTotal=${actualCurrentTotal}`);
            
            // Recalculer toCreate avec le total actuel réel
            const actualToCreate = desiredCount - actualCurrentTotal;
            console.log(`[Room Update] Actual rooms to create: ${actualToCreate}`);
            
            if (actualToCreate > 0) {
              // Créer uniquement le nombre nécessaire
              for (let i = 0; i < actualToCreate; i++) {
                const newRoom = await prisma.room.create({
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
                console.log(`[Room Update] Created room ID: ${newRoom.id}`);
              }
              console.log(`[Room Update] Created ${actualToCreate} new rooms`);
              
              // Vérification finale pour confirmer
              const finalCheck = await prisma.room.count({
                where: {
                  programId: program.id,
                  hotelId: hotel.id,
                  roomType,
                  gender: 'Mixte',
                }
              });
              console.log(`[Room Update] Final count after creation: ${finalCheck} (expected: ${desiredCount})`);
            } else {
              console.log(`[Room Update] No rooms to create (actualCurrentTotal=${actualCurrentTotal} >= desiredCount=${desiredCount})`);
            }
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
    // Utiliser le client de transaction explicitement (tx) pour garantir l'isolation
    // et éviter les problèmes de synchronisation qui causaient la création de rooms en double
    try {
      await prisma.$transaction(async (tx) => {
        // Fonction helper pour trouver ou créer un hôtel dans la transaction
        async function findOrCreateHotelInTx(city: 'Madina' | 'Makkah', name: string) {
          const existing = await tx.hotel.findFirst({ where: { city, name } });
          if (existing) return existing;
          try {
            return await tx.hotel.create({ data: { name, city } });
          } catch (err) {
            console.error(`[TX] Error creating hotel ${name} in ${city}:`, err);
            // Conflit d'unicité, relire
            const retry = await tx.hotel.findFirst({ where: { city, name } });
            if (retry) return retry;
            throw new Error(`Unable to create or find hotel: ${name} in ${city}`);
          }
        }
        
        // Créer une version de la fonction qui utilise le client de transaction
        async function upsertRoomsForEntriesWithTx(city: 'Madina' | 'Makkah', entries: any[]) {
          if (!Array.isArray(entries)) return;
          for (const entry of entries) {
            const hotelName = typeof entry === 'string' ? entry : entry?.name;
            if (!hotelName) continue;
            
            try {
              const hotel = await findOrCreateHotelInTx(city, hotelName);
              
              // Vérifier que hotel et program ont des IDs valides
              if (!hotel || !hotel.id) {
                throw new Error(`Invalid hotel: ${hotelName} in ${city}`);
              }
              if (!program || !program.id) {
                throw new Error(`Invalid program ID`);
              }

              // S'assurer que la table de liaison existe (ne pas créer si elle existe déjà)
              // Utiliser findFirst au lieu de findUnique pour éviter les erreurs de clé composite
              try {
                let existingLink = null;
                if (city === 'Madina') {
                  existingLink = await tx.programHotelMadina.findFirst({
                    where: { programId: program.id, hotelId: hotel.id }
                  });
                  if (!existingLink) {
                    await tx.programHotelMadina.create({ 
                      data: { programId: program.id, hotelId: hotel.id } 
                    });
                    console.log(`[TX] Created link for program ${program.id} and hotel ${hotel.id} in ${city}`);
                  }
                } else {
                  existingLink = await tx.programHotelMakkah.findFirst({
                    where: { programId: program.id, hotelId: hotel.id }
                  });
                  if (!existingLink) {
                    await tx.programHotelMakkah.create({ 
                      data: { programId: program.id, hotelId: hotel.id } 
                    });
                    console.log(`[TX] Created link for program ${program.id} and hotel ${hotel.id} in ${city}`);
                  }
                }
              } catch (linkError: any) {
                // Si c'est une erreur de contrainte unique (P2002), c'est OK (la relation existe déjà)
                // Dans PostgreSQL, une erreur de contrainte unique peut faire échouer la transaction
                // mais Prisma la gère généralement correctement
                if (linkError?.code === 'P2002' || linkError?.message?.includes('Unique constraint')) {
                  console.log(`[TX] Link already exists for program ${program.id} and hotel ${hotel.id} in ${city} (ignored)`);
                } else {
                  // Pour toute autre erreur, la logger et re-throw pour que la transaction soit rollback
                  console.error(`[TX] Error creating link for program ${program.id} and hotel ${hotel.id} in ${city}:`, linkError);
                  throw linkError; // Re-throw pour rollback propre de la transaction
                }
              }

              if (!entry || typeof entry !== 'object' || !entry.chambres) continue;
              
              // Parcourir toutes les clés (1, 2, 3, 4, 5) pour s'assurer qu'elles sont toutes traitées
              for (let type = 1; type <= 5; type++) {
                const config = entry.chambres[type];
                if (!config) continue;
                
                const roomType = mapTypeToRoomType(type);
                if (!roomType) {
                  console.error(`[TX] Invalid roomType for type ${type}`);
                  continue;
                }
                
                const desiredCount = config?.nb ? Number(config.nb) : 0;
                const desiredPrice = config?.prix ? parseFloat(config.prix) : 0;

                // Vérifier les valeurs avant la requête
                if (isNaN(program.id) || isNaN(hotel.id)) {
                  throw new Error(`Invalid IDs - programId: ${program.id}, hotelId: ${hotel.id}`);
                }

                // Lire rooms existantes depuis la transaction avec une requête explicite
                // Utiliser une requête directe pour éviter les problèmes de cache
                const existingRooms = await tx.room.findMany({
                  where: {
                    programId: program.id,
                    hotelId: hotel.id,
                    roomType: roomType,
                    gender: 'Mixte',
                  },
                  // Ne pas utiliser de cache, forcer une lecture fraîche
                  orderBy: { id: 'asc' }
                });
                
                console.log(`[Room Update] [TX] DB Query - Found ${existingRooms.length} existing rooms for ${hotelName} ${roomType}`);
                
                // Détecter les rooms occupées de manière plus robuste :
                // 1. Par listeIdsReservation (plus fiable car mis à jour lors de la réservation)
                // 2. Par nbrPlaceRestantes < nbrPlaceTotal (fallback)
                const freeRooms = existingRooms.filter(r => r.nbrPlaceRestantes === r.nbrPlaceTotal);
                const occupiedRooms = existingRooms.filter(r => r.nbrPlaceRestantes < r.nbrPlaceTotal || (r.listeIdsReservation && r.listeIdsReservation.length > 0));
                
                let currentTotal = existingRooms.length;
                
                // Log détaillé pour debugging
                console.log(`[Room Update] [TX] Breakdown - Free: ${freeRooms.length}, Occupied: ${occupiedRooms.length}, Total: ${currentTotal}`);
                if (occupiedRooms.length > 0) {
                  console.log(`[Room Update] [TX] Occupied rooms details:`, occupiedRooms.map(r => ({
                    id: r.id,
                    nbrPlaceRestantes: r.nbrPlaceRestantes,
                    nbrPlaceTotal: r.nbrPlaceTotal,
                    listeIdsReservation: r.listeIdsReservation
                  })));
                }
                console.log(`[Room Update] [TX] Hotel: ${hotelName}, Type: ${roomType}, desiredCount: ${desiredCount}, currentTotal: ${currentTotal}`);

                // Ajuster le prix pour TOUTES les rooms (libres et occupées)
                // Cette mise à jour doit se faire AVANT toute autre opération pour garantir la cohérence
                if (desiredPrice > 0 && existingRooms.length > 0) {
                  await tx.room.updateMany({
                    where: {
                      programId: program.id,
                      hotelId: hotel.id,
                      roomType: roomType,
                      gender: 'Mixte',
                    },
                    data: { prixRoom: desiredPrice }
                  });
                  console.log(`[Room Update] [TX] Updated price for all ${existingRooms.length} rooms (free + occupied) to ${desiredPrice}`);
                }

                if (desiredCount <= 0) {
                  if (freeRooms.length > 0) {
                    await tx.room.deleteMany({ where: { id: { in: freeRooms.map(r => r.id) } } });
                    console.log(`[Room Update] [TX] Deleted ${freeRooms.length} free rooms (desiredCount = 0)`);
                  }
                  continue;
                }

                // Gérer la création/suppression de rooms
                if (desiredCount > currentTotal) {
                const toCreate = desiredCount - currentTotal;
                console.log(`[Room Update] [TX] Need to create ${toCreate} new rooms (desiredCount=${desiredCount}, currentTotal=${currentTotal})`);
                  
                if (toCreate > 0) {
                  const basePrice = desiredPrice > 0 ? desiredPrice : (existingRooms.length > 0 ? existingRooms[0].prixRoom : 0);
                  let updatedCurrentTotal = currentTotal;
                  const updatedFreeRooms = [...freeRooms];
                  const updatedExistingRooms = [...existingRooms];

                  for (let i = 0; i < toCreate; i++) {
                    const newRoom = await tx.room.create({
                      data: {
                        programId: program.id,
                        hotelId: hotel.id,
                        roomType,
                        gender: 'Mixte',
                        nbrPlaceTotal: type,
                        nbrPlaceRestantes: type,
                        prixRoom: basePrice,
                        listeIdsReservation: [],
                      }
                    });
                    console.log(`[Room Update] [TX] Created room ID: ${newRoom.id}`);

                    // Mettre à jour les compteurs localement pour éviter la recréation dans la même transaction
                    updatedCurrentTotal += 1;
                    const freeRoomEntry = {
                      id: newRoom.id,
                      nbrPlaceTotal: newRoom.nbrPlaceTotal,
                      nbrPlaceRestantes: newRoom.nbrPlaceRestantes,
                      prixRoom: newRoom.prixRoom,
                      gender: newRoom.gender,
                      listeIdsReservation: newRoom.listeIdsReservation,
                    };
                    updatedFreeRooms.push(freeRoomEntry as typeof existingRooms[number]);
                    updatedExistingRooms.push(freeRoomEntry as typeof existingRooms[number]);
                  }
                  console.log(`[Room Update] [TX] Created ${toCreate} new rooms`);

                  // Réassigner aux références utilisées plus bas
                  currentTotal = updatedCurrentTotal;
                  freeRooms.splice(0, freeRooms.length, ...updatedFreeRooms);
                  existingRooms.splice(0, existingRooms.length, ...updatedExistingRooms);
                  }
                } else if (desiredCount < currentTotal) {
                  const toRemove = currentTotal - desiredCount;
                  console.log(`[Room Update] [TX] Need to remove ${toRemove} rooms (available free: ${freeRooms.length}, occupied: ${occupiedRooms.length})`);
                  
                  if (toRemove > 0) {
                    // Ne supprimer QUE les rooms libres, jamais les occupées
                    if (freeRooms.length > 0) {
                      const deletable = freeRooms.slice(0, Math.min(toRemove, freeRooms.length));
                      await tx.room.deleteMany({ 
                        where: { 
                          id: { in: deletable.map(r => r.id) } 
                        } 
                      });
                      console.log(`[Room Update] [TX] Deleted ${deletable.length} free rooms (requested: ${toRemove})`);

                      // Mettre à jour les compteurs locaux
                      currentTotal -= deletable.length;
                      for (const deleted of deletable) {
                        const indexInFree = freeRooms.findIndex(fr => fr.id === deleted.id);
                        if (indexInFree !== -1) {
                          freeRooms.splice(indexInFree, 1);
                        }
                        const indexInExisting = existingRooms.findIndex(er => er.id === deleted.id);
                        if (indexInExisting !== -1) {
                          existingRooms.splice(indexInExisting, 1);
                        }
                      }
                    } else {
                      console.warn(`[Room Update] [TX] WARNING: Cannot remove ${toRemove} rooms - all ${currentTotal} rooms are occupied!`);
                    }
                  }
                } else {
                  console.log(`[Room Update] [TX] No change needed - desiredCount=${desiredCount} equals currentTotal=${currentTotal}`);
                }
              }
            } catch (err) {
              console.error(`[TX] Error processing hotel ${hotelName} in ${city}:`, err);
              throw err; // Re-throw pour que la transaction soit rollback
            }
          }
        }
        
        // Appeler les fonctions pour mettre à jour les rooms
        await upsertRoomsForEntriesWithTx('Madina', hotelsMadina);
        await upsertRoomsForEntriesWithTx('Makkah', hotelsMakkah);
      }, {
        timeout: 30000, // Timeout de 30 secondes pour les transactions longues
      });
    } catch (transactionError) {
      console.error('❌ Transaction error:', transactionError);
      throw transactionError; // Re-throw pour être capturé par le catch externe
    }

    const updated = await prisma.program.findUnique({
      where: { id: program.id },
      include: { hotelsMadina: { include: { hotel: true } }, hotelsMakkah: { include: { hotel: true } }, rooms: { include: { hotel: true } } }
    });

    res.json(updated);
  } catch (error) {
    console.error('❌ Error updating program:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ 
      error: 'Error updating program',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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