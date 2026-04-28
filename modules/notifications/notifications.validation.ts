import { body, param, query } from 'express-validator';

export const listNotificationsValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('unreadOnly').optional().isBoolean().withMessage('unreadOnly must be true or false'),
];

export const notificationIdValidation = [
  param('notificationId').isUUID().withMessage('notificationId must be a valid UUID'),
];

export const importExpensesValidation = [
  body('groupId').isUUID().withMessage('groupId must be a valid UUID'),
  body('content').isString().notEmpty().withMessage('content is required'),
  body('delimiter').optional().isIn(['csv', 'tsv', 'auto']).withMessage('delimiter must be csv, tsv, or auto'),
  body('dryRun').optional().isBoolean().withMessage('dryRun must be true or false'),
];
