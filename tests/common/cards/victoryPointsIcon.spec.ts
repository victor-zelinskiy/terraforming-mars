import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {CardManifest} from '../../../src/server/cards/ModuleManifest';
import {ICard} from '../../../src/server/cards/ICard';
import {Card} from '../../../src/server/cards/Card';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {hasNonNegativeVictoryPointsIcon, victoryPointsIconOf} from '../../../src/common/cards/victoryPointsIcon';
import {AutomaScoring} from '../../../src/server/automa/AutomaScoring';
import {fakeCard} from '../../TestingUtils';

/**
 * THE PRINTED VP ICON, read from the card's semantic declaration — the ONE
 * rule MarsBot's Hard/Brutal scoring, the bot corporation Vitor and Turmoil
 * Redux's Architecture Award share. The corpus guard is the worklist: every
 * bespoke ('special') scorer must state its icon's sign in its own file, or
 * it is never read as non-negative.
 */
function everyCard(): Array<ICard> {
  const out: Array<ICard> = [];
  for (const manifest of ALL_MODULE_MANIFESTS) {
    const factories: CardManifest<ICard> = {
      ...manifest.projectCards, ...manifest.corporationCards, ...manifest.preludeCards, ...manifest.ceoCards,
      ...manifest.standardProjects, ...manifest.standardActions,
    };
    for (const factory of CardManifest.values(factories)) {
      const card = new factory.Factory();
      if (card.type !== CardType.PROXY) {
        out.push(card);
      }
    }
  }
  return out;
}

describe('victoryPointsIcon', () => {
  it('no declaration is NO icon — a card without an icon is not «non-negative», even though it scores 0', () => {
    expect(victoryPointsIconOf({})).deep.eq({kind: 'none'});
    expect(hasNonNegativeVictoryPointsIcon({})).is.false;
  });

  it('a fixed icon counts when ≥ 0 (a printed 0 included); a negative one does not', () => {
    expect(victoryPointsIconOf({victoryPoints: 2})).deep.eq({kind: 'fixed', points: 2});
    expect(hasNonNegativeVictoryPointsIcon({victoryPoints: 2})).is.true;
    expect(hasNonNegativeVictoryPointsIcon({victoryPoints: 0})).is.true;
    expect(hasNonNegativeVictoryPointsIcon({victoryPoints: -1})).is.false;
  });

  it('a variable icon is read by its SIGN, never by what it scores right now', () => {
    expect(victoryPointsIconOf({victoryPoints: {resourcesHere: {}, per: 2}})).deep.eq({kind: 'variable', sign: 'nonNegative'});
    expect(hasNonNegativeVictoryPointsIcon({victoryPoints: {resourcesHere: {}, each: 2}})).is.true;
    expect(victoryPointsIconOf({victoryPoints: {cities: {}, all: true, each: -1}})).deep.eq({kind: 'variable', sign: 'negative'});
    expect(hasNonNegativeVictoryPointsIcon({victoryPoints: {cities: {}, each: -1}})).is.false;
  });

  it('a bespoke icon by its DECLARED sign; «either» is not non-negative; an undeclared one is never guessed', () => {
    expect(hasNonNegativeVictoryPointsIcon({victoryPoints: 'special', victoryPointsSign: 'nonNegative'})).is.true;
    expect(hasNonNegativeVictoryPointsIcon({victoryPoints: 'special', victoryPointsSign: 'negative'})).is.false;
    expect(hasNonNegativeVictoryPointsIcon({victoryPoints: 'special', victoryPointsSign: 'either'})).is.false;
    expect(victoryPointsIconOf({victoryPoints: 'special'})).deep.eq({kind: 'variable', sign: 'unknown'});
    expect(hasNonNegativeVictoryPointsIcon({victoryPoints: 'special'})).is.false;
  });

  it('MarsBot\'s scoring reads the very same rule', () => {
    expect(AutomaScoring.hasNonNegativeVpIcon(fakeCard({victoryPoints: 'special', victoryPointsSign: 'nonNegative'}))).is.true;
    expect(AutomaScoring.hasNonNegativeVpIcon(fakeCard({victoryPoints: 'special', victoryPointsSign: 'negative'}))).is.false;
    expect(AutomaScoring.hasNonNegativeVpIcon(fakeCard({victoryPoints: 'special'}))).is.false;
  });

  it('CORPUS: every bespoke scorer declares its icon\'s sign (and only a bespoke scorer does)', () => {
    const cards = everyCard();
    expect(cards.length, 'the corpus was walked').greaterThan(500);
    const undeclared = cards.filter((card) => card.victoryPoints === 'special' && card.victoryPointsSign === undefined).map((card) => card.name);
    expect(undeclared, 'cards whose bespoke VP icon owes a `victoryPointsSign`').deep.eq([]);
    const stray = cards.filter((card) => card.victoryPoints !== 'special' && card.victoryPointsSign !== undefined).map((card) => card.name);
    expect(stray).deep.eq([]);
    // Every icon classifies to a known sign.
    const unknown = cards.filter((card) => {
      const icon = victoryPointsIconOf(card);
      return icon.kind === 'variable' && icon.sign === 'unknown';
    }).map((card) => card.name);
    expect(unknown).deep.eq([]);
  });

  it('a sign on a card that is not a bespoke scorer is refused at construction', () => {
    // The Card base class validates the pairing (a sign is only meaningful for 'special').
    class Stray extends Card {
      constructor() {
        super({name: 'Stray VP Sign' as CardName, type: CardType.AUTOMATED, cost: 1, victoryPoints: 1, victoryPointsSign: 'negative', metadata: {}});
      }
    }
    expect(() => new Stray()).to.throw(/victoryPointsSign/);
  });
});
