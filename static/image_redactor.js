(function () {
  'use strict';

  const SVG = {
    crop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>',
    rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M7 8l-4 4 4 4"/><path d="M17 8l4 4-4 4"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  const state = {
    img: null,
    srcUrl: null,
    fileName: 'image.png',
    mimeType: 'image/png',
    rotation: 0,
    flipH: false,
    flipV: false,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    crop: null,
    texts: [],
    selectedText: null,
    overlay: null,
    canvas: null,
    ctx: null,
    textLayer: null,
    cropOverlay: null,
    onDone: null,
    uploader: null,
    cropMode: false,
    cropDraft: null,
    dragging: null,
    originalMode: false,
    _moveHandler: null,
    _upHandler: null
  };

  function openImageEditor(options) {
    if (!options || !options.src) return Promise.reject(new Error('src required'));
    state.onDone = options.onDone || null;
    state.uploader = options.uploader || defaultUploader;
    state.srcUrl = options.src;
    state.fileName = options.fileName || guessName(options.src) || 'image.png';
    state.mimeType = options.mimeType || guessMime(state.fileName);

    return loadImage(options.src).then((img) => {
      state.img = img;
      resetTransforms();
      buildOverlay();
      render();
      return img;
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
      img.src = src;
    });
  }

  function defaultUploader(blob, opts) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        url: reader.result,
        name: opts.original ? state.fileName : state.fileName.replace(/(\.\w+)?$/, '-preview$1'),
        size: blob.size,
        type: blob.type
      });
      reader.readAsDataURL(blob);
    });
  }

  function resetTransforms() {
    state.rotation = 0;
    state.flipH = false;
    state.flipV = false;
    state.brightness = 100;
    state.contrast = 100;
    state.saturation = 100;
    state.crop = null;
    state.cropDraft = null;
    state.texts = [];
    state.selectedText = null;
    state.cropMode = false;
    state.dragging = null;
    state.originalMode = false;
  }

  function buildOverlay() {
    destroyOverlay();
    const ov = document.createElement('div');
    ov.className = 'img-editor-overlay';

    const dp = (window.VD5_CONFIG && window.VD5_CONFIG.dataPath) ? window.VD5_CONFIG.dataPath : '/static/data/';

    ov.innerHTML = `
      <div class="img-editor-header">
        <button class="img-editor-close" title="Закрыть">${SVG.close}</button>
        <div class="img-editor-title">Редактор изображения</div>
        <button class="img-editor-done" title="Готово">
          <span class="img-editor-done-label">Вставить</span>
          <span class="img-editor-done-icon">${SVG.check}</span>
        </button>
      </div>
      <div class="img-editor-stage">
        <canvas class="img-editor-canvas"></canvas>
        <div class="img-editor-crop-overlay" hidden>
          <div class="img-editor-crop-mask" data-mask></div>
          <div class="img-editor-crop-frame"></div>
          <div class="img-editor-crop-handle" data-h="nw"></div>
          <div class="img-editor-crop-handle" data-h="n"></div>
          <div class="img-editor-crop-handle" data-h="ne"></div>
          <div class="img-editor-crop-handle" data-h="e"></div>
          <div class="img-editor-crop-handle" data-h="se"></div>
          <div class="img-editor-crop-handle" data-h="s"></div>
          <div class="img-editor-crop-handle" data-h="sw"></div>
          <div class="img-editor-crop-handle" data-h="w"></div>
        </div>
        <div class="img-editor-text-layer"></div>
      </div>
      <div class="img-editor-toolbar">
        <div class="img-editor-tool" data-tool="crop" title="Обрезать">${SVG.crop}</div>
        <div class="img-editor-tool" data-tool="rotate" title="Повернуть на 90°">${SVG.rotate}</div>
        <div class="img-editor-tool" data-tool="flip" title="Перевернуть по горизонтали">${SVG.flip}</div>
        <div class="img-editor-tool" data-tool="flipv" title="Перевернуть по вертикали">${SVG.flip}</div>
        <div class="img-editor-tool" data-tool="text" title="Добавить текст">${SVG.text}</div>
        <div class="img-editor-tool" data-tool="reset" title="Сбросить всё">${SVG.reset}</div>
        <div class="img-editor-slider-tool" data-slider="brightness" title="Яркость">
          <img src="${dp}brightness.png" alt="Яркость" class="img-editor-tool-icon" />
          <div class="img-editor-slider-pop">
            <span class="img-editor-slider-value">100%</span>
            <input type="range" min="0" max="200" value="100" data-k="brightness" orient="vertical" />
          </div>
        </div>
        <div class="img-editor-slider-tool" data-slider="contrast" title="Контраст">
          <img src="${dp}contrast.png" alt="Контраст" class="img-editor-tool-icon" />
          <div class="img-editor-slider-pop">
            <span class="img-editor-slider-value">100%</span>
            <input type="range" min="0" max="200" value="100" data-k="contrast" orient="vertical" />
          </div>
        </div>
        <div class="img-editor-slider-tool" data-slider="saturation" title="Насыщенность">
          <img src="${dp}saturation.png" alt="Насыщенность" class="img-editor-tool-icon" />
          <div class="img-editor-slider-pop">
            <span class="img-editor-slider-value">100%</span>
            <input type="range" min="0" max="200" value="100" data-k="saturation" orient="vertical" />
          </div>
        </div>
        <div class="img-editor-quality" data-quality title="Сжатое качество. Клик — оригинал">
          <span class="img-editor-quality-label">СЖ</span>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    state.overlay = ov;
    state.canvas = ov.querySelector('.img-editor-canvas');
    state.ctx = state.canvas.getContext('2d');
    state.textLayer = ov.querySelector('.img-editor-text-layer');
    state.cropOverlay = ov.querySelector('.img-editor-crop-overlay');
    bindOverlayEvents();
    updateQualityUI();
  }

  function destroyOverlay() {
    if (state._moveHandler) {
      window.removeEventListener('mousemove', state._moveHandler);
      state._moveHandler = null;
    }
    if (state._upHandler) {
      window.removeEventListener('mouseup', state._upHandler);
      state._upHandler = null;
    }
    if (state.overlay && state.overlay.parentNode) {
      state.overlay.parentNode.removeChild(state.overlay);
    }
    state.overlay = null;
    state.canvas = null;
    state.ctx = null;
    state.textLayer = null;
    state.cropOverlay = null;
    state.dragging = null;
  }

  function updateQualityUI() {
    if (!state.overlay) return;
    const btn = state.overlay.querySelector('[data-quality]');
    if (!btn) return;
    const label = btn.querySelector('.img-editor-quality-label');
    if (!label) return;
    if (state.originalMode) {
      label.textContent = 'ИСХ';
      btn.classList.add('original');
      btn.title = 'Оригинальное качество. Клик — сжатое';
    } else {
      label.textContent = 'СЖ';
      btn.classList.remove('original');
      btn.title = 'Сжатое качество. Клик — оригинал';
    }
  }

  function bindOverlayEvents() {
    const ov = state.overlay;

    ov.querySelector('.img-editor-close').addEventListener('click', () => {
      const onDone = state.onDone;
      destroyOverlay();
      state.img = null;
      if (onDone) onDone({ cancelled: true });
    });

    ov.querySelector('.img-editor-done').addEventListener('click', () => {
      uploadAndInsert(state.originalMode);
    });

    ov.querySelector('[data-quality]').addEventListener('click', () => {
      state.originalMode = !state.originalMode;
      updateQualityUI();
    });

    ov.querySelectorAll('.img-editor-tool').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.tool;
        if (t === 'crop') toggleCrop();
        else if (t === 'rotate') { state.rotation = (state.rotation + 90) % 360; render(); }
        else if (t === 'flip') { state.flipH = !state.flipH; render(); }
        else if (t === 'flipv') { state.flipV = !state.flipV; render(); }
        else if (t === 'text') addText();
        else if (t === 'reset') { resetTransforms(); syncSliderUI(); updateQualityUI(); render(); }
      });
    });

    ov.querySelectorAll('.img-editor-slider-pop input[type=range]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const k = inp.dataset.k;
        state[k] = parseInt(inp.value, 10) || 100;
        inp.parentElement.querySelector('.img-editor-slider-value').textContent = state[k] + '%';
        render();
      });
    });

    state.cropOverlay.querySelectorAll('.img-editor-crop-handle').forEach((h) => {
      h.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!state.cropMode) return;
        state.dragging = {
          dir: h.dataset.h,
          startX: e.clientX,
          startY: e.clientY,
          startRect: { ...state.cropDraft }
        };
      });
    });

    state._moveHandler = (e) => {
      if (!state.dragging) return;
      const canvasRect = state.canvas.getBoundingClientRect();
      const dx = (e.clientX - state.dragging.startX) / canvasRect.width;
      const dy = (e.clientY - state.dragging.startY) / canvasRect.height;
      const r = { ...state.dragging.startRect };
      const d = state.dragging.dir;

      if (d.includes('w')) r.x0 = clamp01(r.x0 + dx);
      if (d.includes('e')) r.x1 = clamp01(r.x1 + dx);
      if (d.includes('n')) r.y0 = clamp01(r.y0 + dy);
      if (d.includes('s')) r.y1 = clamp01(r.y1 + dy);

      const minSize = 0.03;
      if (r.x1 - r.x0 < minSize) {
        if (d.includes('w')) r.x0 = r.x1 - minSize;
        else r.x1 = r.x0 + minSize;
      }
      if (r.y1 - r.y0 < minSize) {
        if (d.includes('n')) r.y0 = r.y1 - minSize;
        else r.y1 = r.y0 + minSize;
      }

      r.x0 = clamp01(r.x0); r.y0 = clamp01(r.y0);
      r.x1 = clamp01(r.x1); r.y1 = clamp01(r.y1);
      if (r.x1 <= r.x0) r.x1 = Math.min(1, r.x0 + minSize);
      if (r.y1 <= r.y0) r.y1 = Math.min(1, r.y0 + minSize);

      state.cropDraft = r;
      positionCropOverlay();
    };

    state._upHandler = () => {
      if (!state.dragging) return;
      const dir = state.dragging.dir;
      const startRect = state.dragging.startRect;
      const endRect = state.cropDraft;
      state.dragging = null;

      let changed = false;
      if (dir.includes('w') && Math.abs(endRect.x0 - startRect.x0) > 0.001) changed = true;
      if (dir.includes('e') && Math.abs(endRect.x1 - startRect.x1) > 0.001) changed = true;
      if (dir.includes('n') && Math.abs(endRect.y0 - startRect.y0) > 0.001) changed = true;
      if (dir.includes('s') && Math.abs(endRect.y1 - startRect.y1) > 0.001) changed = true;

      if (changed) {
        applyCropAndReframe(endRect);
      } else {
        state.cropDraft = { x0: 0, y0: 0, x1: 1, y1: 1 };
        positionCropOverlay();
      }
    };

    window.addEventListener('mousemove', state._moveHandler);
    window.addEventListener('mouseup', state._upHandler);
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function toggleCrop() {
    if (!state.overlay) return;
    state.cropMode = !state.cropMode;
    state.overlay.querySelector('[data-tool=crop]').classList.toggle('active', state.cropMode);

    if (state.cropMode) {
      state.cropDraft = { x0: 0, y0: 0, x1: 1, y1: 1 };
      state.cropOverlay.hidden = false;
      positionCropOverlay();
    } else {
      state.cropOverlay.hidden = true;
      state.cropDraft = null;
    }
  }

  function positionCropOverlay() {
    if (!state.cropMode || !state.cropDraft || !state.cropOverlay) return;
    const canvasRect = state.canvas.getBoundingClientRect();
    const stage = state.overlay.querySelector('.img-editor-stage');
    const stageRect = stage.getBoundingClientRect();
    const offX = canvasRect.left - stageRect.left;
    const offY = canvasRect.top - stageRect.top;
    const r = state.cropDraft;

    const co = state.cropOverlay;
    co.style.left = offX + 'px';
    co.style.top = offY + 'px';
    co.style.width = canvasRect.width + 'px';
    co.style.height = canvasRect.height + 'px';

    const frame = co.querySelector('.img-editor-crop-frame');
    frame.style.left = (r.x0 * 100) + '%';
    frame.style.top = (r.y0 * 100) + '%';
    frame.style.width = ((r.x1 - r.x0) * 100) + '%';
    frame.style.height = ((r.y1 - r.y0) * 100) + '%';

    const mask = co.querySelector('.img-editor-crop-mask');
    mask.style.setProperty('--x0', (r.x0 * 100) + '%');
    mask.style.setProperty('--y0', (r.y0 * 100) + '%');
    mask.style.setProperty('--x1', (r.x1 * 100) + '%');
    mask.style.setProperty('--y1', (r.y1 * 100) + '%');

    const handles = co.querySelectorAll('.img-editor-crop-handle');
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2;
    const pos = {
      nw: [r.x0, r.y0], n: [cx, r.y0], ne: [r.x1, r.y0],
      e: [r.x1, cy], se: [r.x1, r.y1], s: [cx, r.y1],
      sw: [r.x0, r.y1], w: [r.x0, cy]
    };
    handles.forEach((h) => {
      const p = pos[h.dataset.h];
      if (!p) return;
      h.style.left = (p[0] * 100) + '%';
      h.style.top = (p[1] * 100) + '%';
    });
  }

  function applyCropAndReframe(rect) {
    const W = state.canvas.width;
    const H = state.canvas.height;
    const nx = Math.round(rect.x0 * W);
    const ny = Math.round(rect.y0 * H);
    const nw = Math.round((rect.x1 - rect.x0) * W);
    const nh = Math.round((rect.y1 - rect.y0) * H);
    if (nw < 4 || nh < 4) return;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = nw;
    cropCanvas.height = nh;
    const cctx = cropCanvas.getContext('2d');
    cctx.drawImage(state.canvas, nx, ny, nw, nh, 0, 0, nw, nh);

    const dataUrl = cropCanvas.toDataURL(state.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png');
    const tmp = new Image();
    tmp.onload = () => {
      state.img = tmp;
      state.rotation = 0;
      state.flipH = false;
      state.flipV = false;
      state.crop = null;
      state.cropDraft = { x0: 0, y0: 0, x1: 1, y1: 1 };
      render();
      if (state.cropMode) positionCropOverlay();
    };
    tmp.src = dataUrl;
  }

  function addText() {
    const t = { text: 'Текст', x: 50, y: 50, size: 32, color: '#ffffff', font: 'system-ui' };
    state.texts.push(t);
    state.selectedText = t;
    renderTextLayer();
  }

  function renderTextLayer() {
    if (!state.textLayer) return;
    const rect = state.canvas.getBoundingClientRect();
    const stageRect = state.overlay.querySelector('.img-editor-stage').getBoundingClientRect();
    const offX = rect.left - stageRect.left;
    const offY = rect.top - stageRect.top;
    state.textLayer.style.left = offX + 'px';
    state.textLayer.style.top = offY + 'px';
    state.textLayer.style.width = rect.width + 'px';
    state.textLayer.style.height = rect.height + 'px';
    state.textLayer.innerHTML = '';
    state.texts.forEach((t) => {
      const el = document.createElement('div');
      el.className = 'img-editor-text-item';
      el.contentEditable = 'true';
      el.textContent = t.text;
      el.style.left = t.x + '%';
      el.style.top = t.y + '%';
      el.style.fontSize = (t.size / 100 * rect.height) + 'px';
      el.style.color = t.color;
      el.style.fontFamily = t.font;
      if (state.selectedText === t) el.classList.add('selected');
      el.addEventListener('input', () => { t.text = el.textContent; });
      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        state.selectedText = t;
        renderTextLayer();
      });
      let dragging = false, startPX = 0, startPY = 0, startTX = 0, startTY = 0;
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        dragging = true;
        startPX = e.clientX;
        startPY = e.clientY;
        startTX = t.x;
        startTY = t.y;
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = (e.clientX - startPX) / rect.width * 100;
        const dy = (e.clientY - startPY) / rect.height * 100;
        t.x = Math.max(0, Math.min(100, startTX + dx));
        t.y = Math.max(0, Math.min(100, startTY + dy));
        el.style.left = t.x + '%';
        el.style.top = t.y + '%';
      });
      el.addEventListener('pointerup', () => { dragging = false; });
      el.addEventListener('dblclick', () => el.focus());
      state.textLayer.appendChild(el);
    });
  }

  function render() {
    if (!state.img || !state.canvas) return;
    const img = state.img;
    const rot = state.rotation;
    const swap = rot === 90 || rot === 270;
    let W = swap ? img.naturalHeight : img.naturalWidth;
    let H = swap ? img.naturalWidth : img.naturalHeight;

    state.canvas.width = W;
    state.canvas.height = H;
    const ctx = state.ctx;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(rot * Math.PI / 180);
    ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
    const dw = swap ? H : W;
    const dh = swap ? W : H;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    const stage = state.overlay.querySelector('.img-editor-stage');
    const maxW = stage.clientWidth - 40;
    const maxH = stage.clientHeight - 40;
    const k = Math.min(maxW / W, maxH / H, 1);
    state.canvas.style.width = (W * k) + 'px';
    state.canvas.style.height = (H * k) + 'px';
    renderTextLayer();
    if (state.cropMode) positionCropOverlay();
  }

  function exportBlob(opts) {
    const { original } = opts || {};
    const W = state.canvas.width, H = state.canvas.height;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    ctx.drawImage(state.canvas, 0, 0);
    state.texts.forEach((t) => {
      const fs = (t.size / 100) * H;
      ctx.font = `bold ${fs}px ${t.font}`;
      ctx.fillStyle = t.color;
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, (t.x / 100) * W, (t.y / 100) * H);
    });

    const maxSide = original ? 4096 : 1280;
    const scale = Math.min(1, maxSide / Math.max(W, H));
    let target = out;
    if (scale < 1) {
      target = document.createElement('canvas');
      target.width = Math.round(W * scale);
      target.height = Math.round(H * scale);
      const tctx = target.getContext('2d');
      tctx.drawImage(out, 0, 0, target.width, target.height);
    }
    const quality = original ? 0.92 : 0.72;
    const mime = state.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    return new Promise((resolve) => {
      target.toBlob((blob) => resolve(blob), mime, quality);
    });
  }

  function uploadAndInsert(original) {
    const ov = state.overlay;
    if (!ov) return;
    const doneBtn = ov.querySelector('.img-editor-done');
    if (doneBtn) {
      doneBtn.disabled = true;
      doneBtn.querySelector('.img-editor-done-label').textContent = 'Загрузка…';
    }

    exportBlob({ original }).then((blob) => {
      if (!blob) throw new Error('export failed');
      return state.uploader(blob, { original, fileName: state.fileName });
    }).then((resp) => {
      const onDone = state.onDone;
      const result = {
        url: resp.url,
        name: resp.name || state.fileName,
        size: resp.size,
        type: resp.type || state.mimeType,
        original
      };
      destroyOverlay();
      state.img = null;
      if (onDone) onDone(result);
    }).catch((err) => {
      console.error('[image_redactor] upload error:', err);
      if (doneBtn) {
        doneBtn.disabled = false;
        doneBtn.querySelector('.img-editor-done-label').textContent = 'Вставить';
      }
      alert('Ошибка загрузки: ' + (err && err.message ? err.message : 'неизвестно'));
    });
  }

  function guessName(url) {
    try {
      const u = new URL(url, location.href);
      const last = u.pathname.split('/').pop();
      return last || null;
    } catch (e) { return null; }
  }

  function guessMime(name) {
    const n = (name || '').toLowerCase();
    if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
    if (n.endsWith('.webp')) return 'image/webp';
    if (n.endsWith('.gif')) return 'image/gif';
    return 'image/png';
  }

  function syncSliderUI() {
    if (!state.overlay) return;
    ['brightness', 'contrast', 'saturation'].forEach((k) => {
      const inp = state.overlay.querySelector(`.img-editor-slider-pop input[data-k="${k}"]`);
      if (inp) {
        inp.value = state[k];
        inp.parentElement.querySelector('.img-editor-slider-value').textContent = state[k] + '%';
      }
    });
  }

  window.ImageEditor = {
    open: openImageEditor,
    _state: state
  };
})();
