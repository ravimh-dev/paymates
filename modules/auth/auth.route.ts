import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import {
  registerValidation, loginValidation, refreshValidation,
  forgotPasswordValidation, resetPasswordValidation,
} from './auth.validation';

const router = Router();

router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/refresh', refreshValidation, authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.post('/forgot-password', forgotPasswordValidation, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, authController.resetPassword);

export default router;
