class SimplePopup {
  constructor() {
    this.currentTab = null;
    this.categories = [];
    this.bookmarks = [];

    this.elements = {
      pageTitle: document.getElementById('pageTitle'),
      pageUrl: document.getElementById('pageUrl'),
      category: document.getElementById('category'),
      tags: document.getElementById('tags'),
      description: document.getElementById('description'),
      saveBtn: document.getElementById('saveBtn'),
      manageBtn: document.getElementById('manageBtn'),
      status: document.getElementById('status'),
      form: document.getElementById('bookmarkForm'),
      themeToggle: document.getElementById('themeToggle')
    };

    this.init();
  }

  async init() {
    this.initTheme();
    await this.loadCurrentTab();
    await this.loadData();
    this.populateCategories();
    this.setupEventListeners();
  }

  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark');
      this.updateThemeIcon(true);
    } else {
      document.body.classList.remove('dark');
      this.updateThemeIcon(false);
    }
  }

  toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    this.updateThemeIcon(isDark);
  }

  updateThemeIcon(isDark) {
    const sunIcon = document.querySelector('.theme-icon-sun');
    const moonIcon = document.querySelector('.theme-icon-moon');
    if (isDark) {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'inline';
    } else {
      sunIcon.style.display = 'inline';
      moonIcon.style.display = 'none';
    }
  }

  async loadData() {
    try {
      // Cargar datos desde chrome.storage.local
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

  async saveData() {
    try {
      const data = {
        categories: this.categories,
        bookmarks: this.bookmarks,
        lastUpdated: Date.now()
      };
      await chrome.storage.local.set({ 'marcadores_bauset_data': data });
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  async loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      this.updatePageInfo();

      // Intentar obtener la descripción de la página
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const metaDescription = document.querySelector('meta[name="description"]');
            const ogDescription = document.querySelector('meta[property="og:description"]');
            return metaDescription?.content || ogDescription?.content || '';
          }
        });

        if (results && results[0] && results[0].result) {
          this.elements.description.value = results[0].result;
          this.elements.description.placeholder = 'Descripción de la página';
        }
      } catch (error) {
        console.log('No se pudo obtener descripción:', error);
      }
    } catch (error) {
      console.error('Error loading tab:', error);
      this.showStatus('Error al cargar la página actual', 'error');
    }
  }

  updatePageInfo() {
    if (this.currentTab) {
      this.elements.pageTitle.textContent = this.currentTab.title || 'Sin título';
      this.elements.pageUrl.textContent = this.formatUrl(this.currentTab.url);
    }
  }

  formatUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname;
    } catch {
      return url;
    }
  }

  populateCategories() {
    this.elements.category.innerHTML = '<option value="">Selecciona una categoría</option>';

    // Añadir categorías existentes
    this.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = `${category.name} (${this.getCategoryBookmarkCount(category.id)})`;
      this.elements.category.appendChild(option);
    });

    // Añadir opción para crear nueva categoría
    const createOption = document.createElement('option');
    createOption.value = 'CREATE_NEW';
    createOption.textContent = '➕ Crear nueva categoría...';
    this.elements.category.appendChild(createOption);

    // Seleccionar la primera categoría existente o mostrar crear nueva
    if (this.categories.length > 0) {
      this.elements.category.value = this.categories[0].id;
    }
  }

  getCategoryBookmarkCount(categoryId) {
    return this.bookmarks.filter(b => b.categoryId === categoryId).length;
  }

  setupEventListeners() {
    this.elements.form.addEventListener('submit', this.handleSubmit.bind(this));
    this.elements.manageBtn.addEventListener('click', this.openOptions.bind(this));
    this.elements.category.addEventListener('change', this.handleCategoryChange.bind(this));
    this.elements.themeToggle.addEventListener('click', this.toggleTheme.bind(this));
  }

  async handleCategoryChange(event) {
    if (event.target.value === 'CREATE_NEW') {
      const categoryName = prompt('📁 Nombre de la nueva categoría:\n\nEjemplos: Trabajo, Personal, Estudio, Recetas, etc.');

      if (categoryName && categoryName.trim()) {
        // Verificar que no existe ya una categoría con ese nombre
        const existingCategory = this.categories.find(c =>
          c.name.toLowerCase() === categoryName.trim().toLowerCase()
        );

        if (existingCategory) {
          this.showStatus(`La categoría "${categoryName}" ya existe`, 'error');
          this.elements.category.value = existingCategory.id;
          return;
        }

        const newCategory = {
          id: this.generateId(),
          name: categoryName.trim(),
          createdAt: Date.now()
        };

        this.categories.push(newCategory);
        await this.saveData();

        this.populateCategories();
        this.elements.category.value = newCategory.id;

        this.showStatus(`✅ Categoría "${categoryName}" creada exitosamente`, 'success');
      } else {
        // Si cancela, volver a la primera opción disponible
        if (this.categories.length > 0) {
          this.elements.category.value = this.categories[0].id;
        } else {
          this.elements.category.value = '';
        }
      }
    }
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async handleSubmit(event) {
    event.preventDefault();

    if (!this.currentTab) {
      this.showStatus('No hay pestaña activa', 'error');
      return;
    }

    if (!this.elements.category.value || this.elements.category.value === 'CREATE_NEW') {
      this.showStatus('Selecciona una categoría válida', 'error');
      return;
    }

    this.setSaving(true);

    try {
      // Crear el marcador
      const bookmark = {
        id: this.generateId(),
        url: this.currentTab.url,
        title: this.currentTab.title,
        categoryId: this.elements.category.value,
        tags: this.elements.tags.value.split(',').map(t => t.trim()).filter(t => t),
        description: this.elements.description.value,
        createdAt: Date.now()
      };

      // Verificar si ya existe un marcador con esta URL
      const existingIndex = this.bookmarks.findIndex(b => b.url === bookmark.url);

      if (existingIndex >= 0) {
        // Actualizar marcador existente
        const oldCategoryId = this.bookmarks[existingIndex].categoryId;
        this.bookmarks[existingIndex] = bookmark;

        // Limpiar categoría anterior si quedó vacía
        await this.cleanupEmptyCategory(oldCategoryId);

        this.showStatus('¡Marcador actualizado exitosamente!', 'success');
      } else {
        // Añadir nuevo marcador
        this.bookmarks.push(bookmark);
        this.showStatus('¡Marcador guardado exitosamente!', 'success');
      }

      // Capturar screenshot ANTES de guardar
      try {
        this.showStatus('📸 Capturando screenshot...', 'info');
        const screenshot = await chrome.tabs.captureVisibleTab(null, {
          format: 'png',
          quality: 100
        });

        // Enviar screenshot al service worker para procesarlo
        const screenshotResponse = await chrome.runtime.sendMessage({
          action: 'processScreenshot',
          screenshot: screenshot,
          bookmarkId: bookmark.id,
          bookmarkUrl: bookmark.url
        });

        if (screenshotResponse && screenshotResponse.success) {
          bookmark.imageKeys = screenshotResponse.imageKeys;
          bookmark.imageStatus = 'real';
          console.log('Screenshot procesado:', screenshotResponse.imageKeys);
        }
      } catch (error) {
        console.warn('No se pudo capturar screenshot:', error);
        bookmark.imageStatus = 'failed';
      }

      // Actualizar el marcador con las imageKeys si se capturó
      if (existingIndex >= 0) {
        this.bookmarks[existingIndex] = bookmark;
      }

      // Guardar datos
      await this.saveData();

      // Actualizar categorías (para mostrar el contador actualizado)
      this.populateCategories();
      this.elements.category.value = bookmark.categoryId;

      // Actualizar badge inmediatamente
      try {
        await chrome.runtime.sendMessage({
          action: 'updateBadge',
          url: this.currentTab.url
        });
      } catch (error) {
        console.log('No se pudo actualizar badge:', error);
      }

      // Auto cerrar después de 2 segundos
      setTimeout(() => {
        window.close();
      }, 2000);

    } catch (error) {
      console.error('Error saving bookmark:', error);
      this.showStatus('Error al guardar el marcador', 'error');
    } finally {
      this.setSaving(false);
    }
  }

  async cleanupEmptyCategory(categoryId) {
    if (!categoryId) return;

    // Contar marcadores en esta categoría
    const bookmarkCount = this.getCategoryBookmarkCount(categoryId);

    if (bookmarkCount === 0) {
      // Eliminar categoría vacía
      this.categories = this.categories.filter(c => c.id !== categoryId);
      await this.saveData();
      console.log(`Categoría vacía eliminada: ${categoryId}`);
    }
  }

  setSaving(saving) {
    this.elements.saveBtn.disabled = saving;
    this.elements.saveBtn.textContent = saving ? '⏳ Guardando...' : '📸 Guardar y Capturar';
  }

  showStatus(message, type) {
    this.elements.status.textContent = message;
    this.elements.status.className = `status ${type}`;
    this.elements.status.style.display = 'block';

    if (type !== 'error') {
      setTimeout(() => {
        this.elements.status.style.display = 'none';
      }, 3000);
    }
  }

  openOptions() {
    chrome.runtime.openOptionsPage();
    window.close();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SimplePopup();
});