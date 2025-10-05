class StorageManager {
  static instance = null;
  static dbManager = null;
  static opfsManager = null;

  static async getInstance() {
    if (!this.instance) {
      this.instance = new StorageManager();
      await this.instance.initialize();
    }
    return this.instance;
  }

  async initialize() {
    this.dbManager = await DBManager.getInstance();
    this.opfsManager = await OPFSManager.getInstance();
    console.log('StorageManager inicializado');
  }

  async saveBookmark(bookmarkData) {
    const bookmark = {
      id: this.generateId(),
      url: bookmarkData.url,
      urlCanonical: this.normalizeURL(bookmarkData.url),
      title: bookmarkData.title || 'Sin título',
      description: bookmarkData.description || '',
      favIconUrl: bookmarkData.favIconUrl || null,
      categoryId: bookmarkData.categoryId || CONSTANTS.DEFAULT_CATEGORY.id,
      tags: bookmarkData.tags || [],
      imageKeys: {
        thumb: null,
        mid: null
      },
      imageStatus: CONSTANTS.IMAGE_STATUS.PLACEHOLDER,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        ogTitle: bookmarkData.ogTitle,
        ogImage: bookmarkData.ogImage,
        keywords: bookmarkData.keywords
      }
    };

    try {
      await this.dbManager.add(CONSTANTS.STORES.BOOKMARKS, bookmark);
      console.log('Marcador guardado:', bookmark.id);
      return bookmark;
    } catch (error) {
      if (error.name === 'ConstraintError') {
        const existing = await this.dbManager.getByIndex(
          CONSTANTS.STORES.BOOKMARKS,
          'url_canonical',
          bookmark.urlCanonical
        );
        if (existing) {
          console.log('Marcador duplicado encontrado:', existing.id);
          return existing;
        }
      }
      throw error;
    }
  }

  async updateBookmark(bookmarkId, updates) {
    const existing = await this.dbManager.get(CONSTANTS.STORES.BOOKMARKS, bookmarkId);
    if (!existing) {
      throw new Error('Marcador no encontrado');
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    };

    if (updates.url && updates.url !== existing.url) {
      updated.urlCanonical = this.normalizeURL(updates.url);
    }

    await this.dbManager.put(CONSTANTS.STORES.BOOKMARKS, updated);
    console.log('Marcador actualizado:', bookmarkId);
    return updated;
  }

  async deleteBookmark(bookmarkId) {
    const bookmark = await this.dbManager.get(CONSTANTS.STORES.BOOKMARKS, bookmarkId);
    if (!bookmark) {
      throw new Error('Marcador no encontrado');
    }

    if (bookmark.imageKeys.thumb) {
      await this.opfsManager.deleteImage(bookmark.imageKeys.thumb, 'thumb');
    }
    if (bookmark.imageKeys.mid) {
      await this.opfsManager.deleteImage(bookmark.imageKeys.mid, 'mid');
    }

    await this.dbManager.delete(CONSTANTS.STORES.BOOKMARKS, bookmarkId);
    console.log('Marcador eliminado:', bookmarkId);
    return true;
  }

  async getBookmark(bookmarkId) {
    return await this.dbManager.get(CONSTANTS.STORES.BOOKMARKS, bookmarkId);
  }

  async getAllBookmarks(filters = {}) {
    let bookmarks = await this.dbManager.getAll(CONSTANTS.STORES.BOOKMARKS);

    if (filters.categoryId) {
      bookmarks = bookmarks.filter(b => b.categoryId === filters.categoryId);
    }

    if (filters.tags && filters.tags.length > 0) {
      bookmarks = bookmarks.filter(b =>
        filters.tags.some(tag => b.tags.includes(tag))
      );
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      bookmarks = bookmarks.filter(b =>
        b.title.toLowerCase().includes(searchTerm) ||
        b.url.toLowerCase().includes(searchTerm) ||
        b.description.toLowerCase().includes(searchTerm)
      );
    }

    return bookmarks.sort((a, b) => b.createdAt - a.createdAt);
  }

  async searchBookmarks(query, options = {}) {
    const allBookmarks = await this.getAllBookmarks();
    const searchTerm = query.toLowerCase();

    let results = allBookmarks.filter(bookmark => {
      return bookmark.title.toLowerCase().includes(searchTerm) ||
             bookmark.url.toLowerCase().includes(searchTerm) ||
             bookmark.description.toLowerCase().includes(searchTerm) ||
             bookmark.tags.some(tag => tag.toLowerCase().includes(searchTerm));
    });

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async saveCategory(categoryData) {
    const category = {
      id: categoryData.id || this.generateId(),
      name: categoryData.name,
      order: categoryData.order || 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.dbManager.put(CONSTANTS.STORES.CATEGORIES, category);
    console.log('Categoría guardada:', category.id);
    return category;
  }

  async getCategories() {
    let categories = await this.dbManager.getAll(CONSTANTS.STORES.CATEGORIES);

    // Asegurar que siempre existe la categoría por defecto
    if (categories.length === 0) {
      console.log('No hay categorías, creando categoría por defecto...');
      await this.ensureDefaultCategory();
      categories = await this.dbManager.getAll(CONSTANTS.STORES.CATEGORIES);
    }

    return categories.sort((a, b) => a.order - b.order);
  }

  async ensureDefaultCategory() {
    try {
      await this.dbManager.add(CONSTANTS.STORES.CATEGORIES, CONSTANTS.DEFAULT_CATEGORY);
      console.log('Categoría por defecto creada exitosamente');
    } catch (error) {
      if (error.name === 'ConstraintError') {
        console.log('Categoría por defecto ya existe');
      } else {
        console.error('Error creando categoría por defecto:', error);
        // Crear una categoría alternativa si falla
        try {
          const backupCategory = {
            id: 'general',
            name: 'General',
            order: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await this.dbManager.add(CONSTANTS.STORES.CATEGORIES, backupCategory);
          console.log('Categoría de respaldo creada');
        } catch (backupError) {
          console.error('Error crítico creando categorías:', backupError);
        }
      }
    }
  }

  async deleteCategory(categoryId) {
    if (categoryId === CONSTANTS.DEFAULT_CATEGORY.id) {
      throw new Error('No se puede eliminar la categoría por defecto');
    }

    const bookmarksInCategory = await this.dbManager.getAllByIndex(
      CONSTANTS.STORES.BOOKMARKS,
      'category_id',
      categoryId
    );

    for (const bookmark of bookmarksInCategory) {
      await this.updateBookmark(bookmark.id, {
        categoryId: CONSTANTS.DEFAULT_CATEGORY.id
      });
    }

    await this.dbManager.delete(CONSTANTS.STORES.CATEGORIES, categoryId);
    console.log('Categoría eliminada:', categoryId);
    return true;
  }

  async saveTag(tagData) {
    const tag = {
      id: tagData.id || this.generateId(),
      name: tagData.name,
      usageCount: tagData.usageCount || 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.dbManager.put(CONSTANTS.STORES.TAGS, tag);
    return tag;
  }

  async getAllTags() {
    const tags = await this.dbManager.getAll(CONSTANTS.STORES.TAGS);
    return tags.sort((a, b) => b.usageCount - a.usageCount);
  }

  async updateTagUsage() {
    const bookmarks = await this.getAllBookmarks();
    const tagCounts = {};

    bookmarks.forEach(bookmark => {
      bookmark.tags.forEach(tagName => {
        tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
      });
    });

    const existingTags = await this.getAllTags();
    const existingTagNames = new Set(existingTags.map(t => t.name));

    for (const [tagName, count] of Object.entries(tagCounts)) {
      const existingTag = existingTags.find(t => t.name === tagName);
      if (existingTag) {
        await this.updateTag(existingTag.id, { usageCount: count });
      } else {
        await this.saveTag({ name: tagName, usageCount: count });
      }
    }

    for (const tag of existingTags) {
      if (!tagCounts[tag.name]) {
        await this.dbManager.delete(CONSTANTS.STORES.TAGS, tag.id);
      }
    }
  }

  async updateTag(tagId, updates) {
    const existing = await this.dbManager.get(CONSTANTS.STORES.TAGS, tagId);
    if (!existing) {
      throw new Error('Etiqueta no encontrada');
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    };

    await this.dbManager.put(CONSTANTS.STORES.TAGS, updated);
    return updated;
  }

  async getSetting(key, defaultValue = null) {
    try {
      const setting = await this.dbManager.get(CONSTANTS.STORES.SETTINGS, key);
      return setting ? setting.value : defaultValue;
    } catch (error) {
      console.error(`Error al obtener configuración ${key}:`, error);
      return defaultValue;
    }
  }

  async setSetting(key, value) {
    const setting = {
      key,
      value,
      updatedAt: Date.now()
    };

    await this.dbManager.put(CONSTANTS.STORES.SETTINGS, setting);
    return setting;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  normalizeURL(url) {
    try {
      const urlObj = new URL(url);

      if (CONSTANTS.URL_NORMALIZATION.FORCE_HTTPS && urlObj.protocol === 'http:') {
        urlObj.protocol = 'https:';
      }

      if (CONSTANTS.URL_NORMALIZATION.REMOVE_WWW && urlObj.hostname.startsWith('www.')) {
        urlObj.hostname = urlObj.hostname.substring(4);
      }

      const searchParams = new URLSearchParams(urlObj.search);
      CONSTANTS.URL_NORMALIZATION.REMOVE_PARAMS.forEach(param => {
        searchParams.delete(param);
      });

      urlObj.search = searchParams.toString();

      if (urlObj.pathname === '/') {
        urlObj.pathname = '';
      }

      return urlObj.toString().replace(/\/$/, '');
    } catch (error) {
      console.warn('Error al normalizar URL:', url, error);
      return url;
    }
  }

  async getStorageStats() {
    const [dbInfo, opfsUsage] = await Promise.all([
      this.dbManager.getStorageInfo(),
      this.opfsManager.getStorageUsage()
    ]);

    return {
      database: dbInfo,
      images: opfsUsage,
      total: {
        records: dbInfo.totalRecords,
        imageSize: opfsUsage.total,
        imageCount: opfsUsage.count
      }
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}