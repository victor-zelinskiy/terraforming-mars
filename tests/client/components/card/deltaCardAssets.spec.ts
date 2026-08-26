import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getCards, getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {
  CARD_ART_FALLBACK_URL,
  artTierForWidth,
  cardArtUrl,
  cardArtUrlAtTier,
  premiumCardArt,
} from '@/client/cards/cardArt';
import {buildCardLoreModel, cardLoreSource} from '@/client/cards/cardLore';
import loreTexts from '../../../../assets/text/lore_texts.json';

const EN_LORE: Readonly<Record<string, string>> = loreTexts;

/**
 * THE CARD NUMBER IS THE ASSET KEY — art and archive entry both hang off it.
 *
 * The Delta Project («Гидросеть») set is the fork's own, so every card in it
 * ships with a real illustration and a real lore entry: a `DP##` that resolves
 * to the shared `-1.webp` fallback or to the "no archive entry" notice is a
 * missing asset, not a design choice. The module is outside the premium-face
 * SCOPE sets (`docs/claude/expansion-adaptation-checklist.md`), so this is the
 * guard that covers it — and it covers each new card automatically.
 *
 * The one exception is the DP01 subsystem card: it is never dealt and never
 * reaches a card face (see DeltaProjectCardManifest).
 */
describe('Delta Project card assets', () => {
  const cards = getCards((c) => c.module === 'deltaProject' && c.name !== CardName.DELTA_PROJECT);

  it('covers the set (fails loudly if the module stops exporting cards)', () => {
    expect(cards.map((c) => c.name)).to.contain(CardName.QUANTUM_RESEARCH);
  });

  it('every card has real per-card art, at both tiers', () => {
    const missing: Array<string> = [];
    for (const card of cards) {
      const key = card.metadata.cardNumber;
      const url = cardArtUrl(card.name);
      if (url !== `assets/card-images/${key}.webp` || premiumCardArt(card.name).fallback) {
        missing.push(`${card.name} (${key ?? 'no card number'})`);
        continue;
      }
      // Large renders (fullscreen viewer, hero cinematics) take FULL; dense
      // surfaces (hand album, played tableau, flight proxies) take THUMB.
      expect(cardArtUrlAtTier(url, artTierForWidth(900)), card.name)
        .to.eq(`assets/card-images/${key}.webp`);
      expect(cardArtUrlAtTier(url, artTierForWidth(320)), card.name)
        .to.eq(`assets/card-images/thumb/${key}.webp`);
      expect(url, card.name).to.not.eq(CARD_ART_FALLBACK_URL);
    }
    expect(missing, `Delta Project cards without their own art:\n${missing.join('\n')}`).to.deep.eq([]);
  });

  it('every card resolves its archive entry through its card number', () => {
    const missing: Array<string> = [];
    for (const card of cards) {
      const key = card.metadata.cardNumber;
      const own = key === undefined ? undefined : EN_LORE[key];
      if (own === undefined || cardLoreSource(card.name) !== own || buildCardLoreModel(card.name, (t) => t).fallback) {
        missing.push(`${card.name} (${key ?? 'no card number'})`);
      }
    }
    expect(missing, `Delta Project cards with no archive entry:\n${missing.join('\n')}`).to.deep.eq([]);
  });

  it('Quantum Research is wired to DP02', () => {
    expect(getCardOrThrow(CardName.QUANTUM_RESEARCH).metadata.cardNumber).to.eq('DP02');
    expect(cardArtUrl(CardName.QUANTUM_RESEARCH)).to.eq('assets/card-images/DP02.webp');
    expect(cardLoreSource(CardName.QUANTUM_RESEARCH))
      .to.eq('Once the solution is computed, cost becomes a formality.');
  });
});
