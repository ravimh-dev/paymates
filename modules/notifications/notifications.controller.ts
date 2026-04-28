import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as notificationService from './notifications.service';
import { sendSuccess, sendCreated, sendValidationError } from '../../utils/response-generator';

export const listNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendValidationError(res, errors.array());
      return;
    }

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const unreadOnly = String(req.query.unreadOnly) === 'true';

    const result = await notificationService.listNotifications(req.user!.id, {
      page,
      limit,
      unreadOnly,
    });

    sendSuccess(res, result.notifications, 'Notifications fetched', 200, {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (err) {
    next(err);
  }
};

export const unreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const count = await notificationService.getUnreadNotificationCount(req.user!.id);
    sendSuccess(res, { count }, 'Unread notification count fetched');
  } catch (err) {
    next(err);
  }
};

export const markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendValidationError(res, errors.array());
      return;
    }

    await notificationService.markNotificationRead(req.params.notificationId, req.user!.id);
    sendSuccess(res, null, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
};

export const markAllRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await notificationService.markAllNotificationsRead(req.user!.id);
    sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
};
