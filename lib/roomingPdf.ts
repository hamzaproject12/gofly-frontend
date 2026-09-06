/**
 * Export PDF du plan de chambres (rooming list).
 *
 * Deux documents en un, parce qu'un agent a besoin des deux sens de lecture :
 *  1. « Plan des chambres » — hôtel par hôtel, chambre par chambre, avec le
 *     numéro de place : c'est la feuille qu'on tient à la réception pour
 *     distribuer les clés.
 *  2. « Index des pèlerins » — la liste alphabétique avec, pour chaque personne,
 *     sa chambre dans chaque hôtel du parcours : la feuille pour répondre à
 *     « où dort M. X ? » sans relire tout le plan.
 *
 * Les couleurs de famille viennent de `lib/rooming.ts` : la même famille porte
 * la même teinte à l'écran et sur le papier.
 *
 * ATTENTION : jsPDF (Helvetica) rend U+00A0 et U+202F par un « / ». Tout montant
 * ou nombre imprimé ici doit passer par les variantes ASCII de `lib/format.ts`.
 */

import { siteConfig } from "@/lib/config"
import { formatDateFr } from "@/lib/format"
import {
  buildFamilies,
  buildPilgrimIndex,
  initialeGenre,
  libelleGenre,
  libellePlacement,
  nomHotelCourt,
  slugify,
  styleVille,
  type Famille,
  type RoomingPlan,
} from "@/lib/rooming"

type RGB = [number, number, number]

const COLORS = {
  indigo: [79, 70, 229] as RGB,
  slate: [51, 65, 85] as RGB,
  slateSoft: [248, 250, 252] as RGB,
  slateLine: [226, 232, 240] as RGB,
  mute: [130, 138, 150] as RGB,
  white: [255, 255, 255] as RGB,
  libre: [240, 253, 244] as RGB,
  libreText: [21, 128, 61] as RGB,
}

/** Métadonnée posée sur chaque ligne du tableau, lue par le hook de style. */
type RowMeta =
  | { kind: "room"; fill: RGB }
  | { kind: "occupant"; fill: RGB; isLeader: boolean }
  | { kind: "libre" }

const ROOM_HEAD = [
  "Place",
  "Nom et prénom",
  "H/F",
  "Téléphone",
  "N° passeport",
  "Groupe / famille",
  "Statut",
]

async function loadImageAsDataUrl(
  url: string
): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" })
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("read error"))
      reader.readAsDataURL(blob)
    })
    const { w, h } = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 })
      img.onerror = () => resolve({ w: 1, h: 1 })
      img.src = dataUrl
    })
    return { data: dataUrl, w, h }
  } catch {
    return null
  }
}

/**
 * Génère et télécharge le PDF. Renvoie le nom du fichier produit.
 */
export async function exportRoomingPdf(plan: RoomingPlan): Promise<string> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const familles = buildFamilies(plan.villes)
  const pelerins = buildPilgrimIndex(plan.villes)

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 32
  const contentW = pageW - 2 * marginX

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
  const lastY = (): number =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  const exportedAt = new Date()
  const dateLabel = exportedAt.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
  const programName = plan.program.name || "Programme"

  /* ---------------- En-tête ---------------- */

  setFill(COLORS.indigo)
  doc.rect(0, 0, pageW, 76, "F")
  let textX = marginX
  const logo = await loadImageAsDataUrl(siteConfig.logo)
  if (logo) {
    const targetH = 40
    const targetW = Math.min(110, targetH * (logo.w / Math.max(1, logo.h)))
    try {
      doc.addImage(logo.data, "PNG", marginX, 18, targetW, targetH)
      textX = marginX + targetW + 14
    } catch {
      // logo non décodable : on garde l'en-tête sans image
    }
  }
  setText(COLORS.white)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(17)
  doc.text(siteConfig.name, textX, 34)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text("Plan de chambres — répartition des pèlerins", textX, 52)

  let y = 104

  setText(COLORS.indigo)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(17)
  doc.text(programName, marginX, y)
  y += 17

  const meta: string[] = []
  if (plan.program.dateDepart) meta.push(`Départ : ${formatDateFr(plan.program.dateDepart)}`)
  if (plan.program.dateArrivee) meta.push(`Retour : ${formatDateFr(plan.program.dateArrivee)}`)
  if (plan.program.dureeJours > 0) meta.push(`Durée : ${plan.program.dureeJours} jours`)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9.5)
  setText(COLORS.slate)
  if (meta.length > 0) {
    doc.text(meta.join("   •   "), marginX, y)
    y += 13
  }
  setText(COLORS.mute)
  doc.text(`Édité le ${dateLabel}`, marginX, y)
  y += 20

  /* ---------------- Récapitulatif ---------------- */

  const s = plan.summary
  autoTable(doc, {
    startY: y,
    head: [["Pèlerins placés", "Hôtels", "Chambres", "Places occupées", "Complètes", "Partielles", "Vides"]],
    body: [[
      String(s.pelerins),
      String(s.totalHotels),
      String(s.totalRooms),
      `${s.placesOccupees} / ${s.totalPlaces}`,
      String(s.chambresCompletes),
      String(s.chambresPartielles),
      String(s.chambresVides),
    ]],
    theme: "grid",
    headStyles: { fillColor: COLORS.indigo, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 11, fontStyle: "bold", halign: "center", textColor: COLORS.slate },
    styles: { cellPadding: { top: 6, bottom: 6, left: 4, right: 4 }, lineColor: COLORS.slateLine, lineWidth: 0.5 },
    margin: { left: marginX, right: marginX },
  })
  y = lastY() + 18

  /* ---------------- Légende des familles ---------------- */

  const famillesColorees = [...familles.values()]
    .filter((f): f is Famille & { colorIndex: number } => f.colorIndex !== null)
    .sort((a, b) => a.colorIndex - b.colorIndex)

  if (famillesColorees.length > 0) {
    setText(COLORS.slate)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text("Familles / groupes — une couleur par groupe, identique dans tous les hôtels", marginX, y)
    y += 12

    const perLine = 3
    const colW = contentW / perLine
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    for (let i = 0; i < famillesColorees.length; i += 1) {
      const col = i % perLine
      if (col === 0 && i > 0) y += 14
      if (y > pageH - 60) {
        doc.addPage()
        y = 56
      }
      const famille = famillesColorees[i]
      const x = marginX + col * colW
      setFill(famille.color.rgb)
      setDraw(COLORS.slateLine)
      doc.setLineWidth(0.5)
      doc.roundedRect(x, y - 8, 16, 10, 2, 2, "FD")
      setText(COLORS.slate)
      const label = `${famille.label} (${famille.taille} pers.)`
      doc.text(doc.splitTextToSize(label, colW - 26)[0], x + 22, y)
    }
    y += 20
  }

  /* ---------------- Plan par hôtel ---------------- */

  for (const ville of plan.villes) {
    const style = styleVille(ville.key)

    if (y > pageH - 130) {
      doc.addPage()
      y = 56
    }
    setFill(style.rgb)
    doc.roundedRect(marginX, y, contentW, 24, 4, 4, "F")
    setText(COLORS.white)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text(ville.label.toUpperCase(), marginX + 10, y + 16)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text(
      `${ville.placesOccupees} / ${ville.totalPlaces} places occupées`,
      pageW - marginX - 10,
      y + 16,
      { align: "right" }
    )
    y += 34

    for (const hotel of ville.hotels) {
      if (y > pageH - 120) {
        doc.addPage()
        y = 56
      }
      setText(COLORS.slate)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.text(nomHotelCourt(hotel.hotelName), marginX, y)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      setText(COLORS.mute)
      doc.text(
        `${hotel.rooms.length} chambre(s) — ${hotel.placesOccupees}/${hotel.totalPlaces} places occupées`,
        pageW - marginX,
        y,
        { align: "right" }
      )
      y += 8

      const body: (string | { content: string; colSpan?: number })[][] = []
      const metaByRow: RowMeta[] = []

      for (const room of hotel.rooms) {
        const bandeau =
          `Chambre ${room.numero} — ${room.roomTypeLabel} (${room.totalPlaces} places)`
          + `  •  ${libelleGenre(room.gender)}`
          + `  •  ${room.placesOccupees}/${room.totalPlaces} occupées`
          + (room.estChambrePrivee ? "  •  CHAMBRE PRIVÉE" : "")
        body.push([{ content: bandeau, colSpan: ROOM_HEAD.length }])
        metaByRow.push({ kind: "room", fill: style.rgb })

        for (const occupant of room.occupants) {
          const famille = familles.get(occupant.groupKey)
          body.push([
            String(occupant.place),
            occupant.isLeader && famille && famille.taille > 1
              ? `${occupant.nom}  (chef de groupe)`
              : occupant.nom,
            initialeGenre(occupant.gender),
            occupant.phone || "—",
            occupant.passportNumber || "—",
            famille && famille.taille > 1 ? famille.label : "—",
            occupant.status,
          ])
          metaByRow.push({
            kind: "occupant",
            fill: famille ? famille.color.rgb : COLORS.white,
            isLeader: occupant.isLeader && Boolean(famille) && famille!.taille > 1,
          })
        }

        for (const place of room.placesLibres) {
          body.push([String(place), "— Place libre —", "", "", "", "", ""])
          metaByRow.push({ kind: "libre" })
        }
      }

      autoTable(doc, {
        startY: y + 6,
        head: [ROOM_HEAD],
        body,
        theme: "grid",
        headStyles: { fillColor: COLORS.slate, textColor: 255, fontStyle: "bold", fontSize: 8 },
        styles: {
          fontSize: 8.5,
          cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
          lineColor: COLORS.slateLine,
          lineWidth: 0.5,
          textColor: COLORS.slate,
          overflow: "linebreak",
        },
        columnStyles: {
          0: { cellWidth: 34, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 140 },
          2: { cellWidth: 26, halign: "center" },
          3: { cellWidth: 74 },
          4: { cellWidth: 74 },
          5: { cellWidth: 96 },
          6: { cellWidth: 55, halign: "center" },
        },
        margin: { left: marginX, right: marginX },
        // Les lignes « chambre » et « place libre » ne sont pas des données :
        // on les repeint ici plutôt que d'éclater le tableau en un par chambre,
        // ce qui casserait la répétition des en-têtes sur les sauts de page.
        didParseCell: (data) => {
          if (data.section !== "body") return
          const rowMeta = metaByRow[data.row.index]
          if (!rowMeta) return
          if (rowMeta.kind === "room") {
            data.cell.styles.fillColor = rowMeta.fill
            data.cell.styles.textColor = COLORS.white
            data.cell.styles.fontStyle = "bold"
            data.cell.styles.fontSize = 9
            data.cell.styles.halign = "left"
          } else if (rowMeta.kind === "libre") {
            data.cell.styles.fillColor = COLORS.libre
            data.cell.styles.textColor = COLORS.libreText
            data.cell.styles.fontStyle = "italic"
          } else {
            data.cell.styles.fillColor = rowMeta.fill
            if (rowMeta.isLeader && data.column.index === 1) {
              data.cell.styles.fontStyle = "bold"
            }
          }
        },
      })
      y = lastY() + 16
    }
  }

  /* ---------------- Index des pèlerins ---------------- */

  if (pelerins.length > 0) {
    doc.addPage()
    y = 56
    setText(COLORS.indigo)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text("Index des pèlerins", marginX, y)
    y += 14
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    setText(COLORS.mute)
    doc.text(
      "Liste alphabétique : pour chaque personne, sa chambre dans chaque hôtel du parcours.",
      marginX,
      y
    )
    y += 14

    // Une colonne par étape du parcours, dans l'ordre des hôtels du plan.
    const etapes: { key: string; label: string }[] = []
    for (const ville of plan.villes) {
      for (const hotel of ville.hotels) {
        etapes.push({
          key: `${ville.label}|${hotel.hotelName}`,
          label: `${ville.label} — ${nomHotelCourt(hotel.hotelName)}`,
        })
      }
    }

    const indexHead = ["Nom et prénom", "H/F", "Téléphone", ...etapes.map((e) => e.label)]
    const indexMeta: RGB[] = []
    const indexBody = pelerins.map((pelerin) => {
      const famille = familles.get(pelerin.groupKey)
      indexMeta.push(famille ? famille.color.rgb : COLORS.white)
      const parEtape = new Map(
        pelerin.placements.map((p) => [`${p.ville}|${p.hotelName}`, libellePlacement(p)])
      )
      return [
        pelerin.nom,
        initialeGenre(pelerin.gender),
        pelerin.phone || "—",
        ...etapes.map((e) => parEtape.get(e.key) || "—"),
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [indexHead],
      body: indexBody,
      theme: "grid",
      headStyles: { fillColor: COLORS.indigo, textColor: 255, fontStyle: "bold", fontSize: 8 },
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
        lineColor: COLORS.slateLine,
        lineWidth: 0.5,
        textColor: COLORS.slate,
        overflow: "linebreak",
      },
      columnStyles: {
        0: { cellWidth: 118, fontStyle: "bold" },
        1: { cellWidth: 24, halign: "center" },
        2: { cellWidth: 70 },
      },
      margin: { left: marginX, right: marginX },
      didParseCell: (data) => {
        if (data.section !== "body") return
        const fill = indexMeta[data.row.index]
        if (fill) data.cell.styles.fillColor = fill
      },
    })
  }

  /* ---------------- Pieds de page ---------------- */

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    setDraw(COLORS.slateLine)
    doc.setLineWidth(0.5)
    doc.line(marginX, pageH - 28, pageW - marginX, pageH - 28)
    setText(COLORS.mute)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.text(`${siteConfig.name} — Plan de chambres — ${programName}`, marginX, pageH - 15)
    doc.text(`Page ${i} / ${pageCount}`, pageW - marginX, pageH - 15, { align: "right" })
  }

  const filename = `plan-chambres-${slugify(programName)}-${exportedAt
    .toISOString()
    .slice(0, 10)}.pdf`
  doc.save(filename)
  return filename
}
