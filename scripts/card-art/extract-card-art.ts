// Card-art extraction pipeline v2 (mask-first, alpha output).
//
//   npm run card-art:extract -- --src "<folder>" --out "./assets/card-art" --golden-first 10 --debug
//
// Extracts a CLEAN ART LAYER (alpha-masked) per card — no UI leakage. Full-batch
// is disabled until the golden batch is accepted (use --allow-full-batch to
// override, intentionally not used yet).

import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import {
  detectCardBounds,
  extractAnalysisBuffer,
  normalizedCardPng,
  maskAndCrop,
  generateCandidates,
  artColorStats,
  exportArtVariants,
} from './card-art-image-utils';
import {autoPlan} from './card-art-detection';
import {loadManualMasks, manualPlan} from './card-art-masks';
import {assessQuality, statusFromQuality, scoreQuality} from './card-art-quality';
import {writeCardReview, buildHtmlReport, buildMaskEditor} from './card-art-review';
import type {
  CardArtEntry,
  CardArtManifest,
  CliOptions,
  DuplicateInfo,
  ExtractionPlan,
  ProcessedCard,
  Report,
  ReportCard,
} from './card-art-types';

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    src: '',
    out: './assets/card-art',
    masks: 'scripts/card-art/card-art-masks.json',
    mode: 'structural-hq',
    allowFullBatch: false,
    force: false,
    reviewOnly: false,
    debug: false,
    qualityPreview: 84,
    qualityLarge: 88,
    alphaQuality: 100,
    previewWidth: 512,
    largeWidth: 1024,
    webpEffort: 6,
    sharpen: 'none',
  };
  const boolFlags = new Set(['allow-full-batch', 'force', 'review-only', 'debug']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = (): string => argv[++i];
    if (boolFlags.has(key)) {
      if (key === 'allow-full-batch') opts.allowFullBatch = true;
      else if (key === 'force') opts.force = true;
      else if (key === 'review-only') opts.reviewOnly = true;
      else if (key === 'debug') opts.debug = true;
      continue;
    }
    switch (key) {
      case 'src': opts.src = next(); break;
      case 'out': opts.out = next(); break;
      case 'masks': opts.masks = next(); break;
      case 'mode': opts.mode = next() === 'structural' ? 'structural' : 'structural-hq'; break;
      case 'only': opts.only = new Set(next().split(',').map((s) => s.trim()).filter(Boolean)); break;
      case 'golden-first': opts.goldenFirst = parseInt(next(), 10); break;
      case 'quality-preview': opts.qualityPreview = parseInt(next(), 10); break;
      case 'quality-large': opts.qualityLarge = parseInt(next(), 10); break;
      case 'alpha-quality': opts.alphaQuality = parseInt(next(), 10); break;
      case 'preview-width': opts.previewWidth = parseInt(next(), 10); break;
      case 'large-width': opts.largeWidth = parseInt(next(), 10); break;
      case 'webp-effort': opts.webpEffort = parseInt(next(), 10); break;
      case 'sharpen': opts.sharpen = next() === 'mild' ? 'mild' : 'none'; break;
      default: console.warn(`Unknown option --${key}`);
    }
  }
  return opts;
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg']);

async function findImages(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, {withFileTypes: true});
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (IMAGE_EXT.has(path.extname(e.name).toLowerCase())) out.push(full);
    }
  }
  await walk(root);
  return out.sort((a, b) => a.localeCompare(b));
}

const CODE_RE = /^[A-Za-z]{0,2}\d{1,4}$/;
export function parseCardCode(filename: string): string | null {
  const base = filename.replace(/\.[^.]+$/, '');
  const parts = base.split(' - ').map((s) => s.trim());
  if (parts.length >= 2 && CODE_RE.test(parts[1])) return parts[1];
  for (const p of parts) if (CODE_RE.test(p)) return p;
  return null;
}

function publicBaseFor(out: string): string {
  const rel = path.relative(process.cwd(), path.resolve(out)).split(path.sep).join('/');
  if (!rel || rel.startsWith('..')) return '/' + path.basename(out);
  return '/' + rel;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeFileEnsured(filePath: string, data: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, data);
}

/** Remove stale outputs (webp + manifest + per-card review) so a run is clean. */
async function cleanOutputs(outDir: string): Promise<void> {
  if (!(await exists(outDir))) return;
  for (const f of await fs.readdir(outDir)) {
    if (f.endsWith('.webp') || f === 'manifest.json') {
      await fs.rm(path.join(outDir, f), {force: true});
    }
  }
  const cardsDir = path.join(outDir, 'review', 'cards');
  if (await exists(cardsDir)) await fs.rm(cardsDir, {recursive: true, force: true});
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------


async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.src) {
    console.error('Error: --src is required.');
    process.exit(1);
  }
  if (!(await exists(opts.src))) {
    console.error(`Error: --src folder not found: ${opts.src}`);
    process.exit(1);
  }
  const fullBatch = !opts.only && !opts.goldenFirst;
  if (fullBatch && !opts.allowFullBatch && !opts.reviewOnly) {
    console.error('Full batch disabled for v2 until the golden batch is accepted. Use --golden-first N or --only A,B, (or --allow-full-batch to override).');
    process.exit(1);
  }

  const outDir = path.resolve(opts.out);
  const reviewDir = path.join(outDir, 'review');
  const manifestPath = path.join(outDir, 'manifest.json');
  const publicBase = publicBaseFor(outDir);
  await fs.mkdir(outDir, {recursive: true});

  const masks = await loadManualMasks(opts.masks);

  const files = await findImages(opts.src);
  const byCode = new Map<string, string[]>();
  const unparsed: string[] = [];
  for (const file of files) {
    const code = parseCardCode(path.basename(file));
    if (!code) {
      unparsed.push(path.basename(file));
      continue;
    }
    (byCode.get(code) ?? byCode.set(code, []).get(code)!).push(file);
  }

  let codes = [...byCode.keys()].sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
  let scope = 'all';
  if (opts.only) {
    codes = codes.filter((c) => opts.only!.has(c));
    scope = `--only ${[...opts.only].join(',')}`;
  } else if (opts.goldenFirst) {
    codes = codes.slice(0, opts.goldenFirst);
    scope = `--golden-first ${opts.goldenFirst}`;
  }

  if (!opts.reviewOnly) await cleanOutputs(outDir);

  const report: Report = {
    startedAt: new Date().toISOString(),
    src: opts.src,
    out: outDir,
    scope,
    totalFiles: files.length,
    processed: 0,
    accepted: 0,
    needsMoreCoverage: 0,
    needsEdgeCleanup: 0,
    needsLayoutFix: 0,
    holesDetected: 0,
    rejected: 0,
    failed: 0,
    duplicates: [],
    unparsedFiles: unparsed,
    warnings: [],
    cards: [],
  };

  const manifest: CardArtManifest = {};
  const processed: ProcessedCard[] = [];
  let index = 0;

  for (const code of codes) {
    index++;
    const candidates = (byCode.get(code) ?? []).sort((a, b) => a.localeCompare(b));
    const sourcePath = candidates[0];
    const sourceFile = path.basename(sourcePath);
    if (candidates.length > 1) {
      const dup: DuplicateInfo = {cardCode: code, chosen: sourceFile, ignored: candidates.slice(1).map((p) => path.basename(p))};
      report.duplicates.push(dup);
    }

    try {
      const result = await processCard(code, sourcePath, sourceFile, opts, outDir, publicBase, masks[code]);
      manifest[code] = result.entry;
      processed.push(result.processed);
      await writeCardReview(result.processed, reviewDir);
      report.processed++;
      const st = result.entry.status;
      if (st === 'accepted') report.accepted++;
      if (st === 'needs-more-coverage') report.needsMoreCoverage++;
      if (st === 'needs-edge-cleanup') report.needsEdgeCleanup++;
      if (st === 'needs-layout-fix') report.needsLayoutFix++;
      if (st === 'holes-detected') report.holesDetected++;
      if (st === 'rejected') report.rejected++;
      report.cards.push(toReportCard(result.entry));
      const q = result.entry.quality;
      console.log(`[${String(index).padStart(2, '0')}/${codes.length}] ${code} ${sourceFile.replace(/\.[^.]+$/, '').split(' - ').slice(2).join(' - ')} -> ${st}  [cov:${q.coverage} pur:${q.purity} edge:${q.edgeCleanliness} holes:${q.noHoles}]  it=${result.entry.iterations ?? 1}${result.entry.notes.length ? '  ' + result.entry.notes.join('; ') : ''}`);
      if (opts.debug) {
        await writeFileEnsured(path.join(reviewDir, 'cards', code, 'plan.json'), Buffer.from(JSON.stringify(result.plan, null, 2)));
      }
    } catch (e) {
      report.failed++;
      report.processed++;
      report.cards.push({cardCode: code, sourceFile, status: 'failed', method: opts.mode === 'structural-hq' ? 'structural-detector-hq-v1' : 'structural-detector-v3', quality: {coverage: 'fail', purity: 'fail', edgeCleanliness: 'fail', noHoles: 'fail'}, notes: [], confidence: 0, warnings: [`failed: ${(e as Error).message}`], qualityChecks: []});
      console.error(`[${String(index).padStart(2, '0')}/${codes.length}] ${code} ${sourceFile} -> FAILED: ${(e as Error).message}`);
    }
  }

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  report.finishedAt = new Date().toISOString();
  await fs.mkdir(reviewDir, {recursive: true});
  await fs.writeFile(path.join(reviewDir, 'report.json'), JSON.stringify(report, null, 2));
  await buildHtmlReport(report, manifest, reviewDir);
  await buildMaskEditor(codes, reviewDir);

  console.log('\nDone (' + scope + '):');
  console.log(`  processed: ${report.processed}`);
  console.log(`  accepted: ${report.accepted}`);
  console.log(`  needs-more-coverage: ${report.needsMoreCoverage}`);
  console.log(`  needs-edge-cleanup: ${report.needsEdgeCleanup}`);
  console.log(`  needs-layout-fix: ${report.needsLayoutFix}`);
  console.log(`  holes-detected: ${report.holesDetected}`);
  console.log(`  rejected: ${report.rejected}`);
  console.log(`  failed: ${report.failed}`);
  console.log(`\nReview: ${path.join(reviewDir, 'index.html')}`);
}

function toReportCard(entry: CardArtEntry): ReportCard {
  return {
    cardCode: entry.cardCode,
    sourceFile: entry.sourceFile,
    status: entry.status,
    method: entry.method,
    quality: entry.quality,
    notes: entry.notes,
    confidence: entry.confidence,
    warnings: entry.warnings,
    qualityChecks: entry.qualityChecks,
    diagnostics: entry.diagnostics,
  };
}

interface ProcessOutcome {
  entry: CardArtEntry;
  processed: ProcessedCard;
  plan: ExtractionPlan;
}

async function processCard(
  code: string,
  sourcePath: string,
  sourceFile: string,
  opts: CliOptions,
  outDir: string,
  publicBase: string,
  manualEntry: import('./card-art-types').ManualMaskEntry | undefined,
): Promise<ProcessOutcome> {
  const bounds = await detectCardBounds(sourcePath);
  const meta = await sharp(sourcePath).metadata();
  let scanW = meta.width ?? bounds.width;
  let scanH = meta.height ?? bounds.height;
  if (meta.orientation && meta.orientation >= 5) {
    const t = scanW;
    scanW = scanH;
    scanH = t;
  }
  const cardBoundsNorm = {
    x: bounds.left / scanW,
    y: bounds.top / scanH,
    w: bounds.width / scanW,
    h: bounds.height / scanH,
  };

  // Build the plan: manual mask wins; else auto trace.
  let plan: ExtractionPlan;
  if (manualEntry) {
    plan = manualPlan(manualEntry, code, sourceFile, cardBoundsNorm);
  } else {
    const analysis = await extractAnalysisBuffer(sourcePath, bounds);
    plan = autoPlan(analysis, code, sourceFile, cardBoundsNorm);
  }

  // --- HQ: generate cleanup candidates (increasing peel strengths), validate each
  //     (coverage / purity / edge / no-holes), and pick the LIGHTEST cleanup that
  //     yields clean edges with no holes — i.e. max art coverage. ---
  const method = opts.mode === 'structural-hq' ? 'structural-detector-hq-v1' : plan.method;
  let chosenPng: Buffer;
  let chosenW: number;
  let chosenH: number;
  let transparentRatio: number;
  let report: import('./card-art-types').QualityReport;
  let checks = plan.qualityChecks;
  let notes: string[];
  let iterations: number;
  let candidateLog: import('./card-art-types').CandidateLogEntry[] = [];
  let initialPng: Buffer | undefined;

  if (opts.mode === 'structural-hq' && plan.accent) {
    const strengths = [0, 0.5, 1, 1.7, 2.6];
    const cands = await generateCandidates(sourcePath, bounds, plan.includeMasks, plan.excludeMasks, plan.accent, strengths);
    initialPng = cands[0]?.png;
    const scored = await Promise.all(
      cands.map(async (c) => {
        const qq = await assessQuality(c.png, c.transparentRatio, plan.accent!.hue, c.coverageRatio, c.holesRemaining);
        return {c, qq, score: scoreQuality(qq.report, c.coverageRatio)};
      }),
    );
    const clean = scored.filter(
      (s) => s.qq.report.purity !== 'fail' && s.qq.report.noHoles !== 'fail' && s.qq.report.edgeCleanliness === 'pass',
    );
    const best = clean.length
      ? clean.reduce((a, b) => (b.c.coverageRatio > a.c.coverageRatio ? b : a)) // max coverage among clean
      : scored.reduce((a, b) => (b.score > a.score ? b : a)); // best balance otherwise
    chosenPng = best.c.png;
    chosenW = best.c.width;
    chosenH = best.c.height;
    transparentRatio = best.c.transparentRatio;
    report = best.qq.report;
    checks = best.qq.checks;
    notes = best.qq.notes;
    iterations = cands.length;
    candidateLog = scored.map((s) => ({
      strength: s.c.strength,
      coverageRatio: s.c.coverageRatio,
      transparentRatio: s.c.transparentRatio,
      holesRemaining: s.c.holesRemaining,
      coverage: s.qq.report.coverage,
      purity: s.qq.report.purity,
      edgeCleanliness: s.qq.report.edgeCleanliness,
      noHoles: s.qq.report.noHoles,
      chosen: s === best,
    }));
  } else {
    const cleanup = plan.accent
      ? {hue: plan.accent.hue, sat: plan.accent.sat, uniformPeel: Math.max(6, Math.round(bounds.width * 0.011)), glowPeel: Math.max(2, Math.round(bounds.width * 0.0025))}
      : undefined;
    const masked = await maskAndCrop(sourcePath, bounds, plan.includeMasks, plan.excludeMasks, cleanup);
    chosenPng = masked.png;
    chosenW = masked.width;
    chosenH = masked.height;
    transparentRatio = masked.transparentRatio;
    const q = await assessQuality(masked.png, masked.transparentRatio, plan.accent?.hue ?? 130);
    report = q.report;
    checks = q.checks;
    notes = q.notes;
    iterations = 1;
  }

  plan.qualityChecks = checks;
  plan.status = statusFromQuality(report);

  const ex = await exportArtVariants(chosenPng, outDir, code, publicBase, opts, writeFileEnsured, path.join);
  const colors = await artColorStats(chosenPng);

  const entry: CardArtEntry = {
    cardCode: code,
    sourceFile,
    sourcePath,
    variants: ex.variants,
    canvas: plan.canvas,
    mask: {
      hasAlpha: transparentRatio > 0,
      type: 'polygon',
      includeMasks: plan.includeMasks.length,
      excludeMasks: plan.excludeMasks.length,
      transparentRatio,
    },
    width: ex.width,
    height: ex.height,
    aspectRatio: ex.aspectRatio,
    dominantColor: colors.dominantColor,
    averageLuminance: colors.averageLuminance,
    focus: plan.focus,
    status: plan.status,
    method,
    quality: report,
    notes,
    iterations,
    confidence: +plan.confidence.toFixed(3),
    qualityChecks: checks,
    sizeBytes: ex.sizeBytes,
    warnings: plan.warnings,
    diagnostics: plan.diagnostics,
    candidateLog: candidateLog.length ? candidateLog : undefined,
  };

  const norm = await normalizedCardPng(sourcePath, bounds, 360);
  const processed: ProcessedCard = {
    cardCode: code,
    sourceFile,
    sourcePath,
    plan,
    normalizedCardPng: norm.buffer,
    normalizedCardWidth: norm.width,
    normalizedCardHeight: norm.height,
    artPng: chosenPng,
    artWidth: chosenW,
    artHeight: chosenH,
    initialArtPng: initialPng,
    status: plan.status,
    warnings: plan.warnings,
  };

  return {entry, processed, plan};
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
