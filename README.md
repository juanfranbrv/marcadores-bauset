# Marcadores Bauset

Extensión de Chrome (Manifest V3) para gestión inteligente de marcadores con captura de miniaturas y generación de sitios estáticos.

## Características principales

- **Captura inmediata**: Guarda la pestaña activa con miniatura en ≤2 segundos
- **Organización avanzada**: Categorías y etiquetas múltiples por marcador
- **Almacenamiento local**: OPFS para imágenes, IndexedDB para metadatos
- **Sitio estático**: Exporta ZIP navegable por categorías y etiquetas
- **Miniaturas optimizadas**: Thumb (320×180) y Mid (720×405) en WebP
- **Deduplicación**: Evita marcadores duplicados por URL normalizada

## Estructura del proyecto

```
marcadores_bauset/
├── manifest.json           # Configuración de la extensión
├── background/             # Service worker
├── popup/                  # UI rápida para guardar
├── options/                # Gestor completo de marcadores
├── utils/                  # Utilidades compartidas
├── content/                # Scripts de contenido
├── assets/                 # CSS, JS, iconos compartidos
└── tests/                  # Scripts de pruebas
```

## Instalación

1. Clona el repositorio
2. Abre Chrome y ve a `chrome://extensions/`
3. Activa "Modo de desarrollador"
4. Haz clic en "Cargar extensión sin empaquetar"
5. Selecciona la carpeta del proyecto

## Uso

- **Guardar**: Ctrl+Shift+S o clic en el icono de la extensión
- **Gestionar**: Clic derecho en el icono → "Opciones"
- **Exportar**: Desde la página de opciones, botón "Exportar sitio"

## Comandos de desarrollo

```bash
# Ejecutar pruebas
npm test

# Validar estructura
npm run validate

# Limpiar archivos temporales
npm run clean
```