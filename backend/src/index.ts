import express from 'express';
import cors from 'cors';
import programsRouter from './routes/programs';
import reservationsRouter from './routes/reservations';
import hotelsRouter from './routes/hotels';
import uploadRouter from './routes/upload';
import paymentsRouter from './routes/payments';
import path from 'path';
import morgan from 'morgan';

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Configuration pour servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use(morgan('dev'));

// Routes
console.log('Chargement des routes...');
try {
  app.use('/api/programs', programsRouter);
  console.log('Route /api/programs chargée');
} catch (error) {
  console.error('Erreur lors du chargement de /api/programs:', error);
}

try {
  app.use('/api/reservations', reservationsRouter);
  console.log('Route /api/reservations chargée');
} catch (error) {
  console.error('Erreur lors du chargement de /api/reservations:', error);
}

try {
  app.use('/api/hotels', hotelsRouter);
  console.log('Route /api/hotels chargée');
} catch (error) {
  console.error('Erreur lors du chargement de /api/hotels:', error);
}

try {
  app.use('/api/upload', uploadRouter);
  console.log('Route /api/upload chargée');
} catch (error) {
  console.error('Erreur lors du chargement de /api/upload:', error);
}

try {
  app.use('/api/payments', paymentsRouter);
  console.log('Route /api/payments chargée');
} catch (error) {
  console.error('Erreur lors du chargement de /api/payments:', error);
}

// Gestion des erreurs
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Une erreur est survenue sur le serveur' });
});

app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
  console.log('Routes disponibles:');
  console.log('- /api/programs');
  console.log('- /api/reservations');
  console.log('- /api/hotels');
  console.log('- /api/upload');
  console.log('- /api/payments');
}); 