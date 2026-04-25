import { Request, Response } from 'express';
import { query } from '../../db/index.ts';

export const renderExpenses = async (req: any, res: Response) => {
    const groupId = req.query.groupId;
    let expenses;
    if (groupId) {
        const resExp = await query(`
            SELECT e.*, u.name as payer_name, g.name as group_name
            FROM expenses e
            JOIN users u ON e.payer_id = u.id
            JOIN groups g ON e.group_id = g.id
            WHERE e.group_id = $1
            ORDER BY e.expense_date DESC
        `, [groupId]);
        expenses = resExp.rows;
    } else {
        const resExp = await query(`
            SELECT e.*, u.name as payer_name, g.name as group_name
            FROM expenses e
            JOIN users u ON e.payer_id = u.id
            JOIN groups g ON e.group_id = g.id
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = $1
            ORDER BY e.expense_date DESC
        `, [req.user.id]);
        expenses = resExp.rows;
    }
    res.render('pages/expenses', { title: 'Expenses', expenses, groupId });
};

export const renderAddExpense = async (req: Request, res: Response) => {
    const groupId = req.query.groupId;
    if (!groupId) return res.redirect('/groups');

    const resMembers = await query(`
        SELECT u.id, u.name 
        FROM users u
        JOIN group_members gm ON u.id = gm.user_id
        WHERE gm.group_id = $1
    `, [groupId]);

    res.render('pages/add-expense', { title: 'Add Expense', groupId, members: resMembers.rows, error: null });
};

