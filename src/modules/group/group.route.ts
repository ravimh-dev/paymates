import { Router } from 'express';
import * as groupController from './group.controller.ts';
import * as groupRender from '../../view/render/group.render.ts';
import { authMiddleware } from '../../middlewares/auth.middleware.ts';

const router = Router();

router.use(authMiddleware);

router.get('/', groupRender.renderGroups);
router.get('/create', groupRender.renderCreateGroup);
router.post('/create', groupController.create);
router.get('/:id', groupRender.renderGroupDetails);
router.post('/:id/invite', groupController.invite);

export default router;
