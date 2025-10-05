#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.startTime = Date.now();
  }

  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async runAllTests() {
    console.log('🧪 Ejecutando pruebas de Marcadores Bauset...\n');

    for (const test of this.tests) {
      try {
        await test.testFn();
        this.passed++;
        console.log(`✅ ${test.name}`);
      } catch (error) {
        this.failed++;
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${error.message}\n`);
      }
    }

    this.printSummary();
  }

  printSummary() {
    const duration = Date.now() - this.startTime;
    const total = this.passed + this.failed;

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Resumen de pruebas`);
    console.log(`Total: ${total} | Pasadas: ${this.passed} | Fallidas: ${this.failed}`);
    console.log(`Tiempo: ${duration}ms`);
    console.log('='.repeat(50));

    if (this.failed === 0) {
      console.log('🎉 ¡Todas las pruebas pasaron!');
      process.exit(0);
    } else {
      console.log('💥 Algunas pruebas fallaron');
      process.exit(1);
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertTrue(condition, message) {
    this.assert(condition === true, message || 'Expected true');
  }

  assertFalse(condition, message) {
    this.assert(condition === false, message || 'Expected false');
  }
}

// Crear instancia del runner
const runner = new TestRunner();

// Pruebas de estructura de archivos
runner.addTest('Verificar que manifest.json existe', () => {
  const manifestPath = path.join(__dirname, '..', 'manifest.json');
  runner.assertTrue(fs.existsSync(manifestPath), 'manifest.json debe existir');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  runner.assertEquals(manifest.manifest_version, 3, 'Debe usar Manifest V3');
  runner.assertTrue(manifest.permissions.includes('activeTab'), 'Debe tener permiso activeTab');
  runner.assertTrue(manifest.permissions.includes('downloads'), 'Debe tener permiso downloads');
  runner.assertTrue(manifest.permissions.includes('storage'), 'Debe tener permiso storage');
});

runner.addTest('Verificar estructura de directorios', () => {
  const requiredDirs = [
    'background',
    'popup',
    'options',
    'utils',
    'content',
    'icons',
    'assets',
    'tests'
  ];

  for (const dir of requiredDirs) {
    const dirPath = path.join(__dirname, '..', dir);
    runner.assertTrue(fs.existsSync(dirPath), `Directorio ${dir} debe existir`);
  }
});

runner.addTest('Verificar archivos críticos', () => {
  const requiredFiles = [
    'background/service-worker.js',
    'popup/popup.html',
    'popup/popup.css',
    'popup/popup.js',
    'options/options.html',
    'options/options.css',
    'options/options.js',
    'utils/constants.js',
    'utils/opfs-manager.js',
    'utils/db-manager.js',
    'utils/storage-manager.js',
    'utils/image-processor.js',
    'utils/bookmark-service.js',
    'utils/export-service.js',
    'utils/zip-creator.js'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    runner.assertTrue(fs.existsSync(filePath), `Archivo ${file} debe existir`);
  }
});

runner.addTest('Verificar iconos', () => {
  const iconSizes = [16, 32, 48, 128];

  for (const size of iconSizes) {
    const iconPath = path.join(__dirname, '..', 'icons', `icon-${size}.svg`);
    runner.assertTrue(fs.existsSync(iconPath), `Icono ${size}x${size} debe existir`);

    const iconContent = fs.readFileSync(iconPath, 'utf8');
    runner.assertTrue(iconContent.includes('<svg'), `Icono ${size}x${size} debe ser SVG válido`);
    runner.assertTrue(iconContent.includes(`width="${size}"`), `Icono debe tener width correcto`);
    runner.assertTrue(iconContent.includes(`height="${size}"`), `Icono debe tener height correcto`);
  }
});

runner.addTest('Verificar sintaxis HTML', () => {
  const htmlFiles = [
    'popup/popup.html',
    'options/options.html'
  ];

  for (const htmlFile of htmlFiles) {
    const filePath = path.join(__dirname, '..', htmlFile);
    const content = fs.readFileSync(filePath, 'utf8');

    runner.assertTrue(content.includes('<!DOCTYPE html>'), `${htmlFile} debe tener DOCTYPE`);
    runner.assertTrue(content.includes('<html lang="es">'), `${htmlFile} debe tener lang="es"`);
    runner.assertTrue(content.includes('<meta charset="UTF-8">'), `${htmlFile} debe tener charset UTF-8`);
    runner.assertTrue(content.includes('<title>'), `${htmlFile} debe tener título`);
  }
});

runner.addTest('Verificar constantes', () => {
  const constantsPath = path.join(__dirname, '..', 'utils', 'constants.js');
  const content = fs.readFileSync(constantsPath, 'utf8');

  runner.assertTrue(content.includes('DB_NAME'), 'constants.js debe definir DB_NAME');
  runner.assertTrue(content.includes('DB_VERSION'), 'constants.js debe definir DB_VERSION');
  runner.assertTrue(content.includes('IMAGE_SIZES'), 'constants.js debe definir IMAGE_SIZES');
  runner.assertTrue(content.includes('OPFS_PATHS'), 'constants.js debe definir OPFS_PATHS');
});

runner.addTest('Verificar package.json', () => {
  const packagePath = path.join(__dirname, '..', 'package.json');
  runner.assertTrue(fs.existsSync(packagePath), 'package.json debe existir');

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  runner.assertTrue(!!pkg.name, 'package.json debe tener name');
  runner.assertTrue(!!pkg.version, 'package.json debe tener version');
  runner.assertTrue(!!pkg.scripts, 'package.json debe tener scripts');
  runner.assertTrue(!!pkg.scripts.test, 'package.json debe tener script test');
});

runner.addTest('Verificar README', () => {
  const readmePath = path.join(__dirname, '..', 'README.md');
  runner.assertTrue(fs.existsSync(readmePath), 'README.md debe existir');

  const content = fs.readFileSync(readmePath, 'utf8');
  runner.assertTrue(content.includes('# Marcadores Bauset'), 'README debe tener título principal');
  runner.assertTrue(content.includes('## Características'), 'README debe tener sección de características');
  runner.assertTrue(content.includes('## Instalación'), 'README debe tener instrucciones de instalación');
});

runner.addTest('Verificar sintaxis JSON', () => {
  const jsonFiles = ['manifest.json', 'package.json'];

  for (const jsonFile of jsonFiles) {
    const filePath = path.join(__dirname, '..', jsonFile);
    const content = fs.readFileSync(filePath, 'utf8');

    try {
      JSON.parse(content);
    } catch (error) {
      throw new Error(`${jsonFile} contiene JSON inválido: ${error.message}`);
    }
  }
});

runner.addTest('Verificar archivos CSS no están vacíos', () => {
  const cssFiles = [
    'popup/popup.css',
    'options/options.css'
  ];

  for (const cssFile of cssFiles) {
    const filePath = path.join(__dirname, '..', cssFile);
    const content = fs.readFileSync(filePath, 'utf8').trim();

    runner.assertTrue(content.length > 100, `${cssFile} debe tener contenido CSS significativo`);
    runner.assertTrue(content.includes('{'), `${cssFile} debe tener reglas CSS válidas`);
  }
});

runner.addTest('Verificar archivos JS no están vacíos', () => {
  const jsFiles = [
    'background/service-worker.js',
    'popup/popup.js',
    'options/options.js'
  ];

  for (const jsFile of jsFiles) {
    const filePath = path.join(__dirname, '..', jsFile);
    const content = fs.readFileSync(filePath, 'utf8').trim();

    runner.assertTrue(content.length > 100, `${jsFile} debe tener contenido JavaScript significativo`);
    runner.assertTrue(content.includes('function') || content.includes('class') || content.includes('=>'),
                     `${jsFile} debe contener funciones o clases`);
  }
});

// Ejecutar todas las pruebas
runner.runAllTests().catch(error => {
  console.error('Error ejecutando pruebas:', error);
  process.exit(1);
});