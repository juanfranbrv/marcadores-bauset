class OptionsManager {
  constructor() {
    this.bookmarks = [];
    this.categories = [];
    this.tags = [];
    this.filteredBookmarks = [];
    this.selectedBookmarks = new Set();
    this.currentFilters = {
      search: '',
      category: '',
      status: '',
      tags: []
    };
    this.currentSort = 'created_desc';
    this.currentView = 'grid';
    this.currentBookmark = null;

    this.elements = {
      searchInput: document.getElementById('searchInput'),
      searchClear: document.getElementById('searchClear'),
      categoryFilter: document.getElementById('categoryFilter'),
      statusFilter: document.getElementById('statusFilter'),
      sortBy: document.getElementById('sortBy'),
      bulkActions: document.getElementById('bulkActions'),
      bulkCounter: document.getElementById('bulkCounter'),
      categoriesList: document.getElementById('categoriesList'),
      tagsCloud: document.getElementById('tagsCloud'),
      statsGrid: document.getElementById('statsGrid'),
      gridViewBtn: document.getElementById('gridViewBtn'),
      listViewBtn: document.getElementById('listViewBtn'),
      resultsCount: document.getElementById('resultsCount'),
      loadingState: document.getElementById('loadingState'),
      emptyState: document.getElementById('emptyState'),
      bookmarksGrid: document.getElementById('bookmarksGrid'),
      modalOverlay: document.getElementById('modalOverlay'),
      bookmarkModal: document.getElementById('bookmarkModal'),
      categoryModal: document.getElementById('categoryModal'),
      exportModal: document.getElementById('exportModal')
    };

    this.init();
  }

  async init() {
    try {
      this.setupEventListeners();
      await this.loadData();
      this.renderUI();
    } catch (error) {
      console.error('Error al inicializar options:', error);
      this.showError('Error al cargar la aplicación');
    }
  }

  setupEventListeners() {
    this.elements.searchInput.addEventListener('input', this.handleSearch.bind(this));
    this.elements.searchClear.addEventListener('click', this.clearSearch.bind(this));

    this.elements.categoryFilter.addEventListener('change', this.handleCategoryFilter.bind(this));
    this.elements.statusFilter.addEventListener('change', this.handleStatusFilter.bind(this));
    this.elements.sortBy.addEventListener('change', this.handleSort.bind(this));

    this.elements.gridViewBtn.addEventListener('click', () => this.setView('grid'));
    this.elements.listViewBtn.addEventListener('click', () => this.setView('list'));

    document.getElementById('exportBtn').addEventListener('click', this.showExportModal.bind(this));
    document.getElementById('addCategoryBtn').addEventListener('click', this.showAddCategoryModal.bind(this));

    this.elements.modalOverlay.addEventListener('click', this.handleModalOverlayClick.bind(this));

    this.setupBulkActions();
    this.setupBookmarkModal();
    this.setupCategoryModal();
    this.setupExportModal();

    document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

    // Manejar botón de añadir marcador en estado vacío
    const addBookmarkBtn = document.getElementById('addBookmarkBtn');
    if (addBookmarkBtn) {
      addBookmarkBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://extensions/' });
      });
    }
  }

  async loadData() {
    try {
      const [bookmarksResponse, categoriesResponse, tagsResponse, statsResponse] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getBookmarks' }),
        chrome.runtime.sendMessage({ action: 'getCategories' }),
        chrome.runtime.sendMessage({ action: 'getAllTags' }),
        chrome.runtime.sendMessage({ action: 'getStorageStats' })
      ]);

      if (bookmarksResponse.success) this.bookmarks = bookmarksResponse.data;
      if (categoriesResponse.success) this.categories = categoriesResponse.data;
      if (tagsResponse.success) this.tags = tagsResponse.data;
      if (statsResponse.success) this.updateStats(statsResponse.data);

      this.applyFilters();
    } catch (error) {
      console.error('Error al cargar datos:', error);
      throw error;
    }
  }

  renderUI() {
    this.renderCategories();
    this.renderTags();
    this.renderBookmarks();
    this.updateFiltersUI();
    this.hideLoading();
  }

  renderCategories() {
    const container = this.elements.categoriesList;
    container.innerHTML = '';

    this.categories.forEach(category => {
      const bookmarkCount = this.bookmarks.filter(b => b.categoryId === category.id).length;

      const item = document.createElement('div');
      item.className = 'category-item';
      item.innerHTML = `
        <span>${category.name}</span>
        <span class="category-count">${bookmarkCount}</span>
      `;

      item.addEventListener('click', () => {
        this.selectCategory(category.id);
      });

      container.appendChild(item);
    });

    this.populateCategorySelects();
  }

  populateCategorySelects() {
    const selects = [this.elements.categoryFilter, document.getElementById('editCategory')];

    selects.forEach(select => {
      const currentValue = select.value;
      select.innerHTML = '<option value="">Todas las categorías</option>';

      this.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        select.appendChild(option);
      });

      if (currentValue) select.value = currentValue;
    });
  }

  renderTags() {
    const container = this.elements.tagsCloud;
    container.innerHTML = '';

    const popularTags = this.tags
      .filter(tag => tag.usageCount > 0)
      .slice(0, 20);

    if (popularTags.length === 0) {
      container.innerHTML = '<div class="tag-loading">No hay etiquetas</div>';
      return;
    }

    popularTags.forEach(tag => {
      const item = document.createElement('a');
      item.className = 'tag-item';
      item.href = '#';
      item.textContent = tag.name;

      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleTagFilter(tag.name);
      });

      container.appendChild(item);
    });
  }

  renderBookmarks() {
    const container = this.elements.bookmarksGrid;
    const isEmpty = this.filteredBookmarks.length === 0;

    if (isEmpty) {
      this.elements.emptyState.style.display = 'flex';
      container.innerHTML = '';
      this.elements.resultsCount.textContent = '0 marcadores';
      return;
    }

    this.elements.emptyState.style.display = 'none';
    this.elements.resultsCount.textContent = `${this.filteredBookmarks.length} marcadores`;

    container.innerHTML = '';
    container.className = `bookmarks-grid ${this.currentView}-view`;

    this.filteredBookmarks.forEach(bookmark => {
      const card = this.createBookmarkCard(bookmark);
      container.appendChild(card);
    });
  }

  createBookmarkCard(bookmark) {
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    card.dataset.bookmarkId = bookmark.id;

    if (this.selectedBookmarks.has(bookmark.id)) {
      card.classList.add('selected');
    }

    const imageUrl = this.getBookmarkImageUrl(bookmark);
    const statusClass = bookmark.imageStatus || 'placeholder';
    const statusText = this.getStatusText(statusClass);
    const category = this.categories.find(c => c.id === bookmark.categoryId);
    const categoryName = category ? category.name : 'Sin categoría';

    card.innerHTML = `
      <div class="bookmark-thumbnail">
        <img class="bookmark-image" src="${imageUrl}" alt="${bookmark.title}" loading="lazy">
        <div class="bookmark-status ${statusClass}">${statusText}</div>
        <input type="checkbox" class="bookmark-checkbox" ${this.selectedBookmarks.has(bookmark.id) ? 'checked' : ''}>
      </div>
      <div class="bookmark-content">
        <h3 class="bookmark-title">${this.escapeHtml(bookmark.title)}</h3>
        <p class="bookmark-url">${this.formatUrl(bookmark.url)}</p>
        ${bookmark.tags.length > 0 ? `
          <div class="bookmark-tags">
            ${bookmark.tags.slice(0, 3).map(tag => `<span class="bookmark-tag">${this.escapeHtml(tag)}</span>`).join('')}
            ${bookmark.tags.length > 3 ? `<span class="bookmark-tag">+${bookmark.tags.length - 3}</span>` : ''}
          </div>
        ` : ''}
        <div class="bookmark-meta">
          <span class="bookmark-date">
            📅 ${this.formatDate(bookmark.createdAt)}
          </span>
          <span class="bookmark-category">${categoryName}</span>
        </div>
      </div>
    `;

    const checkbox = card.querySelector('.bookmark-checkbox');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      this.toggleBookmarkSelection(bookmark.id);
    });

    card.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        this.openBookmarkModal(bookmark);
      }
    });

    return card;
  }

  getBookmarkImageUrl(bookmark) {
    if (bookmark.imageKeys && bookmark.imageKeys.thumb) {
      return `opfs://thumb/${bookmark.imageKeys.thumb}`;
    }

    return this.generatePlaceholderUrl(bookmark);
  }

  generatePlaceholderUrl(bookmark) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 320, 180);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 320, 180);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 108, 320, 72);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const shortTitle = bookmark.title.length > 30 ? bookmark.title.substring(0, 30) + '...' : bookmark.title;
    ctx.fillText(shortTitle, 160, 135);

    const domain = new URL(bookmark.url).hostname.replace('www.', '');
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(domain, 160, 155);

    return canvas.toDataURL();
  }

  getStatusText(status) {
    const statusMap = {
      real: 'Real',
      provisional: 'Provisional',
      placeholder: 'Placeholder',
      failed: 'Fallida'
    };
    return statusMap[status] || 'Desconocido';
  }

  formatUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname;
    } catch {
      return url;
    }
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  applyFilters() {
    let filtered = [...this.bookmarks];

    if (this.currentFilters.search) {
      const search = this.currentFilters.search.toLowerCase();
      filtered = filtered.filter(bookmark =>
        bookmark.title.toLowerCase().includes(search) ||
        bookmark.url.toLowerCase().includes(search) ||
        bookmark.description.toLowerCase().includes(search) ||
        bookmark.tags.some(tag => tag.toLowerCase().includes(search))
      );
    }

    if (this.currentFilters.category) {
      filtered = filtered.filter(bookmark => bookmark.categoryId === this.currentFilters.category);
    }

    if (this.currentFilters.status) {
      filtered = filtered.filter(bookmark => bookmark.imageStatus === this.currentFilters.status);
    }

    if (this.currentFilters.tags.length > 0) {
      filtered = filtered.filter(bookmark =>
        this.currentFilters.tags.some(tag => bookmark.tags.includes(tag))
      );
    }

    this.sortBookmarks(filtered);
    this.filteredBookmarks = filtered;
  }

  sortBookmarks(bookmarks) {
    const [field, direction] = this.currentSort.split('_');

    bookmarks.sort((a, b) => {
      let aVal, bVal;

      switch (field) {
        case 'created':
          aVal = a.createdAt;
          bVal = b.createdAt;
          break;
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'url':
          aVal = a.url.toLowerCase();
          bVal = b.url.toLowerCase();
          break;
        default:
          return 0;
      }

      if (direction === 'desc') {
        return bVal > aVal ? 1 : -1;
      } else {
        return aVal > bVal ? 1 : -1;
      }
    });
  }

  handleSearch(event) {
    this.currentFilters.search = event.target.value;
    this.applyFilters();
    this.renderBookmarks();
    this.updateSearchClear();
  }

  clearSearch() {
    this.elements.searchInput.value = '';
    this.currentFilters.search = '';
    this.applyFilters();
    this.renderBookmarks();
    this.updateSearchClear();
  }

  updateSearchClear() {
    this.elements.searchClear.style.display = this.elements.searchInput.value ? 'block' : 'none';
  }

  handleCategoryFilter(event) {
    this.currentFilters.category = event.target.value;
    this.applyFilters();
    this.renderBookmarks();
    this.updateCategoryHighlight();
  }

  updateCategoryHighlight() {
    const items = this.elements.categoriesList.querySelectorAll('.category-item');
    items.forEach((item, index) => {
      const category = this.categories[index];
      item.classList.toggle('active', category && category.id === this.currentFilters.category);
    });
  }

  selectCategory(categoryId) {
    this.currentFilters.category = this.currentFilters.category === categoryId ? '' : categoryId;
    this.elements.categoryFilter.value = this.currentFilters.category;
    this.applyFilters();
    this.renderBookmarks();
    this.updateCategoryHighlight();
  }

  handleStatusFilter(event) {
    this.currentFilters.status = event.target.value;
    this.applyFilters();
    this.renderBookmarks();
  }

  handleSort(event) {
    this.currentSort = event.target.value;
    this.applyFilters();
    this.renderBookmarks();
  }

  toggleTagFilter(tagName) {
    const index = this.currentFilters.tags.indexOf(tagName);
    if (index > -1) {
      this.currentFilters.tags.splice(index, 1);
    } else {
      this.currentFilters.tags.push(tagName);
    }

    this.applyFilters();
    this.renderBookmarks();
    this.updateTagsHighlight();
  }

  updateTagsHighlight() {
    const items = this.elements.tagsCloud.querySelectorAll('.tag-item');
    items.forEach(item => {
      const isActive = this.currentFilters.tags.includes(item.textContent);
      item.classList.toggle('active', isActive);
    });
  }

  setView(view) {
    this.currentView = view;
    this.elements.gridViewBtn.classList.toggle('active', view === 'grid');
    this.elements.listViewBtn.classList.toggle('active', view === 'list');
    this.renderBookmarks();
  }

  toggleBookmarkSelection(bookmarkId) {
    if (this.selectedBookmarks.has(bookmarkId)) {
      this.selectedBookmarks.delete(bookmarkId);
    } else {
      this.selectedBookmarks.add(bookmarkId);
    }

    this.updateBulkActions();
    this.updateBookmarkCardSelection(bookmarkId);
  }

  updateBookmarkCardSelection(bookmarkId) {
    const card = document.querySelector(`[data-bookmark-id="${bookmarkId}"]`);
    if (card) {
      const isSelected = this.selectedBookmarks.has(bookmarkId);
      card.classList.toggle('selected', isSelected);
      card.querySelector('.bookmark-checkbox').checked = isSelected;
    }
  }

  updateBulkActions() {
    const count = this.selectedBookmarks.size;
    this.elements.bulkCounter.textContent = `${count} seleccionados`;
    this.elements.bulkActions.style.display = count > 0 ? 'flex' : 'none';
  }

  setupBulkActions() {
    document.getElementById('bulkDeleteBtn').addEventListener('click', this.bulkDelete.bind(this));
    document.getElementById('bulkCategoryBtn').addEventListener('click', this.bulkChangeCategory.bind(this));
    document.getElementById('bulkTagsBtn').addEventListener('click', this.bulkAddTags.bind(this));
  }

  async bulkDelete() {
    if (!confirm(`¿Eliminar ${this.selectedBookmarks.size} marcadores seleccionados?`)) {
      return;
    }

    try {
      const bookmarkIds = Array.from(this.selectedBookmarks);
      const response = await chrome.runtime.sendMessage({
        action: 'bulkDeleteBookmarks',
        bookmarkIds
      });

      if (response.success) {
        this.selectedBookmarks.clear();
        await this.loadData();
        this.renderUI();
        this.showSuccess(`${bookmarkIds.length} marcadores eliminados`);
      }
    } catch (error) {
      console.error('Error en eliminación masiva:', error);
      this.showError('Error al eliminar marcadores');
    }
  }

  async bulkChangeCategory() {
    const categoryId = prompt('ID de la nueva categoría:');
    if (!categoryId) return;

    try {
      const bookmarkIds = Array.from(this.selectedBookmarks);
      const response = await chrome.runtime.sendMessage({
        action: 'bulkUpdateBookmarks',
        bookmarkIds,
        updates: { categoryId }
      });

      if (response.success) {
        this.selectedBookmarks.clear();
        await this.loadData();
        this.renderUI();
        this.showSuccess(`${bookmarkIds.length} marcadores actualizados`);
      }
    } catch (error) {
      console.error('Error en cambio masivo de categoría:', error);
      this.showError('Error al cambiar categoría');
    }
  }

  async bulkAddTags() {
    const tagsInput = prompt('Etiquetas a añadir (separadas por comas):');
    if (!tagsInput) return;

    const newTags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
    if (newTags.length === 0) return;

    try {
      const bookmarkIds = Array.from(this.selectedBookmarks);

      for (const bookmarkId of bookmarkIds) {
        const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
        if (bookmark) {
          const updatedTags = [...new Set([...bookmark.tags, ...newTags])];
          await chrome.runtime.sendMessage({
            action: 'updateBookmark',
            bookmarkId,
            data: { tags: updatedTags }
          });
        }
      }

      this.selectedBookmarks.clear();
      await this.loadData();
      this.renderUI();
      this.showSuccess(`Etiquetas añadidas a ${bookmarkIds.length} marcadores`);
    } catch (error) {
      console.error('Error en adición masiva de etiquetas:', error);
      this.showError('Error al añadir etiquetas');
    }
  }

  updateFiltersUI() {
    this.updateSearchClear();
    this.updateCategoryHighlight();
    this.updateTagsHighlight();
    this.updateBulkActions();
  }

  updateStats(stats) {
    document.getElementById('totalBookmarks').textContent = stats.database.bookmarks || 0;
    document.getElementById('totalImages').textContent = stats.images.count || 0;
    document.getElementById('storageUsed').textContent = this.formatBytes(stats.images.total || 0);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  hideLoading() {
    this.elements.loadingState.style.display = 'none';
  }

  showSuccess(message) {
    console.log('Success:', message);
  }

  showError(message) {
    console.error('Error:', message);
  }

  setupBookmarkModal() {
    // TODO: Implementar modal de edición de marcadores
  }

  setupCategoryModal() {
    // TODO: Implementar modal de categorías
  }

  setupExportModal() {
    // TODO: Implementar modal de exportación
  }

  openBookmarkModal(bookmark) {
    // TODO: Implementar apertura de modal
  }

  showExportModal() {
    // TODO: Implementar modal de exportación
  }

  showAddCategoryModal() {
    // TODO: Implementar modal de añadir categoría
  }

  handleModalOverlayClick(event) {
    if (event.target === this.elements.modalOverlay) {
      this.closeModals();
    }
  }

  closeModals() {
    this.elements.modalOverlay.classList.remove('visible');
  }

  handleKeyboardShortcuts(event) {
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      this.elements.searchInput.focus();
    }

    if (event.key === 'Escape') {
      this.closeModals();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});