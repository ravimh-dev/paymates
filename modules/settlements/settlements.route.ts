import { Router } from 'express';
import * as settlementController from './settlements.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { executeSettlementValidation, settlementHistoryValidation } from './settlements.validation';

const router = Router();
router.use(authenticate);

router.get('/plan/:groupId', settlementController.getPlan);
router.get('/:groupId/export/pdf', settlementController.exportPdf);
router.post('/execute', executeSettlementValidation, settlementController.execute);
router.get('/history/:groupId', settlementHistoryValidation, settlementController.history);
router.patch('/:settlementId/cancel', settlementController.cancel);

export default router;
