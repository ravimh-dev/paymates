import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { AppError } from './error.middleware';
import { HTTP_STATUS, ROLES } from '../utils/constants';

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.access_token;

    if (!token) {
      throw new AppError('Authentication token required', HTTP_STATUS.UNAUTHORIZED);
    }

    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new AppError('Server configuration error', HTTP_STATUS.INTERNAL_SERVER_ERROR);

    const payload = jwt.verify(token, secret) as JwtPayload;

    const result = await pool.query(
      'SELECT id, email, name FROM users WHERE id = $1 AND deleted_at IS NULL AND is_active = true',
      [payload.userId]
    );

    if (!result.rows[0]) {
      throw new AppError('User not found or inactive', HTTP_STATUS.UNAUTHORIZED);
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * RBAC guard — checks user's role within a specific group.
 * Requires :groupId param on the route.
 */
export const requireGroupRole = (...allowedRoles: string[]) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const groupId = req.params.groupId || req.body.group_id;
      const userId = req.user?.id;

      if (!groupId || !userId) {
        throw new AppError('Group context required', HTTP_STATUS.BAD_REQUEST);
      }

      const result = await pool.query(
        `SELECT role FROM group_members
         WHERE group_id = $1 AND user_id = $2 AND removed_at IS NULL`,
        [groupId, userId]
      );

      if (!result.rows[0]) {
        throw new AppError('You are not a member of this group', HTTP_STATUS.FORBIDDEN);
      }

      if (!allowedRoles.includes(result.rows[0].role)) {
        throw new AppError('Insufficient permissions', HTTP_STATUS.FORBIDDEN);
      }

      next();
    } catch (err) {
      next(err);
    }
  };

export const requireAdmin = requireGroupRole(ROLES.ADMIN);
export const requireMemberOrAdmin = requireGroupRole(ROLES.ADMIN, ROLES.MEMBER);
