const CONSTANTS = {
  DB_NAME: 'MarcadoresBausetDB',
  DB_VERSION: 1,

  STORES: {
    BOOKMARKS: 'bookmarks',
    CATEGORIES: 'categories',
    TAGS: 'tags',
    SETTINGS: 'settings'
  },

  IMAGE_SIZES: {
    THUMB: { width: 320, height: 180, maxSize: 60 * 1024 },
    MID: { width: 720, height: 405, maxSize: 150 * 1024 }
  },

  IMAGE_QUALITY: {
    WEBP_QUALITY: 0.8,
    FALLBACK_QUALITY: 0.85
  },

  OPFS_PATHS: {
    THUMB: '/thumb/',
    MID: '/mid/'
  },

  DEFAULT_CATEGORY: {
    id: 'uncategorized',
    name: 'Sin categoría',
    order: 0
  },

  IMAGE_STATUS: {
    REAL: 'real',
    PROVISIONAL: 'provisional',
    PLACEHOLDER: 'placeholder',
    FAILED: 'failed'
  },

  CAPTURE_CONFIG: {
    VIEWPORT: { width: 1440, height: 900 },
    DPR: 2,
    WAIT_TIME: 600,
    TIMEOUT: 5000
  },

  URL_NORMALIZATION: {
    REMOVE_PARAMS: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'],
    REMOVE_WWW: true,
    FORCE_HTTPS: true
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
}