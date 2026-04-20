"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"

type RedirectState = "loading" | "error"

export default function EditReservationRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const reservationId = params?.id as string | undefined
  const [state, setState] = useState<RedirectState>("loading")

  useEffect(() => {
    let cancelled = false

    const resolveRoute = async () => {
      if (!reservationId) {
        if (!cancelled) setState("error")
        return
      }

      try {
        const res = await fetch(api.url(`/api/reservations/${reservationId}`))
        if (!res.ok) throw new Error("Impossible de charger la réservation")
        const reservation = await res.json()
        const targetPath =
          reservation?.typeReservation === "CHAMBRE_PRIVEE"
            ? `/reservations/modifier-chambre/${reservationId}`
            : `/reservations/modifier-simple/${reservationId}`

        if (!cancelled) {
          router.replace(targetPath)
        }
      } catch {
        if (!cancelled) setState("error")
      }
    }

    resolveRoute()
    return () => {
      cancelled = true
    }
  }, [reservationId, router])

  if (state === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-red-200 shadow-md p-6 max-w-md w-full text-center">
          <h1 className="text-lg font-semibold text-red-700 mb-2">
            Erreur de redirection
          </h1>
          <p className="text-sm text-gray-600 mb-4">
            Impossible de déterminer la page d&apos;édition pour cette réservation.
          </p>
          <Button onClick={() => router.push("/reservations")}>
            Retour aux réservations
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Redirection vers la page de modification...</p>
      </div>
    </div>
  )
}
