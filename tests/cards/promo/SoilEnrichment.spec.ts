import {expect} from 'chai';
import {SoilEnrichment} from '../../../src/server/cards/promo/SoilEnrichment';
import {cast} from '@/common/utils/utils';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {GHGProducingBacteria} from '../../../src/server/cards/base/GHGProducingBacteria';
import {SearchForLife} from '../../../src/server/cards/base/SearchForLife';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {NitriteReducingBacteria} from '../../../src/server/cards/base/NitriteReducingBacteria';
import {Psychrophiles} from '../../../src/server/cards/prelude/Psychrophiles';
import {SelectProjectCardToPlay} from '../../../src/server/inputs/SelectProjectCardToPlay';
import {InputError} from '../../../src/server/inputs/InputError';
import {Payment} from '../../../src/common/inputs/Payment';

describe('SoilEnrichment', () => {
  let card: SoilEnrichment;
  let player: TestPlayer;

  beforeEach(() => {
    card = new SoilEnrichment();
    [/* game*/, player] = testGame(2);
  });

  const canPlayRuns = [
    {ghgResources: 0, searchForLifeResources: 0, expected: false},
    {ghgResources: 0, searchForLifeResources: 1, expected: false},
    {ghgResources: 1, searchForLifeResources: 0, expected: true},
  ] as const;
  for (const run of canPlayRuns) {
    it('canplay ' + JSON.stringify(run), () => {
      const ghgProducingBacteria = new GHGProducingBacteria();
      const searchForLife = new SearchForLife();
      ghgProducingBacteria.resourceCount = run.ghgResources;
      searchForLife.resourceCount = run.searchForLifeResources;
      player.playedCards.push(ghgProducingBacteria, searchForLife);

      expect(card.canPlay(player)).eq(run.expected);
    });
  }

  it('play', () => {
    const ghgProducingBacteria = new GHGProducingBacteria();
    const tardigrades = new Tardigrades();
    const nitriteReducingBacteria = new NitriteReducingBacteria();
    ghgProducingBacteria.resourceCount = 1;
    tardigrades.resourceCount = 1;
    nitriteReducingBacteria.resourceCount = 0;
    player.playedCards.push(ghgProducingBacteria, tardigrades, nitriteReducingBacteria);

    player.plants = 0;
    expect(card.canPlay(player)).is.true;

    const selectCard = cast(card.play(player), SelectCard);
    expect(selectCard.cards).to.have.members([ghgProducingBacteria, tardigrades]);
    selectCard.cb([tardigrades]);

    expect(tardigrades.resourceCount).eq(0);
    expect(player.plants).eq(5);
  });

  it('paying with the LAST microbe is refused by the rules (an InputError, the seat keeps its question) — never a server failure', () => {
    // The engine fuzz, seed 2078100179: Psychrophiles' one microbe offered as payment for a plant card whose own
    // effect spends a microbe — the engine threw a plain Error (a 500 and a report) for what is the rules saying no.
    const psychrophiles = new Psychrophiles();
    player.playedCards.push(psychrophiles);
    player.addResourceTo(psychrophiles, 1);
    player.megaCredits = 10;
    const pay = () => new SelectProjectCardToPlay(player).payAndPlay(card, {...Payment.EMPTY, megacredits: 4, microbes: 1});
    expect(pay).to.throw(InputError, 'Cannot spend all microbes to play Soil Enrichment');
    expect(psychrophiles.resourceCount, 'nothing was spent').eq(1);
    expect(player.megaCredits).eq(10);
  });

  it('play with only one eligible card', () => {
    const ghgProducingBacteria = new GHGProducingBacteria();
    ghgProducingBacteria.resourceCount = 1;
    player.playedCards.push(ghgProducingBacteria);

    player.plants = 0;
    expect(card.canPlay(player)).is.true;

    // Always asks which card, even with a single eligible card.
    const selectCard = cast(card.play(player), SelectCard);
    expect(selectCard.cards).has.lengthOf(1);
    selectCard.cb([ghgProducingBacteria]);

    expect(ghgProducingBacteria.resourceCount).eq(0);
    expect(player.plants).eq(5);
  });
});
