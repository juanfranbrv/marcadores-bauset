class ExportService {
  constructor() {
    this.storageManager = null;
    this.opfsManager = null;
  }

  async initialize() {
    if (!this.storageManager) {
      this.storageManager = await StorageManager.getInstance();
    }
    if (!this.opfsManager) {
      this.opfsManager = await OPFSManager.getInstance();
    }
  }

  async generateZipExport(options = {}) {
    await this.initialize();

    const {
      includeMid = true,
      regenerateImages = false,
      includeCategories = [],
      includeTags = []
    } = options;

    try {
      console.log('Iniciando exportación de sitio estático...');

      const exportData = await this.prepareExportData(includeCategories, includeTags);

      if (regenerateImages) {
        console.log('Regenerando imágenes...');
        await this.regenerateImages(exportData.bookmarks);
      }

      const zipData = await this.createZipArchive(exportData, includeMid);

      const blob = await this.downloadZip(zipData);

      console.log('Exportación completada exitosamente');

      return {
        success: true,
        filename: `marcadores-bauset-${Date.now()}.zip`,
        size: blob.size,
        bookmarkCount: exportData.bookmarks.length
      };

    } catch (error) {
      console.error('Error durante la exportación:', error);
      throw new Error(`Error al exportar: ${error.message}`);
    }
  }

  async prepareExportData(includeCategories = [], includeTags = []) {
    const [allBookmarks, categories, tags] = await Promise.all([
      this.storageManager.getAllBookmarks(),
      this.storageManager.getCategories(),
      this.storageManager.getAllTags()
    ]);

    let filteredBookmarks = allBookmarks;

    if (includeCategories.length > 0) {
      filteredBookmarks = filteredBookmarks.filter(b =>
        includeCategories.includes(b.categoryId)
      );
    }

    if (includeTags.length > 0) {
      filteredBookmarks = filteredBookmarks.filter(b =>
        b.tags.some(tag => includeTags.includes(tag))
      );
    }

    const usedCategories = categories.filter(c =>
      filteredBookmarks.some(b => b.categoryId === c.id)
    );

    const usedTags = tags.filter(t =>
      filteredBookmarks.some(b => b.tags.includes(t.name))
    );

    return {
      bookmarks: filteredBookmarks,
      categories: usedCategories,
      tags: usedTags,
      exportedAt: Date.now(),
      version: '1.0.0'
    };
  }

  async createZipArchive(exportData, includeMid) {
    console.log('Creando archivo ZIP...');

    const zip = new SimpleZipCreator();

    await this.addStaticFiles(zip);

    await this.addDataFiles(zip, exportData);

    await this.addImageFiles(zip, exportData.bookmarks, includeMid);

    return zip;
  }

  async addStaticFiles(zip) {
    const indexHtml = this.generateIndexHtml();
    const cssContent = this.generateCSS();
    const jsContent = this.generateJS();

    zip.addFile('index.html', indexHtml);
    zip.addDirectory('assets');
    zip.addFile('assets/styles.css', cssContent);
    zip.addFile('assets/script.js', jsContent);

    const faviconSvg = this.generateFaviconSvg();
    zip.addFile('assets/favicon.svg', faviconSvg);
  }

  async addDataFiles(zip, exportData) {
    const bookmarksJson = JSON.stringify({
      bookmarks: exportData.bookmarks.map(b => ({
        id: b.id,
        title: b.title,
        url: b.url,
        description: b.description || '',
        categoryId: b.categoryId,
        tags: b.tags,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        imageKeys: b.imageKeys,
        imageStatus: b.imageStatus
      })),
      categories: exportData.categories,
      tags: exportData.tags,
      exportedAt: exportData.exportedAt,
      version: exportData.version
    }, null, 2);

    zip.addDirectory('data');
    zip.addFile('data/bookmarks.json', bookmarksJson);
  }

  async addImageFiles(zip, bookmarks, includeMid) {
    console.log('Añadiendo imágenes al ZIP...');

    zip.addDirectory('images');
    zip.addDirectory('images/thumb');
    if (includeMid) {
      zip.addDirectory('images/mid');
    }

    let imageCount = 0;

    for (const bookmark of bookmarks) {
      try {
        if (bookmark.imageKeys?.thumb) {
          const thumbFile = await this.opfsManager.getImage(bookmark.imageKeys.thumb, 'thumb');
          if (thumbFile) {
            zip.addFile(`images/thumb/${bookmark.imageKeys.thumb}`, thumbFile);
            imageCount++;
          }
        }

        if (includeMid && bookmark.imageKeys?.mid) {
          const midFile = await this.opfsManager.getImage(bookmark.imageKeys.mid, 'mid');
          if (midFile) {
            zip.addFile(`images/mid/${bookmark.imageKeys.mid}`, midFile);
            imageCount++;
          }
        }
      } catch (error) {
        console.warn(`Error al añadir imagen para ${bookmark.id}:`, error);
      }
    }

    console.log(`${imageCount} imágenes añadidas al ZIP`);
  }

  generateIndexHtml() {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mis Marcadores - Bauset</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
          },
        },
      },
    }
  </script>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div class="container">
    <aside class="sidebar">
      <div class="sidebar-logo">
        <img src="logoweb1.png" alt="Logo Bauset" onerror="this.style.display='none'">
      </div>

      <div class="sidebar-header">
        <h1>📌 Marcadores</h1>
        <p class="bookmark-count"><span id="totalCount">0</span> enlaces</p>
      </div>

      <div class="search-box">
        <input type="search" id="searchInput" placeholder="Buscar..." />
      </div>

      <div class="categories">
        <h2>Categorías</h2>
        <div id="categoriesList"></div>
      </div>

      <div class="sidebar-footer">
        <p class="footer-date">Última actualización: <span id="exportDate"></span></p>
        <p class="footer-author">Creado por Juanfranbrv</p>
      </div>
    </aside>

    <main class="main-content">
      <div class="content-header">
        <div class="category-title">
          <h2 id="currentCategoryTitle">Todas</h2>
          <span id="currentCategoryCount" class="category-count-badge">0 marcadores</span>
        </div>
        <div class="header-controls">
          <div class="view-controls">
            <button class="view-btn active" data-view="grid">⊞ Grid</button>
            <button class="view-btn" data-view="list">☰ Lista</button>
          </div>
          <div class="sort-controls">
            <select id="sortSelect">
              <option value="recent">Más recientes</option>
              <option value="oldest">Más antiguos</option>
              <option value="title">Por título</option>
            </select>
          </div>
          <button id="themeToggle" class="theme-toggle" title="Cambiar tema" aria-label="Cambiar tema">
            <svg class="theme-icon-sun" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="3" fill="currentColor"/>
              <path d="M10 0V3M10 17V20M20 10H17M3 10H0M16.95 3.05L14.83 5.17M5.17 14.83L3.05 16.95M16.95 16.95L14.83 14.83M5.17 5.17L3.05 3.05" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <svg class="theme-icon-moon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: none;">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="tags-bar" id="tagsBar">
        <div class="tags-list" id="tagsList"></div>
      </div>

      <div id="bookmarksGrid" class="bookmarks-grid"></div>

      <div id="emptyState" class="empty-state" style="display: none;">
        <p>No se encontraron marcadores</p>
      </div>
    </main>
  </div>

  <script src="js/data.js"></script>
  <script src="js/app.js"></script>
</body>
</html>`;
  }

  generateCSS() {
    return `/* Variables */
:root {
  --primary: #2563eb;
  --primary-dark: #1e40af;
  --bg-main: #f8fafc;
  --bg-card: #ffffff;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 25px rgba(0,0,0,0.1);
}

.dark {
  --primary: #3b82f6;
  --primary-dark: #2563eb;
  --bg-main: #111827;
  --bg-card: #273548;
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --border: #374151;
  --shadow: 0 1px 3px rgba(59, 130, 246, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 25px rgba(59, 130, 246, 0.2), 0 4px 10px rgba(0, 0, 0, 0.2);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  background: var(--bg-main);
  color: var(--text-primary);
  line-height: 1.6;
  transition: background-color 0.3s, color 0.3s;
}

.theme-toggle {
  background: transparent;
  border: none;
  padding: 8px;
  cursor: pointer;
  font-size: 24px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  margin-left: 12px;
}

.theme-toggle:hover {
  background: rgba(59, 130, 246, 0.1);
  transform: scale(1.1);
}

.dark .theme-toggle:hover {
  background: rgba(59, 130, 246, 0.15);
}

.container {
  display: flex;
  min-height: 100vh;
}

/* Sidebar */
.sidebar {
  width: 280px;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  padding: 24px;
  overflow-y: auto;
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.sidebar-logo {
  margin-bottom: 20px;
  text-align: left;
}

.sidebar-logo img {
  max-width: 100%;
  width: 100%;
  height: auto;
  max-height: 60px;
  object-fit: contain;
  object-position: left center;
  transition: filter 0.3s;
}

.dark .sidebar-logo img {
  filter: invert(1) brightness(1.2);
}

.sidebar-header h1 {
  font-size: 24px;
  margin-bottom: 8px;
}

.bookmark-count {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 24px;
}

.search-box {
  margin-bottom: 24px;
}

.search-box input {
  width: 100%;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
}

.search-box input:focus {
  outline: none;
  border-color: var(--primary);
}

.categories {
  margin-bottom: 32px;
}

.categories h2 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  font-weight: 600;
}

.category-item {
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.category-item:hover {
  background: var(--bg-main);
}

.category-item.active {
  background: var(--primary);
  color: white;
}

.category-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-count {
  font-size: 12px;
  opacity: 0.7;
  margin-left: auto;
}

.category-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.category-color-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  text-align: center;
}

.footer-date,
.footer-author {
  font-size: 11px;
  color: #9ca3af;
  margin: 0;
  line-height: 1.6;
}

.footer-date {
  margin-bottom: 2px;
}

/* Main Content */
.main-content {
  flex: 1;
  padding: 32px;
  max-width: 1400px;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.category-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex: 1;
}

.category-title h2 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.category-count-badge {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.header-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.view-controls {
  display: flex;
  gap: 8px;
}

.view-btn {
  padding: 8px 16px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.view-btn:hover {
  border-color: var(--primary);
}

.view-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.sort-controls select {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-card);
  cursor: pointer;
}

/* Tags Bar */
.tags-bar {
  padding: 0 0 20px 0;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.tag-item:hover {
  background: #e5e7eb;
  border-color: #cbd5e0;
}

.tag-item.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* Tag Groups */
.tag-group {
  margin-bottom: 48px;
}

.tag-group-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
}

.tag-group-icon {
  color: var(--primary);
  font-size: 20px;
  font-weight: 700;
}

.tag-group-count {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-main);
  padding: 4px 12px;
  border-radius: 12px;
  margin-left: auto;
}

.tag-group-content.grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 24px;
}

.tag-group-content.list-view {
  display: block;
}

/* Bookmarks Grid */
.bookmarks-grid {
  display: block;
}

.bookmarks-grid.list-view {
  display: block;
}

/* Vista Lista */
.bookmark-list-item {
  background: var(--bg-card);
  padding: 14px 20px;
  margin-bottom: 8px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.bookmark-list-item:hover {
  background: #f8f9fa;
  border-left-color: var(--primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.dark .bookmark-list-item:hover {
  background: #2d3748;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.15);
}

.list-item-content {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  overflow: hidden;
  gap: 8px;
  font-size: 14px;
  line-height: 1.4;
}

.list-title {
  font-weight: 600;
  color: var(--text-primary);
  flex-shrink: 0;
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-description {
  color: var(--text-secondary);
  font-style: italic;
  flex-shrink: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

.list-url {
  color: var(--primary);
  font-size: 13px;
  flex-shrink: 0;
}

.list-separator {
  color: #d1d5db;
  flex-shrink: 0;
  user-select: none;
}

.list-tag {
  display: inline-block;
  background: var(--bg-main);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.list-category {
  color: var(--text-secondary);
  font-size: 13px;
  flex-shrink: 0;
}

.list-date {
  color: #9ca3af;
  font-size: 12px;
  flex-shrink: 0;
  margin-left: auto;
}

@media (max-width: 1400px) {
  .bookmarks-grid {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  }
}

@media (max-width: 1024px) {
  .bookmarks-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
}

.bookmark-card {
  background: var(--bg-card);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
}

.bookmark-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08);
}

.dark .bookmark-card:hover {
  box-shadow: 0 12px 32px rgba(59, 130, 246, 0.4), 0 8px 16px rgba(59, 130, 246, 0.2), 0 0 0 1px rgba(59, 130, 246, 0.3);
}

.bookmark-thumbnail {
  width: 100%;
  max-height: 240px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.bookmark-thumbnail img {
  width: 100%;
  height: auto;
  max-height: 240px;
  display: block;
  object-fit: cover;
  object-position: top;
}

.bookmark-content {
  padding: 16px;
}

.bookmark-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bookmark-url {
  font-size: 13px;
  color: var(--primary);
  margin-bottom: 8px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.bookmark-description {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bookmark-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.bookmark-tag {
  padding: 4px 8px;
  background: var(--bg-main);
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

.bookmark-meta {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  justify-content: space-between;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

/* Responsive */
@media (max-width: 768px) {
  .container {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    height: auto;
    position: relative;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .bookmarks-grid {
    grid-template-columns: 1fr;
  }
}`;
  }
  generateJS() {
    return `
let bookmarks = BOOKMARKS_DATA.bookmarks;
let categories = BOOKMARKS_DATA.categories;
let tags = BOOKMARKS_DATA.tags;
let filteredBookmarks = [...bookmarks];
let currentCategory = '';
let currentTags = [];
let currentView = 'grid';
let currentSearchTerm = '';

document.addEventListener('DOMContentLoaded', init);

function init() {
  // Inicializar tema
  initTheme();

  document.getElementById('totalCount').textContent = bookmarks.length;

  // Mostrar fecha de exportación
  const exportDate = new Date(BOOKMARKS_DATA.exportedAt);
  document.getElementById('exportDate').textContent = exportDate.toLocaleDateString('es-ES');

  renderCategories();
  updateCategoryTitle();
  renderTagsForCategory();
  renderBookmarks();

  document.getElementById('searchInput').addEventListener('input', (e) => {
    currentSearchTerm = e.target.value;
    applyFilters();
  });
  document.getElementById('sortSelect').addEventListener('change', handleSort);

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
    updateThemeIcon(true);
  } else {
    document.documentElement.classList.remove('dark');
    updateThemeIcon(false);
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
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

function renderCategories() {
  const container = document.getElementById('categoriesList');
  let html = '<div class="category-item active" onclick="selectCategory(\\\'\\\', \\\'Todas\\\')"><span class="category-name">Todas</span><span class="category-count">' + bookmarks.length + '</span></div>';

  categories.forEach(cat => {
    const count = bookmarks.filter(b => b.categoryId === cat.id).length;
    if (count > 0) {
      const icon = cat.icon || '📁';
      html += '<div class="category-item" onclick="selectCategory(\\\''+cat.id+'\\\', \\\''+escapeHtml(cat.name)+'\\\')"><span class="category-name"><span class="category-icon">'+icon+'</span>'+escapeHtml(cat.name)+'</span><span class="category-count">'+count+'</span></div>';
    }
  });

  container.innerHTML = html;
}

function updateCategoryTitle() {
  const titleEl = document.getElementById('currentCategoryTitle');
  const countEl = document.getElementById('currentCategoryCount');

  if (!currentCategory) {
    titleEl.textContent = 'Todas';
    countEl.textContent = bookmarks.length + ' marcadores';
  } else {
    const category = categories.find(c => c.id === currentCategory);
    const count = bookmarks.filter(b => b.categoryId === currentCategory).length;
    titleEl.textContent = category ? category.name : 'Todas';
    countEl.textContent = count + ' marcadores';
  }
}

function renderTagsForCategory() {
  const container = document.getElementById('tagsList');

  // Obtener bookmarks de la categoría actual
  const categoryBookmarks = currentCategory
    ? bookmarks.filter(b => b.categoryId === currentCategory)
    : bookmarks;

  // Obtener tags únicos de estos bookmarks
  const categoryTags = new Map();
  categoryBookmarks.forEach(b => {
    if (b.tags && Array.isArray(b.tags)) {
      b.tags.forEach(tag => {
        if (tag) {
          categoryTags.set(tag, (categoryTags.get(tag) || 0) + 1);
        }
      });
    }
  });

  // Convertir a array y ordenar por uso
  const sortedTags = Array.from(categoryTags.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // SIEMPRE agregar la opción "Todas" al inicio
  let html = '';
  const showingAll = currentTags.length === 0;
  html += '<span class="tag-item'+(showingAll ? ' active' : '')+'" onclick="clearTagFilters()" style="font-weight: 600;">✕ Todas</span>';

  // Si no hay etiquetas en esta categoría, solo mostrar "Todas"
  if (sortedTags.length === 0) {
    container.innerHTML = html;
    return;
  }

  // Agregar las demás etiquetas
  sortedTags.forEach(tag => {
    const isActive = currentTags.includes(tag.name);
    html += '<span class="tag-item'+(isActive ? ' active' : '')+'" onclick="toggleTag(\\\''+escapeHtml(tag.name)+'\\\')">'+escapeHtml(tag.name)+' ('+tag.count+')</span>';
  });

  container.innerHTML = html;
}

function renderBookmarks() {
  const container = document.getElementById('bookmarksGrid');
  const emptyState = document.getElementById('emptyState');

  if (filteredBookmarks.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  container.style.display = 'block';
  emptyState.style.display = 'none';

  // Agrupar marcadores por etiquetas
  const bookmarksByTag = {};
  const bookmarksWithoutTags = [];

  filteredBookmarks.forEach(bookmark => {
    if (!bookmark.tags || bookmark.tags.length === 0) {
      bookmarksWithoutTags.push(bookmark);
    } else {
      // Agrupar por la primera etiqueta
      const mainTag = bookmark.tags[0];
      if (!bookmarksByTag[mainTag]) {
        bookmarksByTag[mainTag] = [];
      }
      bookmarksByTag[mainTag].push(bookmark);
    }
  });

  let html = '';

  // Renderizar marcadores sin etiquetas primero
  if (bookmarksWithoutTags.length > 0) {
    html += '<div class="tag-group">';
    html += '<h3 class="tag-group-title"><span class="tag-group-icon">📋</span>Sin etiquetar<span class="tag-group-count">'+bookmarksWithoutTags.length+'</span></h3>';
    html += '<div class="tag-group-content '+(currentView === 'list' ? 'list-view' : 'grid-view')+'">';

    bookmarksWithoutTags.forEach(bookmark => {
      html += renderBookmarkCard(bookmark, currentView);
    });

    html += '</div></div>';
  }

  // Ordenar etiquetas por cantidad de marcadores (descendente)
  const tagNames = Object.keys(bookmarksByTag).sort((a, b) => {
    return bookmarksByTag[b].length - bookmarksByTag[a].length;
  });

  // Renderizar grupos de etiquetas ordenados por cantidad
  tagNames.forEach(tagName => {
    const bookmarksInGroup = bookmarksByTag[tagName];

    html += '<div class="tag-group">';
    html += '<h3 class="tag-group-title"><span class="tag-group-icon">#</span>'+escapeHtml(tagName)+'<span class="tag-group-count">'+bookmarksInGroup.length+'</span></h3>';
    html += '<div class="tag-group-content '+(currentView === 'list' ? 'list-view' : 'grid-view')+'">';

    bookmarksInGroup.forEach(bookmark => {
      html += renderBookmarkCard(bookmark, currentView);
    });

    html += '</div></div>';
  });

  container.innerHTML = html;
}

function renderBookmarkCard(bookmark, view) {
  const category = categories.find(c => c.id === bookmark.categoryId);
  const categoryColor = category && category.color ? category.color : '#667eea';
  let html = '';

  if (view === 'list') {
    // VISTA LISTA
    const tagsHtml = bookmark.tags && bookmark.tags.length > 0
      ? bookmark.tags.slice(0, 3).map(tag => '<span class="list-tag">'+escapeHtml(tag)+'</span>').join('')
      : '';

    html += '<div class="bookmark-list-item" onclick="window.open(\\\''+bookmark.url+'\\\', \\\'_blank\\\')">';
    html += '<div class="list-item-content">';
    html += '<span class="category-color-dot" style="background-color: '+categoryColor+';"></span>';
    html += '<span class="list-title">'+escapeHtml(bookmark.title)+'</span>';
    if (bookmark.description) {
      html += '<span class="list-separator">•</span><span class="list-description">'+escapeHtml(bookmark.description)+'</span>';
    }
    html += '<span class="list-separator">•</span><span class="list-url">'+escapeHtml(new URL(bookmark.url).hostname)+'</span>';
    if (tagsHtml) {
      html += '<span class="list-separator">•</span>'+tagsHtml;
    }
    html += '<span class="list-separator">•</span><span class="list-category">'+(category ? escapeHtml(category.name) : 'Sin categoría')+'</span>';
    html += '<span class="list-separator">•</span><span class="list-date">'+new Date(bookmark.createdAt).toLocaleDateString('es-ES')+'</span>';
    html += '</div></div>';
  } else {
    // VISTA GRID
    const imgSrc = bookmark.imageKeys && bookmark.imageKeys.thumb
      ? 'images/thumbs/' + bookmark.imageKeys.thumb
      : 'data:image/svg+xml,%3Csvg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'320\\\' height=\\\'180\\\'%3E%3Crect fill=\\\'%23667eea\\\' width=\\\'320\\\' height=\\\'180\\\'/%3E%3C/svg%3E';

    html += '<div class="bookmark-card" onclick="window.open(\\\''+bookmark.url+'\\\', \\\'_blank\\\')">';
    html += '<div class="bookmark-thumbnail"><img src="'+imgSrc+'" alt="" loading="lazy"></div>';
    html += '<div class="bookmark-content"><h3 class="bookmark-title">'+escapeHtml(bookmark.title)+'</h3>';
    html += '<div class="bookmark-url">'+escapeHtml(new URL(bookmark.url).hostname)+'</div>';

    if (bookmark.description) {
      html += '<p class="bookmark-description">'+escapeHtml(bookmark.description)+'</p>';
    }

    if (bookmark.tags && bookmark.tags.length > 0) {
      html += '<div class="bookmark-tags">';
      bookmark.tags.slice(0, 5).forEach(tag => {
        html += '<span class="bookmark-tag">'+escapeHtml(tag)+'</span>';
      });
      html += '</div>';
    }

    html += '<div class="bookmark-meta"><span><span class="category-color-dot" style="background-color: '+categoryColor+';"></span>'+(category ? escapeHtml(category.name) : 'Sin categoría')+'</span><span>'+new Date(bookmark.createdAt).toLocaleDateString('es-ES')+'</span></div></div></div>';
  }

  return html;
}

function selectCategory(categoryId, categoryName) {
  currentCategory = categoryId;
  currentTags = []; // Resetear etiquetas al cambiar categoría

  // Actualizar UI de categorías
  document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
  event.target.classList.add('active');

  // Actualizar título
  updateCategoryTitle();

  // Renderizar etiquetas de esta categoría
  renderTagsForCategory();

  // Aplicar filtros
  applyFilters();
}

function clearTagFilters() {
  currentTags = [];
  renderTagsForCategory();
  applyFilters();
}

function toggleTag(tagName) {
  const idx = currentTags.indexOf(tagName);
  if (idx > -1) {
    currentTags.splice(idx, 1);
  } else {
    currentTags.push(tagName);
  }

  // Re-renderizar etiquetas para actualizar estado activo
  renderTagsForCategory();

  // Aplicar filtros
  applyFilters();
}

function applyFilters() {
  filteredBookmarks = bookmarks.filter(b => {
    const matchesCategory = !currentCategory || b.categoryId === currentCategory;
    const matchesTags = currentTags.length === 0 || currentTags.some(tag => b.tags && b.tags.includes(tag));
    const matchesSearch = !currentSearchTerm ||
      b.title.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
      b.url.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
      (b.description && b.description.toLowerCase().includes(currentSearchTerm.toLowerCase()));

    return matchesCategory && matchesTags && matchesSearch;
  });

  // Actualizar contador
  const countEl = document.getElementById('currentCategoryCount');
  countEl.textContent = filteredBookmarks.length + ' marcadores';

  renderBookmarks();
}

function handleSort(e) {
  const sortBy = e.target.value;
  if (sortBy === 'recent') {
    filteredBookmarks.sort((a, b) => b.createdAt - a.createdAt);
  } else if (sortBy === 'oldest') {
    filteredBookmarks.sort((a, b) => a.createdAt - b.createdAt);
  } else if (sortBy === 'title') {
    filteredBookmarks.sort((a, b) => a.title.localeCompare(b.title));
  }
  renderBookmarks();
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  renderBookmarks();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}`;
  }
  generateFaviconSvg() {
    return `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient>
  </defs>
  <circle cx="16" cy="16" r="15" fill="url(#grad1)"/>
  <path d="M10 8C10 7.17157 10.6716 6.5 11.5 6.5H20.5C21.3284 6.5 22 7.17157 22 8V24L16 20.5L10 24V8Z"
        fill="white"/>
  <circle cx="16" cy="12" r="1.5" fill="rgba(102,126,234,0.8)"/>
</svg>`;
  }

  async regenerateImages(bookmarks) {
    const imageProcessor = new ImageProcessor();
    let regenerated = 0;

    for (const bookmark of bookmarks) {
      try {
        if (bookmark.imageStatus === CONSTANTS.IMAGE_STATUS.REAL && bookmark.imageKeys?.thumb) {
          const thumbFile = await this.opfsManager.getImage(bookmark.imageKeys.thumb, 'thumb');
          if (thumbFile) {
            const recompressed = await imageProcessor.recompressImage(thumbFile, 'thumb');
            if (recompressed && recompressed.size < thumbFile.size) {
              await this.opfsManager.saveImage(recompressed, bookmark.imageKeys.thumb, 'thumb');
              regenerated++;
            }
          }
        }
      } catch (error) {
        console.warn(`Error al regenerar imagen para ${bookmark.id}:`, error);
      }
    }

    console.log(`${regenerated} imágenes regeneradas`);
  }

  async downloadZip(zip) {
    console.log('Generando archivo ZIP...');

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const filename = `marcadores-bauset-${new Date().toISOString().split('T')[0]}.zip`;

    const url = URL.createObjectURL(zipBlob);

    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return zipBlob;
  }
}

// Para uso en el service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportService;
}

// Para uso en el navegador
if (typeof window !== 'undefined') {
  window.ExportService = ExportService;
}