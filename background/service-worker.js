importScripts('../utils/constants.js');
importScripts('../utils/opfs-manager.js');
importScripts('../utils/db-manager.js');
importScripts('../utils/storage-manager.js');
importScripts('../utils/image-processor.js');
importScripts('../utils/bookmark-service.js');
importScripts('../utils/zip-creator.js');
importScripts('../utils/export-service.js');

self.addEventListener('install', (event) => {
  console.log('Marcadores Bauset: Service worker instalado');
});

self.addEventListener('activate', (event) => {
  console.log('Marcadores Bauset: Service worker activado');
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await saveCurrentTab(tab);
  } catch (error) {
    console.error('Error al guardar marcador desde acción:', error);
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-bookmark') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveCurrentTab(tab);
    } catch (error) {
      console.error('Error al guardar marcador desde comando:', error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handleMessage = async () => {
    try {
      switch (message.action) {
        case 'saveCurrentTab':
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const result = await saveCurrentTab(tab);
          return { success: true, data: result };

        case 'captureScreenshot':
          const screenshot = await chrome.tabs.captureVisibleTab(
            message.windowId,
            { format: 'png', quality: 95 }
          );
          return { success: true, data: screenshot };

        case 'getBookmarks':
          const bookmarks = await BookmarkService.getAllBookmarks(message.filters);
          return { success: true, data: bookmarks };

        case 'deleteBookmark':
          await BookmarkService.deleteBookmark(message.bookmarkId);
          return { success: true };

        case 'updateBookmark':
          const updated = await BookmarkService.updateBookmark(message.bookmarkId, message.data);
          return { success: true, data: updated };

        case 'exportSite':
          const exportResult = await exportStaticSite(message.options);
          return { success: true, data: exportResult };

        case 'getCategories':
          const categories = await BookmarkService.getCategories();
          return { success: true, data: categories };

        case 'saveCategory':
          const savedCategory = await BookmarkService.saveCategory(message.data);
          return { success: true, data: savedCategory };

        case 'getAllTags':
          const tags = await BookmarkService.getAllTags();
          return { success: true, data: tags };

        case 'getStorageStats':
          const stats = await BookmarkService.getStorageStats();
          return { success: true, data: stats };

        default:
          throw new Error(`Acción no reconocida: ${message.action}`);
      }
    } catch (error) {
      console.error('Error en message handler:', error);
      return { success: false, error: error.message };
    }
  };

  handleMessage().then(sendResponse);
  return true;
});

async function saveCurrentTab(tab) {
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    throw new Error('No se puede guardar esta página');
  }

  chrome.action.setBadgeText({ text: '⚡' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });

  try {
    const bookmarkData = await extractTabData(tab);
    const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 95
    });

    const savedBookmark = await BookmarkService.saveBookmark(bookmarkData, screenshot);

    chrome.action.setBadgeText({ text: '✓' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);

    return savedBookmark;
  } catch (error) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
    throw error;
  }
}

async function extractTabData(tab) {
  const tabData = {
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    timestamp: Date.now()
  };

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractPageMetadata
    });

    if (result?.result) {
      Object.assign(tabData, result.result);
    }
  } catch (error) {
    console.warn('No se pudo extraer metadatos de la página:', error);
  }

  return tabData;
}

function extractPageMetadata() {
  const metadata = {};

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) metadata.ogTitle = ogTitle.content;

  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) metadata.description = ogDescription.content;

  const description = document.querySelector('meta[name="description"]');
  if (description && !metadata.description) metadata.description = description.content;

  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) metadata.ogImage = ogImage.content;

  const keywords = document.querySelector('meta[name="keywords"]');
  if (keywords) metadata.keywords = keywords.content;

  return metadata;
}

async function exportStaticSite(options = {}) {
  const exportService = new ExportService();
  return await exportService.generateZipExport(options);
}