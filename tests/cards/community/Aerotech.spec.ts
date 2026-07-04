import {expect} from 'chai';
import {Aerotech} from '../../../src/server/cards/community/Aerotech';
import {CardName} from '../../../src/common/cards/CardName';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {Phase} from '../../../src/common/Phase';
import {newProjectCard} from '../../../src/server/createCard';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {keep, LogType} from '../../../src/server/deferredActions/ChooseCards';
import {aggregateBySource, toEffectOverlayStat} from '../../../src/common/events/aggregate';
import {sourceKey} from '../../../src/common/events/EventSource';

describe('Aerotech', () => {
  let card: Aerotech;
  let player: TestPlayer;
  let drawnCards: ReadonlyArray<IProjectCard>;
  let discardedCards: ReadonlyArray<IProjectCard>;

  beforeEach(() => {
    card = new Aerotech();
    [, player] = testGame(1);
    player.playedCards.push(card);
    drawnCards = [newProjectCard(CardName.AQUIFER_PUMPING)!, newProjectCard(CardName.IO_MINING_INDUSTRIES)!];
    discardedCards = [newProjectCard(CardName.AQUIFER_PUMPING)!];
  });

  it('gains 1 titanium per discarded card during the research phase', () => {
    player.game.phase = Phase.RESEARCH;

    Aerotech.onDrawCards(player, drawnCards, discardedCards);

    expect(player.titanium).to.eq(discardedCards.length);
  });

  it('gains no titanium when nothing is discarded', () => {
    player.game.phase = Phase.RESEARCH;

    Aerotech.onDrawCards(player, drawnCards, []);

    expect(player.titanium).to.eq(0);
  });

  it('does nothing outside the research phase', () => {
    player.game.phase = Phase.ACTION;

    Aerotech.onDrawCards(player, drawnCards, discardedCards);

    expect(player.titanium).to.eq(0);
  });

  it('does nothing when the player is not playing Aerotech', () => {
    player.playedCards.remove(card);
    player.game.phase = Phase.RESEARCH;

    Aerotech.onDrawCards(player, drawnCards, discardedCards);

    expect(player.titanium).to.eq(0);
  });

  // Fork-only (Effects overlay): the titanium is granted inside a passive-effect
  // scope (ChooseCards.keep wraps Aerotech.onDrawCards in events.withEffect), so
  // effectOverlayStats attributes it to Aerotech's effect instead of it being an
  // unattributed stock gain.
  it('attributes the titanium to Aerotech as a passive effect (Effects overlay stats)', () => {
    const [game, aeroPlayer] = testGame(1);
    aeroPlayer.playedCards.push(new Aerotech());
    aeroPlayer.game.phase = Phase.RESEARCH;

    const bought = [newProjectCard(CardName.IO_MINING_INDUSTRIES)!];
    const unbought = [newProjectCard(CardName.AQUIFER_PUMPING)!, newProjectCard(CardName.ACQUIRED_COMPANY)!];
    keep(aeroPlayer, bought, unbought, LogType.BOUGHT);

    expect(aeroPlayer.titanium).to.eq(unbought.length);

    const ev = game.events.events.find((e) =>
      e.impact.stock?.titanium === unbought.length &&
      e.source !== undefined && 'card' in e.source && e.source.card === CardName.AEROTECH);
    expect(ev, 'Aerotech titanium recorded under its effect').to.not.be.undefined;
    expect(ev!.tags).to.contain('passive-effect');

    const stats = aggregateBySource(game.events.events.filter((e) => e.tags?.includes('passive-effect') === true));
    const stat = toEffectOverlayStat(stats.get(sourceKey({kind: 'corporation', card: CardName.AEROTECH, owner: aeroPlayer.color}))!);
    expect(stat.stock.titanium).to.eq(unbought.length);
  });
});
