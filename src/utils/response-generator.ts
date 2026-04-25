import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const sendSuccess = (res: Response, data: any, message: string = 'Success', statusCode: number = StatusCodes.OK) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

export const sendError = (res: Response, message: string, statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR, details?: any) => {
    return res.status(statusCode).json({
        success: false,
        message,
        details,
    });
};

export const handleError = (res: Response, error: any) => {
    console.error(error);
    const status = error.status || StatusCodes.INTERNAL_SERVER_ERROR;
    const message = error.message || 'Internal Server Error';
    return res.status(status).json({
        success: false,
        message,
        errors: error.errors || [],
    });
};
