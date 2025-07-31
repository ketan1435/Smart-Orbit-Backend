// import pkg from '../../package.json' with { type: 'json' };
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import config from '../config/config.js';
// const { version } = pkg;

// Resolve file paths in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json
const pkgPath = path.resolve(__dirname, '../../package.json');
const loadPackage = async () => {
  const pkgBuffer = await fs.readFile(pkgPath, 'utf8');
  return JSON.parse(pkgBuffer);
};

const pkg = await loadPackage();

const { version } = pkg;

const swaggerDef = {
  openapi: '3.0.0',
  info: {
    title: 'VSM API documentation',
    version,
  },
  servers: [
    {
      url: `http://localhost:${config.port}/v1`,
      description: "Local Server",
    },
    {
      url: `https://smart-orbit-backend.onrender.com/v1`,
      description: "Render Server",
    },
  ],
};

export default swaggerDef;
