import {expect} from 'chai';
import * as cards from '../../src/genfiles/cards.json';
import * as ruCards from '../../src/locales/ru/cards.json';
import * as ruInfo from '../../src/locales/ru/card_info.json';
import * as ruUi from '../../src/locales/ru/ui.json';

/*
 * ACTION CAPTIONS — the guard (and the worklist) of the action browser's
 * one-liner.
 *
 * A slot shows the action's CAPTION beside its printed formula. The caption is
 * the card's curated `short` (`infoText`, `kind: 'action-short'`) when the full
 * rule is too long to read as a calm one/two-line sentence, and the FULL RULE
 * itself when that already reads well — a short rule must never be paraphrased
 * for the sake of uniformity.
 *
 * Measured budget (console profiles, RU + EN): a caption up to ~45 characters
 * always fits; from ~60 it clamps on every profile. `BUDGET` sits between the
 * two, and `AWAITING_CAPTION` is the honest, shrinking list of actions whose
 * rule still exceeds it — the remaining human audit, not a silent truncation.
 */

const BUDGET = 52;

/**
 * Actions whose full rule is over budget and whose curated caption has not
 * been written yet. Every entry is a slot that clamps its last words on the
 * narrow profiles today. REMOVE a line by authoring the caption in the card
 * file (`infoText: [{kind: 'action-short', text: '…'}]`, with `tokens` when
 * the card draws several actions) plus its RU key in `ru/card_info.json`.
 */
const AWAITING_CAPTION: ReadonlySet<string> = new Set([]);

type Block = {kind: string, text: string, short?: string};
type Group = {kind: string, id: string, blocks: ReadonlyArray<Block>};
type Card = {name: string, module: string, metadata?: {information?: {groups: ReadonlyArray<Group>}}};

const CARDS: ReadonlyArray<Card> = (Array.isArray(cards) ? cards : Object.values(cards)) as ReadonlyArray<Card>;
// The same locale surface the generator validates against: a caption may
// legitimately reuse a phrase that already lives in the shared UI file.
const RU: Record<string, string> = {...(ruUi as any), ...(ruCards as any), ...(ruInfo as any)};

/** The co-located `Action: ` / `Действие: ` label is a CHIP in the UI. */
function strip(text: string): string {
  return text.replace(/^\s*(Effect|Action|Эффект|Действие)\s*:\s*/i, '');
}

function actionBlocks(card: Card): Array<Block> {
  const groups = card.metadata?.information?.groups ?? [];
  return groups.filter((g) => g.kind === 'action').flatMap((g) => g.blocks.filter((b) => b.kind === 'action'));
}

const WITH_ACTIONS = CARDS.filter((c) => actionBlocks(c).length > 0);

describe('action captions (the action browser one-liner)', () => {
  it('the in-scope cards actually carry per-action information', () => {
    expect(WITH_ACTIONS.length).to.be.greaterThan(90);
  });

  it('EVERY action resolves a caption — the full rule when it already reads short, else the card‘s curated one', () => {
    const missing: Array<string> = [];
    for (const card of WITH_ACTIONS) {
      for (const block of actionBlocks(card)) {
        const caption = block.short ?? block.text;
        if (caption === undefined || strip(caption).length === 0) {
          missing.push(card.name);
        }
      }
    }
    expect(missing, 'actions with no caption source').to.deep.eq([]);
  });

  it('a curated caption is a SENTENCE of its own — never a truncation of the rule', () => {
    const bad: Array<string> = [];
    for (const card of WITH_ACTIONS) {
      for (const block of actionBlocks(card)) {
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
    for (const card of WITH_ACTIONS) {
      for (const block of actionBlocks(card)) {
        if (block.short !== undefined && RU[block.short] === undefined) {
          untranslated.push(`${card.name}: "${block.short}"`);
        }
      }
    }
    expect(untranslated, 'curated captions missing a Russian translation').to.deep.eq([]);
  });

  it('WORKLIST: every action over the caption budget is either curated or listed as awaiting one', () => {
    const over: Array<string> = [];
    for (const card of WITH_ACTIONS) {
      for (const block of actionBlocks(card)) {
        const caption = strip(block.short ?? block.text);
        const ruCaption = strip(RU[block.short ?? block.text] ?? '');
        const worst = Math.max(caption.length, ruCaption.length);
        if (worst > BUDGET && !AWAITING_CAPTION.has(card.name)) {
          over.push(`${card.name} (${worst}): ${caption}`);
        }
      }
    }
    expect(over, 'actions that need a curated caption (author one, or add the card to AWAITING_CAPTION)').to.deep.eq([]);
  });

  it('the awaiting list only names cards that are genuinely still over budget (it must shrink, never rot)', () => {
    const stale: Array<string> = [];
    for (const name of AWAITING_CAPTION) {
      const card = WITH_ACTIONS.find((c) => c.name === name);
      if (card === undefined) {
        stale.push(`${name} (no such card with actions)`);
        continue;
      }
      const worst = Math.max(...actionBlocks(card).map((b) => {
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
