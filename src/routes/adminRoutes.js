import express from 'express';
import { 
  getAllAdmins,
  createAdmin,
  getAdminById,
  updateAdmin,
  deleteAdmin,
} from '../controllers/adminController.js';

const router = express.Router();

// Router for superadmin managing admin
router.get('/', getAllAdmins);
router.post('/buat-admin', createAdmin);
router.get('/:id', getAdminById);
router.put('/:id', updateAdmin);
router.delete('/:id', deleteAdmin);

export default router;