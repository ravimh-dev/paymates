import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/index.ts';
import { JWTPayload } from '../user/user.type.ts';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret-key';

export const authService = {
  async getUserByEmail(email: string) {
    const res = await query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    return res.rows[0];
  },

  async verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  },

  generateAccessToken(payload: any) {
    return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '1d' });
  },

  async register(data: any) {
    const { name, email, password } = data;
    
    const existingRes = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingRes.rows.length > 0) throw new Error('Email already registered');

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await query('INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)', [id, name, email, hashedPassword]);

    return { id, name, email };
  },

  async login(data: any) {
    const { email, password } = data;
    
    const user: any = await this.getUserByEmail(email);
    if (!user) throw new Error('Invalid credentials');

    const isMatch = await this.verifyPassword(password, user.password);
    if (!isMatch) throw new Error('Invalid credentials');

    const payload: JWTPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = this.generateAccessToken(payload);

    return { user: payload, token };
  }
};

