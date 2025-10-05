class OPFSManager {
  static instance = null;
  static opfsRoot = null;

  static async getInstance() {
    if (!this.instance) {
      this.instance = new OPFSManager();
      await this.instance.initialize();
    }
    return this.instance;
  }

  async initialize() {
    try {
      this.opfsRoot = await navigator.storage.getDirectory();
      await this.ensureDirectories();
      console.log('OPFS inicializado correctamente');
    } catch (error) {
      console.error('Error al inicializar OPFS:', error);
      throw new Error('No se pudo inicializar el almacenamiento de archivos');
    }
  }

  async ensureDirectories() {
    const directories = ['thumb', 'mid'];
    for (const dir of directories) {
      try {
        await this.opfsRoot.getDirectoryHandle(dir, { create: true });
      } catch (error) {
        console.error(`Error al crear directorio ${dir}:`, error);
      }
    }
  }

  async saveImage(imageBlob, fileName, imageType = 'thumb') {
    if (!this.opfsRoot) {
      throw new Error('OPFS no inicializado');
    }

    try {
      const dirHandle = await this.opfsRoot.getDirectoryHandle(imageType, { create: true });
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();

      await writable.write(imageBlob);
      await writable.close();

      const stats = await this.getImageStats(fileName, imageType);

      console.log(`Imagen guardada: ${fileName} (${stats.size} bytes)`);
      return {
        fileName,
        size: stats.size,
        path: `/${imageType}/${fileName}`,
        saved: true
      };
    } catch (error) {
      console.error('Error al guardar imagen:', error);
      throw new Error(`No se pudo guardar la imagen: ${error.message}`);
    }
  }

  async getImage(fileName, imageType = 'thumb') {
    if (!this.opfsRoot) {
      throw new Error('OPFS no inicializado');
    }

    try {
      const dirHandle = await this.opfsRoot.getDirectoryHandle(imageType);
      const fileHandle = await dirHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();

      return file;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        return null;
      }
      console.error('Error al obtener imagen:', error);
      throw error;
    }
  }

  async deleteImage(fileName, imageType = 'thumb') {
    if (!this.opfsRoot) {
      throw new Error('OPFS no inicializado');
    }

    try {
      const dirHandle = await this.opfsRoot.getDirectoryHandle(imageType);
      await dirHandle.removeEntry(fileName);
      console.log(`Imagen eliminada: ${fileName}`);
      return true;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        return false;
      }
      console.error('Error al eliminar imagen:', error);
      throw error;
    }
  }

  async getImageURL(fileName, imageType = 'thumb') {
    try {
      const file = await this.getImage(fileName, imageType);
      if (!file) return null;

      return URL.createObjectURL(file);
    } catch (error) {
      console.error('Error al crear URL de imagen:', error);
      return null;
    }
  }

  async getImageStats(fileName, imageType = 'thumb') {
    try {
      const file = await this.getImage(fileName, imageType);
      if (!file) return null;

      return {
        size: file.size,
        lastModified: file.lastModified,
        type: file.type
      };
    } catch (error) {
      console.error('Error al obtener estadísticas de imagen:', error);
      return null;
    }
  }

  async listImages(imageType = 'thumb') {
    if (!this.opfsRoot) {
      throw new Error('OPFS no inicializado');
    }

    try {
      const dirHandle = await this.opfsRoot.getDirectoryHandle(imageType);
      const images = [];

      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file') {
          const file = await handle.getFile();
          images.push({
            name,
            size: file.size,
            lastModified: file.lastModified,
            type: file.type
          });
        }
      }

      return images.sort((a, b) => b.lastModified - a.lastModified);
    } catch (error) {
      console.error('Error al listar imágenes:', error);
      return [];
    }
  }

  async getStorageUsage() {
    try {
      const usage = { thumb: 0, mid: 0, total: 0, count: 0 };

      for (const type of ['thumb', 'mid']) {
        const images = await this.listImages(type);
        const typeUsage = images.reduce((sum, img) => sum + img.size, 0);
        usage[type] = typeUsage;
        usage.total += typeUsage;
        usage.count += images.length;
      }

      return usage;
    } catch (error) {
      console.error('Error al calcular uso de almacenamiento:', error);
      return { thumb: 0, mid: 0, total: 0, count: 0 };
    }
  }

  async cleanupOldImages(maxAge = 6 * 30 * 24 * 60 * 60 * 1000) {
    const cutoffTime = Date.now() - maxAge;
    let cleaned = 0;

    try {
      for (const type of ['thumb', 'mid']) {
        const images = await this.listImages(type);

        for (const image of images) {
          if (image.lastModified < cutoffTime) {
            await this.deleteImage(image.name, type);
            cleaned++;
          }
        }
      }

      console.log(`Limpieza completada: ${cleaned} imágenes eliminadas`);
      return { cleaned, success: true };
    } catch (error) {
      console.error('Error durante la limpieza:', error);
      return { cleaned, success: false, error: error.message };
    }
  }

  async recompressLargeImages(maxSizeThumb = 60 * 1024, maxSizeMid = 150 * 1024) {
    let recompressed = 0;
    const imageProcessor = new ImageProcessor();

    try {
      for (const type of ['thumb', 'mid']) {
        const maxSize = type === 'thumb' ? maxSizeThumb : maxSizeMid;
        const images = await this.listImages(type);

        for (const imageInfo of images) {
          if (imageInfo.size > maxSize) {
            const file = await this.getImage(imageInfo.name, type);
            if (file) {
              const recompressedBlob = await imageProcessor.recompressImage(file, type);
              if (recompressedBlob && recompressedBlob.size < imageInfo.size) {
                await this.saveImage(recompressedBlob, imageInfo.name, type);
                recompressed++;
              }
            }
          }
        }
      }

      console.log(`Recompresión completada: ${recompressed} imágenes procesadas`);
      return { recompressed, success: true };
    } catch (error) {
      console.error('Error durante la recompresión:', error);
      return { recompressed, success: false, error: error.message };
    }
  }

  generateImageFileName(url, timestamp = Date.now()) {
    const urlHash = this.hashString(url);
    const timeHash = timestamp.toString(36);
    return `img_${urlHash}_${timeHash}.webp`;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OPFSManager;
}