import { Router } from 'express';
import { PVController } from '@controllers/pv.controller';

const router = Router();

router.post('/', PVController.generer);
router.get('/:id', PVController.getOne);

export default router;
