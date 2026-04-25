import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { StatusCodes } from 'http-status-codes';
import { query, clientQuery } from '../../db/index.ts';
import { sendSuccess, sendError } from '../../utils/response-generator.ts';

export const addExpense = async (req: any, res: Response) => {
    const { groupId, description, amount, payerId, category, participants } = req.body;
    const participantList = Array.isArray(participants) ? participants : (participants ? [participants] : []);

    const client = await clientQuery();
    try {
        if (participantList.length === 0) {
            return sendError(res, 'At least one participant required', StatusCodes.BAD_REQUEST);
        }

        const floatAmount = parseFloat(amount);
        const splitAmount = floatAmount / participantList.length;

        const expenseId = uuidv4();
        
        await client.query('BEGIN');
        await client.query(
            'INSERT INTO expenses (id, group_id, description, amount, payer_id, category) VALUES ($1, $2, $3, $4, $5, $6)',
            [expenseId, groupId, description, floatAmount, payerId, category]
        );

        for (const userId of participantList) {
            await client.query(
                'INSERT INTO expense_splits (id, expense_id, user_id, amount, split_type) VALUES ($1, $2, $3, $4, $5)',
                [uuidv4(), expenseId, userId, splitAmount, 'Equal']
            );
        }
        await client.query('COMMIT');

        return sendSuccess(res, { id: expenseId }, 'Expense added successfully', StatusCodes.CREATED);
    } catch (error: any) {
        await client.query('ROLLBACK');
        return sendError(res, error.message || 'Failed to add expense');
    } finally {
        client.release();
    }
};

