class StaticSiteGenerator {
  constructor() {
    this.categories = [];
    this.bookmarks = [];
    this.generatedFiles = new Map();
  }

  async generateSite(categories, bookmarks) {
    this.categories = categories;
    this.bookmarks = bookmarks;
    this.generatedFiles.clear();

    console.log('Generating static site with', categories.length, 'categories and', bookmarks.length, 'bookmarks');

    // Generar archivos del sitio
    await this.generateIndexHTML();
    await this.generateCategoryPages();
    await this.generateCSS();
    await this.generateJavaScript();
    await this.generateManifest();

    return this.generatedFiles;
  }

  async generateIndexHTML() {
    const stats = this.calculateStats();
    const recentBookmarks = this.getRecentBookmarks(10);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mis Marcadores - Marcadores Bauset</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📌</text></svg>">
</head>
<body>
  <header class="header">
    <div class="container">
      <h1>📌 Mis Marcadores</h1>
      <p>Colección personal de enlaces organizados</p>
      <div class="stats">
        <div class="stat">
          <span class="stat-number">${stats.totalBookmarks}</span>
          <span class="stat-label">Marcadores</span>
        </div>
        <div class="stat">
          <span class="stat-number">${stats.totalCategories}</span>
          <span class="stat-label">Categorías</span>
        </div>
        <div class="stat">
          <span class="stat-number">${stats.totalTags}</span>
          <span class="stat-label">Etiquetas</span>
        </div>
      </div>
    </div>
  </header>

  <nav class="navigation">
    <div class="container">
      <ul class="nav-list">
        <li><a href="index.html" class="nav-link active">🏠 Inicio</a></li>
        ${this.categories.map(category =>
          `<li><a href="category-${this.slugify(category.name)}.html" class="nav-link">
            📁 ${this.escapeHtml(category.name)} (${this.getCategoryBookmarkCount(category.id)})
          </a></li>`
        ).join('')}
      </ul>
    </div>
  </nav>

  <main class="main">
    <div class="container">
      <section class="section">
        <h2>📋 Categorías</h2>
        <div class="categories-grid">
          ${this.categories.map(category => {
            const bookmarkCount = this.getCategoryBookmarkCount(category.id);
            return `
              <div class="category-card">
                <h3>
                  <a href="category-${this.slugify(category.name)}.html">
                    📁 ${this.escapeHtml(category.name)}
                  </a>
                </h3>
                <p class="category-count">${bookmarkCount} marcadores</p>
                ${category.description ? `<p class="category-description">${this.escapeHtml(category.description)}</p>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </section>

      ${recentBookmarks.length > 0 ? `
      <section class="section">
        <h2>🕒 Marcadores Recientes</h2>
        <div class="bookmarks-list">
          ${recentBookmarks.map(bookmark => this.generateBookmarkCard(bookmark)).join('')}
        </div>
      </section>
      ` : ''}

      <section class="section">
        <h2>🏷️ Todas las Etiquetas</h2>
        <div class="tags-cloud">
          ${this.generateTagsCloud()}
        </div>
      </section>
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <p>Generado con Marcadores Bauset • ${new Date().toLocaleDateString('es-ES')}</p>
    </div>
  </footer>

  <script src="script.js"></script>
</body>
</html>`;

    this.generatedFiles.set('index.html', html);
  }

  async generateCategoryPages() {
    for (const category of this.categories) {
      const categoryBookmarks = this.bookmarks.filter(b => b.categoryId === category.id);
      const fileName = `category-${this.slugify(category.name)}.html`;

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(category.name)} - Mis Marcadores</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📌</text></svg>">
</head>
<body>
  <header class="header">
    <div class="container">
      <h1>📁 ${this.escapeHtml(category.name)}</h1>
      <p>${categoryBookmarks.length} marcadores en esta categoría</p>
      ${category.description ? `<p class="category-description">${this.escapeHtml(category.description)}</p>` : ''}
    </div>
  </header>

  <nav class="navigation">
    <div class="container">
      <ul class="nav-list">
        <li><a href="index.html" class="nav-link">🏠 Inicio</a></li>
        ${this.categories.map(cat =>
          `<li><a href="category-${this.slugify(cat.name)}.html" class="nav-link ${cat.id === category.id ? 'active' : ''}">
            📁 ${this.escapeHtml(cat.name)} (${this.getCategoryBookmarkCount(cat.id)})
          </a></li>`
        ).join('')}
      </ul>
    </div>
  </nav>

  <main class="main">
    <div class="container">
      <div class="toolbar">
        <div class="search-container">
          <input type="text" id="searchInput" placeholder="🔍 Buscar en esta categoría..." class="search-input">
        </div>
        <div class="sort-container">
          <select id="sortSelect" class="sort-select">
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="title">Por título</option>
            <option value="url">Por URL</option>
          </select>
        </div>
      </div>

      <div class="bookmarks-list" id="bookmarksList">
        ${categoryBookmarks.map(bookmark => this.generateBookmarkCard(bookmark)).join('')}
      </div>

      ${categoryBookmarks.length === 0 ? `
        <div class="empty-state">
          <h3>No hay marcadores en esta categoría</h3>
          <p>Esta categoría está vacía.</p>
        </div>
      ` : ''}
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <p>Generado con Marcadores Bauset • ${new Date().toLocaleDateString('es-ES')}</p>
    </div>
  </footer>

  <script src="script.js"></script>
</body>
</html>`;

      this.generatedFiles.set(fileName, html);
    }
  }

  generateBookmarkCard(bookmark) {
    const category = this.categories.find(c => c.id === bookmark.categoryId);
    const categoryName = category ? category.name : 'Sin categoría';

    const tagsHtml = bookmark.tags && bookmark.tags.length > 0
      ? `<div class="bookmark-tags">${bookmark.tags.map(tag => `<span class="tag" data-tag="${this.escapeHtml(tag)}">${this.escapeHtml(tag)}</span>`).join('')}</div>`
      : '';

    const descriptionHtml = bookmark.description
      ? `<p class="bookmark-description">${this.escapeHtml(bookmark.description)}</p>`
      : '';

    return `
      <div class="bookmark-card" data-title="${this.escapeHtml(bookmark.title.toLowerCase())}" data-url="${this.escapeHtml(bookmark.url.toLowerCase())}" data-tags="${bookmark.tags ? bookmark.tags.join(' ').toLowerCase() : ''}" data-date="${bookmark.createdAt}">
        <div class="bookmark-header">
          <h3 class="bookmark-title">
            <a href="${bookmark.url}" target="_blank" rel="noopener noreferrer">
              ${this.escapeHtml(bookmark.title)}
            </a>
          </h3>
          <div class="bookmark-meta">
            <span class="bookmark-category">📁 ${this.escapeHtml(categoryName)}</span>
            <span class="bookmark-date">📅 ${new Date(bookmark.createdAt).toLocaleDateString('es-ES')}</span>
          </div>
        </div>
        <div class="bookmark-url">
          <a href="${bookmark.url}" target="_blank" rel="noopener noreferrer">
            🔗 ${this.escapeHtml(this.getDomain(bookmark.url))}
          </a>
        </div>
        ${descriptionHtml}
        ${tagsHtml}
      </div>
    `;
  }

  async generateCSS() {
    const css = `/* Marcadores Bauset - Static Site Styles */

:root {
  --primary-color: #667eea;
  --primary-dark: #5a6fd8;
  --secondary-color: #764ba2;
  --accent-color: #4CAF50;
  --background: #f8f9fa;
  --surface: #ffffff;
  --text-primary: #333333;
  --text-secondary: #666666;
  --text-muted: #999999;
  --border: #e1e5e9;
  --border-light: #f0f0f0;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
  --shadow-hover: 0 4px 12px rgba(0,0,0,0.15);
  --radius: 8px;
  --radius-small: 4px;
}

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--background);
  margin: 0;
  padding: 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Header */
.header {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: white;
  padding: 2rem 0;
  text-align: center;
}

.header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.header p {
  margin: 0 0 1.5rem 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

.stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.stat {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 0.9rem;
  opacity: 0.8;
}

/* Navigation */
.navigation {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.nav-link {
  display: block;
  padding: 1rem 1.5rem;
  text-decoration: none;
  color: var(--text-secondary);
  border-radius: var(--radius);
  transition: all 0.2s ease;
  font-weight: 500;
}

.nav-link:hover {
  background: var(--background);
  color: var(--text-primary);
}

.nav-link.active {
  background: var(--primary-color);
  color: white;
}

/* Main Content */
.main {
  padding: 2rem 0;
  min-height: 60vh;
}

.section {
  margin-bottom: 3rem;
}

.section h2 {
  margin: 0 0 1.5rem 0;
  font-size: 1.8rem;
  color: var(--text-primary);
}

/* Categories Grid */
.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.category-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.category-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}

.category-card h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.3rem;
}

.category-card h3 a {
  text-decoration: none;
  color: var(--primary-color);
}

.category-card h3 a:hover {
  color: var(--primary-dark);
}

.category-count {
  margin: 0 0 0.5rem 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.category-description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-style: italic;
}

/* Toolbar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.search-container {
  flex: 1;
  min-width: 250px;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.sort-select {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 1rem;
  background: var(--surface);
  cursor: pointer;
}

/* Bookmarks List */
.bookmarks-list {
  display: grid;
  gap: 1.5rem;
}

.bookmark-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.bookmark-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-hover);
}

.bookmark-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  gap: 1rem;
}

.bookmark-title {
  margin: 0;
  font-size: 1.2rem;
  flex: 1;
}

.bookmark-title a {
  text-decoration: none;
  color: var(--text-primary);
}

.bookmark-title a:hover {
  color: var(--primary-color);
}

.bookmark-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-align: right;
  white-space: nowrap;
}

.bookmark-url {
  margin-bottom: 0.75rem;
}

.bookmark-url a {
  color: var(--primary-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.bookmark-url a:hover {
  text-decoration: underline;
}

.bookmark-description {
  margin: 0 0 0.75rem 0;
  color: var(--text-secondary);
  font-style: italic;
}

.bookmark-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  background: #e1effe;
  color: #1e40af;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-small);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tag:hover {
  background: #bfdbfe;
}

/* Tags Cloud */
.tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.tags-cloud .tag {
  font-size: 0.9rem;
  padding: 0.5rem 0.75rem;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted);
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: var(--text-secondary);
}

/* Footer */
.footer {
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 2rem 0;
  text-align: center;
  color: var(--text-secondary);
  margin-top: 3rem;
}

/* Responsive */
@media (max-width: 768px) {
  .container {
    padding: 0 15px;
  }

  .header h1 {
    font-size: 2rem;
  }

  .stats {
    gap: 1rem;
  }

  .nav-list {
    flex-direction: column;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .bookmark-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .bookmark-meta {
    text-align: left;
  }

  .categories-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .header {
    padding: 1.5rem 0;
  }

  .header h1 {
    font-size: 1.8rem;
  }

  .main {
    padding: 1.5rem 0;
  }

  .section h2 {
    font-size: 1.5rem;
  }
}

/* Print Styles */
@media print {
  .navigation,
  .toolbar,
  .footer {
    display: none;
  }

  .bookmark-card {
    break-inside: avoid;
    margin-bottom: 1rem;
  }

  a {
    text-decoration: none;
  }

  .bookmark-url a::after {
    content: " (" attr(href) ")";
    font-size: 0.8em;
    color: var(--text-muted);
  }
}`;

    this.generatedFiles.set('styles.css', css);
  }

  async generateJavaScript() {
    const js = `// Marcadores Bauset - Static Site JavaScript

document.addEventListener('DOMContentLoaded', function() {
  initializeSearch();
  initializeSorting();
  initializeTagFiltering();
});

function initializeSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase().trim();
    filterBookmarks(query);
  });
}

function initializeSorting() {
  const sortSelect = document.getElementById('sortSelect');
  if (!sortSelect) return;

  sortSelect.addEventListener('change', function(e) {
    sortBookmarks(e.target.value);
  });
}

function initializeTagFiltering() {
  const tags = document.querySelectorAll('.tag[data-tag]');
  tags.forEach(tag => {
    tag.addEventListener('click', function() {
      const tagName = this.dataset.tag;
      filterByTag(tagName);
    });
  });
}

function filterBookmarks(query) {
  const bookmarkCards = document.querySelectorAll('.bookmark-card');
  let visibleCount = 0;

  bookmarkCards.forEach(card => {
    const title = card.dataset.title || '';
    const url = card.dataset.url || '';
    const tags = card.dataset.tags || '';
    const description = card.querySelector('.bookmark-description')?.textContent.toLowerCase() || '';

    const matches = !query ||
      title.includes(query) ||
      url.includes(query) ||
      tags.includes(query) ||
      description.includes(query);

    if (matches) {
      card.style.display = 'block';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });

  updateEmptyState(visibleCount, query);
}

function sortBookmarks(sortBy) {
  const bookmarksList = document.getElementById('bookmarksList');
  if (!bookmarksList) return;

  const cards = Array.from(bookmarksList.querySelectorAll('.bookmark-card'));

  cards.sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return parseInt(b.dataset.date) - parseInt(a.dataset.date);
      case 'oldest':
        return parseInt(a.dataset.date) - parseInt(b.dataset.date);
      case 'title':
        return (a.dataset.title || '').localeCompare(b.dataset.title || '');
      case 'url':
        return (a.dataset.url || '').localeCompare(b.dataset.url || '');
      default:
        return parseInt(b.dataset.date) - parseInt(a.dataset.date);
    }
  });

  // Re-append sorted cards
  cards.forEach(card => bookmarksList.appendChild(card));
}

function filterByTag(tagName) {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = tagName;
    filterBookmarks(tagName.toLowerCase());
  }
}

function updateEmptyState(visibleCount, query) {
  const existingEmptyState = document.querySelector('.search-empty-state');
  if (existingEmptyState) {
    existingEmptyState.remove();
  }

  if (visibleCount === 0 && query) {
    const bookmarksList = document.getElementById('bookmarksList');
    if (bookmarksList) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state search-empty-state';
      emptyState.innerHTML = \`
        <h3>No se encontraron resultados</h3>
        <p>No hay marcadores que coincidan con "<strong>\${escapeHtml(query)}</strong>"</p>
        <button onclick="clearSearch()" class="clear-search-btn">Limpiar búsqueda</button>
      \`;
      bookmarksList.appendChild(emptyState);
    }
  }
}

function clearSearch() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
    filterBookmarks('');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Ctrl/Cmd + K to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  // Escape to clear search
  if (e.key === 'Escape') {
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput === document.activeElement) {
      clearSearch();
      searchInput.blur();
    }
  }
});`;

    this.generatedFiles.set('script.js', js);
  }

  async generateManifest() {
    const manifest = {
      name: "Mis Marcadores",
      description: "Sitio web estático generado con Marcadores Bauset",
      version: "1.0.0",
      generated: new Date().toISOString(),
      stats: this.calculateStats(),
      categories: this.categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        bookmarkCount: this.getCategoryBookmarkCount(cat.id)
      })),
      bookmarks: this.bookmarks.map(bookmark => ({
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        categoryId: bookmark.categoryId,
        tags: bookmark.tags,
        description: bookmark.description,
        createdAt: bookmark.createdAt
      }))
    };

    this.generatedFiles.set('manifest.json', JSON.stringify(manifest, null, 2));
  }

  generateTagsCloud() {
    const allTags = this.bookmarks.flatMap(b => b.tags || []);
    const tagCounts = {};

    allTags.forEach(tag => {
      if (tag && tag.trim()) {
        const cleanTag = tag.trim();
        tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
      }
    });

    const sortedTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50); // Top 50 tags

    return sortedTags.map(([tag, count]) =>
      `<span class="tag" data-tag="${this.escapeHtml(tag)}" title="${count} marcadores">
        ${this.escapeHtml(tag)} (${count})
      </span>`
    ).join('');
  }

  calculateStats() {
    const allTags = this.bookmarks.flatMap(b => b.tags || []);
    const uniqueTags = new Set(allTags.filter(tag => tag && tag.trim()));

    return {
      totalBookmarks: this.bookmarks.length,
      totalCategories: this.categories.length,
      totalTags: uniqueTags.size,
      generated: new Date().toISOString()
    };
  }

  getRecentBookmarks(limit = 10) {
    return [...this.bookmarks]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  getCategoryBookmarkCount(categoryId) {
    return this.bookmarks.filter(b => b.categoryId === categoryId).length;
  }

  getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export para usar en otros archivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StaticSiteGenerator;
} else if (typeof window !== 'undefined') {
  window.StaticSiteGenerator = StaticSiteGenerator;
}