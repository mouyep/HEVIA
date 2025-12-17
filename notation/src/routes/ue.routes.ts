import { Router } from 'express';
import { UEController } from '@controllers/ue.controller';

const router = Router();

router.post('/', UEController.create);
router.get('/', UEController.list);
router.get('/:codeUE', UEController.getOne);
router.put('/:codeUE', UEController.update);
router.delete('/:codeUE', UEController.delete);

export default router;
