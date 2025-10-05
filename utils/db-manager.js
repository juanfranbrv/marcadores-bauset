class DBManager {
  static instance = null;
  static db = null;

  static async getInstance() {
    if (!this.instance) {
      this.instance = new DBManager();
      await this.instance.initialize();
    }
    return this.instance;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONSTANTS.DB_NAME, CONSTANTS.DB_VERSION);

      request.onerror = () => {
        console.error('Error al abrir la base de datos:', request.error);
        reject(new Error('No se pudo inicializar la base de datos'));
      };

      request.onsuccess = () => {
        DBManager.db = request.result;
        console.log('Base de datos inicializada correctamente');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this.createStores(db);
      };
    });
  }

  createStores(db) {
    if (!db.objectStoreNames.contains(CONSTANTS.STORES.BOOKMARKS)) {
      const bookmarkStore = db.createObjectStore(CONSTANTS.STORES.BOOKMARKS, {
        keyPath: 'id',
        autoIncrement: false
      });

      bookmarkStore.createIndex('url_canonical', 'urlCanonical', { unique: true });
      bookmarkStore.createIndex('category_id', 'categoryId', { unique: false });
      bookmarkStore.createIndex('created_at', 'createdAt', { unique: false });
      bookmarkStore.createIndex('updated_at', 'updatedAt', { unique: false });
      bookmarkStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
    }

    if (!db.objectStoreNames.contains(CONSTANTS.STORES.CATEGORIES)) {
      const categoryStore = db.createObjectStore(CONSTANTS.STORES.CATEGORIES, {
        keyPath: 'id',
        autoIncrement: false
      });

      categoryStore.createIndex('order', 'order', { unique: false });
      categoryStore.createIndex('name', 'name', { unique: true });
    }

    if (!db.objectStoreNames.contains(CONSTANTS.STORES.TAGS)) {
      const tagStore = db.createObjectStore(CONSTANTS.STORES.TAGS, {
        keyPath: 'id',
        autoIncrement: false
      });

      tagStore.createIndex('name', 'name', { unique: true });
      tagStore.createIndex('usage_count', 'usageCount', { unique: false });
    }

    if (!db.objectStoreNames.contains(CONSTANTS.STORES.SETTINGS)) {
      const settingsStore = db.createObjectStore(CONSTANTS.STORES.SETTINGS, {
        keyPath: 'key'
      });
    }

    this.initializeDefaultData(db);
  }

  initializeDefaultData(db) {
    const transaction = db.transaction([CONSTANTS.STORES.CATEGORIES], 'readwrite');
    const categoryStore = transaction.objectStore(CONSTANTS.STORES.CATEGORIES);

    const request = categoryStore.add(CONSTANTS.DEFAULT_CATEGORY);

    request.onsuccess = () => {
      console.log('Categoría por defecto creada');
    };

    request.onerror = (error) => {
      if (error.target.error.name === 'ConstraintError') {
        console.log('Categoría por defecto ya existe');
      } else {
        console.error('Error creando categoría por defecto:', error);
      }
    };
  }

  async execute(storeName, mode, operation) {
    if (!DBManager.db) {
      throw new Error('Base de datos no inicializada');
    }

    return new Promise((resolve, reject) => {
      const transaction = DBManager.db.transaction([storeName], mode);
      const store = transaction.objectStore(storeName);

      transaction.onerror = () => {
        reject(new Error(`Error en transacción: ${transaction.error}`));
      };

      transaction.oncomplete = () => {
        console.log(`Transacción completada en ${storeName}`);
      };

      try {
        const request = operation(store);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(new Error(`Error en operación: ${request.error}`));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  async add(storeName, data) {
    return this.execute(storeName, 'readwrite', (store) => store.add(data));
  }

  async put(storeName, data) {
    return this.execute(storeName, 'readwrite', (store) => store.put(data));
  }

  async get(storeName, key) {
    return this.execute(storeName, 'readonly', (store) => store.get(key));
  }

  async getAll(storeName, query = null, count = null) {
    return this.execute(storeName, 'readonly', (store) => {
      if (query) {
        return store.getAll(query, count);
      }
      return store.getAll();
    });
  }

  async delete(storeName, key) {
    return this.execute(storeName, 'readwrite', (store) => store.delete(key));
  }

  async clear(storeName) {
    return this.execute(storeName, 'readwrite', (store) => store.clear());
  }

  async count(storeName, query = null) {
    return this.execute(storeName, 'readonly', (store) => store.count(query));
  }

  async getByIndex(storeName, indexName, key) {
    return this.execute(storeName, 'readonly', (store) => {
      const index = store.index(indexName);
      return index.get(key);
    });
  }

  async getAllByIndex(storeName, indexName, query = null, count = null) {
    return this.execute(storeName, 'readonly', (store) => {
      const index = store.index(indexName);
      return index.getAll(query, count);
    });
  }

  async searchByIndex(storeName, indexName, range) {
    return new Promise((resolve, reject) => {
      const transaction = DBManager.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const results = [];

      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => {
        reject(new Error(`Error en búsqueda por índice: ${request.error}`));
      };
    });
  }

  async executeTransaction(storeNames, mode, operations) {
    if (!DBManager.db) {
      throw new Error('Base de datos no inicializada');
    }

    return new Promise((resolve, reject) => {
      const transaction = DBManager.db.transaction(storeNames, mode);
      const stores = {};

      storeNames.forEach(name => {
        stores[name] = transaction.objectStore(name);
      });

      transaction.onerror = () => {
        reject(new Error(`Error en transacción múltiple: ${transaction.error}`));
      };

      transaction.oncomplete = () => {
        console.log('Transacción múltiple completada');
        resolve();
      };

      try {
        operations(stores);
      } catch (error) {
        reject(error);
      }
    });
  }

  async backup() {
    const backup = {
      version: CONSTANTS.DB_VERSION,
      timestamp: Date.now(),
      data: {}
    };

    for (const storeName of Object.values(CONSTANTS.STORES)) {
      try {
        backup.data[storeName] = await this.getAll(storeName);
      } catch (error) {
        console.error(`Error al respaldar ${storeName}:`, error);
        backup.data[storeName] = [];
      }
    }

    return backup;
  }

  async restore(backupData) {
    if (!backupData || !backupData.data) {
      throw new Error('Datos de respaldo inválidos');
    }

    for (const [storeName, data] of Object.entries(backupData.data)) {
      if (Object.values(CONSTANTS.STORES).includes(storeName)) {
        try {
          await this.clear(storeName);

          for (const item of data) {
            await this.add(storeName, item);
          }

          console.log(`Store ${storeName} restaurado con ${data.length} elementos`);
        } catch (error) {
          console.error(`Error al restaurar ${storeName}:`, error);
        }
      }
    }
  }

  async getStorageInfo() {
    const info = {
      stores: {},
      totalRecords: 0
    };

    for (const storeName of Object.values(CONSTANTS.STORES)) {
      try {
        const count = await this.count(storeName);
        info.stores[storeName] = count;
        info.totalRecords += count;
      } catch (error) {
        console.error(`Error al obtener info de ${storeName}:`, error);
        info.stores[storeName] = 0;
      }
    }

    return info;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DBManager;
}