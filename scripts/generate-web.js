#!/usr/bin/env node

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const os = require('os');

// Función para encontrar el archivo de datos exportado
async function findDataExportFile() {
  // Intentar primero en el directorio del proyecto
  let dataPath = path.join(__dirname, '..', 'data-export.json');
  if (fss.existsSync(dataPath)) {
    return dataPath;
  }

  // Intentar en la carpeta de Descargas del usuario
  const downloadsPath = path.join(os.homedir(), 'Downloads', 'data-export.json');
  if (fss.existsSync(downloadsPath)) {
    return downloadsPath;
  }

  throw new Error('No se encontró data-export.json. Por favor, exporta los datos desde la extensión primero.');
}

// Simular el entorno de Chrome storage para Node.js
const mockChromeStorage = {
  local: {
    get: async (keys) => {
      try {
        const dataPath = await findDataExportFile();
        const data = await fs.readFile(dataPath, 'utf-8');
        return { 'marcadores_bauset_data': JSON.parse(data) };
      } catch (error) {
        return { 'marcadores_bauset_data': null };
      }
    }
  }
};

async function generateStaticSite() {
  const webDir = path.join(__dirname, '..', 'web');

  // Borrar contenido previo de la carpeta web
  try {
    await fs.rm(webDir, { recursive: true, force: true });
    console.log('✓ Carpeta web/ limpiada');
  } catch (error) {
    // La carpeta no existe, continuamos
  }

  // Crear estructura de directorios
  await fs.mkdir(webDir, { recursive: true });
  await fs.mkdir(path.join(webDir, 'assets'), { recursive: true });
  await fs.mkdir(path.join(webDir, 'data'), { recursive: true });
  await fs.mkdir(path.join(webDir, 'images'), { recursive: true });
  await fs.mkdir(path.join(webDir, 'images', 'thumb'), { recursive: true });
  await fs.mkdir(path.join(webDir, 'images', 'mid'), { recursive: true });
  console.log('✓ Estructura de directorios creada');

  // Cargar datos
  const result = await mockChromeStorage.local.get(['marcadores_bauset_data']);
  const savedData = result.marcadores_bauset_data;

  if (!savedData) {
    throw new Error('No hay datos de marcadores para exportar');
  }

  const data = typeof savedData === 'string' ? JSON.parse(savedData) : savedData;
  const bookmarks = data.bookmarks || [];
  const categories = data.categories || [];

  // Extraer tags únicos
  const allTags = bookmarks.flatMap(b => b.tags || []);
  const tagCounts = {};
  allTags.forEach(tag => {
    if (tag && tag.trim()) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  });
  const tags = Object.entries(tagCounts).map(([name, count]) => ({
    name: name,
    usageCount: count
  }));

  const exportData = {
    bookmarks: bookmarks.map(b => ({
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
    categories: categories,
    tags: tags,
    exportedAt: Date.now(),
    version: '1.0.0'
  };

  // Generar archivos
  await generateIndexHtml(webDir);
  await generateCSS(webDir);
  await generateJS(webDir);
  await generateFaviconSvg(webDir);
  await generateDataFile(webDir, exportData);

  console.log(`✓ Sitio web generado en web/`);
  console.log(`  - ${bookmarks.length} marcadores`);
  console.log(`  - ${categories.length} categorías`);
  console.log(`  - ${tags.length} etiquetas`);

  return {
    success: true,
    bookmarkCount: bookmarks.length
  };
}

async function generateIndexHtml(webDir) {
  const ExportService = require('../utils/export-service.js');
  const exportService = new ExportService();
  const html = exportService.generateIndexHtml();
  await fs.writeFile(path.join(webDir, 'index.html'), html, 'utf-8');
}

async function generateCSS(webDir) {
  const ExportService = require('../utils/export-service.js');
  const exportService = new ExportService();
  const css = exportService.generateCSS();
  await fs.writeFile(path.join(webDir, 'assets', 'styles.css'), css, 'utf-8');
}

async function generateJS(webDir) {
  const ExportService = require('../utils/export-service.js');
  const exportService = new ExportService();
  const js = exportService.generateJS();
  await fs.writeFile(path.join(webDir, 'assets', 'script.js'), js, 'utf-8');
}

async function generateFaviconSvg(webDir) {
  const ExportService = require('../utils/export-service.js');
  const exportService = new ExportService();
  const svg = exportService.generateFaviconSvg();
  await fs.writeFile(path.join(webDir, 'assets', 'favicon.svg'), svg, 'utf-8');
}

async function generateDataFile(webDir, exportData) {
  const json = JSON.stringify(exportData, null, 2);
  await fs.writeFile(path.join(webDir, 'data', 'bookmarks.json'), json, 'utf-8');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  generateStaticSite()
    .then(result => {
      console.log('\n✅ Sitio estático generado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error al generar sitio estático:', error.message);
      process.exit(1);
    });
}

module.exports = { generateStaticSite };
