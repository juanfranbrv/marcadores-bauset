class BookmarkService {
  static storageManager = null;
  static imageProcessor = null;

  static async initialize() {
    if (!this.storageManager) {
      this.storageManager = await StorageManager.getInstance();
    }
    if (!this.imageProcessor) {
      this.imageProcessor = new ImageProcessor();
    }
  }

  static async saveBookmark(tabData, screenshotDataUrl = null) {
    await this.initialize();

    try {
      const bookmark = await this.storageManager.saveBookmark({
        url: tabData.url,
        title: tabData.title,
        description: tabData.description,
        favIconUrl: tabData.favIconUrl,
        categoryId: tabData.categoryId,
        tags: tabData.tags || [],
        ogTitle: tabData.ogTitle,
        ogImage: tabData.ogImage,
        keywords: tabData.keywords
      });

      this.processImagesAsync(bookmark, screenshotDataUrl, tabData.ogImage);

      return bookmark;
    } catch (error) {
      console.error('Error al guardar marcador:', error);
      throw error;
    }
  }

  static async processImagesAsync(bookmark, screenshotDataUrl, ogImageUrl) {
    try {
      let imageResults = null;

      if (screenshotDataUrl) {
        console.log('Procesando screenshot...');
        imageResults = await this.imageProcessor.processScreenshot(screenshotDataUrl, bookmark.id);
      } else if (ogImageUrl) {
        console.log('Procesando imagen OG como provisional...');
        imageResults = await this.imageProcessor.processOGImage(ogImageUrl, bookmark.id);
      } else {
        console.log('Generando placeholder...');
        imageResults = await this.imageProcessor.generatePlaceholder(
          bookmark.title,
          bookmark.url,
          bookmark.favIconUrl,
          bookmark.id
        );
      }

      if (imageResults) {
        await this.storageManager.updateBookmark(bookmark.id, {
          imageKeys: {
            thumb: imageResults.thumb,
            mid: imageResults.mid
          },
          imageStatus: imageResults.status
        });

        console.log(`Imágenes procesadas para ${bookmark.id}:`, imageResults);
      }

    } catch (error) {
      console.error('Error al procesar imágenes:', error);

      try {
        await this.storageManager.updateBookmark(bookmark.id, {
          imageStatus: CONSTANTS.IMAGE_STATUS.FAILED
        });
      } catch (updateError) {
        console.error('Error al actualizar estado de imagen:', updateError);
      }
    }
  }

  static async updateBookmark(bookmarkId, updates) {
    await this.initialize();
    return await this.storageManager.updateBookmark(bookmarkId, updates);
  }

  static async deleteBookmark(bookmarkId) {
    await this.initialize();
    return await this.storageManager.deleteBookmark(bookmarkId);
  }

  static async getBookmark(bookmarkId) {
    await this.initialize();
    return await this.storageManager.getBookmark(bookmarkId);
  }

  static async getAllBookmarks(filters = {}) {
    await this.initialize();
    return await this.storageManager.getAllBookmarks(filters);
  }

  static async searchBookmarks(query, options = {}) {
    await this.initialize();
    return await this.storageManager.searchBookmarks(query, options);
  }

  static async recaptureBookmark(bookmarkId) {
    await this.initialize();

    const bookmark = await this.storageManager.getBookmark(bookmarkId);
    if (!bookmark) {
      throw new Error('Marcador no encontrado');
    }

    try {
      await this.storageManager.updateBookmark(bookmarkId, {
        imageStatus: CONSTANTS.IMAGE_STATUS.PLACEHOLDER
      });

      const [tab] = await chrome.tabs.query({ url: bookmark.url });
      if (tab) {
        const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: 'png',
          quality: 95
        });

        await this.processImagesAsync(bookmark, screenshotDataUrl);
      } else {
        throw new Error('No se pudo encontrar la pestaña para recapturar');
      }

      return await this.storageManager.getBookmark(bookmarkId);
    } catch (error) {
      console.error('Error al recapturar marcador:', error);
      throw error;
    }
  }

  static async getBookmarkImage(bookmarkId, imageType = 'thumb') {
    await this.initialize();

    const bookmark = await this.storageManager.getBookmark(bookmarkId);
    if (!bookmark || !bookmark.imageKeys[imageType]) {
      return null;
    }

    const opfsManager = await OPFSManager.getInstance();
    return await opfsManager.getImageURL(bookmark.imageKeys[imageType], imageType);
  }

  static async bulkUpdateBookmarks(bookmarkIds, updates) {
    await this.initialize();

    const results = [];
    for (const bookmarkId of bookmarkIds) {
      try {
        const updated = await this.storageManager.updateBookmark(bookmarkId, updates);
        results.push({ id: bookmarkId, success: true, data: updated });
      } catch (error) {
        results.push({ id: bookmarkId, success: false, error: error.message });
      }
    }

    return results;
  }

  static async bulkDeleteBookmarks(bookmarkIds) {
    await this.initialize();

    const results = [];
    for (const bookmarkId of bookmarkIds) {
      try {
        await this.storageManager.deleteBookmark(bookmarkId);
        results.push({ id: bookmarkId, success: true });
      } catch (error) {
        results.push({ id: bookmarkId, success: false, error: error.message });
      }
    }

    return results;
  }

  static async getCategories() {
    await this.initialize();
    return await this.storageManager.getCategories();
  }

  static async saveCategory(categoryData) {
    await this.initialize();
    return await this.storageManager.saveCategory(categoryData);
  }

  static async deleteCategory(categoryId) {
    await this.initialize();
    return await this.storageManager.deleteCategory(categoryId);
  }

  static async getAllTags() {
    await this.initialize();
    return await this.storageManager.getAllTags();
  }

  static async updateTagUsage() {
    await this.initialize();
    return await this.storageManager.updateTagUsage();
  }

  static async getStorageStats() {
    await this.initialize();
    return await this.storageManager.getStorageStats();
  }

  static async cleanupOldImages(maxAge = 6 * 30 * 24 * 60 * 60 * 1000) {
    await this.initialize();
    const opfsManager = await OPFSManager.getInstance();
    return await opfsManager.cleanupOldImages(maxAge);
  }

  static async recompressLargeImages() {
    await this.initialize();
    const opfsManager = await OPFSManager.getInstance();
    return await opfsManager.recompressLargeImages();
  }

  static async duplicateDetection() {
    await this.initialize();

    const bookmarks = await this.storageManager.getAllBookmarks();
    const duplicates = [];
    const urlMap = new Map();

    for (const bookmark of bookmarks) {
      const canonical = this.storageManager.normalizeURL(bookmark.url);
      if (urlMap.has(canonical)) {
        duplicates.push({
          original: urlMap.get(canonical),
          duplicate: bookmark
        });
      } else {
        urlMap.set(canonical, bookmark);
      }
    }

    return duplicates;
  }

  static async mergeDuplicates(originalId, duplicateId) {
    await this.initialize();

    const [original, duplicate] = await Promise.all([
      this.storageManager.getBookmark(originalId),
      this.storageManager.getBookmark(duplicateId)
    ]);

    if (!original || !duplicate) {
      throw new Error('Uno de los marcadores no existe');
    }

    const mergedTags = [...new Set([...original.tags, ...duplicate.tags])];

    const mergedData = {
      title: original.title || duplicate.title,
      description: original.description || duplicate.description,
      tags: mergedTags,
      imageKeys: original.imageKeys.thumb ? original.imageKeys : duplicate.imageKeys,
      imageStatus: original.imageStatus !== CONSTANTS.IMAGE_STATUS.PLACEHOLDER
        ? original.imageStatus
        : duplicate.imageStatus
    };

    await this.storageManager.updateBookmark(originalId, mergedData);
    await this.storageManager.deleteBookmark(duplicateId);

    return await this.storageManager.getBookmark(originalId);
  }

  static async exportBookmarks() {
    await this.initialize();

    const [bookmarks, categories, tags, stats] = await Promise.all([
      this.storageManager.getAllBookmarks(),
      this.storageManager.getCategories(),
      this.storageManager.getAllTags(),
      this.storageManager.getStorageStats()
    ]);

    return {
      bookmarks,
      categories,
      tags,
      stats,
      exportedAt: Date.now(),
      version: '1.0.0'
    };
  }

  static async importBookmarks(importData) {
    await this.initialize();

    if (!importData || !importData.bookmarks) {
      throw new Error('Datos de importación inválidos');
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    if (importData.categories) {
      for (const category of importData.categories) {
        try {
          await this.storageManager.saveCategory(category);
        } catch (error) {
          console.warn('Error al importar categoría:', error);
        }
      }
    }

    for (const bookmark of importData.bookmarks) {
      try {
        await this.storageManager.saveBookmark(bookmark);
        results.imported++;
      } catch (error) {
        if (error.name === 'ConstraintError') {
          results.skipped++;
        } else {
          results.errors.push({
            url: bookmark.url,
            error: error.message
          });
        }
      }
    }

    await this.storageManager.updateTagUsage();

    return results;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookmarkService;
}