import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { authService } from './auth.service.ts';
import { registerSchema, loginSchema } from './auth.validation.ts';
import { sendSuccess, sendError } from '../../utils/response-generator.ts';

export const register = async (req: Request, res: Response) => {
    try {
        const validated = registerSchema.parse(req.body);
        await authService.register(validated);
        return sendSuccess(res, null, 'Registration successful', StatusCodes.CREATED);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return sendError(res, 'Validation failed', StatusCodes.BAD_REQUEST, error.issues[0].message);
        }
        return sendError(res, error.message || 'Registration failed', StatusCodes.INTERNAL_SERVER_ERROR);
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const validated = loginSchema.parse(req.body);
        const { user, token } = await authService.login(validated);
        
        res.cookie('accessToken', token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
        });

        return sendSuccess(res, { user }, 'Login successful');
    } catch (error: any) {
        if (error instanceof ZodError) {
            return sendError(res, 'Validation failed', StatusCodes.BAD_REQUEST, error.issues[0].message);
        }
        return sendError(res, error.message || 'Login failed', StatusCodes.UNAUTHORIZED);
    }
};
