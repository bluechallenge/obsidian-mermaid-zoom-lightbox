const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');

const MIN_SCALE = 0.1;
const MAX_SCALE = 12;

const MAX_CANVAS_DIMENSION = 16384;
const SVG_NS = 'http://www.w3.org/2000/svg';

const DEFAULT_SETTINGS = {
  exportScale: 2,
};

module.exports = class MermaidZoomLightbox extends Plugin {
  async onload() {
    this.overlayEl = null;
    await this.loadSettings();
    this.addSettingTab(new MermaidZoomLightboxSettingTab(this.app, this));
    this.registerDomEvent(document, 'click', this.handleClick.bind(this));
  }

  onunload() {
    this.closeLightbox();
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data || {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
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
    zoomOutBtn.setAttribute('aria-label', 'Zoom out');
    const resetBtn = toolbar.createEl('button', { text: '⟳' });
    resetBtn.setAttribute('aria-label', 'Reset zoom');
    const zoomInBtn = toolbar.createEl('button', { text: '+' });
    zoomInBtn.setAttribute('aria-label', 'Zoom in');
    const divider = toolbar.createDiv({ cls: 'mzl-divider' });
    const downloadBtn = toolbar.createEl('button', { text: '⬇' });
    downloadBtn.setAttribute('aria-label', 'Export as PNG');
    const copyBtn = toolbar.createEl('button', { text: '⧉' });
    copyBtn.setAttribute('aria-label', 'Copy image to clipboard');
    const closeBtn = toolbar.createEl('button', { text: '✕' });
    closeBtn.setAttribute('aria-label', 'Close');

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
    downloadBtn.addEventListener('click', () => exportPng(svg, this.settings.exportScale));
    copyBtn.addEventListener('click', () => copyPng(svg, this.settings.exportScale));

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

class MermaidZoomLightboxSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Export image scale')
      .setDesc(
        'Resolution multiplier used when exporting or copying a diagram as PNG. ' +
          'Higher values produce sharper images but larger files. (1–4, default 2)'
      )
      .addSlider((slider) =>
        slider
          .setLimits(1, 4, 1)
          .setValue(this.plugin.settings.exportScale)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.exportScale = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

async function exportPng(svg, scale) {
  try {
    const blob = await svgElementToPng(svg, scale);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mermaid-diagram-${Date.now()}.png`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    new Notice('Diagram exported as PNG');
  } catch (err) {
    new Notice(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function copyPng(svg, scale) {
  try {
    const blob = await svgElementToPng(svg, scale);
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      new Notice('Image copied to clipboard');
    } else {
      new Notice('Copy failed: clipboard image write is not supported here');
    }
  } catch (err) {
    new Notice(`Copy failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Renders a rendered Mermaid <svg> to a PNG blob at the given resolution multiplier.
function svgElementToPng(svgEl, scale) {
  const node = svgEl.cloneNode(true);
  sanitizeSvg(node, svgEl);
  const svgString = new XMLSerializer().serializeToString(node);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let canvasWidth = img.naturalWidth * scale;
      let canvasHeight = img.naturalHeight * scale;
      if (canvasWidth > MAX_CANVAS_DIMENSION || canvasHeight > MAX_CANVAS_DIMENSION) {
        const downscale = Math.min(
          MAX_CANVAS_DIMENSION / canvasWidth,
          MAX_CANVAS_DIMENSION / canvasHeight
        );
        canvasWidth = Math.floor(canvasWidth * downscale);
        canvasHeight = Math.floor(canvasHeight * downscale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get 2D canvas context'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
        'image/png'
      );
    };
    img.onerror = () => reject(new Error('Failed to load SVG as image'));
    img.src = dataUrl;
  });
}

function sanitizeSvg(svgEl, originalSvgEl) {
  replaceForeignObjects(svgEl, originalSvgEl);
  stripRootCss(svgEl);
  fixDimensions(svgEl);
  svgEl.removeAttribute('style');
}

function getTextWidth(text, fontSize, fontFamily) {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return -1;
  ctx.font = `${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

// A width of -1 means measurement isn't available (e.g. no canvas context) — treat
// everything as fitting rather than wrapping blindly.
function fits(text, maxWidth, fontSize, fontFamily) {
  const w = getTextWidth(text, fontSize, fontFamily);
  return w < 0 || w <= maxWidth;
}

// Mermaid's foreignObject labels rely on the browser's HTML word-wrap, which is lost once
// they're replaced with plain SVG <text>. Re-wrap each line by word (falling back to
// character breaks for a single word wider than the box) so long labels wrap instead of
// overflowing their node.
function wrapLine(text, maxWidth, fontSize, fontFamily) {
  if (maxWidth <= 0 || fits(text, maxWidth, fontSize, fontFamily)) return [text];

  const lines = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate, maxWidth, fontSize, fontFamily)) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = '';
    }
    if (fits(word, maxWidth, fontSize, fontFamily)) {
      current = word;
      continue;
    }
    // The word itself is too wide — break it at character boundaries.
    let chunk = '';
    for (const ch of word) {
      if (fits(chunk + ch, maxWidth, fontSize, fontFamily) || !chunk) {
        chunk += ch;
      } else {
        lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

function replaceForeignObjects(svgEl, originalSvgEl) {
  const clonedFOs = Array.from(svgEl.querySelectorAll('foreignObject'));
  const originalFOs = Array.from(originalSvgEl.querySelectorAll('foreignObject'));

  clonedFOs.forEach((fo, idx) => {
    const x = parseFloat(fo.getAttribute('x') || '0');
    const y = parseFloat(fo.getAttribute('y') || '0');
    const width = parseFloat(fo.getAttribute('width') || '100');
    const height = parseFloat(fo.getAttribute('height') || '50');

    const lines = extractTextLines(fo);
    if (lines.length === 0) {
      fo.remove();
      return;
    }

    const originalFo = originalFOs[idx];
    const styledEl = originalFo ? originalFo.querySelector('span, div, p') : null;
    const computed = styledEl ? window.getComputedStyle(styledEl) : null;
    const fontFamily = (computed && computed.fontFamily) || 'sans-serif';
    const fill = (computed && computed.color) || '#333';
    const fontSize = parseFloat((computed && computed.fontSize) || '14');

    const wrappedLines = lines.flatMap((line) => wrapLine(line, width, fontSize, fontFamily));

    const textEl = document.createElementNS(SVG_NS, 'text');
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('font-size', String(fontSize));
    textEl.setAttribute('font-family', fontFamily);
    textEl.setAttribute('fill', fill);

    const centerX = x + width / 2;

    if (wrappedLines.length === 1) {
      textEl.setAttribute('x', String(centerX));
      textEl.setAttribute('y', String(y + height / 2));
      textEl.setAttribute('dominant-baseline', 'middle');
      textEl.textContent = wrappedLines[0];
    } else {
      const lineHeight = fontSize * 1.2;
      const totalTextHeight = lineHeight * wrappedLines.length;
      const startY = y + (height - totalTextHeight) / 2 + fontSize;
      for (let i = 0; i < wrappedLines.length; i++) {
        const tspan = document.createElementNS(SVG_NS, 'tspan');
        tspan.setAttribute('x', String(centerX));
        tspan.setAttribute('y', String(startY + i * lineHeight));
        tspan.textContent = wrappedLines[i];
        textEl.appendChild(tspan);
      }
    }

    fo.parentNode && fo.parentNode.replaceChild(textEl, fo);
  });

  svgEl.querySelectorAll('switch').forEach((sw) => {
    while (sw.firstChild) sw.parentNode && sw.parentNode.insertBefore(sw.firstChild, sw);
    sw.remove();
  });
}

function extractTextLines(fo) {
  const lines = [];
  let current = '';
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      current += (node.textContent || '').trim();
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName.toLowerCase() === 'br') {
        if (current) {
          lines.push(current);
          current = '';
        }
      } else {
        node.childNodes.forEach(walk);
      }
    }
  };
  fo.childNodes.forEach(walk);
  if (current) lines.push(current);
  return lines;
}

function stripRootCss(svgEl) {
  svgEl.querySelectorAll('style').forEach((style) => {
    style.textContent = (style.textContent || '').replace(/:root\s*\{[^}]*\}/g, '');
  });
}

function fixDimensions(svgEl) {
  const viewBoxAttr = svgEl.getAttribute('viewBox');
  const viewBox = viewBoxAttr ? viewBoxAttr.split(/[\s,]+/).map(Number) : null;
  const isAbsolute = (v) => v != null && parseFloat(v) > 0 && /^\d+(\.\d+)?(px)?$/.test(v.trim());

  if (!isAbsolute(svgEl.getAttribute('width')) || !isAbsolute(svgEl.getAttribute('height'))) {
    if (viewBox && viewBox.length === 4) {
      svgEl.setAttribute('width', String(viewBox[2]));
      svgEl.setAttribute('height', String(viewBox[3]));
    } else {
      svgEl.setAttribute('width', '1200');
      svgEl.setAttribute('height', '800');
    }
  }
}
