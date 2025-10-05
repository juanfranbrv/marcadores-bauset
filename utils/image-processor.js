class ImageProcessor {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.initCanvas();
  }

  initCanvas() {
    this.canvas = new OffscreenCanvas(1, 1);
    this.ctx = this.canvas.getContext('2d');
  }

  async processScreenshot(screenshotDataUrl, bookmarkId) {
    const results = {
      thumb: null,
      mid: null,
      status: CONSTANTS.IMAGE_STATUS.FAILED
    };

    try {
      const img = await this.loadImage(screenshotDataUrl);

      const thumbBlob = await this.resizeAndCompress(
        img,
        CONSTANTS.IMAGE_SIZES.THUMB.width,
        CONSTANTS.IMAGE_SIZES.THUMB.height,
        CONSTANTS.IMAGE_SIZES.THUMB.maxSize
      );

      const midBlob = await this.resizeAndCompress(
        img,
        CONSTANTS.IMAGE_SIZES.MID.width,
        CONSTANTS.IMAGE_SIZES.MID.height,
        CONSTANTS.IMAGE_SIZES.MID.maxSize
      );

      const opfsManager = await OPFSManager.getInstance();
      const timestamp = Date.now();

      if (thumbBlob) {
        const thumbFileName = opfsManager.generateImageFileName(`${bookmarkId}_thumb`, timestamp);
        const thumbResult = await opfsManager.saveImage(thumbBlob, thumbFileName, 'thumb');
        results.thumb = thumbResult.fileName;
      }

      if (midBlob) {
        const midFileName = opfsManager.generateImageFileName(`${bookmarkId}_mid`, timestamp);
        const midResult = await opfsManager.saveImage(midBlob, midFileName, 'mid');
        results.mid = midResult.fileName;
      }

      results.status = CONSTANTS.IMAGE_STATUS.REAL;
      console.log('Screenshot procesado correctamente:', results);

    } catch (error) {
      console.error('Error al procesar screenshot:', error);
      results.status = CONSTANTS.IMAGE_STATUS.FAILED;
    }

    return results;
  }

  async processOGImage(ogImageUrl, bookmarkId) {
    const results = {
      thumb: null,
      mid: null,
      status: CONSTANTS.IMAGE_STATUS.PROVISIONAL
    };

    try {
      const response = await fetch(ogImageUrl);
      if (!response.ok) {
        throw new Error(`Error al descargar imagen OG: ${response.status}`);
      }

      const blob = await response.blob();
      const img = await this.loadImageFromBlob(blob);

      const thumbBlob = await this.resizeAndCompress(
        img,
        CONSTANTS.IMAGE_SIZES.THUMB.width,
        CONSTANTS.IMAGE_SIZES.THUMB.height,
        CONSTANTS.IMAGE_SIZES.THUMB.maxSize
      );

      if (thumbBlob) {
        const opfsManager = await OPFSManager.getInstance();
        const thumbFileName = opfsManager.generateImageFileName(`${bookmarkId}_og_thumb`, Date.now());
        const thumbResult = await opfsManager.saveImage(thumbBlob, thumbFileName, 'thumb');
        results.thumb = thumbResult.fileName;
      }

      console.log('Imagen OG procesada como provisional:', results);

    } catch (error) {
      console.error('Error al procesar imagen OG:', error);
      results.status = CONSTANTS.IMAGE_STATUS.FAILED;
    }

    return results;
  }

  async generatePlaceholder(title, url, favIconUrl, bookmarkId) {
    const results = {
      thumb: null,
      mid: null,
      status: CONSTANTS.IMAGE_STATUS.PLACEHOLDER
    };

    try {
      const thumbBlob = await this.createPlaceholderImage(
        title,
        url,
        favIconUrl,
        CONSTANTS.IMAGE_SIZES.THUMB.width,
        CONSTANTS.IMAGE_SIZES.THUMB.height
      );

      if (thumbBlob) {
        const opfsManager = await OPFSManager.getInstance();
        const thumbFileName = opfsManager.generateImageFileName(`${bookmarkId}_placeholder`, Date.now());
        const thumbResult = await opfsManager.saveImage(thumbBlob, thumbFileName, 'thumb');
        results.thumb = thumbResult.fileName;
      }

      console.log('Placeholder generado:', results);

    } catch (error) {
      console.error('Error al generar placeholder:', error);
    }

    return results;
  }

  async resizeAndCompress(img, targetWidth, targetHeight, maxSize) {
    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;

    const scale = Math.min(
      targetWidth / img.width,
      targetHeight / img.height
    );

    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    const offsetX = (targetWidth - scaledWidth) / 2;
    const offsetY = (targetHeight - scaledHeight) / 2;

    this.ctx.fillStyle = '#f5f5f5';
    this.ctx.fillRect(0, 0, targetWidth, targetHeight);

    this.ctx.drawImage(
      img,
      offsetX, offsetY,
      scaledWidth, scaledHeight
    );

    let quality = CONSTANTS.IMAGE_QUALITY.WEBP_QUALITY;
    let blob = await this.canvas.convertToBlob({
      type: 'image/webp',
      quality: quality
    });

    let attempts = 0;
    while (blob.size > maxSize && quality > 0.3 && attempts < 5) {
      quality -= 0.1;
      blob = await this.canvas.convertToBlob({
        type: 'image/webp',
        quality: quality
      });
      attempts++;
    }

    if (blob.size > maxSize) {
      blob = await this.canvas.convertToBlob({
        type: 'image/jpeg',
        quality: CONSTANTS.IMAGE_QUALITY.FALLBACK_QUALITY
      });
    }

    return blob;
  }

  async createPlaceholderImage(title, url, favIconUrl, width, height) {
    this.canvas.width = width;
    this.canvas.height = height;

    const gradient = this.ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    if (favIconUrl) {
      try {
        const faviconImg = await this.loadImage(favIconUrl);
        const faviconSize = Math.min(width * 0.2, 64);
        this.ctx.drawImage(
          faviconImg,
          (width - faviconSize) / 2,
          height * 0.3,
          faviconSize,
          faviconSize
        );
      } catch (error) {
        console.warn('No se pudo cargar favicon para placeholder:', error);
      }
    }

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, height * 0.6, width, height * 0.4);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `bold ${Math.max(12, width * 0.04)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const shortTitle = title.length > 30 ? title.substring(0, 30) + '...' : title;
    this.ctx.fillText(shortTitle, width / 2, height * 0.75);

    const domain = new URL(url).hostname.replace('www.', '');
    this.ctx.font = `${Math.max(10, width * 0.03)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif`;
    this.ctx.fillStyle = '#cccccc';
    this.ctx.fillText(domain, width / 2, height * 0.85);

    return await this.canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.8
    });
  }

  async loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async loadImageFromBlob(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await this.loadImage(url);
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async recompressImage(imageFile, targetType = 'thumb') {
    try {
      const img = await this.loadImageFromBlob(imageFile);
      const config = CONSTANTS.IMAGE_SIZES[targetType.toUpperCase()];

      return await this.resizeAndCompress(
        img,
        config.width,
        config.height,
        config.maxSize
      );
    } catch (error) {
      console.error('Error al recomprimir imagen:', error);
      return null;
    }
  }

  async optimizeForSize(imageBlob, maxSize) {
    if (imageBlob.size <= maxSize) {
      return imageBlob;
    }

    try {
      const img = await this.loadImageFromBlob(imageBlob);

      const currentRatio = Math.sqrt(maxSize / imageBlob.size);
      const newWidth = Math.floor(img.width * currentRatio);
      const newHeight = Math.floor(img.height * currentRatio);

      this.canvas.width = newWidth;
      this.canvas.height = newHeight;

      this.ctx.drawImage(img, 0, 0, newWidth, newHeight);

      let quality = 0.9;
      let optimized = await this.canvas.convertToBlob({
        type: 'image/webp',
        quality: quality
      });

      while (optimized.size > maxSize && quality > 0.3) {
        quality -= 0.1;
        optimized = await this.canvas.convertToBlob({
          type: 'image/webp',
          quality: quality
        });
      }

      return optimized;
    } catch (error) {
      console.error('Error al optimizar tamaño:', error);
      return imageBlob;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageProcessor;
}