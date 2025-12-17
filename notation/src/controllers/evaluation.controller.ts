import { Request, Response } from 'express';
import { EvaluationService } from '../services/evaluation.service';

export class EvaluationController {

  static async ajouterNote(req: Request, res: Response) {
    try {
      const note = await EvaluationService.ajouterNote(req.body);
      res.status(201).json(note);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async notesEtudiant(req: Request, res: Response) {
    try {
      const notes = await EvaluationService.getNotesEtudiant(
        req.params.matricule
      );
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
