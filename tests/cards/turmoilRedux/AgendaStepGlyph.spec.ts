import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {CardManifest, ModuleManifest} from '../../../src/server/cards/ModuleManifest';
import {ICard} from '../../../src/server/cards/ICard';
import {CardType} from '../../../src/common/cards/CardType';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {REDUX_RESOLUTION_CATALOG} from '../../../src/server/parliament/resolutions/ResolutionCatalog';

/**
 * ONE STEP OF THE CAREER HAS ONE PICTURE (the owner's decision, 2026-10-20 —
 * `docs/claude/parliament-glossary.md` § 4a).
 *
 * The scans print a step of the Agenda track as a star on a white SQUARE — at
 * chip size that is titanium's silhouette (a gold star on a square), and the bare
 * star already means the vote's winner. The console draws the step as the CAREER
 * INSIGNIA (`assets/misc/agenda-step.svg` — the winner's star over two chevrons)
 * on every surface, and the faces reach it only through `b.agendaStep(n)`.
 *
 * Read by BEHAVIOUR, never by a list of names: every Turmoil Redux card and
 * resolution whose printed text advances an Agenda marker draws `AGENDA_STEP`,
 * and nothing else draws it — so the next card («Reds Budget»: «Each player
 * advances their Agenda marker 1 step») fails here by name if it reaches for the
 * winner's star or the Pathfinders `agenda` resource instead.
 */

const ADVANCES_THE_MARKER = /\badvances? (?:your|their) Agenda marker\b/i;
const ROOT = path.resolve(__dirname, '../../..');

/** Every `type` a render tree carries (items, symbols, nested effect boxes, production boxes). */
function renderTypesOf(root: unknown): Set<string> {
  const types = new Set<string>();
  const seen = new Set<object>();
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object' || seen.has(node)) {
      return;
    }
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.type === 'string') {
      types.add(record.type);
    }
    Object.values(record).forEach(walk);
  };
  walk(root);
  return types;
}

/** The words a card prints: its description plus every description inside its render tree (effect boxes). */
function printedTextOf(card: ICard): string {
  const parts: Array<string> = [];
  const description = card.metadata.description;
  if (typeof description === 'string') {
    parts.push(description);
  } else if (description !== undefined) {
    parts.push(description.text);
  }
  const seen = new Set<object>();
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object' || seen.has(node)) {
      return;
    }
    seen.add(node);
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'description' && typeof value === 'string') {
        parts.push(value);
      }
      walk(value);
    }
  };
  walk(card.metadata.renderData);
  return parts.join(' ');
}

function reduxCards(): Array<ICard> {
  const out: Array<ICard> = [];
  const keys: ReadonlyArray<keyof ModuleManifest> = ['projectCards', 'corporationCards', 'preludeCards', 'ceoCards'];
  for (const key of keys) {
    const manifest = TURMOIL_REDUX_CARD_MANIFEST[key] as CardManifest<ICard> | undefined;
    if (manifest === undefined) {
      continue;
    }
    for (const [, factory] of CardManifest.entries(manifest)) {
      const card = new factory.Factory();
      if (card.type !== CardType.PROXY) {
        out.push(card);
      }
    }
  }
  return out;
}

/** Every file under `dir` (recursively) whose name passes `keep`. */
function filesUnder(dir: string, keep: (name: string) => boolean): Array<string> {
  const out: Array<string> = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...filesUnder(full, keep));
    } else if (keep(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('AgendaStepGlyph — one step of the Career has one picture', () => {
  it('every Redux card that advances an Agenda marker prints AGENDA_STEP, and no other card does', () => {
    const cards = reduxCards();
    const advancing = cards.filter((card) => ADVANCES_THE_MARKER.test(printedTextOf(card)));
    // Anti-vacuous floor: TR04 · TR12 · TR37 · TR42 · Political Recognition are on the table today.
    expect(advancing.length, 'the cards whose text advances the marker').to.be.at.least(5);
    const missing = advancing.filter((card) => !renderTypesOf(card.metadata.renderData).has(CardRenderItemType.AGENDA_STEP));
    const stray = cards.filter((card) => !advancing.includes(card) && renderTypesOf(card.metadata.renderData).has(CardRenderItemType.AGENDA_STEP));
    expect(missing.map((card) => card.name), 'advance the marker but print no `b.agendaStep(n)` (the career insignia)').to.deep.eq([]);
    expect(stray.map((card) => card.name), 'print the career insignia for something that is not a step of the Career').to.deep.eq([]);
  });

  it('every resolution that advances an Agenda marker prints AGENDA_STEP, and no other resolution does', () => {
    const missing: Array<string> = [];
    const stray: Array<string> = [];
    for (const definition of REDUX_RESOLUTION_CATALOG.all()) {
      const {name: _name, quest: _quest, ...printed} = definition.text;
      const advances = Object.values(printed).some((text) => text !== undefined && ADVANCES_THE_MARKER.test(text));
      const draws = renderTypesOf(definition.renderData).has(CardRenderItemType.AGENDA_STEP);
      if (advances && !draws) {
        missing.push(definition.id);
      } else if (draws && !advances) {
        stray.push(definition.id);
      }
    }
    expect(missing, 'advance the marker but print no `b.agendaStep(n)` — never `voteWinner()` for a step').to.deep.eq([]);
    expect(stray, 'print the career insignia for something that is not a step of the Career').to.deep.eq([]);
  });

  it('nothing in Turmoil Redux or the Parliament reaches for the Pathfinders `agenda` card resource', () => {
    const scopes = [
      filesUnder(path.join(ROOT, 'src/server/cards/turmoilRedux'), (n) => n.endsWith('.ts')),
      filesUnder(path.join(ROOT, 'src/server/parliament'), (n) => n.endsWith('.ts')),
      filesUnder(path.join(ROOT, 'src/client/console/parliament'), (n) => n.endsWith('.ts')),
      filesUnder(path.join(ROOT, 'src/client/components/console/parliament'), (n) => n.endsWith('.vue') || n.endsWith('.ts')),
      filesUnder(path.join(ROOT, 'src/styles'), (n) => /^console_(parliament|influence_yield|resolutions)/.test(n)),
    ].flat();
    expect(scopes.length, 'the scanned files').to.be.at.least(40);
    const offenders = scopes.filter((file) => /resources\/agenda\.png|card-resource-agenda|CardResource\.AGENDA\b/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));
    expect(offenders, '`assets/resources/agenda.png` is Mind Set Mars\' resource, never a step of the Career').to.deep.eq([]);
  });

  it('the step\'s asset is the insignia, never a square plate (titanium\'s silhouette at chip size)', () => {
    const svg = fs.readFileSync(path.join(ROOT, 'assets/misc/agenda-step.svg'), 'utf8');
    expect(svg, 'a <rect> plate would bring the titanium collision back').not.to.match(/<rect\b/);
    expect(svg, 'the winner\'s star stays the insignia\'s top').to.match(/<polygon\b/);
  });

  it('the Career track wears its own unit at its head (the anchor every «+1 [insignia]» leads to)', () => {
    const agenda = fs.readFileSync(path.join(ROOT, 'src/client/components/console/parliament/ConsoleParliamentAgenda.vue'), 'utf8');
    const head = agenda.split('\n').find((line) => line.includes('class="con-parl__kicker"') && line.includes('$t(\'Agenda track\')'));
    expect(head, 'the track\'s kicker line').not.to.be.undefined;
    expect(head, 'the kicker carries the career insignia').to.include('career-step-glyph');
  });
});
