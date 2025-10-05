class PopupManager {
  constructor() {
    this.currentTab = null;
    this.categories = [];
    this.allTags = [];
    this.selectedTags = [];
    this.lastUsedCategory = null;

    this.elements = {
      pageTitle: document.getElementById('pageTitle'),
      pageUrl: document.getElementById('pageUrl'),
      pageFavicon: document.getElementById('pageFavicon'),
      categorySelect: document.getElementById('category'),
      tagsInput: document.getElementById('tagsInput'),
      tagsDisplay: document.getElementById('tagsDisplay'),
      tagsSuggestions: document.getElementById('tagsSuggestions'),
      description: document.getElementById('description'),
      saveBtn: document.getElementById('saveBtn'),
      manageBtn: document.getElementById('manageBtn'),
      statusMessage: document.getElementById('statusMessage'),
      bookmarkCount: document.getElementById('bookmarkCount'),
      categoriesCount: document.getElementById('categoriesCount'),
      form: document.getElementById('bookmarkForm')
    };

    this.init();
  }

  async init() {
    try {
      await this.loadCurrentTab();
      await this.loadCategories();
      await this.loadTags();
      await this.loadStats();
      await this.loadLastUsedCategory();
      this.setupEventListeners();
      this.focusFirstInput();
    } catch (error) {
      console.error('Error al inicializar popup:', error);
      this.showStatus('Error al cargar datos', 'error');
    }
  }

  async loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No se pudo obtener la pestaña activa');
      }

      this.currentTab = tab;
      this.updatePageInfo();
    } catch (error) {
      console.error('Error al cargar pestaña:', error);
      this.elements.pageTitle.textContent = 'Error al cargar página';
      this.elements.pageUrl.textContent = 'No disponible';
    }
  }

  updatePageInfo() {
    if (!this.currentTab) return;

    this.elements.pageTitle.textContent = this.currentTab.title || 'Sin título';
    this.elements.pageUrl.textContent = this.formatUrl(this.currentTab.url);

    if (this.currentTab.favIconUrl) {
      this.elements.pageFavicon.src = this.currentTab.favIconUrl;
      this.elements.pageFavicon.style.display = 'block';

      // Manejar error de carga del favicon
      this.elements.pageFavicon.onerror = () => {
        this.elements.pageFavicon.style.display = 'none';
      };
    }

    const metaDescription = this.extractMetaDescription();
    if (metaDescription) {
      this.elements.description.value = metaDescription;
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

  extractMetaDescription() {
    return '';
  }

  async loadCategories() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCategories'
      });

      if (response.success) {
        this.categories = response.data;

        // Si no hay categorías, crear la categoría por defecto
        if (this.categories.length === 0) {
          await this.createDefaultCategory();
        }

        this.populateCategorySelect();
      }
    } catch (error) {
      console.error('Error al cargar categorías:', error);
      // En caso de error, intentar crear la categoría por defecto
      await this.createDefaultCategory();
    }
  }

  async createDefaultCategory() {
    try {
      const defaultCategory = {
        id: 'uncategorized',
        name: 'Sin categoría',
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const response = await chrome.runtime.sendMessage({
        action: 'saveCategory',
        data: defaultCategory
      });

      if (response.success) {
        this.categories = [defaultCategory];
        console.log('Categoría por defecto creada en popup');
      }
    } catch (error) {
      console.error('Error al crear categoría por defecto:', error);
    }
  }

  populateCategorySelect() {
    this.elements.categorySelect.innerHTML = '<option value="">Selecciona una categoría</option>';

    if (this.categories.length === 0) {
      // Si no hay categorías, crear una opción para crear la primera
      const option = document.createElement('option');
      option.value = 'create-first';
      option.textContent = '📁 Crear primera categoría';
      this.elements.categorySelect.appendChild(option);
      this.showStatus('No hay categorías. Selecciona "Crear primera categoría"', 'info');
      return;
    }

    this.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      this.elements.categorySelect.appendChild(option);
    });

    // Añadir opción para crear nueva categoría
    const createOption = document.createElement('option');
    createOption.value = 'create-new';
    createOption.textContent = '➕ Crear nueva categoría';
    this.elements.categorySelect.appendChild(createOption);

    if (this.lastUsedCategory) {
      this.elements.categorySelect.value = this.lastUsedCategory;
    }
  }

  async loadTags() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getAllTags'
      });

      if (response.success) {
        this.allTags = response.data;
      }
    } catch (error) {
      console.error('Error al cargar etiquetas:', error);
    }
  }

  async loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getStorageStats'
      });

      if (response.success) {
        const stats = response.data;
        this.elements.bookmarkCount.textContent = stats.database.bookmarks || 0;
        this.elements.categoriesCount.textContent = stats.database.categories || 0;
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  }

  async loadLastUsedCategory() {
    try {
      const result = await chrome.storage.local.get(['lastUsedCategory']);
      this.lastUsedCategory = result.lastUsedCategory;
    } catch (error) {
      console.error('Error al cargar última categoría:', error);
    }
  }

  async saveLastUsedCategory(categoryId) {
    try {
      await chrome.storage.local.set({ lastUsedCategory: categoryId });
      this.lastUsedCategory = categoryId;
    } catch (error) {
      console.error('Error al guardar última categoría:', error);
    }
  }

  setupEventListeners() {
    this.elements.form.addEventListener('submit', this.handleSubmit.bind(this));
    this.elements.manageBtn.addEventListener('click', this.openOptionsPage.bind(this));

    this.elements.categorySelect.addEventListener('change', this.handleCategoryChange.bind(this));

    this.elements.tagsInput.addEventListener('keydown', this.handleTagsKeydown.bind(this));
    this.elements.tagsInput.addEventListener('input', this.handleTagsInput.bind(this));
    this.elements.tagsInput.addEventListener('blur', this.hideTagsSuggestions.bind(this));

    this.elements.tagsSuggestions.addEventListener('mousedown', this.handleSuggestionClick.bind(this));

    document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
  }

  async handleCategoryChange(event) {
    const value = event.target.value;

    if (value === 'create-first' || value === 'create-new') {
      const categoryName = prompt('Nombre de la nueva categoría:');
      if (categoryName && categoryName.trim()) {
        try {
          const newCategory = {
            id: this.generateId(),
            name: categoryName.trim(),
            order: this.categories.length,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };

          const response = await chrome.runtime.sendMessage({
            action: 'saveCategory',
            data: newCategory
          });

          if (response.success) {
            this.categories.push(newCategory);
            this.populateCategorySelect();
            this.elements.categorySelect.value = newCategory.id;
            this.showStatus('Categoría creada exitosamente', 'success');
          } else {
            throw new Error(response.error || 'Error al crear categoría');
          }
        } catch (error) {
          console.error('Error al crear categoría:', error);
          this.showStatus('Error al crear la categoría', 'error');
          this.elements.categorySelect.value = '';
        }
      } else {
        this.elements.categorySelect.value = '';
      }
    }
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async handleSubmit(event) {
    event.preventDefault();

    if (!this.currentTab) {
      this.showStatus('No hay pestaña activa para guardar', 'error');
      return;
    }

    if (!this.elements.categorySelect.value ||
        this.elements.categorySelect.value === 'create-first' ||
        this.elements.categorySelect.value === 'create-new') {
      this.showStatus('Selecciona una categoría válida', 'error');
      this.elements.categorySelect.focus();
      return;
    }

    this.setSavingState(true);

    try {
      const bookmarkData = {
        url: this.currentTab.url,
        title: this.currentTab.title,
        favIconUrl: this.currentTab.favIconUrl,
        categoryId: this.elements.categorySelect.value,
        tags: this.selectedTags,
        description: this.elements.description.value.trim()
      };

      const response = await chrome.runtime.sendMessage({
        action: 'saveCurrentTab',
        data: bookmarkData
      });

      if (response.success) {
        await this.saveLastUsedCategory(bookmarkData.categoryId);
        this.showStatus('¡Marcador guardado y capturado!', 'success');

        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        throw new Error(response.error || 'Error al guardar marcador');
      }

    } catch (error) {
      console.error('Error al guardar marcador:', error);
      this.showStatus(error.message || 'Error al guardar marcador', 'error');
    } finally {
      this.setSavingState(false);
    }
  }

  setSavingState(saving) {
    this.elements.saveBtn.disabled = saving;
    this.elements.form.classList.toggle('saving', saving);

    if (saving) {
      this.elements.saveBtn.querySelector('.btn-text').textContent = 'Guardando...';
    } else {
      this.elements.saveBtn.querySelector('.btn-text').textContent = 'Guardar y Capturar';
    }
  }

  handleTagsKeydown(event) {
    const input = event.target;

    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag(input.value.trim());
      input.value = '';
      this.hideTagsSuggestions();
    } else if (event.key === 'Backspace' && input.value === '' && this.selectedTags.length > 0) {
      this.removeTag(this.selectedTags[this.selectedTags.length - 1]);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      this.navigateSuggestions(event.key === 'ArrowDown' ? 1 : -1);
      event.preventDefault();
    } else if (event.key === 'Escape') {
      this.hideTagsSuggestions();
    }
  }

  handleTagsInput(event) {
    const value = event.target.value.trim();

    if (value.length > 0) {
      this.showTagsSuggestions(value);
    } else {
      this.hideTagsSuggestions();
    }
  }

  showTagsSuggestions(query) {
    const suggestions = this.allTags
      .filter(tag =>
        tag.name.toLowerCase().includes(query.toLowerCase()) &&
        !this.selectedTags.includes(tag.name)
      )
      .slice(0, 5);

    if (suggestions.length === 0) {
      this.hideTagsSuggestions();
      return;
    }

    this.elements.tagsSuggestions.innerHTML = '';
    suggestions.forEach((tag, index) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.textContent = tag.name;
      item.setAttribute('data-index', index);
      this.elements.tagsSuggestions.appendChild(item);
    });

    this.elements.tagsSuggestions.classList.add('visible');
  }

  hideTagsSuggestions() {
    setTimeout(() => {
      this.elements.tagsSuggestions.classList.remove('visible');
    }, 150);
  }

  navigateSuggestions(direction) {
    const items = this.elements.tagsSuggestions.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;

    const current = this.elements.tagsSuggestions.querySelector('.highlighted');
    let newIndex = 0;

    if (current) {
      const currentIndex = parseInt(current.getAttribute('data-index'));
      newIndex = currentIndex + direction;
      if (newIndex < 0) newIndex = items.length - 1;
      if (newIndex >= items.length) newIndex = 0;
      current.classList.remove('highlighted');
    }

    items[newIndex].classList.add('highlighted');
  }

  handleSuggestionClick(event) {
    if (event.target.classList.contains('suggestion-item')) {
      this.addTag(event.target.textContent);
      this.elements.tagsInput.value = '';
      this.hideTagsSuggestions();
      this.elements.tagsInput.focus();
    }
  }

  addTag(tagName) {
    if (!tagName || this.selectedTags.includes(tagName)) {
      return;
    }

    this.selectedTags.push(tagName);
    this.renderTags();
  }

  removeTag(tagName) {
    const index = this.selectedTags.indexOf(tagName);
    if (index > -1) {
      this.selectedTags.splice(index, 1);
      this.renderTags();
    }
  }

  renderTags() {
    this.elements.tagsDisplay.innerHTML = '';

    this.selectedTags.forEach(tag => {
      const chip = document.createElement('div');
      chip.className = 'tag-chip';
      chip.innerHTML = `
        <span>${tag}</span>
        <button type="button" class="tag-remove" data-tag="${tag}">×</button>
      `;

      chip.querySelector('.tag-remove').addEventListener('click', () => {
        this.removeTag(tag);
      });

      this.elements.tagsDisplay.appendChild(chip);
    });
  }

  showStatus(message, type = 'info') {
    this.elements.statusMessage.textContent = message;
    this.elements.statusMessage.className = `status-message ${type}`;

    if (type !== 'error') {
      setTimeout(() => {
        this.elements.statusMessage.className = 'status-message';
      }, 3000);
    }
  }

  handleKeyboardShortcuts(event) {
    if (event.ctrlKey && event.shiftKey && event.key === 'S') {
      event.preventDefault();
      this.elements.form.dispatchEvent(new Event('submit'));
    }
  }

  openOptionsPage() {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  focusFirstInput() {
    if (!this.elements.categorySelect.value) {
      this.elements.categorySelect.focus();
    } else {
      this.elements.tagsInput.focus();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});