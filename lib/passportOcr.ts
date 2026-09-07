// Helper unique pour la lecture automatique des passeports / CNIE (MRZ).
//
// Le service OCR accepte les images ET les PDF (texte natif ou scanné) : il
// reconnaît un PDF à ses octets magiques `%PDF-`, pas au Content-Type. Un
// fichier envoyé en `application/octet-stream` ou sans type MIME (cas fréquent
// sur mobile ou depuis un partage) fonctionne donc aussi — d'où les
// détections par extension ci-dessous.
//
// Endpoint : POST /api/passport-ocr (proxy Next.js vers POST /extract-text/).

export type OcrExtractData = {
  // Les 8 clés historiques, format inchangé (date_of_birth reste en AAMMJJ brut)
  first_name?: string;
  last_name?: string;
  passport?: string;
  personal_id_number?: string;
  sex?: string;
  date_of_birth?: string;
  expiration_date?: string;
  nationality?: string;
  country?: string;
  // Clés ajoutées par la nouvelle version du service (toutes optionnelles)
  date_of_birth_iso?: string;
  expiration_date_iso?: string;
  valid?: boolean;
  valid_format?: string; // TD1 (CNIE 3x30) | TD2 (2x36) | TD3 (passeport)
  page?: number; // page du PDF où la MRZ a été trouvée
  expired?: boolean;
  checks?: Record<string, boolean>; // chiffres de contrôle ICAO par champ
};

export type PassportOcrResult = {
  firstName: string;
  lastName: string;
  passport: string;
  sex?: string;
  /** Tous les chiffres de contrôle ICAO tombent juste */
  valid?: boolean;
  expired?: boolean;
  /** TD1 / TD2 / TD3 */
  format?: string;
  /** Page du PDF où la MRZ a été lue (1 pour une image) */
  page?: number;
  raw: OcrExtractData;
};

// Limite volontairement basse : le proxy passe par une fonction serverless
// Vercel, dont le corps de requête est plafonné à ~4,5 Mo.
const MAX_FILE_SIZE_MB = Number(process.env.NEXT_PUBLIC_OCR_MAX_FILE_SIZE_MB) || 4;
export const OCR_MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

export const UNSUPPORTED_DOCUMENT_MESSAGE =
  "Format de fichier non supporté. Seuls les fichiers PDF et images sont acceptés.";
export const OCR_FILE_TOO_LARGE_MESSAGE = `Fichier trop volumineux (${MAX_FILE_SIZE_MB} Mo maximum). Compressez le PDF ou photographiez la page du passeport.`;
export const OCR_FAILURE_MESSAGE =
  "Impossible d’analyser le document. Vous pouvez saisir les champs manuellement.";

const PDF_MIME_TYPES = [
  "application/pdf",
  "application/x-pdf",
  "application/acrobat",
  "applications/vnd.pdf",
  "text/pdf",
];

/** PDF détecté par son type MIME ou, à défaut, par son extension. */
export function isPdfUpload(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (PDF_MIME_TYPES.includes(type)) return true;
  return /\.pdf$/i.test(file.name || "");
}

export function isImageUpload(file: File): boolean {
  if (isPdfUpload(file)) return false;
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|bmp|webp|heic|heif|tiff?)$/i.test(file.name || "");
}

export function isSupportedDocumentUpload(file: File): boolean {
  return isPdfUpload(file) || isImageUpload(file);
}

/**
 * Type MIME normalisé pour les aperçus : un PDF sans type MIME serait sinon
 * affiché comme une image cassée.
 */
export function documentPreviewType(file: File): string {
  if (isPdfUpload(file)) return "application/pdf";
  return file.type || "image/*";
}

/** Envoie le fichier (image ou PDF) au service OCR et normalise la réponse. */
export async function extractPassportData(file: File): Promise<PassportOcrResult> {
  if (file.size > OCR_MAX_FILE_SIZE) {
    throw new Error(OCR_FILE_TOO_LARGE_MESSAGE);
  }

  const fd = new FormData();
  // 3e argument : conserve le nom (donc l'extension) du fichier.
  fd.append("file", file, file.name);

  const res = await fetch("/api/passport-ocr", { method: "POST", body: fd });
  const json = (await res.json().catch(() => ({}))) as {
    status?: string;
    data?: OcrExtractData;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(json.error || "Service OCR indisponible");
  }

  const raw = json.data || {};
  return {
    firstName: String(raw.first_name ?? "").trim(),
    lastName: String(raw.last_name ?? "").trim(),
    passport: String(raw.passport ?? raw.personal_id_number ?? "").trim(),
    sex: typeof raw.sex === "string" ? raw.sex : undefined,
    valid: typeof raw.valid === "boolean" ? raw.valid : undefined,
    expired: typeof raw.expired === "boolean" ? raw.expired : undefined,
    format: typeof raw.valid_format === "string" ? raw.valid_format : undefined,
    page: typeof raw.page === "number" ? raw.page : undefined,
    raw,
  };
}

/**
 * Message d'avertissement quand la lecture est douteuse (chiffres de contrôle
 * ICAO faux) ou le document expiré — à afficher dans la modale de validation.
 */
export function ocrQualityWarning(result: PassportOcrResult): string | null {
  if (result.valid === false) {
    return "Lecture incertaine : les chiffres de contrôle du document ne correspondent pas. Vérifiez chaque champ.";
  }
  if (result.expired === true) {
    return "Attention : ce document semble expiré.";
  }
  return null;
}
