import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || 'localhost',
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
    expire: process.env.JWT_EXPIRE || '7d'
  },

  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000']
  },

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@fabrica.la',
    password: process.env.ADMIN_PASSWORD || 'changeme'
  }
};
