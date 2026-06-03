import {expect} from 'chai';
import {testGame} from '../TestGame';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';

describe('placement illegal reasons', () => {
  it('attaches the M€ deficit to an unaffordable placement bonus, but not to rule-based reasons', () => {
    const [game, player] = testGame(2, {boardName: BoardName.HELLAS});
    player.megaCredits = 2;

    // Hellas' south-pole land space carries an OCEAN bonus that costs 6 M€.
    const bonusSpace = game.board.getSpaces(SpaceType.LAND)
      .find((s) => s.bonus.includes(SpaceBonus.OCEAN) && s.tile === undefined);
    // `expect.fail` returns `never`, so this both reports a clear failure AND
    // narrows `bonusSpace` to non-undefined below (no extra `return` needed).
    if (bonusSpace === undefined) {
      expect.fail('Hellas should have an ocean-bonus land space');
    }

    const legal = game.board.getAvailableSpacesForCity(player).filter((s) => s.id !== bonusSpace.id);
    const illegal = game.board.computeIllegalReasons(player, 'city', legal);

    // Hellas bakes the 6 M€ south-pole cost into the space's own placement
    // cost, so the block is `cannot-afford`; the deficit is the M€ gap.
    const bonusEntry = illegal.find((e) => e.spaceId === bonusSpace.id);
    expect(bonusEntry?.reason).eq('cannot-afford');
    expect(bonusEntry?.deficit).eq(4); // 6 (space cost) − spendable (2)

    // An ocean cell during a city placement reports the SPECIFIC "only an
    // ocean can go here" (not the generic wrong-terrain), with no deficit.
    const oceanCell = illegal.find((e) => e.reason === 'ocean-only');
    expect(oceanCell, 'expected an ocean-only entry').is.not.undefined;
    expect(oceanCell?.deficit).is.undefined;
  });

  it('distinguishes the two terrain cases (ocean-only vs needs-ocean-space)', () => {
    const [game, player] = testGame(2);

    // Placing a CITY: ocean cells say "only an ocean can go here".
    const cityIllegal = game.board.computeIllegalReasons(player, 'city', game.board.getAvailableSpacesForCity(player));
    expect(cityIllegal.some((e) => e.reason === 'ocean-only'), 'city on ocean → ocean-only').is.true;

    // Placing an OCEAN: land cells say "oceans only go on ocean spaces".
    const oceanIllegal = game.board.computeIllegalReasons(player, 'ocean', game.board.getAvailableSpacesForOcean(player));
    expect(oceanIllegal.some((e) => e.reason === 'needs-ocean-space'), 'ocean on land → needs-ocean-space').is.true;
  });
});
