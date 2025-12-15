import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import 'express-async-errors';

import { ueRoutes } from '@routes/ue.routes';
import { evaluationRoutes } from '@routes/evaluation.routes';
import { calculRoutes } from '@routes/calcul.routes';
import { pvRoutes } from '@routes/pv.routes';
import { errorHandler } from '@middleware/error.middleware';
import { logger } from '@utils/logger';
import { db } from '@config/database';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware de sécurité
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Limite de taux
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

app.use(limiter);

// Middleware pour parser le JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging des requêtes
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
});

// Routes
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'notation-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.use('/ues', ueRoutes);
app.use('/evaluations', evaluationRoutes);
app.use('/calculs', calculRoutes);
app.use('/pv', pvRoutes);

// Gestionnaire d'erreurs
app.use(errorHandler);

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND'
  });
});

// Démarrage du serveur
const startServer = async () => {
  try {
    await db.testConnection();
    logger.info('✅ Connexion à la base de données établie');

    app.listen(PORT, () => {
      logger.info(`🚀 Microservice Notation démarré sur le port ${PORT}`);
      logger.info(`📚 Environnement: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('❌ Échec du démarrage du serveur', { error: error.message });
    process.exit(1);
  }
};

// Gestion des signaux d'arrêt
process.on('SIGTERM', async () => {
  logger.info('🛑 Signal SIGTERM reçu, arrêt gracieux...');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('🛑 Signal SIGINT reçu, arrêt gracieux...');
  await db.close();
  process.exit(0);
});

startServer();

export { app };