import express from 'express';
import { PrismaClient, City as PrismaCity } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const VALID_CITIES = ['Madina', 'Makkah', 'Autre'] as const;
type City = typeof VALID_CITIES[number];

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Hotels route is working' });
});

// Test database connection
router.get('/test-db', async (req, res) => {
  try {
    console.log('🔍 Test de connexion à la base de données');
    
    // Test simple de connexion
    const hotelCount = await prisma.hotel.count();
    console.log(`✅ Connexion OK. Nombre d'hôtels: ${hotelCount}`);
    
    res.json({ 
      message: 'Database connection successful',
      hotelCount: hotelCount
    });
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error);
    res.status(500).json({ 
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test specific city
router.get('/test-madina', async (req, res) => {
  try {
    console.log('🔍 Test spécifique pour Madina');
    
    const madinaHotels = await prisma.hotel.findMany({
      where: {
        city: 'Madina'
      },
      select: {
        id: true,
        name: true,
        city: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`✅ Trouvé ${madinaHotels.length} hôtels à Madina:`, madinaHotels);
    
    res.json({
      message: 'Test Madina successful',
      hotels: madinaHotels,
      count: madinaHotels.length
    });
  } catch (error) {
    console.error('❌ Erreur test Madina:', error);
    res.status(500).json({ 
      error: 'Test Madina failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get available hotels by city
router.get('/available', async (req, res) => {
  try {
    console.log('🔍 API /available appelée avec query:', req.query);
    
    const { city } = req.query;
    console.log('📝 Paramètre city reçu:', city);
    
    if (!city) {
      console.log('❌ Paramètre city manquant');
      return res.status(400).json({ error: 'City parameter is required' });
    }

    const cityParam = String(city);
    console.log('🏙️ Ville normalisée:', cityParam);
    
    if (!VALID_CITIES.includes(cityParam as City)) {
      console.log('❌ Ville invalide:', cityParam);
      return res.status(400).json({ error: 'Invalid city. Use Madina, Makkah or Autre' });
    }

    console.log('🔍 Recherche des hôtels pour la ville:', cityParam);
    
    // Avec la nouvelle modélisation, tous les hôtels sont disponibles
    // On filtre seulement par ville
    const hotels = await prisma.hotel.findMany({
      where: {
        city: cityParam as PrismaCity
      },
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        city: true
      }
    });

    console.log(`✅ Trouvé ${hotels.length} hôtels pour ${cityParam}:`, hotels);
    
    res.json(hotels);
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des hôtels:', error);
    res.status(500).json({ 
      error: 'Error fetching hotels',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all hotels
router.get('/', async (req, res) => {
  try {
    console.log('🔍 Récupération de tous les hôtels');
    
    const hotels = await prisma.hotel.findMany({
      orderBy: [
        { city: 'asc' },
        { name: 'asc' }
      ]
    });
    
    console.log(`✅ Trouvé ${hotels.length} hôtels au total`);
    res.json(hotels);
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de tous les hôtels:', error);
    res.status(500).json({ error: 'Error fetching all hotels' });
  }
});

// Get hotels with their associated programs
router.get('/with-programs', async (req, res) => {
  try {
    console.log('🔍 Récupération des hôtels avec leurs programmes');
    
    const hotels = await prisma.hotel.findMany({
      include: {
        programsMadina: {
          include: {
            program: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        programsMakkah: {
          include: {
            program: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: [
        { city: 'asc' },
        { name: 'asc' }
      ]
    });
    
    console.log(`✅ Trouvé ${hotels.length} hôtels avec leurs programmes`);
    res.json(hotels);
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des hôtels avec programmes:', error);
    res.status(500).json({ error: 'Error fetching hotels with programs' });
  }
});

// Create a new hotel
router.post('/', async (req, res) => {
  try {
    console.log('🏗️ Création d\'un nouvel hôtel avec body:', req.body);
    
    const { name, city } = req.body;

    if (!name || !city) {
      console.log('❌ Données manquantes:', { name, city });
      return res.status(400).json({ error: 'Name and city are required' });
    }

    if (!VALID_CITIES.includes(city as City)) {
      console.log('❌ Ville invalide:', city);
      return res.status(400).json({ error: 'Invalid city. Use Madina, Makkah or Autre' });
    }

    console.log('✅ Création de l\'hôtel:', { name, city });
    
    const hotel = await prisma.hotel.create({
      data: {
        name,
        city: city as City
      }
    });

    console.log('✅ Hôtel créé avec succès:', hotel);
    res.status(201).json(hotel);
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'hôtel:', error);
    res.status(500).json({ error: 'Error creating hotel' });
  }
});

// Update a hotel
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, city } = req.body;

    console.log(`🏗️ Mise à jour de l'hôtel ${id} avec body:`, req.body);

    if (!name || !city) {
      console.log('❌ Données manquantes:', { name, city });
      return res.status(400).json({ error: 'Name and city are required' });
    }

    if (!VALID_CITIES.includes(city as City)) {
      console.log('❌ Ville invalide:', city);
      return res.status(400).json({ error: 'Invalid city. Use Madina, Makkah or Autre' });
    }

    // Check if hotel exists
    const existingHotel = await prisma.hotel.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingHotel) {
      console.log('❌ Hôtel non trouvé:', id);
      return res.status(404).json({ error: 'Hotel not found' });
    }

    console.log('✅ Mise à jour de l\'hôtel:', { id, name, city });
    
    const hotel = await prisma.hotel.update({
      where: { id: parseInt(id) },
      data: {
        name,
        city: city as City
      }
    });

    console.log('✅ Hôtel mis à jour avec succès:', hotel);
    res.json(hotel);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de l\'hôtel:', error);
    res.status(500).json({ error: 'Error updating hotel' });
  }
});

// Delete a hotel
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Suppression de l'hôtel ${id}`);

    // Check if hotel exists
    const existingHotel = await prisma.hotel.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingHotel) {
      console.log('❌ Hôtel non trouvé:', id);
      return res.status(404).json({ error: 'Hotel not found' });
    }

    // Check if hotel is used in any programs
    const programsMadina = await prisma.programHotelMadina.count({
      where: { hotelId: parseInt(id) }
    });

    const programsMakkah = await prisma.programHotelMakkah.count({
      where: { hotelId: parseInt(id) }
    });

    const programsAutre = await prisma.programHotelAutre.count({
      where: { hotelId: parseInt(id) }
    });

    if (programsMadina > 0 || programsMakkah > 0 || programsAutre > 0) {
      console.log('❌ Hôtel utilisé dans des programmes:', { programsMadina, programsMakkah, programsAutre });
      return res.status(400).json({
        error: 'Cannot delete hotel. It is used in programs.',
        details: {
          programsMadina,
          programsMakkah,
          programsAutre
        }
      });
    }

    console.log('✅ Suppression de l\'hôtel:', id);
    
    await prisma.hotel.delete({
      where: { id: parseInt(id) }
    });

    console.log('✅ Hôtel supprimé avec succès');
    res.json({ message: 'Hotel deleted successfully' });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de l\'hôtel:', error);
    res.status(500).json({ error: 'Error deleting hotel' });
  }
});

export default router; 