import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {BoardFact, BoardPlacementPreview} from '../../src/common/boards/BoardInformationFacts';
import {MarsNomads} from '../../src/server/cards/promo/MarsNomads';
import {EcologicalSurvey} from '../../src/server/cards/ares/EcologicalSurvey';
import {Athena} from '../../src/server/cards/community/Athena';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {SelectProductionToLose} from '../../src/server/inputs/SelectProductionToLose';
import {AresHazards} from '../../src/server/ares/AresHazards';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {CardName} from '../../src/common/cards/CardName';
import {Space} from '../../src/server/boards/Space';

/**
 * PREVIEW ↔ COMMIT consistency across `placementEffect`.
 *
 * The costs `Game.addTile` charges (hazard cleanup M€, the hazard-adjacency
 * production penalty, adjacency surcharges) exist ONLY on the tile path; a
 * bonus-only pick (Mars Nomads moving its camp) collects the cell's printed
 * bonus + ocean M€ and fires the `onTilePlaced` fan-out with no tile; a pure
 * marker (Land Claim) does nothing at all. Every scenario here drives BOTH
 * sides — the read-only preview and the real commit — over the same board
 * geometry, so a promise the commit doesn't collect (the screenshot bug:
 * «Снизить производство −1» for a camp moving next to a hazard) fails loudly.
 */
describe('placementEffect preview ↔ commit consistency', () => {
  let game: IGame;
  let player: TestPlayer;
  let card: MarsNomads;

  beforeEach(() => {
    [game, player] = testGame(2, {aresExtension: true});
    card = new MarsNomads();
  });

  function allFacts(preview: BoardPlacementPreview): ReadonlyArray<BoardFact> {
    return [
      ...preview.costFacts, ...preview.immediateFacts, ...preview.recipientFacts,
      ...preview.warningFacts, ...preview.futureScoringFacts, ...preview.ruleFacts,
      ...(preview.progressFacts ?? []),
    ];
  }

  /** A camp cell, a destination next to it, and a THIRD land cell adjacent to
   *  the destination (for a hazard) — all empty land. */
  function campGeometry(): {camp: Space, dest: Space, third: Space} {
    for (const camp of game.board.getAvailableSpacesOnLand(player)) {
      const lands = game.board.getAdjacentSpaces(camp)
        .filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined);
      for (const dest of lands) {
        const third = game.board.getAdjacentSpaces(dest).find((s) =>
          s.id !== camp.id && s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined);
        if (third !== undefined) {
          return {camp, dest, third};
        }
      }
    }
    throw new Error('no camp/dest/hazard geometry on this board');
  }

  function moveCampTo(dest: Space) {
    const selectSpace = cast(card.action(player), SelectSpace);
    expect(selectSpace.spaces.map((s) => s.id), 'the commit offers this destination').to.include(dest.id);
    selectSpace.cb(dest);
    runAllActions(game);
  }

  describe('camp move next to a hazard (the screenshot scenario)', () => {
    it('preview: no production penalty, no placement cost, no hazard highlight', () => {
      const {camp, dest, third} = campGeometry();
      AresHazards.putHazardAt(game, third, TileType.DUST_STORM_MILD);
      dest.bonus = [SpaceBonus.DRAW_CARD, SpaceBonus.DRAW_CARD];
      game.nomadSpace = camp.id;

      const preview = boardCellPreview(player, dest, 'land',
        {sourceCard: CardName.MARS_NOMADS, placementEffect: 'bonus-only'});

      expect(preview.costFacts, 'a camp move pays none of the tile costs').to.be.empty;
      expect(allFacts(preview).some((f) => f.id === 'cost-production'),
        'no «Reduce production» promise').is.false;
      // The board relation layer lights exactly the cells the facts name — no
      // fact may name the hazard, so it cannot be highlighted as triggering.
      expect(allFacts(preview).some((f) => f.spaces?.includes(third.id) === true),
        'no fact names the hazard cell').is.false;
      // …while the printed bonus IS promised, at its real value.
      const printed = preview.immediateFacts.find((f) => f.id.startsWith('printed-'));
      expect(printed, 'the cell bonus is still promised').to.not.be.undefined;
      expect(printed!.delta).to.deep.include({icon: 'cards', amount: 2});
    });

    it('commit: the move collects the cards and loses no production', () => {
      const {camp, dest, third} = campGeometry();
      AresHazards.putHazardAt(game, third, TileType.DUST_STORM_MILD);
      dest.bonus = [SpaceBonus.DRAW_CARD, SpaceBonus.DRAW_CARD];
      game.nomadSpace = camp.id;

      const productionBefore = player.production.asUnits();
      const cardsBefore = player.cardsInHand.length;
      moveCampTo(dest);

      expect(player.cardsInHand.length - cardsBefore, 'the promised +2 cards').to.eq(2);
      expect(player.production.asUnits(), 'no production loss').to.deep.eq(productionBefore);
      expect(player.getWaitingFor(), 'no production-to-lose prompt').is.undefined;
    });

    it('a TILE in the same geometry pays exactly what its preview shows', () => {
      const {dest, third} = campGeometry();
      AresHazards.putHazardAt(game, third, TileType.DUST_STORM_MILD);

      const preview = boardCellPreview(player, dest, 'city', {tileType: TileType.CITY});
      const penalty = allFacts(preview).find((f) => f.id === 'cost-production');
      expect(penalty, 'a tile placement IS taxed').to.not.be.undefined;
      expect(penalty!.delta!.amount).to.eq(1);
      expect(penalty!.spaces, 'the taxing hazard is named (and highlighted)').to.deep.eq([third.id]);

      game.addTile(player, dest, {tileType: TileType.CITY});
      runAllActions(game);
      const input = cast(player.popWaitingFor(), SelectProductionToLose);
      expect(input.unitsToLose, 'commit charges the same amount').to.eq(penalty!.delta!.amount);
    });
  });

  it('several adjacent hazards: the preview total, breakdown and highlight match the commit', () => {
    const {dest, third} = campGeometry();
    const fourth = game.board.getAdjacentSpaces(dest).find((s) =>
      s.id !== third.id && s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined);
    if (fourth === undefined) {
      throw new Error('no second hazard neighbour');
    }
    AresHazards.putHazardAt(game, third, TileType.DUST_STORM_MILD); // −1
    AresHazards.putHazardAt(game, fourth, TileType.EROSION_SEVERE); // −2

    const preview = boardCellPreview(player, dest, 'city', {tileType: TileType.CITY});
    const penalty = allFacts(preview).find((f) => f.id === 'cost-production');
    expect(penalty!.delta!.amount).to.eq(3);
    expect([...(penalty!.spaces ?? [])].sort()).to.deep.eq([third.id, fourth.id].sort());
    // The mixed-severity breakdown names both rates instead of averaging.
    expect(penalty!.params).to.deep.eq(['1', '1']);

    game.addTile(player, dest, {tileType: TileType.CITY});
    runAllActions(game);
    const input = cast(player.popWaitingFor(), SelectProductionToLose);
    expect(input.unitsToLose).to.eq(3);
  });

  it('a suppressed penalty (Athena) is absent from the preview AND the commit', () => {
    const {dest, third} = campGeometry();
    AresHazards.putHazardAt(game, third, TileType.DUST_STORM_MILD);
    player.playedCards.push(new Athena());

    const preview = boardCellPreview(player, dest, 'city', {tileType: TileType.CITY});
    expect(allFacts(preview).some((f) => f.id === 'cost-production'),
      'Athena waives the penalty — the preview must not show the raw base effect').is.false;

    const productionBefore = player.production.asUnits();
    game.addTile(player, dest, {tileType: TileType.CITY});
    runAllActions(game);
    expect(player.getWaitingFor(), 'no production-to-lose prompt').is.undefined;
    expect(player.production.asUnits()).to.deep.eq(productionBefore);
  });

  describe('a hazard-covered destination grants no bonus (bonuses are covered)', () => {
    it('camp move ONTO a hazard: preview promises nothing, commit collects nothing', () => {
      const {camp, dest} = campGeometry();
      dest.bonus = [SpaceBonus.PLANT, SpaceBonus.PLANT];
      AresHazards.putHazardAt(game, dest, TileType.EROSION_MILD);
      game.nomadSpace = camp.id;

      const preview = boardCellPreview(player, dest, 'land',
        {sourceCard: CardName.MARS_NOMADS, placementEffect: 'bonus-only'});
      expect(preview.immediateFacts.some((f) => f.id.startsWith('printed-')),
        'the hazard covers the printed bonus').is.false;
      expect(preview.costFacts, 'no cleanup cost — the camp removes nothing').to.be.empty;
      expect(allFacts(preview).some((f) => f.id === 'hazard-cleanup-tr'),
        'no cleanup TR — the camp removes nothing').is.false;

      const plantsBefore = player.plants;
      const trBefore = player.terraformRating;
      moveCampTo(dest);
      expect(game.nomadSpace).to.eq(dest.id);
      expect(player.plants, 'no covered bonus collected').to.eq(plantsBefore);
      expect(player.terraformRating, 'no cleanup TR granted').to.eq(trBefore);
    });

    it('a TILE onto a hazard: cleanup cost + TR promised, printed bonus not', () => {
      const {dest} = campGeometry();
      dest.bonus = [SpaceBonus.PLANT, SpaceBonus.PLANT];
      AresHazards.putHazardAt(game, dest, TileType.EROSION_MILD);

      const preview = boardCellPreview(player, dest, 'city', {tileType: TileType.CITY});
      expect(preview.immediateFacts.some((f) => f.id.startsWith('printed-')),
        'covering suppresses the printed bonus for a tile too').is.false;
      const cost = preview.costFacts.find((f) => f.delta?.icon === 'megacredits');
      expect(cost, 'the cleanup M€ cost is promised').to.not.be.undefined;
      expect(cost!.delta!.amount).to.eq(8);
      expect(allFacts(preview).some((f) => f.id === 'hazard-cleanup-tr'), 'the +1 TR reward shows').is.true;

      player.megaCredits = 8;
      const plantsBefore = player.plants;
      const trBefore = player.terraformRating;
      game.addTile(player, dest, {tileType: TileType.CITY});
      game.deferredActions.peek()!.execute();
      expect(player.megaCredits, 'commit charged the promised 8 M€').to.eq(0);
      expect(player.terraformRating, 'commit granted the promised TR').to.eq(trBefore + 1);
      expect(player.plants, 'commit granted no covered bonus').to.eq(plantsBefore);
    });
  });

  describe('tile-placement triggers follow the fan-out the commit actually runs', () => {
    it('a survey card pays for a camp move (the fan-out DOES fire) — promised and paid', () => {
      const {camp, dest} = campGeometry();
      dest.bonus = [SpaceBonus.PLANT];
      game.nomadSpace = camp.id;
      player.playedCards.push(new EcologicalSurvey());

      const preview = boardCellPreview(player, dest, 'land',
        {sourceCard: CardName.MARS_NOMADS, placementEffect: 'bonus-only'});
      const survey = allFacts(preview).find((f) => f.id.includes(CardName.ECOLOGICAL_SURVEY));
      expect(survey, 'the survey extra IS promised for a bonus-collecting move').to.not.be.undefined;

      moveCampTo(dest);
      expect(player.plants, 'printed 1 + survey extra 1').to.eq(2);
    });

    it('a pure marker fires no triggers — the survey promise is absent', () => {
      const dest = campGeometry().dest;
      dest.bonus = [SpaceBonus.PLANT];
      player.playedCards.push(new EcologicalSurvey());

      const preview = boardCellPreview(player, dest, 'land',
        {sourceCard: CardName.LAND_CLAIM, placementEffect: 'marker'});
      expect(allFacts(preview).some((f) => f.id.includes(CardName.ECOLOGICAL_SURVEY)),
        'Land Claim runs no onTilePlaced fan-out').is.false;
      expect(preview.costFacts, 'a claim charges nothing').to.be.empty;
    });
  });

  it('deflection-zone protection reacts to tiles, never to markers', () => {
    const dest = campGeometry().dest;
    player.withinDeflectionZone = true;

    const asTile = boardCellPreview(player, dest, 'city', {tileType: TileType.CITY});
    expect(allFacts(asTile).some((f) => f.id === 'deflection-impact'),
      'a tile outside the zone threatens the protection').is.true;

    const asCamp = boardCellPreview(player, dest, 'land',
      {sourceCard: CardName.MARS_NOMADS, placementEffect: 'bonus-only'});
    expect(allFacts(asCamp).some((f) => f.id === 'deflection-impact'),
      'a camp move does not move any owned tile').is.false;
  });

  it('the preview stays read-only in the marker/bonus-only paths too', () => {
    const {camp, dest, third} = campGeometry();
    AresHazards.putHazardAt(game, third, TileType.DUST_STORM_MILD);
    game.nomadSpace = camp.id;
    const before = JSON.stringify(game.board.serialize());

    boardCellPreview(player, dest, 'land', {sourceCard: CardName.MARS_NOMADS, placementEffect: 'bonus-only'});
    boardCellPreview(player, dest, 'land', {sourceCard: CardName.LAND_CLAIM, placementEffect: 'marker'});

    expect(JSON.stringify(game.board.serialize())).to.eq(before);
  });
});
