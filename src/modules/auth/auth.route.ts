import { Router } from 'express';
import * as authController from './auth.controller.ts';
import * as authRender from '../../view/render/auth.render.ts';

const router = Router();

router.get('/register', authRender.renderRegister);
router.post('/register', authController.register);

router.get('/login', authRender.renderLogin);
router.post('/login', authController.login);

router.get('/logout', authRender.handleLogout);

export default router;
