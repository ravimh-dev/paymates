import { Router } from 'express';
import * as groupController from './groups.controller';
import { authenticate, requireAdmin, requireMemberOrAdmin } from '../../middlewares/auth.middleware';
import { createGroupValidation, updateGroupValidation, addMemberValidation } from './groups.validation';

const router = Router();

router.use(authenticate);

router.get('/', groupController.listGroups);
router.post('/', createGroupValidation, groupController.createGroup);

router.get('/join/:token', groupController.joinGroup);

router.get('/:groupId', groupController.getGroup);
router.put('/:groupId', updateGroupValidation, requireAdmin, groupController.updateGroup);
router.delete('/:groupId', requireAdmin, groupController.deleteGroup);

router.get('/:groupId/balances', groupController.getBalances);
router.get('/:groupId/invite', requireAdmin, groupController.getInviteLink);

router.post('/:groupId/members', addMemberValidation, requireAdmin, groupController.addMember);
router.delete('/:groupId/members/:userId', requireAdmin, groupController.removeMember);

export default router;
