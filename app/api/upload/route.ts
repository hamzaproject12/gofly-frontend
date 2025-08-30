import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// Définition des catégories de fichiers autorisées
const ALLOWED_FILE_CATEGORIES = [
  'passeport',
  'paiement',
  'visa',
  'billet',
  'hotel_makkah',
  'hotel_madina'
] as const;

type FileCategory = typeof ALLOWED_FILE_CATEGORIES[number];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const reservationId = formData.get('reservationId') as string;
    const fileType = formData.get('fileType') as string;
    const fileCategory = formData.get('fileCategory') as FileCategory;

    // Validation des entrées
    if (!file || !reservationId || !fileType || !fileCategory) {
      return NextResponse.json(
        { error: 'Fichier, ID de réservation, type et catégorie requis' },
        { status: 400 }
      );
    }

    // Validation de la catégorie de fichier
    if (!ALLOWED_FILE_CATEGORIES.includes(fileCategory)) {
      return NextResponse.json(
        { error: `Catégorie de fichier invalide. Catégories autorisées : ${ALLOWED_FILE_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Note: Database validation will be handled by the backend
    // This is a frontend-only deployment, so we'll just handle file upload

    // Créer le répertoire pour la catégorie de fichier s'il n'existe pas
    const uploadDir = join(process.cwd(), 'public', 'uploads', fileCategory);
    await mkdir(uploadDir, { recursive: true });

    // Générer un nom de fichier unique avec UUID
    const fileExtension = file.name.split('.').pop();
    const storedName = `${uuidv4()}-${fileCategory}.${fileExtension}`;
    const filePath = join(uploadDir, storedName);

    // Convertir le fichier en buffer et l'écrire
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Return success response (database operations will be handled by backend)
    return NextResponse.json({
      fileName: file.name,
      storedName: storedName,
      fileType: fileType,
      fileCategory: fileCategory,
      filePath: `/uploads/${fileCategory}/${storedName}`,
      message: 'Fichier uploadé avec succès (frontend only - backend will handle database)',
    });
  } catch (error) {
    console.error('Erreur lors de l\'upload:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'upload du fichier' },
      { status: 500 }
    );
  }
}