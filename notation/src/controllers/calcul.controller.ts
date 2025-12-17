import { Request, Response } from 'express';
import { CalculService } from '../services/calcul.service';

export class CalculController {

  static async calculerMoyenneUE(req: Request, res: Response) {
    try {
      const { matricule, codeUE } = req.body;
      const resultat = await CalculService.calculerMoyenneUE(
        matricule,
        codeUE
      );
      res.json(resultat);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
