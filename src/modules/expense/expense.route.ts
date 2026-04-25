import { Router } from 'express';
import * as expenseController from './expense.controller.ts';
import * as expenseRender from '../../view/render/expense.render.ts';
import { authMiddleware } from '../../middlewares/auth.middleware.ts';

const router = Router();

router.use(authMiddleware);

router.get('/', expenseRender.renderExpenses);
router.get('/add', expenseRender.renderAddExpense);
router.post('/add', expenseController.addExpense);

export default router;
