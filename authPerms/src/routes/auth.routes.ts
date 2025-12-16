import { Router } from 'express';
import { AuthController } from '@/controllers/auth.controller';
import { 
  authenticate, 
  adminOnly, 
  deanOrAbove,
  requireAuth 
} from '@/middleware/auth.middleware';
import { 
  authRateLimiter, 
  refreshTokenRateLimiter 
} from '@/middleware/rate-limiter.middleware';
import { requestLogger } from '@/middleware/error.middleware';

const router = Router();

// Log des requêtes d'authentification
router.use(requestLogger);

// Routes publiques
router.post('/login', authRateLimiter, AuthController.authenticate);
router.post('/refresh', refreshTokenRateLimiter, AuthController.refreshToken);
router.post('/validate', AuthController.validateToken);
router.get('/health', AuthController.healthCheck);

// Routes protégées
router.post('/logout', authenticate, AuthController.logout);
router.post('/change-password', authenticate, AuthController.changePassword);
router.get('/me', authenticate, AuthController.getCurrentUser);

// Routes admin seulement
router.post('/force-logout/:matricule', adminOnly, AuthController.forceLogout);

export const authRoutes = router;