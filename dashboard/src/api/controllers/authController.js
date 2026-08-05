import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../../config/config.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Verificar credenciales (en producción sería contra base de datos)
    if (email !== config.admin.email) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // En desarrollo, comparar directamente; en producción usar bcrypt
    const passwordMatch = config.nodeEnv === 'development'
      ? password === config.admin.password
      : await bcrypt.compare(password, config.admin.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token
    const token = jwt.sign(
      { email: config.admin.email, role: 'admin' },
      config.jwt.secret,
      { expiresIn: config.jwt.expire }
    );

    res.json({
      success: true,
      token,
      user: {
        email: config.admin.email,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al procesar login' });
  }
};

export const verifyAuth = (req, res) => {
  // Este endpoint se usa para verificar si el token actual es válido
  res.json({
    success: true,
    user: req.user
  });
};
