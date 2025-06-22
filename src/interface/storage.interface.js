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

  async generatePresignedUploadUrl(key, contentType) {
    throw new Error('generatePresignedUploadUrl() not implemented');
  }

  async copyFile(sourceKey, destinationKey) {
    throw new Error('copyFile() not implemented');
  }

  async getFileUrl(key) {
    throw new Error('getFileUrl() not implemented');
  }
}
