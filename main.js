const { Plugin } = require('obsidian');

const MIN_SCALE = 0.1;
const MAX_SCALE = 12;

module.exports = class MermaidZoomLightbox extends Plugin {
  onload() {
    this.overlayEl = null;
    this.registerDomEvent(document, 'click', this.handleClick.bind(this));
  }

  onunload() {
    this.closeLightbox();
  }

  handleClick(evt) {
    const svg = evt.target.closest('.mermaid svg');
    if (!svg || evt.target.closest('a')) return;
    evt.preventDefault();
    this.openLightbox(svg);
  }

  openLightbox(sourceSvg) {
    if (this.overlayEl) return;

    const overlay = document.createElement('div');
    overlay.addClass('mzl-overlay');

    const toolbar = document.createElement('div');
    toolbar.addClass('mzl-toolbar');
    const zoomOutBtn = toolbar.createEl('button', { text: '−' });
    const resetBtn = toolbar.createEl('button', { text: '⟳' });
    const zoomInBtn = toolbar.createEl('button', { text: '+' });
    const closeBtn = toolbar.createEl('button', { text: '✕' });

    const viewport = document.createElement('div');
    viewport.addClass('mzl-viewport');

    const svg = sourceSvg.cloneNode(true);
    viewport.appendChild(svg);

    overlay.appendChild(toolbar);
    overlay.appendChild(viewport);
    document.body.appendChild(overlay);
    this.overlayEl = overlay;

    // Measure the clone's unconstrained natural size before applying any transform.
    const naturalRect = svg.getBoundingClientRect();
    const naturalW = naturalRect.width;
    const naturalH = naturalRect.height;

    let scale = 1;
    let tx = 0;
    let ty = 0;

    const apply = () => {
      svg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    };

    const fitToViewport = () => {
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const padding = 40;
      scale = Math.min((vw - padding) / naturalW, (vh - padding) / naturalH);
      tx = (vw - naturalW * scale) / 2;
      ty = (vh - naturalH * scale) / 2;
      apply();
    };

    const zoomAt = (cx, cy, factor) => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
      tx = cx - (cx - tx) * (newScale / scale);
      ty = cy - (cy - ty) * (newScale / scale);
      scale = newScale;
      apply();
    };

    fitToViewport();

    const onWheel = (e) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      // macOS trackpad pinch is delivered as a wheel event with ctrlKey set,
      // and its deltaY is on a much smaller scale than a mouse wheel notch.
      const delta = e.ctrlKey ? -e.deltaY * 0.02 : -e.deltaY * 0.002;
      zoomAt(cx, cy, Math.exp(delta));
    };

    let panning = false;
    let panStartX = 0;
    let panStartY = 0;
    let panOriginTx = 0;
    let panOriginTy = 0;

    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      panning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panOriginTx = tx;
      panOriginTy = ty;
      viewport.addClass('mzl-panning');
      e.preventDefault();
    };
    const onPointerMove = (e) => {
      if (!panning) return;
      tx = panOriginTx + (e.clientX - panStartX);
      ty = panOriginTy + (e.clientY - panStartY);
      apply();
    };
    const onPointerUp = () => {
      panning = false;
      viewport.removeClass('mzl-panning');
    };

    const onKeydown = (e) => {
      if (e.key === 'Escape') this.closeLightbox();
      else if (e.key === '+' || e.key === '=') zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.2);
      else if (e.key === '-' || e.key === '_') zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1 / 1.2);
      else if (e.key === '0') fitToViewport();
    };

    overlay.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    document.addEventListener('keydown', onKeydown);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeLightbox();
    });
    zoomInBtn.addEventListener('click', () => zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.2));
    zoomOutBtn.addEventListener('click', () => zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1 / 1.2));
    resetBtn.addEventListener('click', fitToViewport);
    closeBtn.addEventListener('click', () => this.closeLightbox());

    this.cleanupOverlay = () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('keydown', onKeydown);
    };
  }

  closeLightbox() {
    if (!this.overlayEl) return;
    if (this.cleanupOverlay) this.cleanupOverlay();
    this.overlayEl.remove();
    this.overlayEl = null;
    this.cleanupOverlay = null;
  }
};
