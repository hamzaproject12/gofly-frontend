import { siteConfig } from "@/lib/config";

export interface PaymentReceiptData {
  /** Nom de famille du client */
  nom: string;
  /** Prénom du client */
  prenom: string;
  /** Téléphone du client */
  telephone: string;
  /** Numéro de passeport (optionnel) */
  passportNumber?: string;
  /** Nom du programme (optionnel) */
  programme?: string;
  /** Mode de paiement (Espèces, Virement, …) */
  type: string;
  /** Montant réglé en DH */
  montant: number;
  /** Date du paiement au format YYYY-MM-DD (par défaut : aujourd'hui) */
  date?: string;
}

// Charge une image (logo) pour le rendu canvas. Renvoie null si l'image est introuvable.
function loadReceiptImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Convertit un entier en toutes lettres (français) pour la mention "Arrêté à la somme de…".
function montantEnLettres(n: number): string {
  const entier = Math.floor(Math.abs(n));
  if (entier === 0) return "zéro";
  const unites = [
    "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
    "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
    "dix-sept", "dix-huit", "dix-neuf",
  ];
  const dizaines = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

  const centaines = (num: number): string => {
    let str = "";
    const c = Math.floor(num / 100);
    const reste = num % 100;
    if (c > 0) str += (c > 1 ? unites[c] + " " : "") + "cent" + (c > 1 && reste === 0 ? "s" : "");
    if (reste > 0) {
      if (str) str += " ";
      if (reste < 20) {
        str += unites[reste];
      } else {
        const d = Math.floor(reste / 10);
        const u = reste % 10;
        if (d === 7 || d === 9) {
          str += dizaines[d] + "-" + unites[10 + u];
        } else {
          str += dizaines[d];
          if (u === 1 && d < 8) str += " et un";
          else if (u > 0) str += "-" + unites[u];
          if (d === 8 && u === 0) str += "s";
        }
      }
    }
    return str;
  };

  let mots = "";
  const millions = Math.floor(entier / 1000000);
  const milliers = Math.floor((entier % 1000000) / 1000);
  const reste = entier % 1000;
  if (millions > 0) mots += (millions > 1 ? centaines(millions) + " millions" : "un million") + " ";
  if (milliers > 0) mots += (milliers > 1 ? centaines(milliers) + " mille" : "mille") + " ";
  if (reste > 0) mots += centaines(reste);
  return mots.trim();
}

/**
 * Génère un reçu de paiement stylé (format A4 portrait, qualité impression)
 * avec en-tête, logo de l'agence, cartes d'information et encadré du montant.
 * Renvoie un fichier PNG prêt à être joint au paiement.
 * Lève une erreur si le rendu canvas n'est pas disponible.
 */
export async function generatePaymentReceiptFile(data: PaymentReceiptData): Promise<File> {
  const montant = Number(data.montant) || 0;
  const paymentDate = data.date || new Date().toISOString().slice(0, 10);

  // Dimensions A4 portrait (ratio ~1.414) pour une qualité d'impression nette
  const W = 1100;
  const H = 1556;
  const M = 60;
  const contentW = W - 2 * M;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context indisponible");
  }

  // Chargement du logo de l'agence (silencieux si introuvable)
  const logo = await loadReceiptImage(siteConfig.logo);

  // --- Helpers de dessin ---
  const roundRectPath = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  const truncate = (text: string, maxW: number) => {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
  };
  const wrapText = (text: string, x: number, y: number, maxW: number, lineHeight: number) => {
    const words = text.split(" ");
    let line = "";
    let yy = y;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
    return yy;
  };
  const formatDate = (d: string) => {
    const parts = (d || "").split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : (d || "—");
  };

  // --- Fond ---
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // --- En-tête (bandeau dégradé orange + logo) ---
  const headerH = 170;
  const grad = ctx.createLinearGradient(M, M, M + contentW, M + headerH);
  grad.addColorStop(0, "#f97316");
  grad.addColorStop(1, "#c2410e");
  roundRectPath(M, M, contentW, headerH, 18);
  ctx.fillStyle = grad;
  ctx.fill();

  // Pastille blanche + logo
  const logoSize = 110;
  const logoX = M + 30;
  const logoY = M + 30;
  roundRectPath(logoX, logoY, logoSize, logoSize, 16);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  if (logo) {
    const inner = logoSize - 16;
    const scale = Math.min(inner / logo.width, inner / logo.height);
    const dw = logo.width * scale;
    const dh = logo.height * scale;
    ctx.drawImage(logo, logoX + (logoSize - dw) / 2, logoY + (logoSize - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#c2410e";
    ctx.font = "bold 60px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((siteConfig.name || "G").charAt(0).toUpperCase(), logoX + logoSize / 2, logoY + logoSize / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // Nom de l'agence + sous-titre
  const headTextX = logoX + logoSize + 28;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px Arial";
  ctx.fillText(truncate(siteConfig.name, contentW - logoSize - 90), headTextX, M + 78);
  ctx.font = "500 22px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText("Agence de voyage Omra", headTextX, M + 112);

  // Email de contact (aligné à droite dans l'en-tête)
  ctx.textAlign = "right";
  ctx.font = "18px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(siteConfig.contactEmail, M + contentW - 30, M + 140);
  ctx.textAlign = "left";

  // --- Titre du document ---
  let cursorY = M + headerH + 72;
  ctx.textAlign = "center";
  ctx.fillStyle = "#9a3412";
  ctx.font = "bold 38px Arial";
  ctx.fillText("REÇU DE PAIEMENT", W / 2, cursorY);
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 120, cursorY + 18);
  ctx.lineTo(W / 2 + 120, cursorY + 18);
  ctx.stroke();
  ctx.textAlign = "left";

  // --- Numéro de reçu + date d'émission ---
  cursorY += 70;
  const recuNo = `N° ${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  ctx.font = "20px Arial";
  ctx.fillStyle = "#6b7280";
  ctx.fillText(`Reçu ${recuNo}`, M, cursorY);
  ctx.textAlign = "right";
  ctx.fillText(`Émis le ${formatDate(paymentDate)}`, M + contentW, cursorY);
  ctx.textAlign = "left";

  // --- Deux cartes d'informations ---
  const drawInfoCard = (x: number, y: number, w: number, h: number, title: string, rows: Array<[string, string]>) => {
    roundRectPath(x, y, w, h, 16);
    ctx.fillStyle = "#fffbf7";
    ctx.fill();
    ctx.strokeStyle = "#fed7aa";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#c2410e";
    ctx.font = "bold 18px Arial";
    ctx.fillText(title, x + 24, y + 38);
    ctx.strokeStyle = "#fdba74";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 24, y + 52);
    ctx.lineTo(x + w - 24, y + 52);
    ctx.stroke();
    let ry = y + 92;
    for (const [label, value] of rows) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "15px Arial";
      ctx.fillText(label.toUpperCase(), x + 24, ry);
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 22px Arial";
      ctx.fillText(truncate(value || "—", w - 48), x + 24, ry + 28);
      ry += 60;
    }
  };

  cursorY += 32;
  const gap = 30;
  const cardW = (contentW - gap) / 2;
  const cardH = 250;
  drawInfoCard(M, cursorY, cardW, cardH, "INFORMATIONS CLIENT", [
    ["Nom complet", `${data.nom} ${data.prenom}`.trim()],
    ["Téléphone", data.telephone],
    ["N° de passeport", data.passportNumber || ""],
  ]);
  drawInfoCard(M + cardW + gap, cursorY, cardW, cardH, "DÉTAILS DU PAIEMENT", [
    ["Programme", data.programme || ""],
    ["Mode de paiement", data.type],
    ["Date du paiement", formatDate(paymentDate)],
  ]);
  cursorY += cardH + 40;

  // --- Encadré du montant ---
  const amtH = 130;
  roundRectPath(M, cursorY, contentW, amtH, 16);
  const amtGrad = ctx.createLinearGradient(M, cursorY, M + contentW, cursorY);
  amtGrad.addColorStop(0, "#fff7ed");
  amtGrad.addColorStop(1, "#ffedd5");
  ctx.fillStyle = amtGrad;
  ctx.fill();
  ctx.strokeStyle = "#fb923c";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  roundRectPath(M, cursorY, contentW, amtH, 16);
  ctx.clip();
  ctx.fillStyle = "#ea580c";
  ctx.fillRect(M, cursorY, 10, amtH);
  ctx.restore();
  ctx.fillStyle = "#9a3412";
  ctx.font = "bold 22px Arial";
  ctx.fillText("MONTANT RÉGLÉ", M + 44, cursorY + 56);
  ctx.fillStyle = "#6b7280";
  ctx.font = "16px Arial";
  ctx.fillText("Paiement reçu et enregistré par l'agence", M + 44, cursorY + 90);
  ctx.textAlign = "right";
  ctx.fillStyle = "#c2410e";
  ctx.font = "bold 52px Arial";
  ctx.fillText(`${montant.toLocaleString("fr-FR")} DH`, M + contentW - 40, cursorY + 82);
  ctx.textAlign = "left";
  cursorY += amtH + 46;

  // --- Montant en toutes lettres ---
  ctx.fillStyle = "#374151";
  ctx.font = "italic 19px Arial";
  const lettres = `Arrêté la présente quittance à la somme de ${montantEnLettres(montant)} dirham${montant > 1 ? "s" : ""}.`;
  cursorY = wrapText(lettres, M, cursorY, contentW, 28) + 70;

  // --- Signatures ---
  const sigW = 280;
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, cursorY);
  ctx.lineTo(M + sigW, cursorY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(M + contentW - sigW, cursorY);
  ctx.lineTo(M + contentW, cursorY);
  ctx.stroke();
  ctx.fillStyle = "#6b7280";
  ctx.font = "16px Arial";
  ctx.fillText("Signature du client", M, cursorY + 28);
  ctx.textAlign = "right";
  ctx.fillText("Cachet & signature de l'agence", M + contentW, cursorY + 28);
  ctx.textAlign = "left";

  // --- Pied de page ---
  const footerY = H - 64;
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, footerY - 30);
  ctx.lineTo(M + contentW, footerY - 30);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#9ca3af";
  ctx.font = "15px Arial";
  ctx.fillText(
    `${siteConfig.name} · ${siteConfig.contactEmail} · Document généré automatiquement`,
    W / 2,
    footerY,
  );
  ctx.textAlign = "left";

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    throw new Error("Génération du reçu échouée");
  }
  return new File([blob], `recu-${Date.now()}.png`, { type: "image/png" });
}

/**
 * Télécharge un reçu (fichier local déjà généré/importé, ou URL d'aperçu).
 * Pour une URL distante non téléchargeable (CORS), ouvre dans un nouvel onglet.
 * Renvoie false si rien n'a pu être téléchargé.
 */
export async function downloadReceipt(
  source: File | string | null | undefined,
  fallbackName = "recu-paiement.png",
  previewType?: string,
): Promise<boolean> {
  let blob: Blob | null = null;
  let filename = fallbackName;

  if (source instanceof File) {
    blob = source;
    filename = source.name || fallbackName;
  } else if (typeof source === "string" && source) {
    try {
      const res = await fetch(source);
      blob = await res.blob();
    } catch {
      window.open(source, "_blank", "noopener,noreferrer");
      return true;
    }
  }

  if (!blob) return false;

  if (filename === fallbackName) {
    const ext = (blob.type || previewType || "").includes("pdf") ? "pdf" : "png";
    filename = fallbackName.replace(/\.(png|pdf)$/i, "") + "." + ext;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
