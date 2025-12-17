import { Request, Response } from 'express';
import { PVService } from '../services/pv.service';

export class PVController {

  static async genererPV(req: Request, res: Response) {
    try {
      const pv = await PVService.genererPV(req.body);
      res.status(201).json(pv);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
