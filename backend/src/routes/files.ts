import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { verifyFileSignature } from '../services/fileDownloadLink';

const prisma = new PrismaClient();
const router = Router();

/**
 * Téléchargement d'un document avec un vrai nom de fichier.
 *
 * Les documents PDF envoyés sur Cloudinary sont stockés en `raw` avec un
 * public_id sans extension : l'URL Cloudinary brute livre donc un fichier
 * nommé « passport_176_1786535713924 », sans extension, que Windows ne sait
 * pas ouvrir. Cette route sert d'intermédiaire : elle récupère le contenu et
 * le renvoie avec le bon Content-Type et un nom lisible
 * (ex. « Passeport_ALAMI_Ahmed.pdf »).
 */

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const LABEL_BY_FILE_TYPE: Record<string, string> = {
  passeport: 'Passeport',
  passport: 'Passeport',
  visa: 'Visa',
  billet: 'Billet',
  hotel: 'Hotel',
  paiement: 'Recu',
  payment: 'Recu',
  cin: 'CIN',
};

/** Marques diacritiques Unicode (accents) laissées par la normalisation NFD. */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Nom de fichier sûr : ASCII, sans espaces ni caractères interdits. */
function slugify(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function extensionOf(value: string | null | undefined): string {
  if (!value) return '';
  const withoutQuery = String(value).split(/[?#]/)[0];
  const base = withoutQuery.substring(withoutQuery.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  const ext = base.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : '';
}

type FichierForDownload = {
  fileType: string;
  fileName: string;
  fileCategory: string;
  filePath: string;
  cloudinaryUrl: string | null;
  reservation: { firstName: string | null; lastName: string | null } | null;
};

function buildDownloadName(file: FichierForDownload, upstreamMime?: string): string {
  const extension =
    extensionOf(file.fileCategory ? `x.${file.fileCategory}` : '') ||
    extensionOf(file.fileName) ||
    extensionOf(file.cloudinaryUrl) ||
    extensionOf(file.filePath) ||
    EXTENSION_BY_MIME[(upstreamMime || '').split(';')[0].trim()] ||
    '';

  const label = LABEL_BY_FILE_TYPE[(file.fileType || '').toLowerCase()] || slugify(file.fileType) || 'Document';
  const person = slugify(
    `${file.reservation?.lastName || ''} ${file.reservation?.firstName || ''}`.trim()
  );

  const stem = person ? `${label}_${person}` : label;
  return extension ? `${stem}.${extension}` : stem;
}

function contentTypeFor(fileName: string, upstreamMime?: string): string {
  const ext = extensionOf(fileName);
  if (ext && MIME_BY_EXTENSION[ext]) return MIME_BY_EXTENSION[ext];
  if (upstreamMime && !upstreamMime.startsWith('application/octet-stream')) return upstreamMime;
  return 'application/octet-stream';
}

/** En-tête RFC 5987 : nom ASCII + variante UTF-8 pour les navigateurs récents. */
function contentDisposition(fileName: string): string {
  return `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * GET /api/files/:id/download?sig=...
 * Public (signé) : les liens sont ouverts depuis le fichier Excel exporté,
 * où aucun en-tête Authorization ne peut être envoyé.
 */
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Identifiant de fichier invalide' });
    }

    if (!verifyFileSignature(id, String(req.query.sig || ''))) {
      return res.status(403).json({ error: 'Lien de téléchargement invalide ou expiré' });
    }

    const file = await prisma.fichier.findUnique({
      where: { id },
      include: {
        reservation: { select: { firstName: true, lastName: true } },
      },
    });

    if (!file) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const remoteUrl =
      file.cloudinaryUrl ||
      (/^https?:\/\//i.test(file.filePath) ? file.filePath : '');

    if (remoteUrl) {
      return streamRemote(remoteUrl, file as FichierForDownload, res);
    }

    // Fichier local : `filePath` vaut « uploads/passeport/xxx.jpg »
    const relative = file.filePath.replace(/^[/\\]+/, '');
    const absolute = path.join(__dirname, '..', '..', relative);
    const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');

    if (!absolute.startsWith(uploadsRoot) || !fs.existsSync(absolute)) {
      return res.status(404).json({ error: 'Fichier introuvable sur le serveur' });
    }

    const downloadName = buildDownloadName(file as FichierForDownload);
    res.setHeader('Content-Type', contentTypeFor(downloadName));
    res.setHeader('Content-Disposition', contentDisposition(downloadName));
    return res.sendFile(absolute);
  } catch (error) {
    console.error('❌ Erreur téléchargement fichier:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erreur lors du téléchargement du fichier' });
    }
  }
});

function streamRemote(url: string, file: FichierForDownload, res: Response, redirects = 0): void {
  if (redirects > 3) {
    res.status(502).json({ error: 'Trop de redirections vers le fichier distant' });
    return;
  }

  const client = url.startsWith('http://') ? http : https;

  const request = client.get(url, (upstream) => {
    const status = upstream.statusCode || 0;

    if (status >= 300 && status < 400 && upstream.headers.location) {
      upstream.resume();
      streamRemote(upstream.headers.location, file, res, redirects + 1);
      return;
    }

    if (status !== 200) {
      upstream.resume();
      if (!res.headersSent) {
        res.status(502).json({ error: `Fichier distant indisponible (HTTP ${status})` });
      }
      return;
    }

    const upstreamMime = String(upstream.headers['content-type'] || '');
    const downloadName = buildDownloadName(file, upstreamMime);

    res.setHeader('Content-Type', contentTypeFor(downloadName, upstreamMime));
    res.setHeader('Content-Disposition', contentDisposition(downloadName));
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length'] as string);
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');

    upstream.pipe(res);
  });

  request.on('error', (error) => {
    console.error('❌ Erreur récupération fichier distant:', error);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Impossible de récupérer le fichier distant' });
    }
  });

  request.setTimeout(30000, () => {
    request.destroy();
  });
}

export default router;
