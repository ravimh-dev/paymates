import { Router } from 'express';
import * as notificationController from './notifications.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import {
  listNotificationsValidation,
  notificationIdValidation,
} from './notifications.validation';

const router = Router();

router.use(authenticate);

router.get('/', listNotificationsValidation, notificationController.listNotifications);
router.get('/unread-count', notificationController.unreadCount);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:notificationId/read', notificationIdValidation, notificationController.markRead);

export default router;
