import { Request, Response, NextFunction } from 'express';

export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;
  const message = err.message || 'Something went wrong';
  
  console.error(`[Error] ${req.method} ${req.path}:`, err);

  if (req.xhr || req.headers.accept?.includes('json')) {
    return res.status(status).json({
      success: false,
      message,
      errors: err.errors || [],
    });
  }

  res.status(status).render('pages/error', {
    title: 'Error',
    message,
    status,
    layout: 'layouts/main'
  });
};
