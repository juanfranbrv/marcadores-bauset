// Generadores de archivos para el sitio estático

function generateIndexHTML() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mis Marcadores</title>
  <link rel="stylesheet" href="assets/styles.css">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <meta name="description" content="Colección personal de marcadores organizados por categorías y etiquetas">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <h1 class="site-title">
        <img src="assets/favicon.svg" alt="" class="site-icon">
        Mis Marcadores
      </h1>
      <div class="header-stats">
        <span id="bookmarkCount">0</span> marcadores
      </div>
    </div>
  </header>

  <nav class="site-nav">
    <div class="container">
      <div class="search-box">
        <input
          type="search"
          id="searchInput"
          placeholder="Buscar marcadores..."
          autocomplete="off"
          aria-label="Buscar marcadores"
        >
        <button type="button" id="searchClear" aria-label="Limpiar búsqueda">×</button>
      </div>

      <div class="view-controls">
        <button type="button" class="view-btn active" data-view="grid" aria-label="Vista de cuadrícula">⊞</button>
        <button type="button" class="view-btn" data-view="list" aria-label="Vista de lista">☰</button>
      </div>
    </div>
  </nav>

  <main class="site-main">
    <div class="container">
      <aside class="sidebar">
        <section class="filter-section">
          <h2 class="filter-title">Categorías</h2>
          <div class="categories-list" id="categoriesList" role="list">
            <div class="loading">Cargando...</div>
          </div>
        </section>

        <section class="filter-section">
          <h2 class="filter-title">Etiquetas</h2>
          <div class="tags-cloud" id="tagsCloud">
            <div class="loading">Cargando...</div>
          </div>
        </section>
      </aside>

      <section class="content">
        <div class="content-header">
          <div class="results-info">
            <span id="resultsCount">0 marcadores</span>
          </div>
          <div class="sort-controls">
            <select id="sortBy" aria-label="Ordenar por">
              <option value="created_desc">Más recientes</option>
              <option value="created_asc">Más antiguos</option>
              <option value="title_asc">Título A-Z</option>
              <option value="title_desc">Título Z-A</option>
            </select>
          </div>
        </div>

        <div class="bookmarks-container">
          <div class="empty-state" id="emptyState" style="display: none;">
            <div class="empty-icon">🔍</div>
            <h3>No se encontraron marcadores</h3>
            <p>Prueba con otros términos de búsqueda o filtros.</p>
          </div>

          <div class="bookmarks-grid" id="bookmarksGrid">
            <div class="loading">Cargando marcadores...</div>
          </div>
        </div>
      </section>
    </div>
  </main>

  <footer class="site-footer">
    <div class="container">
      <p>Generado con <strong>Marcadores Bauset</strong> •
        <span id="exportDate"></span>
      </p>
    </div>
  </footer>

  <script src="assets/script.js"></script>
</body>
</html>`;
}
