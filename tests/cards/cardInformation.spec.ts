import {expect} from 'chai';
import * as fs from 'fs';
import {ClientCard} from '../../src/common/cards/ClientCard';
import {CardInformation} from '../../src/common/cards/CardInformation';
import {deriveGraphicIds} from '../../src/common/cards/render/cardGraphicIds';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardType} from '../../src/common/cards/CardType';

/*
 * CARD INFORMATION MODEL — the acceptance guards.
 *
 * Protects the structured per-graphic-block text model (generated at
 * make:cards into ClientCard.metadata.information) from degradation:
 * coverage, id stability, ru localization, requirement separation,
 * graphic linkage, no duplication, and the flagship Asteroid split.
 */

const SCOPE_MODULES = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);
const SCOPE_TYPES = new Set<CardType>([CardType.AUTOMATED, CardType.ACTIVE, CardType.EVENT, CardType.PRELUDE]);

function loadCards(): Array<ClientCard> {
  return JSON.parse(fs.readFileSync('src/genfiles/cards.json', 'utf8'));
}

function scopeCards(): Array<ClientCard> {
  return loadCards().filter((c) => SCOPE_MODULES.has(c.module) && SCOPE_TYPES.has(c.type));
}

function info(card: ClientCard): CardInformation | undefined {
  return card.metadata.information;
}

function ruKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of fs.readdirSync('src/locales/ru')) {
    if (!file.endsWith('.json')) {
      continue;
    }
    const json = JSON.parse(fs.readFileSync(`src/locales/ru/${file}`, 'utf8'));
    for (const key of Object.keys(json)) {
      keys.add(key);
    }
  }
  return keys;
}

describe('card information model', function() {
  const cards = scopeCards();

  it('covers EVERY in-scope card (457) with at least one group', () => {
    expect(cards.length).to.be.gte(400);
    // Trans-Neptune Probe is the ONE honest empty: fixed VP + cost + tags
    // only — pure self-explanatory metadata, nothing to describe. A NEW
    // card landing here must be triaged, never silently accepted.
    const NO_INFO_ACCEPTED = new Set(['Trans-Neptune Probe']);
    const missing = cards
      .filter((c) => (info(c) === undefined || info(c)!.groups.length === 0) && !NO_INFO_ACCEPTED.has(c.name))
      .map((c) => c.name);
    expect(missing, `cards without information:\n${missing.join('\n')}`).to.deep.eq([]);
  });

  it('block ids are unique and stable within each card; groups are never empty', () => {
    for (const card of cards) {
      const groups = info(card)?.groups ?? [];
      const ids = groups.flatMap((g) => g.blocks.map((b) => b.id));
      expect(new Set(ids).size, `duplicate block ids on ${card.name}`).to.eq(ids.length);
      for (const group of groups) {
        expect(group.blocks.length, `empty group ${group.id} on ${card.name}`).to.be.greaterThan(0);
      }
    }
  });

  it('every block text has a Russian translation', () => {
    const ru = ruKeys();
    const missing = new Set<string>();
    for (const card of cards) {
      for (const group of info(card)?.groups ?? []) {
        for (const block of group.blocks) {
          if (!ru.has(block.text)) {
            missing.add(`${card.name}: ${block.text.slice(0, 80)}`);
          }
        }
      }
    }
    expect([...missing], 'untranslated block texts').to.deep.eq([]);
  });

  it('every card with requirements has requirement blocks; none without gets an empty group', () => {
    for (const card of cards) {
      const groups = info(card)?.groups ?? [];
      const reqGroup = groups.find((g) => g.kind === 'requirements');
      if ((card.requirements ?? []).length > 0) {
        expect(reqGroup, `no requirements group on ${card.name}`).to.not.eq(undefined);
        expect(reqGroup!.blocks.length).to.be.greaterThan(0);
        // every requirement block is a 'requirement' and links to a req graphic
        for (const block of reqGroup!.blocks) {
          expect(block.kind).to.eq('requirement');
          expect(block.graphicId, `${card.name} requirement without graphic link`).to.match(/^req:/);
        }
      } else {
        expect(reqGroup, `phantom requirements group on ${card.name}`).to.eq(undefined);
      }
    }
  });

  it('requirement text is never duplicated inside effect/action/immediate blocks', () => {
    for (const card of cards) {
      for (const group of info(card)?.groups ?? []) {
        if (group.kind === 'requirements') {
          continue;
        }
        for (const block of group.blocks) {
          expect(/^Requires/.test(block.text), `requirement prose leaked into ${block.id} on ${card.name}: ${block.text.slice(0, 60)}`).to.eq(false);
        }
      }
    }
  });

  it('no two identical texts within one card (no duplicated rules)', () => {
    for (const card of cards) {
      const texts = (info(card)?.groups ?? []).flatMap((g) => g.blocks.map((b) => b.text));
      expect(new Set(texts).size, `duplicated rule text on ${card.name}`).to.eq(texts.length);
    }
  });

  it('effects and actions live in their own groups, never mixed', () => {
    for (const card of cards) {
      for (const group of info(card)?.groups ?? []) {
        if (group.kind === 'effect') {
          expect(group.blocks.every((b) => b.kind === 'effect'), card.name).to.eq(true);
        }
        if (group.kind === 'action') {
          expect(group.blocks.every((b) => b.kind === 'action' || b.kind === 'action-cost' || b.kind === 'action-result'), card.name).to.eq(true);
        }
      }
    }
  });

  it('special VP: exactly one canonical block; plain numeric VP: no block at all', () => {
    for (const card of cards) {
      const vpGroups = (info(card)?.groups ?? []).filter((g) => g.kind === 'victory-points');
      expect(vpGroups.length, `multiple VP groups on ${card.name}`).to.be.lte(1);
      if (typeof card.victoryPoints === 'number' || card.victoryPoints === undefined) {
        expect(vpGroups.length, `redundant VP block for plain VP on ${card.name}`).to.eq(0);
      }
    }
  });

  it('every linked graphicId resolves against the SHARED row-id derivation', () => {
    for (const card of cards) {
      const rowIds = new Set(deriveGraphicIds(card.metadata.renderData).map((r) => r.id));
      for (const group of info(card)?.groups ?? []) {
        for (const block of group.blocks) {
          const id = block.graphicId;
          if (id === undefined || id.startsWith('req:') || id === 'vp') {
            continue; // requirements bar / VP badge — their own reserved address spaces
          }
          expect(rowIds.has(id), `${card.name}: block ${block.id} links to unknown graphic ${id}`).to.eq(true);
        }
      }
    }
  });

  it('the Asteroid card carries its three separate mechanic blocks, each linked', () => {
    const asteroid = cards.find((c) => c.name === 'Asteroid')!;
    const immediate = info(asteroid)!.groups.find((g) => g.kind === 'immediate')!;
    const texts = immediate.blocks.map((b) => b.text);
    expect(texts).to.include('Raise the temperature 1 step.');
    expect(texts).to.include('Gain 2 titanium.');
    expect(texts).to.include('Remove up to 3 plants from any player.');
    expect(immediate.blocks.length).to.eq(3);
    for (const block of immediate.blocks) {
      expect(block.graphicId, `Asteroid block ${block.id} unlinked`).to.not.eq(undefined);
    }
  });

  it('multi-requirement cards keep separate, correctly-linked requirement blocks', () => {
    const solarnet = cards.find((c) => c.name === 'Solarnet')!;
    const reqGroup = info(solarnet)!.groups.find((g) => g.kind === 'requirements')!;
    expect(reqGroup.blocks.length).to.be.greaterThan(1);
    const ids = reqGroup.blocks.map((b) => b.id);
    expect(new Set(ids).size).to.eq(ids.length);
  });

  it('group order is stable: requirements → immediate → effects/actions → VP', () => {
    const orderOf = (kind: string) =>
      ({'requirements': 0, 'immediate': 1, 'effect': 2, 'action': 2, 'victory-points': 3}[kind] ?? 9);
    for (const card of cards) {
      const kinds = (info(card)?.groups ?? []).map((g) => orderOf(g.kind));
      const sorted = [...kinds].sort((a, b) => a - b);
      expect(kinds, `group order broken on ${card.name}`).to.deep.eq(sorted);
    }
  });

  // ── ORDER IS THE ONLY CARRIER OF SEQUENCE (hard requirement) ──────────
  // The player must READ the on-play order top-to-bottom. So (a) a block never
  // leans on a connective word ("then", "afterwards", …) to state sequence, and
  // (b) the block order follows the card's render reading order — which is
  // authored to match the real on-play execution order. See the "Card
  // Information Model" section in CLAUDE.md.

  it('no block leans on a sequencing connective word (order carries sequence)', () => {
    // ONLY pure ordering connectives — NOT "next" ("the next card you play"),
    // "after"/"before" (effect triggers) or ordinals ("first player", "second
    // standard project"), which are legitimate rule wording.
    const BANNED = /\b(then|afterwards?|finally|subsequently|firstly|secondly|thirdly|lastly)\b/i;
    const offenders: Array<string> = [];
    for (const card of cards) {
      for (const group of info(card)?.groups ?? []) {
        for (const block of group.blocks) {
          if (BANNED.test(block.text)) {
            offenders.push(`${card.name}: ${block.text}`);
          }
        }
      }
    }
    expect(offenders, `sequencing word — convey order by BLOCK ORDER instead:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('immediate blocks are in RENDER READING ORDER (row-monotone, never interleaved)', () => {
    const offenders: Array<string> = [];
    for (const card of cards) {
      const rowOf = new Map(deriveGraphicIds(card.metadata.renderData).map((r) => [r.id, r.rowIndex]));
      const immediate = info(card)?.groups.find((g) => g.kind === 'immediate');
      if (immediate === undefined) {
        continue;
      }
      // The render-row index of each block that links to a mechanic row, in
      // block order. Must be non-decreasing: reading the blocks top-to-bottom
      // walks the card's rows once, never jumping back up.
      const rows = immediate.blocks
        .map((b) => (b.graphicId !== undefined ? rowOf.get(b.graphicId) : undefined))
        .filter((r): r is number => r !== undefined);
      for (let i = 1; i < rows.length; i++) {
        if (rows[i] < rows[i - 1]) {
          offenders.push(`${card.name}: block rows ${rows.join(',')} jump backwards`);
          break;
        }
      }
    }
    expect(offenders, `immediate blocks out of render order:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('out-of-scope cards carry NO information (scope is explicit)', () => {
    const outside = loadCards().filter((c) => !SCOPE_MODULES.has(c.module) || !SCOPE_TYPES.has(c.type));
    for (const card of outside) {
      expect(info(card), `unexpected information on out-of-scope ${card.name}`).to.eq(undefined);
    }
  });
});
