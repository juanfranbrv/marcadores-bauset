// Generadores de archivos para el sitio estático
// Extraído de utils/export-service.js

function generateFaviconSVG() {
  return `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient>
  </defs>
  <circle cx="16" cy="16" r="15" fill="url(#grad1)"/>
  <path d="M10 8C10 7.17157 10.6716 6.5 11.5 6.5H20.5C21.3284 6.5 22 7.17157 22 8V24L16 20.5L10 24V8Z"
        fill="white"/>
  <circle cx="16" cy="12" r="1.5" fill="rgba(102,126,234,0.8)"/>
</svg>`;
}
