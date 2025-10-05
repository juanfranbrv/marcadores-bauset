#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class ProjectCleaner {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.cleaned = [];
    this.errors = [];
  }

  clean() {
    console.log('🧹 Iniciando limpieza del proyecto Marcadores Bauset...\n');

    this.cleanTempFiles();
    this.cleanLogFiles();
    this.cleanNodeModules();
    this.cleanBuildArtifacts();
    this.cleanEditorFiles();
    this.cleanOSFiles();

    this.generateReport();
  }

  cleanTempFiles() {
    console.log('🗑️  Eliminando archivos temporales...');

    const tempPatterns = [
      '**/*.tmp',
      '**/*.temp',
      '**/temp/**',
      '**/tmp/**',
      '**/.tmp/**'
    ];

    this.removeFilesByPatterns(tempPatterns, 'Archivos temporales');
  }

  cleanLogFiles() {
    console.log('📝 Eliminando archivos de log...');

    const logPatterns = [
      '**/*.log',
      '**/logs/**',
      '**/.log/**',
      '**/debug.log',
      '**/error.log',
      '**/access.log'
    ];

    this.removeFilesByPatterns(logPatterns, 'Archivos de log');
  }

  cleanNodeModules() {
    console.log('📦 Verificando node_modules...');

    const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      try {
        this.removeDirectory(nodeModulesPath);
        this.cleaned.push('Directorio node_modules eliminado');
      } catch (error) {
        this.errors.push(`Error eliminando node_modules: ${error.message}`);
      }
    }

    // Limpiar package-lock.json si existe
    const packageLockPath = path.join(this.projectRoot, 'package-lock.json');
    if (fs.existsSync(packageLockPath)) {
      try {
        fs.unlinkSync(packageLockPath);
        this.cleaned.push('package-lock.json eliminado');
      } catch (error) {
        this.errors.push(`Error eliminando package-lock.json: ${error.message}`);
      }
    }
  }

  cleanBuildArtifacts() {
    console.log('🔨 Eliminando artefactos de build...');

    const buildPatterns = [
      '**/dist/**',
      '**/build/**',
      '**/.cache/**',
      '**/*.map',
      '**/*.min.js',
      '**/*.min.css'
    ];

    this.removeFilesByPatterns(buildPatterns, 'Artefactos de build');
  }

  cleanEditorFiles() {
    console.log('📝 Eliminando archivos de editor...');

    const editorPatterns = [
      '**/.vscode/**',
      '**/.idea/**',
      '**/*.swp',
      '**/*.swo',
      '**/*~',
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/.sublime-*'
    ];

    this.removeFilesByPatterns(editorPatterns, 'Archivos de editor');
  }

  cleanOSFiles() {
    console.log('💻 Eliminando archivos del sistema...');

    const osPatterns = [
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/Desktop.ini',
      '**/.Spotlight-V100',
      '**/.Trashes',
      '**/.fseventsd',
      '**/.AppleDouble',
      '**/.LSOverride'
    ];

    this.removeFilesByPatterns(osPatterns, 'Archivos del sistema');
  }

  removeFilesByPatterns(patterns, category) {
    for (const pattern of patterns) {
      try {
        const files = this.findFilesByPattern(pattern);
        for (const file of files) {
          try {
            if (fs.statSync(file).isDirectory()) {
              this.removeDirectory(file);
            } else {
              fs.unlinkSync(file);
            }
            this.cleaned.push(`${category}: ${path.relative(this.projectRoot, file)}`);
          } catch (error) {
            this.errors.push(`Error eliminando ${file}: ${error.message}`);
          }
        }
      } catch (error) {
        // Patrón no encontró archivos, continuar
      }
    }
  }

  findFilesByPattern(pattern) {
    const results = [];
    const searchDir = this.projectRoot;

    // Implementación simple de búsqueda por patrón
    // En un proyecto real usarías una librería como glob
    const walkSync = (dir, filePattern) => {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);

          if (stat.isDirectory()) {
            // Verificar si el directorio coincide con el patrón
            if (this.matchesPattern(file, filePattern) ||
                this.matchesPattern(path.relative(this.projectRoot, filePath), pattern)) {
              results.push(filePath);
            } else {
              // Recursivamente buscar en subdirectorios
              walkSync(filePath, filePattern);
            }
          } else if (this.matchesPattern(file, filePattern) ||
                     this.matchesPattern(path.relative(this.projectRoot, filePath), pattern)) {
            results.push(filePath);
          }
        }
      } catch (error) {
        // Directorio no accesible, continuar
      }
    };

    walkSync(searchDir, pattern);
    return results;
  }

  matchesPattern(filename, pattern) {
    // Implementación simple de matching de patrones
    const regex = pattern
      .replace(/\*\*/g, '.*')  // ** -> cualquier cosa
      .replace(/\*/g, '[^/]*') // * -> cualquier cosa excepto /
      .replace(/\./g, '\\.');   // . -> literal .

    return new RegExp(regex).test(filename);
  }

  removeDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          this.removeDirectory(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      }
      fs.rmdirSync(dirPath);
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 REPORTE DE LIMPIEZA');
    console.log('='.repeat(50));

    if (this.cleaned.length === 0 && this.errors.length === 0) {
      console.log('✨ No se encontraron archivos para limpiar.');
      console.log('🎉 El proyecto ya está limpio.');
      return;
    }

    if (this.cleaned.length > 0) {
      console.log(`\n✅ ARCHIVOS ELIMINADOS (${this.cleaned.length}):`);
      for (let i = 0; i < Math.min(this.cleaned.length, 20); i++) {
        console.log(`  ${i + 1}. ${this.cleaned[i]}`);
      }
      if (this.cleaned.length > 20) {
        console.log(`  ... y ${this.cleaned.length - 20} más`);
      }
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ ERRORES (${this.errors.length}):`);
      for (let i = 0; i < this.errors.length; i++) {
        console.log(`  ${i + 1}. ${this.errors[i]}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`🎯 RESUMEN: ${this.cleaned.length} eliminados, ${this.errors.length} errores`);

    if (this.errors.length === 0) {
      console.log('✅ Limpieza completada exitosamente.');
    } else {
      console.log('⚠️  Limpieza completada con algunos errores.');
    }
  }
}

// Ejecutar limpieza
const cleaner = new ProjectCleaner();
cleaner.clean();