import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret-key';

export const authMiddleware = (req: any, res: Response, next: NextFunction) => {
  const token = req.cookies.accessToken || req.headers.authorization?.split(' ')[1];

  if (!token) {
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    return res.redirect('/auth/login');
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
    req.user = decoded;
    res.locals.user = decoded;
    next();
  } catch (error) {
    res.clearCookie('accessToken');
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    res.redirect('/auth/login');
  }
};
