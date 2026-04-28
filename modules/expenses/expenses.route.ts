import { Router } from 'express';
import * as expenseController from './expenses.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import {
  createExpenseValidation,
  updateExpenseValidation,
  listExpensesValidation,
} from './expenses.validation';

const router = Router();

router.use(authenticate);

router.post('/', createExpenseValidation, expenseController.createExpense);
router.get('/', listExpensesValidation, expenseController.listExpenses);
router.get('/:expenseId', expenseController.getExpense);
router.put('/:expenseId', updateExpenseValidation, expenseController.updateExpense);
router.delete('/:expenseId', expenseController.deleteExpense);

export default router;
