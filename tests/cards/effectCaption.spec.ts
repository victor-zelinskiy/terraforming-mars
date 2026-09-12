import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as cards from '../../src/genfiles/cards.json';
import * as ruCards from '../../src/locales/ru/cards.json';
import * as ruInfo from '../../src/locales/ru/card_info.json';
import * as ruUi from '../../src/locales/ru/ui.json';

/*
 * EFFECT CAPTIONS — the guard (and the worklist) of the effects explorer's
 * tile one-liner, the `actionCaption.spec.ts` twin.
 *
 * A tile shows the effect's CAPTION beside its printed formula. The caption is
 * the card's curated `short` (`infoText`, `kind: 'effect-short'`) when the
 * full rule is too long to read as a calm one/two-line sentence, and the FULL
 * RULE itself when that already reads well — a short rule must never be
 * paraphrased for the sake of uniformity.
 *
 * Measured budget (console profiles, RU + EN): the SAME slot anatomy as the
 * action browser (the `--efx-*` tokens value-mirror `--act-*`), so the same
 * `BUDGET` applies: up to ~45 characters always fits, from ~60 it clamps.
 * `AWAITING_CAPTION` is the honest, shrinking list of effects whose rule
 * still exceeds it — the remaining human audit, not a silent truncation.
 */

const BUDGET = 52;

/**
 * Effects whose full rule is over budget and whose curated caption has not
 * been written yet. Every entry is a tile that clamps its last words on the
 * narrow profiles today. REMOVE a line by authoring the caption in the card
 * file (`infoText: [{kind: 'effect-short', text: '…'}]`, with `tokens` when
 * the card draws several effects) plus its RU key in `ru/card_info.json`.
 */
const AWAITING_CAPTION: ReadonlySet<string> = new Set([]);

type Block = {kind: string, text: string, short?: string};
type Group = {kind: string, id: string, blocks: ReadonlyArray<Block>};
type Card = {name: string, module: string, metadata?: {information?: {groups: ReadonlyArray<Group>}}};

const CARDS: ReadonlyArray<Card> = (Array.isArray(cards) ? cards : Object.values(cards)) as ReadonlyArray<Card>;
// The same locale surface the generator validates against: a caption may
// legitimately reuse a phrase that already lives in the shared UI file.
const RU: Record<string, string> = {...(ruUi as any), ...(ruCards as any), ...(ruInfo as any)};

/** The co-located `Effect: ` / `Эффект: ` label is a CHIP in the UI. */
function strip(text: string): string {
  return text.replace(/^\s*(Effect|Action|Эффект|Действие)\s*:\s*/i, '');
}

function effectBlocks(card: Card): Array<Block> {
  const groups = card.metadata?.information?.groups ?? [];
  return groups.filter((g) => g.kind === 'effect').flatMap((g) => g.blocks.filter((b) => b.kind === 'effect'));
}

const WITH_EFFECTS = CARDS.filter((c) => effectBlocks(c).length > 0);

describe('effect captions (the effects explorer one-liner)', () => {
  it('the in-scope cards actually carry per-effect information', () => {
    expect(WITH_EFFECTS.length).to.be.greaterThan(60);
  });

  it('EVERY effect resolves a caption — the full rule when it already reads short, else the card‘s curated one', () => {
    const missing: Array<string> = [];
    for (const card of WITH_EFFECTS) {
      for (const block of effectBlocks(card)) {
        const caption = block.short ?? block.text;
        if (caption === undefined || strip(caption).length === 0) {
          missing.push(card.name);
        }
      }
    }
    expect(missing, 'effects with no caption source').to.deep.eq([]);
  });

  it('a curated caption is a SENTENCE of its own — never a truncation of the rule', () => {
    const bad: Array<string> = [];
    for (const card of WITH_EFFECTS) {
      for (const block of effectBlocks(card)) {
        if (block.short === undefined) {
          continue;
        }
        const short = strip(block.short);
        // No ellipsis, no dangling connective, and genuinely shorter than the
        // rule it replaces (else it should not have been authored at all).
        if (/[…]|\.\.\.$/.test(short) || /\b(to|and|or|для|чтобы|и)$/i.test(short.trim())) {
          bad.push(`${card.name}: "${short}"`);
        }
        if (short.length >= strip(block.text).length) {
          bad.push(`${card.name}: caption is not shorter than the rule`);
        }
      }
    }
    expect(bad, 'captions that read as truncations').to.deep.eq([]);
  });

  it('every curated caption is translated (RU) — a caption is never shown in English', () => {
    const untranslated: Array<string> = [];
    for (const card of WITH_EFFECTS) {
      for (const block of effectBlocks(card)) {
        if (block.short !== undefined && RU[block.short] === undefined) {
          untranslated.push(`${card.name}: "${block.short}"`);
        }
      }
    }
    expect(untranslated, 'curated captions missing a Russian translation').to.deep.eq([]);
  });

  it('WORKLIST: every effect over the caption budget is either curated or listed as awaiting one', () => {
    const over: Array<string> = [];
    for (const card of WITH_EFFECTS) {
      for (const block of effectBlocks(card)) {
        const caption = strip(block.short ?? block.text);
        const ruCaption = strip(RU[block.short ?? block.text] ?? '');
        const worst = Math.max(caption.length, ruCaption.length);
        if (worst > BUDGET && !AWAITING_CAPTION.has(card.name)) {
          over.push(`${card.name} (${worst}): ${caption}`);
        }
      }
    }
    expect(over, 'effects that need a curated caption (author one, or add the card to AWAITING_CAPTION)').to.deep.eq([]);
  });

  /**
   * EVERY PRINTED EFFECT ROW DESCRIBES ITSELF — the action-caption law's
   * effect half. `b.effect(undefined, …)` draws an effect frame with NO
   * co-located description; the generator then folds it into a described
   * sibling, ONE information group has to cover TWO explorer tiles, and the
   * per-tile caption resolver can only decline (an empty caption beside the
   * graphic). Describe every row you draw; a card whose module generates no
   * effect information at all is listed as SAFE with that reason.
   */
  it('every printed effect row carries its own description', () => {
    const SAFE_WITHOUT_INFORMATION: ReadonlyArray<string> = [
      // The community module generates no effect information (asserted below),
      // so there is no group to fold into and no caption to leak.
      'community/Incite.ts',
    ];
    const root = path.join(__dirname, '..', '..', 'src', 'server', 'cards');
    const offenders: Array<string> = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts')) {
          continue;
        }
        if (!/\.effect\(undefined,/.test(fs.readFileSync(full, 'utf8'))) {
          continue;
        }
        const rel = path.relative(root, full).split(path.sep).join('/');
        if (!SAFE_WITHOUT_INFORMATION.includes(rel)) {
          offenders.push(rel);
        }
      }
    };
    walk(root);
    expect(offenders,
      'a description-less effect row is folded into its sibling, so ONE information group ' +
      'covers TWO explorer tiles and neither can caption itself. Give the row its own ' +
      'description, or — if the card generates no effect information at all — list it in ' +
      'SAFE_WITHOUT_INFORMATION with that reason.',
    ).to.deep.eq([]);
  });

  /** …and the exemptions stay TRUE: the moment such a card starts generating
   *  effect information, its fold becomes the caption bug again. */
  it('the description-less exemptions still generate no effect information', () => {
    const live: Array<string> = [];
    for (const name of ['Incite']) {
      const card = CARDS.find((c) => c.name === name);
      if (card !== undefined && effectBlocks(card).length > 0) {
        live.push(`${name} now has effect information — its rows must each be described`);
      }
    }
    expect(live).to.deep.eq([]);
  });

  it('the awaiting list only names cards that are genuinely still over budget (it must shrink, never rot)', () => {
    const stale: Array<string> = [];
    for (const name of AWAITING_CAPTION) {
      const card = WITH_EFFECTS.find((c) => c.name === name);
      if (card === undefined) {
        stale.push(`${name} (no such card with effects)`);
        continue;
      }
      const worst = Math.max(...effectBlocks(card).map((b) => {
        const caption = strip(b.short ?? b.text);
        return Math.max(caption.length, strip(RU[b.short ?? b.text] ?? '').length);
      }));
      if (worst <= BUDGET) {
        stale.push(`${name} (now fits — remove it from AWAITING_CAPTION)`);
      }
    }
    expect(stale, 'stale AWAITING_CAPTION entries').to.deep.eq([]);
  });
});
