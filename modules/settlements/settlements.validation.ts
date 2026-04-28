import { body, param, query } from 'express-validator';

export const executeSettlementValidation = [
  body('group_id').isUUID().withMessage('Invalid group ID'),
  body('from_user_id').isUUID().withMessage('Invalid from_user_id'),
  body('to_user_id').isUUID().withMessage('Invalid to_user_id'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive'),
  body('settlement_type').optional().isIn(['full', 'partial']).withMessage('Must be full or partial'),
  body('notes').optional().isString().isLength({ max: 500 }),
  body('idempotency_key').optional().isString().isLength({ max: 100 }),
];

export const settlementHistoryValidation = [
  param('groupId').isUUID().withMessage('Invalid group ID'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];
