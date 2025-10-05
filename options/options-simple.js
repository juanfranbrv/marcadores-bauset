class SimpleOptions {
  constructor() {
    this.categories = [];
    this.bookmarks = [];

    this.elements = {
      statusMessage: document.getElementById('statusMessage'),
      serviceWorkerStatus: document.getElementById('serviceWorkerStatus'),
      testExtensionBtn: document.getElementById('testExtensionBtn'),
      reloadExtensionBtn: document.getElementById('reloadExtensionBtn'),
      openDevToolsBtn: document.getElementById('openDevToolsBtn'),
      debugStatus: document.getElementById('debugStatus'),
      lastUpdate: document.getElementById('lastUpdate')
    };

    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.checkServiceWorker();
    this.updateLastUpdate();
    this.showWelcomeMessage();
    await this.loadData();
    this.updateStats();
  }

  async loadData() {
    try {
      const result = await chrome.storage.local.get(['marcadores_bauset_data']);
      const savedData = result.marcadores_bauset_data;

      if (savedData) {
        const data = typeof savedData === 'string' ? JSON.parse(savedData) : savedData;
        this.categories = data.categories || [];
        this.bookmarks = data.bookmarks || [];
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.categories = [];
      this.bookmarks = [];
    }
  }

  updateStats() {
    // Actualizar las estadísticas en la página
    const bookmarkCount = this.bookmarks.length;
    const categoriesCount = this.categories.length;

    // Buscar elementos de estadísticas en la página
    const bookmarkCountEl = document.querySelector('.info-value');
    if (bookmarkCountEl) {
      bookmarkCountEl.textContent = bookmarkCount;
    }

    // Mostrar información detallada en debug
    const debugInfo = `
📊 Estado de datos:
• ${bookmarkCount} marcadores guardados
• ${categoriesCount} categorías activas
• Última actualización: ${new Date().toLocaleTimeString('es-ES')}

📋 Categorías existentes:
${this.categories.map(c => `• ${c.name} (${this.getCategoryBookmarkCount(c.id)} marcadores)`).join('\n') || '• No hay categorías'}

🔗 URLs guardadas:
${this.bookmarks.slice(0, 5).map(b => `• ${b.title} - ${b.url}`).join('\n') || '• No hay marcadores'}
${this.bookmarks.length > 5 ? `... y ${this.bookmarks.length - 5} más` : ''}
    `;

    setTimeout(() => {
      this.showDebugStatus(debugInfo, 'info');
    }, 1000);
  }

  getCategoryBookmarkCount(categoryId) {
    return this.bookmarks.filter(b => b.categoryId === categoryId).length;
  }

  setupEventListeners() {
    this.elements.testExtensionBtn.addEventListener('click', this.testExtension.bind(this));
    this.elements.reloadExtensionBtn.addEventListener('click', this.reloadExtension.bind(this));
    this.elements.openDevToolsBtn.addEventListener('click', this.openDevTools.bind(this));

    // Nuevos botones
    const showBookmarksBtn = document.getElementById('showBookmarksBtn');
    const clearDataBtn = document.getElementById('clearDataBtn');

    if (showBookmarksBtn) {
      showBookmarksBtn.addEventListener('click', this.showBookmarks.bind(this));
    }

    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', this.clearData.bind(this));
    }
  }

  async checkServiceWorker() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'test'
      });

      if (response && response.success) {
        this.elements.serviceWorkerStatus.textContent = '✅';
        this.showDebugStatus('Service worker funcionando correctamente', 'success');
      } else {
        this.elements.serviceWorkerStatus.textContent = '❌';
        this.showDebugStatus('Service worker no responde', 'error');
      }
    } catch (error) {
      this.elements.serviceWorkerStatus.textContent = '❌';
      this.showDebugStatus(`Error de comunicación: ${error.message}`, 'error');
    }
  }

  async testExtension() {
    this.showDebugStatus('🧪 Probando extensión...', 'info');
    this.elements.testExtensionBtn.disabled = true;

    try {
      // Test 1: Service Worker
      const swResponse = await chrome.runtime.sendMessage({ action: 'test' });
      console.log('Service Worker test:', swResponse);

      // Test 2: Permissions
      const hasActiveTab = await chrome.permissions.contains({ permissions: ['activeTab'] });
      const hasDownloads = await chrome.permissions.contains({ permissions: ['downloads'] });
      const hasStorage = await chrome.permissions.contains({ permissions: ['storage'] });

      console.log('Permissions:', { hasActiveTab, hasDownloads, hasStorage });

      // Test 3: Current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab);

      if (swResponse && swResponse.success && hasActiveTab && tab) {
        this.showDebugStatus('✅ Todas las pruebas pasaron correctamente', 'success');
      } else {
        this.showDebugStatus('⚠️ Algunas pruebas fallaron. Revisa la consola.', 'error');
      }

    } catch (error) {
      console.error('Test error:', error);
      this.showDebugStatus(`❌ Error en las pruebas: ${error.message}`, 'error');
    } finally {
      this.elements.testExtensionBtn.disabled = false;
    }
  }

  reloadExtension() {
    this.showDebugStatus('🔄 Para recargar la extensión, ve a chrome://extensions/ y haz clic en el botón de recarga', 'info');

    // Abrir la página de extensiones
    chrome.tabs.create({ url: 'chrome://extensions/' });
  }

  openDevTools() {
    this.showDebugStatus('🛠️ Para abrir DevTools de la extensión:', 'info');

    setTimeout(() => {
      this.showDebugStatus(`
        1. Ve a chrome://extensions/
        2. Busca "Marcadores Bauset"
        3. Haz clic en "Inspeccionar vistas: service worker"
        4. Se abrirán las DevTools del service worker
      `, 'info');
    }, 1000);
  }

  showDebugStatus(message, type) {
    this.elements.debugStatus.textContent = message;
    this.elements.debugStatus.className = `status-message ${type}`;
    this.elements.debugStatus.style.display = 'block';

    if (type !== 'error') {
      setTimeout(() => {
        this.elements.debugStatus.style.display = 'none';
      }, 8000);
    }
  }

  updateLastUpdate() {
    const now = new Date().toLocaleString('es-ES');
    this.elements.lastUpdate.textContent = now;
  }

  showBookmarks() {
    if (this.bookmarks.length === 0) {
      this.showDebugStatus('No hay marcadores guardados todavía. ¡Guarda tu primer marcador usando el popup!', 'info');
      return;
    }

    let bookmarksHtml = `
📋 MARCADORES GUARDADOS (${this.bookmarks.length}):

`;

    // Agrupar por categorías
    const categoriesMap = {};
    this.bookmarks.forEach(bookmark => {
      const category = this.categories.find(c => c.id === bookmark.categoryId);
      const categoryName = category ? category.name : 'Sin categoría';

      if (!categoriesMap[categoryName]) {
        categoriesMap[categoryName] = [];
      }
      categoriesMap[categoryName].push(bookmark);
    });

    Object.entries(categoriesMap).forEach(([categoryName, bookmarks]) => {
      bookmarksHtml += `\n📁 ${categoryName} (${bookmarks.length}):\n`;
      bookmarks.forEach((bookmark, index) => {
        bookmarksHtml += `  ${index + 1}. ${bookmark.title}\n`;
        bookmarksHtml += `     🔗 ${bookmark.url}\n`;
        if (bookmark.tags && bookmark.tags.length > 0) {
          bookmarksHtml += `     🏷️ ${bookmark.tags.join(', ')}\n`;
        }
        if (bookmark.description) {
          bookmarksHtml += `     📝 ${bookmark.description}\n`;
        }
        bookmarksHtml += `     📅 ${new Date(bookmark.createdAt).toLocaleString('es-ES')}\n\n`;
      });
    });

    this.showDebugStatus(bookmarksHtml, 'info');
  }

  async clearData() {
    if (confirm('¿Estás seguro de que quieres eliminar todos los marcadores y categorías? Esta acción no se puede deshacer.')) {
      try {
        await chrome.storage.local.remove(['marcadores_bauset_data']);
        this.categories = [];
        this.bookmarks = [];

        this.showDebugStatus('✅ Todos los datos han sido eliminados', 'success');
        this.updateStats();

      } catch (error) {
        console.error('Error clearing data:', error);
        this.showDebugStatus('❌ Error al limpiar los datos', 'error');
      }
    }
  }

  showWelcomeMessage() {
    setTimeout(() => {
      this.elements.statusMessage.style.display = 'block';
    }, 500);

    setTimeout(() => {
      this.elements.statusMessage.style.display = 'none';
    }, 5000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SimpleOptions();
});