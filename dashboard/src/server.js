import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config/config.js';
import routes from './api/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static(join(__dirname, '../public')));

// API Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Página principal - sirve index.html para rutas no encontradas (SPA)
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = config.port;
const HOST = config.host;

app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🏗️  Admin Panel - La Fábrica        ║
║════════════════════════════════════════║
║  Servidor en: http://${HOST}:${PORT}
║  Ambiente: ${config.nodeEnv}
║  Timestamp: ${new Date().toISOString()}
╚════════════════════════════════════════╝
  `);
});
