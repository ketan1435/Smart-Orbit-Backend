import mongoose from 'mongoose';
import https from 'https';
import fs from 'fs';
import app from './app.js';
import config from './config/config.js';
import logger from './config/logger.js';
import socketManager from './config/socket.js';

let server;

const startServer = () => {
  if (process.env.NODE_ENV === 'production') {
    logger.info('Starting server in HTTPS mode...');

    const sslOptions = {
      key: fs.readFileSync('/usr/local/hestia/data/users/suyog/ssl/flyvendo.com.key'),
      cert: fs.readFileSync('/usr/local/hestia/data/users/suyog/ssl/flyvendo.com.crt'),
    };

    server = https.createServer(sslOptions, app).listen(config.port, () => {
      logger.info(`HTTPS server running on port ${config.port}`);
      socketManager.initialize(server);
    });
  } else {
    logger.info('Starting server in HTTP mode...');
    server = app.listen(config.port, () => {
      logger.info(`HTTP server running on port ${config.port}`);
      socketManager.initialize(server);
    });
  }
};

mongoose.connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    logger.info('Connected to MongoDB');
    startServer();
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
