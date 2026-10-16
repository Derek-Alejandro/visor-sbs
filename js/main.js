import { createStereoViewer, DEFAULT_CONFIG } from './viewer.js';
import { createCalibrationGUI } from './controls.js';
import { loadSbsImage } from './fileLoader.js';
import { createImmersiveMode, showToast } from './ui.js';
import { createTouchControls } from './touchControls.js';
import { estimateSbsAlignment } from './autoCalibration.js';
import { createProfileStore, sanitizeCalibration } from './profiles.js';

const config = { ...DEFAULT_CONFIG };
const stage = document.getElementById('viewerStage');
const info = document.getElementById('imageStatus');
const dimensions = document.getElementById('imageDimensions');
const emptyState = document.getElementById('emptyState');
const fileInput = document.getElementById('fileInput');
const demoButtons = [document.getElementById('demoOneBtn'), document.getElementById('demoTwoBtn')];
const autoBtn = document.getElementById('autoBtn');
const undoAutoBtn = document.getElementById('undoAutoBtn');
const autoStatus = document.getElementById('autoStatus');
const profileSelect = document.getElementById('profileSelect');
const profileName = document.getElementById('profileName');
const autoProfileToggle = document.getElementById('autoProfileToggle');
const applyProfileBtn = document.getElementById('applyProfileBtn');
const deleteProfileBtn = document.getElementById('deleteProfileBtn');
const profiles = createProfileStore();
let requestCounter = 0;
let currentImage = null;
let previousAutoConfig = null;
let viewer;

try {
  viewer = createStereoViewer(stage, config);
} catch (error) {
  emptyState.hidden = false;
  emptyState.querySelector('strong').textContent = 'No se pudo iniciar WebGL';
  emptyState.querySelector('span').textContent = 'Prueba Chrome o Safari actualizado con aceleración gráfica activada.';
  info.textContent = `Error: ${error.message}`;
  throw error;
}

const calibration = createCalibrationGUI(document.getElementById('guiHost'), config, () => viewer.update());
createImmersiveMode(() => viewer.resize());
createTouchControls(stage, config, () => {
  calibration.refresh();
  viewer.update();
});

function applySettings(settings) {
  Object.assign(config, sanitizeCalibration(settings));
  calibration.refresh();
  viewer.update();
}

function resetCalibration() {
  applySettings(DEFAULT_CONFIG);
  previousAutoConfig = null;
  undoAutoBtn.disabled = true;
  autoStatus.textContent = 'Calibración manual restablecida. Puedes probar el ajuste automático.';
  showToast('Calibración restablecida.');
}

function drawProfiles() {
  const entries = profiles.getProfiles();
  const selected = profiles.getSelected();
  profileSelect.replaceChildren();
  if (!entries.length) {
    const empty = new Option('Sin perfiles guardados', '');
    profileSelect.add(empty);
  } else {
    for (const profile of entries) profileSelect.add(new Option(profile.name, profile.id));
  }
  profileSelect.value = selected?.id || '';
  applyProfileBtn.disabled = !selected;
  deleteProfileBtn.disabled = !selected;
  autoProfileToggle.checked = profiles.getApplyOnLoad();
}

drawProfiles();

async function displaySource(source, selectedDemo = -1) {
  const requestId = ++requestCounter;
  info.textContent = 'Cargando fotografía…';
  try {
    const { image, name } = await loadSbsImage(source);
    if (requestId !== requestCounter) return;
    currentImage = image;
    const { width, height } = viewer.setImage(image, name);
    if (profiles.getApplyOnLoad()) {
      const selected = profiles.getSelected();
      if (selected) applySettings(selected.settings);
    }
    previousAutoConfig = null;
    undoAutoBtn.disabled = true;
    autoStatus.textContent = 'Imagen lista. Puedes probar un ajuste automático o moverla con tus dedos.';
    emptyState.hidden = true;
    info.textContent = name;
    dimensions.textContent = `${width} × ${height} px`;
    demoButtons.forEach((button, index) => button.classList.toggle('active', selectedDemo === index));
    if (width % 2 !== 0) showToast('Imagen cargada. Se recomienda un ancho par para SBS.');
    else showToast(profiles.getApplyOnLoad() && profiles.getSelected()
      ? `Imagen cargada con perfil «${profiles.getSelected().name}».`
      : `Imagen cargada: ${name}`);
  } catch (error) {
    if (requestId !== requestCounter) return;
    info.textContent = viewer.getImageInfo()?.name || 'Sin imagen';
    showToast(error.message || 'Ocurrió un problema al cargar la fotografía.');
    if (!viewer.getImageInfo()) emptyState.hidden = false;
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) displaySource(file);
  fileInput.value = '';
});

demoButtons[0].addEventListener('click', () => displaySource('./assets/images/demo-sbs-1.jpg', 0));
demoButtons[1].addEventListener('click', () => displaySource('./assets/images/demo-sbs-2.jpg', 1));
document.getElementById('resetBtn').addEventListener('click', resetCalibration);

// Estima la disparidad en una muestra pequeña para evitar analizar fotos de 30 MB a tamaño real.
autoBtn.addEventListener('click', async () => {
  if (!currentImage) return showToast('Primero carga una fotografía SBS.');
  const image = currentImage;
  const requestId = requestCounter;
  autoBtn.disabled = true;
  autoStatus.textContent = 'Comparando detalles entre los ojos L y R…';
  // Permitir que el navegador muestre el estado antes de iniciar el cálculo síncrono.
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  try {
    const result = estimateSbsAlignment(image);
    if (requestId !== requestCounter || image !== currentImage) return;
    const metrics = viewer.getDisplayMetrics();
    if (!metrics) throw new Error('No fue posible medir el visor.');
    // Desplazamiento de la imagen R respecto a L: compensar signo en X;
    // vertical es la separación opuesta de los planos en viewer.js.
    const order = config.swap ? -1 : 1;
    const parallax = -order * result.dx * metrics.displayWidth / result.sampleWidth;
    const vertical = order * result.dy * metrics.displayHeight / result.sampleHeight;
    const before = { ...config };
    applySettings({
      ...config,
      parallax: Math.max(-100, Math.min(100, Math.round(parallax * 10) / 10)),
      vertical: Math.max(-50, Math.min(50, Math.round(vertical * 10) / 10)),
    });
    previousAutoConfig = before;
    undoAutoBtn.disabled = false;
    autoStatus.textContent = `Ajuste orientativo aplicado: paralaje ${config.parallax.toFixed(1)} px, desnivel ${config.vertical.toFixed(1)} px. Confianza ${result.confidence} (${result.matches} zonas coincidentes). Puedes afinarlo con gestos o lil-gui.`;
    showToast('Ajuste automático estimado. Comprueba el resultado con tus gafas.');
  } catch (error) {
    if (requestId !== requestCounter || image !== currentImage) return;
    autoStatus.textContent = error.message || 'No se pudo completar el análisis.';
    showToast('No hubo una estimación fiable. Puedes calibrar manualmente.');
  } finally {
    autoBtn.disabled = false;
  }
});

undoAutoBtn.addEventListener('click', () => {
  if (!previousAutoConfig) return;
  applySettings(previousAutoConfig);
  previousAutoConfig = null;
  undoAutoBtn.disabled = true;
  autoStatus.textContent = 'Se recuperaron los valores anteriores al ajuste automático.';
  showToast('Ajuste automático deshecho.');
});

// Perfiles locales: se guardan en localStorage del mismo navegador y origen HTTPS.
document.getElementById('saveProfileBtn').addEventListener('click', () => {
  try {
    const profile = profiles.save(profileName.value, config);
    drawProfiles();
    showToast(`Perfil «${profile.name}» guardado en este navegador.`);
  } catch (error) { showToast(error.message); }
});
profileSelect.addEventListener('change', () => {
  try {
    profiles.select(profileSelect.value);
    drawProfiles();
  } catch (error) { showToast(error.message); drawProfiles(); }
});
applyProfileBtn.addEventListener('click', () => {
  const chosen = profiles.getSelected();
  if (!chosen) return showToast('Selecciona un perfil para aplicarlo.');
  applySettings(chosen.settings);
  previousAutoConfig = null;
  undoAutoBtn.disabled = true;
  autoStatus.textContent = `Perfil «${chosen.name}» aplicado. Puedes seguir afinando los controles.`;
  showToast(`Aplicado: ${chosen.name}`);
});
deleteProfileBtn.addEventListener('click', () => {
  const chosen = profiles.getSelected();
  if (!chosen) return;
  if (!window.confirm(`¿Eliminar el perfil «${chosen.name}»?`)) return;
  try {
    profiles.remove(chosen.id);
    drawProfiles();
    showToast('Perfil eliminado de este navegador.');
  } catch (error) { showToast(error.message); }
});
autoProfileToggle.addEventListener('change', () => {
  try {
    profiles.setApplyOnLoad(autoProfileToggle.checked);
    drawProfiles();
    showToast(autoProfileToggle.checked
      ? 'El perfil seleccionado se aplicará a las próximas imágenes.'
      : 'Aplicación automática de perfiles desactivada.');
  } catch (error) { drawProfiles(); showToast(error.message); }
});

// Exportar mantiene el formato JSON de la aplicación original, compatible con su importación.
document.getElementById('saveBtn').addEventListener('click', () => {
  const payload = {
    proyecto: 'StereoLab / Three.js',
    imagen: viewer.getImageInfo(),
    calibracion: { ...config },
    fecha: new Date().toISOString(),
    nota: 'Estos ajustes no modifican el archivo de imagen original.',
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'calibracion-sbs.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Ajustes exportados como JSON.');
});

document.getElementById('importInput').addEventListener('change', async (event) => {
  const input = event.currentTarget;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    if (file.size > 100_000) throw new Error('El archivo JSON es demasiado grande.');
    const data = JSON.parse(await file.text());
    const candidate = data?.calibracion ?? data;
    if (!candidate || typeof candidate !== 'object' ||
      !['parallax', 'scale', 'panX', 'panY', 'vertical', 'format', 'swap'].some(k => Object.hasOwn(candidate, k))) {
      throw new Error('El archivo no contiene parámetros de calibración reconocidos.');
    }
    applySettings(candidate);
    previousAutoConfig = null;
    undoAutoBtn.disabled = true;
    showToast('Ajustes JSON importados y aplicados. Puedes guardarlos como perfil.');
  } catch (error) { showToast(error instanceof SyntaxError ? 'El archivo no es JSON válido.' : error.message); }
});

// Arrastrar y soltar archivos desde la computadora se mantiene como en la versión original.
function dragOver(event) { event.preventDefault(); stage.classList.add('drag-over'); }
function dragLeave() { stage.classList.remove('drag-over'); }
stage.addEventListener('dragover', dragOver);
stage.addEventListener('dragleave', dragLeave);
stage.addEventListener('drop', (event) => {
  event.preventDefault();
  dragLeave();
  const file = event.dataTransfer?.files?.[0];
  if (file) displaySource(file);
});

// La fotografía DEMO 01 sigue apareciendo desde la primera visita.
displaySource('./assets/images/demo-sbs-1.jpg', 0);
