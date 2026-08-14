import crypto from 'crypto';

/**
 * Liens de téléchargement de documents utilisables hors de l'application
 * (fichier Excel exporté, e-mail…), donc sans en-tête Authorization possible.
 * On signe l'id du fichier avec le JWT_SECRET : le lien reste inexploitable
 * si on tente de deviner un autre id.
 */

const SIGNATURE_LENGTH = 16;

function secret(): string {
  return process.env.JWT_SECRET || 'omra-travel-file-link-secret';
}

export function signFileId(id: number): string {
  return crypto
    .createHmac('sha256', secret())
    .update(`fichier:${id}`)
    .digest('hex')
    .slice(0, SIGNATURE_LENGTH);
}

export function verifyFileSignature(id: number, signature: string): boolean {
  const expected = signFileId(id);
  const provided = String(signature || '');
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

/** URL publique du backend, dérivée de la requête si aucune variable d'env. */
export function publicApiBaseUrl(req: {
  protocol: string;
  get: (name: string) => string | undefined;
}): string {
  const fromEnv = process.env.PUBLIC_API_URL || process.env.BACKEND_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const forwardedProto = req.get('x-forwarded-proto');
  const proto = (forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol) || 'https';
  const host = req.get('host') || 'localhost:5000';
  return `${proto}://${host}`;
}

export function buildFileDownloadUrl(baseUrl: string, id: number): string {
  return `${baseUrl}/api/files/${id}/download?sig=${signFileId(id)}`;
}
