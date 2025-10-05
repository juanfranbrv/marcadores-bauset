class BookmarkManager {
  constructor() {
    this.categories = [];
    this.bookmarks = [];
    this.filteredBookmarks = [];
    this.currentEditingBookmark = null;
    this.currentEditingCategory = null;

    this.elements = {
      // Estadísticas
      totalBookmarks: document.getElementById('totalBookmarks'),
      totalCategories: document.getElementById('totalCategories'),
      totalTags: document.getElementById('totalTags'),
      recentBookmarks: document.getElementById('recentBookmarks'),

      // Pestañas
      tabs: document.querySelectorAll('.tab'),
      tabContents: document.querySelectorAll('.tab-content'),

      // Marcadores
      searchBookmarks: document.getElementById('searchBookmarks'),
      filterCategory: document.getElementById('filterCategory'),
      sortBookmarks: document.getElementById('sortBookmarks'),
      clearFiltersBtn: document.getElementById('clearFiltersBtn'),
      bookmarksList: document.getElementById('bookmarksList'),
      exportBookmarksBtn: document.getElementById('exportBookmarksBtn'),
      importBookmarksBtn: document.getElementById('importBookmarksBtn'),

      // Categorías
      addCategoryBtn: document.getElementById('addCategoryBtn'),
      categoriesList: document.getElementById('categoriesList'),

      // Configuración
      exportStaticSiteBtn: document.getElementById('exportStaticSiteBtn'),
      backupDataBtn: document.getElementById('backupDataBtn'),
      restoreDataBtn: document.getElementById('restoreDataBtn'),
      clearAllDataBtn: document.getElementById('clearAllDataBtn'),
      testExtensionBtn: document.getElementById('testExtensionBtn'),
      showLogsBtn: document.getElementById('showLogsBtn'),

      // Modales
      editBookmarkModal: document.getElementById('editBookmarkModal'),
      editBookmarkForm: document.getElementById('editBookmarkForm'),
      editTitle: document.getElementById('editTitle'),
      editUrl: document.getElementById('editUrl'),
      editCategory: document.getElementById('editCategory'),
      editTags: document.getElementById('editTags'),
      editDescription: document.getElementById('editDescription'),
      cancelEditBtn: document.getElementById('cancelEditBtn'),

      editCategoryModal: document.getElementById('editCategoryModal'),
      editCategoryForm: document.getElementById('editCategoryForm'),
      editCategoryName: document.getElementById('editCategoryName'),
      editCategoryDescription: document.getElementById('editCategoryDescription'),
      editCategoryIcon: document.getElementById('editCategoryIcon'),
      editCategoryColor: document.getElementById('editCategoryColor'),
      cancelCategoryBtn: document.getElementById('cancelCategoryBtn'),
      categoryModalTitle: document.getElementById('categoryModalTitle'),
      saveCategoryBtn: document.getElementById('saveCategoryBtn'),

      // Otros
      statusMessage: document.getElementById('statusMessage'),
      importFileInput: document.getElementById('importFileInput')
    };

    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.updateStats();
    this.renderBookmarks();
    this.renderCategories();
    this.populateCategorySelects();
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

      this.filteredBookmarks = [...this.bookmarks];
    } catch (error) {
      console.error('Error loading data:', error);
      this.showStatus('Error al cargar los datos', 'error');
    }
  }

  async saveData() {
    try {
      console.log('saveData: Starting to save data...');
      const data = {
        categories: this.categories,
        bookmarks: this.bookmarks,
        lastUpdated: Date.now()
      };
      console.log('saveData: Data object created, categories:', this.categories.length, 'bookmarks:', this.bookmarks.length);

      console.log('saveData: About to call chrome.storage.local.set...');
      await chrome.storage.local.set({ 'marcadores_bauset_data': data });
      console.log('saveData: chrome.storage.local.set completed');

      // Notificar al service worker para actualizar badges (sin await)
      try {
        console.log('saveData: About to notify service worker...');
        chrome.runtime.sendMessage({ action: 'dataUpdated' }).catch(error => {
          console.log('saveData: Service worker notification failed (ok):', error.message);
        });
        console.log('saveData: Service worker notification sent (not waiting for response)');
      } catch (error) {
        console.log('saveData: Service worker notification failed (ok):', error.message);
        // Service worker might not be ready, that's ok
      }
      console.log('saveData: Method completed successfully');
    } catch (error) {
      console.error('saveData: Error saving data:', error);
      this.showStatus('Error al guardar los datos', 'error');
      throw error; // Re-throw para que el calling method sepa que falló
    }
  }

  setupEventListeners() {
    // Pestañas
    this.elements.tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Búsqueda y filtros
    this.elements.searchBookmarks.addEventListener('input', () => this.filterBookmarks());
    this.elements.filterCategory.addEventListener('change', () => this.filterBookmarks());
    this.elements.sortBookmarks.addEventListener('change', () => this.sortBookmarks());
    this.elements.clearFiltersBtn.addEventListener('click', () => this.clearFilters());

    // Botones de marcadores
    this.elements.exportBookmarksBtn.addEventListener('click', () => this.exportBookmarks());
    this.elements.importBookmarksBtn.addEventListener('click', () => this.importBookmarks());

    // Botones de categorías
    this.elements.addCategoryBtn.addEventListener('click', () => this.showCategoryModal());

    // Botones de configuración
    this.elements.exportStaticSiteBtn.addEventListener('click', () => this.exportStaticSite());
    this.elements.backupDataBtn.addEventListener('click', () => this.backupData());
    this.elements.restoreDataBtn.addEventListener('click', () => this.restoreData());
    this.elements.clearAllDataBtn.addEventListener('click', () => this.clearAllData());
    this.elements.testExtensionBtn.addEventListener('click', () => this.testExtension());
    this.elements.showLogsBtn.addEventListener('click', () => this.showLogs());

    // Modales
    this.elements.cancelEditBtn.addEventListener('click', () => this.hideBookmarkModal());
    this.elements.cancelCategoryBtn.addEventListener('click', () => this.hideCategoryModal());
    this.elements.editBookmarkForm.addEventListener('submit', (e) => {
      console.log('Form submit event triggered');
      this.saveBookmark(e);
    });
    this.elements.editCategoryForm.addEventListener('submit', (e) => this.saveCategory(e));

    // Importar archivo
    this.elements.importFileInput.addEventListener('change', (e) => this.handleFileImport(e));

    // Delegación de eventos para botones dinámicos
    this.elements.bookmarksList.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const id = button.dataset.id;

      if (action === 'edit-bookmark') {
        this.editBookmark(id);
      } else if (action === 'delete-bookmark') {
        this.deleteBookmark(id);
      }
    });

    this.elements.categoriesList.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const id = button.dataset.id;

      if (action === 'edit-category') {
        this.editCategory(id);
      } else if (action === 'delete-category') {
        this.deleteCategory(id);
      }
    });

    // Cerrar modales con click fuera
    this.elements.editBookmarkModal.addEventListener('click', (e) => {
      if (e.target === this.elements.editBookmarkModal) {
        this.hideBookmarkModal();
      }
    });

    this.elements.editCategoryModal.addEventListener('click', (e) => {
      if (e.target === this.elements.editCategoryModal) {
        this.hideCategoryModal();
      }
    });
  }

  switchTab(tabName) {
    // Actualizar pestañas
    this.elements.tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Actualizar contenido
    this.elements.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === tabName);
    });
  }

  updateStats() {
    const totalBookmarks = this.bookmarks.length;
    const totalCategories = this.categories.length;

    // Contar etiquetas únicas
    const allTags = this.bookmarks.flatMap(b => b.tags || []);
    const uniqueTags = new Set(allTags.filter(tag => tag && tag.trim()));
    const totalTags = uniqueTags.size;

    // Marcadores de esta semana
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentBookmarks = this.bookmarks.filter(b => b.createdAt > oneWeekAgo).length;

    this.elements.totalBookmarks.textContent = totalBookmarks;
    this.elements.totalCategories.textContent = totalCategories;
    this.elements.totalTags.textContent = totalTags;
    this.elements.recentBookmarks.textContent = recentBookmarks;
  }

  populateCategorySelects() {
    // Llenar select de filtro
    this.elements.filterCategory.innerHTML = '<option value="">Todas las categorías</option>';

    // Llenar select de edición
    this.elements.editCategory.innerHTML = '';

    this.categories.forEach(category => {
      // Select de filtro
      const filterOption = document.createElement('option');
      filterOption.value = category.id;
      filterOption.textContent = `${category.name} (${this.getCategoryBookmarkCount(category.id)})`;
      this.elements.filterCategory.appendChild(filterOption);

      // Select de edición (sin contador)
      const editOption = document.createElement('option');
      editOption.value = category.id;
      editOption.textContent = category.name;
      this.elements.editCategory.appendChild(editOption);
    });
  }

  getCategoryBookmarkCount(categoryId) {
    return this.bookmarks.filter(b => b.categoryId === categoryId).length;
  }

  getCategoryName(categoryId) {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : 'Sin categoría';
  }

  filterBookmarks() {
    console.log('filterBookmarks called, total bookmarks:', this.bookmarks.length);

    const searchTerm = this.elements.searchBookmarks.value.toLowerCase();
    const selectedCategory = this.elements.filterCategory.value;

    this.filteredBookmarks = this.bookmarks.filter(bookmark => {
      const matchesSearch = !searchTerm ||
        bookmark.title.toLowerCase().includes(searchTerm) ||
        bookmark.url.toLowerCase().includes(searchTerm) ||
        (bookmark.description && bookmark.description.toLowerCase().includes(searchTerm)) ||
        (bookmark.tags && bookmark.tags.some(tag => tag.toLowerCase().includes(searchTerm)));

      const matchesCategory = !selectedCategory || bookmark.categoryId === selectedCategory;

      return matchesSearch && matchesCategory;
    });

    console.log('Filtered bookmarks result:', this.filteredBookmarks.length);

    this.sortBookmarks();
  }

  sortBookmarks() {
    const sortBy = this.elements.sortBookmarks.value;

    this.filteredBookmarks.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.createdAt - a.createdAt;
        case 'oldest':
          return a.createdAt - b.createdAt;
        case 'title':
          return a.title.localeCompare(b.title);
        case 'url':
          return a.url.localeCompare(b.url);
        default:
          return b.createdAt - a.createdAt;
      }
    });

    this.renderBookmarks();
  }

  clearFilters() {
    this.elements.searchBookmarks.value = '';
    this.elements.filterCategory.value = '';
    this.elements.sortBookmarks.value = 'newest';
    this.filterBookmarks();
  }

  renderBookmarks() {
    console.log('renderBookmarks called, filtered bookmarks:', this.filteredBookmarks.length);

    if (this.filteredBookmarks.length === 0) {
      this.elements.bookmarksList.innerHTML = `
        <div class="empty-state">
          <h3>No hay marcadores</h3>
          <p>No se encontraron marcadores que coincidan con los filtros actuales.</p>
        </div>
      `;
      return;
    }

    this.elements.bookmarksList.innerHTML = this.filteredBookmarks.map(bookmark => {
      const category = this.categories.find(c => c.id === bookmark.categoryId);
      const categoryName = category ? category.name : 'Sin categoría';
      const categoryColor = category ? (category.color || '#667eea') : '#667eea';

      const tagsHtml = bookmark.tags && bookmark.tags.length > 0
        ? `<div class="bookmark-tags">${bookmark.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
        : '';

      const descriptionHtml = bookmark.description
        ? `<div class="bookmark-description">${bookmark.description}</div>`
        : '';

      const hasImage = bookmark.imageKeys && bookmark.imageKeys.thumb;
      const thumbnailHtml = hasImage
        ? `<div class="card-thumbnail">
            <img src="" data-image-key="${bookmark.imageKeys.thumb}" class="bookmark-thumb" loading="lazy" alt="Screenshot">
          </div>`
        : `<div class="card-thumbnail placeholder-thumb"></div>`;

      return `
        <div class="card">
          <div class="card-actions">
            <button class="btn btn-secondary btn-small" data-action="edit-bookmark" data-id="${bookmark.id}" title="Editar">
              ✏️
            </button>
            <button class="btn btn-danger btn-small" data-action="delete-bookmark" data-id="${bookmark.id}" title="Eliminar">
              🗑️
            </button>
          </div>
          ${thumbnailHtml}
          <h3>${this.escapeHtml(bookmark.title)}</h3>
          <div class="bookmark-url">
            <a href="${bookmark.url}" target="_blank">${this.escapeHtml(bookmark.url)}</a>
          </div>
          ${tagsHtml}
          ${descriptionHtml}
          <div class="card-meta">
            <span class="category-color-dot" style="background-color: ${categoryColor};"></span>
            ${categoryName} • 📅 ${new Date(bookmark.createdAt).toLocaleDateString('es-ES')}
          </div>
        </div>
      `;
    }).join('');

    // Load images from OPFS after rendering
    this.loadThumbnailImages();
  }

  async loadThumbnailImages() {
    const thumbnails = document.querySelectorAll('.bookmark-thumb');
    if (thumbnails.length === 0) return;

    try {
      const opfsManager = await OPFSManager.getInstance();

      for (const img of thumbnails) {
        const imageKey = img.dataset.imageKey;
        if (!imageKey) continue;

        try {
          const imageFile = await opfsManager.getImage(imageKey, 'thumb');
          if (imageFile) {
            const url = URL.createObjectURL(imageFile);
            img.src = url;
            // Clean up URL when image is removed from DOM
            img.addEventListener('load', () => {
              img.dataset.blobUrl = url;
            });
          }
        } catch (error) {
          console.warn('Error loading thumbnail:', imageKey, error);
        }
      }
    } catch (error) {
      console.error('Error initializing OPFS manager:', error);
    }
  }

  renderCategories() {
    console.log('renderCategories called, categories:', this.categories.length);

    if (this.categories.length === 0) {
      this.elements.categoriesList.innerHTML = `
        <div class="empty-state">
          <h3>No hay categorías</h3>
          <p>Crea tu primera categoría para organizar tus marcadores.</p>
        </div>
      `;
      return;
    }

    this.elements.categoriesList.innerHTML = this.categories.map(category => {
      const bookmarkCount = this.getCategoryBookmarkCount(category.id);
      const icon = category.icon || '📁';
      const color = category.color || '#667eea';

      return `
        <div class="card">
          <div class="card-actions">
            <button class="btn btn-secondary btn-small" data-action="edit-category" data-id="${category.id}" title="Editar">
              ✏️
            </button>
            <button class="btn btn-danger btn-small" data-action="delete-category" data-id="${category.id}" title="Eliminar" ${bookmarkCount > 0 ? 'disabled' : ''}>
              🗑️
            </button>
          </div>
          <h3>
            <span class="category-icon">${icon}</span>
            ${this.escapeHtml(category.name)}
          </h3>
          <div class="card-meta">
            <span class="category-color-dot" style="background-color: ${color};"></span>
            ${bookmarkCount} marcadores • Creada ${new Date(category.createdAt).toLocaleDateString('es-ES')}
          </div>
          ${category.description ? `<p>${this.escapeHtml(category.description)}</p>` : ''}
        </div>
      `;
    }).join('');
  }

  // CRUD de Marcadores
  editBookmark(bookmarkId) {
    const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
    if (!bookmark) return;

    this.currentEditingBookmark = bookmark;

    this.elements.editTitle.value = bookmark.title;
    this.elements.editUrl.value = bookmark.url;
    this.elements.editCategory.value = bookmark.categoryId;
    this.elements.editTags.value = bookmark.tags ? bookmark.tags.join(', ') : '';
    this.elements.editDescription.value = bookmark.description || '';

    this.showBookmarkModal();
  }

  async saveBookmark(event) {
    event.preventDefault();

    console.log('saveBookmark called, currentEditingBookmark:', this.currentEditingBookmark);

    if (!this.currentEditingBookmark) {
      console.log('No bookmark being edited, returning');
      return;
    }

    // Validar campos requeridos
    const title = this.elements.editTitle.value.trim();
    const categoryId = this.elements.editCategory.value;

    if (!title) {
      this.showStatus('El título es requerido', 'error');
      return;
    }

    if (!categoryId) {
      this.showStatus('Debe seleccionar una categoría', 'error');
      return;
    }

    console.log('Validation passed, title:', title, 'categoryId:', categoryId);

    try {
      const updatedBookmark = {
        ...this.currentEditingBookmark,
        title: this.elements.editTitle.value,
        categoryId: this.elements.editCategory.value,
        tags: this.elements.editTags.value.split(',').map(t => t.trim()).filter(t => t),
        description: this.elements.editDescription.value,
        updatedAt: Date.now()
      };

      const index = this.bookmarks.findIndex(b => b.id === this.currentEditingBookmark.id);
      console.log('Found bookmark at index:', index);

      if (index >= 0) {
        console.log('Updating bookmark at index', index);
        this.bookmarks[index] = updatedBookmark;
        console.log('Bookmark updated in memory');

        console.log('About to save data...');
        try {
          await this.saveData();
          console.log('Data saved successfully');
        } catch (saveError) {
          console.error('Failed to save data:', saveError);
          this.showStatus('Error al guardar los datos', 'error');
          return; // Salir si no se puede guardar
        }

        console.log('Bookmark updated, refreshing interface...');

        // Actualizar toda la interfaz
        console.log('Calling updateStats...');
        this.updateStats();
        console.log('updateStats completed');

        console.log('Calling populateCategorySelects...');
        this.populateCategorySelects();
        console.log('populateCategorySelects completed');

        console.log('Calling filterBookmarks...');
        this.filterBookmarks(); // Esto actualizará filteredBookmarks y llamará a renderBookmarks()
        console.log('filterBookmarks completed');

        console.log('Calling renderCategories...');
        this.renderCategories(); // Actualizar contadores de categorías
        console.log('renderCategories completed');

        console.log('Interface refreshed successfully');

        console.log('About to close modal...');
        this.hideBookmarkModal();
        console.log('Modal closed successfully');

        this.showStatus('Marcador actualizado exitosamente', 'success');
        console.log('Status message shown');
      } else {
        console.log('Bookmark not found in array');
      }
    } catch (error) {
      console.error('Error saving bookmark:', error);
      this.showStatus('Error al guardar el marcador', 'error');
    }
  }

  async deleteBookmark(bookmarkId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este marcador?')) {
      return;
    }

    const index = this.bookmarks.findIndex(b => b.id === bookmarkId);
    if (index >= 0) {
      const bookmark = this.bookmarks[index];
      this.bookmarks.splice(index, 1);

      // Limpiar categoría vacía si es necesario
      await this.cleanupEmptyCategory(bookmark.categoryId);

      await this.saveData();

      console.log('Bookmark deleted, refreshing interface...');

      // Actualizar toda la interfaz
      this.updateStats();
      this.populateCategorySelects();
      this.filterBookmarks(); // Esto actualizará filteredBookmarks y llamará a renderBookmarks()
      this.renderCategories(); // Actualizar contadores de categorías

      console.log('Interface refreshed successfully');

      this.showStatus('Marcador eliminado exitosamente', 'success');
    }
  }

  // CRUD de Categorías
  showCategoryModal(categoryId = null) {
    if (categoryId) {
      // Editando categoría existente
      const category = this.categories.find(c => c.id === categoryId);
      if (!category) return;

      this.currentEditingCategory = category;
      this.elements.categoryModalTitle.textContent = 'Editar Categoría';
      this.elements.saveCategoryBtn.textContent = 'Guardar Cambios';
      this.elements.editCategoryName.value = category.name;
      this.elements.editCategoryDescription.value = category.description || '';
      this.elements.editCategoryIcon.value = category.icon || '📁';
      this.elements.editCategoryColor.value = category.color || '#667eea';
    } else {
      // Creando nueva categoría
      this.currentEditingCategory = null;
      this.elements.categoryModalTitle.textContent = 'Nueva Categoría';
      this.elements.saveCategoryBtn.textContent = 'Crear Categoría';
      this.elements.editCategoryName.value = '';
      this.elements.editCategoryDescription.value = '';
      this.elements.editCategoryIcon.value = '📁';
      this.elements.editCategoryColor.value = '#667eea';
    }

    this.elements.editCategoryModal.classList.add('active');
  }

  editCategory(categoryId) {
    this.showCategoryModal(categoryId);
  }

  async saveCategory(event) {
    event.preventDefault();

    const name = this.elements.editCategoryName.value.trim();
    if (!name) return;

    // Verificar que no exista ya una categoría con ese nombre
    const existingCategory = this.categories.find(c =>
      c.name.toLowerCase() === name.toLowerCase() &&
      (!this.currentEditingCategory || c.id !== this.currentEditingCategory.id)
    );

    if (existingCategory) {
      this.showStatus(`Ya existe una categoría llamada "${name}"`, 'error');
      return;
    }

    const icon = this.elements.editCategoryIcon.value.trim() || '📁';
    const color = this.elements.editCategoryColor.value || '#667eea';

    if (this.currentEditingCategory) {
      // Editando categoría existente
      const index = this.categories.findIndex(c => c.id === this.currentEditingCategory.id);
      if (index >= 0) {
        this.categories[index] = {
          ...this.currentEditingCategory,
          name: name,
          description: this.elements.editCategoryDescription.value.trim(),
          icon: icon,
          color: color,
          updatedAt: Date.now()
        };
      }
    } else {
      // Creando nueva categoría
      const newCategory = {
        id: this.generateId(),
        name: name,
        description: this.elements.editCategoryDescription.value.trim(),
        icon: icon,
        color: color,
        createdAt: Date.now()
      };
      this.categories.push(newCategory);
    }

    await this.saveData();

    // Actualizar toda la interfaz
    this.updateStats();
    this.renderCategories();
    this.populateCategorySelects();

    // Determinar mensaje antes de cerrar modal (porque hideCategoryModal limpia currentEditingCategory)
    const message = this.currentEditingCategory ?
      'Categoría actualizada exitosamente' :
      'Categoría creada exitosamente';

    // Cerrar modal y mostrar mensaje
    this.hideCategoryModal();
    this.showStatus(message, 'success');
  }

  async deleteCategory(categoryId) {
    const bookmarkCount = this.getCategoryBookmarkCount(categoryId);

    if (bookmarkCount > 0) {
      this.showStatus('No se puede eliminar una categoría que tiene marcadores', 'error');
      return;
    }

    if (!confirm('¿Estás seguro de que quieres eliminar esta categoría?')) {
      return;
    }

    const index = this.categories.findIndex(c => c.id === categoryId);
    if (index >= 0) {
      this.categories.splice(index, 1);
      await this.saveData();

      // Actualizar toda la interfaz
      this.updateStats();
      this.renderCategories();
      this.populateCategorySelects();

      this.showStatus('Categoría eliminada exitosamente', 'success');
    }
  }

  async cleanupEmptyCategory(categoryId) {
    if (!categoryId) return;

    const bookmarkCount = this.getCategoryBookmarkCount(categoryId);
    if (bookmarkCount === 0) {
      const index = this.categories.findIndex(c => c.id === categoryId);
      if (index >= 0) {
        this.categories.splice(index, 1);
        console.log(`Categoría vacía eliminada: ${categoryId}`);
      }
    }
  }

  // Utilidades de Modal
  showBookmarkModal() {
    this.elements.editBookmarkModal.classList.add('active');
  }

  hideBookmarkModal() {
    console.log('hideBookmarkModal called');
    this.elements.editBookmarkModal.classList.remove('active');
    this.currentEditingBookmark = null;
    console.log('Modal should be hidden now');
  }

  hideCategoryModal() {
    this.elements.editCategoryModal.classList.remove('active');
    this.currentEditingCategory = null;
  }

  // Importar/Exportar
  exportBookmarks() {
    const data = {
      categories: this.categories,
      bookmarks: this.bookmarks,
      exportedAt: Date.now(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marcadores-bauset-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.showStatus('Datos exportados exitosamente', 'success');
  }

  importBookmarks() {
    this.elements.importFileInput.click();
  }

  async handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.categories || !data.bookmarks) {
        throw new Error('Formato de archivo inválido');
      }

      if (confirm('¿Quieres reemplazar todos los datos actuales o fusionar con los existentes?\n\nAceptar = Reemplazar\nCancelar = Fusionar')) {
        // Reemplazar
        this.categories = data.categories;
        this.bookmarks = data.bookmarks;
      } else {
        // Fusionar
        // Fusionar categorías (evitar duplicados por nombre)
        data.categories.forEach(importedCategory => {
          const exists = this.categories.find(c =>
            c.name.toLowerCase() === importedCategory.name.toLowerCase()
          );
          if (!exists) {
            this.categories.push({
              ...importedCategory,
              id: this.generateId() // Nuevo ID para evitar conflictos
            });
          }
        });

        // Fusionar marcadores (evitar duplicados por URL)
        data.bookmarks.forEach(importedBookmark => {
          const exists = this.bookmarks.find(b => b.url === importedBookmark.url);
          if (!exists) {
            this.bookmarks.push({
              ...importedBookmark,
              id: this.generateId() // Nuevo ID para evitar conflictos
            });
          }
        });
      }

      await this.saveData();
      this.updateStats();
      this.filterBookmarks();
      this.renderCategories();
      this.populateCategorySelects();
      this.showStatus('Datos importados exitosamente', 'success');

    } catch (error) {
      console.error('Error importing data:', error);
      this.showStatus('Error al importar el archivo', 'error');
    }

    // Limpiar input
    event.target.value = '';
  }

  // Configuración
  backupData() {
    this.exportBookmarks();
  }

  restoreData() {
    this.importBookmarks();
  }

  async clearAllData() {
    if (!confirm('¿Estás seguro de que quieres eliminar TODOS los marcadores y categorías?\n\nEsta acción no se puede deshacer.')) {
      return;
    }

    if (!confirm('ÚLTIMA CONFIRMACIÓN: Se eliminarán todos los datos permanentemente.')) {
      return;
    }

    try {
      await chrome.storage.local.remove(['marcadores_bauset_data']);
      this.categories = [];
      this.bookmarks = [];
      this.filteredBookmarks = [];

      this.updateStats();
      this.renderBookmarks();
      this.renderCategories();
      this.populateCategorySelects();
      this.showStatus('Todos los datos han sido eliminados', 'success');

    } catch (error) {
      console.error('Error clearing data:', error);
      this.showStatus('Error al limpiar los datos', 'error');
    }
  }

  async testExtension() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'test' });
      if (response && response.success) {
        this.showStatus('✅ Extensión funcionando correctamente', 'success');
      } else {
        this.showStatus('❌ Error en el service worker', 'error');
      }
    } catch (error) {
      this.showStatus(`❌ Error de comunicación: ${error.message}`, 'error');
    }
  }

  showLogs() {
    const logs = [
      `Total marcadores: ${this.bookmarks.length}`,
      `Total categorías: ${this.categories.length}`,
      `Última actualización: ${new Date().toLocaleString('es-ES')}`,
      '',
      'Categorías:',
      ...this.categories.map(c => `- ${c.name} (${this.getCategoryBookmarkCount(c.id)} marcadores)`),
      '',
      'URLs guardadas (últimas 10):',
      ...this.bookmarks.slice(-10).map(b => `- ${b.title}: ${b.url}`)
    ].join('\n');

    alert(logs);
  }

  async exportStaticSite() {
    try {
      // Deshabilitar botón
      this.elements.exportStaticSiteBtn.disabled = true;
      this.elements.exportStaticSiteBtn.textContent = '⏳ Generando sitio...';

      this.showStatus('Iniciando generación del sitio estático...', 'info');

      // Verificar que SimpleZipCreator esté disponible
      if (typeof SimpleZipCreator === 'undefined') {
        throw new Error('SimpleZipCreator no está cargado. Por favor, recarga la página.');
      }

      // Preparar datos de exportación directamente desde los datos en memoria
      const exportData = {
        bookmarks: this.bookmarks,
        categories: this.categories,
        tags: this.extractUniqueTags(),
        exportedAt: Date.now(),
        version: '1.0.0'
      };

      // Crear ZIP
      this.showStatus('Creando archivo ZIP...', 'info');
      const zip = new SimpleZipCreator();

      // Agregar estructura de directorios
      zip.addDirectory('css');
      zip.addDirectory('js');
      zip.addDirectory('images');
      zip.addDirectory('images/thumbs');

      // Generar archivos estáticos
      const exportService = new ExportService();

      zip.addFile('index.html', exportService.generateIndexHtml());
      zip.addFile('css/styles.css', exportService.generateCSS());
      zip.addFile('js/app.js', exportService.generateJS());

      // Agregar datos JSON como data.js
      const dataJS = `const BOOKMARKS_DATA = ${JSON.stringify(exportData, null, 2)};`;
      zip.addFile('js/data.js', dataJS);

      // Agregar imágenes desde OPFS
      this.showStatus('Exportando imágenes...', 'info');
      const opfsManager = await OPFSManager.getInstance();
      let imageCount = 0;

      for (const bookmark of this.bookmarks) {
        if (bookmark.imageKeys?.thumb) {
          try {
            const imageFile = await opfsManager.getImage(bookmark.imageKeys.thumb, 'thumb');
            if (imageFile) {
              zip.addFile(`images/thumbs/${bookmark.imageKeys.thumb}`, imageFile);
              imageCount++;
            }
          } catch (error) {
            console.warn(`No se pudo exportar imagen thumb para ${bookmark.id}:`, error);
          }
        }
      }

      // Generar y descargar ZIP
      this.showStatus('Generando descarga...', 'info');
      const zipBlob = await zip.generateBlob();

      const filename = `marcadores-bauset-${new Date().toISOString().split('T')[0]}.zip`;
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      this.showStatus(`✅ Sitio generado: ${this.bookmarks.length} marcadores, ${imageCount} imágenes`, 'success');

    } catch (error) {
      console.error('Error al exportar sitio estático:', error);
      this.showStatus(`❌ Error al generar el sitio: ${error.message}`, 'error');
    } finally {
      // Rehabilitar botón
      this.elements.exportStaticSiteBtn.disabled = false;
      this.elements.exportStaticSiteBtn.textContent = '🌐 Generar Sitio Web (ZIP)';
    }
  }

  extractUniqueTags() {
    const allTags = this.bookmarks.flatMap(b => b.tags || []);
    const tagCounts = {};

    allTags.forEach(tag => {
      if (tag && tag.trim()) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    });

    return Object.entries(tagCounts).map(([name, count]) => ({
      id: this.generateId(),
      name: name,
      usageCount: count
    }));
  }

  // Utilidades
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showStatus(message, type) {
    this.elements.statusMessage.textContent = message;
    this.elements.statusMessage.className = `status-message ${type}`;
    this.elements.statusMessage.style.display = 'block';

    if (type !== 'error') {
      setTimeout(() => {
        this.elements.statusMessage.style.display = 'none';
      }, 5000);
    }
  }
}

// Instancia global
let bookmarkManager;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  bookmarkManager = new BookmarkManager();
});