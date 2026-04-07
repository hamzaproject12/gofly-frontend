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
  }, [capacity, formData.gender]);

  const roomCandidatesMadina = useMemo(() => {
    if (!programInfo || !formData.typeChambre || !formData.hotelMadina)
      return [];
    const hid = parseInt(formData.hotelMadina, 10);
    const cap = ROOM_CAPACITY[formData.typeChambre] || 0;
    return programInfo.rooms.filter((room) => {
      if (room.hotelId !== hid || room.roomType !== formData.typeChambre)
        return false;
      if (room.nbrPlaceRestantes < cap) return false;
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
    const cap = ROOM_CAPACITY[formData.typeChambre] || 0;
    return programInfo.rooms.filter((room) => {
      if (room.hotelId !== hid || room.roomType !== formData.typeChambre)
        return false;
      if (room.nbrPlaceRestantes < cap) return false;
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
    occupants.every((o) => o.firstName && o.lastName && o.phone);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
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
            leaderPaidAmount: Number(paidAmount || 0),
            occupants: leaderOccupants,
            common: {
              programId: Number(formData.programId),
              hotelMadina: hotelNameMadina,
              hotelMakkah: hotelNameMakkah,
              status: "Incomplet",
              statutPasseport: false,
              statutVisa: false,
              statutHotel: false,
              statutVol: false,
              reduction: 0,
              plan: customization.plan,
            },
          }),
        }
      );

      if (!groupRes.ok) {
        const err = await groupRes.json().catch(() => ({}));
        throw new Error(err.error || "Erreur création dossier chambre");
      }

      toast({
        title: "Succès",
        description: "Dossier chambre privée créé (leader + accompagnants).",
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
                {/* Section 1 — comme Nouvelle Réservation */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 mb-2">
                  <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Configuration du voyage
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
                        Type de chambre (privative) *
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
                        Genre (leader / réf. prix) *
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-2">
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
                      <span className="text-sm text-blue-800">
                        Famille mixte (chambre)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        placeholder="Calculé automatiquement si config complète (modifiable)"
                      />
                    </div>
                  </div>
                </div>

                {/* Hôtels — même esprit que Nouvelle Réservation */}
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-4 rounded-xl border border-emerald-200">
                  <h3 className="text-lg font-semibold text-emerald-900 mb-4 flex items-center gap-2">
                    <Hotel className="h-5 w-5" />
                    Hôtels & chambres (bloc privé)
                  </h3>
                  <p className="text-sm text-emerald-800 mb-4">
                    Choisissez les mêmes types de chambre à Madina et Makkah avec
                    assez de places pour tout le groupe. Les noms d&apos;hôtels
                    sont enregistrés comme sur la page Nouvelle Réservation.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-emerald-800 font-medium text-sm">
                        Hôtel Madina *
                      </Label>
                      <Select
                        value={formData.hotelMadina}
                        onValueChange={(v) => {
                          setFormData((p) => ({ ...p, hotelMadina: v }));
                          setRoomMadinaId("");
                        }}
                      >
                        <SelectTrigger className="h-10 border-2 border-emerald-200 rounded-lg bg-white">
                          <SelectValue placeholder="Choisir" />
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
                      <Label className="text-emerald-800 font-medium text-sm">
                        Chambre Madina (room) *
                      </Label>
                      <Select
                        value={roomMadinaId}
                        onValueChange={setRoomMadinaId}
                      >
                        <SelectTrigger className="h-10 border-2 border-emerald-200 rounded-lg bg-white">
                          <SelectValue placeholder="Room avec places suffisantes" />
                        </SelectTrigger>
                        <SelectContent>
                          {roomCandidatesMadina.map((r) => (
                            <SelectItem key={r.id} value={r.id.toString()}>
                              #{r.id} — {r.nbrPlaceRestantes} places —{" "}
                              {r.gender}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-emerald-800 font-medium text-sm">
                        Hôtel Makkah *
                      </Label>
                      <Select
                        value={formData.hotelMakkah}
                        onValueChange={(v) => {
                          setFormData((p) => ({ ...p, hotelMakkah: v }));
                          setRoomMakkahId("");
                        }}
                      >
                        <SelectTrigger className="h-10 border-2 border-emerald-200 rounded-lg bg-white">
                          <SelectValue placeholder="Choisir" />
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
                      <Label className="text-emerald-800 font-medium text-sm">
                        Chambre Makkah (room) *
                      </Label>
                      <Select
                        value={roomMakkahId}
                        onValueChange={setRoomMakkahId}
                      >
                        <SelectTrigger className="h-10 border-2 border-emerald-200 rounded-lg bg-white">
                          <SelectValue placeholder="Room avec places suffisantes" />
                        </SelectTrigger>
                        <SelectContent>
                          {roomCandidatesMakkah.map((r) => (
                            <SelectItem key={r.id} value={r.id.toString()}>
                              #{r.id} — {r.nbrPlaceRestantes} places —{" "}
                              {r.gender}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Occupants */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-200">
                  <h3 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Occupants ({capacity || "—"}) — Leader en premier
                  </h3>
                  {occupants.map((o, i) => (
                    <div
                      key={i}
                      className="mb-4 p-4 rounded-lg border border-indigo-100 bg-white/80 grid grid-cols-1 md:grid-cols-6 gap-3"
                    >
                      <div className="md:col-span-6 text-xs font-semibold text-indigo-700 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {i === 0 ? "Leader (payeur du dossier)" : `Accompagnant ${i}`}
                      </div>
                      <Input
                        placeholder="Nom"
                        value={o.lastName}
                        onChange={(e) =>
                          updateOccupant(i, "lastName", e.target.value)
                        }
                        className="border-2 border-indigo-100"
                      />
                      <Input
                        placeholder="Prénom"
                        value={o.firstName}
                        onChange={(e) =>
                          updateOccupant(i, "firstName", e.target.value)
                        }
                        className="border-2 border-indigo-100"
                      />
                      <Input
                        placeholder="Téléphone"
                        value={o.phone}
                        onChange={(e) =>
                          updateOccupant(i, "phone", e.target.value)
                        }
                        className="border-2 border-indigo-100"
                      />
                      <Input
                        placeholder="N° passeport"
                        value={o.passportNumber}
                        onChange={(e) =>
                          updateOccupant(i, "passportNumber", e.target.value)
                        }
                        className="border-2 border-indigo-100"
                      />
                      <Select
                        value={i === 0 ? formData.gender : o.gender}
                        onValueChange={(v) => {
                          if (i === 0) {
                            setFormData((p) => ({
                              ...p,
                              gender: v as "Homme" | "Femme",
                            }));
                          }
                          updateOccupant(i, "gender", v);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Homme">Homme</SelectItem>
                          <SelectItem value="Femme">Femme</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                {/* Paiement leader */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-200">
                  <h3 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Paiement (leader)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Montant déjà payé (DH)</Label>
                      <Input
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        placeholder="0"
                        className="h-10 border-2 border-amber-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Link href="/reservations">
                    <Button variant="outline" type="button">
                      Annuler
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting
                      ? "Enregistrement…"
                      : "Créer le dossier chambre privée"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
