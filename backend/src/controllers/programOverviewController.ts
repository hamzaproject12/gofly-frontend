import { Request, Response } from 'express';
import { ProgramOverviewService } from '../services/programOverviewService';

export class ProgramOverviewController {
  // Récupérer un programme spécifique avec toutes ses statistiques
  static async getProgramOverview(req: Request, res: Response) {
    try {
      const programId = parseInt(req.params.id);
      
      if (isNaN(programId)) {
        return res.status(400).json({ 
          error: 'ID de programme invalide' 
        });
      }

      const overview = await ProgramOverviewService.getProgramOverview(programId);
      
      if (!overview) {
        return res.status(404).json({ 
          error: 'Programme non trouvé' 
        });
      }

      res.json(overview);
    } catch (error) {
      console.error('Error in getProgramOverview controller:', error);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des données du programme',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }

  // Récupérer tous les programmes avec leurs statistiques
  static async getAllProgramsOverview(req: Request, res: Response) {
    try {
      const overviews = await ProgramOverviewService.getAllProgramsOverview();
      
      // Log pour debug
      const deletedPrograms = overviews.filter(p => p.isDeleted);
      console.log(`📊 Total programmes: ${overviews.length}, Supprimés: ${deletedPrograms.length}`);
      if (deletedPrograms.length > 0) {
        console.log('🗑️ Programmes supprimés:', deletedPrograms.map(p => ({ id: p.id, name: p.name, deletedAt: p.deletedAt })));
      }
      
      res.json({
        programs: overviews,
        total: overviews.length
      });
    } catch (error) {
      console.error('Error in getAllProgramsOverview controller:', error);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des programmes',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }

  // Récupérer les statistiques globales de tous les programmes
  static async getGlobalStats(req: Request, res: Response) {
    try {
      const overviews = await ProgramOverviewService.getAllProgramsOverview();
      
      const globalStats = {
        totalPrograms: overviews.length,
        totalRevenue: overviews.reduce((sum, prog) => sum + prog.totalRevenue, 0),
        totalExpenses: overviews.reduce((sum, prog) => sum + prog.totalExpenses, 0),
        totalProfit: overviews.reduce((sum, prog) => sum + prog.netProfit, 0),
        totalReservations: overviews.reduce((sum, prog) => sum + prog.totalReservations, 0),
        completedReservations: overviews.reduce((sum, prog) => sum + prog.completedReservations, 0),
        pendingReservations: overviews.reduce((sum, prog) => sum + prog.pendingReservations, 0)
      };

      res.json(globalStats);
    } catch (error) {
      console.error('Error in getGlobalStats controller:', error);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des statistiques globales',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }
}
