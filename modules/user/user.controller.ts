import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as userService from './user.service';
import { sendSuccess, sendValidationError } from '../../utils/response-generator';

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await userService.getProfile(req.user!.id);
    sendSuccess(res, user, 'Profile fetched');
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendValidationError(res, errors.array());
      return;
    }
    const user = await userService.updateProfile(req.user!.id, req.body);
    sendSuccess(res, user, 'Profile updated');
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendValidationError(res, errors.array());
      return;
    }
    await userService.changePassword(req.user!.id, req.body);
    sendSuccess(res, null, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await userService.softDeleteUser(req.user!.id);
    res.clearCookie('refresh_token');
    sendSuccess(res, null, 'Account deleted');
  } catch (err) {
    next(err);
  }
};
