"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { generatePaymentReceiptFile } from "@/lib/generateReceipt";
import { BlockersTooltip } from "@/components/blockers-tooltip";
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
  hotelsAutre?: Array<{ hotel: Hotel; nbJours: number; ordre: number }>;
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
  // Hôtels Autre : id de chambre sélectionnée par hôtel (optionnel)
  const [roomAutreIds, setRoomAutreIds] = useState<{ [hotelId: number]: string }>({});

  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [occupantPassportFiles, setOccupantPassportFiles] = useState<
    Array<File | null>
  >([]);
  const [leaderMeta, setLeaderMeta] = useState({
    groupe: "",
    remarque: "",
    transport: false,
  });
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  /** Aperçus locaux alignés sur les index occupants / paiements (comme Nouvelle Réservation) */
  const [occupantPreviews, setOccupantPreviews] = useState<
    Array<{ url: string; type: string } | null>
  >([]);
  const [paymentPreviews, setPaymentPreviews] = useState<
    Array<{ url: string; type: string } | null>
  >([]);
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
  const hotelsAutreProgramme = [...(programmeSelectionne?.hotelsAutre || [])].sort(
    (a, b) => a.ordre - b.ordre
  );

  // Disposition des blocs hôtels : Madina = 1 bloc, Makkah = 1 bloc, chaque Autre = 1 bloc.
  // 1 hôtel → pleine largeur, 2 → côte à côte, 3+ → max 3 par ligne (les suivants passent à la ligne).
  const hotelBlockCount =
    (hotelsMadina.length > 0 ? 1 : 0) +
    (hotelsMakkah.length > 0 ? 1 : 0) +
    hotelsAutreProgramme.length;
  const hotelGridColsClass =
    hotelBlockCount >= 3 ? "md:grid-cols-3" : hotelBlockCount === 2 ? "md:grid-cols-2" : "md:grid-cols-1";

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
        phone: prev[i]?.phone || "+212",
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
    // Garde-fou assoupli : seuls programme + type sont requis. Chaque catégorie
    // d'hôtel (Madina / Makkah / Autre) est optionnelle.
    if (!programInfo || !formData.typeChambre) {
      return 0;
    }

    const roomType = formData.typeChambre;
    const nbPersonnes =
      {
        SINGLE: 1,
        DOUBLE: 2,
        TRIPLE: 3,
        QUAD: 4,
        QUINT: 5,
      }[roomType] || 1;

    const roomMadina = roomMadinaId
      ? programInfo.rooms.find((r) => r.id === Number(roomMadinaId))
      : null;
    const roomMakkah = roomMakkahId
      ? programInfo.rooms.find((r) => r.id === Number(roomMakkahId))
      : null;

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

    // Coût unitaire (par personne) par catégorie, 0 si non sélectionnée
    const prixHotelMadinaUnitaire =
      roomMadina && formData.hotelMadina !== "none"
        ? ((roomMadina.prixRoom || 0) / nbPersonnes) * customization.joursMadina
        : 0;
    const prixHotelMakkahUnitaire =
      roomMakkah && formData.hotelMakkah !== "none"
        ? ((roomMakkah.prixRoom || 0) / nbPersonnes) * customization.joursMakkah
        : 0;

    // Hôtels Autre : Σ (prixRoom / nbPersonnes) * nbJours(hôtel) pour chaque room sélectionnée
    let prixHotelAutreUnitaire = 0;
    for (const ph of hotelsAutreProgramme) {
      const roomIdStr = roomAutreIds[ph.hotel.id];
      if (!roomIdStr) continue;
      const room = programInfo.rooms.find((r) => r.id === Number(roomIdStr));
      if (!room) continue;
      prixHotelAutreUnitaire += ((room.prixRoom || 0) / nbPersonnes) * (ph.nbJours || 0);
    }

    const prixUnitaire =
      prixAvion +
      profit +
      (prixVisa + prixHotelMakkahUnitaire + prixHotelMadinaUnitaire + prixHotelAutreUnitaire) *
        programInfo.exchange;
    const prixFinal = prixUnitaire * nbPersonnes;

    return Math.round(prixFinal);
  }, [
    programInfo,
    formData.typeChambre,
    formData.hotelMadina,
    formData.hotelMakkah,
    roomMadinaId,
    roomMakkahId,
    roomAutreIds,
    programmeSelectionne,
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
    if (field === "amount" && typeof value === "string") {
      const prixSuggere = Number(formData.prix) || 0;

      setPayments((prev) => {
        const next = [...prev];

        if (value.trim() === "") {
          next[index] = { ...next[index], amount: "" } as PaymentRow;
          return next;
        }

        let numericValue = Number(value);
        if (Number.isNaN(numericValue)) return prev;
        if (numericValue < 0) numericValue = 0;

        const sumOther = prev.reduce(
          (sum, p, i) => sum + (i === index ? 0 : Number(p.amount) || 0),
          0
        );

        // Sans prix dossier valide, ne pas plafonner (sinon montant forcé à 0 → saisie impossible)
        const canCapToRemaining = prixSuggere > 0;
        const allowedMax = Math.max(prixSuggere - sumOther, 0);
        const clamped = canCapToRemaining
          ? Math.min(numericValue, allowedMax)
          : numericValue;
        if (canCapToRemaining && numericValue > allowedMax) {
          toast({
            title: "Montant dépasse le prix suggéré",
            description: `Le total des paiements ne doit pas dépasser ${prixSuggere.toLocaleString(
              "fr-FR"
            )} DH.`,
            variant: "destructive",
          });
        }

        next[index] = { ...next[index], amount: String(clamped) } as PaymentRow;
        return next;
      });
      return;
    }

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

  // Champs de la réservation présents sur le reçu professionnel : tant qu'ils ne
  // sont pas remplis, on ne peut ni ajouter de paiement ni générer de reçu.
  const getReservationBlockers = (): string[] => {
    const leader = occupants[0];
    const reasons: string[] = [];
    if (!formData.prix) reasons.push("Le prix n'est pas généré");
    if (!formData.programme?.trim()) reasons.push("Le programme n'est pas sélectionné");
    if (!formData.typeChambre) reasons.push("Le type de chambre n'est pas sélectionné");
    if (!leader?.lastName?.trim()) reasons.push("Le nom du chef de dossier n'est pas saisi");
    if (!leader?.firstName?.trim()) reasons.push("Le prénom du chef de dossier n'est pas saisi");
    if (!leader?.phone?.trim()) reasons.push("Le téléphone du chef de dossier n'est pas saisi");
    return reasons;
  };

  // Raisons pour lesquelles le reçu d'un paiement précis ne peut pas être généré.
  const getPaymentReceiptBlockers = (index: number): string[] => {
    const reasons = getReservationBlockers();
    const payment = payments[index];
    if (!payment?.type) reasons.push("Le mode de paiement n'est pas sélectionné");
    const amount = Number(payment?.amount);
    if (!payment?.amount || Number.isNaN(amount) || amount <= 0) {
      reasons.push("Le montant du paiement n'est pas saisi");
    }
    return reasons;
  };

  const canGeneratePaymentReceipt = (index: number) =>
    getPaymentReceiptBlockers(index).length === 0;

  const handleGeneratePaymentReceipt = async (index: number) => {
    if (!canGeneratePaymentReceipt(index)) return;
    const payment = payments[index];
    const leader = occupants[0];
    if (!payment || !leader) return;

    const prixEngage = Number(formData.prix) || 0;
    const totalPaye = payments.reduce((total, p) => total + (Number(p.amount) || 0), 0);

    let file: File;
    try {
      file = await generatePaymentReceiptFile({
        nom: leader.lastName,
        prenom: leader.firstName,
        telephone: leader.phone,
        passportNumber: leader.passportNumber,
        programme: formData.programme,
        type: payment.type,
        montant: Number(payment.amount) || 0,
        prixEngage,
        typeChambre: formData.typeChambre,
        genre: leader.gender,
        resteAPayer: Math.max(0, prixEngage - totalPaye),
        reservationChambre: occupants.length,
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de générer le reçu pour le moment.",
        variant: "destructive",
      });
      return;
    }
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

  /** Obligatoire pour enregistrer : chef Nom/Prénom/téléphone + chaque accompagnant Nom/Prénom (passeports / fichiers optionnels) */
  const identitiesMinimumOk =
    occupants.length === capacity &&
    capacity >= 2 &&
    occupants.every((o, i) => {
      const fn = (o.firstName || "").trim();
      const ln = (o.lastName || "").trim();
      // Si le document passeport est joint pour cet occupant, son n° devient obligatoire
      const passportNumberOk =
        !occupantPassportFiles[i] ||
        PASSPORT_REGEX.test((o.passportNumber || "").trim());
      if (i === 0) {
        const ph = (o.phone || "").trim();
        return (
          fn.length > 0 && ln.length > 0 && PHONE_REGEX.test(ph) && passportNumberOk
        );
      }
      return fn.length > 0 && ln.length > 0 && passportNumberOk;
    });

  const allPassportFilesProvided =
    occupantPassportFiles.length === capacity &&
    occupantPassportFiles.every(Boolean);

  /** Configuration voyage + prix + identités minimales (sans exiger passeports ni pièces jointes) */
  // Au moins une room (Madina, Makkah OU Autre) doit être sélectionnée
  const hasAnyRoomSelected =
    !!roomMadinaId || !!roomMakkahId || Object.values(roomAutreIds).some(Boolean);
  const canSubmit =
    !!formData.programId &&
    !!formData.typeChambre &&
    capacity >= 2 &&
    hasAnyRoomSelected &&
    prixGenere &&
    identitiesMinimumOk;
  const propositionInvalid =
    prixMode === "proposition" &&
    prixPropose !== null &&
    prixPropose < calculatePrice;

  // Raisons pour lesquelles la chambre ne peut pas encore être enregistrée
  // (miroir de canSubmit + contrainte du prix proposé).
  const getSubmitBlockers = (): string[] => {
    const reasons: string[] = [];
    if (!formData.programId) reasons.push("Le programme n'est pas sélectionné");
    if (!formData.typeChambre) reasons.push("Le type de chambre n'est pas sélectionné");
    else if (capacity < 2) reasons.push("Le type de chambre doit comporter au moins 2 personnes");
    if (!hasAnyRoomSelected) reasons.push("Sélectionnez au moins une chambre (Madina, Makkah ou Autre)");
    if (!prixGenere) reasons.push("Le prix n'est pas généré");

    // Identités des occupants
    if (capacity >= 2 && occupants.length !== capacity) {
      reasons.push(`La chambre doit être complète (${occupants.length}/${capacity} occupants)`);
    }
    occupants.forEach((o, i) => {
      const fn = (o.firstName || "").trim();
      const ln = (o.lastName || "").trim();
      const who = i === 0 ? "chef de dossier" : `accompagnant ${i + 1}`;
      if (!ln) reasons.push(`Le nom du ${who} n'est pas saisi`);
      if (!fn) reasons.push(`Le prénom du ${who} n'est pas saisi`);
      if (i === 0) {
        const ph = (o.phone || "").trim();
        if (!ph) reasons.push("Le téléphone du chef de dossier n'est pas saisi");
        else if (!PHONE_REGEX.test(ph)) reasons.push("Le téléphone du chef de dossier n'est pas valide");
      }
      if (occupantPassportFiles[i] && !PASSPORT_REGEX.test((o.passportNumber || "").trim())) {
        reasons.push(`Le n° de passeport du ${who} est invalide (2 lettres + 7 chiffres)`);
      }
    });

    if (propositionInvalid) reasons.push("Le prix proposé est inférieur au prix calculé");
    return reasons;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const leaderPhone = (occupants[0]?.phone || "").trim();
    if (!leaderPhone) {
      toast({
        title: "Téléphone du leader",
        description: "Indiquez le numéro de téléphone du chef de dossier.",
        variant: "destructive",
      });
      return;
    }
    if (!PHONE_REGEX.test(leaderPhone)) {
      toast({
        title: "Téléphone invalide",
        description:
          "Renseignez l'indicatif et un numéro de 9 chiffres. Format attendu : +XXX XXXXXXXXX (ex: +212 123456789).",
        variant: "destructive",
      });
      return;
    }
    const passportFileWithoutNumber = occupants.findIndex(
      (o, i) =>
        !!occupantPassportFiles[i] &&
        !PASSPORT_REGEX.test((o.passportNumber || "").trim())
    );
    if (passportFileWithoutNumber !== -1) {
      toast({
        title: "N° de passeport requis",
        description:
          passportFileWithoutNumber === 0
            ? "Le passeport du leader est joint : renseignez son numéro (2 lettres + 7 chiffres) avant d'enregistrer."
            : `Le passeport de l'accompagnant ${passportFileWithoutNumber} est joint : renseignez son numéro (2 lettres + 7 chiffres) avant d'enregistrer.`,
        variant: "destructive",
      });
      return;
    }
    if (!canSubmit) {
      toast({
        title: "Formulaire incomplet",
        description:
          "Remplissez la configuration du voyage (prix calculé), les hôtels/chambres, puis le nom, prénom et téléphone du leader ainsi que le nom et prénom de chaque accompagnant.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const totalPayments = payments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      );
    const suggestedPrice = Number(formData.prix) || 0;
    if (suggestedPrice > 0 && totalPayments > suggestedPrice) {
      toast({
        title: "Montant de paiements invalide",
        description: `Le total des paiements (${totalPayments.toLocaleString(
          "fr-FR"
        )} DH) dépasse le prix suggéré (${suggestedPrice.toLocaleString(
          "fr-FR"
        )} DH).`,
        variant: "destructive",
      });
      return;
    }

      // Déterminer le statut de la chambre (appliqué au leader ET à tous les accompagnants
      // via common.status). Passeports requis pour TOUS les occupants + visa/hôtel/vol
      // fournisseur + paiement >= prix.
      const allDocsAttached =
        allPassportFilesProvided &&
        supplierStatus.statutVisa &&
        supplierStatus.statutHotel &&
        supplierStatus.statutVol;
      const roomPrice = Number(formData.prix) || 0;
      const roomPaid = Number(paidAmount || totalPayments || 0);
      const isPaid = roomPrice > 0 && roomPaid >= roomPrice;
      const reservationStatus = allDocsAttached && isPaid ? "Complet" : "Incomplet";

      // Snapshot des hôtels Autre sélectionnés : [{ hotelId, roomId, hotelName }]
      const autreSnapshot = hotelsAutreProgramme
        .filter((ph) => !!roomAutreIds[ph.hotel.id])
        .map((ph) => ({
          hotelId: ph.hotel.id,
          roomId: Number(roomAutreIds[ph.hotel.id]),
          hotelName: ph.hotel.name,
        }));

      const leaderOccupants = occupants.map((o, i) => {
        return {
          ...o,
          passportNumber: (o.passportNumber || "").trim() || "",
          phone: leaderPhone,
          gender: i === 0 ? formData.gender : o.gender,
        };
      });

      const groupRes = await api.request(
        api.url(api.endpoints.reservationGroup),
        {
          method: "POST",
          body: JSON.stringify({
            groupId: crypto.randomUUID(),
            typeReservation: "CHAMBRE_PRIVEE",
            familyMixed,
            roomType: formData.typeChambre,
            roomMadinaId: roomMadinaId ? Number(roomMadinaId) : null,
            roomMakkahId: roomMakkahId ? Number(roomMakkahId) : null,
            roomAutreIds: autreSnapshot.map((e) => e.roomId),
            reservationDate: formData.dateReservation,
            leaderPrice: Number(formData.prix),
            leaderPaidAmount: Number(paidAmount || totalPayments || 0),
            occupants: leaderOccupants,
            common: {
              programId: Number(formData.programId),
              hotelMadina: hotelNameMadina,
              hotelMakkah: hotelNameMakkah,
              hotelsAutre: autreSnapshot,
              status: reservationStatus,
              statutPasseport: allPassportFilesProvided,
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

      // 2) Paiements liés au leader (en parallèle)
      await Promise.all(
        payments.map(async (payment) => {
          if (!payment.amount || !payment.type) return;
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
        })
      );

      // 3) Expenses pour chaque membre (leader + accompagnants) — en parallèle
      if (programInfo) {
        const roomMadina = programInfo.rooms.find((r) => r.id === Number(roomMadinaId));
        const roomMakkah = programInfo.rooms.find((r) => r.id === Number(roomMakkahId));

        const expenseRequests: Array<{
          description: string;
          amount: number;
          type: string;
          fichierId?: number;
          reservationId: number;
        }> = [];

        for (let index = 0; index < createdReservations.length; index++) {
          const reservation = createdReservations[index];
          const occupant = leaderOccupants[index];
          const fullName = `${occupant?.firstName || ""} ${
            occupant?.lastName || ""
          }`.trim();

          if (customization.includeAvion) {
            expenseRequests.push({
              description: `Service de vol pour ${fullName}`,
              amount: programInfo.prixAvionDH,
              type: "Vol",
              reservationId: reservation.id,
            });
          }
          if (customization.includeVisa) {
            expenseRequests.push({
              description: `Service de visa pour ${fullName}`,
              amount: programInfo.prixVisaRiyal * programInfo.exchange,
              type: "Visa",
              reservationId: reservation.id,
            });
          }
          if (roomMadina) {
            expenseRequests.push({
              description: `Service hôtel Madina pour ${fullName}`,
              amount:
                (roomMadina.prixRoom * customization.joursMadina * programInfo.exchange) /
                Math.max(1, capacity),
              type: "Hotel Madina",
              reservationId: reservation.id,
            });
          }
          if (roomMakkah) {
            expenseRequests.push({
              description: `Service hôtel Makkah pour ${fullName}`,
              amount:
                (roomMakkah.prixRoom * customization.joursMakkah * programInfo.exchange) /
                Math.max(1, capacity),
              type: "Hotel Makkah",
              reservationId: reservation.id,
            });
          }
        }

        await Promise.all(
          expenseRequests.map(async (expense) => {
            const expenseRes = await api.request(api.url(api.endpoints.expenses), {
              method: "POST",
              body: JSON.stringify({
                description: expense.description,
                amount: expense.amount,
                date: new Date().toISOString(),
                type: expense.type,
                fichierId: expense.fichierId,
                programId: Number(formData.programId),
                reservationId: expense.reservationId,
              }),
            });
            if (!expenseRes.ok) {
              const expenseErr = await expenseRes.json().catch(() => ({}));
              throw new Error(
                expenseErr.error || `Erreur création expense ${expense.type}`
              );
            }
          })
        );
      }

      // 4) Patch statuts leader (passeport cohérent avec les fichiers réellement joints)
      const patchRes = await api.request(`/api/reservations/${leaderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          statutPasseport: allPassportFilesProvided,
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
        description: allPassportFilesProvided
          ? "Dossier chambre privée créé (passeports joints)."
          : "Dossier chambre privée créé. Vous pourrez ajouter les passeports plus tard depuis la fiche.",
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
                          setRoomAutreIds({});
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
                          setRoomAutreIds({});
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
                    {hotelsMadina.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-blue-700 font-medium text-sm">
                        Hôtel à Madina
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
                    )}

                    {hotelsMakkah.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-blue-700 font-medium text-sm">
                        Hôtel à Makkah
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
                    )}

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
                    <div className={`grid grid-cols-1 ${hotelGridColsClass} gap-4 mt-2`}>
                    {hotelsMadina.length > 0 && (
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
                    )}
                    {hotelsMakkah.length > 0 && (
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
                    )}
                    {hotelsAutreProgramme.map((ph) => {
                      const hotelId = ph.hotel.id;
                      const candidates = (programInfo?.rooms || [])
                        .filter((room) => {
                          if (room.hotelId !== hotelId || room.roomType !== formData.typeChambre) return false;
                          if (room.nbrPlaceRestantes !== room.nbrPlaceTotal) return false;
                          if (familyMixed) return true;
                          return room.gender === formData.gender || room.gender === "Mixte";
                        })
                        .sort((a, b) => a.id - b.id);
                      return (
                        <div key={hotelId} className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Info className="h-4 w-4 text-emerald-700" />
                            <span className="text-xs font-medium text-emerald-700">
                              {ph.hotel.name} — chambres disponibles (libres uniquement)
                            </span>
                          </div>
                          <div className="grid gap-2">
                            {candidates.length === 0 ? (
                              <div className="text-xs text-gray-500 text-center py-2">Aucune chambre libre</div>
                            ) : (
                              candidates.map((room) => {
                                const selected = roomAutreIds[hotelId] === String(room.id);
                                return (
                                  <div
                                    key={room.id}
                                    className={`p-2 rounded border cursor-pointer transition-all ${
                                      selected
                                        ? "border-yellow-400 bg-yellow-50"
                                        : "border-gray-300 bg-white hover:border-emerald-300"
                                    }`}
                                    onClick={() =>
                                      setRoomAutreIds((prev) => {
                                        const next = { ...prev };
                                        if (next[hotelId] === String(room.id)) delete next[hotelId];
                                        else next[hotelId] = String(room.id);
                                        return next;
                                      })
                                    }
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
                                        const placesOccupees = room.nbrPlaceTotal - room.nbrPlaceRestantes;
                                        const litReserve =
                                          selected && idx >= placesOccupees && idx < placesOccupees + capacity;
                                        let placeColor = "bg-gray-300";
                                        if (idx < placesOccupees) placeColor = "bg-red-500";
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
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                                <div className="flex items-center gap-2">
                                  <div className="relative w-24">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 font-semibold">
                                      +
                                    </span>
                                    <Input
                                      placeholder="212"
                                      value={(o.phone || "").match(/^\+(\d{0,3})/)?.[1] || ""}
                                      onChange={(e) => {
                                        const code = e.target.value.replace(/\D/g, "").slice(0, 3);
                                        const local = ((o.phone || "").replace(/^\+\d{0,3}\s?/, ""))
                                          .replace(/\D/g, "")
                                          .slice(0, 9);
                                        updateOccupant(
                                          i,
                                          "phone",
                                          formatPhoneInput(code || local ? `+${code}${local}` : "")
                                        );
                                      }}
                                      inputMode="numeric"
                                      maxLength={3}
                                      className="h-10 pl-7 border-2 border-blue-100 focus:border-blue-400"
                                    />
                                  </div>
                                  <Input
                                    placeholder="123456789"
                                    value={(o.phone || "").replace(/^\+\d{0,3}\s?/, "")}
                                    onChange={(e) =>
                                      updateOccupant(
                                        i,
                                        "phone",
                                        formatPhoneInput(
                                          `+${
                                            (o.phone || "").match(/^\+(\d{0,3})/)?.[1] || ""
                                          }${e.target.value.replace(/\D/g, "").slice(0, 9)}`
                                        )
                                      )
                                    }
                                    inputMode="numeric"
                                    maxLength={9}
                                    className="h-10 flex-1 border-2 border-blue-100 focus:border-blue-400"
                                  />
                                </div>
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
                                  <BlockersTooltip
                                    blockers={getPaymentReceiptBlockers(index)}
                                    enabledHint="Génère un reçu de paiement professionnel"
                                    title="Reçu indisponible :"
                                  >
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
                                  </BlockersTooltip>
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
                    <BlockersTooltip
                      blockers={getReservationBlockers()}
                      title="Paiement indisponible :"
                      className="block w-full"
                    >
                      <Button
                        type="button"
                        onClick={addPaymentRow}
                        disabled={getReservationBlockers().length > 0}
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 h-12"
                      >
                        <Plus className="mr-2 h-5 w-5" />
                        Ajouter un paiement
                      </Button>
                    </BlockersTooltip>
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

                <div className="flex justify-end gap-3 pt-2">
                  <Link href="/reservations">
                    <Button variant="outline" type="button">
                      Annuler
                    </Button>
                  </Link>
                  <BlockersTooltip
                    blockers={isSubmitting ? [] : getSubmitBlockers()}
                    title="Enregistrement indisponible :"
                  >
                    <Button
                      type="submit"
                      disabled={!canSubmit || isSubmitting || propositionInvalid}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSubmitting ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </BlockersTooltip>
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
              <BlockersTooltip
                blockers={isSubmitting ? [] : getSubmitBlockers()}
                title="Enregistrement indisponible :"
              >
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting || propositionInvalid}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3 text-lg disabled:opacity-50"
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector("form")?.requestSubmit();
                  }}
                >
                  {isSubmitting ? "Enregistrement..." : "Confirmer la Réservation"}
                </Button>
              </BlockersTooltip>
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
