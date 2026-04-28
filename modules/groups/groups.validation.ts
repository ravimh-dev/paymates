import { body, param } from 'express-validator';

export const createGroupValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Group name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description max 500 characters'),

  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code')
    .toUpperCase(),
];

export const updateGroupValidation = [
  param('groupId').isUUID().withMessage('Invalid group ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description max 500 characters'),

  body('status')
    .optional()
    .isIn(['active', 'settling', 'archived']).withMessage('Invalid status'),
];

export const addMemberValidation = [
  param('groupId').isUUID().withMessage('Invalid group ID'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('role')
    .optional()
    .isIn(['member', 'viewer']).withMessage('Role must be member or viewer'),
];
