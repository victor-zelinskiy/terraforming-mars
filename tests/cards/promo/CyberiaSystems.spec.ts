import {expect} from 'chai';
import {CyberiaSystems} from '../../../src/server/cards/promo/CyberiaSystems';
import {Mine} from '../../../src/server/cards/base/Mine';
import {NoctisFarming} from '../../../src/server/cards/base/NoctisFarming';
import {MarsUniversity} from '../../../src/server/cards/base/MarsUniversity';
import {SolarWindPower} from '../../../src/server/cards/base/SolarWindPower';
import {UrbanizedArea} from '../../../src/server/cards/base/UrbanizedArea';
import {IGame} from '../../../src/server/IGame';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {cast, toName} from '../../../src/common/utils/utils';
import {runAllActions} from '../../TestingUtils';
import {Units} from '../../../src/common/Units';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';

describe('CyberiaSystems', () => {
  let card: CyberiaSystems;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new CyberiaSystems();
    [game, player] = testGame(1);
  });

  it('Cannot play without two building cards', () => {
    expect(card.canPlay(player)).is.false;

    player.playedCards.push(new Mine());
    expect(card.canPlay(player)).is.false;

    player.playedCards.push(new NoctisFarming());
    expect(card.canPlay(player)).is.true;
  });

  it('Building tag without production does not count', () => {
    player.playedCards.push(new Mine(), new MarsUniversity());
    expect(card.canPlay(player)).is.false;
  });

  it('Production without building tag does not count', () => {
    player.playedCards.push(new Mine(), new SolarWindPower());
    expect(card.canPlay(player)).is.false;
  });

  it('Should play - copies two cards', () => {
    const mine = new Mine();
    const noctisFarming = new NoctisFarming();
    player.playedCards.push(mine, noctisFarming);

    cast(card.play(player), undefined);
    // +1 steel from the card itself.
    expect(player.production.steel).to.eq(1);

    runAllActions(game);
    const firstSelectCard = cast(player.popWaitingFor(), SelectCard);
    expect(firstSelectCard.cards.map(toName)).to.have.members([mine.name, noctisFarming.name]);
    firstSelectCard.cb([mine]);

    runAllActions(game);
    const secondSelectCard = cast(player.popWaitingFor(), SelectCard);
    expect(secondSelectCard.cards.map(toName)).to.deep.eq([noctisFarming.name]);
    secondSelectCard.cb([noctisFarming]);

    // +1 steel (card) + 1 steel (Mine copy) = 2; +1 M€ (Noctis Farming copy).
    expect(player.production.steel).to.eq(2);
    expect(player.production.megacredits).to.eq(1);
  });

  it('Cannot select Urbanized Area without energy production to spend', () => {
    const mine = new Mine();
    const noctisFarming = new NoctisFarming();
    const urbanizedArea = new UrbanizedArea();
    player.playedCards.push(mine, noctisFarming, urbanizedArea);
    expect(player.production.energy).to.eq(0);

    cast(card.play(player), undefined);
    runAllActions(game);

    const selectCard = cast(player.popWaitingFor(), SelectCard);
    expect(selectCard.cards.map(toName)).to.not.include(urbanizedArea.name);
    expect(selectCard.cards.map(toName)).to.have.members([mine.name, noctisFarming.name]);
  });

  it('Can select Urbanized Area with energy production; both energy and M€ are copied', () => {
    const mine = new Mine();
    const urbanizedArea = new UrbanizedArea();
    player.playedCards.push(mine, urbanizedArea);
    player.production.override({energy: 1});

    cast(card.play(player), undefined);
    runAllActions(game);

    const selectCard = cast(player.popWaitingFor(), SelectCard);
    expect(selectCard.cards.map(toName)).to.have.members([mine.name, urbanizedArea.name]);
    selectCard.cb([urbanizedArea]);

    expect(player.production.energy).to.eq(0);
    expect(player.production.megacredits).to.eq(2);
  });

  it('cardPlayPreview: each step carries the server-computed copied production per candidate', () => {
    const mine = new Mine();
    const noctisFarming = new NoctisFarming();
    const urbanizedArea = new UrbanizedArea();
    player.production.override({energy: 1}); // makes Urbanized Area applicable
    player.playedCards.push(mine, noctisFarming, urbanizedArea);

    const branch = card.cardPlayPreview(player).branches[0];
    const inputs = branch.steps.filter((s): s is ActionPreviewStep & {kind: 'input'} => s.kind === 'input');
    expect(inputs).has.length(2);

    const box = inputs[0].copyProductionBox as Partial<Record<string, Units>> | undefined;
    expect(box, 'copyProductionBox map present').is.not.undefined;
    // Declarative production (computed from behavior.production).
    expect(box![mine.name]).to.include({steel: 1});
    expect(box![noctisFarming.name]).to.include({megacredits: 1});
    // Urbanized Area copies via a BESPOKE productionBox() method — the old
    // client-manifest field would MISS this; the server computes it authoritatively.
    expect(box![urbanizedArea.name]).to.include({energy: -1});
    expect(box![urbanizedArea.name]!.megacredits).to.be.greaterThan(0);
    // The second step's map de-dupes nothing yet (candidate set built the same way).
    expect(inputs[1].copyProductionBox).is.not.undefined;
  });

  it('Cannot select Cyberia Systems as a copy target', () => {
    const mine = new Mine();
    const noctisFarming = new NoctisFarming();
    player.playedCards.push(mine, noctisFarming, card);

    cast(card.play(player), undefined);
    runAllActions(game);

    const selectCard = cast(player.popWaitingFor(), SelectCard);
    expect(selectCard.cards.map(toName)).to.not.include(card.name);
    expect(selectCard.cards.map(toName)).to.have.members([mine.name, noctisFarming.name]);
  });
});
