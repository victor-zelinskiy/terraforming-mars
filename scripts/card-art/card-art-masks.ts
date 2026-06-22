// Manual mask loading (scripts/card-art/card-art-masks.json) → ExtractionPlan.
//
// Authoring format is canvas-relative (see ManualMaskEntry): `canvas` is
// card-normalized, polygon points are normalized 0..1 RELATIVE TO THE CANVAS.
// We convert everything to CARD-normalized polygons for rasterization.

import * as fs from 'fs/promises';
import type {
  ExtractionPlan,
  ManualMaskEntry,
  ManualMasks,
  MaskShape,
  NormalizedRect,
  Point,
} from './card-art-types';

export async function loadManualMasks(file: string): Promise<ManualMasks> {
  try {
    await fs.access(file);
  } catch {
    return {};
  }
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as ManualMasks;
  } catch (e) {
    console.warn(`Failed to read masks ${file}: ${(e as Error).message}`);
    return {};
  }
}

function canvasToCard(p: Point, canvas: NormalizedRect): Point {
  return {x: canvas.x + p.x * canvas.w, y: canvas.y + p.y * canvas.h};
}

/** Convert a manual mask entry into a card-normalized ExtractionPlan. */
export function manualPlan(
  entry: ManualMaskEntry,
  cardCode: string,
  sourceFile: string,
  cardBounds: NormalizedRect,
): ExtractionPlan {
  const canvas = entry.canvas;
  const includeMasks: MaskShape[] = [];
  const excludeMasks: MaskShape[] = [];

  if (entry.includePolygons && entry.includePolygons.length) {
    for (const poly of entry.includePolygons) {
      includeMasks.push({type: 'polygon', points: poly.map((p) => canvasToCard(p, canvas))});
    }
  } else {
    // No explicit include → keep the whole canvas rect.
    includeMasks.push({type: 'rect', x: canvas.x, y: canvas.y, w: canvas.w, h: canvas.h});
  }

  if (entry.excludePolygons) {
    for (const poly of entry.excludePolygons) {
      excludeMasks.push({type: 'polygon', points: poly.map((p) => canvasToCard(p, canvas))});
    }
  }
  if (entry.excludeRects) {
    for (const r of entry.excludeRects) {
      excludeMasks.push({type: 'rect', x: r.x, y: r.y, w: r.w, h: r.h});
    }
  }

  return {
    cardCode,
    sourceFile,
    cardBounds,
    canvas,
    includeMasks,
    excludeMasks,
    focus: entry.focus ?? {x: 0.5, y: 0.5},
    confidence: 1,
    status: 'needs-edge-cleanup',
    method: 'manual-mask',
    warnings: [],
    qualityChecks: [],
  };
}
