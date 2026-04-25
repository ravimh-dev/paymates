import { Request, Response } from 'express';
import { query } from '../../db/index.ts';
import { settlementService } from '../../modules/settlement/settlement.service.ts';

export const renderSettlementPlan = async (req: any, res: Response) => {
    try {
        const groupId = req.params.groupId;
        const plan = await settlementService.computeOptimizedPlan(groupId);
        const resGroup = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
        const group = resGroup.rows[0];

        res.render('pages/settlement-plan', { 
            title: 'Settlement Plan', 
            plan, 
            group 
        });
    } catch (error: any) {
        res.redirect('/groups');
    }
};

