import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {PREMIUM_SCOPE_MODULES, inPremiumScope} from '../../src/common/cards/premiumScope';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {ActionEffectBasis} from '../../src/common/models/ActionPreviewModel';
import {testGame} from '../TestGame';
import {fakeCard} from '../TestingUtils';
import {Phase} from '../../src/common/Phase';

/**
 * «INCLUDING THIS ONE» IS ONE NUMBER (P81 Soil Studies, the class `ActionEffectBasis.self`): a count of the player's
 * OWN tags that names a tag the PLAYED card carries holds the card's own tag while it is still in the hand (`Counter`
 * — `cardIsUnplayed`), and its basis must SAY so, or «[V][plant] 4» stands over a table showing three. The corpus: every
 * in-scope card whose declared `behavior` counts `{tag}` (no `others` / `all`) naming one of its own printed tags — its
 * term reads `count = table + self + wild` on an empty table and on a table holding one matching tag.
 */
type TagCount = {tag: Tag | ReadonlyArray<Tag>};

/**
 * The COUNTED amounts of a declaration — a `stock` / `production` unit whose amount is `{tag}` (a `tag` elsewhere is a
 * filter: «draw 2 Venus cards», «a floater onto a Jovian card»). Walks `or` / branch nesting.
 */
function ownTagCounts(raw: unknown, found: Array<TagCount> = []): Array<TagCount> {
  if (raw === null || typeof raw !== 'object') {
    return found;
  }
  const r = raw as Record<string, unknown>;
  for (const [key, v] of Object.entries(r)) {
    if ((key === 'stock' || key === 'production') && v !== null && typeof v === 'object') {
      for (const amount of Object.values(v as Record<string, unknown>)) {
        const a = amount as {tag?: unknown, others?: boolean, all?: boolean} | null;
        if (a !== null && typeof a === 'object' && a.tag !== undefined && a.others !== true && a.all !== true) {
          found.push({tag: a.tag as TagCount['tag']});
        }
      }
    } else {
      ownTagCounts(v, found);
    }
  }
  return found;
}

function corpus(): Array<{card: ICard, counted: ReadonlyArray<Tag>}> {
  const out: Array<{card: ICard, counted: ReadonlyArray<Tag>}> = [];
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!PREMIUM_SCOPE_MODULES.includes(manifest.module)) {
      continue;
    }
    for (const name of Object.keys(manifest.projectCards)) {
      const Factory = (manifest.projectCards as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
      if (Factory === undefined || !inPremiumScope({module: manifest.module, name}, PREMIUM_SCOPE_MODULES)) {
        continue;
      }
      const card = new Factory();
      const counted = ownTagCounts(card.behavior).flatMap((c) => [c.tag].flat());
      if (counted.some((t) => card.tags.includes(t))) {
        out.push({card, counted});
      }
    }
  }
  return out;
}

const tagTerms = (card: ICard, opts: {extra?: Tag}): Array<ActionEffectBasis> => {
  const [game, player] = testGame(2, {venusNextExtension: true, coloniesExtension: true, prelude2Expansion: true, turmoilExtension: true});
  game.phase = Phase.ACTION;
  if (opts.extra !== undefined) {
    player.playedCards.push(fakeCard({name: 'one table tag' as CardName, tags: [opts.extra]}));
  }
  player.cardsInHand.push(card as IProjectCard);
  return cardPlayPreview(player, card as IProjectCard).branches
    .flatMap((b) => b.effects)
    .flatMap((e) => e.basis ?? [])
    .filter((b) => b.label === 'Your tags');
};

describe('A count of your own tags names the played card\'s own share (P81 — `self`)', () => {
  const cards = corpus();

  it('the corpus is not empty and holds Soil Studies', () => {
    expect(cards.map((c) => c.card.name)).include(CardName.SOIL_STUDIES);
  });

  for (const {card, counted} of cards) {
    it(`${card.name}: count = table + self + wild — on an empty table and with one counted tag on it`, () => {
      const own = card.tags.filter((t) => counted.includes(t)).length;
      const empty = tagTerms(card, {});
      expect(empty.length, 'the preview reads its tag term').greaterThan(0);
      for (const term of empty) {
        expect([term.count, term.self ?? 0, term.wild ?? 0], JSON.stringify(term)).deep.eq([own, own, 0]);
      }
      for (const term of tagTerms(card, {extra: counted[0]})) {
        expect([term.count, term.self ?? 0], JSON.stringify(term)).deep.eq([1 + own, own]);
      }
    });
  }
});
