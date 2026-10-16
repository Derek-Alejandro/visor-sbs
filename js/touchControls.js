/**
 * Manipulación directa: 1 dedo/ratón mueve ambos ojos;
 * 2 dedos paralelos ajustan paralaje/desnivel; pellizco cambia escala.
 * Se distinguen los gestos antes de aplicar cambios para evitar zooms accidentales.
 * Funciona también en modo inmersivo (Pointer Events).
 */
export function createTouchControls(stage, config, onChange) {
  const contacts = new Map();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let pairGesture = null;

  function points() { return [...contacts.values()]; }

  function startPair() {
    const [a, b] = points();
    pairGesture = {
      startA: { ...a }, startB: { ...b },
      centerX: (a.x + b.x) / 2,
      centerY: (a.y + b.y) / 2,
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      parallax: config.parallax,
      vertical: config.vertical,
      scale: config.scale,
      mode: 'pending',
    };
  }

  function down(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (contacts.size >= 2) return;
    contacts.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { stage.setPointerCapture(event.pointerId); } catch { /* puntero cancelado */ }
    stage.classList.add('is-manipulating');
    if (contacts.size === 2) startPair();
    if (event.cancelable) event.preventDefault();
  }

  function move(event) {
    if (!contacts.has(event.pointerId)) return;
    const prior = contacts.get(event.pointerId);
    contacts.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = points();

    if (current.length === 1) {
      config.panX = clamp(config.panX + event.clientX - prior.x, -160, 160);
      config.panY = clamp(config.panY + event.clientY - prior.y, -120, 120);
    } else if (current.length === 2 && pairGesture) {
      const [a, b] = current;
      const start = pairGesture;
      const centerX = (a.x + b.x) / 2;
      const centerY = (a.y + b.y) / 2;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const centerShift = Math.hypot(centerX - start.centerX, centerY - start.centerY);
      const distanceShift = Math.abs(distance - start.distance);

      if (start.mode === 'pending') {
        const movedA = Math.hypot(a.x - start.startA.x, a.y - start.startA.y);
        const movedB = Math.hypot(b.x - start.startB.x, b.y - start.startB.y);
        if (movedA < 3 || movedB < 3) {
          if (event.cancelable) event.preventDefault();
          return;
        }
        start.mode = distanceShift > 1.2 * centerShift && distanceShift >= 4 ? 'pinch' : 'align';
      }

      if (start.mode === 'pinch' && start.distance > 10) {
        config.scale = clamp(start.scale * distance / start.distance, 40, 180);
      } else if (start.mode === 'align') {
        config.parallax = clamp(start.parallax + centerX - start.centerX, -100, 100);
        config.vertical = clamp(start.vertical + centerY - start.centerY, -50, 50);
      }
    }
    onChange();
    if (event.cancelable) event.preventDefault();
  }

  function up(event) {
    if (!contacts.has(event.pointerId)) return;
    contacts.delete(event.pointerId);
    pairGesture = null;
    if (stage.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    if (!contacts.size) stage.classList.remove('is-manipulating');
  }
  stage.addEventListener('pointerdown', down);
  stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('lostpointercapture', up);

  return {
    dispose() {
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
      stage.removeEventListener('lostpointercapture', up);
      contacts.clear();
      pairGesture = null;
    },
  };
}
