import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from '@/config/app.config';
import { authRoutes } from '@/routes/auth.routes';
import { userRoutes } from '@/routes/user.routes';
import { permissionRoutes } from '@/routes/permission.routes';
import { errorHandler, notFoundHandler, securityHeaders } from '@/middleware/error.middleware';
import { AppDataSource } from '@/database/connection';
import logger from '@/utils/logger';

class App {
  public app: express.Application;

  constructor() {
    this.app = express();
    this.initializeDatabase();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await AppDataSource.initialize();
      logger.info('Database connection established successfully');
      
      // Synchroniser les modèles (en développement seulement)
      if (config.NODE_ENV === 'development') {
        await AppDataSource.synchronize();
        logger.info('Database synchronized');
      }
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      process.exit(1);
    }
  }

  private initializeMiddlewares(): void {
    // Sécurité
    this.app.use(helmet());
    this.app.use(securityHeaders);
    
    // CORS
    this.app.use(cors({
      origin: config.CORS_ORIGIN,
      credentials: config.CORS_CREDENTIALS,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging HTTP
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => logger.http(message.trim()),
      },
    }));

    // Logging des requêtes
    this.app.use((req, res, next) => {
      logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  private initializeRoutes(): void {
    // Routes API
    this.app.use(`${config.API_PREFIX}/auth`, authRoutes);
    this.app.use(`${config.API_PREFIX}/users`, userRoutes);
    this.app.use(`${config.API_PREFIX}/permissions`, permissionRoutes);

    // Route de santé
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: 'authperms',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Route racine
    this.app.get('/', (req, res) => {
      res.status(200).json({
        message: 'AuthPerms Microservice API',
        version: '1.0.0',
        documentation: `${req.protocol}://${req.get('host')}/api-docs`,
        endpoints: {
          auth: `${config.API_PREFIX}/auth`,
          users: `${config.API_PREFIX}/users`,
          permissions: `${config.API_PREFIX}/permissions`,
        },
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  public start(): void {
    this.app.listen(config.PORT, config.HOST, () => {
      logger.info(`
        🚀 AuthPerms Microservice started successfully!
        🌐 Environment: ${config.NODE_ENV}
        📡 Server: http://${config.HOST}:${config.PORT}
        📊 Health: http://${config.HOST}:${config.PORT}/health
        🗄️  Database: ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}
        ⏰ Started at: ${new Date().toISOString()}
      `);
    });

    // Gestion des arrêts gracieux
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received. Shutting down gracefully...');
      this.shutdown();
    });
  }

  private async shutdown(): Promise<void> {
    try {
      await AppDataSource.destroy();
      logger.info('Database connection closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Créer et démarrer l'application
const app = new App();
app.start();

export default app.app;