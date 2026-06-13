"use client";

import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Bloc de sélection d'une catégorie d'hôtel (Madina, Makkah ou Autre) + visualisation
 * des chambres/places. Extrait des blocs Madina/Makkah dupliqués pour être réutilisé
 * tel quel par les trois catégories. Le rendu et le comportement sont identiques à
 * l'existant : seuls les libellés/icônes/couleur de survol changent par catégorie.
 */

export interface HotelCategoryRoom {
  id: number;
  hotelId: number;
  roomType: string;
  gender: string;
  prixRoom: number;
  nbrPlaceTotal: number;
  nbrPlaceRestantes: number;
  listeIdsReservation?: number[];
}

export interface HotelCategoryHotel {
  id: number;
  name: string;
  city?: string;
}

interface HotelCategoryBlockProps {
  /** Emoji affiché à côté du libellé (🕌 / 🕋 / 🏨) */
  labelIcon: string;
  /** Libellé de la catégorie (ex. « Hôtel à Madina ») */
  labelText: string;
  /** Emoji du bandeau « Chambres disponibles » */
  headerIcon: string;
  /** Texte du bandeau « Chambres disponibles à … » */
  headerText: string;
  /** Hôtels proposés dans le Select (tous les hôtels de la catégorie, ou un seul pour Autre) */
  hotels: HotelCategoryHotel[];
  /** Valeur sélectionnée : id d'hôtel (string), "none" ou "" */
  value: string;
  onValueChange: (value: string) => void;
  /** Désactive le Select (aucun programme sélectionné) */
  disabled?: boolean;
  rooms: HotelCategoryRoom[];
  roomType: string;
  gender: string;
  selectedPlaces: { [roomId: number]: number[] };
  /** Appelé au clic sur une room avec place > 0 */
  onSelectRoom: (roomId: number, firstAvailablePlace: number) => void;
  sortRoomsByAlgorithm: (rooms: any[], gender: string) => any[];
  getFirstAvailablePlace: (room: any) => number;
  onShowGuide?: () => void;
  /** Couleur de survol des rooms (Madina: blue, Makkah/Autre: green) */
  hoverBorderClass?: string;
  /** Placeholder du Select quand un programme est sélectionné */
  placeholderText?: string;
  /**
   * Autorise l'option « Sans hôtel » (valeur "none") dans le Select.
   * Mettre `false` quand la désactivation de l'hôtel se fait ailleurs
   * (ex. interrupteur du panneau « Éditer »), pour rendre le choix obligatoire.
   * Défaut: true (compat. existant).
   */
  allowNone?: boolean;
}

const getGenderIcon = (gender: string) => {
  switch (gender) {
    case "Homme":
      return "👨";
    case "Femme":
      return "👩";
    case "Mixte":
      return "👥";
    default:
      return "👥";
  }
};

export function HotelCategoryBlock({
  labelIcon,
  labelText,
  headerIcon,
  headerText,
  hotels,
  value,
  onValueChange,
  disabled = false,
  rooms,
  roomType,
  gender,
  selectedPlaces,
  onSelectRoom,
  sortRoomsByAlgorithm,
  getFirstAvailablePlace,
  onShowGuide,
  hoverBorderClass = "hover:border-blue-300",
  placeholderText,
  allowNone = true,
}: HotelCategoryBlockProps) {
  const showRooms =
    rooms && value && value !== "none" && roomType && gender;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{labelIcon}</span>
        <Label className="text-blue-700 font-medium text-sm">{labelText}</Label>
        {onShowGuide && (
          <button
            type="button"
            onClick={onShowGuide}
            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
            title="Guide des chambres"
          >
            <Info className="h-4 w-4" />
          </button>
        )}
        {allowNone && value === "none" && (
          <span className="text-xs text-red-600 font-medium px-2 py-1 bg-red-50 rounded-full border border-red-200">
            Désactivé
          </span>
        )}
      </div>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="h-10 border-2 border-blue-200 focus:border-blue-500 rounded-lg">
          <SelectValue
            placeholder={
              disabled
                ? "Sélectionnez d'abord un programme"
                : placeholderText || `Sélectionner ${labelText.toLowerCase()}`
            }
          />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value="none">Sans hôtel</SelectItem>}
          {hotels.map((hotel) => (
            <SelectItem key={hotel.id} value={hotel.id.toString()}>
              {hotel.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showRooms && (
        <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-green-700">
              {headerIcon} {headerText}
            </span>
          </div>
          <div className="grid gap-2">
            {(() => {
              const filteredRooms = rooms.filter(
                (room) =>
                  room.hotelId === parseInt(value) &&
                  room.roomType === roomType &&
                  (room.gender === gender ||
                    room.gender === "Mixte" ||
                    !room.gender)
              );

              if (filteredRooms.length === 0) {
                return (
                  <div className="text-xs text-gray-500 text-center py-2">
                    Aucune chambre trouvée
                  </div>
                );
              }

              const sortedRooms = sortRoomsByAlgorithm(filteredRooms, gender);

              return sortedRooms.map((room, index) => {
                const placesOccupees =
                  room.nbrPlaceTotal - room.nbrPlaceRestantes;
                const placesDisponibles = room.nbrPlaceRestantes;
                const isSelected = Object.keys(selectedPlaces).includes(
                  room.id.toString()
                );

                return (
                  <div
                    key={index}
                    className={`relative p-2 rounded border transition-all cursor-pointer ${
                      isSelected
                        ? "border-yellow-400 bg-yellow-50"
                        : `border-gray-300 bg-white ${hoverBorderClass}`
                    }`}
                    onClick={() => {
                      if (room.nbrPlaceRestantes > 0) {
                        const firstAvailablePlace = getFirstAvailablePlace(room);
                        onSelectRoom(room.id, firstAvailablePlace);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      <div className="flex items-center gap-2 w-20">
                        <span className="text-sm">
                          {getGenderIcon(room.gender)}
                        </span>
                        <span className="text-xs font-medium text-gray-700">
                          ({placesDisponibles}/{room.nbrPlaceTotal})
                        </span>
                      </div>

                      <div className="flex-1 flex justify-center">
                        <div className="flex gap-1.5">
                          {Array.from(
                            { length: room.nbrPlaceTotal },
                            (_, placeIndex) => {
                              let placeColor = "bg-gray-300";
                              let placeTitle = `Place ${placeIndex + 1}`;

                              if (placeIndex < placesOccupees) {
                                placeColor = "bg-red-500";
                                placeTitle = `Place ${placeIndex + 1} occupée`;
                              } else if (
                                isSelected &&
                                selectedPlaces[room.id]?.includes(placeIndex)
                              ) {
                                placeColor = "bg-yellow-400";
                                placeTitle = `Place ${
                                  placeIndex + 1
                                } - Votre réservation`;
                              } else {
                                placeColor = "bg-green-500";
                                placeTitle = `Place ${placeIndex + 1} libre`;
                              }

                              return (
                                <div
                                  key={placeIndex}
                                  className={`w-4 h-4 rounded-full ${placeColor} transition-all`}
                                  title={placeTitle}
                                />
                              );
                            }
                          )}
                        </div>
                      </div>

                      <div className="w-8 flex justify-end">
                        {isSelected && (
                          <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default HotelCategoryBlock;
