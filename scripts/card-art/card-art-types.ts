// Types for the v2 (mask-first) card-art extraction pipeline.
//
// v1 produced rectangular crops and FAILED: the art window on these cards is not
// a rectangle (curved title arc on top, curved decorative separator arc on the
// bottom), so any rectangle leaks UI (the green/blue separator, code capsule,
// VP badge, text panels). v2 extracts a clean ART LAYER with an ALPHA MASK:
// everything that is not art becomes transparent.
//
// Offline only — nothing here is imported by the game client/server.

/** A rectangle in normalized [0..1] coordinates (space depends on context). */
export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * A mask shape. After normalization every shape is reduced to a polygon in
 * CARD-normalized coordinates (0..1 of the detected card region) for a single
 * even-odd rasterization pass. `rect`/`ellipse` are authoring sugar.
 */
export type MaskShape =
  | {type: 'polygon'; points: Point[]}
  | {type: 'rect'; x: number; y: number; w: number; h: number}
  | {type: 'ellipse'; cx: number; cy: number; rx: number; ry: number};

/** Card rectangle inside the raw scan, in ORIGINAL (rotated) pixels. */
export interface CardBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  uncertain: boolean;
}

export type ExtractionStatus =
  | 'accepted'
  | 'needs-more-coverage'
  | 'needs-edge-cleanup'
  | 'holes-detected'
  | 'needs-layout-fix'
  | 'needs-manual-mask'
  | 'rejected'
  | 'failed';

export type QualityGrade = 'pass' | 'warning' | 'fail';

/** The acceptance axes for premium extraction (all must pass to be accepted). */
export interface QualityReport {
  coverage: QualityGrade; // is the WHOLE art panel captured (no under-crop)?
  purity: QualityGrade; // is all card UI gone (title/action/separator/text/icons)?
  edgeCleanliness: QualityGrade; // any frame/separator remnants at the boundary?
  noHoles: QualityGrade; // no transparent islands inside the art?
}

export interface QualityCheckResult {
  name: string;
  status: QualityGrade;
  detail?: string;
}

/** The core v2 model: a plan to cut a clean art layer out of one card. */
export interface ExtractionPlan {
  cardCode: string;
  sourceFile: string;
  /** Card region within the raw scan, normalized to the scan. */
  cardBounds: NormalizedRect;
  /** Art canvas region within the normalized card (card-normalized). */
  canvas: NormalizedRect;
  /** Keep regions (card-normalized polygons). Union of these is kept. */
  includeMasks: MaskShape[];
  /** Remove regions (card-normalized polygons), punched out of the include union. */
  excludeMasks: MaskShape[];
  focus: Point;
  confidence: number;
  status: ExtractionStatus;
  method: string;
  warnings: string[];
  qualityChecks: QualityCheckResult[];
  /** Accent colour (frame/title/separator hue) — used for edge cleanup. */
  accent?: {hue: number; sat: number};
  /** Structural diagnostics (boundaries found), card-normalized. */
  diagnostics?: Record<string, number | string>;
  /** HQ bottom-boundary SWEEP: fixed top/sides + a range of candidate bottoms to
   *  try; the generator picks the lowest bottom with no text/code UI below it. */
  bottomSweep?: {fx0: number; fx1: number; artTop: number; bottomMin: number; bottomMax: number};
}

export interface VariantPaths {
  preview: string;
  large: string;
}

export interface VariantSizes {
  preview: number;
  large: number;
}

export interface CardArtEntry {
  cardCode: string;
  sourceFile: string;
  sourcePath: string;
  variants: VariantPaths;
  canvas: NormalizedRect;
  mask: {
    hasAlpha: boolean;
    type: 'polygon';
    includeMasks: number;
    excludeMasks: number;
    /** fraction of the exported canvas that is transparent (0..1). */
    transparentRatio: number;
  };
  width: number;
  height: number;
  aspectRatio: number;
  dominantColor: string;
  averageLuminance: number;
  focus: Point;
  status: ExtractionStatus;
  method: string;
  quality: QualityReport;
  notes: string[];
  iterations?: number;
  confidence: number;
  qualityChecks: QualityCheckResult[];
  sizeBytes: VariantSizes;
  warnings: string[];
  diagnostics?: Record<string, number | string>;
  /** HQ candidate-comparison log (one entry per peel strength tried). */
  candidateLog?: CandidateLogEntry[];
}

export interface CandidateLogEntry {
  strength: number;
  coverageRatio: number;
  transparentRatio: number;
  holesRemaining: number;
  coverage: QualityGrade;
  purity: QualityGrade;
  edgeCleanliness: QualityGrade;
  noHoles: QualityGrade;
  chosen: boolean;
}

export type CardArtManifest = Record<string, CardArtEntry>;

/** Manual mask authoring format (scripts/card-art/card-art-masks.json). */
export interface ManualMaskEntry {
  /** Art canvas within the normalized card (card-normalized). */
  canvas: NormalizedRect;
  /** Keep polygons, points normalized 0..1 RELATIVE TO THE CANVAS. */
  includePolygons?: Point[][];
  /** Remove polygons, points normalized 0..1 RELATIVE TO THE CANVAS. */
  excludePolygons?: Point[][];
  /** Optional convenience: whole-canvas include with these card-normalized rects removed. */
  excludeRects?: NormalizedRect[];
  focus?: Point;
  note?: string;
}

export type ManualMasks = Record<string, ManualMaskEntry>;

export interface CliOptions {
  src: string;
  out: string;
  masks: string;
  mode: 'structural' | 'structural-hq';
  only?: Set<string>;
  goldenFirst?: number;
  allowFullBatch: boolean;
  force: boolean;
  reviewOnly: boolean;
  debug: boolean;
  qualityPreview: number;
  qualityLarge: number;
  alphaQuality: number;
  previewWidth: number;
  largeWidth: number;
  webpEffort: number;
  sharpen: 'none' | 'mild';
}

export interface DuplicateInfo {
  cardCode: string;
  chosen: string;
  ignored: string[];
}

export interface ReportCard {
  cardCode: string;
  sourceFile: string;
  status: ExtractionStatus;
  method: string;
  quality: QualityReport;
  notes: string[];
  confidence: number;
  warnings: string[];
  qualityChecks: QualityCheckResult[];
  diagnostics?: Record<string, number | string>;
}

export interface Report {
  startedAt: string;
  finishedAt?: string;
  src: string;
  out: string;
  scope: string;
  totalFiles: number;
  processed: number;
  accepted: number;
  needsMoreCoverage: number;
  needsEdgeCleanup: number;
  needsLayoutFix: number;
  holesDetected: number;
  rejected: number;
  failed: number;
  duplicates: DuplicateInfo[];
  unparsedFiles: string[];
  warnings: string[];
  cards: ReportCard[];
}

/** Everything the review/debug step needs about one processed card. */
export interface ProcessedCard {
  cardCode: string;
  sourceFile: string;
  sourcePath: string;
  plan: ExtractionPlan;
  /** PNG of the normalized card (card-bounds crop), for review overlays. */
  normalizedCardPng: Buffer;
  normalizedCardWidth: number;
  normalizedCardHeight: number;
  /** Final extracted art as PNG WITH ALPHA (for checkerboard/dark/light previews). */
  artPng?: Buffer;
  artWidth?: number;
  artHeight?: number;
  /** The no-cleanup base art (initial mask) — for the initial-vs-final review. */
  initialArtPng?: Buffer;
  status: ExtractionStatus;
  warnings: string[];
}
