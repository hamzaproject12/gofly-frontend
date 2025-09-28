import express from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import cloudinaryService from '../services/cloudinaryService';

const router = express.Router();
const prisma = new PrismaClient();

// Configuration multer pour les fichiers en mémoire (pour Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Seuls les fichiers JPEG, PNG, WebP et PDF sont acceptés.'));
    }
  }
});

const ALLOWED_FILE_TYPES = ['passport', 'visa', 'flightBooked', 'hotelBooked', 'payment'];

/**
 * Upload de fichiers vers Cloudinary
 * POST /api/upload-cloudinary
 */
router.post('/', upload.any(), async (req, res) => {
  try {
    console.log('🚀 Cloudinary upload request:', {
      files: req.files?.length || 0,
      body: req.body
    });

    const { reservationId, fileType } = req.body;

    if (!reservationId) {
      return res.status(400).json({ error: 'reservationId est requis' });
    }

    // Vérifier que la réservation existe
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(reservationId) }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    
    if (files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const results = [];

    // Upload chaque fichier vers Cloudinary
    for (const file of files) {
      try {
        const currentFileType = fileType || file.fieldname;
        
        if (!ALLOWED_FILE_TYPES.includes(currentFileType)) {
          throw new Error(`Type de fichier non autorisé: ${currentFileType}`);
        }

        console.log(`📤 Uploading ${file.originalname} to Cloudinary...`);

        // Upload vers Cloudinary
        const cloudinaryResult = await cloudinaryService.uploadPaymentReceipt(
          file,
          parseInt(reservationId),
          currentFileType
        );

        // Déterminer le type de fichier pour la base de données
        let fileTypeForDb = currentFileType;
        switch (currentFileType) {
          case 'passport':
            fileTypeForDb = 'passeport';
            break;
          case 'visa':
            fileTypeForDb = 'visa';
            break;
          case 'flightBooked':
            fileTypeForDb = 'billet';
            break;
          case 'hotelBooked':
            fileTypeForDb = 'hotel';
            break;
          case 'payment':
            fileTypeForDb = 'paiement';
            break;
        }

        // Obtenir l'extension du fichier
        const extension = (file.originalname.split('.').pop() || '').toLowerCase();

        // Sauvegarder en base de données avec les infos Cloudinary
        const dbFile = await prisma.fichier.create({
          data: {
            reservationId: parseInt(reservationId),
            fileName: file.originalname,
            storedName: cloudinaryResult.public_id,
            fileType: fileTypeForDb,
            filePath: `cloudinary://${cloudinaryResult.public_id}`, // Pour compatibilité
            cloudinaryId: cloudinaryResult.public_id,
            cloudinaryUrl: cloudinaryResult.secure_url,
            fileCategory: extension
          }
        });

        results.push({
          id: dbFile.id,
          fileName: dbFile.fileName,
          storedName: dbFile.storedName,
          fileType: dbFile.fileType,
          filePath: dbFile.filePath,
          cloudinaryId: dbFile.cloudinaryId,
          cloudinaryUrl: dbFile.cloudinaryUrl,
          cloudinaryInfo: {
            public_id: cloudinaryResult.public_id,
            secure_url: cloudinaryResult.secure_url,
            format: cloudinaryResult.format,
            bytes: cloudinaryResult.bytes,
            created_at: cloudinaryResult.created_at
          }
        });

        console.log(`✅ File uploaded successfully: ${file.originalname}`);

      } catch (fileError) {
        console.error(`❌ Error uploading file ${file.originalname}:`, fileError);
        results.push({
          error: `Erreur lors de l'upload de ${file.originalname}: ${fileError}`,
          fileName: file.originalname
        });
      }
    }

    // Compter les succès et erreurs
    const successCount = results.filter(r => !r.error).length;
    const errorCount = results.filter(r => r.error).length;

    console.log(`📊 Upload completed: ${successCount} success, ${errorCount} errors`);

    res.json({
      message: `Fichiers uploadés avec succès: ${successCount}/${files.length}`,
      results,
      summary: {
        total: files.length,
        success: successCount,
        errors: errorCount
      }
    });

  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'upload vers Cloudinary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Supprimer un fichier de Cloudinary
 * DELETE /api/upload-cloudinary/:fileId
 */
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    console.log(`🗑️ Deleting file from Cloudinary: ${fileId}`);

    // Récupérer le fichier de la base de données
    const dbFile = await prisma.fichier.findUnique({
      where: { id: parseInt(fileId) }
    });

    if (!dbFile) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    // Supprimer de Cloudinary si cloudinaryId existe
    if (dbFile.cloudinaryId) {
      try {
        await cloudinaryService.deleteFile(dbFile.cloudinaryId);
        console.log(`✅ File deleted from Cloudinary: ${dbFile.cloudinaryId}`);
      } catch (cloudinaryError) {
        console.error(`⚠️ Error deleting from Cloudinary: ${cloudinaryError}`);
        // Continue même si Cloudinary échoue
      }
    }

    // Supprimer de la base de données
    await prisma.fichier.delete({
      where: { id: parseInt(fileId) }
    });

    console.log(`✅ File deleted from database: ${fileId}`);

    res.json({
      message: 'Fichier supprimé avec succès',
      fileId: parseInt(fileId),
      cloudinaryId: dbFile.cloudinaryId
    });

  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la suppression du fichier',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Obtenir les informations d'un fichier
 * GET /api/upload-cloudinary/:fileId/info
 */
router.get('/:fileId/info', async (req, res) => {
  try {
    const { fileId } = req.params;

    const dbFile = await prisma.fichier.findUnique({
      where: { id: parseInt(fileId) },
      include: {
        reservation: {
          select: {
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      }
    });

    if (!dbFile) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    let cloudinaryInfo = null;
    
    // Récupérer les infos Cloudinary si disponible
    if (dbFile.cloudinaryId) {
      try {
        cloudinaryInfo = await cloudinaryService.getFileInfo(dbFile.cloudinaryId);
      } catch (error) {
        console.error('⚠️ Error getting Cloudinary info:', error);
      }
    }

    res.json({
      id: dbFile.id,
      fileName: dbFile.fileName,
      fileType: dbFile.fileType,
      cloudinaryId: dbFile.cloudinaryId,
      cloudinaryUrl: dbFile.cloudinaryUrl,
      uploaded_at: dbFile.uploaded_at,
      reservation: dbFile.reservation,
      cloudinaryInfo
    });

  } catch (error) {
    console.error('❌ Get file info error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des informations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Lister les fichiers d'une réservation
 * GET /api/upload-cloudinary/reservation/:reservationId
 */
router.get('/reservation/:reservationId', async (req, res) => {
  try {
    const { reservationId } = req.params;

    const files = await prisma.fichier.findMany({
      where: { reservationId: parseInt(reservationId) },
      orderBy: { uploaded_at: 'desc' },
      include: {
        payment: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true
          }
        }
      }
    });

    res.json({
      files: files.map(file => ({
        id: file.id,
        fileName: file.fileName,
        fileType: file.fileType,
        cloudinaryId: file.cloudinaryId,
        cloudinaryUrl: file.cloudinaryUrl,
        uploaded_at: file.uploaded_at,
        payment: file.payment
      })),
      count: files.length
    });

  } catch (error) {
    console.error('❌ List files error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des fichiers',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
