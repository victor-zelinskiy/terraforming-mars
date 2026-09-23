import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';
import {boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {BoardFact, BoardPlacementPreview} from '../../src/common/boards/BoardInformationFacts';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {TileType} from '../../src/common/TileType';
import {MAX_OXYGEN_LEVEL} from '../../src/common/constants';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {DEVELOPMENT_CRAZE_ID} from '../../src/server/parliament/resolutions/marsFirst/DevelopmentCraze';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {seatEnacted, seatResolution} from '../parliament/parliamentArrange';
import {Space} from '../../src/server/boards/Space';
import {buildDossierRows} from '../../src/client/console/placementDossier';

/**
 * TURMOIL REDUX at the placement preview — PREVIEW ↔ COMMIT.
 *
 * The greenery revision pays 1 TR for the tile itself (`ParliamentHandler
 * .onGreeneryPlaced`), and the party effects the placing seat holds react to
 * the placement (the Greens' 2 M€ per TR step and their M€ production per
 * plant / heat production step, Mars First's steel per tile on Mars). The
 * dossier used to say +1 TR where the commit paid +2, «nothing» for a
 * greenery with oxygen maxed (it pays 1), and never named a party payout.
 * Every scenario drives the read-only preview AND the real placement on the
 * same cell and compares the numbers.
 */
describe('Turmoil Redux placement preview ↔ commit', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
  });

  function mine(preview: BoardPlacementPreview): ReadonlyArray<BoardFact> {
    return preview.immediateFacts;
  }

  function sum(facts: ReadonlyArray<BoardFact>, icon: string, production = false): number {
    return facts.filter((f) => f.delta?.icon === icon && (f.delta.production === true) === production && f.delta.direction === 'gain')
      .reduce((acc, f) => acc + (f.delta?.amount ?? 0), 0);
  }

  function quietCell(): Space {
    const space = game.board.getAvailableSpacesForGreenery(player).find((s) => s.bonus.length === 0 &&
      !game.board.getAdjacentSpaces(s).some((a) => a.tile?.tileType === TileType.OCEAN));
    if (space === undefined) {
      throw new Error('no quiet cell');
    }
    return space;
  }

  /** The real placement as the player's own action. */
  function place(space: Space): void {
    game.events.beginAction(player, {kind: 'system'}, {category: 'standard-project'});
    try {
      game.addGreenery(player, space);
    } finally {
      game.events.endScope();
    }
    runAllActions(game);
  }

  it('a greenery pays +1 TR for the tile on top of the oxygen step, and the ruling Greens pay 2 M€ per step — preview == commit', () => {
    setOxygenLevel(game, 3);
    expect(game.parliament!.rulingParty()).eq(PartyName.GREENS);
    const space = quietCell();
    const preview = boardCellPreview(player, space, 'greenery');
    expect(sum(mine(preview), 'tr')).eq(2);
    expect(sum(mine(preview), 'megacredits')).eq(4);
    // ONE TR row: 20 → 22, broken down by what moved it.
    const rows = buildDossierRows(mine(preview));
    const tr = rows.find((r) => r.delta?.icon === 'tr');
    expect(tr?.delta).deep.include({current: player.terraformRating, resulting: player.terraformRating + 2});
    expect(tr?.reasons.map((r) => `${String(r.label)} ${r.amount}`)).deep.eq(['Oxygen +1', 'Greenery tile +1']);
    const trBefore = player.terraformRating;
    const mcBefore = player.megaCredits;
    place(space);
    expect(player.terraformRating - trBefore).eq(2);
    expect(player.megaCredits - mcBefore).eq(4);
  });

  it('oxygen at its maximum: still +1 TR for the tile and +2 M€ — never an empty preview', () => {
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    const space = quietCell();
    const preview = boardCellPreview(player, space, 'greenery');
    expect(mine(preview).some((f) => f.delta?.icon === 'oxygen'), 'no oxygen step at the maximum').is.false;
    expect(sum(mine(preview), 'tr')).eq(1);
    expect(sum(mine(preview), 'megacredits')).eq(2);
    const trBefore = player.terraformRating;
    const mcBefore = player.megaCredits;
    place(space);
    expect(player.terraformRating - trBefore).eq(1);
    expect(player.megaCredits - mcBefore).eq(2);
  });

  it('the 8 % chain: the temperature step\'s TR and a heat-production bonus step are counted by the Greens too', () => {
    setOxygenLevel(game, 7);
    setTemperature(game, -22); // → -20: the second heat-production bonus step
    const space = quietCell();
    const preview = boardCellPreview(player, space, 'greenery');
    expect(sum(mine(preview), 'tr')).eq(3);
    expect(sum(mine(preview), 'megacredits')).eq(6);
    expect(sum(mine(preview), 'heat', true)).eq(1);
    expect(sum(mine(preview), 'megacredits', true), 'the Greens\' M€ production step').eq(1);
    const trBefore = player.terraformRating;
    const mcBefore = player.megaCredits;
    const mcProdBefore = player.production.megacredits;
    place(space);
    expect(player.terraformRating - trBefore).eq(3);
    expect(player.megaCredits - mcBefore).eq(6);
    expect(player.production.megacredits - mcProdBefore).eq(1);
  });

  it('the enacted Development Craze (a LIVE passive): the dossier states the cell\'s printed bonuses and its ocean adjacency TWICE, under the resolution\'s name — preview == commit', () => {
    const parliament = game.parliament!;
    seatEnacted(parliament, DEVELOPMENT_CRAZE_ID);
    setOxygenLevel(game, 3);
    const ocean = game.board.getAvailableSpacesForOcean(player)[0];
    game.addOcean(player, ocean);
    runAllActions(game);
    // A cell printing steel, next to that ocean: both bonus families are on the table.
    const space = game.board.getAvailableSpacesForGreenery(player).find((s) => s.bonus.includes(SpaceBonus.STEEL) &&
      game.board.getAdjacentSpaces(s).some((a) => a.id === ocean.id));
    const cell = space ?? game.board.getAvailableSpacesForGreenery(player).find((s) => s.bonus.includes(SpaceBonus.STEEL))!;
    const printedSteel = cell.bonus.filter((b) => b === SpaceBonus.STEEL).length;
    const oceanMc = game.board.oceanAdjacencyBonus(player, cell).megacredits;
    const preview = boardCellPreview(player, cell, 'greenery');
    const law = mine(preview).filter((f) => f.id.startsWith('redux-resolution-'));
    expect(law.length, 'one echo fact per repeated bonus pool').eq(oceanMc > 0 ? 2 : 1);
    expect(law.every((f) => f.title === 'Development Craze' && f.description === 'Enacted resolution: the placement bonuses are paid a second time')).is.true;
    // Steel: printed + echoed + the ruling Mars First's 1 — the preview's sum IS the commit's delta.
    expect(sum(mine(preview), 'steel')).eq(printedSteel * 2 + 1);
    expect(sum(mine(preview), 'megacredits')).eq(oceanMc * 2);
    const steel = player.steel;
    const mc = player.megaCredits;
    place(cell);
    expect(player.steel - steel).eq(printedSteel * 2 + 1);
    expect(player.megaCredits - mc).eq(oceanMc * 2);
    // Off Mars nothing is promised (the reserved areas print nothing to repeat either).
    const reserved = game.board.spaces.find((s) => s.spaceType === SpaceType.COLONY && s.tile === undefined)!;
    expect(boardCellPreview(player, reserved, 'city').immediateFacts.filter((f) => f.id.startsWith('redux-resolution-'))).deep.eq([]);
  });

  it('no Greens effect, no Greens payout: a Mars First government pays its steel per tile instead (a city draws a card too)', () => {
    const parliament = game.parliament!;
    seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
    setOxygenLevel(game, 3);
    const space = quietCell();
    const preview = boardCellPreview(player, space, 'greenery');
    expect(sum(mine(preview), 'megacredits')).eq(0);
    expect(sum(mine(preview), 'steel')).eq(1);
    const steel = player.steel;
    const mc = player.megaCredits;
    place(space);
    expect(player.steel - steel).eq(1);
    expect(player.megaCredits - mc).eq(0);
    const city = game.board.getAvailableSpacesForCity(player).find((s) => s.bonus.length === 0)!;
    const cityPreview = boardCellPreview(player, city, 'city');
    expect(sum(mine(cityPreview), 'steel')).eq(1);
    expect(sum(mine(cityPreview), 'cards')).eq(1);
  });

  it('a party effect held by two delegates counts like the ruling one (Mars First on a card in the vote)', () => {
    const parliament = game.parliament!;
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    parliament.placeVote(player, parliament.slots[1], 'lobby');
    parliament.placeVote(player, parliament.slots[1], 'reserve');
    expect(parliament.access(player, PartyName.MARS).byDelegates).is.true;
    setOxygenLevel(game, 3);
    const preview = boardCellPreview(player, quietCell(), 'greenery');
    expect(sum(mine(preview), 'steel')).eq(1);
    expect(sum(mine(preview), 'megacredits'), 'the Greens still rule').eq(4);
  });

  it('without the parliament nothing changes: +1 TR from the oxygen, no party rows, the greenery\'s own VP stays', () => {
    [game, player] = testGame(2);
    game.phase = Phase.ACTION;
    setOxygenLevel(game, 3);
    const space = quietCell();
    const preview = boardCellPreview(player, space, 'greenery');
    expect(sum(mine(preview), 'tr')).eq(1);
    expect(sum(mine(preview), 'megacredits')).eq(0);
    expect(preview.futureScoringFacts.some((f) => f.id === 'place-greenery-self')).is.true;
  });
});
