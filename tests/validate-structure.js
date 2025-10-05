#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class StructureValidator {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.projectRoot = path.join(__dirname, '..');
  }

  addIssue(type, message) {
    this.issues.push({ type, message });
  }

  addWarning(message) {
    this.warnings.push(message);
  }

  validateProjectStructure() {
    console.log('🔍 Validando estructura del proyecto Marcadores Bauset...\n');

    this.validateDirectoryStructure();
    this.validateManifest();
    this.validateFileIntegrity();
    this.validateCodeQuality();
    this.validateAssets();
    this.validatePermissions();

    this.generateReport();
  }

  validateDirectoryStructure() {
    console.log('📁 Validando estructura de directorios...');

    const expectedStructure = {
      'background/': ['service-worker.js'],
      'popup/': ['popup.html', 'popup.css', 'popup.js'],
      'options/': ['options.html', 'options.css', 'options.js'],
      'utils/': [
        'constants.js',
        'opfs-manager.js',
        'db-manager.js',
        'storage-manager.js',
        'image-processor.js',
        'bookmark-service.js',
        'export-service.js',
        'zip-creator.js'
      ],
      'content/': ['overlay-styles.css'],
      'icons/': ['icon-16.svg', 'icon-32.svg', 'icon-48.svg', 'icon-128.svg'],
      'assets/': ['placeholder-icon.svg'],
      'tests/': ['run-tests.js', 'validate-structure.js']
    };

    for (const [dir, files] of Object.entries(expectedStructure)) {
      const dirPath = path.join(this.projectRoot, dir);

      if (!fs.existsSync(dirPath)) {
        this.addIssue('MISSING_DIRECTORY', `Directorio faltante: ${dir}`);
        continue;
      }

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        if (!fs.existsSync(filePath)) {
          this.addIssue('MISSING_FILE', `Archivo faltante: ${dir}${file}`);
        }
      }
    }

    // Verificar archivos en raíz
    const rootFiles = ['manifest.json', 'package.json', 'README.md'];
    for (const file of rootFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (!fs.existsSync(filePath)) {
        this.addIssue('MISSING_ROOT_FILE', `Archivo faltante en raíz: ${file}`);
      }
    }
  }

  validateManifest() {
    console.log('📋 Validando manifest.json...');

    const manifestPath = path.join(this.projectRoot, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      this.addIssue('CRITICAL', 'manifest.json no encontrado');
      return;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      // Verificar campos requeridos
      const requiredFields = ['manifest_version', 'name', 'version', 'permissions'];
      for (const field of requiredFields) {
        if (!manifest[field]) {
          this.addIssue('MANIFEST_FIELD', `Campo requerido faltante en manifest: ${field}`);
        }
      }

      // Verificar versión del manifest
      if (manifest.manifest_version !== 3) {
        this.addIssue('MANIFEST_VERSION', 'Debe usar Manifest V3');
      }

      // Verificar permisos críticos
      const requiredPermissions = ['activeTab', 'downloads', 'storage', 'scripting'];
      for (const permission of requiredPermissions) {
        if (!manifest.permissions.includes(permission)) {
          this.addIssue('MANIFEST_PERMISSION', `Permiso faltante: ${permission}`);
        }
      }

      // Verificar rutas de archivos
      if (manifest.background?.service_worker) {
        const swPath = path.join(this.projectRoot, manifest.background.service_worker);
        if (!fs.existsSync(swPath)) {
          this.addIssue('MANIFEST_PATH', `Service worker no encontrado: ${manifest.background.service_worker}`);
        }
      }

      // Verificar iconos
      if (manifest.icons) {
        for (const [size, iconPath] of Object.entries(manifest.icons)) {
          const fullPath = path.join(this.projectRoot, iconPath);
          if (!fs.existsSync(fullPath)) {
            this.addIssue('MANIFEST_ICON', `Icono faltante: ${iconPath}`);
          }
        }
      }

      // Verificar página de opciones
      if (manifest.options_page) {
        const optionsPath = path.join(this.projectRoot, manifest.options_page);
        if (!fs.existsSync(optionsPath)) {
          this.addIssue('MANIFEST_OPTIONS', `Página de opciones no encontrada: ${manifest.options_page}`);
        }
      }

    } catch (error) {
      this.addIssue('MANIFEST_SYNTAX', `Error de sintaxis en manifest.json: ${error.message}`);
    }
  }

  validateFileIntegrity() {
    console.log('🔧 Validando integridad de archivos...');

    // Verificar que los archivos HTML tienen DOCTYPE y estructura básica
    const htmlFiles = ['popup/popup.html', 'options/options.html'];
    for (const htmlFile of htmlFiles) {
      const filePath = path.join(this.projectRoot, htmlFile);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');

        if (!content.includes('<!DOCTYPE html>')) {
          this.addIssue('HTML_DOCTYPE', `${htmlFile} falta DOCTYPE`);
        }
        if (!content.includes('<html lang="es">')) {
          this.addWarning(`${htmlFile} debería especificar lang="es"`);
        }
        if (!content.includes('<meta charset="UTF-8">')) {
          this.addIssue('HTML_CHARSET', `${htmlFile} falta charset UTF-8`);
        }
      }
    }

    // Verificar que los archivos CSS no están vacíos
    const cssFiles = ['popup/popup.css', 'options/options.css'];
    for (const cssFile of cssFiles) {
      const filePath = path.join(this.projectRoot, cssFile);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        if (content.length < 100) {
          this.addWarning(`${cssFile} parece estar vacío o muy pequeño`);
        }
      }
    }

    // Verificar que los archivos JavaScript no están vacíos
    const jsFiles = [
      'background/service-worker.js',
      'popup/popup.js',
      'options/options.js'
    ];
    for (const jsFile of jsFiles) {
      const filePath = path.join(this.projectRoot, jsFile);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        if (content.length < 100) {
          this.addWarning(`${jsFile} parece estar vacío o muy pequeño`);
        }
      }
    }
  }

  validateCodeQuality() {
    console.log('💻 Validando calidad del código...');

    // Verificar imports en service worker
    const swPath = path.join(this.projectRoot, 'background/service-worker.js');
    if (fs.existsSync(swPath)) {
      const content = fs.readFileSync(swPath, 'utf8');

      const requiredImports = [
        'constants.js',
        'opfs-manager.js',
        'storage-manager.js',
        'bookmark-service.js'
      ];

      for (const importFile of requiredImports) {
        if (!content.includes(importFile)) {
          this.addWarning(`Service worker no importa ${importFile}`);
        }
      }

      // Verificar event listeners básicos
      if (!content.includes('addEventListener')) {
        this.addIssue('SW_EVENTS', 'Service worker debe tener event listeners');
      }
    }

    // Verificar que constants.js tiene las constantes necesarias
    const constantsPath = path.join(this.projectRoot, 'utils/constants.js');
    if (fs.existsSync(constantsPath)) {
      const content = fs.readFileSync(constantsPath, 'utf8');

      const requiredConstants = [
        'DB_NAME',
        'DB_VERSION',
        'IMAGE_SIZES',
        'OPFS_PATHS',
        'DEFAULT_CATEGORY'
      ];

      for (const constant of requiredConstants) {
        if (!content.includes(constant)) {
          this.addIssue('MISSING_CONSTANT', `Constante faltante: ${constant}`);
        }
      }
    }
  }

  validateAssets() {
    console.log('🎨 Validando assets...');

    // Verificar que los iconos SVG son válidos
    const iconSizes = [16, 32, 48, 128];
    for (const size of iconSizes) {
      const iconPath = path.join(this.projectRoot, 'icons', `icon-${size}.svg`);
      if (fs.existsSync(iconPath)) {
        const content = fs.readFileSync(iconPath, 'utf8');

        if (!content.includes('<svg')) {
          this.addIssue('INVALID_SVG', `${iconPath} no es un SVG válido`);
        }
        if (!content.includes(`width="${size}"`)) {
          this.addWarning(`Icono ${size}x${size} no tiene width correcto`);
        }
        if (!content.includes(`height="${size}"`)) {
          this.addWarning(`Icono ${size}x${size} no tiene height correcto`);
        }
      }
    }

    // Verificar content styles
    const contentStylesPath = path.join(this.projectRoot, 'content/overlay-styles.css');
    if (fs.existsSync(contentStylesPath)) {
      const content = fs.readFileSync(contentStylesPath, 'utf8');
      if (!content.includes('display: none')) {
        this.addWarning('overlay-styles.css debería incluir reglas para ocultar elementos');
      }
    }
  }

  validatePermissions() {
    console.log('🔐 Validando permisos...');

    // Verificar que los permisos están justificados
    const manifestPath = path.join(this.projectRoot, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const permissions = manifest.permissions || [];

        // Verificar permisos potencialmente peligrosos
        const dangerousPermissions = ['<all_urls>', 'tabs', 'history', 'bookmarks'];
        for (const permission of dangerousPermissions) {
          if (permissions.includes(permission)) {
            this.addWarning(`Permiso potencialmente peligroso: ${permission}`);
          }
        }

        // Verificar que unlimitedStorage está presente si usamos OPFS
        if (!permissions.includes('unlimitedStorage')) {
          this.addWarning('Considerar añadir unlimitedStorage para estabilidad de OPFS');
        }

      } catch (error) {
        // Ya se maneja en validateManifest
      }
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 REPORTE DE VALIDACIÓN');
    console.log('='.repeat(60));

    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log('✅ ¡Excelente! No se encontraron problemas.');
      console.log('🎉 La estructura del proyecto es correcta.');
      return;
    }

    if (this.issues.length > 0) {
      console.log('\n❌ PROBLEMAS ENCONTRADOS:');
      for (let i = 0; i < this.issues.length; i++) {
        const issue = this.issues[i];
        console.log(`${i + 1}. [${issue.type}] ${issue.message}`);
      }
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  ADVERTENCIAS:');
      for (let i = 0; i < this.warnings.length; i++) {
        console.log(`${i + 1}. ${this.warnings[i]}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📈 RESUMEN: ${this.issues.length} problemas, ${this.warnings.length} advertencias`);

    if (this.issues.length > 0) {
      console.log('💡 Corrige los problemas antes de usar la extensión.');
      process.exit(1);
    } else {
      console.log('✅ No hay problemas críticos. Revisa las advertencias.');
      process.exit(0);
    }
  }
}

// Ejecutar validación
const validator = new StructureValidator();
validator.validateProjectStructure();