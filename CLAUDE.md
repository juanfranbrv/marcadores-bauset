# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marcadores Bauset is a Chrome Manifest V3 extension for intelligent bookmark management with thumbnail capture and static site generation. It captures the active tab with screenshots in ≤2 seconds, stores images in OPFS and metadata in IndexedDB, and can export a navigable static site as a ZIP file.

## Development Commands

```bash
# Run all tests
npm test

# Validate extension structure and integrity
npm run validate

# Clean temporary files
npm run clean
```

## Testing in Chrome

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked extension"
4. Select the project directory

## Architecture

### Storage Layer (Two-tier system)

- **IndexedDB** (via `db-manager.js`): Stores metadata in 4 object stores:
  - `bookmarks`: Main bookmark data with indexes on `url_canonical`, `category_id`, `created_at`, `updated_at`, `tags`
  - `categories`: Organization categories
  - `tags`: Tag metadata with usage counts
  - `settings`: User preferences

- **OPFS** (via `opfs-manager.js`): Stores optimized images in `/thumb/` (320×180, ≤60KB) and `/mid/` (720×405, ≤150KB) directories as WebP

- **StorageManager** (`storage-manager.js`): Unified facade coordinating DBManager and OPFSManager, handles URL normalization and deduplication

### Core Services

- **BookmarkService** (`bookmark-service.js`): Orchestrates bookmark creation, delegates to StorageManager for metadata and ImageProcessor for thumbnails
- **ImageProcessor** (`image-processor.js`): Converts screenshots to WebP, generates both thumb and mid sizes, handles OG image fallbacks
- **ExportService** (`export-service.js`): Coordinates ZIP creation via ZipCreator and static site generation via StaticSiteGenerator

### UI Components

- **popup/popup-simple.js**: Quick save interface opened via icon click or Ctrl+Shift+S
- **options/manage.js**: Full bookmark manager with grid/list views, search, filters, and export controls
- **background/service-worker-simple.js**: Handles extension events, screenshot capture via `chrome.tabs.captureVisibleTab()`, keyboard shortcuts

### Key Architectural Patterns

1. **Singleton pattern**: All managers use `getInstance()` with lazy initialization
2. **URL canonicalization**: `normalizeURL()` in StorageManager removes tracking params (utm_*, fbclid, gclid), strips www, forces HTTPS, deduplicates bookmarks
3. **Async image processing**: Screenshots processed in background after immediate bookmark save
4. **Image status states**: `real` (screenshot), `provisional` (OG image), `placeholder`, `failed`

## Important Implementation Details

- **Active tab only**: Extension can only capture visible tab content, not background tabs
- **Special pages**: Cannot capture `chrome://` or `chrome-extension://` URLs
- **Manifest permissions**: `activeTab`, `tabs`, `downloads`, `storage`, `scripting`, `unlimitedStorage`
- **Image format**: WebP primary, JPEG fallback for compatibility
- **No external dependencies**: Pure vanilla JS, custom ZIP implementation in `zip-creator.js`

## File Structure Conventions

- Files with `-simple` suffix are streamlined/debugging versions
- `utils/constants.js` centralizes all configuration (image sizes, quality settings, DB schema)
- `content/overlay-styles.css` injected as web-accessible resource
- `tests/` contains validation scripts (not unit tests)
