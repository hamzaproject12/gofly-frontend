import { NextRequest, NextResponse } from "next/server";

const DEFAULT_OCR_URL =
  "https://ocr-api-production-bdf8.up.railway.app/extract-text/";

// L'OCR d'un PDF scanné (rendu de la page + tesseract) est plus lent que sur
// une simple photo : on laisse au service le temps de répondre.
export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_FILE_SIZE =
  (Number(process.env.NEXT_PUBLIC_OCR_MAX_FILE_SIZE_MB) || 4) * 1024 * 1024;

function getOcrUrl(): string {
  return (
    process.env.PASSPORT_OCR_URL ||
    process.env.NEXT_PUBLIC_PASSPORT_OCR_URL ||
    DEFAULT_OCR_URL
  );
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Fichier manquant ou invalide" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Fichier trop volumineux (${Math.round(
            MAX_FILE_SIZE / (1024 * 1024)
          )} Mo maximum)`,
        },
        { status: 413 }
      );
    }

    const forward = new FormData();
    // Le nom est conservé : le service accepte images et PDF, et se sert de
    // l'extension en secours quand le Content-Type est générique.
    forward.append("file", file, (file as File).name || "document");

    const ocrUrl = getOcrUrl();
    const res = await fetch(ocrUrl, {
      method: "POST",
      body: forward,
    });

    // Le service peut répondre autre chose que du JSON (502/504 d'un proxy,
    // page d'erreur HTML) : on ne laisse pas échouer le parsing.
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (!res.ok) {
      const detail =
        (data as { error?: string; detail?: string }).error ||
        (data as { detail?: string }).detail;
      return NextResponse.json(
        {
          error:
            (typeof detail === "string" && detail) ||
            (res.status === 413
              ? "Fichier trop volumineux pour le service OCR"
              : `Service OCR indisponible (${res.status})`),
        },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("passport-ocr proxy:", e);
    return NextResponse.json(
      { error: "Erreur lors de l'appel au service OCR" },
      { status: 502 }
    );
  }
}
