// Service Worker simple para debugging
console.log('Service Worker iniciado');

self.addEventListener('install', (event) => {
  console.log('Service worker instalado');
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activado');
});

chrome.action.onClicked.addListener(async (tab) => {
  console.log('Action clicked para tab:', tab.url);

  try {
    // Capturar screenshot simple
    const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 95
    });

    console.log('Screenshot capturado:', screenshot.length, 'characters');

    // Por ahora solo loggeamos
    console.log('Marcador guardado exitosamente');

    // Mostrar badge de éxito
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);

  } catch (error) {
    console.error('Error:', error);
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Mensaje recibido:', message);

  if (message.action === 'test') {
    sendResponse({ success: true, message: 'Service worker funcionando' });
  }

  if (message.action === 'processScreenshot') {
    processScreenshot(message.screenshot, message.bookmarkId, message.bookmarkUrl).then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('Error processing screenshot:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Importante para respuestas asíncronas
  }

  if (message.action === 'checkIfBookmarked') {
    checkIfBookmarked(message.url).then(result => {
      sendResponse(result);
    });
    return true; // Importante para respuestas asíncronas
  }

  if (message.action === 'updateBadge') {
    updateBadgeForUrl(message.url, sender.tab?.id).then(() => {
      sendResponse({ success: true });
    });
    return true; // Importante para respuestas asíncronas
  }

  if (message.action === 'dataUpdated') {
    // Los datos han sido actualizados, no necesitamos hacer nada especial
    // pero enviamos respuesta para que no se quede esperando
    sendResponse({ success: true });
    return true;
  }

  return true;
});

// Función para verificar si una URL está guardada
async function checkIfBookmarked(url) {
  try {
    const result = await chrome.storage.local.get(['marcadores_bauset_data']);
    const savedData = result.marcadores_bauset_data;

    if (!savedData) {
      return { isBookmarked: false };
    }

    const data = typeof savedData === 'string' ? JSON.parse(savedData) : savedData;
    const bookmarks = data.bookmarks || [];

    const existingBookmark = bookmarks.find(b => b.url === url);

    if (existingBookmark) {
      const categories = data.categories || [];
      const category = categories.find(c => c.id === existingBookmark.categoryId);

      return {
        isBookmarked: true,
        bookmark: existingBookmark,
        categoryName: category ? category.name : 'Sin categoría'
      };
    }

    return { isBookmarked: false };
  } catch (error) {
    console.error('Error checking bookmark:', error);
    return { isBookmarked: false };
  }
}

// Escuchar cambios de pestaña para actualizar el badge
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log('Tab updated:', tabId, 'status:', changeInfo.status, 'url:', tab.url);

  // Actualizar badge cuando la pestaña se complete O cuando cambie la URL
  if ((changeInfo.status === 'complete' || changeInfo.url) && tab.url) {
    console.log('Updating badge for tab:', tabId, tab.url);
    await updateBadgeForTab(tab);
  } else if (changeInfo.status === 'complete' && !tab.url) {
    // Si la pestaña está completa pero no tiene URL, intentar obtenerla directamente
    console.log('Tab complete but no URL, trying to get tab info...');
    try {
      const fullTab = await chrome.tabs.get(tabId);
      console.log('Retrieved full tab info:', fullTab.url);
      if (fullTab.url) {
        await updateBadgeForTab(fullTab);
      }
    } catch (error) {
      console.log('Failed to get tab info:', error);
    }
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('Tab activated:', activeInfo.tabId);
  const tab = await chrome.tabs.get(activeInfo.tabId);
  console.log('Activated tab URL:', tab.url);
  if (tab.url) {
    await updateBadgeForTab(tab);
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  // Cuando se crea una nueva pestaña, puede que aún no tenga URL
  // Esperaremos a que se complete la carga con onUpdated
  console.log('Nueva pestaña creada:', tab.id);
});

async function updateBadgeForTab(tab) {
  try {
    console.log('updateBadgeForTab called for:', tab.url, 'tabId:', tab.id);

    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      console.log('Skipping system URL:', tab.url);
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
      return;
    }

    console.log('Checking if bookmarked:', tab.url);
    const result = await checkIfBookmarked(tab.url);
    console.log('Bookmark check result:', result);

    if (result.isBookmarked) {
      console.log('Setting green badge for bookmarked URL');
      chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id });
      chrome.action.setTitle({
        title: `Guardado en: ${result.categoryName}\nTítulo: ${result.bookmark.title}`,
        tabId: tab.id
      });
    } else {
      console.log('Setting empty badge for non-bookmarked URL');
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
      chrome.action.setTitle({
        title: 'Guardar y capturar marcador',
        tabId: tab.id
      });
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

async function updateBadgeForUrl(url, tabId = null) {
  try {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      if (tabId) {
        chrome.action.setBadgeText({ text: '', tabId: tabId });
      }
      return;
    }

    const result = await checkIfBookmarked(url);

    // Si no se proporciona tabId, buscar la pestaña activa
    if (!tabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.url === url) {
        tabId = activeTab.id;
      } else {
        // Si no coincide con la pestaña activa, buscar todas las pestañas con esa URL
        const tabs = await chrome.tabs.query({ url: url });
        tabs.forEach(tab => {
          updateBadgeForSingleTab(tab.id, result);
        });
        return;
      }
    }

    if (tabId) {
      updateBadgeForSingleTab(tabId, result);
    }
  } catch (error) {
    console.error('Error updating badge for URL:', error);
  }
}

function updateBadgeForSingleTab(tabId, result) {
  if (result.isBookmarked) {
    chrome.action.setBadgeText({ text: '✓', tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tabId });
    chrome.action.setTitle({
      title: `Guardado en: ${result.categoryName}\nTítulo: ${result.bookmark.title}`,
      tabId: tabId
    });
  } else {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    chrome.action.setTitle({
      title: 'Guardar y capturar marcador',
      tabId: tabId
    });
  }
}

// Procesar screenshot y guardar en OPFS
async function processScreenshot(screenshotDataUrl, bookmarkId, bookmarkUrl) {
  try {
    console.log('Procesando screenshot para bookmark:', bookmarkId);

    // Convertir dataURL a Blob
    const response = await fetch(screenshotDataUrl);
    const blob = await response.blob();

    // Crear canvas offscreen para redimensionar
    const img = await createImageBitmap(blob);

    // RESPETAR LA PROPORCIÓN ORIGINAL de la captura
    // Limitar ancho máximo a 1200px y altura máxima a 800px
    const targetWidth = 1200;
    const maxHeight = 800;
    const aspectRatio = img.height / img.width;

    // Calcular dimensiones finales
    let finalWidth, finalHeight;
    if (img.width > targetWidth) {
      finalWidth = targetWidth;
      finalHeight = Math.round(targetWidth * aspectRatio);
    } else {
      finalWidth = img.width;
      finalHeight = img.height;
    }

    // Si la altura excede el máximo, recortar desde arriba
    if (finalHeight > maxHeight) {
      finalHeight = maxHeight;
    }

    console.log(`Redimensionando de ${img.width}x${img.height} (proporción ${(1/aspectRatio).toFixed(2)}:1) a ${finalWidth}x${finalHeight}`);

    // Crear thumbnail optimizado
    const thumbCanvas = new OffscreenCanvas(finalWidth, finalHeight);
    const thumbCtx = thumbCanvas.getContext('2d');

    // Mejorar calidad de redimensionamiento
    thumbCtx.imageSmoothingEnabled = true;
    thumbCtx.imageSmoothingQuality = 'high';

    // Dibujar imagen, recortando desde arriba si es necesario
    const sourceWidth = img.width;
    const sourceHeight = img.height;
    const scaledWidth = finalWidth;
    const scaledHeight = Math.round(finalWidth * aspectRatio);

    // Si la imagen escalada es más alta que maxHeight, recortar desde arriba
    if (scaledHeight > maxHeight) {
      const scale = finalWidth / sourceWidth;
      const cropHeight = maxHeight / scale;
      thumbCtx.drawImage(img, 0, 0, sourceWidth, cropHeight, 0, 0, finalWidth, finalHeight);
    } else {
      thumbCtx.drawImage(img, 0, 0, finalWidth, finalHeight);
    }

    // Usar calidad 0.85 para mejor balance entre tamaño y calidad
    const thumbBlob = await thumbCanvas.convertToBlob({
      type: 'image/webp',
      quality: 0.85
    });

    // Guardar en OPFS
    const opfsRoot = await navigator.storage.getDirectory();
    const thumbDir = await opfsRoot.getDirectoryHandle('thumb', { create: true });

    // Generar nombre de archivo único
    const timestamp = Date.now();
    const fileName = `img_${bookmarkId}_${timestamp}.webp`;

    const fileHandle = await thumbDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(thumbBlob);
    await writable.close();

    console.log('Screenshot guardado:', fileName, `${finalWidth}x${finalHeight}`, 'tamaño:', Math.round(thumbBlob.size / 1024) + 'KB');

    return {
      success: true,
      imageKeys: {
        thumb: fileName
      }
    };

  } catch (error) {
    console.error('Error procesando screenshot:', error);
    throw error;
  }
}