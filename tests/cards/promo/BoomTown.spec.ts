import {expect} from 'chai';
import {BoomTown} from '../../../src/server/cards/promo/BoomTown';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {TileType} from '../../../src/common/TileType';
import {runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {BoardName} from '../../../src/common/boards/BoardName';
import {EmptyBoard} from '../../testing/EmptyBoard';
import {cast} from '../../../src/common/utils/utils';
import {CardName} from '../../../src/common/cards/CardName';
import {Payment} from '../../../src/common/inputs/Payment';
import {SpaceBonus} from '../../../src/common/boards/SpaceBonus';
import {computePreludeOutlooks} from '../../../src/server/preludes/preludeOutlook';
import {IPreludeCard} from '../../../src/server/cards/prelude/IPreludeCard';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {
  ICardRenderEffect,
  ICardRenderRoot,
  isICardRenderEffect,
  isICardRenderSymbol,
} from '../../../src/common/cards/render/Types';
import {CardRenderSymbolType} from '../../../src/common/cards/render/CardRenderSymbolType';

describe('BoomTown', () => {
  let card: BoomTown;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new BoomTown();
    [game, player] = testGame(2, {boardName: BoardName.THARSIS});
  });

  it('play', () => {
    cast(card.play(player), undefined);
    runAllActions(game);

    expect(player.production.titanium).to.eq(2);
    expect(player.getTitaniumValue()).to.eq(2);
  });

  it('play, only offers spaces with a steel or titanium bonus', () => {
    card.play(player);
    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);

    // These spaces on Tharsis have the bonuses.
    expect(selectSpace.spaces.map((space) => space.id))
      .to.have.members(['03', '09', '20', '21', '53', '58', '59', '60']);
  });

  it('play, places a city', () => {
    card.play(player);
    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);
    const space = selectSpace.spaces[0];

    selectSpace.cb(space);
    runAllActions(game);

    expect(space.player).to.eq(player);
    expect(space.tile?.tileType).to.eq(TileType.CITY);
  });

  it('Can play', () => {
    expect(card.canPlay(player)).is.true;
  });

  it('Cannot play when no space has a steel or titanium bonus', () => {
    game.board = EmptyBoard.newInstance();

    expect(game.board.getAvailableSpacesForType(player, 'city')).is.not.empty;
    expect(card.canPlay(player)).is.false;
  });

  // ── the fork's premium adaptation ────────────────────────────────────────

  it('the titanium devaluation is PERMANENT — a later payment is charged at 2 M€ a unit', () => {
    expect(player.payingAmount(Payment.of({titanium: 4}), {titanium: true})).to.eq(12);

    card.play(player);
    runAllActions(game);

    expect(player.payingAmount(Payment.of({titanium: 4}), {titanium: true})).to.eq(8);
  });

  it('the placement NAMES the card — the console task summary and the per-cell preview both read it', () => {
    card.play(player);
    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);

    // `sourceCard` is what lets the placement preview ask THIS card about the
    // hovered cell; `placementContext.source` is what the console band names.
    expect(selectSpace.sourceCard).to.eq(CardName.BOOM_TOWN);
    expect(selectSpace.placementType).to.eq('city');
    expect(selectSpace.tileType).to.eq(TileType.CITY);
    expect(selectSpace.placementContext?.source).to.deep.eq({kind: 'card', card: CardName.BOOM_TOWN});
    // The prelude is already played by the time the board opens — nothing to cancel.
    expect(selectSpace.placementContext?.cancellable).to.be.false;
  });

  it('a city-placeable cell WITHOUT the bonus says why it is off-limits', () => {
    card.play(player);
    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);

    // '05' is ordinary Tharsis land: a city could go there, it just prints no
    // steel/titanium bonus — the ONE rule this card adds.
    const plainLand = selectSpace.illegalSpaces?.find((s) => s.spaceId === '05');
    expect(plainLand?.reason).to.eq('wrong-bonus-type');
    expect(selectSpace.illegalSpaces?.filter((s) => s.reason === 'wrong-bonus-type'))
      .to.have.length.greaterThan(0);
  });

  it('a cell that HAS the bonus but is illegal for another reason keeps its own reason', () => {
    const [game2, player2, otherPlayer] = testGame(2, {boardName: BoardName.THARSIS});
    // '09' prints a steel bonus; '10' is adjacent to it.
    expect(game2.board.getSpaceOrThrow('09').bonus).to.include(SpaceBonus.STEEL);
    game2.addTile(otherPlayer, game2.board.getSpaceOrThrow('10'), {tileType: TileType.CITY});

    card.play(player2);
    runAllActions(game2);
    const selectSpace = cast(player2.popWaitingFor(), SelectSpace);

    expect(selectSpace.spaces.map((s) => s.id)).to.not.include('09');
    // NOT 'wrong-bonus-type' — that would be a lie about a cell that has the bonus.
    expect(selectSpace.illegalSpaces?.find((s) => s.spaceId === '09')?.reason).to.eq('adjacent-to-city');
    expect(selectSpace.illegalSpaces?.find((s) => s.spaceId === '10')?.reason).to.eq('occupied');
  });

  it('the play preview shows the production AND names the city placement it owes', () => {
    // A prelude previews through the SAME `cardPlayPreview` path a hand card does
    // (the console start scene fetches it for the press beat), and the city is
    // placed bespoke — without the co-located hook the preview would be mute
    // about the board interaction that follows.
    const preview = cardPlayPreview(player, card);
    const branch = preview.branches[0];

    const titanium = branch.effects.find((e) => e.icon === 'titanium');
    expect(titanium?.direction).to.eq('gain');
    expect(titanium?.note).to.eq('production');
    expect(titanium?.amount).to.eq(2);
    expect(titanium?.current).to.eq(0);
    expect(titanium?.resulting).to.eq(2);
    const placements = branch.steps
      .filter((s): s is Extract<ActionPreviewStep, {kind: 'boardPlacement'}> => s.kind === 'boardPlacement');
    expect(placements).to.have.length(1);
    expect(placements[0].tileType).to.eq(TileType.CITY);
    expect(placements[0].constraint).to.eq('on a steel or titanium bonus area');
  });

  it('with no qualifying space the prelude verdict is a final noEffect — the order cannot fix it', () => {
    game.board = EmptyBoard.newInstance();
    player.preludeCardsInHand.push(card);

    // No other prelude can print a steel/titanium bonus on the board, so the card
    // declares no `preludeNeeds` and the engine must not invent hope.
    expect((card as IPreludeCard).preludeNeeds).to.be.undefined;
    expect(computePreludeOutlooks(player, [card], player.preludeCardsInHand).get(CardName.BOOM_TOWN))
      .to.deep.eq({state: 'noEffect'});
  });

  it('the card face draws the devaluation as a real ongoing EFFECT frame', () => {
    // Not a loose graphic row + `plainText` prose: only a real `effect()` node is
    // banded by the premium face, listed by the ЭФФЕКТЫ overlay, and filed by
    // `make:cards` under «постоянный эффект» instead of the on-play zone.
    const root = cast(card.metadata.renderData, Object) as ICardRenderRoot;
    const node = root.rows[0][0];
    expect(isICardRenderEffect(node), 'the first row is an effect frame').is.true;
    const effect = node as ICardRenderEffect;
    // A COLON delimiter is what marks it PASSIVE (an arrow would read as an action).
    const delimiter = effect.rows?.[1]?.[0];
    expect(isICardRenderSymbol(delimiter) && delimiter.type === CardRenderSymbolType.COLON).is.true;
    // The description the DSL bakes in IS the i18n key the info model files.
    expect(effect.rows?.[2]?.[2]).to.eq('Effect: Your titanium is worth 1 M€ less.');
    // The prose row upstream drew instead must be gone (the premium face drops it).
    expect(JSON.stringify(root)).to.not.include('"type":"text"');
  });
});
