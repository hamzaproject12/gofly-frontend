"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  Sparkles,
  Users,
  User,
  Hotel,
  Wallet,
  CreditCard,
  Settings,
  Info,
  CheckCircle,
  FileText,
  Bell,
  Leaf,
  ShieldCheck,
  Crown,
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

const ROOM_CAPACITY: Record<string, number> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  QUAD: 4,
  QUINT: 5,
};

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
  /** Si l'utilisateur modifie le prix à la main, ne plus l'écraser par le calcul auto */
  const [userEditedPrix, setUserEditedPrix] = useState(false);

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
  const [supplierDocuments, setSupplierDocuments] = useState<{
    visa: File | null;
    flightBooked: File | null;
    hotelBooked: File | null;
  }>({
    visa: null,
    flightBooked: null,
    hotelBooked: null,
  });
  const [payments, setPayments] = useState<PaymentRow[]>([
    { amount: "", type: "", receipt: null },
  ]);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [supplierStatus, setSupplierStatus] = useState({
    statutVisa: false,
    statutVol: false,
    statutHotel: false,
  });
  const [reduction, setReduction] = useState("0");

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
    if (calculatePrice > 0 && !userEditedPrix) {
      setFormData((prev) => ({ ...prev, prix: String(calculatePrice) }));
    }
  }, [calculatePrice, userEditedPrix]);

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
    setOccupants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const setOccupantPassportFile = (index: number, file: File | null) => {
    setOccupantPassportFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
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

  const addPaymentRow = () => {
    setPayments((prev) => [...prev, { amount: "", type: "", receipt: null }]);
  };

  const removePaymentRow = (index: number) => {
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

  const canSubmit =
    !!formData.programId &&
    !!formData.typeChambre &&
    capacity >= 2 &&
    !!formData.hotelMadina &&
    !!formData.hotelMakkah &&
    !!roomMadinaId &&
    !!roomMakkahId &&
    !!formData.prix &&
    occupants.length === capacity &&
    occupants.every((o, i) =>
      i === 0 ? o.firstName && o.lastName && o.phone : o.firstName && o.lastName
    ) &&
    occupantPassportFiles.length === capacity &&
    occupantPassportFiles.every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

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
              reduction: Number(reduction || 0),
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

      // 2) Upload des documents fournisseurs (leader uniquement)
      const uploadedFileIds: Record<string, number | null> = {
        visa: null,
        flightBooked: null,
        hotelBooked: null,
      };
      const uploadSupplierDoc = async (
        field: "visa" | "flightBooked" | "hotelBooked"
      ) => {
        const file = supplierDocuments[field];
        if (!file) return;
        const fd = new FormData();
        fd.append(field, file);
        fd.append("reservationId", String(leaderId));
        const uploadRes = await fetch(api.url(api.endpoints.upload), {
          method: "POST",
          body: fd,
        });
        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.json().catch(() => ({}));
          throw new Error(uploadErr.error || `Erreur upload ${field}`);
        }
        const uploadData = await uploadRes.json();
        uploadedFileIds[field] = uploadData?.files?.[0]?.id ?? null;
      };

      await uploadSupplierDoc("visa");
      await uploadSupplierDoc("flightBooked");
      await uploadSupplierDoc("hotelBooked");

      // 3) Paiements liés au leader
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

      // 4) Expenses leader
      if (programInfo) {
        const expensePayloads: Array<{
          description: string;
          amount: number;
          type: string;
          fichierId?: number;
        }> = [];

        if (customization.includeAvion) {
          expensePayloads.push({
            description: `Service de vol (dossier chambre ${groupData.groupId})`,
            amount: programInfo.prixAvionDH,
            type: "Vol",
            fichierId: uploadedFileIds.flightBooked || undefined,
          });
        }
        if (customization.includeVisa) {
          expensePayloads.push({
            description: `Service de visa (dossier chambre ${groupData.groupId})`,
            amount: programInfo.prixVisaRiyal * programInfo.exchange,
            type: "Visa",
            fichierId: uploadedFileIds.visa || undefined,
          });
        }

        const roomMadina = programInfo.rooms.find((r) => r.id === Number(roomMadinaId));
        const roomMakkah = programInfo.rooms.find((r) => r.id === Number(roomMakkahId));
        if (roomMadina) {
          expensePayloads.push({
            description: `Service hôtel Madina (dossier chambre ${groupData.groupId})`,
            amount:
              roomMadina.prixRoom *
              capacity *
              customization.joursMadina *
              programInfo.exchange,
            type: "Hotel Madina",
            fichierId: uploadedFileIds.hotelBooked || undefined,
          });
        }
        if (roomMakkah) {
          expensePayloads.push({
            description: `Service hôtel Makkah (dossier chambre ${groupData.groupId})`,
            amount:
              roomMakkah.prixRoom *
              capacity *
              customization.joursMakkah *
              programInfo.exchange,
            type: "Hotel Makkah",
            fichierId: uploadedFileIds.hotelBooked || undefined,
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
              reservationId: leaderId,
            }),
          });
          if (!expenseRes.ok) {
            const expenseErr = await expenseRes.json().catch(() => ({}));
            throw new Error(expenseErr.error || `Erreur création expense ${expense.type}`);
          }
        }
      }

      // 5) Patch statuts leader
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
        description:
          "Dossier chambre privée créé avec passeports, paiements et dépenses leader.",
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
              <form onSubmit={handleSubmit} className="space-y-6 pb-24">
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
                        Genre *
                      </Label>
                      <Select
                        value={formData.gender}
                        onValueChange={(v) =>
                          setFormData((prev) => ({
                            ...prev,
                            gender: v as "Homme" | "Femme",
                          }))
                        }
                      >
                        <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Homme">Homme</SelectItem>
                          <SelectItem value="Femme">Femme</SelectItem>
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
                      >
                        <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                          <SelectValue placeholder="Sélectionner un hôtel à Madina" />
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
                      >
                        <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
                          <SelectValue placeholder="Sélectionner un hôtel à Makkah" />
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

                    <div className="space-y-2">
                      <Label className="text-blue-700 font-medium text-sm">
                        Date de réservation *
                      </Label>
                      <Input
                        type="date"
                        value={formData.dateReservation}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            dateReservation: e.target.value,
                          }))
                        }
                        className="h-10 border-2 border-blue-200 rounded-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-blue-700 font-medium text-sm">
                        Prix total dossier (leader) *
                      </Label>
                      <Input
                        value={formData.prix}
                        onChange={(e) => {
                          setUserEditedPrix(true);
                          setFormData((p) => ({ ...p, prix: e.target.value }));
                        }}
                        className="h-10 border-2 border-blue-200 rounded-lg"
                        placeholder="Calculé automatiquement (modifiable)"
                      />
                    </div>
                  </div>

                  {isCustomizationOpen && (
                    <div className="mt-4 mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={customization.includeAvion}
                            onCheckedChange={(c) =>
                              setCustomization((p) => ({ ...p, includeAvion: c }))
                            }
                          />
                          <span className="text-sm text-blue-800">Inclure vol</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={customization.includeVisa}
                            onCheckedChange={(c) =>
                              setCustomization((p) => ({ ...p, includeVisa: c }))
                            }
                          />
                          <span className="text-sm text-blue-800">Inclure visa</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={familyMixed}
                            onCheckedChange={setFamilyMixed}
                          />
                          <span className="text-sm text-blue-800">Famille mixte</span>
                        </div>
                      </div>
                    </div>
                  )}

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
                              {Array.from({ length: room.nbrPlaceTotal }, (_, idx) => (
                                <div
                                  key={idx}
                                  className={`w-4 h-4 rounded-full ${
                                    roomMadinaId === String(room.id) && idx === 0
                                      ? "bg-yellow-400"
                                      : "bg-green-500"
                                  }`}
                                />
                              ))}
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
                              {Array.from({ length: room.nbrPlaceTotal }, (_, idx) => (
                                <div
                                  key={idx}
                                  className={`w-4 h-4 rounded-full ${
                                    roomMakkahId === String(room.id) && idx === 0
                                      ? "bg-yellow-400"
                                      : "bg-green-500"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informations Client
                  </h3>
                  {occupants.map((o, i) => (
                    <div
                      key={i}
                      className="mb-4 p-4 rounded-lg border border-blue-200 bg-white/80 grid grid-cols-1 md:grid-cols-6 gap-3"
                    >
                      <div className="md:col-span-6 text-xs font-semibold text-blue-700 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {i === 0 ? "Leader" : `Accompagnant ${i}`}
                      </div>
                      <Input
                        placeholder="Nom"
                        value={o.lastName}
                        onChange={(e) =>
                          updateOccupant(i, "lastName", e.target.value)
                        }
                        className="border-2 border-blue-100"
                      />
                      <Input
                        placeholder="Prénom"
                        value={o.firstName}
                        onChange={(e) =>
                          updateOccupant(i, "firstName", e.target.value)
                        }
                        className="border-2 border-blue-100"
                      />
                      {i === 0 ? (
                        <>
                          <Input
                            placeholder="Téléphone"
                            value={o.phone}
                            onChange={(e) =>
                              updateOccupant(i, "phone", e.target.value)
                            }
                            className="border-2 border-blue-100"
                          />
                          <Input
                            placeholder="Groupe (optionnel)"
                            value={leaderMeta.groupe}
                            onChange={(e) =>
                              setLeaderMeta((prev) => ({
                                ...prev,
                                groupe: e.target.value,
                              }))
                            }
                            className="border-2 border-blue-100"
                          />
                          <Select
                            value={formData.gender}
                            onValueChange={(v) =>
                              setFormData((p) => ({
                                ...p,
                                gender: v as "Homme" | "Femme",
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Homme">Homme</SelectItem>
                              <SelectItem value="Femme">Femme</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Remarque (optionnel)"
                            value={leaderMeta.remarque}
                            onChange={(e) =>
                              setLeaderMeta((prev) => ({
                                ...prev,
                                remarque: e.target.value,
                              }))
                            }
                            className="md:col-span-6 border-2 border-blue-100"
                          />
                          <div className="md:col-span-6 flex items-center gap-2 text-sm text-blue-700">
                            <Switch
                              checked={leaderMeta.transport}
                              onCheckedChange={(checked) =>
                                setLeaderMeta((prev) => ({
                                  ...prev,
                                  transport: checked,
                                }))
                              }
                            />
                            Transport demandé
                          </div>
                        </>
                      ) : null}
                      <div className={i === 0 ? "md:col-span-6" : "md:col-span-4"}>
                        <Label className="text-xs text-blue-700 mb-1 block">
                          Passeport (obligatoire)
                        </Label>
                        <Input
                          type="file"
                          accept=".pdf,image/png,image/jpeg,image/webp"
                          onChange={(e) =>
                            setOccupantPassportFile(
                              i,
                              e.target.files?.[0] || null
                            )
                          }
                          className="border-2 border-blue-100"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Paiements
                  </h3>
                  <div className="space-y-4">
                    {payments.map((payment, index) => (
                      <div key={index} className="p-4 border border-blue-200 rounded-lg bg-white/60">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-4 space-y-2">
                            <Label className="text-blue-700 font-medium text-sm">Mode de paiement</Label>
                            <Select
                              value={payment.type}
                              onValueChange={(value) =>
                                setPaymentField(index, "type", value)
                              }
                            >
                              <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
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
                            <Label className="text-blue-700 font-medium text-sm">Montant (DH)</Label>
                            <Input
                              value={payment.amount}
                              onChange={(e) =>
                                setPaymentField(index, "amount", e.target.value)
                              }
                              placeholder="Montant"
                              className="h-10 border-2 border-blue-200"
                            />
                          </div>
                          <div className="md:col-span-3 space-y-2">
                            <Label className="text-blue-700 font-medium text-sm">Reçu</Label>
                            <Input
                              type="file"
                              accept=".pdf,image/png,image/jpeg,image/webp"
                              onChange={(e) =>
                                setPaymentField(
                                  index,
                                  "receipt",
                                  e.target.files?.[0] || null
                                )
                              }
                              className="h-10 border-2 border-blue-200"
                            />
                          </div>
                          <div className="md:col-span-2 flex items-end">
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => removePaymentRow(index)}
                              disabled={payments.length === 1}
                              className="w-full"
                            >
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button type="button" onClick={addPaymentRow} className="bg-blue-600 hover:bg-blue-700">
                      Ajouter un paiement
                    </Button>
                    <div className="space-y-2">
                      <Label className="text-blue-700 font-medium text-sm">Montant déjà payé (leader)</Label>
                      <Input
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        placeholder="0"
                        className="h-10 border-2 border-blue-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documents Fournisseur
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    <div className="bg-white p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-blue-700 font-medium">Statut Visa</Label>
                        <Switch
                          checked={supplierStatus.statutVisa}
                          onCheckedChange={(checked) =>
                            setSupplierStatus((prev) => ({ ...prev, statutVisa: checked }))
                          }
                          className="data-[state=checked]:bg-blue-600"
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        {supplierStatus.statutVisa ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" /> Pret
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-orange-600">
                            <Bell className="h-4 w-4" /> En attente
                          </div>
                        )}
                      </div>
                      <Input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/webp"
                        onChange={(e) =>
                          setSupplierDocuments((prev) => ({
                            ...prev,
                            visa: e.target.files?.[0] || null,
                          }))
                        }
                        className="mt-3 border-2 border-blue-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="bg-white p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-blue-700 font-medium">Statut Vol</Label>
                          <Switch
                            checked={supplierStatus.statutVol}
                            onCheckedChange={(checked) =>
                              setSupplierStatus((prev) => ({ ...prev, statutVol: checked }))
                            }
                            className="data-[state=checked]:bg-blue-600"
                          />
                        </div>
                        <Input
                          type="file"
                          accept=".pdf,image/png,image/jpeg,image/webp"
                          onChange={(e) =>
                            setSupplierDocuments((prev) => ({
                              ...prev,
                              flightBooked: e.target.files?.[0] || null,
                            }))
                          }
                          className="mt-3 border-2 border-blue-200"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-white p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-blue-700 font-medium">Statut Hôtel</Label>
                          <Switch
                            checked={supplierStatus.statutHotel}
                            onCheckedChange={(checked) =>
                              setSupplierStatus((prev) => ({ ...prev, statutHotel: checked }))
                            }
                            className="data-[state=checked]:bg-blue-600"
                          />
                        </div>
                        <Input
                          type="file"
                          accept=".pdf,image/png,image/jpeg,image/webp"
                          onChange={(e) =>
                            setSupplierDocuments((prev) => ({
                              ...prev,
                              hotelBooked: e.target.files?.[0] || null,
                            }))
                          }
                          className="mt-3 border-2 border-blue-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Link href="/reservations">
                    <Button variant="outline" type="button">
                      Annuler
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-blue-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <span className="text-[10px] font-medium text-gray-600">Prix</span>
                <span className="text-sm font-bold text-blue-800">
                  {(Number(formData.prix || 0) || 0).toLocaleString("fr-FR")} DH
                </span>
              </div>
              <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                <span className="text-[10px] font-medium text-gray-600">Réduc.</span>
                <Input
                  value={reduction}
                  onChange={(e) => setReduction(e.target.value)}
                  className="h-7 w-24 border-amber-300 text-xs"
                />
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <span className="text-[10px] font-medium text-gray-600">Propos.</span>
                <span className="text-sm font-bold text-emerald-800">
                  {Math.max(
                    (Number(formData.prix || 0) || 0) - (Number(reduction || 0) || 0),
                    0
                  ).toLocaleString("fr-FR")} DH
                </span>
              </div>
            </div>
            <Button
              type="submit"
              form="__next"
              onClick={(e) => {
                e.preventDefault();
                const form = document.querySelector("form");
                if (form) form.requestSubmit();
              }}
              disabled={!canSubmit || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? "Enregistrement…" : "Confirmer la réservation"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
