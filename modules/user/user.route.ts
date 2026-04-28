import { Router } from 'express';
import * as userController from './user.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { updateProfileValidation, changePasswordValidation } from './user.validation';

const router = Router();

router.use(authenticate);

router.get('/me', userController.getMe);
router.put('/me', updateProfileValidation, userController.updateMe);
router.post('/me/change-password', changePasswordValidation, userController.changePassword);
router.delete('/me', userController.deleteMe);

export default router;
