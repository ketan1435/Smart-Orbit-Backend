export class StorageInterface {
  async uploadFile(file, options) {
    throw new Error('uploadFile() not implemented');
  }

  async getFile(fileId) {
    throw new Error('getFile() not implemented');
  }

  async deleteFile(fileId) {
    throw new Error('deleteFile() not implemented');
  }
}
