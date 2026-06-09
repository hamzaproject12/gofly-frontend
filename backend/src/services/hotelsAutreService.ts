/**
 * Helper partagé pour les hôtels « Autre » stockés en JSON sur Reservation.hotelsAutre.
 *
 * Format persistant : tableau d'entrées { hotelId, roomId, hotelName }.
 * Le nom de l'hôtel est snapshoté à la création pour que exports/reçus restent
 * lisibles même si l'hôtel est renommé ou supprimé.
 *
 * Toutes les zones qui lisent ce JSON (reservations, export, balance, analytics,
 * generateReceipt) DOIVENT passer par parseHotelsAutre pour éviter les parsings
 * divergents.
 */
export interface HotelAutreEntry {
  hotelId: number;
  roomId: number;
  hotelName: string;
}

/**
 * Normalise la valeur JSON brute de Reservation.hotelsAutre en un tableau
 * d'entrées valides. Tolère null/undefined (réservations existantes), les chaînes
 * JSON, et ignore les entrées malformées.
 */
export function parseHotelsAutre(json: unknown): HotelAutreEntry[] {
  if (json == null) return [];

  let raw: unknown = json;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(raw)) return [];

  const entries: HotelAutreEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const hotelId = Number(obj.hotelId);
    const roomId = Number(obj.roomId);
    if (!Number.isFinite(hotelId) || !Number.isFinite(roomId)) continue;
    entries.push({
      hotelId,
      roomId,
      hotelName: typeof obj.hotelName === 'string' ? obj.hotelName : '',
    });
  }
  return entries;
}
