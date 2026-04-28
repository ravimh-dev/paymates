import { body, query, param } from 'express-validator';

export const createExpenseValidation = [
  body('group_id').isUUID().withMessage('Invalid group ID'),
  body('paid_by').isUUID().withMessage('Invalid payer user ID'),
  body('description').trim().notEmpty().withMessage('Description required')
    .isLength({ max: 255 }).withMessage('Description max 255 chars'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive'),
  body('currency').optional().isLength({ min: 3, max: 3 }).toUpperCase(),
  body('category').optional()
    .isIn(['food','transport','accommodation','entertainment','utilities','shopping','healthcare','other'])
    .withMessage('Invalid category'),
  body('split_type').isIn(['equal', 'percentage', 'custom']).withMessage('Invalid split type'),
  body('participants').optional().isArray({ min: 1 }).withMessage('Participants must be a non-empty array'),
  body('participants.*').optional().isUUID().withMessage('Each participant must be a valid UUID'),
  body('splits').optional().isArray({ min: 1 }),
  body('splits.*.user_id').optional().isUUID(),
  body('splits.*.amount').optional().isFloat({ min: 0 }),
  body('splits.*.percentage').optional().isFloat({ min: 0, max: 100 }),
  body('expense_date').optional().isDate().withMessage('Invalid date format'),
];

export const updateExpenseValidation = [
  param('expenseId').isUUID().withMessage('Invalid expense ID'),
  body('description').optional().trim().isLength({ max: 255 }),
  body('category').optional()
    .isIn(['food','transport','accommodation','entertainment','utilities','shopping','healthcare','other']),
  body('expense_date').optional().isDate(),
];

export const listExpensesValidation = [
  query('groupId').isUUID().withMessage('Group ID required'),
  query('category').optional()
    .isIn(['food','transport','accommodation','entertainment','utilities','shopping','healthcare','other']),
  query('paidBy').optional().isUUID(),
  query('dateFrom').optional().isDate(),
  query('dateTo').optional().isDate(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];
