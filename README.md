<img src="assets/icon.svg" width="64" height="64" alt="">

# Stitchcraft — image to cross stitch pattern

Upload any image and turn it into a detailed, printable counted cross stitch pattern using real DMC floss colors.

## Features

- **Upload** by drag & drop, file picker or paste (Ctrl+V). Transparent PNG backgrounds stay unstitched.
- **Image tools**: crop with aspect presets, brightness, contrast, saturation and sharpen.
- **Pattern generation** (in a Web Worker): k-means++ clustering in CIELAB, matched to 454 DMC colors with CIEDE2000 (or CIE76), with:
  - size presets up to 500×500 stitches, aspect lock, fabric count (11–32ct) and strand count
  - max-color limit, optional "only floss in my stash"
  - dithering: none, Floyd–Steinberg, Atkinson, ordered
  - cleanup of stray "confetti" stitches and rarely used colors
- **Chart editor**: color+symbols, color blocks, B&W symbols and realistic stitched preview; bold grid every 10, center markers, rulers; zoom/pan/pinch.
- **Editing**: paint, flood fill (Shift = replace everywhere), erase to fabric, eyedropper, undo/redo.
- **Palette**: per-color stitch and skein counts, highlight a color, swap floss, change symbols, merge colors, remove a color.
- **Progress tracking**: mark stitches done (Shift+click marks a whole area); per-color and overall progress.
- **Export**: print / save as PDF (cover, floss key, paged charts with page map), PNG, CSV shopping list, re-importable project file.
- **Accounts**: local accounts (PBKDF2-hashed passwords) with pattern library, floss stash, defaults and backup/restore. Everything is stored in the browser (localStorage + IndexedDB); nothing is sent to a server.

## Development

```sh
npm install
npm run dev      # Vite dev server
npm run build    # type-check + production build into dist/
npm start        # serve dist/ on $PORT (used on Railway)
```
