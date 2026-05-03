import express from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import {
  logJournalSuppression,
  buildReservationDeletionDetail,
  buildReservationUpdateDetail,
  JOURNAL_ACTION,
  type ReservationJournalRow,
} from '../services/journalSuppressionService';

const router = express.Router();
const prisma = new PrismaClient();

/** Filtre liste / stats : roomType Prisma ou "FAMILLE" = chambres privées (famille) */
function applyRoomTypeQuery(where: Record<string, unknown>, roomType: unknown) {
  const rt = typeof roomType === 'string' ? roomType : '';
  if (!rt || rt === 'toutes') return;
  if (rt === 'FAMILLE' || rt === 'CHAMBRE_PRIVEE') {
    (where as { typeReservation: string }).typeReservation = 'CHAMBRE_PRIVEE';
  } else {
    (where as { roomType: string }).roomType = rt;
  }
}

// Fonction helper pour calculer le nombre de places selon le type de chambre
function getPlacesByRoomType(roomType: string): number {
  // Chaque réservation décrémente de 1 place
  return 1;
}

// Fonction helper pour extraire l'agentId du token JWT
function extractAgentIdFromToken(req: express.Request): number | null {
  try {
    // Try to get token from Authorization header first
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    // If no token in header, try to get from cookies
    if (!token) {
      token = req.cookies?.authToken;
    }

    if (!token) {
      console.log('⚠️ No token found in request');
      return null;
    }

    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    
    if (decoded && decoded.agentId) {
      console.log('✅ AgentId extracted from token:', decoded.agentId);
      return decoded.agentId;
    } else {
      console.log('⚠️ No agentId found in token');
      return null;
    }
  } catch (error) {
    console.log('⚠️ Error extracting agentId from token:', error);
    return null;
  }
}

// Get all reservations with pagination and advanced filters
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      program,
      status,
      roomType,
      dateFrom,
      dateTo,
      search
    } = req.query;

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    // Construire les filtres
    const where: any = {
      isLeader: true
    };
    
    if (program && program !== 'tous') {
      where.program = {
        name: program
      };
    }
    
    if (status && status !== 'all') {
      // Le statut "Urgent" n'existe pas en base, il est calculé dynamiquement
      // Donc on ne filtre pas par status quand c'est "Urgent"
      if (status !== 'Urgent') {
        where.status = status;
      } else {
        // Pour "Urgent", exclure les réservations "Complet" qui ne peuvent pas être urgentes
        where.status = {
          not: 'Complet'
        };
      }
    }
    
    applyRoomTypeQuery(where, roomType);

    if (dateFrom || dateTo) {
      where.reservationDate = {};
      if (dateFrom) {
        where.reservationDate.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.reservationDate.lte = new Date(dateTo as string);
      }
    }
    
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Compter le total des réservations (pour la pagination)
    const totalReservations = await prisma.reservation.count({ where });
    
    // Récupérer les réservations avec pagination
    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        agent: { select: { id: true, nom: true } },
        program: {
          select: {
            id: true,
            name: true,
            visaDeadline: true,
            hotelDeadline: true,
            flightDeadline: true,
            passportDeadline: true
          }
        },
        documents: true,
        payments: {
          include: {
            fichier: true
          }
        },
        accompagnants: true
      } as any,
      orderBy: {
        updated_at: 'desc'
      },
      skip,
      take: limitNumber
    });
    
    // Calculer les métadonnées de pagination
    const totalPages = Math.ceil(totalReservations / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPrevPage = pageNumber > 1;
    
    res.json({
      reservations,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalReservations,
        hasNextPage,
        hasPrevPage,
        limit: limitNumber
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des réservations:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des réservations' });
  }
});

// Get reservation statistics with dynamic filters
router.get('/stats', async (req, res) => {
  try {
    const { program, roomType, dateFrom, dateTo, status } = req.query;
    const DAYS_URGENCY_WINDOW = 18;
    
    // Construire les filtres pour les stats
    const where: any = {
      isLeader: true
    };
    
    if (program && program !== 'tous') {
      where.program = {
        name: program
      };
    }
    
    applyRoomTypeQuery(where, roomType);
    
    if (dateFrom || dateTo) {
      where.reservationDate = {};
      if (dateFrom) {
        where.reservationDate.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.reservationDate.lte = new Date(dateTo as string);
      }
    }

    // Pour des stats cohérentes avec l'UI, on recalcule le statut "Urgent" dynamiquement
    // et on compte les personnes (leader + accompagnants), pas seulement le nombre de dossiers.
    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        accompagnants: {
          select: { id: true, statutPasseport: true, statutVisa: true, statutHotel: true, statutVol: true }
        },
        program: {
          select: {
            visaDeadline: true,
            hotelDeadline: true,
            flightDeadline: true,
            passportDeadline: true
          }
        }
      }
    });

    const now = new Date();
    const stats = reservations.reduce(
      (acc, reservation: any) => {
        const members = [reservation, ...(reservation.accompagnants || [])];
        const groupSize = members.length;
        const passportGroupOk = members.every((m: any) => Boolean(m.statutPasseport));
        const visaGroupOk = members.every((m: any) => Boolean(m.statutVisa));
        const hotelGroupOk = members.every((m: any) => Boolean(m.statutHotel));
        const flightGroupOk = members.every((m: any) => Boolean(m.statutVol));

        let finalStatus = reservation.status as string;
        if (reservation.status !== 'Complet') {
          let isUrgent = false;
          const deadlines = [
            { ok: passportGroupOk, date: reservation.program?.passportDeadline },
            { ok: visaGroupOk, date: reservation.program?.visaDeadline },
            { ok: hotelGroupOk, date: reservation.program?.hotelDeadline },
            { ok: flightGroupOk, date: reservation.program?.flightDeadline }
          ];
          for (const deadline of deadlines) {
            if (deadline.ok || !deadline.date) continue;
            const diff = (new Date(deadline.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            if (diff >= 0 && diff <= DAYS_URGENCY_WINDOW) {
              isUrgent = true;
              break;
            }
          }
          if (isUrgent) {
            finalStatus = 'Urgent';
          }
        }

        if (status && status !== 'all' && finalStatus !== status) {
          return acc;
        }

        acc.total += groupSize;
        if (finalStatus === 'Complet') acc.complete += groupSize;
        else if (finalStatus === 'Urgent') acc.urgent += groupSize;
        else acc.incomplete += groupSize;
        return acc;
      },
      { total: 0, complete: 0, incomplete: 0, urgent: 0 }
    );

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Error fetching reservation statistics' });
  }
});

// Get single room
router.get('/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const room = await prisma.room.findUnique({
      where: { id: parseInt(id) },
      include: {
        hotel: true
      }
    });
    
    if (!room) {
      return res.status(404).json({ error: 'Chambre non trouvée' });
    }
    
    res.json(room);
  } catch (error) {
    console.error('Erreur lors de la récupération de la chambre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Create reservation group (leader + accompagnants) in one transaction
router.post('/group', async (req, res) => {
  try {
    const {
      groupId,
      typeReservation = 'CHAMBRE_PRIVEE',
      familyMixed = true,
      roomType,
      roomMadinaId,
      roomMakkahId,
      occupants,
      leaderPrice,
      leaderPaidAmount = 0,
      reservationDate,
      common
    } = req.body;

    if (!Array.isArray(occupants) || occupants.length < 2) {
      return res.status(400).json({ error: 'Le groupe doit contenir au moins 2 personnes.' });
    }
    if (!roomType || !common?.programId) {
      return res.status(400).json({ error: 'Paramètres obligatoires manquants (programId/roomType).' });
    }
    if (!roomMadinaId || !roomMakkahId) {
      return res.status(400).json({ error: 'Les rooms Madina et Makkah sont obligatoires pour chambre privée.' });
    }

    const agentId = extractAgentIdFromToken(req);
    const groupSize = occupants.length;

    const result = await prisma.$transaction(async (tx) => {
      const [madinaRoom, makkahRoom] = await Promise.all([
        tx.room.findUnique({ where: { id: Number(roomMadinaId) } }),
        tx.room.findUnique({ where: { id: Number(roomMakkahId) } }),
      ]);

      if (!madinaRoom || !makkahRoom) {
        throw new Error('Une ou plusieurs rooms sont introuvables.');
      }
      if (madinaRoom.roomType !== roomType || makkahRoom.roomType !== roomType) {
        throw new Error('Le type de room sélectionné ne correspond pas au type de chambre demandé.');
      }
      if (madinaRoom.programId !== Number(common.programId) || makkahRoom.programId !== Number(common.programId)) {
        throw new Error('Les rooms sélectionnées ne sont pas liées au programme choisi.');
      }
      // Chambre privée = uniquement des rooms totalement vides au moment de la réservation
      if (madinaRoom.nbrPlaceRestantes !== madinaRoom.nbrPlaceTotal || makkahRoom.nbrPlaceRestantes !== makkahRoom.nbrPlaceTotal) {
        throw new Error('Chambre privée: seules les rooms totalement vides peuvent être réservées.');
      }
      if (madinaRoom.nbrPlaceRestantes < groupSize || makkahRoom.nbrPlaceRestantes < groupSize) {
        throw new Error('Pas assez de places disponibles pour cette chambre privée.');
      }

      const createdReservations = [];
      let leaderId: number | null = null;
      const normalizedGroupId = groupId || `GRP-${Date.now()}`;

      for (let i = 0; i < occupants.length; i += 1) {
        const person = occupants[i];
        const created: any = await tx.reservation.create({
          data: {
            firstName: person.firstName,
            lastName: person.lastName,
            phone: person.phone,
            passportNumber: person.passportNumber || null,
            groupId: normalizedGroupId,
            typeReservation,
            isLeader: i === 0,
            parentId: i === 0 ? null : leaderId,
            familyMixed: Boolean(familyMixed),
            roomSlot: i + 1,
            programId: Number(common.programId),
            roomType,
            gender: person.gender || "Homme",
            hotelMadina: common.hotelMadina,
            hotelMakkah: common.hotelMakkah,
            reservationDate: new Date(reservationDate),
            status: common.status || 'Incomplet',
            statutPasseport: Boolean(common.statutPasseport),
            statutVisa: Boolean(common.statutVisa),
            statutHotel: Boolean(common.statutHotel),
            statutVol: Boolean(common.statutVol),
            price: i === 0 ? Number(leaderPrice) : 0,
            paidAmount: i === 0 ? Number(leaderPaidAmount) : 0,
            reduction: i === 0 ? Number(common.reduction || 0) : 0,
            plan: common.plan || 'Normal',
            groupe: common.groupe || null,
            remarque: common.remarque || null,
            transport: common.transport || null,
            agentId
          } as any
        });

        if (i === 0) {
          leaderId = created.id;
        }
        createdReservations.push(created);
      }

      const createdIds = createdReservations.map(r => r.id);
      await Promise.all([
        tx.room.update({
          where: { id: madinaRoom.id },
          data: {
            nbrPlaceRestantes: madinaRoom.nbrPlaceRestantes - groupSize,
            listeIdsReservation: { push: createdIds }
          }
        }),
        tx.room.update({
          where: { id: makkahRoom.id },
          data: {
            nbrPlaceRestantes: makkahRoom.nbrPlaceRestantes - groupSize,
            listeIdsReservation: { push: createdIds }
          }
        })
      ]);

      return { leaderId, reservations: createdReservations, groupId: normalizedGroupId };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Erreur création groupe réservation:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur création groupe réservation' });
  }
});

// Get single reservation
router.get('/:id', async (req, res) => {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        parent: true,
        accompagnants: {
          include: {
            documents: true,
            payments: {
              include: {
                fichier: true
              }
            }
          }
        },
        program: true,
        documents: true,
        payments: {
          include: {
            fichier: true
          }
        }
      } as any,
    });
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    console.error('Erreur lors de la récupération de la réservation:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la réservation' });
  }
});

// Create new reservation
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, phone, passportNumber, groupe, remarque, transport, programId, roomType, gender, hotelMadina, hotelMakkah, price, reservationDate, status, statutPasseport, statutVisa, statutHotel, statutVol, paidAmount, reduction, roomMadinaId, roomMakkahId, plan, typeReservation, isLeader, parentId, groupId, familyMixed, roomSlot } = req.body;
    
    // Extraire l'agentId du token JWT
    const agentId = extractAgentIdFromToken(req);
    
    // Log des données reçues pour débogage
    console.log('🔍 Données reçues pour création de réservation:');
    console.log('- agentId:', agentId, 'Type:', typeof agentId);
    console.log('- statutVisa:', statutVisa, 'Type:', typeof statutVisa);
    console.log('- statutHotel:', statutHotel, 'Type:', typeof statutHotel);
    console.log('- statutVol:', statutVol, 'Type:', typeof statutVol);
    console.log('- reduction:', reduction, 'Type:', typeof reduction);
    console.log('- plan:', plan, 'Type:', typeof plan);
    
    // Créer la réservation sans les deadlines (elles seront récupérées via la relation program)
    const reservationCreateData: any = {
        firstName,
        lastName,
        phone,
        passportNumber: passportNumber || null,
        groupe: groupe || null,
        remarque: remarque || null,
        transport: transport || null,
        programId: Number(programId),
        roomType,
        gender: gender || "Homme",
        hotelMadina,
        hotelMakkah,
        price: parseFloat(price),
        reduction: reduction ? parseFloat(reduction) : 0,
        reservationDate: new Date(reservationDate),
        status,
        statutPasseport,
        statutVisa,
        statutHotel,
        statutVol,
        paidAmount: paidAmount ? parseFloat(paidAmount) : 0,
        plan: plan || "Normal",
        agentId: agentId, // Ajouter l'agentId extrait du token
        typeReservation: typeReservation || "LIT",
        isLeader: isLeader !== undefined ? Boolean(isLeader) : true,
        parentId: parentId ? Number(parentId) : null,
        groupId: groupId || null,
        familyMixed: familyMixed !== undefined ? Boolean(familyMixed) : false,
        roomSlot: roomSlot ? Number(roomSlot) : null
    };

    const reservation = await prisma.reservation.create({
      data: reservationCreateData,
      include: {
        program: true // Inclure le programme pour récupérer les deadlines
      }
    });
    
    // Log de la réservation créée pour débogage
    console.log('✅ Réservation créée avec succès:');
    console.log('- ID:', reservation.id);
    console.log('- agentId:', reservation.agentId);
    console.log('- statutVisa sauvegardé:', reservation.statutVisa);
    console.log('- statutHotel sauvegardé:', reservation.statutHotel);
    console.log('- statutVol sauvegardé:', reservation.statutVol);
    console.log('- reduction sauvegardée:', reservation.reduction);
    
    // Mettre à jour les chambres (Room) après la création de la réservation
    try {
      console.log('🔄 Mise à jour des chambres...');
      
      // Récupérer les informations de la réservation pour identifier les chambres
      const { roomType, gender, programId } = reservation;
      
      // Mettre à jour la chambre Madina si un ID est fourni
      if (roomMadinaId) {
        console.log('🏨 Mise à jour chambre Madina ID:', roomMadinaId);
        
        try {
          // Récupérer la chambre directement par son ID
          const roomMadina = await prisma.room.findUnique({
            where: { id: roomMadinaId }
          });
          
          if (roomMadina) {
            // Calculer le nombre de places à réserver selon le type de chambre
            const placesAReserver = getPlacesByRoomType(roomType);
            
            // Mettre à jour la chambre
            const updateData: any = {
              nbrPlaceRestantes: Math.max(0, roomMadina.nbrPlaceRestantes - placesAReserver),
              listeIdsReservation: {
                push: reservation.id
              }
            };
            
            // Si la chambre est de genre "Mixte", mettre à jour le gender avec celui du client
            if (roomMadina.gender === 'Mixte') {
              updateData.gender = gender;
              console.log('🔄 Chambre Madina de genre Mixte - mise à jour vers:', gender);
            }
            
            await prisma.room.update({
              where: { id: roomMadina.id },
              data: updateData
            });
            
            console.log('✅ Chambre Madina mise à jour:');
            console.log('   - Places restantes AVANT:', roomMadina.nbrPlaceRestantes);
            console.log('   - Places restantes APRÈS:', Math.max(0, roomMadina.nbrPlaceRestantes - placesAReserver));
            console.log('   - Réservation ajoutée à la liste');
            if (roomMadina.gender === 'Mixte') {
              console.log('   - Genre mis à jour de Mixte vers:', gender);
            }
          } else {
            console.log('⚠️ Chambre Madina non trouvée avec ID:', roomMadinaId);
          }
        } catch (error) {
          console.error('❌ Erreur mise à jour chambre Madina:', error);
        }
      }
      
      // Mettre à jour la chambre Makkah si un ID est fourni
      if (roomMakkahId) {
        console.log('🏨 Mise à jour chambre Makkah ID:', roomMakkahId);
        
        try {
          // Récupérer la chambre directement par son ID
          const roomMakkah = await prisma.room.findUnique({
            where: { id: roomMakkahId }
          });
          
          if (roomMakkah) {
            // Calculer le nombre de places à réserver selon le type de chambre
            const placesAReserver = getPlacesByRoomType(roomType);
            
            // Mettre à jour la chambre
            const updateDataMakkah: any = {
              nbrPlaceRestantes: Math.max(0, roomMakkah.nbrPlaceRestantes - placesAReserver),
              listeIdsReservation: {
                push: reservation.id
              }
            };
            
            // Si la chambre est de genre "Mixte", mettre à jour le gender avec celui du client
            if (roomMakkah.gender === 'Mixte') {
              updateDataMakkah.gender = gender;
              console.log('🔄 Chambre Makkah de genre Mixte - mise à jour vers:', gender);
            }
            
            await prisma.room.update({
              where: { id: roomMakkah.id },
              data: updateDataMakkah
            });
            
            console.log('✅ Chambre Makkah mise à jour:');
            console.log('   - Places restantes AVANT:', roomMakkah.nbrPlaceRestantes);
            console.log('   - Places restantes APRÈS:', Math.max(0, roomMakkah.nbrPlaceRestantes - placesAReserver));
            console.log('   - Réservation ajoutée à la liste');
            if (roomMakkah.gender === 'Mixte') {
              console.log('   - Genre mis à jour de Mixte vers:', gender);
            }
          } else {
            console.log('⚠️ Chambre Makkah non trouvée avec ID:', roomMakkahId);
          }
        } catch (error) {
          console.error('❌ Erreur mise à jour chambre Makkah:', error);
        }
      }
      
      console.log('✅ Mise à jour des chambres terminée');
    } catch (roomUpdateError) {
      console.error('❌ Erreur lors de la mise à jour des chambres:', roomUpdateError);
      // Ne pas faire échouer la création de la réservation si la mise à jour des chambres échoue
    }
    
    res.status(201).json(reservation);
  } catch (error) {
    console.error('Erreur création réservation:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la réservation' });
  }
});

const reservationJournalInclude = {
  program: { select: { id: true, name: true } },
  agent: { select: { id: true, nom: true } },
} as const;

// Update reservation
router.put('/:id', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      passportNumber,
      groupe,
      remarque,
      transport,
      programId,
      roomType,
      hotelMadina,
      hotelMakkah,
      price,
      reservationDate,
      documents,
      paiements,
      statutPasseport,
      statutVisa,
      statutHotel,
      statutVol,
      status
    } = req.body;

    console.log('📝 PUT /api/reservations/:id - Données reçues:', {
      id: req.params.id,
      price,
      reservationDate,
      statutPasseport,
      statutVisa,
      statutHotel,
      statutVol,
      status
    });

    const reservationId = parseInt(req.params.id);
    const beforeSnapshot = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationJournalInclude,
    });
    if (!beforeSnapshot) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    const currentReservation: any = {
      parentId: beforeSnapshot.parentId,
      paidAmount: beforeSnapshot.paidAmount,
      isLeader: beforeSnapshot.isLeader,
      groupId: beforeSnapshot.groupId,
    };
    const isAccompagnant = Boolean(beforeSnapshot.parentId);

    // Calculer le paidAmount à partir de tous les paiements de cette réservation
    const existingPayments = await prisma.payment.findMany({
      where: { reservationId }
    });
    
    const totalPaid = existingPayments.reduce((sum, payment) => sum + payment.amount, 0);
    console.log('💰 Calcul paidAmount:', {
      nombrePaiements: existingPayments.length,
      totalPaid
    });

    // Construire l'objet de mise à jour avec seulement les champs fournis
    const updateData: any = {};
    
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (passportNumber !== undefined) updateData.passportNumber = passportNumber || null;
    if (groupe !== undefined) updateData.groupe = groupe || null;
    if (remarque !== undefined) updateData.remarque = remarque || null;
    if (transport !== undefined) updateData.transport = transport || null;
    if (!isAccompagnant) {
      if (programId !== undefined) updateData.programId = programId;
      if (roomType !== undefined) updateData.roomType = roomType;
      if (hotelMadina !== undefined) updateData.hotelMadina = hotelMadina;
      if (hotelMakkah !== undefined) updateData.hotelMakkah = hotelMakkah;
      if (price !== undefined) updateData.price = price;
    }
    if (reservationDate !== undefined) updateData.reservationDate = new Date(reservationDate);
    
    // Ajouter les statuts (accepter false comme valeur valide)
    if (statutPasseport !== undefined) updateData.statutPasseport = statutPasseport;
    if (statutVisa !== undefined) updateData.statutVisa = statutVisa;
    if (statutHotel !== undefined) updateData.statutHotel = statutHotel;
    if (statutVol !== undefined) updateData.statutVol = statutVol;
    
    // Mettre à jour le statut global si fourni
    if (status !== undefined) updateData.status = status;
    
    // Mettre à jour paidAmount avec le total calculé
    updateData.paidAmount = isAccompagnant ? (currentReservation as any)?.paidAmount ?? 0 : totalPaid;

    console.log('🔄 Données à mettre à jour:', updateData);

    // Mettre à jour la réservation
    const reservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: updateData
    });

    // Si on met à jour un leader de groupe, propager les statuts partagés aux accompagnants
    if (!isAccompagnant && currentReservation?.isLeader && currentReservation?.groupId) {
      const sharedUpdateData: any = {};
      if (statutVisa !== undefined) sharedUpdateData.statutVisa = statutVisa;
      if (statutHotel !== undefined) sharedUpdateData.statutHotel = statutHotel;
      if (statutVol !== undefined) sharedUpdateData.statutVol = statutVol;
      if (status !== undefined) sharedUpdateData.status = status;
      if (reservationDate !== undefined) sharedUpdateData.reservationDate = new Date(reservationDate);

      if (Object.keys(sharedUpdateData).length > 0) {
        await prisma.reservation.updateMany({
          where: { parentId: reservationId },
          data: sharedUpdateData
        });
      }
    }

    console.log('✅ Réservation mise à jour:', {
      id: reservation.id,
      status: reservation.status,
      statutVisa: reservation.statutVisa,
      statutHotel: reservation.statutHotel,
      statutVol: reservation.statutVol,
      statutPasseport: reservation.statutPasseport,
      paidAmount: reservation.paidAmount
    });

    // Mettre à jour les fichiers
    if (documents) {
      // Supprimer les anciens fichiers
      await prisma.fichier.deleteMany({
        where: { reservationId: reservation.id }
      });

      // Créer les nouveaux fichiers
      for (const [type, url] of Object.entries(documents)) {
        if (url) {
          const fileName = path.basename(url as string);
          const extension = (fileName.split('.').pop() || '').toLowerCase();
          await prisma.fichier.create({
            data: {
              reservationId: reservation.id,
              fileType: type,
              fileName,
              storedName: fileName,
              filePath: url as string,
              fileCategory: extension
            }
          });
        }
      }
    }

    // Mettre à jour les paiements
    if (paiements && Array.isArray(paiements)) {
      // Supprimer les anciens paiements et fichiers associés
      const oldPayments = await prisma.payment.findMany({
        where: { reservationId: reservation.id },
        include: { fichier: true }
      });

      for (const payment of oldPayments) {
        if (payment.fichier) {
          await prisma.fichier.delete({
            where: { id: payment.fichier.id }
          });
        }
        await prisma.payment.delete({
          where: { id: payment.id }
        });
      }

      // Créer les nouveaux paiements
      for (const paiement of paiements) {
        if (paiement.recu) {
          const fichier = await prisma.fichier.create({
            data: {
              reservationId: reservation.id,
              fileType: 'payment',
              fileName: path.basename(paiement.recu),
              storedName: path.basename(paiement.recu),
              filePath: paiement.recu,
              fileCategory: (path.basename(paiement.recu).split('.').pop() || '').toLowerCase()
            }
          });

          await prisma.payment.create({
            data: {
              reservationId: reservation.id,
              amount: parseFloat(paiement.montant),
              paymentMethod: paiement.type,
              paymentDate: new Date(),
              fichierId: fichier.id,
              programId: reservation.programId
            }
          });
        }
      }
    }

    const afterSnapshot = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationJournalInclude,
    });
    if (afterSnapshot && beforeSnapshot) {
      const { summary: updSummary, detailText: updDetail } = buildReservationUpdateDetail(
        beforeSnapshot as ReservationJournalRow,
        afterSnapshot as ReservationJournalRow,
        'PUT'
      );
      await logJournalSuppression(prisma, req, {
        action: JOURNAL_ACTION.RESERVATION_UPDATED,
        entityType: 'Reservation',
        entityId: reservationId,
        summary: updSummary,
        detailText: updDetail,
      });
    }

    res.json(reservation);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la réservation:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la réservation' });
  }
});

// Patch reservation (for updating specific fields)
router.patch('/:id', async (req, res) => {
  try {
    const {
      documents,
      status,
      statutPasseport,
      statutVisa,
      statutHotel,
      statutVol
    } = req.body;

    const reservationId = parseInt(req.params.id);
    const beforeSnapshotPatch = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationJournalInclude,
    });
    if (!beforeSnapshotPatch) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }
    const isAccompagnant = Boolean(beforeSnapshotPatch.parentId);

    // Mettre à jour la réservation avec les statuts
    const reservation = await prisma.reservation.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status: status || undefined,
        statutPasseport: statutPasseport ?? undefined,
        statutVisa: statutVisa ?? undefined,
        statutHotel: statutHotel ?? undefined,
        statutVol: statutVol ?? undefined
      }
    });

    // Même propagation pour PATCH depuis un leader
    if (!isAccompagnant && beforeSnapshotPatch.isLeader && beforeSnapshotPatch.groupId) {
      const sharedUpdateData: any = {};
      if (status !== undefined) sharedUpdateData.status = status;
      if (statutVisa !== undefined) sharedUpdateData.statutVisa = statutVisa;
      if (statutHotel !== undefined) sharedUpdateData.statutHotel = statutHotel;
      if (statutVol !== undefined) sharedUpdateData.statutVol = statutVol;

      if (Object.keys(sharedUpdateData).length > 0) {
        await prisma.reservation.updateMany({
          where: { parentId: reservation.id },
          data: sharedUpdateData
        });
      }
    }

    // Mettre à jour les documents si fournis
    if (documents) {
      // Supprimer les anciens documents
      await prisma.fichier.deleteMany({
        where: { reservationId: reservation.id }
      });

      // Créer les nouveaux documents
      for (const [type, url] of Object.entries(documents)) {
        if (url) {
          const fileName = path.basename(url as string);
          const extension = (fileName.split('.').pop() || '').toLowerCase();
          await prisma.fichier.create({
            data: {
              reservationId: reservation.id,
              fileType: type,
              fileName,
              storedName: fileName,
              filePath: url as string,
              fileCategory: extension
            }
          });
        }
      }
    }

    const afterSnapshotPatch = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationJournalInclude,
    });
    if (afterSnapshotPatch) {
      const { summary: pSummary, detailText: pDetail } = buildReservationUpdateDetail(
        beforeSnapshotPatch as ReservationJournalRow,
        afterSnapshotPatch as ReservationJournalRow,
        'PATCH'
      );
      await logJournalSuppression(prisma, req, {
        action: JOURNAL_ACTION.RESERVATION_UPDATED,
        entityType: 'Reservation',
        entityId: reservationId,
        summary: pSummary,
        detailText: pDetail,
      });
    }

    res.json(reservation);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la réservation:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la réservation' });
  }
});

// Delete reservation
router.delete('/:id', async (req, res) => {
  try {
    const reservationId = parseInt(req.params.id);
    if (isNaN(reservationId)) {
      return res.status(400).json({ error: 'ID de réservation invalide' });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        isLeader: true,
        groupId: true,
        parentId: true,
      },
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    /** Suppression du leader d'un groupe (chambre privée ou lit avec accompagnants) = tous les membres + libération des rooms */
    let reservationIdsToRemove: number[] = [reservationId];
    if (reservation.isLeader) {
      if (reservation.groupId) {
        const members = await prisma.reservation.findMany({
          where: { groupId: reservation.groupId },
          select: { id: true },
        });
        reservationIdsToRemove = members.map((m) => m.id);
      } else {
        const kids = await prisma.reservation.findMany({
          where: { parentId: reservation.id },
          select: { id: true },
        });
        if (kids.length > 0) {
          reservationIdsToRemove = [reservation.id, ...kids.map((k) => k.id)];
        }
      }
    }

    const idsSet = new Set(reservationIdsToRemove);

    const fullRows = await prisma.reservation.findMany({
      where: { id: { in: reservationIdsToRemove } },
      include: {
        program: { select: { id: true, name: true } },
        agent: { select: { id: true, nom: true } },
      },
    });
    const { summary: journalSummary, detailText: journalDetail } =
      buildReservationDeletionDetail(fullRows);

    // 1. Récupérer tous les fichiers liés à chaque réservation concernée
    const fichiers = await prisma.fichier.findMany({
      where: { reservationId: { in: reservationIdsToRemove } },
    });
    // 2. Supprimer physiquement chaque fichier du disque
    for (const fichier of fichiers) {
      if (fichier.filePath) {
        // filePath est relatif à backend/uploads
        const absolutePath = path.join(__dirname, '../../uploads', ...fichier.filePath.replace(/^\/|\//, '').split('/').slice(1));
        try {
          if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
          }
        } catch (err) {
          console.error('Erreur lors de la suppression physique du fichier:', absolutePath, err);
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // 3. Supprimer/neutraliser les dépenses liées
      await tx.expense.deleteMany({
        where: { reservationId: { in: reservationIdsToRemove } },
      });

      // 4. Mettre à jour les rooms impactées (retirer tous les IDs du groupe, libérer toutes les places)
      const roomsToUpdate = await tx.room.findMany({
        where: {
          listeIdsReservation: {
            hasSome: reservationIdsToRemove,
          },
        },
      });

      for (const room of roomsToUpdate) {
        const updatedReservationIds = room.listeIdsReservation.filter((id) => !idsSet.has(id));
        const recalculatedRemaining = Math.max(0, room.nbrPlaceTotal - updatedReservationIds.length);

        await tx.room.update({
          where: { id: room.id },
          data: {
            listeIdsReservation: updatedReservationIds,
            nbrPlaceRestantes: recalculatedRemaining,
          },
        });
      }

      // 5. Supprimer les réservations : accompagnants d'abord (FK parent), puis leader(s)
      await tx.reservation.deleteMany({
        where: {
          id: { in: reservationIdsToRemove },
          isLeader: false,
        },
      });
      await tx.reservation.deleteMany({
        where: {
          id: { in: reservationIdsToRemove },
          isLeader: true,
        },
      });
    });

    if (fullRows.length > 0) {
      await logJournalSuppression(prisma, req, {
        action: JOURNAL_ACTION.RESERVATION_DELETED,
        entityType: 'Reservation',
        entityId: fullRows[0].id,
        summary: journalSummary,
        detailText: journalDetail,
      });
    }

    res.json({ message: 'Réservation supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la réservation:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la réservation' });
  }
});

// Nouvelle route pour récupérer les fichiers liés à une réservation
router.get('/:reservationId/files', async (req, res) => {
  try {
    const reservationId = parseInt(req.params.reservationId);
    if (isNaN(reservationId)) {
      return res.status(400).json({ error: 'ID de réservation invalide' });
    }
    const fichiers = await prisma.fichier.findMany({
      where: { reservationId },
      select: {
        id: true,
        fileName: true,
        storedName: true,
        fileType: true,
        filePath: true,
        uploaded_at: true
      }
    });
    res.json(fichiers);
  } catch (error) {
    console.error('Erreur lors de la récupération des fichiers:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des fichiers' });
  }
});

const getRowColor = (reservation: any) => {
  if (reservation.statut === "Complet") return "border-l-4 border-green-500 bg-green-50"
  if (reservation.statut === "Urgent" || reservation.echeanceProche)
    return "border-l-8 border-red-700 bg-red-100/90 shadow-lg"
  return "border-l-4 border-yellow-500 bg-yellow-50"
}

export default router; 