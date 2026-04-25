import { v4 as uuidv4 } from 'uuid';
import { query, clientQuery } from '../../db/index.ts';

export const groupService = {
  async createGroup(userId: string, data: any) {
    const { name, description } = data;
    const id = uuidv4();

    const client = await clientQuery();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO groups (id, name, description, created_by) VALUES ($1, $2, $3, $4)', [id, name, description, userId]);
      await client.query('INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)', [id, userId, 'Admin']);
      await client.query('COMMIT');
      return { id, name };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async getUserGroups(userId: string) {
    const res = await query(`
      SELECT g.*, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = $1
      ORDER BY g.created_at DESC
    `, [userId]);
    return res.rows;
  },

  async getGroupDetails(groupId: string) {
    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
    const group = groupRes.rows[0];
    if (!group) throw new Error('Group not found');
    
    const membersRes = await query(`
      SELECT gm.*, u.name, u.email
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
    `, [groupId]);

    return { group, members: membersRes.rows };
  },

  async addMemberByEmail(groupId: string, email: string, role: string) {
    const userRes = await query('SELECT id FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    if (!user) throw new Error('User not found by email. They must register first.');

    const existingRes = await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, user.id]);
    if (existingRes.rows.length > 0) throw new Error('User already in group');

    await query('INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)', [groupId, user.id, role]);
  }
};

