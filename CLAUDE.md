# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A client-side transparent image generator and green background remover. No build system, no bundler, no dependencies — just vanilla HTML/CSS/JS served as static files.

Two modes:
- **Generate**: Type a prompt → Gemini API generates an image with chromakey green background → HSV-based flood-fill removes the green → transparent PNG result
- **Upload**: Drag/drop an image with a green background → RGB color-distance removal with despill → transparent PNG result

## Development

Open `index.html` directly in a browser (or use any static file server like `npx serve`). There are no build, lint, or test commands.

## Architecture

Single-class app (`GreenBackgroundRemover` in `app.js`) using Canvas API for pixel-level processing.

### Generate Mode Pipeline
1. User prompt is augmented with chromakey instructions (solid `#00FF00` background, white outline, no green in subject)
2. Optional reference image sent as `inlineData` alongside the text prompt
3. Calls Gemini API (`gemini-2.5-flash-image` via `v1beta/generateContent`) with `responseModalities: ['TEXT', 'IMAGE']`
4. Base64 image from response → loaded into canvas → processed by `processFloodFill()`
5. **HSV-based flood fill from edges**: converts RGB→HSV, identifies green pixels (hue 80-160°, saturation ≥40%, value ≥30%), BFS from border inward. Only removes green pixels connected to the image edge — preserves interior areas.
6. Edge pixels get despill + partial transparency for clean transitions

### Upload Mode Pipeline
1. Image loaded via FileReader → drawn to `originalCanvas` → raw pixel data stored in `originalImageData`
2. `processGlobalColor()`: Euclidean RGB distance from target color determines alpha (soft mask with feathered edges). Green-dominant foreground pixels get despilled by clamping G to avg(R,B).
3. Optional watermark removal: scans bottom-right 15% corner for elevated R/B pixels
4. Side-by-side original + result view with tolerance/color controls

### API Key Management
Stored in `localStorage` under `gemini_api_key`. Collapsible panel in the UI.

## Files

- `index.html` — Tabbed UI (Generate/Upload), API key panel, reference image upload, canvas previews
- `app.js` — All logic in `GreenBackgroundRemover` class
- `styles.css` — Dark theme with CSS custom properties (`:root` variables)
