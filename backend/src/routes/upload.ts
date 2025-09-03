import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()
const prisma = new PrismaClient()

const ALLOWED_FILE_TYPES = ['passport', 'visa', 'flightBooked', 'hotelBooked', 'payment'];

// Fonction pour s'assurer que les dossiers existent
const ensureDirectoriesExist = () => {
  const baseDir = path.join(__dirname, '../../uploads')
  const subDirs = ['passeport', 'visa', 'billet', 'hotel', 'paiement']
  
  // Créer le dossier uploads s'il n'existe pas
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true })
  }
  
  // Créer les sous-dossiers s'ils n'existent pas
  subDirs.forEach(dir => {
    const dirPath = path.join(baseDir, dir)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  })
}

// Appeler la fonction au démarrage
ensureDirectoriesExist()

// Configuration de multer pour le stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let fileType = req.body.fileType || file.fieldname;
    if (!fileType || !ALLOWED_FILE_TYPES.includes(fileType)) {
      fileType = 'other';
    }
    let uploadDir = path.join(__dirname, '../../uploads');
    switch (fileType) {
      case 'passport':
        uploadDir = path.join(uploadDir, 'passeport');
        break;
      case 'visa':
        uploadDir = path.join(uploadDir, 'visa');
        break;
      case 'flightBooked':
        uploadDir = path.join(uploadDir, 'billet');
        break;
      case 'hotelBooked':
        uploadDir = path.join(uploadDir, 'hotel');
        break;
      case 'payment':
        uploadDir = path.join(uploadDir, 'paiement');
        break;
      default:
        uploadDir = path.join(uploadDir, 'other');
    }
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    let fileType = req.body.fileType || file.fieldname;
    if (!fileType || !ALLOWED_FILE_TYPES.includes(fileType)) {
      fileType = 'other';
    }
    const uniqueId = uuidv4().slice(0, 8);
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueId}_${fileType}${extension}`);
  }
});

// Filtre pour les types de fichiers acceptés
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Type de fichier non supporté. Seuls les fichiers JPEG, PNG et PDF sont acceptés.'))
  }
}

// Configuration de multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
})

// Route GET pour vérifier que l'API est fonctionnelle
router.get('/', (req: express.Request, res: express.Response) => {
  res.json({ message: 'Upload API is working' })
})

// Route pour l'upload de fichiers
router.post('/', upload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Aucun fichier n'a été uploadé" });
    }
    if (!req.body.reservationId) {
      // Supprimer les fichiers uploadés si les informations requises sont manquantes
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      for (const file of files) {
        if (file.path) {
          fs.unlinkSync(file.path);
        }
      }
      return res.status(400).json({ error: 'reservationId requis' });
    }
    const reservationId = parseInt(req.body.reservationId);
    if (isNaN(reservationId)) {
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      for (const file of files) {
        if (file.path) {
          fs.unlinkSync(file.path);
        }
      }
      return res.status(400).json({ error: 'ID de réservation invalide' });
    }
    // Vérifier si la réservation existe
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId }
    });
    if (!reservation) {
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      for (const file of files) {
        if (file.path) {
          fs.unlinkSync(file.path);
        }
      }
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }
    // Insérer chaque fichier dans la base de données
    const results = [];
    const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
    for (const file of files) {
      let relativePath = 'uploads/';
      let fileTypeForDb = file.fieldname;
      switch (file.fieldname) {
        case 'passport':
          relativePath += 'passeport/';
          fileTypeForDb = 'passeport';
          break;
        case 'visa':
          relativePath += 'visa/';
          fileTypeForDb = 'visa';
          break;
        case 'flightBooked':
          relativePath += 'billet/';
          fileTypeForDb = 'billet';
          break;
        case 'hotelBooked':
          relativePath += 'hotel/';
          fileTypeForDb = 'hotel';
          break;
        case 'payment':
          relativePath += 'paiement/';
          fileTypeForDb = 'paiement';
          break;
        default:
          relativePath += 'other/';
          fileTypeForDb = 'other';
      }
      relativePath += file.filename;
      // Get file extension for fileCategory
      const extension = (file.originalname.split('.').pop() || '').toLowerCase();
      const dbFile = await prisma.fichier.create({
        data: {
          reservationId: reservationId,
          fileName: file.originalname,
          storedName: file.filename,
          fileType: fileTypeForDb,
          filePath: relativePath,
          fileCategory: extension // "jpg", "png", or "pdf"
        }
      });
      results.push({
        id: dbFile.id,
        fileName: dbFile.fileName,
        storedName: dbFile.storedName,
        fileType: dbFile.fileType,
        filePath: dbFile.filePath
      });
    }
    res.json({
      message: 'Fichiers uploadés avec succès',
      files: results
    });
  } catch (error) {
    console.error('Erreur serveur:', error)
    // Supprimer le fichier uploadé en cas d'erreur
    if (req.files) {
      for (const file of req.files) {
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          console.error('Erreur lors de la suppression du fichier:', unlinkError);
        }
      }
    }
    res.status(500).json({ error: 'Erreur lors de l\'upload du fichier' })
  }
})

// Route pour supprimer un fichier
router.delete('/:filename', async (req: express.Request, res: express.Response) => {
  try {
    const filename = req.params.filename;
    // Construire le chemin absolu du fichier à partir du nom
    const absolutePath = path.join(__dirname, '../../uploads', ...filename.replace(/^\/|\//, '').split('/').slice(1));

    // Vérifier si le fichier existe
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    // Supprimer l'entrée de la base de données
    await prisma.fichier.deleteMany({
      where: {
        storedName: filename
      }
    });

    // Supprimer le fichier
    fs.unlinkSync(absolutePath);
    res.json({ message: 'Fichier supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du fichier' });
  }
});

// Route pour télécharger ou afficher un fichier par son id
router.get('/files/:id/download', async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'ID de fichier invalide' });
    }
    const file = await prisma.fichier.findUnique({ where: { id: fileId } });
    if (!file) {
      return res.status(404).json({ error: 'Fichier introuvable' });
    }
    // filePath est relatif au dossier uploads
    const absolutePath = path.join(__dirname, '../../uploads', ...file.filePath.replace(/^\/|\//, '').split('/').slice(1));
    res.sendFile(absolutePath);
  } catch (error) {
    console.error('Erreur lors du téléchargement du fichier:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement du fichier' });
  }
});

export default router 