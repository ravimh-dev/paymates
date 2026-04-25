import { Request, Response } from 'express';

export const renderLogin = (req: Request, res: Response) => {
    res.render('pages/login', { title: 'Login', error: null });
};

export const renderRegister = (req: Request, res: Response) => {
    res.render('pages/register', { title: 'Register', error: null });
};

export const handleLogout = (req: Request, res: Response) => {
    res.clearCookie('accessToken');
    res.redirect('/auth/login');
};
