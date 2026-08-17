import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {BoardFact} from '../../src/common/boards/BoardInformationFacts';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Space} from '../../src/server/boards/Space';
import {ImmigrantCity} from '../../src/server/cards/base/ImmigrantCity';
import {CardName} from '../../src/common/cards/CardName';
import {buildDossierRows} from '../../src/client/console/placementDossier';

/**
 * THE INPUT THE CONSOLE PANEL HAS TO SURVIVE — from the real engine.
 *
 * A 4K game reported the placement panel printing FOUR lines and TWO
 * `47 → 48` change-vectors for ONE parameter: the City standard project's own
 * +1 M€ production and «Город иммигрантов»'s «when a city is placed» trigger.
 * Both readings were also wrong, because the commit lands on 49.
 *
 * This pins the two halves of the fix where each belongs: the ENGINE really
 * does emit two independent facts about the same pool with the same `current`
 * (it must — they are two different rules, and the panel is not the place to
 * merge game logic), and the console's pure row builder is what collapses
 * them into one honest vector with a breakdown.
 */
describe('placement preview: two effects on ONE parameter', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2);
  });

  function emptyLand(g: IGame): Space {
    const space = g.board.spaces.find((s) =>
      s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0);
    if (space === undefined) {
      throw new Error('no plain empty land space');
    }
    return space;
  }

  it('the engine states each rule on its own, and the console renders ONE vector', () => {
    // «Город иммигрантов» in the tableau: its trigger pays +1 M€ production
    // for ANY city placed, including one from the standard project.
    player.playedCards.push(new ImmigrantCity());
    player.production.override({megacredits: 47});

    // The placement is DRIVEN by the City standard project, whose own +1 M€
    // production is applied in its `commit(space)` and therefore only exists
    // in the preview as the card's `placementPreview` hook.
    const preview = boardCellPreview(player, emptyLand(game), 'city',
      {sourceCard: CardName.CITY_STANDARD_PROJECT});
    const mcProduction: ReadonlyArray<BoardFact> = preview.immediateFacts.filter((f) =>
      f.delta?.icon === 'megacredits' && f.delta?.production === true);

    // ① The engine keeps the two rules separate — and both read from the SAME
    //    starting value, which is exactly why the panel could print `47 → 48`
    //    twice and be wrong twice.
    expect(mcProduction.length, 'the two rules are two facts').to.be.greaterThanOrEqual(2);
    for (const fact of mcProduction) {
      expect(fact.delta?.current, 'every fact reads the live production').to.equal(47);
    }

    // ② The console collapses them into the number the commit will produce.
    const rows = buildDossierRows(preview.immediateFacts);
    const merged = rows.filter((r) => r.delta?.icon === 'megacredits' && r.delta?.production === true);
    expect(merged.length, 'ONE row for one parameter').to.equal(1);
    const total = mcProduction.reduce((acc, f) => acc + (f.delta?.amount ?? 0), 0);
    expect(merged[0].delta?.current).to.equal(47);
    expect(merged[0].delta?.resulting, 'the resulting value is the real one').to.equal(47 + total);
    // …and it still says WHERE it came from, one term per rule.
    expect(merged[0].reasons.length).to.equal(mcProduction.length);
  });
});
