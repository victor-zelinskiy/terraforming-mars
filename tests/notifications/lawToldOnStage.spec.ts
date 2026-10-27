import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Phase} from '../../src/common/Phase';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {PlayerViewModel} from '../../src/common/models/PlayerModel';
import {SpaceId} from '../../src/common/Types';
import {Board} from '../../src/server/boards/Board';
import {FORESTRY_SUPPORT_ID} from '../../src/server/parliament/resolutions/greens/ForestrySupport';
import {resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {addCity, runAllActions} from '../TestingUtils';
import {consumerSnapshot, freshConsumer, ingest, presented} from './consumerHarness';
import {markReactionTold, registerReactionScenePlays, resetReactionTold} from '../../src/client/console/cardReaction/reactionToldOnStage';

/**
 * A LAW'S PAYOUT THE SCENE PLAYS IS NOT TOLD AGAIN BY THE FEED («СРАБАТЫВАНИЕ КАРТЫ», iteration 4 — PL-1086 / PL-1090),
 * through the REAL producer → consumer harness: Forestry Support enacted, a city beside two groves. The box's first run
 * showed the defect this spec pins: the events read lands BEFORE the transport applies the response, the feed builds the
 * law's card («Сработал эффект») with no «told by the scene» mark yet, stashes it while the chain is open and releases
 * it AS BUILT. Two halves make the order irrelevant: a chain the APPLIED VIEW still lists as open is held
 * (`viewOpenCorrelations`), and «told by the scene» is asked again at the presentation (`toldByTheScene`).
 */
function enactedTable(): {game: IGame, player: TestPlayer, cellId: SpaceId} {
  const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  player.megaCredits = 60;
  game.parliament!.enacted = resolutionInstanceId(FORESTRY_SUPPORT_ID, 0);
  const cell = game.board.getAvailableSpacesOnLand(player).find((s) =>
    s.bonus.length === 0 &&
    !game.board.getAdjacentSpaces(s).some((a) => Board.isOceanSpace(a)) &&
    game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined).length >= 2);
  if (cell === undefined) {
    throw new Error('no quiet land cell with two free land neighbours');
  }
  const free = game.board.getAdjacentSpaces(cell).filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined);
  game.simpleAddTile(player, free[0], {tileType: TileType.GREENERY});
  game.simpleAddTile(player, free[1], {tileType: TileType.GREENERY});
  return {game, player, cellId: cell.id};
}

const lawCards = () => presented().filter((m) => m.id.endsWith(':law'));

/** The same view with another open-set — the transport's last APPLIED view, as the layer hands it to the ingest. */
function viewWithOpen(view: PlayerViewModel, open: ReadonlyArray<number>): PlayerViewModel {
  return {...view, game: {...view.game, openEventCorrelations: [...open]}};
}

describe('lawToldOnStage — the law\'s card and the reaction scene never tell one payout twice', () => {
  // The director's probe: this client can play a reaction (the layer mounted, motion not reduced).
  beforeEach(() => registerReactionScenePlays(() => true));
  afterEach(() => {
    registerReactionScenePlays(() => false);
    resetReactionTold();
    freshConsumer();
  });

  it('CONTROL: on a client whose scene cannot play (no layer / reduced motion) the law\'s card presents as before (the groves\' 4 M€ + 2 plants under the law)', () => {
    registerReactionScenePlays(() => false);
    const {game, player, cellId} = enactedTable();
    const before = consumerSnapshot(game, player);
    freshConsumer();
    ingest(before.view, before, 1_000);
    addCity(player, cellId);
    runAllActions(game);
    const after = consumerSnapshot(game, player);
    ingest(after.view, after, 2_000);
    expect(lawCards().map((m) => m.effectSource), 'the law\'s own card').deep.eq([{kind: 'resolution', resolution: FORESTRY_SUPPORT_ID}]);
  });

  it('the events read that RACES the view apply builds the card into PREPARING (the applied view still lists the chain as open), the mark lands with the apply block, and the release presents NOTHING', () => {
    const {game, player, cellId} = enactedTable();
    const before = consumerSnapshot(game, player);
    freshConsumer();
    ingest(before.view, before, 1_000);
    addCity(player, cellId);
    runAllActions(game);
    const after = consumerSnapshot(game, player);
    const marker = after.events.find((e) => e.type === 'effect-triggered' && e.source?.kind === 'resolution');
    expect(marker, 'the law\'s marker in the read').is.not.undefined;
    const corr = marker!.correlationId;
    const record = game.cardReactions.find((r) => r.kind === 'resolution');
    expect(record?.root.actionId, 'the record stands under the same chain').eq(corr);
    // ① THE RACE: the streams say the chain is CLOSED; the view the layer still holds lists it as OPEN (the response
    //    that closed it is not applied yet) — the card is built, but HELD, never presented.
    ingest(viewWithOpen(after.view, [corr]), {...after, openEventCorrelations: []}, 2_000);
    expect(lawCards(), 'held while the applied view has not caught up').deep.eq([]);
    // ② THE APPLY BLOCK: the director seeds the reaction and marks it told (the standalone chain / the host's claim).
    markReactionTold(record!);
    // ③ THE VIEW CATCHES UP: the release pass finds the chain closed on both sides — the stashed card is judged again.
    ingest(after.view, after, 3_000);
    expect(lawCards(), 'told by the scene — no second telling').deep.eq([]);
    expect(presented().filter((m) => m.correlationId === corr), 'nothing else of the chain presents (the own action stays suppressed)').deep.eq([]);
  });

  it('THE RING ALONE (no director mark yet): once the applied view carries the record the card is not built — the order of the reads cannot matter', () => {
    const {game, player, cellId} = enactedTable();
    const before = consumerSnapshot(game, player);
    freshConsumer();
    ingest(before.view, before, 1_000);
    addCity(player, cellId);
    runAllActions(game);
    const after = consumerSnapshot(game, player);
    const corr = after.events.find((e) => e.type === 'effect-triggered' && e.source?.kind === 'resolution')!.correlationId;
    expect(after.view.game.cardReactions?.some((r) => r.kind === 'resolution' && r.root.actionId === corr), 'the view carries the record').is.true;
    // The race: the streams closed, the applied view still open (no record in it yet) — held.
    ingest(viewWithOpen({...after.view, game: {...after.view.game, cardReactions: []}}, [corr]), {...after, openEventCorrelations: []}, 2_000);
    expect(lawCards(), 'held').deep.eq([]);
    // The view with the record: the ring tells it — nothing presents, no mark needed.
    ingest(after.view, after, 3_000);
    expect(lawCards(), 'the ring tells it').deep.eq([]);
  });

  it('THE RING GRACE (PL-1090): the events read lands while the transport still HOLDS the old view (no open chain, no record) — the card WAITS; the view with the record drops it; a view that never carries one releases it after the grace', () => {
    const {game, player, cellId} = enactedTable();
    const before = consumerSnapshot(game, player);
    freshConsumer();
    ingest(before.view, before, 1_000);
    addCity(player, cellId);
    runAllActions(game);
    const after = consumerSnapshot(game, player);
    // ① the race at its worst: the OLD view (nothing open, no record) with the NEW streams (the chain closed).
    ingest(before.view, {...after, openEventCorrelations: []}, 2_000);
    expect(lawCards(), 'held for the view').deep.eq([]);
    // ② the view with the record: dropped — the scene tells it.
    ingest(after.view, after, 2_500);
    expect(lawCards(), 'told by the ring').deep.eq([]);
    ingest(after.view, after, 9_000);
    expect(lawCards(), 'never released later either').deep.eq([]);
    // ③ a view that never carries the record (a law whose payout the scene does not play): the grace ends, the card presents.
    freshConsumer();
    ingest(before.view, before, 1_000);
    ingest(before.view, {...after, openEventCorrelations: []}, 2_000);
    expect(lawCards(), 'held for the view').deep.eq([]);
    ingest({...after.view, game: {...after.view.game, cardReactions: []}}, after, 7_000);
    expect(lawCards().map((m) => m.id), 'released after the grace — never silence').deep.eq([`g${after.events.find((e) => e.type === 'effect-triggered')!.correlationId}:law`]);
  });

  it('a mark for ANOTHER law, seat or chain keeps the card (the ring stays out of it: the scene cannot play here)', () => {
    registerReactionScenePlays(() => false);
    const {game, player, cellId} = enactedTable();
    const before = consumerSnapshot(game, player);
    freshConsumer();
    ingest(before.view, before, 1_000);
    addCity(player, cellId);
    runAllActions(game);
    const after = consumerSnapshot(game, player);
    const record = game.cardReactions.find((r) => r.kind === 'resolution')!;
    markReactionTold({...record, card: 'RDX_OTHER_LAW' as CardName});
    markReactionTold({...record, root: {actionId: (record.root.actionId ?? 0) + 1}});
    ingest(after.view, after, 2_000);
    expect(lawCards(), 'the card stands').has.length(1);
  });
});
