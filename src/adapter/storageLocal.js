import { StorageInterface } from '../interface/storage.interface.js';
import fs from 'fs/promises';
import path from 'path';

const uploadDir = path.resolve('./uploads');

export class LocalStorage extends StorageInterface {
  async uploadFile(file) {
    await fs.writeFile(path.join(uploadDir, file.originalname), file.buffer);
    return { path: path.join(uploadDir, file.originalname) };
  }

  async getFile(filename) {
    return fs.readFile(path.join(uploadDir, filename));
  }

  async deleteFile(filename) {
    return fs.unlink(path.join(uploadDir, filename));
  }
}
