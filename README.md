# Mermaid Zoom Lightbox

An Obsidian plugin that lets you click a rendered Mermaid diagram to open it full-screen, then zoom and pan to see every detail.

## Features

- Click any rendered Mermaid diagram to open it in a full-screen lightbox.
- Scroll wheel or trackpad pinch to zoom, centered on the cursor.
- Click-drag to pan.
- Toolbar (`−` `⟳` `+` `✕`) and keyboard shortcuts (`+`, `-`, `0` to reset, `Esc` to close).

Pairs well with a CSS snippet that scales Mermaid diagrams down to fit the note width in normal reading view, e.g.:

```css
.mermaid svg {
  max-width: 100% !important;
  width: 100% !important;
  height: auto !important;
}
```

## Installing

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest).
2. Copy them into `<your vault>/.obsidian/plugins/mermaid-zoom-lightbox/`.
3. Reload Obsidian and enable "Mermaid Zoom Lightbox" under Settings → Community plugins.

### From source

Clone this repo directly into `<your vault>/.obsidian/plugins/mermaid-zoom-lightbox/`, then enable it the same way.

## Development

No build step — `main.js` is plain CommonJS, loaded by Obsidian directly.

## License

MIT
