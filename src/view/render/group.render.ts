import { Request, Response } from 'express';
import { query } from '../../db/index.ts';

export const renderGroups = async (req: any, res: Response) => {
    const resGroups = await query(`
        SELECT g.*, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
        FROM groups g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = $1
        ORDER BY g.created_at DESC
    `, [req.user.id]);
    res.render('pages/groups', { title: 'My Groups', groups: resGroups.rows });
};

export const renderCreateGroup = (req: Request, res: Response) => {
    res.render('pages/create-group', { title: 'Create Group', error: null });
};

export const renderGroupDetails = async (req: any, res: Response) => {
    try {
        const resGroup = await query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
        const group = resGroup.rows[0];
        if (!group) return res.redirect('/groups');
        
        const resMembers = await query(`
            SELECT gm.*, u.name, u.email
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = $1
        `, [req.params.id]);

        const resExpenses = await query(`
            SELECT e.*, u.name as payer_name
            FROM expenses e
            JOIN users u ON e.payer_id = u.id
            WHERE e.group_id = $1
            ORDER BY e.expense_date DESC
        `, [req.params.id]);

        res.render('pages/group-details', { 
            title: group.name, 
            group, 
            members: resMembers.rows, 
            expenses: resExpenses.rows, 
            error: null 
        });
    } catch (error) {
        res.redirect('/groups');
    }
};

