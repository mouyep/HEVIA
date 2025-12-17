import { Request, Response } from 'express';
import { UEService } from '@services/ue.service';

const service = new UEService();

export class UEController {

  static async create(req: Request, res: Response) {
    const ue = await service.createUE(req.body);
    res.status(201).json(ue);
  }

  static async update(req: Request, res: Response) {
    const ue = await service.updateUE(req.params.codeUE, req.body);
    res.json(ue);
  }

  static async getOne(req: Request, res: Response) {
    const ue = await service.getUEWithDetails(req.params.codeUE);
    res.json(ue);
  }

  static async list(req: Request, res: Response) {
    const result = await service.listUE(req.query);
    res.json(result);
  }

  static async delete(req: Request, res: Response) {
    await service.deleteUE(req.params.codeUE);
    res.status(204).send();
  }
}
