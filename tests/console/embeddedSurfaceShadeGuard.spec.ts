import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * EMBEDDED SURFACE SHADE GUARD — an embeddable step surface must drop its
 * `data-motion-surface` id when it is embedded.
 *
 * THE BUG CLASS. The surface-motion director (`surfaceMotion/surfaceMotionDirector.ts`)
 * hands every element that carries `data-motion-surface` an owner's claim on
 * the ONE shared `.con-shade` — the dim that stands behind a band surface
 * while it owns the screen. A step surface embedded INSIDE a host workspace is
 * not a band surface: it stands in the host's own zone, and its claim dims the
 * whole central opening — the host included, the embedded step included. It
 * shipped as Climate Research's embedded take (`ConsoleExternalDrawWorkspace`):
 * the Parliament's crumb, the carried resolution card, its readings and the
 * take itself all went dark for the whole mandatory draw, because the root
 * kept a STATIC `data-motion-surface="external-draw"` while `embedded` stripped
 * the frame, the head and the `con-ws` marker beside it.
 *
 * THE RULE. The motion id is shell chrome, exactly like the frame plate and the
 * `ConsoleWsHead` (`docs/claude/console/workspace-embed.md`, rule 1): the one
 * `embedded` prop strips it — `:data-motion-surface="embedded ? undefined : '<id>'"`.
 * With no id the director's enter/leave hooks pass through (no shade, no band
 * rise inside a host zone), which is what every other embeddable surface does.
 *
 * WHAT THIS GUARD CHECKS. Every console SFC that declares an `embedded` prop
 * and carries a motion id binds that id on `embedded`. A floor keeps the scan
 * from silently shrinking to nothing when a surface moves or is renamed.
 */

const ROOT = path.join(__dirname, '..', '..');

const SCANNED: ReadonlyArray<ReadonlyArray<string>> = [
  ['src', 'client', 'components', 'console'],
];

/** The embeddable surfaces that carry a motion id today (a floor, not a list). */
const MIN_EMBEDDABLE_MOTION_SURFACES = 6;

function vueFiles(dir: string): Array<string> {
  const out: Array<string> = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...vueFiles(full));
    } else if (entry.name.endsWith('.vue')) {
      out.push(full);
    }
  }
  return out;
}

/** The SFC's `<template>` with its HTML comments removed (a comment may quote the attribute). */
function templateOf(source: string): string {
  const open = source.indexOf('<template');
  const close = source.lastIndexOf('</template>');
  if (open === -1 || close === -1) {
    return '';
  }
  return source.slice(open, close).replace(/<!--[\s\S]*?-->/g, '');
}

function scriptOf(source: string): string {
  const open = source.indexOf('<script');
  const close = source.lastIndexOf('</script>');
  return open === -1 || close === -1 ? '' : source.slice(open, close);
}

/** Declares the host-agnostic `embedded` prop (the one prop that strips the shell). */
function declaresEmbedded(source: string): boolean {
  return /^\s+embedded\s*:\s*(\{|Boolean\b)/m.test(scriptOf(source));
}

/** Every `data-motion-surface` attribute in the template, raw. */
function motionAttributes(template: string): Array<string> {
  return template.match(/:?data-motion-surface\s*=\s*"[^"]*"/g) ?? [];
}

/** `:data-motion-surface="embedded ? undefined : 'x'"` (or the negated form). */
function strippedWhenEmbedded(attribute: string): boolean {
  return /^:data-motion-surface\s*=\s*"\s*embedded\s*\?\s*undefined\s*:\s*'[^']+'\s*"$/.test(attribute) ||
    /^:data-motion-surface\s*=\s*"\s*!embedded\s*\?\s*'[^']+'\s*:\s*undefined\s*"$/.test(attribute);
}

describe('embedded surface shade guard (an embedded step never claims the shared shade)', () => {
  const files = SCANNED.flatMap((segments) => vueFiles(path.join(ROOT, ...segments)));
  const embeddable = files
    .map((file) => ({file, source: fs.readFileSync(file, 'utf8')}))
    .filter(({source}) => declaresEmbedded(source))
    .map(({file, source}) => ({
      file: path.relative(ROOT, file).split(path.sep).join('/'),
      attributes: motionAttributes(templateOf(source)),
    }))
    .filter(({attributes}) => attributes.length > 0);

  it('the scan still finds the embeddable motion surfaces (anti-vacuous floor)', () => {
    expect(embeddable.length, `found only: ${embeddable.map((e) => e.file).join(', ')}`)
      .to.be.at.least(MIN_EMBEDDABLE_MOTION_SURFACES);
  });

  it('the Climate Research take is one of them (the surface this guard was written for)', () => {
    expect(embeddable.map((e) => e.file))
      .to.include('src/client/components/console/externalDraw/ConsoleExternalDrawWorkspace.vue');
  });

  it('every embeddable surface strips its motion id when embedded', () => {
    const offenders = embeddable.flatMap(({file, attributes}) =>
      attributes.filter((a) => !strippedWhenEmbedded(a)).map((a) => `${file}: ${a}`));
    expect(offenders, 'bind it as :data-motion-surface="embedded ? undefined : \'<id>\'" — ' +
      'an embedded step claiming the shared .con-shade dims its own host').to.deep.equal([]);
  });
});
