import { Router } from 'express';
import { UserController } from '@/controllers/user.controller';
import { 
  authenticate, 
  adminOnly, 
  deanOrAbove 
} from '@/middleware/auth.middleware';
import { requestLogger } from '@/middleware/error.middleware';

const router = Router();

// Log des requêtes utilisateur
router.use(requestLogger);

// Routes protégées pour l'utilisateur connecté
router.get('/profile', authenticate, UserController.getMyProfile);
router.put('/profile', authenticate, UserController.updateMyProfile);

// Routes admin seulement
router.get('/', adminOnly, UserController.getAllUsers);
router.get('/search', adminOnly, UserController.searchUsers);
router.get('/statistics', deanOrAbove, UserController.getUserStatistics);
router.get('/:matricule', authenticate, UserController.getUserByMatricule);
router.post('/', adminOnly, UserController.createUser);
router.put('/:matricule', authenticate, UserController.updateUser);
router.delete('/:matricule', adminOnly, UserController.deleteUser);
router.post('/:matricule/deactivate', adminOnly, UserController.deactivateUser);
router.post('/:matricule/activate', adminOnly, UserController.activateUser);

export const userRoutes = router;