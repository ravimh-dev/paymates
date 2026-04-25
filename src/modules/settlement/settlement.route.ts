import { Router } from 'express';
import * as settlementRender from '../../view/render/settlement.render.ts';
import { authMiddleware } from '../../middlewares/auth.middleware.ts';

const router = Router();

router.use(authMiddleware);

router.get('/optimize/:groupId', settlementRender.renderSettlementPlan);

router.post('/mark-settled', async (req: any, res) => {
  const { groupId } = req.body;
  res.redirect(`/groups/${groupId}`);
});

export default router;
