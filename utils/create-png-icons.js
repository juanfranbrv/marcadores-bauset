// Script para generar iconos PNG desde SVG usando Canvas
// Ejecutar desde DevTools de Chrome

function createPNGIcons() {
  const sizes = [16, 32, 48, 128];

  sizes.forEach(size => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Crear gradiente
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');

    // Fondo circular
    const radius = size * 0.9 / 2;
    ctx.beginPath();
    ctx.arc(size/2, size/2, radius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Bookmark shape
    ctx.fillStyle = 'white';
    const scale = size / 32;
    const x1 = 10 * scale;
    const y1 = 8 * scale;
    const x2 = 22 * scale;
    const y2 = 24 * scale;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(size/2, y2 - 4*scale);
    ctx.lineTo(x1, y2);
    ctx.closePath();
    ctx.fill();

    // Dot
    ctx.beginPath();
    ctx.arc(size/2, 12*scale, 1.5*scale, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();

    // Download
    const link = document.createElement('a');
    link.download = `icon-${size}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  console.log('Iconos PNG generados. Revisa tu carpeta de descargas.');
}

// Ejecutar la función
createPNGIcons();