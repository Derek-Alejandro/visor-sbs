/**
 * Estimador local, SIN redes ni IA externa. Busca traslaciones de parches de bordes
 * entre las mitades L/R y usa la mediana para reducir el efecto del primer plano.
 * No corrige rotaciones, escala distinta, distorsión de lente ni homografías.
 */
const SAMPLE_WIDTH = 256;
const SAMPLE_HEIGHT = 144;
const SEARCH_X = 23;
const SEARCH_Y = 10;
const PATCH_WIDTH = 46;
const PATCH_HEIGHT = 30;
const STEP = 3;

function sampleEyes(image) {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_WIDTH * 2;
  canvas.height = SAMPLE_HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No se pudo analizar la imagen en este dispositivo.');
  const w = image.naturalWidth / 2;
  ctx.drawImage(image, 0, 0, w, image.naturalHeight, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  ctx.drawImage(image, w, 0, w, image.naturalHeight, SAMPLE_WIDTH, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const bytes = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const eyes = [new Uint8Array(SAMPLE_WIDTH * SAMPLE_HEIGHT), new Uint8Array(SAMPLE_WIDTH * SAMPLE_HEIGHT)];
  const rowStride = SAMPLE_WIDTH * 2;
  for (let y = 0; y < SAMPLE_HEIGHT; y++) {
    for (let x = 0; x < SAMPLE_WIDTH * 2; x++) {
      const pixel = (y * rowStride + x) * 4;
      const luminance = (77 * bytes[pixel] + 150 * bytes[pixel + 1] + 29 * bytes[pixel + 2]) >> 8;
      eyes[x >= SAMPLE_WIDTH ? 1 : 0][y * SAMPLE_WIDTH + x % SAMPLE_WIDTH] = luminance;
    }
  }
  return eyes.map(gray => {
    const gx = new Int16Array(gray.length);
    const gy = new Int16Array(gray.length);
    for (let y = 1; y < SAMPLE_HEIGHT - 1; y++) {
      for (let x = 1; x < SAMPLE_WIDTH - 1; x++) {
        const i = y * SAMPLE_WIDTH + x;
        gx[i] = gray[i + 1] - gray[i - 1];
        gy[i] = gray[i + SAMPLE_WIDTH] - gray[i - SAMPLE_WIDTH];
      }
    }
    return { gx, gy };
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function alignPatch(left, right, cx, cy) {
  const x0 = Math.round(cx * SAMPLE_WIDTH - PATCH_WIDTH / 2);
  const y0 = Math.round(cy * SAMPLE_HEIGHT - PATCH_HEIGHT / 2);
  const samples = [];
  let strength = 0;
  for (let y = y0; y < y0 + PATCH_HEIGHT; y += STEP) {
    for (let x = x0; x < x0 + PATCH_WIDTH; x += STEP) {
      const index = y * SAMPLE_WIDTH + x;
      const ax = left.gx[index];
      const ay = left.gy[index];
      samples.push([index, ax, ay]);
      strength += Math.abs(ax) + Math.abs(ay);
    }
  }
  // Evita intentar emparejar cielo, paredes uniformes y otras zonas sin detalle.
  if (strength / samples.length < 9) return null;
  let best = Infinity;
  let bestDX = 0;
  let bestDY = 0;
  let zero = Infinity;
  // La ventana del parche está suficientemente lejos del borde para este radio de búsqueda.
  for (let dy = -SEARCH_Y; dy <= SEARCH_Y; dy++) {
    for (let dx = -SEARCH_X; dx <= SEARCH_X; dx++) {
      const offset = dy * SAMPLE_WIDTH + dx;
      let error = 0;
      for (const [index, ax, ay] of samples) {
        const other = index + offset;
        error += Math.abs(ax - right.gx[other]) + Math.abs(ay - right.gy[other]);
      }
      if (dx === 0 && dy === 0) zero = error;
      if (error < best) { best = error; bestDX = dx; bestDY = dy; }
    }
  }
  const quality = best / (strength + 1);
  // Quality ≈ 0: muy parecido; > 1: poco fiable.
  if (quality > 1.15) return null;
  return { dx: bestDX, dy: bestDY, quality, improvement: (zero - best) / (zero + 1) };
}

/**
 * Devuelve disparidades medidas EN PÍXELES DE MUESTRA, no píxeles CSS.
 * El llamado debe convertirlas según la escala y el tamaño actual del visor.
 */
export function estimateSbsAlignment(image) {
  if (!image) throw new Error('Carga una imagen antes de usar el ajuste automático.');
  const [left, right] = sampleEyes(image);
  const locations = [
    [0.22, 0.23], [0.50, 0.23], [0.78, 0.23],
    [0.22, 0.50], [0.50, 0.50], [0.78, 0.50],
    [0.22, 0.77], [0.50, 0.77], [0.78, 0.77],
  ];
  const matches = locations.map(([x, y]) => alignPatch(left, right, x, y)).filter(Boolean);
  if (matches.length < 2) {
    throw new Error('No se encontraron suficientes detalles coincidentes. Ajusta manualmente.');
  }
  const dx0 = median(matches.map(m => m.dx));
  const dy0 = median(matches.map(m => m.dy));
  const consistent = matches.filter(m => Math.abs(m.dy - dy0) <= 3 && Math.abs(m.dx - dx0) <= 10);
  if (consistent.length < 2 ||
      (consistent.length === 2 && median(consistent.map(m => m.quality)) > 0.65)) {
    throw new Error('Las dos perspectivas difieren demasiado para una calibración automática fiable.');
  }
  const dx = median(consistent.map(m => m.dx));
  const dy = median(consistent.map(m => m.dy));
  const confidence = consistent.length >= 6 && median(consistent.map(m => m.quality)) < 0.72
    ? 'moderada' : 'limitada';
  return { dx, dy, confidence, matches: consistent.length, total: locations.length,
    sampleWidth: SAMPLE_WIDTH, sampleHeight: SAMPLE_HEIGHT };
}
