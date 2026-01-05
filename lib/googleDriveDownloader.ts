/**
 * Convertit une URL Google Drive en URL de téléchargement direct
 * Format d'entrée : https://drive.google.com/file/d/FILE_ID/view
 * Format de sortie : https://drive.google.com/uc?export=download&id=FILE_ID
 */
function convertGoogleDriveUrlToDownloadUrl(url: string): string {
  // Extraire le FILE_ID depuis l'URL
  const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!fileIdMatch) {
    throw new Error('URL Google Drive invalide. Format attendu: https://drive.google.com/file/d/FILE_ID/view');
  }
  
  const fileId = fileIdMatch[1];
  
  // URL de téléchargement direct (nécessite que le fichier soit partagé publiquement)
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Télécharge un fichier depuis Google Drive
 * @param url - URL Google Drive (format: https://drive.google.com/file/d/FILE_ID/view)
 * @returns Promise<Buffer> - Buffer du fichier téléchargé
 */
export async function downloadFileFromGoogleDrive(url: string): Promise<Buffer> {
  try {
    // Convertir l'URL en URL de téléchargement
    const downloadUrl = convertGoogleDriveUrlToDownloadUrl(url);
    
    console.log(`📥 Téléchargement depuis Google Drive: ${url}`);
    console.log(`   → URL de téléchargement: ${downloadUrl}`);
    
    // Télécharger le fichier
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      // Suivre les redirections (Google Drive peut rediriger)
      redirect: 'follow',
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors du téléchargement: ${response.status} ${response.statusText}`);
    }
    
    // Vérifier le Content-Type pour détecter les erreurs
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/html')) {
      // Google Drive peut retourner une page HTML si le fichier n'est pas public
      throw new Error('Le fichier Google Drive n\'est pas accessible publiquement. Veuillez le partager en mode "Toute personne avec le lien".');
    }
    
    // Convertir en Buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`✅ Fichier téléchargé: ${buffer.length} bytes`);
    
    return buffer;
  } catch (error) {
    console.error('❌ Erreur téléchargement Google Drive:', error);
    throw new Error(`Impossible de télécharger le fichier depuis Google Drive: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

/**
 * Détecte le type MIME depuis un Buffer
 */
export function getMimeTypeFromBuffer(buffer: Buffer): string | null {
  // Vérifier les signatures de fichiers (magic numbers)
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }
  return null;
}


