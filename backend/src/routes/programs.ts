import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get all programs with their hotels
router.get('/', async (req, res) => {
  try {
    const programs = await prisma.program.findMany({
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

// Get a single program with its hotels
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const program = await prisma.program.findUnique({
      where: { id: Number(id) },
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

    res.json(program);
  } catch (error) {
    res.status(500).json({ error: 'Error updating program' });
  }
});

// Delete program
router.delete('/:id', async (req, res) => {
  try {
    await prisma.program.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error deleting program' });
  }
});

export default router; 