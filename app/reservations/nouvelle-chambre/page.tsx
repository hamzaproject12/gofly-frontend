"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  User,
  Wallet,
  CreditCard,
  Settings,
  Info,
  FileText,
  Leaf,
  ShieldCheck,
  Crown,
  Trash2,
  Plus,
  ZoomIn,
  X,
  Download,
  ChevronUp,
} from "lucide-react";

interface Hotel {
  id: number;
  name: string;
  city: string;
}

interface Program {
  id: number;
  name: string;
  hotelsMadina: Array<{ hotel: Hotel }>;
  hotelsMakkah: Array<{ hotel: Hotel }>;
}

type RoomRow = {
  id: number;
  hotelId: number;
  roomType: string;
  gender: string;
  nbrPlaceTotal: number;
  nbrPlaceRestantes: number;
  prixRoom: number;
  listeIdsReservation: number[];
};

type Occupant = {
  firstName: string;
  lastName: string;
  phone: string;
  passportNumber: string;
  gender: "Homme" | "Femme";
};

type PaymentRow = {
  amount: string;
  type: string;
  receipt: File | null;
};

type OcrExtractData = {
  first_name?: string;
  last_name?: string;
  passport?: string;
  personal_id_number?: string;
  sex?: string;
};

function mapOcrSexToGender(sex: string | undefined): "Homme" | "Femme" | null {
  if (!sex || typeof sex !== "string") return null;
  const u = sex.trim().toUpperCase();
  if (u === "F" || u === "FEMALE" || u === "FÉMININ") return "Femme";
  if (u === "M" || u === "MALE" || u === "MASCULIN") return "Homme";
  return null;
}

const ROOM_CAPACITY: Record<string, number> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  QUAD: 4,
  QUINT: 5,
};
const PHONE_REGEX = /^\+\d{3}\s\d{9}$/;
const PASSPORT_REGEX = /^[A-Z]{2}\d{7}$/;

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  const country = digits.slice(0, 3);
  const local = digits.slice(3, 12);
  return local ? `+${country} ${local}` : `+${country}`;
}

function formatPassportInput(value: string): string {
  const chars = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const letters = chars.replace(/[^A-Z]/g, "").slice(0, 2);
  const numbers = chars.replace(/[^0-9]/g, "").slice(0, 7);
  return `${letters}${numbers}`;
}

const planThemes = {
  Économique: { name: "Économique", icon: Leaf },
  Normal: { name: "Normal", icon: ShieldCheck },
  VIP: { name: "VIP", icon: Crown },
} as const;

const LEAVE_UNSAVED_CONFIRM_FR =
  "Voulez-vous vraiment quitter ? Les informations saisies ne seront pas enregistrées.";

export default function NouvelleChambrePage() {
  const { toast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);

  const [formData, setFormData] = useState({
    programme: "",
    programId: "",
    typeChambre: "",
    hotelMadina: "",
    hotelMakkah: "",
    dateReservation: new Date().toISOString().split("T")[0],
    prix: "",
    gender: "Homme" as "Homme" | "Femme",
  });

  const [paidAmount, setPaidAmount] = useState("");
  const [familyMixed, setFamilyMixed] = useState(true);

  const [programInfo, setProgramInfo] = useState<{
    nbJoursMadina: number;
    nbJoursMakkah: number;
    exchange: number;
    prixAvionDH: number;
    prixVisaRiyal: number;
    profit: number;
    profitEconomique: number;
    profitNormal: number;
    profitVIP: number;
    rooms: RoomRow[];
  } | null>(null);

  const [customization, setCustomization] = useState({
    includeAvion: true,
    includeVisa: true,
    joursMadina: 0,
    joursMakkah: 0,
    plan: "Normal" as keyof typeof planThemes,
  });

  const [roomMadinaId, setRoomMadinaId] = useState("");
  const [roomMakkahId, setRoomMakkahId] = useState("");

  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [occupantPassportFiles, setOccupantPassportFiles] = useState<
    Array<File | null>
  >([]);
  const [leaderMeta, setLeaderMeta] = useState({
    groupe: "",
    remarque: "",
    transport: false,
  });
  const [payments, setPayments] = useState<PaymentRow[]>([
    { amount: "", type: "", receipt: null },
  ]);
  /** Aperçus locaux alignés sur les index occupants / paiements (comme Nouvelle Réservation) */
  const [occupantPreviews, setOccupantPreviews] = useState<
    Array<{ url: string; type: string } | null>
  >([]);
  const [paymentPreviews, setPaymentPreviews] = useState<
    Array<{ url: string; type: string } | null>
  >([null]);
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    type: string;
  } | null>(null);
  /** Données OCR à valider avant application sur l’occupant ciblé (index = leader ou accompagnant) */
  const [ocrValidation, setOcrValidation] = useState<{
    occupantIndex: number;
    firstName: string;
    lastName: string;
    passport: string;
    sex?: string;
  } | null>(null);
  const [ocrProcessingIndex, setOcrProcessingIndex] = useState<number | null>(
    null
  );
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [supplierStatus, setSupplierStatus] = useState({
    statutVisa: false,
    statutVol: false,
    statutHotel: false,
  });
  const [reduction, setReduction] = useState(0);
  const [prixMode, setPrixMode] = useState<"reduction" | "proposition" | null>(
    null
  );
  const [prixPropose, setPrixPropose] = useState<number | null>(null);

  const capacity = formData.typeChambre
    ? ROOM_CAPACITY[formData.typeChambre] || 0
    : 0;

  const programmeSelectionne = programs.find(
    (p) => p.id.toString() === formData.programId
  );
  const hotelsMadina =
    programmeSelectionne?.hotelsMadina?.map((ph) => ph.hotel) || [];
  const hotelsMakkah =
    programmeSelectionne?.hotelsMakkah?.map((ph) => ph.hotel) || [];

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.request(api.endpoints.programs);
        if (!response.ok) throw new Error("programmes");
        setPrograms(await response.json());
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de charger les programmes",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  useEffect(() => {
    if (!formData.programId) {
      setProgramInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await api.request(
          `/api/programs/${formData.programId}`
        );
        if (!response.ok) throw new Error("details");
        const data = await response.json();
        if (cancelled) return;
        setProgramInfo({
          nbJoursMadina: data.nbJoursMadina,
          nbJoursMakkah: data.nbJoursMakkah,
          exchange: data.exchange,
          prixAvionDH: data.prixAvionDH,
          prixVisaRiyal: data.prixVisaRiyal,
          profit: data.profit || 0,
          profitEconomique: data.profitEconomique || 0,
          profitNormal: data.profitNormal || 0,
          profitVIP: data.profitVIP || 0,
          rooms: data.rooms || [],
        });
        setCustomization((prev) => ({
          ...prev,
          joursMadina: data.nbJoursMadina,
          joursMakkah: data.nbJoursMakkah,
        }));
      } catch {
        if (!cancelled) {
          toast({
            title: "Erreur",
            description: "Impossible de charger les détails du programme",
            variant: "destructive",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formData.programId, toast]);

  useEffect(() => {
    if (!capacity) {
      setOccupants([]);
      setOccupantPassportFiles([]);
      setOccupantPreviews((prev) => {
        prev.forEach((p) => {
          if (p?.url?.startsWith("blob:")) URL.revokeObjectURL(p.url);
        });
        return [];
      });
      return;
    }
    setOccupants((prev) =>
      Array.from({ length: capacity }, (_, i) => ({
        firstName: prev[i]?.firstName || "",
        lastName: prev[i]?.lastName || "",
        phone: prev[i]?.phone || "",
        passportNumber: prev[i]?.passportNumber || "",
        gender:
          i === 0
            ? (formData.gender as "Homme" | "Femme")
            : prev[i]?.gender || "Homme",
      }))
    );
    setOccupantPassportFiles((prev) =>
      Array.from({ length: capacity }, (_, i) => prev[i] || null)
    );
    setOccupantPreviews((prev) => {
      const next = Array.from({ length: capacity }, (_, i) =>
        i < prev.length ? prev[i] : null
      );
      for (let i = capacity; i < prev.length; i++) {
        const p = prev[i];
        if (p?.url?.startsWith("blob:")) URL.revokeObjectURL(p.url);
      }
      return next;
    });
  }, [capacity, formData.gender]);

  const roomCandidatesMadina = useMemo(() => {
    if (!programInfo || !formData.typeChambre || !formData.hotelMadina)
      return [];
    const hid = parseInt(formData.hotelMadina, 10);
    return programInfo.rooms.filter((room) => {
      if (room.hotelId !== hid || room.roomType !== formData.typeChambre)
        return false;
      if (room.nbrPlaceRestantes !== room.nbrPlaceTotal) return false;
      if (familyMixed) return true;
      return (
        room.gender === formData.gender || room.gender === "Mixte"
      );
    });
  }, [
    programInfo,
    formData.typeChambre,
    formData.hotelMadina,
    formData.gender,
    familyMixed,
  ]);

  const roomCandidatesMakkah = useMemo(() => {
    if (!programInfo || !formData.typeChambre || !formData.hotelMakkah)
      return [];
    const hid = parseInt(formData.hotelMakkah, 10);
    return programInfo.rooms.filter((room) => {
      if (room.hotelId !== hid || room.roomType !== formData.typeChambre)
        return false;
      if (room.nbrPlaceRestantes !== room.nbrPlaceTotal) return false;
      if (familyMixed) {
        return true;
      }
      return (
        room.gender === formData.gender || room.gender === "Mixte"
      );
    });
  }, [
    programInfo,
    formData.typeChambre,
    formData.hotelMakkah,
    formData.gender,
    familyMixed,
  ]);

  const calculatePrice = useMemo(() => {
    if (
      !programInfo ||
      !formData.typeChambre ||
      !formData.hotelMadina ||
      !formData.hotelMakkah ||
      !roomMadinaId ||
      !roomMakkahId
    ) {
      return 0;
    }

    const roomMadina = programInfo.rooms.find(
      (r) => r.id === Number(roomMadinaId)
    );
    const roomMakkah = programInfo.rooms.find(
      (r) => r.id === Number(roomMakkahId)
    );
    if (!roomMadina || !roomMakkah) return 0;

    const roomType = formData.typeChambre;
    const nbPersonnes =
      {
        SINGLE: 1,
        DOUBLE: 2,
        TRIPLE: 3,
        QUAD: 4,
        QUINT: 5,
      }[roomType] || 1;

    const getProfitByPlan = () => {
      switch (customization.plan) {
        case "Économique":
          return programInfo.profitEconomique || programInfo.profit || 0;
        case "VIP":
          return programInfo.profitVIP || programInfo.profit || 0;
        default:
          return programInfo.profitNormal || programInfo.profit || 0;
      }
    };

    const prixAvion = customization.includeAvion ? programInfo.prixAvionDH : 0;
    const prixVisa = customization.includeVisa ? programInfo.prixVisaRiyal : 0;
    const profit = getProfitByPlan();

    const prixRoomMadina = roomMadina.prixRoom || 0;
    const prixRoomMakkah = roomMakkah.prixRoom || 0;
    // prixRoom en base = tarif par lit ; chambre complète = lit × capacité (nbPersonnes)
    const prixHotelMadina =
      formData.hotelMadina !== "none"
        ? prixRoomMadina * nbPersonnes * customization.joursMadina
        : 0;
    const prixHotelMakkah =
      formData.hotelMakkah !== "none"
        ? prixRoomMakkah * nbPersonnes * customization.joursMakkah
        : 0;

    const prixFinal =
      prixAvion +
      profit +
      (prixVisa + prixHotelMakkah + prixHotelMadina) * programInfo.exchange;

    return Math.round(prixFinal);
  }, [
    programInfo,
    formData.typeChambre,
    formData.hotelMadina,
    formData.hotelMakkah,
    roomMadinaId,
    roomMakkahId,
    customization,
  ]);

  useEffect(() => {
    if (calculatePrice > 0) {
      let prixFinal: number;
      if (
        prixMode === "proposition" &&
        prixPropose !== null &&
        prixPropose >= calculatePrice
      ) {
        prixFinal = Math.max(0, Math.round(prixPropose));
      } else if (prixMode === "reduction") {
        prixFinal = Math.max(0, Math.round(calculatePrice - reduction));
      } else {
        prixFinal = Math.max(0, Math.round(calculatePrice));
      }
      setFormData((prev) => ({ ...prev, prix: String(prixFinal) }));
    }
  }, [calculatePrice, reduction, prixPropose, prixMode]);

  const hotelNameMadina = useMemo(() => {
    if (!formData.hotelMadina || formData.hotelMadina === "none") {
      return formData.hotelMadina === "none" ? "none" : "";
    }
    return (
      hotelsMadina.find((h) => h.id.toString() === formData.hotelMadina)
        ?.name || formData.hotelMadina
    );
  }, [formData.hotelMadina, hotelsMadina]);

  const hotelNameMakkah = useMemo(() => {
    if (!formData.hotelMakkah || formData.hotelMakkah === "none") {
      return formData.hotelMakkah === "none" ? "none" : "";
    }
    return (
      hotelsMakkah.find((h) => h.id.toString() === formData.hotelMakkah)
        ?.name || formData.hotelMakkah
    );
  }, [formData.hotelMakkah, hotelsMakkah]);

  const updateOccupant = (
    index: number,
    field: keyof Occupant,
    value: string
  ) => {
    const normalizedValue =
      field === "phone"
        ? formatPhoneInput(value)
        : field === "passportNumber"
          ? formatPassportInput(value)
          : value;
    setOccupants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: normalizedValue };
      return next;
    });
  };

  const revokePreviewEntry = (entry: { url: string; type: string } | null) => {
    if (entry?.url?.startsWith("blob:")) URL.revokeObjectURL(entry.url);
  };

  const isPdfFile = (fileNameOrUrl: string | null | undefined): boolean => {
    if (!fileNameOrUrl || typeof fileNameOrUrl !== "string") return false;
    const lower = fileNameOrUrl.toLowerCase();
    return lower.includes(".pdf") || /\.pdf(\?|$|#)/i.test(fileNameOrUrl);
  };

  const fixCloudinaryUrlForPdf = (url: string): string => {
    if (!url || typeof url !== "string") return url;
    if (
      url.includes("cloudinary.com") &&
      url.includes("/image/upload/") &&
      isPdfFile(url)
    ) {
      return url;
    }
    return url;
  };

  const removeOccupantPassport = (index: number) => {
    setOccupantPassportFiles((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setOccupantPreviews((prev) => {
      const next = [...prev];
      revokePreviewEntry(next[index]);
      next[index] = null;
      return next;
    });
  };

  const handleOccupantPassportChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(file.type === "application/pdf" || file.type.startsWith("image/"))) {
      toast({
        title: "Erreur",
        description:
          "Format de fichier non supporté. Seuls les fichiers PDF et images sont acceptés.",
        variant: "destructive",
      });
      return;
    }
    setOccupantPassportFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
    setOccupantPreviews((prev) => {
      const next = [...prev];
      revokePreviewEntry(next[index]);
      next[index] = null;
      return next;
    });
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOccupantPreviews((p) => {
          const x = [...p];
          revokePreviewEntry(x[index]);
          x[index] = { url: reader.result as string, type: file.type };
          return x;
        });
      };
      reader.readAsDataURL(file);

      void (async () => {
        setOcrProcessingIndex(index);
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/passport-ocr", {
            method: "POST",
            body: fd,
          });
          const json = (await res.json()) as {
            status?: string;
            data?: OcrExtractData;
            error?: string;
          };
          if (!res.ok) {
            throw new Error(json.error || "Service OCR indisponible");
          }
          const raw = json.data || {};
          setOcrValidation({
            occupantIndex: index,
            firstName: String(raw.first_name ?? "").trim(),
            lastName: String(raw.last_name ?? "").trim(),
            passport: String(
              raw.passport ?? raw.personal_id_number ?? ""
            ).trim(),
            sex: typeof raw.sex === "string" ? raw.sex : undefined,
          });
        } catch (err) {
          toast({
            title: "Lecture automatique du passeport",
            description:
              err instanceof Error
                ? err.message
                : "Impossible d’analyser l’image. Vous pouvez saisir les champs manuellement.",
            variant: "destructive",
          });
        } finally {
          setOcrProcessingIndex(null);
        }
      })();
    } else {
      setOccupantPreviews((p) => {
        const x = [...p];
        x[index] = { url: URL.createObjectURL(file), type: file.type };
        return x;
      });
    }
  };

  const applyOcrValidation = () => {
    if (!ocrValidation) return;
    const { occupantIndex, firstName, lastName, passport, sex } = ocrValidation;
    updateOccupant(occupantIndex, "lastName", lastName);
    updateOccupant(occupantIndex, "firstName", firstName);
    updateOccupant(occupantIndex, "passportNumber", passport);
    const g = mapOcrSexToGender(sex);
    if (g) {
      if (occupantIndex === 0) {
        setFormData((p) => ({ ...p, gender: g }));
      } else {
        updateOccupant(occupantIndex, "gender", g);
      }
    }
    setOcrValidation(null);
    toast({
      title: "Données appliquées",
      description:
        occupantIndex === 0
          ? "Identité du leader mise à jour depuis le passeport."
          : `Identité de l’accompagnant ${occupantIndex} mise à jour.`,
    });
  };

  const setPaymentField = (
    index: number,
    field: keyof PaymentRow,
    value: string | File | null
  ) => {
    setPayments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value } as PaymentRow;
      return next;
    });
  };

  const clearPaymentReceipt = (index: number) => {
    setPayments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], receipt: null };
      return next;
    });
    setPaymentPreviews((prev) => {
      const next = [...prev];
      revokePreviewEntry(next[index]);
      next[index] = null;
      return next;
    });
  };

  const handlePaymentReceiptChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(file.type === "application/pdf" || file.type.startsWith("image/"))) {
      toast({
        title: "Erreur",
        description:
          "Format de fichier non supporté. Seuls les fichiers PDF et images sont acceptés.",
        variant: "destructive",
      });
      return;
    }
    setPayments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], receipt: file };
      return next;
    });
    setPaymentPreviews((prev) => {
      const next = [...prev];
      revokePreviewEntry(next[index]);
      next[index] = null;
      return next;
    });
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentPreviews((p) => {
          const x = [...p];
          revokePreviewEntry(x[index]);
          x[index] = { url: reader.result as string, type: file.type };
          return x;
        });
      };
      reader.readAsDataURL(file);
    } else {
      setPaymentPreviews((p) => {
        const x = [...p];
        x[index] = { url: URL.createObjectURL(file), type: file.type };
        return x;
      });
    }
  };

  const canGeneratePaymentReceipt = (index: number) => {
    const payment = payments[index];
    if (!payment) return false;
    const amount = Number(payment.amount);
    const leader = occupants[0];
    return Boolean(
      payment.type &&
      !Number.isNaN(amount) &&
      amount > 0 &&
      leader?.firstName?.trim() &&
      leader?.lastName?.trim() &&
      leader?.phone?.trim()
    );
  };

  const handleGeneratePaymentReceipt = async (index: number) => {
    if (!canGeneratePaymentReceipt(index)) return;
    const payment = payments[index];
    const leader = occupants[0];
    if (!payment || !leader) return;

    const amount = Number(payment.amount) || 0;
    const paymentDate = new Date().toISOString().slice(0, 10);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le reçu pour le moment.",
        variant: "destructive",
      });
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 42px Arial";
    ctx.fillText("Recu de paiement", 60, 100);
    ctx.fillStyle = "#4b5563";
    ctx.font = "22px Arial";
    ctx.fillText(`Date: ${paymentDate}`, 60, 150);
    ctx.fillText(`Programme: ${formData.programme || "-"}`, 60, 190);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 28px Arial";
    ctx.fillText("Client", 60, 265);
    ctx.font = "22px Arial";
    ctx.fillText(`Nom complet: ${leader.lastName} ${leader.firstName}`, 60, 310);
    ctx.fillText(`Telephone: ${leader.phone}`, 60, 345);
    ctx.font = "bold 28px Arial";
    ctx.fillText("Paiement", 60, 430);
    ctx.font = "22px Arial";
    ctx.fillText(`Type: ${payment.type}`, 60, 475);
    ctx.fillText(`Montant: ${amount.toLocaleString("fr-FR")} DH`, 60, 510);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) {
      toast({
        title: "Erreur",
        description: "Generation du recu echouee.",
        variant: "destructive",
      });
      return;
    }

    const file = new File([blob], `recu-${Date.now()}.png`, { type: "image/png" });
    setPaymentField(index, "receipt", file);
    setPaymentPreviews((prev) => {
      const next = [...prev];
      revokePreviewEntry(next[index]);
      next[index] = { url: URL.createObjectURL(file), type: file.type };
      return next;
    });
    toast({
      title: "Recu genere",
      description: "Le recu est attache et sera enregistre avec la reservation.",
    });
  };

  const addPaymentRow = () => {
    setPayments((prev) => [...prev, { amount: "", type: "", receipt: null }]);
    setPaymentPreviews((prev) => [...prev, null]);
  };

  const removePaymentRow = (index: number) => {
    setPaymentPreviews((prev) => {
      const p = prev[index];
      revokePreviewEntry(p);
      return prev.filter((_, i) => i !== index);
    });
    setPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const sortedRoomCandidatesMadina = useMemo(
    () => [...roomCandidatesMadina].sort((a, b) => a.id - b.id),
    [roomCandidatesMadina]
  );
  const sortedRoomCandidatesMakkah = useMemo(
    () => [...roomCandidatesMakkah].sort((a, b) => a.id - b.id),
    [roomCandidatesMakkah]
  );

  // Auto-sélection de la première chambre disponible à Madina
  useEffect(() => {
    if (sortedRoomCandidatesMadina.length > 0) {
      setRoomMadinaId((prev) => {
        const stillValid = sortedRoomCandidatesMadina.some(
          (r) => String(r.id) === prev
        );
        return stillValid ? prev : String(sortedRoomCandidatesMadina[0].id);
      });
    } else {
      setRoomMadinaId("");
    }
  }, [sortedRoomCandidatesMadina]);

  // Auto-sélection de la première chambre disponible à Makkah
  useEffect(() => {
    if (sortedRoomCandidatesMakkah.length > 0) {
      setRoomMakkahId((prev) => {
        const stillValid = sortedRoomCandidatesMakkah.some(
          (r) => String(r.id) === prev
        );
        return stillValid ? prev : String(sortedRoomCandidatesMakkah[0].id);
      });
    } else {
      setRoomMakkahId("");
    }
  }, [sortedRoomCandidatesMakkah]);

  const prixGenere =
    calculatePrice > 0 &&
    String(formData.prix || "").trim() !== "" &&
    Number(formData.prix) > 0;

  /** Minimum pour activer « Confirmer la Réservation » : leader (nom, prénom, n° tel.) + chaque accompagnant (nom, prénom). La barre prix s’affiche dès que le prix est calculé. */
  const minimumIdentityForConfirm =
    occupants.length === capacity &&
    capacity >= 2 &&
    occupants.every((o, i) => {
      const fn = (o.firstName || "").trim();
      const ln = (o.lastName || "").trim();
      if (i === 0) {
        const ph = (o.phone || "").trim();
        return fn.length > 0 && ln.length > 0 && ph.length > 0;
      }
      return fn.length > 0 && ln.length > 0;
    });

  const champsIdentiteOk =
    occupants.length === capacity &&
    capacity >= 2 &&
    occupants.every((o, i) => {
      const fn = (o.firstName || "").trim();
      const ln = (o.lastName || "").trim();
      const pp = (o.passportNumber || "").trim();
      if (i === 0) {
        const ph = (o.phone || "").trim();
        return Boolean(fn && ln && ph && PHONE_REGEX.test(ph) && PASSPORT_REGEX.test(pp));
      }
      return Boolean(fn && ln && PASSPORT_REGEX.test(pp));
    });

  const canSubmit =
    !!formData.programId &&
    !!formData.typeChambre &&
    capacity >= 2 &&
    !!formData.hotelMadina &&
    !!formData.hotelMakkah &&
    !!roomMadinaId &&
    !!roomMakkahId &&
    prixGenere &&
    champsIdentiteOk &&
    occupantPassportFiles.length === capacity &&
    occupantPassportFiles.every(Boolean);
  const propositionInvalid =
    prixMode === "proposition" &&
    prixPropose !== null &&
    prixPropose < calculatePrice;

  /** Brouillon non sauvegardé : navigation ou fermeture d’onglet avec confirmation */
  const hasUnsavedDraft = useMemo(() => {
    if (loading) return false;

    const fd = formData;
    if (fd.programId || fd.programme.trim()) return true;
    if (fd.typeChambre) return true;
    if (fd.hotelMadina || fd.hotelMakkah) return true;
    if (String(fd.prix || "").trim()) return true;

    if (
      occupants.some(
        (o) =>
          `${o.firstName}${o.lastName}${o.phone}${o.passportNumber}`.trim().length >
          0
      )
    )
      return true;

    if (occupantPassportFiles.some(Boolean)) return true;

    if (paidAmount.trim()) return true;

    if (payments.some((p) => (p.amount || "").trim() || p.receipt)) return true;

    if (
      leaderMeta.groupe.trim() ||
      leaderMeta.remarque.trim() ||
      leaderMeta.transport
    )
      return true;

    if (!familyMixed) return true;

    if (reduction > 0 || prixMode !== null || prixPropose !== null) return true;

    if (
      supplierStatus.statutVisa ||
      supplierStatus.statutVol ||
      supplierStatus.statutHotel
    )
      return true;

    if (
      customization.plan !== "Normal" ||
      !customization.includeAvion ||
      !customization.includeVisa
    )
      return true;

    if (
      programInfo &&
      (customization.joursMadina !== programInfo.nbJoursMadina ||
        customization.joursMakkah !== programInfo.nbJoursMakkah)
    )
      return true;

    return false;
  }, [
    loading,
    formData,
    occupants,
    occupantPassportFiles,
    paidAmount,
    payments,
    leaderMeta,
    familyMixed,
    reduction,
    prixMode,
    prixPropose,
    supplierStatus,
    customization,
    programInfo,
  ]);

  useEffect(() => {
    if (!hasUnsavedDraft) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedDraft]);

  useEffect(() => {
    if (!hasUnsavedDraft) return;
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const el = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!el) return;
      if (el.hasAttribute("data-skip-unsaved-prompt")) return;
      const a = el as HTMLAnchorElement;
      const href = a.getAttribute("href");
      if (!href || href === "#" || href.startsWith("javascript:")) return;
      if (a.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      if (!window.confirm(LEAVE_UNSAVED_CONFIRM_FR)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [hasUnsavedDraft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const leaderPhone = (occupants[0]?.phone || "").trim();
    if (!PHONE_REGEX.test(leaderPhone)) {
      toast({
        title: "Téléphone invalide",
        description: "Format attendu: +XXX XXXXXXXXX (ex: +212 123456789).",
        variant: "destructive",
      });
      return;
    }
    const invalidPassportIndex = occupants.findIndex(
      (o) => !PASSPORT_REGEX.test((o.passportNumber || "").trim())
    );
    if (invalidPassportIndex !== -1) {
      toast({
        title: "Passeport invalide",
        description: `Format attendu: 2 lettres + 7 chiffres (ex: AB1234567) pour ${invalidPassportIndex === 0 ? "le leader" : `l’accompagnant ${invalidPassportIndex}`}.`,
        variant: "destructive",
      });
      return;
    }
    if (!canSubmit) {
      const filesMissing =
        occupantPassportFiles.length !== capacity ||
        !occupantPassportFiles.every(Boolean);
      if (filesMissing) {
        toast({
          title: "Passeports manquants",
          description:
            "Joignez un fichier passeport (PDF ou image) pour chaque personne avant de confirmer.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Formulaire incomplet",
          description:
            "Vérifiez le format du téléphone du leader, les numéros de passeport et le prix.",
          variant: "destructive",
        });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const totalPayments = payments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      );
      const leaderOccupants = occupants.map((o, i) =>
        i === 0 ? { ...o, gender: formData.gender } : o
      );

      const groupRes = await api.request(
        api.url(api.endpoints.reservationGroup),
        {
          method: "POST",
          body: JSON.stringify({
            groupId: crypto.randomUUID(),
            typeReservation: "CHAMBRE_PRIVEE",
            familyMixed,
            roomType: formData.typeChambre,
            roomMadinaId: Number(roomMadinaId),
            roomMakkahId: Number(roomMakkahId),
            reservationDate: formData.dateReservation,
            leaderPrice: Number(formData.prix),
            leaderPaidAmount: Number(paidAmount || totalPayments || 0),
            occupants: leaderOccupants,
            common: {
              programId: Number(formData.programId),
              hotelMadina: hotelNameMadina,
              hotelMakkah: hotelNameMakkah,
              status: "Incomplet",
              statutPasseport: true,
              statutVisa: supplierStatus.statutVisa,
              statutHotel: supplierStatus.statutHotel,
              statutVol: supplierStatus.statutVol,
              reduction: prixMode === "reduction" ? reduction || 0 : 0,
              plan: customization.plan,
              groupe: leaderMeta.groupe || null,
              remarque: leaderMeta.remarque || null,
              transport: leaderMeta.transport ? "Oui" : null,
            },
          }),
        }
      );

      if (!groupRes.ok) {
        const err = await groupRes.json().catch(() => ({}));
        throw new Error(err.error || "Erreur création dossier chambre");
      }

      const groupData = await groupRes.json();
      const leaderId = Number(groupData.leaderId);
      const createdReservations = Array.isArray(groupData.reservations)
        ? groupData.reservations
        : [];
      if (!leaderId || createdReservations.length !== occupants.length) {
        throw new Error(
          "Création partielle du groupe détectée, impossible de rattacher les documents."
        );
      }

      // 1) Upload passeport pour chaque membre (lié à son ID de réservation)
      await Promise.all(
        createdReservations.map(async (reservation: { id: number }, index: number) => {
          const passportFile = occupantPassportFiles[index];
          if (!passportFile) return;
          const fd = new FormData();
          fd.append("file", passportFile);
          fd.append("reservationId", String(reservation.id));
          fd.append("fileType", "passport");
          const uploadRes = await fetch(api.url(api.endpoints.uploadCloudinary), {
            method: "POST",
            body: fd,
          });
          if (!uploadRes.ok) {
            const uploadErr = await uploadRes.json().catch(() => ({}));
            throw new Error(
              uploadErr.error ||
                `Erreur upload passeport du membre ${index + 1}`
            );
          }
        })
      );

      // 2) Paiements liés au leader
      for (const payment of payments) {
        if (!payment.amount || !payment.type) continue;
        let fichierId: number | null = null;
        if (payment.receipt) {
          const fd = new FormData();
          fd.append("file", payment.receipt);
          fd.append("reservationId", String(leaderId));
          fd.append("fileType", "payment");
          const uploadRes = await fetch(api.url(api.endpoints.uploadCloudinary), {
            method: "POST",
            body: fd,
          });
          if (!uploadRes.ok) {
            const uploadErr = await uploadRes.json().catch(() => ({}));
            throw new Error(uploadErr.error || "Erreur upload reçu paiement");
          }
          const data = await uploadRes.json();
          fichierId = data?.results?.[0]?.id ?? null;
        }

        const paymentRes = await api.request(api.url(api.endpoints.payments), {
          method: "POST",
          body: JSON.stringify({
            amount: parseFloat(payment.amount),
            type: payment.type,
            reservationId: leaderId,
            fichierId: fichierId || undefined,
            programId: Number(formData.programId),
          }),
        });
        if (!paymentRes.ok) {
          const paymentErr = await paymentRes.json().catch(() => ({}));
          throw new Error(paymentErr.error || "Erreur création paiement leader");
        }
      }

      // 3) Expenses pour chaque membre (leader + accompagnants)
      if (programInfo) {
        const roomMadina = programInfo.rooms.find((r) => r.id === Number(roomMadinaId));
        const roomMakkah = programInfo.rooms.find((r) => r.id === Number(roomMakkahId));
        for (let index = 0; index < createdReservations.length; index++) {
          const reservation = createdReservations[index];
          const occupant = leaderOccupants[index];
          const fullName = `${occupant?.firstName || ""} ${
            occupant?.lastName || ""
          }`.trim();
          const expensePayloads: Array<{
            description: string;
            amount: number;
            type: string;
            fichierId?: number;
          }> = [];

          if (customization.includeAvion) {
            expensePayloads.push({
              description: `Service de vol pour ${fullName}`,
              amount: programInfo.prixAvionDH,
              type: "Vol",
            });
          }
          if (customization.includeVisa) {
            expensePayloads.push({
              description: `Service de visa pour ${fullName}`,
              amount: programInfo.prixVisaRiyal * programInfo.exchange,
              type: "Visa",
            });
          }
          if (roomMadina) {
            expensePayloads.push({
              description: `Service hôtel Madina pour ${fullName}`,
              amount:
                (roomMadina.prixRoom * customization.joursMadina * programInfo.exchange) /
                Math.max(1, capacity),
              type: "Hotel Madina",
            });
          }
          if (roomMakkah) {
            expensePayloads.push({
              description: `Service hôtel Makkah pour ${fullName}`,
              amount:
                (roomMakkah.prixRoom * customization.joursMakkah * programInfo.exchange) /
                Math.max(1, capacity),
              type: "Hotel Makkah",
            });
          }

          for (const expense of expensePayloads) {
            const expenseRes = await api.request(api.url(api.endpoints.expenses), {
              method: "POST",
              body: JSON.stringify({
                description: expense.description,
                amount: expense.amount,
                date: new Date().toISOString(),
                type: expense.type,
                fichierId: expense.fichierId,
                programId: Number(formData.programId),
                reservationId: reservation.id,
              }),
            });
            if (!expenseRes.ok) {
              const expenseErr = await expenseRes.json().catch(() => ({}));
              throw new Error(
                expenseErr.error || `Erreur création expense ${expense.type}`
              );
            }
          }
        }
      }

      // 4) Patch statuts leader
      const patchRes = await api.request(`/api/reservations/${leaderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          statutPasseport: true,
          statutVisa: supplierStatus.statutVisa,
          statutHotel: supplierStatus.statutHotel,
          statutVol: supplierStatus.statutVol,
        }),
      });
      if (!patchRes.ok) {
        const patchErr = await patchRes.json().catch(() => ({}));
        throw new Error(patchErr.error || "Erreur mise à jour statuts leader");
      }

      toast({
        title: "Succès",
        description: "Dossier chambre privée créé avec passeports et paiements leader.",
      });
      router.push("/reservations");
    } catch (error) {
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Erreur lors de la création du dossier",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement des programmes…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <div className="grid grid-cols-1 gap-6">
          <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm h-full">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4">
              <CardTitle className="text-xl flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6" />
                  Nouvelle Chambre Privée / Familiale
                </div>
                {calculatePrice > 0 && (
                  <div
                    className={`flex items-center gap-2 backdrop-blur-sm px-3 py-1.5 rounded-lg border-2 border-emerald-300 bg-emerald-50 shadow-lg`}
                  >
                    <Wallet className="h-4 w-4 text-emerald-800" />
                    <span className="text-sm font-medium text-emerald-800">
                      Prix suggéré:
                    </span>
                    <span className="text-lg font-bold text-emerald-900">
                      {formData.prix
                        ? parseInt(formData.prix, 10).toLocaleString("fr-FR")
                        : calculatePrice.toLocaleString("fr-FR")}{" "}
                      DH
                    </span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Configuration du Voyage
                    </h3>
                    {formData.programId && programInfo && (
                      <Button
                        type="button"
                        onClick={() => setIsCustomizationOpen(!isCustomizationOpen)}
                        variant="ghost"
                        size="sm"
                        className="text-blue-700 hover:bg-blue-200 hover:text-blue-800"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        {isCustomizationOpen ? "Masquer" : "Éditer"}
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label className="text-blue-700 font-medium text-sm">
                        Programme *
                      </Label>
                      <Select
                        value={formData.programme}
                        onValueChange={(value) => {
                          const p = programs.find((x) => x.name === value);
                          setFormData((prev) => ({
                            ...prev,
                            programme: value,
                            programId: p?.id.toString() || "",
                            hotelMadina: "",
                            hotelMakkah: "",
                          }));
                          setRoomMadinaId("");
                          setRoomMakkahId("");
                        }}
                      >
                        <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                          <SelectValue placeholder="Sélectionner un programme" />
                        </SelectTrigger>
                        <SelectContent>
                          {programs.map((program) => (
                            <SelectItem key={program.id} value={program.name}>
                              {program.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-blue-700 font-medium text-sm">
                        Type de chambre *
                      </Label>
                      <Select
                        value={formData.typeChambre}
                        onValueChange={(v) => {
                          setFormData((prev) => ({ ...prev, typeChambre: v }));
                          setRoomMadinaId("");
                          setRoomMakkahId("");
                        }}
                      >
                        <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                          <SelectValue placeholder="Capacité de la chambre" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DOUBLE">2 personnes</SelectItem>
                          <SelectItem value="TRIPLE">3 personnes</SelectItem>
                          <SelectItem value="QUAD">4 personnes</SelectItem>
                          <SelectItem value="QUINT">5 personnes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-blue-700 font-medium text-sm">
                        Plan *
                      </Label>
                      <div
                        className={`relative h-10 rounded-lg border-2 border-emerald-300 bg-emerald-50 shadow-md grid grid-cols-3 gap-1 p-1`}
                      >
                        {(Object.keys(planThemes) as Array<
                          keyof typeof planThemes
                        >).map((planKey) => {
                          const theme = planThemes[planKey];
                          const Icon = theme.icon;
                          const isSelected = customization.plan === planKey;
                          return (
                            <button
                              key={planKey}
                              type="button"
                              onClick={() =>
                                setCustomization((prev) => ({
                                  ...prev,
                                  plan: planKey,
                                }))
                              }
                              className={`relative flex items-center justify-center gap-1 rounded-md text-xs font-medium transition-all ${
                                isSelected
                                  ? "bg-white border border-emerald-500 shadow-sm"
                                  : "hover:bg-white/80"
                              }`}
                            >
                              <Icon
                                className={`h-4 w-4 ${isSelected ? "text-emerald-800" : "text-gray-400"}`}
                              />
                              {theme.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label className="text-blue-700 font-medium text-sm">
                        Hôtel à Madina *
                      </Label>
                      <Select
                        value={formData.hotelMadina}
                        onValueChange={(v) => {
                          setFormData((p) => ({ ...p, hotelMadina: v }));
                          setRoomMadinaId("");
                        }}
                        disabled={!formData.programId}
                      >
                        <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                          <SelectValue
                            placeholder={
                              formData.programId
                                ? "Sélectionner un hôtel à Madina"
                                : "Sélectionnez d'abord un programme"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {hotelsMadina.map((h) => (
                            <SelectItem key={h.id} value={h.id.toString()}>
                              {h.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-blue-700 font-medium text-sm">
                        Hôtel à Makkah *
                      </Label>
                      <Select
                        value={formData.hotelMakkah}
                        onValueChange={(v) => {
                          setFormData((p) => ({ ...p, hotelMakkah: v }));
                          setRoomMakkahId("");
                        }}
                        disabled={!formData.programId}
                      >
                        <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                          <SelectValue
                            placeholder={
                              formData.programId
                                ? "Sélectionner un hôtel à Makkah"
                                : "Sélectionnez d'abord un programme"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {hotelsMakkah.map((h) => (
                            <SelectItem key={h.id} value={h.id.toString()}>
                              {h.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                  </div>

                  {isCustomizationOpen && (
                    <div className="mt-4 mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex flex-wrap items-center gap-6">
                        {/* Services */}
                        <div className="flex items-center gap-6">
                          <span className="text-sm font-semibold text-blue-700">Services:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">✈️</span>
                            <span className="text-sm font-medium text-blue-700">Avion</span>
                            <Switch
                              checked={customization.includeAvion}
                              onCheckedChange={(c) =>
                                setCustomization((p) => ({ ...p, includeAvion: c }))
                              }
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📄</span>
                            <span className="text-sm font-medium text-blue-700">Visa</span>
                            <Switch
                              checked={customization.includeVisa}
                              onCheckedChange={(c) =>
                                setCustomization((p) => ({ ...p, includeVisa: c }))
                              }
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">👥</span>
                            <span className="text-sm font-medium text-blue-700">Famille mixte</span>
                            <Switch
                              checked={familyMixed}
                              onCheckedChange={setFamilyMixed}
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>
                        </div>
                        {/* Séparateur */}
                        <div className="w-px h-8 bg-blue-300 hidden md:block" />
                        {/* Durée */}
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-semibold text-blue-700">Durée:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🕌</span>
                            <span className="text-sm font-medium text-blue-700">Madina</span>
                            <Input
                              type="number"
                              min="0"
                              value={customization.joursMadina}
                              onChange={(e) =>
                                setCustomization((p) => ({
                                  ...p,
                                  joursMadina: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="w-16 h-8 text-xs border border-blue-200 focus:border-blue-500 rounded text-center"
                              placeholder="Jours"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🕋</span>
                            <span className="text-sm font-medium text-blue-700">Makkah</span>
                            <Input
                              type="number"
                              min="0"
                              value={customization.joursMakkah}
                              onChange={(e) =>
                                setCustomization((p) => ({
                                  ...p,
                                  joursMakkah: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="w-16 h-8 text-xs border border-blue-200 focus:border-blue-500 rounded text-center"
                              placeholder="Jours"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.programId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-green-700" />
                        <span className="text-xs font-medium text-green-700">
                          Chambres disponibles à Madina (libres uniquement)
                        </span>
                      </div>
                      <div className="grid gap-2">
                        {sortedRoomCandidatesMadina.map((room) => (
                          <div
                            key={room.id}
                            className={`p-2 rounded border cursor-pointer transition-all ${
                              roomMadinaId === String(room.id)
                                ? "border-yellow-400 bg-yellow-50"
                                : "border-gray-300 bg-white hover:border-blue-300"
                            }`}
                            onClick={() => setRoomMadinaId(String(room.id))}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium">
                                Room #{room.id} - {room.gender}
                              </span>
                              <span className="text-xs text-gray-600">
                                ({room.nbrPlaceRestantes}/{room.nbrPlaceTotal})
                              </span>
                            </div>
                            <div className="flex gap-1.5">
                              {Array.from({ length: room.nbrPlaceTotal }, (_, idx) => {
                                const placesOccupees =
                                  room.nbrPlaceTotal - room.nbrPlaceRestantes;
                                const isSelectedRoom =
                                  roomMadinaId === String(room.id);
                                const litReserve =
                                  isSelectedRoom &&
                                  idx >= placesOccupees &&
                                  idx < placesOccupees + capacity;
                                let placeColor = "bg-gray-300";
                                if (idx < placesOccupees)
                                  placeColor = "bg-red-500";
                                else if (litReserve) placeColor = "bg-yellow-400";
                                else placeColor = "bg-green-500";
                                return (
                                  <div
                                    key={idx}
                                    className={`w-4 h-4 rounded-full ${placeColor}`}
                                    title={`Place ${idx + 1}`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-green-700" />
                        <span className="text-xs font-medium text-green-700">
                          Chambres disponibles à Makkah (libres uniquement)
                        </span>
                      </div>
                      <div className="grid gap-2">
                        {sortedRoomCandidatesMakkah.map((room) => (
                          <div
                            key={room.id}
                            className={`p-2 rounded border cursor-pointer transition-all ${
                              roomMakkahId === String(room.id)
                                ? "border-yellow-400 bg-yellow-50"
                                : "border-gray-300 bg-white hover:border-blue-300"
                            }`}
                            onClick={() => setRoomMakkahId(String(room.id))}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium">
                                Room #{room.id} - {room.gender}
                              </span>
                              <span className="text-xs text-gray-600">
                                ({room.nbrPlaceRestantes}/{room.nbrPlaceTotal})
                              </span>
                            </div>
                            <div className="flex gap-1.5">
                              {Array.from({ length: room.nbrPlaceTotal }, (_, idx) => {
                                const placesOccupees =
                                  room.nbrPlaceTotal - room.nbrPlaceRestantes;
                                const isSelectedRoom =
                                  roomMakkahId === String(room.id);
                                const litReserve =
                                  isSelectedRoom &&
                                  idx >= placesOccupees &&
                                  idx < placesOccupees + capacity;
                                let placeColor = "bg-gray-300";
                                if (idx < placesOccupees)
                                  placeColor = "bg-red-500";
                                else if (litReserve) placeColor = "bg-yellow-400";
                                else placeColor = "bg-green-500";
                                return (
                                  <div
                                    key={idx}
                                    className={`w-4 h-4 rounded-full ${placeColor}`}
                                    title={`Place ${idx + 1}`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-2">
                  <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informations Client
                  </h3>
                  {occupants.map((o, i) => (
                    <div key={i} className="mb-4 p-4 rounded-lg border border-blue-200 bg-white/80">
                      <div className="text-xs font-semibold text-blue-700 flex items-center gap-2 mb-3">
                        <User className="h-4 w-4" />
                        {i === 0 ? "Leader" : `Accompagnant ${i}`}
                      </div>

                      {i === 0 ? (
                        /* ── Leader: inputs gauche 50% / passeport droite 50% ── */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Colonne gauche : tous les inputs */}
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-blue-700">Nom *</Label>
                                <Input
                                  placeholder="Nom"
                                  value={o.lastName}
                                  onChange={(e) => updateOccupant(i, "lastName", e.target.value)}
                                  className="h-10 border-2 border-blue-100 focus:border-blue-400"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-blue-700">Prénom *</Label>
                                <Input
                                  placeholder="Prénom"
                                  value={o.firstName}
                                  onChange={(e) => updateOccupant(i, "firstName", e.target.value)}
                                  className="h-10 border-2 border-blue-100 focus:border-blue-400"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-blue-700">Téléphone *</Label>
                                <Input
                                  placeholder="Téléphone"
                                  value={o.phone}
                                  onChange={(e) => updateOccupant(i, "phone", e.target.value)}
                                  inputMode="numeric"
                                  maxLength={14}
                                  className="h-10 border-2 border-blue-100 focus:border-blue-400"
                                />
                                <p className="text-[11px] text-blue-600">Format: +XXX XXXXXXXXX</p>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-blue-700">Groupe</Label>
                                <Input
                                  placeholder="Groupe (optionnel)"
                                  value={leaderMeta.groupe}
                                  onChange={(e) =>
                                    setLeaderMeta((prev) => ({ ...prev, groupe: e.target.value }))
                                  }
                                  className="h-10 border-2 border-blue-100 focus:border-blue-400"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 items-end">
                              <div className="space-y-1">
                                <Label className="text-xs text-blue-700">Genre</Label>
                                <Select
                                  value={formData.gender}
                                  onValueChange={(v) =>
                                    setFormData((p) => ({ ...p, gender: v as "Homme" | "Femme" }))
                                  }
                                >
                                  <SelectTrigger className="h-10 border-2 border-blue-100 focus:border-blue-400">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Homme">Homme</SelectItem>
                                    <SelectItem value="Femme">Femme</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-blue-700">N° Passeport</Label>
                                <Input
                                  placeholder="AB1234567"
                                  value={o.passportNumber}
                                  onChange={(e) =>
                                    updateOccupant(i, "passportNumber", e.target.value)
                                  }
                                  maxLength={9}
                                  className="h-10 border-2 border-blue-100 focus:border-blue-400"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 items-center">
                              <div className="space-y-1">
                                <Label className="text-xs text-blue-700">Transport</Label>
                                <div className="flex items-center gap-2 h-10 px-3 border-2 border-blue-100 rounded-lg bg-white">
                                  <Switch
                                    checked={leaderMeta.transport}
                                    onCheckedChange={(checked) =>
                                      setLeaderMeta((prev) => ({ ...prev, transport: checked }))
                                    }
                                    className="data-[state=checked]:bg-blue-600"
                                  />
                                  <span className="text-sm text-gray-700">
                                    {leaderMeta.transport ? "Oui" : "Non"}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-blue-700">Remarque</Label>
                                <Input
                                  placeholder="Remarque (optionnel)"
                                  value={leaderMeta.remarque}
                                  onChange={(e) =>
                                    setLeaderMeta((prev) => ({ ...prev, remarque: e.target.value }))
                                  }
                                  className="h-10 border-2 border-blue-100 focus:border-blue-400"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Colonne droite : passeport (même UX que Nouvelle Réservation) */}
                          <div className="space-y-2">
                            {!occupantPassportFiles[i] && (
                              <Label className="text-xs text-blue-700 font-medium">
                                Passeport (obligatoire)
                              </Label>
                            )}
                            {!occupantPassportFiles[i] && (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={(e) => handleOccupantPassportChange(i, e)}
                                  className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                                  disabled={isSubmitting || ocrProcessingIndex === i}
                                />
                              </div>
                            )}
                            {ocrProcessingIndex === i && (
                              <p className="text-xs text-blue-600 animate-pulse">
                                Analyse OCR du passeport en cours…
                              </p>
                            )}
                            {occupantPreviews[i] && (
                              <div className="mt-2 p-2 border border-blue-200 rounded-lg bg-white">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                  <span className="text-sm font-medium text-blue-700">
                                    Aperçu du passeport
                                  </span>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded text-sm flex items-center gap-1"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setPreviewImage({
                                          url: occupantPreviews[i]!.url,
                                          title: "Passeport",
                                          type: occupantPreviews[i]!.type,
                                        });
                                      }}
                                    >
                                      <ZoomIn className="h-3 w-3" />
                                      Zoom
                                    </button>
                                    <a
                                      href={occupantPreviews[i]!.url}
                                      download={
                                        occupantPassportFiles[i]?.name || "passeport"
                                      }
                                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded text-sm inline-flex items-center gap-1"
                                    >
                                      <Download className="h-3 w-3" />
                                      Télécharger
                                    </a>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeOccupantPassport(i)}
                                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Supprimer
                                    </Button>
                                  </div>
                                </div>
                                <div className="w-full max-h-36 h-36 overflow-hidden rounded-lg border border-blue-200 bg-slate-50 flex items-center justify-center">
                                  {occupantPreviews[i]?.type === "application/pdf" ? (
                                    occupantPreviews[i]!.url.startsWith("blob:") ||
                                    occupantPreviews[i]!.url.startsWith("data:") ? (
                                      <embed
                                        src={occupantPreviews[i]!.url}
                                        type="application/pdf"
                                        className="w-full h-full min-h-0"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                        <a
                                          href={occupantPreviews[i]!.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex flex-col items-center justify-center gap-1 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                          <FileText className="h-10 w-10 text-red-600" />
                                          <span className="text-xs font-medium text-blue-700">
                                            Voir le PDF
                                          </span>
                                        </a>
                                      </div>
                                    )
                                  ) : (
                                    <img
                                      src={occupantPreviews[i]!.url}
                                      alt="Passeport"
                                      className="max-w-full max-h-full w-auto h-auto object-contain"
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* ── Accompagnant: 50% champs / 50% attachement + aperçu ── */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-blue-700">Nom *</Label>
                                <Input
                                  placeholder="Nom"
                                  value={o.lastName}
                                  onChange={(e) =>
                                    updateOccupant(i, "lastName", e.target.value)
                                  }
                                  className="h-10 border-2 border-blue-100 focus:border-blue-400"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-blue-700">Prénom *</Label>
                                <Input
                                  placeholder="Prénom"
                                  value={o.firstName}
                                  onChange={(e) =>
                                    updateOccupant(i, "firstName", e.target.value)
                                  }
                                  className="h-10 border-2 border-blue-100 focus:border-blue-400"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-blue-700">N° Passeport</Label>
                              <Input
                                placeholder="AB1234567"
                                value={o.passportNumber}
                                onChange={(e) =>
                                  updateOccupant(i, "passportNumber", e.target.value)
                                }
                                maxLength={9}
                                className="h-10 border-2 border-blue-100 focus:border-blue-400"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            {!occupantPassportFiles[i] && (
                              <Label className="text-xs text-blue-700 font-medium">
                                Passeport (obligatoire)
                              </Label>
                            )}
                            {!occupantPassportFiles[i] && (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={(e) => handleOccupantPassportChange(i, e)}
                                  className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg"
                                  disabled={isSubmitting || ocrProcessingIndex === i}
                                />
                              </div>
                            )}
                            {ocrProcessingIndex === i && (
                              <p className="text-xs text-blue-600 animate-pulse">
                                Analyse OCR du passeport en cours…
                              </p>
                            )}
                            {occupantPreviews[i] && (
                              <div className="mt-2 p-2 border border-blue-200 rounded-lg bg-white">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                  <span className="text-sm font-medium text-blue-700">
                                    Aperçu du passeport
                                  </span>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded text-sm flex items-center gap-1"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setPreviewImage({
                                          url: occupantPreviews[i]!.url,
                                          title: `Passeport accompagnant ${i}`,
                                          type: occupantPreviews[i]!.type,
                                        });
                                      }}
                                    >
                                      <ZoomIn className="h-3 w-3" />
                                      Zoom
                                    </button>
                                    <a
                                      href={occupantPreviews[i]!.url}
                                      download={
                                        occupantPassportFiles[i]?.name || "passeport"
                                      }
                                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded text-sm inline-flex items-center gap-1"
                                    >
                                      <Download className="h-3 w-3" />
                                      Télécharger
                                    </a>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeOccupantPassport(i)}
                                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Supprimer
                                    </Button>
                                  </div>
                                </div>
                                <div className="w-full max-h-36 h-36 overflow-hidden rounded-lg border border-blue-200 bg-slate-50 flex items-center justify-center">
                                  {occupantPreviews[i]?.type === "application/pdf" ? (
                                    occupantPreviews[i]!.url.startsWith("blob:") ||
                                    occupantPreviews[i]!.url.startsWith("data:") ? (
                                      <embed
                                        src={occupantPreviews[i]!.url}
                                        type="application/pdf"
                                        className="w-full h-full min-h-0"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                        <a
                                          href={occupantPreviews[i]!.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex flex-col items-center justify-center gap-1 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                          <FileText className="h-10 w-10 text-red-600" />
                                          <span className="text-xs font-medium text-blue-700">
                                            Voir le PDF
                                          </span>
                                        </a>
                                      </div>
                                    )
                                  ) : (
                                    <img
                                      src={occupantPreviews[i]!.url}
                                      alt="Passeport accompagnant"
                                      className="max-w-full max-h-full w-auto h-auto object-contain"
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200 mb-6">
                  <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Paiements
                  </h3>
                  <div className="space-y-4">
                    {payments.map((payment, index) => (
                      <div key={index} className="p-4 border border-orange-200 rounded-lg bg-white/60">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-3 space-y-2">
                            <Label className="text-orange-700 font-medium text-sm">Mode de paiement</Label>
                            <Select
                              value={payment.type}
                              onValueChange={(value) =>
                                setPaymentField(index, "type", value)
                              }
                            >
                              <SelectTrigger className="h-10 border-2 border-orange-200 focus:border-orange-500 rounded-lg">
                                <SelectValue placeholder="Sélectionner paiement" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="especes">Espèces</SelectItem>
                                <SelectItem value="virement">Virement</SelectItem>
                                <SelectItem value="carte">Carte</SelectItem>
                                <SelectItem value="cheque">Chèque</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="md:col-span-3 space-y-2">
                            <Label className="text-orange-700 font-medium text-sm">Montant (DH)</Label>
                            <Input
                              type="text"
                              value={payment.amount}
                              onChange={(e) =>
                                setPaymentField(index, "amount", e.target.value)
                              }
                              placeholder="Montant en dirhams"
                              className="h-10 border-2 border-orange-200 focus:border-orange-500 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <div className="md:col-span-6 space-y-2">
                            {!paymentPreviews[index] && (
                              <Label className="text-orange-700 font-medium text-sm">
                                Reçu de paiement
                              </Label>
                            )}
                            <div className="flex items-center gap-2">
                              {!payment.receipt && (
                                <>
                                  <Input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handlePaymentReceiptChange(index, e)}
                                    className="h-10 border-2 border-orange-200 focus:border-orange-500 rounded-lg"
                                    disabled={isSubmitting}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleGeneratePaymentReceipt(index)}
                                    disabled={isSubmitting || !canGeneratePaymentReceipt(index)}
                                    className="h-10 border-orange-300 text-orange-700 hover:bg-orange-50 whitespace-nowrap"
                                  >
                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                    Generer recu
                                  </Button>
                                </>
                              )}
                            </div>
                            {paymentPreviews[index] && (
                              <div className="w-full p-2 border border-orange-200 rounded-lg bg-white">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                  <span className="text-sm font-medium text-orange-700">
                                    Aperçu du reçu
                                  </span>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      className="text-orange-600 hover:text-orange-800 hover:bg-orange-50 p-2 rounded text-sm flex items-center gap-1"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setPreviewImage({
                                          url: paymentPreviews[index]!.url,
                                          title: "Reçu paiement",
                                          type:
                                            paymentPreviews[index]!.type || "image/*",
                                        });
                                      }}
                                    >
                                      <ZoomIn className="h-3 w-3" />
                                      Zoom
                                    </button>
                                    <a
                                      href={paymentPreviews[index]!.url}
                                      download={
                                        payment.receipt?.name || "recu-paiement"
                                      }
                                      className="text-orange-600 hover:text-orange-800 hover:bg-orange-50 px-2 py-1 rounded text-sm inline-flex items-center gap-1"
                                    >
                                      <Download className="h-3 w-3" />
                                      Télécharger
                                    </a>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => clearPaymentReceipt(index)}
                                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Supprimer
                                    </Button>
                                  </div>
                                </div>
                                <div className="w-full h-[200px] overflow-hidden rounded-lg border border-orange-200">
                                  {paymentPreviews[index]?.type ===
                                  "application/pdf" ? (
                                    paymentPreviews[index]!.url.startsWith("blob:") ||
                                    paymentPreviews[index]!.url.startsWith("data:") ? (
                                      <embed
                                        src={paymentPreviews[index]!.url}
                                        type="application/pdf"
                                        className="w-full h-full"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-orange-50">
                                        <a
                                          href={paymentPreviews[index]!.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex flex-col items-center justify-center gap-2 p-4 hover:bg-orange-100 rounded-lg transition-colors"
                                        >
                                          <FileText className="h-16 w-16 text-red-600" />
                                          <span className="text-sm font-medium text-orange-700">
                                            Voir le PDF
                                          </span>
                                        </a>
                                      </div>
                                    )
                                  ) : (
                                    <img
                                      src={paymentPreviews[index]!.url}
                                      alt="Reçu de paiement"
                                      className="w-full h-full object-contain"
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePaymentRow(index)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer le paiement
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      onClick={addPaymentRow}
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 h-12"
                    >
                      <Plus className="mr-2 h-5 w-5" />
                      Ajouter un paiement
                    </Button>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200 mb-6">
                  <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documents Fournisseur
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    {customization.includeVisa && (
                      <div className="bg-white p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <FileText className="h-4 w-4 text-blue-600" />
                            </div>
                            <Label className="text-purple-700 font-medium">Statut Visa</Label>
                          </div>
                          <Switch
                            checked={supplierStatus.statutVisa}
                            onCheckedChange={(checked) =>
                              setSupplierStatus((prev) => ({ ...prev, statutVisa: checked }))
                            }
                            className="data-[state=checked]:bg-blue-600"
                          />
                        </div>
                        <div className="text-center">
                          <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                            supplierStatus.statutVisa
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            {supplierStatus.statutVisa ? "✅ Prêt" : "⏳ En attente"}
                          </span>
                        </div>
                      </div>
                    )}
                    {customization.includeAvion && (
                      <div className="bg-white p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-green-100 rounded-lg">
                              <FileText className="h-4 w-4 text-green-600" />
                            </div>
                            <Label className="text-purple-700 font-medium">Statut Vol</Label>
                          </div>
                          <Switch
                            checked={supplierStatus.statutVol}
                            onCheckedChange={(checked) =>
                              setSupplierStatus((prev) => ({ ...prev, statutVol: checked }))
                            }
                            className="data-[state=checked]:bg-green-600"
                          />
                        </div>
                        <div className="text-center">
                          <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                            supplierStatus.statutVol
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            {supplierStatus.statutVol ? "✅ Prêt" : "⏳ En attente"}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="bg-white p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            <FileText className="h-4 w-4 text-orange-600" />
                          </div>
                          <Label className="text-purple-700 font-medium">Statut Hôtel</Label>
                        </div>
                        <Switch
                          checked={supplierStatus.statutHotel}
                          onCheckedChange={(checked) =>
                            setSupplierStatus((prev) => ({ ...prev, statutHotel: checked }))
                          }
                          className="data-[state=checked]:bg-orange-600"
                        />
                      </div>
                      <div className="text-center">
                        <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                          supplierStatus.statutHotel
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {supplierStatus.statutHotel ? "✅ Prêt" : "⏳ En attente"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-purple-600 mt-1">
                    Les statuts s'affichent uniquement pour les services activés.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {calculatePrice > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-emerald-200 shadow-2xl z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 bg-emerald-50 border-emerald-300 shadow-lg">
                  <Wallet className="h-4 w-4 text-emerald-800" />
                  <span className="text-sm font-medium text-emerald-700">Total:</span>
                  <span className="font-bold text-emerald-900 text-lg">
                    {(Number(formData.prix || 0) || 0).toLocaleString("fr-FR")} DH
                  </span>
                </div>
                <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-300">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-medium text-gray-600">Réduc.</span>
                    <Switch
                      checked={prixMode === "reduction"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setPrixMode("reduction");
                          setPrixPropose(null);
                        } else {
                          setPrixMode(null);
                          setReduction(0);
                        }
                      }}
                      className="data-[state=checked]:bg-red-500 scale-75"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-medium text-gray-600">Propos.</span>
                    <Switch
                      checked={prixMode === "proposition"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setPrixMode("proposition");
                          setReduction(0);
                        } else {
                          setPrixMode(null);
                          setPrixPropose(null);
                        }
                      }}
                      className="data-[state=checked]:bg-green-500 scale-75"
                    />
                  </div>
                </div>
                {prixMode === "reduction" && (
                  <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                    <X className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Réduction:</span>
                    <Input
                      type="text"
                      value={reduction === 0 ? "" : reduction}
                      onChange={(e) => {
                        const value =
                          e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0;
                        setReduction(Math.min(value, calculatePrice));
                      }}
                      className="w-24 h-7 text-sm border border-red-300 focus:border-red-500 rounded text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                    />
                    <span className="text-sm text-red-600 font-medium">DH</span>
                  </div>
                )}
                {prixMode === "proposition" && (
                  <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                    <ChevronUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Proposition:</span>
                    <Input
                      type="text"
                      value={prixPropose === null ? "" : prixPropose}
                      onChange={(e) => {
                        const value =
                          e.target.value === "" ? null : parseInt(e.target.value, 10) || null;
                        setPrixPropose(value);
                      }}
                      className="w-24 h-7 text-sm border border-green-300 focus:border-green-500 rounded text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder={calculatePrice.toString()}
                    />
                    <span className="text-sm text-green-600 font-medium">DH</span>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                disabled={
                  !minimumIdentityForConfirm ||
                  isSubmitting ||
                  propositionInvalid
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3 text-lg disabled:opacity-50"
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector("form")?.requestSubmit();
                }}
              >
                {isSubmitting ? "Enregistrement..." : "Confirmer la Réservation"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={ocrValidation !== null}
        onOpenChange={(open) => {
          if (!open) setOcrValidation(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Valider les données extraites du passeport</DialogTitle>
            <DialogDescription>
              {ocrValidation &&
                (ocrValidation.occupantIndex === 0
                  ? "Leader : vérifiez le nom, le prénom et le numéro de passeport avant de les appliquer au formulaire."
                  : `Accompagnant ${ocrValidation.occupantIndex} : vérifiez ces informations pour la bonne personne.`)}
            </DialogDescription>
          </DialogHeader>
          {ocrValidation && (
            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="ocr-lastName">Nom</Label>
                <Input
                  id="ocr-lastName"
                  value={ocrValidation.lastName}
                  onChange={(e) =>
                    setOcrValidation((prev) =>
                      prev ? { ...prev, lastName: e.target.value } : null
                    )
                  }
                  placeholder="Nom"
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ocr-firstName">Prénom</Label>
                <Input
                  id="ocr-firstName"
                  value={ocrValidation.firstName}
                  onChange={(e) =>
                    setOcrValidation((prev) =>
                      prev ? { ...prev, firstName: e.target.value } : null
                    )
                  }
                  placeholder="Prénom"
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ocr-passport">N° Passeport</Label>
                <Input
                  id="ocr-passport"
                  value={ocrValidation.passport}
                  onChange={(e) =>
                    setOcrValidation((prev) =>
                      prev ? { ...prev, passport: e.target.value } : null
                    )
                  }
                  placeholder="Numéro de passeport"
                  className="h-10"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOcrValidation(null)}
            >
              Ignorer
            </Button>
            <Button type="button" onClick={applyOcrValidation}>
              OK — Appliquer aux champs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center justify-between">
              <span>{previewImage?.title}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPreviewImage(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-2 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-[calc(90vh-80px)] flex items-center justify-center bg-gray-100 overflow-auto">
            {previewImage && (
              <div className="w-full h-full flex items-center justify-center p-4">
                {previewImage.type === "application/pdf" ? (
                  previewImage.url.startsWith("blob:") ||
                  previewImage.url.startsWith("data:") ? (
                    <embed
                      src={previewImage.url}
                      type="application/pdf"
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 p-8">
                      <FileText className="h-24 w-24 text-red-600" />
                      <a
                        href={fixCloudinaryUrlForPdf(previewImage.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Ouvrir le PDF dans un nouvel onglet
                      </a>
                    </div>
                  )
                ) : (
                  <img
                    src={previewImage.url}
                    alt={previewImage.title}
                    className="max-w-full max-h-full object-contain cursor-zoom-in"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const img = e.currentTarget;
                      if (img.style.transform === "scale(1.5)") {
                        img.style.transform = "scale(1)";
                        img.style.cursor = "zoom-in";
                      } else {
                        img.style.transform = "scale(1.5)";
                        img.style.cursor = "zoom-out";
                      }
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
