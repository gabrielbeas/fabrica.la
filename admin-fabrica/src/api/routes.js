import express from 'express';
import { login, verifyAuth } from './controllers/authController.js';
import {
  getContracts,
  getContractById,
  createContract,
  updateContract,
  deleteContract
} from './controllers/contractsController.js';
import {
  getBuilding,
  updateBuilding
} from './controllers/buildingController.js';
import { verifyToken, isAdmin } from './middleware/auth.js';

const router = express.Router();

// Auth routes (públicas)
router.post('/auth/login', login);
router.get('/auth/verify', verifyToken, verifyAuth);

// Contracts routes (protegidas)
router.get('/contracts', verifyToken, getContracts);
router.get('/contracts/:id', verifyToken, getContractById);
router.post('/contracts', verifyToken, isAdmin, createContract);
router.put('/contracts/:id', verifyToken, isAdmin, updateContract);
router.delete('/contracts/:id', verifyToken, isAdmin, deleteContract);

// Building routes (protegidas)
router.get('/building', verifyToken, getBuilding);
router.put('/building', verifyToken, isAdmin, updateBuilding);

export default router;
