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
  date_of_expiry?: string; // nom actuel de `expiration_date` (AAMMJJ brut)
  nationality?: string;
  country?: string;
  // Clés ajoutées par la nouvelle version du service (toutes optionnelles)
  date_of_birth_iso?: string;
  expiration_date_iso?: string;
  date_of_expiry_iso?: string; // nom actuel de `expiration_date_iso` (AAAA-MM-JJ)
  valid?: boolean;
  valid_format?: string; // TD1 (CNIE 3x30) | TD2 (2x36) | TD3 (passeport)
  document_format?: string; // nom actuel de `valid_format`
  page?: number; // page du PDF où la MRZ a été trouvée
  expired?: boolean;
  checks?: Record<string, boolean>; // chiffres de contrôle ICAO par champ
};

/**
 * Enveloppe renvoyée par le service : les champs MRZ sont regroupés dans
 * `data`, le verdict de lecture est posé à la racine.
 */
type OcrResponse = {
  status?: string;
  error?: string;
  data?: OcrExtractData;
  valid?: boolean;
  expired?: boolean;
  page?: number;
  document_format?: string;
  valid_format?: string;
  checks?: Record<string, boolean>;
  mrz_found?: boolean;
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
  /** Date d'expiration au format AAAA-MM-JJ, si le service l'a fournie */
  expiryDate?: string;
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
  const json = (await res.json().catch(() => ({}))) as OcrResponse;

  if (!res.ok) {
    throw new Error(json.error || "Service OCR indisponible");
  }

  // Le service renvoie les champs MRZ dans `data`, mais le verdict de lecture
  // (`valid`, `expired`, `page`, `document_format`) à côté, dans l'enveloppe.
  const raw: OcrExtractData = {
    valid: json.valid,
    expired: json.expired,
    page: json.page,
    document_format: json.document_format,
    valid_format: json.valid_format,
    checks: json.checks,
    ...(json.data || {}),
  };
  return {
    firstName: String(raw.first_name ?? "").trim(),
    lastName: String(raw.last_name ?? "").trim(),
    passport: String(raw.passport ?? raw.personal_id_number ?? "").trim(),
    sex: typeof raw.sex === "string" ? raw.sex : undefined,
    valid: typeof raw.valid === "boolean" ? raw.valid : undefined,
    expired: typeof raw.expired === "boolean" ? raw.expired : undefined,
    format: firstString(raw.document_format, raw.valid_format),
    page: typeof raw.page === "number" ? raw.page : undefined,
    expiryDate: readExpiryIso(raw),
    raw,
  };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Date d'expiration normalisée en AAAA-MM-JJ. Le service la fournit déjà au
 * format ISO (`date_of_expiry_iso`, anciennement `expiration_date_iso`) ; on
 * retombe sinon sur la valeur brute AAMMJJ de la MRZ.
 */
function readExpiryIso(raw: OcrExtractData): string | undefined {
  const iso = firstString(raw.date_of_expiry_iso, raw.expiration_date_iso);
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;

  const brut = firstString(raw.date_of_expiry, raw.expiration_date);
  const mrz = brut && /^\d{6}$/.test(brut) ? brut : null;
  if (!mrz) return undefined;
  // AAMMJJ : une date d'expiration est toujours dans les années 2000.
  return `20${mrz.slice(0, 2)}-${mrz.slice(2, 4)}-${mrz.slice(4, 6)}`;
}

/** Validité minimale exigée pour un passeport au départ (règle Omra / visa). */
export const PASSPORT_MIN_VALIDITY_MONTHS = 6;

export type OcrAlertLevel = "error" | "warning";

export type OcrAlert = {
  level: OcrAlertLevel;
  message: string;
};

export type PassportExpiryStatus =
  | "unknown" // pas de date d'expiration lisible
  | "expired" // document déjà périmé
  | "insufficient" // expire dans moins de 6 mois
  | "ok";

/** Date "AAAA-MM-JJ" lue à midi local, pour rester insensible au fuseau. */
function parseIsoDate(value: string | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ajoute des mois en ramenant au dernier jour du mois si besoin (31/08 + 6 → 28/02). */
function addMonths(date: Date, months: number): Date {
  const jour = date.getDate();
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < jour) d.setDate(0);
  return d;
}

/**
 * Le passeport doit rester valide au moins 6 mois : c'est la règle appliquée
 * par les autorités saoudiennes pour la délivrance du visa Omra.
 */
export function passportExpiryStatus(
  expiryDate: string | undefined,
  aujourdHui: Date = new Date()
): PassportExpiryStatus {
  const expiration = parseIsoDate(expiryDate);
  if (!expiration) return "unknown";

  const reference = new Date(
    aujourdHui.getFullYear(),
    aujourdHui.getMonth(),
    aujourdHui.getDate(),
    12,
    0,
    0
  );
  if (expiration.getTime() < reference.getTime()) return "expired";
  if (
    expiration.getTime() <
    addMonths(reference, PASSPORT_MIN_VALIDITY_MONTHS).getTime()
  ) {
    return "insufficient";
  }
  return "ok";
}

/**
 * Alerte à afficher dans la modale de validation : validité restante du
 * document (règle des 6 mois) puis qualité de la lecture MRZ. Le niveau
 * `error` signale un document inutilisable en l'état pour un départ.
 */
export function ocrQualityWarning(result: PassportOcrResult): OcrAlert | null {
  const messages: string[] = [];
  let level: OcrAlertLevel = "warning";

  const statutExpiration = passportExpiryStatus(result.expiryDate);

  // La date elle-même est affichée par le bloc de la modale : les messages
  // ci-dessous portent la conséquence et l'action, pas la date.
  if (
    statutExpiration === "expired" ||
    (statutExpiration === "unknown" && result.expired === true)
  ) {
    level = "error";
    messages.push(
      "Passeport expiré : il doit être renouvelé avant toute réservation."
    );
  } else if (statutExpiration === "insufficient") {
    level = "error";
    messages.push(
      `Validité insuffisante : un passeport valide au moins ${PASSPORT_MIN_VALIDITY_MONTHS} mois est exigé pour le visa. Demandez le renouvellement du document avant de confirmer le dossier.`
    );
  } else if (statutExpiration === "unknown") {
    messages.push(
      `Date d'expiration non détectée : vérifiez sur le document qu'il reste valide au moins ${PASSPORT_MIN_VALIDITY_MONTHS} mois.`
    );
  }

  if (result.valid === false) {
    messages.push(
      "Lecture incertaine : les chiffres de contrôle du document ne correspondent pas. Vérifiez chaque champ."
    );
  }

  if (messages.length === 0) return null;
  return { level, message: messages.join(" ") };
}
