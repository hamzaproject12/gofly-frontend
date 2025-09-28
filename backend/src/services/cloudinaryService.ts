import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Types pour les options d'upload
interface UploadOptions {
  folder?: string;
  public_id?: string;
  resource_type?: 'auto' | 'image' | 'video' | 'raw';
  format?: string;
  quality?: string | number;
  transformation?: any[];
}

// Types pour les résultats d'upload
interface UploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
  created_at: string;
}

// Types pour les résultats de suppression
interface DeleteResult {
  result: string;
  deleted: { [key: string]: string };
}

class CloudinaryService {
  /**
   * Upload un fichier vers Cloudinary
   * @param file - Fichier multer ou buffer
   * @param options - Options d'upload
   * @returns Promise<UploadResult>
   */
  async uploadFile(file: Express.Multer.File | Buffer, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      const uploadOptions = {
        folder: options.folder || 'omra-travel',
        resource_type: options.resource_type || 'auto',
        quality: options.quality || 'auto',
        format: options.format || 'auto',
        ...options
      };

      let uploadStream: any;

      if (Buffer.isBuffer(file)) {
        // Si c'est un Buffer, créer un stream
        uploadStream = cloudinary.uploader.upload_stream(uploadOptions);
        const readable = new Readable();
        readable.push(file);
        readable.push(null);
        readable.pipe(uploadStream);
      } else {
        // Si c'est un fichier multer, utiliser upload_stream
        uploadStream = cloudinary.uploader.upload_stream(uploadOptions);
        const readable = new Readable();
        readable.push(file.buffer);
        readable.push(null);
        readable.pipe(uploadStream);
      }

      return new Promise((resolve, reject) => {
        uploadStream.on('end', (result: UploadResult) => {
          console.log('✅ Cloudinary upload successful:', {
            public_id: result.public_id,
            format: result.format,
            bytes: result.bytes
          });
          resolve(result);
        });

        uploadStream.on('error', (error: any) => {
          console.error('❌ Cloudinary upload error:', error);
          reject(error);
        });
      });

    } catch (error) {
      console.error('❌ CloudinaryService.uploadFile error:', error);
      throw new Error(`Erreur lors de l'upload Cloudinary: ${error}`);
    }
  }

  /**
   * Upload un fichier de paiement avec optimisations spécifiques
   * @param file - Fichier du reçu de paiement
   * @param reservationId - ID de la réservation
   * @param fileType - Type de fichier (payment, passport, etc.)
   * @returns Promise<UploadResult>
   */
  async uploadPaymentReceipt(
    file: Express.Multer.File, 
    reservationId: number, 
    fileType: string = 'payment'
  ): Promise<UploadResult> {
    const folder = `omra-travel/${fileType}s`;
    const public_id = `${fileType}_${reservationId}_${Date.now()}`;

    // Optimisations spécifiques pour les reçus de paiement
    const transformation = [];
    
    if (file.mimetype.startsWith('image/')) {
      // Pour les images (reçus photos)
      transformation.push(
        { quality: 'auto:good' },
        { format: 'auto' },
        { flags: 'attachment' }, // Force download
        { secure: true }
      );
    } else if (file.mimetype === 'application/pdf') {
      // Pour les PDFs
      transformation.push(
        { format: 'pdf' },
        { flags: 'attachment' },
        { secure: true }
      );
    }

    return this.uploadFile(file, {
      folder,
      public_id,
      resource_type: 'auto',
      transformation
    });
  }

  /**
   * Supprimer un fichier de Cloudinary
   * @param publicId - ID public du fichier
   * @param resourceType - Type de ressource
   * @returns Promise<DeleteResult>
   */
  async deleteFile(publicId: string, resourceType: string = 'auto'): Promise<DeleteResult> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType
      });

      console.log('✅ Cloudinary delete successful:', {
        public_id: publicId,
        result: result.result
      });

      return result;
    } catch (error) {
      console.error('❌ CloudinaryService.deleteFile error:', error);
      throw new Error(`Erreur lors de la suppression Cloudinary: ${error}`);
    }
  }

  /**
   * Générer une URL signée pour l'accès sécurisé
   * @param publicId - ID public du fichier
   * @param options - Options de transformation
   * @returns string
   */
  generateSignedUrl(publicId: string, options: any = {}): string {
    try {
      const url = cloudinary.url(publicId, {
        secure: true,
        sign_url: true,
        ...options
      });
      return url;
    } catch (error) {
      console.error('❌ CloudinaryService.generateSignedUrl error:', error);
      throw new Error(`Erreur lors de la génération d'URL signée: ${error}`);
    }
  }

  /**
   * Obtenir des informations sur un fichier
   * @param publicId - ID public du fichier
   * @returns Promise<any>
   */
  async getFileInfo(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId);
      return result;
    } catch (error) {
      console.error('❌ CloudinaryService.getFileInfo error:', error);
      throw new Error(`Erreur lors de la récupération des infos fichier: ${error}`);
    }
  }

  /**
   * Lister les fichiers dans un dossier
   * @param folder - Nom du dossier
   * @param maxResults - Nombre maximum de résultats
   * @returns Promise<any>
   */
  async listFiles(folder: string, maxResults: number = 50): Promise<any> {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: maxResults
      });
      return result;
    } catch (error) {
      console.error('❌ CloudinaryService.listFiles error:', error);
      throw new Error(`Erreur lors de la liste des fichiers: ${error}`);
    }
  }

  /**
   * Extraire le public_id depuis une URL Cloudinary
   * @param url - URL Cloudinary
   * @returns string | null
   */
  extractPublicId(url: string): string | null {
    try {
      const matches = url.match(/\/v\d+\/(.+)\./);
      return matches ? matches[1] : null;
    } catch (error) {
      console.error('❌ CloudinaryService.extractPublicId error:', error);
      return null;
    }
  }
}

// Instance singleton
const cloudinaryService = new CloudinaryService();

export default cloudinaryService;
export { CloudinaryService, UploadResult, DeleteResult, UploadOptions };
