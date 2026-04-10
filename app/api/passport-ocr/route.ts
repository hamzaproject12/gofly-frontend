import { NextRequest, NextResponse } from "next/server";

const DEFAULT_OCR_URL =
  "https://ocr-api-production-bdf8.up.railway.app/extract-text/";

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

    const forward = new FormData();
    forward.append("file", file);

    const ocrUrl = getOcrUrl();
    const res = await fetch(ocrUrl, {
      method: "POST",
      body: forward,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            (data as { error?: string }).error ||
            `Service OCR indisponible (${res.status})`,
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
