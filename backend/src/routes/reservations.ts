import express from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();

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
    const where: any = {};
    
    if (program && program !== 'tous') {
      where.program = {
        name: program
      };
    }
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (roomType && roomType !== 'toutes') {
      where.roomType = roomType;
    }

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
        }
      },
      orderBy: {
        created_at: 'desc'
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
    const { program, roomType, dateFrom, dateTo } = req.query;
    
    // Construire les filtres pour les stats
    const where: any = {};
    
    if (program && program !== 'tous') {
      where.program = {
        name: program
      };
    }
    
    if (roomType && roomType !== 'toutes') {
      where.roomType = roomType;
    }
    
    if (dateFrom || dateTo) {
      where.reservationDate = {};
      if (dateFrom) {
        where.reservationDate.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.reservationDate.lte = new Date(dateTo as string);
      }
    }

    const totalReservations = await prisma.reservation.count({ where });
    
    const completReservations = await prisma.reservation.count({
      where: {
        ...where,
        status: 'COMPLETED'
      }
    });
    
    const incompletReservations = await prisma.reservation.count({
      where: {
        ...where,
        status: 'PENDING'
      }
    });
    
    const urgentReservations = await prisma.reservation.count({
      where: {
        ...where,
        status: 'CONFIRMED'
      }
    });

    res.json({
      total: totalReservations,
      complet: completReservations,
      incomplet: incompletReservations,
      urgent: urgentReservations
    });
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

// Get single reservation
router.get('/:id', async (req, res) => {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        program: true,
        documents: true,
        payments: {
          include: {
            fichier: true
          }
        }
      },
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
    const { firstName, lastName, phone, programId, roomType, gender, hotelMadina, hotelMakkah, price, reservationDate, status, statutPasseport, statutVisa, statutHotel, statutVol, paidAmount, reduction, roomMadinaId, roomMakkahId } = req.body;
    
    // Extraire l'agentId du token JWT
    const agentId = extractAgentIdFromToken(req);
    
    // Log des données reçues pour débogage
    console.log('🔍 Données reçues pour création de réservation:');
    console.log('- agentId:', agentId, 'Type:', typeof agentId);
    console.log('- statutVisa:', statutVisa, 'Type:', typeof statutVisa);
    console.log('- statutHotel:', statutHotel, 'Type:', typeof statutHotel);
    console.log('- statutVol:', statutVol, 'Type:', typeof statutVol);
    console.log('- reduction:', reduction, 'Type:', typeof reduction);
    
    // Créer la réservation sans les deadlines (elles seront récupérées via la relation program)
    const reservation = await prisma.reservation.create({
      data: {
        firstName,
        lastName,
        phone,
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
        agentId: agentId // Ajouter l'agentId extrait du token
      },
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

// Update reservation
router.put('/:id', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
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

    // Calculer le paidAmount à partir de tous les paiements de cette réservation
    const existingPayments = await prisma.payment.findMany({
      where: { reservationId: parseInt(req.params.id) }
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
    if (programId !== undefined) updateData.programId = programId;
    if (roomType !== undefined) updateData.roomType = roomType;
    if (hotelMadina !== undefined) updateData.hotelMadina = hotelMadina;
    if (hotelMakkah !== undefined) updateData.hotelMakkah = hotelMakkah;
    if (price !== undefined) updateData.price = price;
    if (reservationDate !== undefined) updateData.reservationDate = new Date(reservationDate);
    
    // Ajouter les statuts (accepter false comme valeur valide)
    if (statutPasseport !== undefined) updateData.statutPasseport = statutPasseport;
    if (statutVisa !== undefined) updateData.statutVisa = statutVisa;
    if (statutHotel !== undefined) updateData.statutHotel = statutHotel;
    if (statutVol !== undefined) updateData.statutVol = statutVol;
    
    // Mettre à jour le statut global si fourni
    if (status !== undefined) updateData.status = status;
    
    // Mettre à jour paidAmount avec le total calculé
    updateData.paidAmount = totalPaid;

    console.log('🔄 Données à mettre à jour:', updateData);

    // Mettre à jour la réservation
    const reservation = await prisma.reservation.update({
      where: { id: parseInt(req.params.id) },
      data: updateData
    });

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
    // 1. Récupérer tous les fichiers liés à la réservation
    const fichiers = await prisma.fichier.findMany({
      where: { reservationId },
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
    // 3. Supprimer la réservation (CASCADE pour fichiers et paiements)
    await prisma.reservation.delete({
      where: { id: reservationId }
    });
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