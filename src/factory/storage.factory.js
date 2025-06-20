import { GridFSStorage } from '../adapter/storageGridFS.js';
import { S3Storage } from '../adapter/storageS3.js';
import { LocalStorage } from '../adapter/storageLocal.js';

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'gridfs';

let storageInstance;

switch (STORAGE_TYPE) {
  case 'gridfs':
    storageInstance = new GridFSStorage();
    break;
  case 's3':
    storageInstance = new S3Storage();
    break;
  case 'local':
  default:
    storageInstance = new LocalStorage();
}

export default storageInstance;
