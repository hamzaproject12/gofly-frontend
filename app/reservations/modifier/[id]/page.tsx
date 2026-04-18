"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

export default function ModifierReservationRouterPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const reservationId = String(params?.id || "");

  useEffect(() => {
    if (!reservationId) return;

    let active = true;

    const routeToEditPage = async () => {
      try {
        const response = await fetch(api.url(`/api/reservations/${reservationId}`));
        if (!response.ok) {
          throw new Error("Impossible de charger la reservation");
        }

        const reservation = await response.json();
        if (!active) return;

        const isChambrePrivee = reservation?.typeReservation === "CHAMBRE_PRIVEE";
        const targetPath = isChambrePrivee
          ? `/reservations/modifier-chambre/${reservationId}`
          : `/reservations/modifier-simple/${reservationId}`;

        router.replace(targetPath);
      } catch {
        if (!active) return;
        toast({
          title: "Erreur",
          description: "Impossible d'ouvrir la page de modification.",
          variant: "destructive",
        });
        router.replace("/reservations");
      }
    };

    routeToEditPage();
    return () => {
      active = false;
    };
  }, [reservationId, router, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-gray-600">Redirection vers la bonne page de modification...</p>
      </div>
    </div>
  );
}
