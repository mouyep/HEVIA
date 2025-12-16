import { Router } from 'express';
import { PermissionController } from '@/controllers/permission.controller';
import { 
  authenticate, 
  adminOnly, 
  deanOrAbove 
} from '@/middleware/auth.middleware';
import { requestLogger } from '@/middleware/error.middleware';

const router = Router();

// Log des requêtes de permissions
router.use(requestLogger);

// Routes protégées
router.post('/check', authenticate, PermissionController.checkPermission);
router.get('/my-permissions', authenticate, PermissionController.getMyPermissions);
router.get('/user/:matricule', authenticate, PermissionController.getUserPermissions);

// Routes admin seulement
router.get('/', adminOnly, PermissionController.getAllPermissions);
router.get('/search', adminOnly, PermissionController.searchPermissions);
router.get('/statistics', deanOrAbove, PermissionController.getPermissionStatistics);
router.get('/users-with-permission', adminOnly, PermissionController.getUsersWithPermission);
router.post('/', adminOnly, PermissionController.createPermission);
router.post('/assign', adminOnly, PermissionController.assignPermission);
router.put('/:id', adminOnly, PermissionController.updatePermission);
router.delete('/:id', adminOnly, PermissionController.deletePermission);

export const permissionRoutes = router;