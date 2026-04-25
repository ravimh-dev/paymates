import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import expressLayouts from 'express-ejs-layouts';
import cookieParser from 'cookie-parser';
import { errorMiddleware } from './middlewares/error.middleware.ts';
import authRoutes from './modules/auth/auth.route.ts';
import groupRoutes from './modules/group/group.route.ts';
import expenseRoutes from './modules/expense/expense.route.ts';
import settlementRoutes from './modules/settlement/settlement.route.ts';

const app = express();


// Middlewares

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), 'public')));

// EJS Setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.set('layout', 'layouts/main');

// Global View Variables
app.use((req: any, res: Response, next: NextFunction) => {
  res.locals.user = req.user || null;
  res.locals.path = req.path;
  next();
});

// Routes
app.get('/', (req: Request, res: Response) => {
  res.render('pages/home', { title: 'Welcome - SplitWise Pro' });
});

app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);
app.use('/expenses', expenseRoutes);
app.use('/settlements', settlementRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).render('pages/error', { 
    title: 'Not Found', 
    message: 'Page not found', 
    status: 404,
    layout: 'layouts/main'
  });
});

// Error global middleware
app.use(errorMiddleware);

export default app;
