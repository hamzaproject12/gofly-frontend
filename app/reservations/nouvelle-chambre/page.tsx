"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

type Hotel = { id: number; name: string; city: string };
type Room = {
  id: number;
  hotelId: number;
  roomType: "SINGLE" | "DOUBLE" | "TRIPLE" | "QUAD" | "QUINT";
  gender: string;
  nbrPlaceRestantes: number;
};
type Program = {
  id: number;
  name: string;
  hotelsMadina: Array<{ hotel: Hotel }>;
  hotelsMakkah: Array<{ hotel: Hotel }>;
  rooms: Room[];
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

export default function NouvelleChambrePage() {
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);

  const [programId, setProgramId] = useState("");
  const [roomType, setRoomType] = useState<keyof typeof ROOM_CAPACITY | "">("");
  const [hotelMadina, setHotelMadina] = useState("");
  const [hotelMakkah, setHotelMakkah] = useState("");
  const [roomMadinaId, setRoomMadinaId] = useState("");
  const [roomMakkahId, setRoomMakkahId] = useState("");
  const [reservationDate, setReservationDate] = useState(new Date().toISOString().split("T")[0]);
  const [price, setPrice] = useState("");
  const [paidAmount, setPaidAmount] = useState("");

  const capacity = roomType ? ROOM_CAPACITY[roomType] : 0;
  const [occupants, setOccupants] = useState<Occupant[]>([]);

  useEffect(() => {
    const loadPrograms = async () => {
      const res = await fetch(api.url(api.endpoints.programs));
      if (!res.ok) return;
      const data = await res.json();
      setPrograms(data);
    };
    loadPrograms();
  }, []);

  useEffect(() => {
    const program = programs.find((p) => p.id.toString() === programId) || null;
    setSelectedProgram(program);
    setHotelMadina("");
    setHotelMakkah("");
    setRoomMadinaId("");
    setRoomMakkahId("");
  }, [programId, programs]);

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
        gender: prev[i]?.gender || "Homme",
      }))
    );
  }, [capacity]);

  const hotelsMadina = selectedProgram?.hotelsMadina?.map((h) => h.hotel) || [];
  const hotelsMakkah = selectedProgram?.hotelsMakkah?.map((h) => h.hotel) || [];

  const roomCandidatesMadina = useMemo(() => {
    if (!selectedProgram || !roomType || !hotelMadina) return [];
    return selectedProgram.rooms.filter(
      (room) =>
        room.roomType === roomType &&
        room.hotelId === Number(hotelMadina) &&
        room.nbrPlaceRestantes >= capacity
    );
  }, [selectedProgram, roomType, hotelMadina, capacity]);

  const roomCandidatesMakkah = useMemo(() => {
    if (!selectedProgram || !roomType || !hotelMakkah) return [];
    return selectedProgram.rooms.filter(
      (room) =>
        room.roomType === roomType &&
        room.hotelId === Number(hotelMakkah) &&
        room.nbrPlaceRestantes >= capacity
    );
  }, [selectedProgram, roomType, hotelMakkah, capacity]);

  const canSubmit =
    !!programId &&
    !!roomType &&
    !!hotelMadina &&
    !!hotelMakkah &&
    !!roomMadinaId &&
    !!roomMakkahId &&
    !!price &&
    occupants.length === capacity &&
    occupants.every((o) => o.firstName && o.lastName && o.phone);

  const updateOccupant = (index: number, field: keyof Occupant, value: string) => {
    setOccupants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const groupRes = await api.request(api.url(`${api.endpoints.reservations}/group`), {
        method: "POST",
        body: JSON.stringify({
          groupId: crypto.randomUUID(),
          typeReservation: "CHAMBRE_PRIVEE",
          familyMixed: true,
          roomType,
          roomMadinaId: Number(roomMadinaId),
          roomMakkahId: Number(roomMakkahId),
          reservationDate,
          leaderPrice: Number(price),
          leaderPaidAmount: Number(paidAmount || 0),
          occupants,
          common: {
            programId: Number(programId),
            hotelMadina,
            hotelMakkah,
            status: "Incomplet",
            statutPasseport: false,
            statutVisa: false,
            statutHotel: false,
            statutVol: false,
            reduction: 0,
            plan: "Normal",
          },
        }),
      });

      if (!groupRes.ok) {
        const err = await groupRes.json().catch(() => ({}));
        throw new Error(err.error || "Erreur création dossier chambre");
      }

      toast({
        title: "Succès",
        description: "Dossier chambre privée créé avec leader et accompagnants.",
      });
      router.push("/reservations");
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la création du dossier",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle Chambre Privee / Familiale</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Programme</Label>
                  <Select value={programId} onValueChange={setProgramId}>
                    <SelectTrigger><SelectValue placeholder="Choisir un programme" /></SelectTrigger>
                    <SelectContent>
                      {programs.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Type de chambre</Label>
                  <Select value={roomType} onValueChange={(v) => setRoomType(v as keyof typeof ROOM_CAPACITY)}>
                    <SelectTrigger><SelectValue placeholder="Type chambre" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DOUBLE">DOUBLE</SelectItem>
                      <SelectItem value="TRIPLE">TRIPLE</SelectItem>
                      <SelectItem value="QUAD">QUAD</SelectItem>
                      <SelectItem value="QUINT">QUINT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date réservation</Label>
                  <Input type="date" value={reservationDate} onChange={(e) => setReservationDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hôtel Madina</Label>
                  <Select value={hotelMadina} onValueChange={setHotelMadina}>
                    <SelectTrigger><SelectValue placeholder="Choisir hôtel Madina" /></SelectTrigger>
                    <SelectContent>
                      {hotelsMadina.map((h) => (
                        <SelectItem key={h.id} value={h.id.toString()}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room Madina (vide)</Label>
                  <Select value={roomMadinaId} onValueChange={setRoomMadinaId}>
                    <SelectTrigger><SelectValue placeholder="Choisir room dispo" /></SelectTrigger>
                    <SelectContent>
                      {roomCandidatesMadina.map((r) => (
                        <SelectItem key={r.id} value={r.id.toString()}>
                          Room #{r.id} - {r.nbrPlaceRestantes} places restantes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hôtel Makkah</Label>
                  <Select value={hotelMakkah} onValueChange={setHotelMakkah}>
                    <SelectTrigger><SelectValue placeholder="Choisir hôtel Makkah" /></SelectTrigger>
                    <SelectContent>
                      {hotelsMakkah.map((h) => (
                        <SelectItem key={h.id} value={h.id.toString()}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room Makkah (vide)</Label>
                  <Select value={roomMakkahId} onValueChange={setRoomMakkahId}>
                    <SelectTrigger><SelectValue placeholder="Choisir room dispo" /></SelectTrigger>
                    <SelectContent>
                      {roomCandidatesMakkah.map((r) => (
                        <SelectItem key={r.id} value={r.id.toString()}>
                          Room #{r.id} - {r.nbrPlaceRestantes} places restantes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prix total dossier (leader)</Label>
                  <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex: 50000" />
                </div>
                <div className="space-y-2">
                  <Label>Montant payé</Label>
                  <Input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="Ex: 10000" />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Occupants ({capacity})</Label>
                {occupants.map((o, i) => (
                  <div key={i} className="border rounded-md p-3 grid grid-cols-1 md:grid-cols-5 gap-3">
                    <Input placeholder={`Nom ${i === 0 ? "(Leader)" : ""}`} value={o.lastName} onChange={(e) => updateOccupant(i, "lastName", e.target.value)} />
                    <Input placeholder="Prénom" value={o.firstName} onChange={(e) => updateOccupant(i, "firstName", e.target.value)} />
                    <Input placeholder="Téléphone" value={o.phone} onChange={(e) => updateOccupant(i, "phone", e.target.value)} />
                    <Input placeholder="N° passeport" value={o.passportNumber} onChange={(e) => updateOccupant(i, "passportNumber", e.target.value)} />
                    <Select value={o.gender} onValueChange={(v) => updateOccupant(i, "gender", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Homme">Homme</SelectItem>
                        <SelectItem value="Femme">Femme</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/reservations"><Button variant="outline" type="button">Annuler</Button></Link>
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Enregistrement..." : "Créer dossier chambre"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
