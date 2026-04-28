import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as expenseService from './expenses.service';
import {
  sendSuccess, sendCreated, sendValidationError,
} from '../../utils/response-generator';

export const createExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }
    const expense = await expenseService.createExpense(req.user!.id, req.body);
    sendCreated(res, expense, 'Expense created');
  } catch (err) { next(err); }
};

export const getExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const expense = await expenseService.getExpenseById(req.params.expenseId, req.user!.id);
    sendSuccess(res, expense, 'Expense fetched');
  } catch (err) { next(err); }
};

export const listExpenses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const filters = {
      groupId: req.query.groupId as string,
      category: req.query.category as string | undefined,
      paidBy: req.query.paidBy as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const { expenses, total } = await expenseService.listExpenses(filters, req.user!.id);
    sendSuccess(res, expenses, 'Expenses fetched', 200, {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    });
  } catch (err) { next(err); }
};

export const updateExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }
    const expense = await expenseService.updateExpense(req.params.expenseId, req.body, req.user!.id);
    sendSuccess(res, expense, 'Expense updated');
  } catch (err) { next(err); }
};

export const deleteExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await expenseService.deleteExpense(req.params.expenseId, req.user!.id);
    sendSuccess(res, null, 'Expense deleted');
  } catch (err) { next(err); }
};
