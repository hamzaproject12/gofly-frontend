import express from 'express';
import cors from 'cors';
import path from 'path';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';

// Routes
import programRoutes from './routes/programs';
import reservationRoutes from './routes/reservations';
import expenseRoutes from './routes/expenses';
import uploadRouter from './routes/upload';
import hotelsRouter from './routes/hotels';
import paymentsRouter from './routes/payments';
import balanceRouter from './routes/balance';
import uploadCloudinaryRouter from './routes/upload-cloudinary';
import analyticsRouter from './routes/analytics';
import roomAvailabilityRouter from './routes/room-availability';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Configuration CORS pour développement et production
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://gofly-beta.vercel.app',
  // Vercel domains will be added dynamically
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configuration pour servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Debug middleware amélioré
app.use((req, res, next) => {
  console.log(`🌐 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log(`📝 Query params:`, req.query);
  console.log(`📦 Body:`, req.body);
  next();
});

// Test de connexion à la base de données au démarrage
async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Connexion à la base de données réussie');
    
    const hotelCount = await prisma.hotel.count();
    console.log(`📊 Nombre d'hôtels dans la base: ${hotelCount}`);
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error);
  }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/upload', uploadRouter);
app.use('/api/hotels', hotelsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/balance', balanceRouter);
app.use('/api/upload-cloudinary', uploadCloudinaryRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/room-availability', roomAvailabilityRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Route de test pour vérifier que le serveur fonctionne
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Le serveur fonctionne correctement',
    timestamp: new Date().toISOString()
  });
});

// Route de test spécifique pour les hôtels
app.get('/api/hotels-test', async (req, res) => {
  try {
    const hotels = await prisma.hotel.findMany({
      take: 5,
      orderBy: { name: 'asc' }
    });
    res.json({
      message: 'Test des hôtels réussi',
      hotels: hotels,
      count: hotels.length
    });
  } catch (error) {
    console.error('Erreur test hôtels:', error);
    res.status(500).json({ error: 'Erreur test hôtels' });
  }
});

// Gestion des erreurs
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Erreur serveur:', err);
  res.status(500).json({ 
    error: 'Une erreur est survenue sur le serveur',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Gestion des routes non trouvées
app.use('*', (req, res) => {
  console.log(`❌ Route non trouvée: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  
  // Tester la connexion à la base de données
  await testDatabaseConnection();
  
  console.log('📋 Routes disponibles:');
  console.log('- /api/auth (login, register, logout, profile)');
  console.log('- /api/admin (gestion des utilisateurs - Admin seulement)');
  console.log('- /api/programs');
  console.log('- /api/reservations');
  console.log('- /api/expenses');
  console.log('- /api/upload');
  console.log('- /api/hotels');
  console.log('- /api/payments');
  console.log('- /api/balance');
  console.log('- /api/upload-cloudinary');
  console.log('- /api/analytics (dashboard analytics)');
  console.log('- /api/test');
  console.log('- /api/hotels-test');
  console.log('- /health');
}); 