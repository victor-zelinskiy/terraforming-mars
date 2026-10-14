import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Phase} from '../../src/common/Phase';
import {TileType} from '../../src/common/TileType';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {CardName} from '../../src/common/cards/CardName';
import {SpaceId} from '../../src/common/Types';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, MIN_TEMPERATURE} from '../../src/common/constants';
import {NO_REMOVABLE_OCEAN_REASON} from '../../src/common/parliament/tileRemoval';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {
  oceanRemovalPrompt, REMOVE_OCEAN_COMMITTED_REASON, REMOVE_OCEAN_TITLE, RemoveOceanTile, SKIPPED_OCEAN_REMOVAL_LABEL,
} from '../../src/server/deferredActions/RemoveOceanTile';
import {recordParameterSwing, snapshotParameters, upLegs} from '../../src/server/cards/parameterSwing';
import {parameterSwingTail, STAYS_AT_MAXIMUM_NOTE, THEN_PHASE, REMOVE_ANY_OCEAN_NOTE, OCEAN_REMOVAL_NEXT_STEP} from '../../src/server/cards/actionPreviews';
import {Capital} from '../../src/server/cards/base/Capital';
import {cast} from '../../src/common/utils/utils';
import {addOcean, fakeCard, formatMessage, maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';

/**
 * «UP AND BACK» — THE CLASS (Turmoil Redux TR47 Ecological Experiment): a card
 * raises the Mars parameters and lowers what is not at its maximum. Pinned
 * here at the engine, card-free:
 *  · `Game.lowerParameters` — the ONE lowering function: at the maximum a
 *    parameter STAYS and is named; the floor is named; otherwise one step
 *    through the engine's negative branch with THE PLAYER as the author —
 *    no rating taken, no threshold re-armed, a journal line with before → after;
 *  · `RemoveOceanTile` — the family's ONE removal step, now honest: the
 *    markers RX33 wrote, the per-cell reasons, the committed context naming
 *    who asks, a NAMED skip when nothing can be removed, the engine's own
 *    removal (the ocean under a TR44 city included) in its answer;
 *  · the swing's RECORD — the ring, its `seq` law, the raise's legs measured
 *    between two snapshots (`upLegs`), the one writer;
 *  · the composer's TAIL (`parameterSwingTail`) — read from the PEAK the raise
 *    reaches, the thresholds walked, every «at maximum» named, the oceans'
 *    board step named.
 */
function table(): [IGame, TestPlayer, TestPlayer] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2];
}

const loweringEvents = (game: IGame, parameter: GlobalParameter) =>
  game.events.serialize().events.filter((e) => e.type === 'global-parameter-changed' &&
    e.impact.globalParameter?.parameter === parameter && (e.impact.globalParameter?.steps ?? 0) < 0);
const skips = (game: IGame) => game.events.serialize().events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
const logs = (game: IGame) => game.gameLog.map((m) => formatMessage(m));

describe('ParameterSwing — the class «up and back»', () => {
  describe('Game.lowerParameters — the ONE lowering function', () => {
    it('lowers temperature and oxygen one step each, with THE PLAYER as the author, the TR untouched, before → after in the journal', () => {
      const [game, p1] = table();
      setTemperature(game, -10);
      setOxygenLevel(game, 5);
      p1.setTerraformRating(23);
      const down = game.lowerParameters(p1, ['temperature', 'oxygen']);
      expect(down).deep.eq([
        {parameter: 'temperature', before: -10, after: -12},
        {parameter: 'oxygen', before: 5, after: 4},
      ]);
      expect(game.getTemperature()).eq(-12);
      expect(game.getOxygenLevel()).eq(4);
      expect(p1.terraformRating, 'nothing is taken back').eq(23);
      const temperature = loweringEvents(game, GlobalParameter.TEMPERATURE);
      const oxygen = loweringEvents(game, GlobalParameter.OXYGEN);
      expect(temperature, 'one lowering of the temperature, with its sign').has.length(1);
      expect(temperature[0].impact.globalParameter?.steps).eq(-1);
      expect(temperature[0].player, 'the CARD\'s player lowered it — never «nobody»').eq(p1.color);
      expect(oxygen).has.length(1);
      expect(oxygen[0].player).eq(p1.color);
      expect(logs(game).some((l) => /lowered .*1 step.*-10 → -12.*the TR stays/.test(l)), logs(game).slice(-3).join('|')).is.true;
      expect(skips(game), 'nothing skipped').deep.eq([]);
    });

    it('a parameter AT ITS MAXIMUM stays and is NAMED — the card\'s clause, checked first; the engine\'s silent return is never leaned on', () => {
      const [game, p1] = table();
      setTemperature(game, MAX_TEMPERATURE);
      setOxygenLevel(game, MAX_OXYGEN_LEVEL);
      const down = game.lowerParameters(p1, ['temperature', 'oxygen']);
      expect(down).deep.eq([
        {parameter: 'temperature', atMax: true, at: MAX_TEMPERATURE},
        {parameter: 'oxygen', atMax: true, at: MAX_OXYGEN_LEVEL},
      ]);
      expect(game.getTemperature()).eq(MAX_TEMPERATURE);
      expect(game.getOxygenLevel()).eq(MAX_OXYGEN_LEVEL);
      expect(skips(game).map((s) => s?.reason)).deep.eq(['Temperature is at its maximum — not lowered', 'Oxygen is at its maximum — not lowered']);
      expect(skips(game).map((s) => s?.label)).deep.eq(['Lower the temperature 1 step', 'Lower the oxygen level 1 step']);
      expect(loweringEvents(game, GlobalParameter.TEMPERATURE), 'no lowering event').deep.eq([]);
    });

    it('the FLOOR is named too (temperature at −30 cannot fall)', () => {
      const [game, p1] = table();
      setTemperature(game, MIN_TEMPERATURE);
      const down = game.lowerParameters(p1, ['temperature']);
      expect(down).deep.eq([{parameter: 'temperature', atMin: true, at: MIN_TEMPERATURE}]);
      expect(skips(game).map((s) => s?.reason)).deep.eq(['Temperature is already at its minimum']);
    });

    it('a threshold the raise claimed STANDS through the fall (the claims are the engine\'s, claimed once), and the heat production stays', () => {
      const [game, p1] = table();
      setTemperature(game, -26);
      const heat = p1.production.heat;
      game.increaseTemperature(p1, 1); // −24: the heat production threshold, claimed by p1
      expect(game.scaleBonusClaims.get('temperature--24')).eq(p1.color);
      const paid = p1.production.heat;
      expect(paid, 'the threshold paid a heat production step (the ruling party may add its own)').is.greaterThan(heat);
      const tr = p1.terraformRating;
      game.lowerParameters(p1, ['temperature']);
      expect(game.getTemperature()).eq(-26);
      expect(game.scaleBonusClaims.get('temperature--24'), 'the claim stands below the threshold').eq(p1.color);
      expect(p1.production.heat, 'the production stays').eq(paid);
      expect(p1.terraformRating).eq(tr);
      // …and a raise back through it claims nothing again (the engine claims each threshold once).
      const claimLines = () => logs(game).filter((l) => /claimed the .* scale bonus/.test(l)).length;
      const claimed = claimLines();
      game.increaseTemperature(p1, 1);
      expect(game.scaleBonusClaims.get('temperature--24')).eq(p1.color);
      expect(claimLines(), 'no second claim').eq(claimed);
    });
  });

  describe('RemoveOceanTile — the family\'s ONE removal step', () => {
    it('the prompt carries the RX33 markers, every plain ocean (anybody\'s), the per-cell reason, the committed context naming the asker', () => {
      const [game, p1, p2] = table();
      const mine = addOcean(p1);
      const theirs = addOcean(p2);
      const source = {kind: 'card' as const, card: CardName.ECOLOGICAL_EXPERIMENT};
      game.defer(new RemoveOceanTile(p1, {source, reason: 'The experiment lowers the planet again.'}));
      runAllActions(game);
      const prompt = cast(p1.popWaitingFor(), SelectSpace);
      expect(prompt.placementEffect).eq('remove');
      expect(prompt.placementType).eq('ocean-removal');
      expect(prompt.tileType).eq(TileType.OCEAN);
      expect(prompt.sourceCard, 'no staged-cell address on a removal — a parked staged tail can never land on it').is.undefined;
      expect(prompt.placementContext).deep.eq({cancellable: false, reason: 'The experiment lowers the planet again.', source});
      expect(prompt.title).eq(REMOVE_OCEAN_TITLE);
      expect(prompt.spaces.map((s) => s.id).sort()).deep.eq([mine.id, theirs.id].sort());
      const land = prompt.illegalSpaces?.find((s) => game.board.getSpaceOrThrow(s.spaceId).spaceType === 'land');
      expect(land?.reason, 'a land cell says what it lacks').eq('requires-ocean-tile');
    });

    it('the default title and reason stand for a caller that names none; a string is the legacy title (the Reds\' action, Dry Deserts)', () => {
      const [game, p1] = table();
      addOcean(p1);
      game.defer(new RemoveOceanTile(p1, 'Turmoil Reds action - Remove an Ocean tile from the board'));
      runAllActions(game);
      const prompt = cast(p1.popWaitingFor(), SelectSpace);
      expect(prompt.title).eq('Turmoil Reds action - Remove an Ocean tile from the board');
      expect(prompt.placementContext).deep.eq({cancellable: false, reason: REMOVE_OCEAN_COMMITTED_REASON, source: undefined});
      expect(prompt.placementEffect).eq('remove');
    });

    it('the answer removes through the engine (the `tile-removed` event with the actor), and the caller\'s andThen gets the cell', () => {
      const [game, p1] = table();
      const ocean = addOcean(p1);
      const seen: Array<string | undefined> = [];
      game.defer(new RemoveOceanTile(p1)).andThen((space) => {
        seen.push(space?.id);
      });
      runAllActions(game);
      cast(p1.popWaitingFor(), SelectSpace).process({type: 'space', spaceId: ocean.id});
      runAllActions(game);
      expect(seen).deep.eq([ocean.id]);
      expect(ocean.tile).is.undefined;
      const removed = game.events.serialize().events.filter((e) => e.type === 'tile-removed');
      expect(removed).has.length(1);
      expect(removed[0].player).eq(p1.color);
      expect(logs(game).some((l) => /removed/.test(l))).is.true;
    });

    it('NOTHING TO REMOVE is a NAMED skip, never a silent undefined — and the chain still continues', () => {
      const [game, p1] = table();
      const seen: Array<string | undefined> = [];
      game.defer(new RemoveOceanTile(p1)).andThen((space) => {
        seen.push(space?.id);
      });
      runAllActions(game);
      expect(p1.getWaitingFor(), 'no prompt').is.undefined;
      expect(seen, 'the caller hears the empty answer').deep.eq([undefined]);
      expect(skips(game)).deep.eq([{label: SKIPPED_OCEAN_REMOVAL_LABEL, reason: NO_REMOVABLE_OCEAN_REASON, effect: {direction: 'cost', icon: 'oceans', amount: 1}}]);
    });

    it('the ocean UNDER a TR44 city is offered, and only the water leaves (the city, its owner stay)', () => {
      const [game, p1, p2] = table();
      const ocean = addOcean(p2);
      game.addTile(p1, ocean, {tileType: TileType.CITY}, {overOcean: true});
      runAllActions(game);
      game.defer(new RemoveOceanTile(p1));
      runAllActions(game);
      const prompt = cast(p1.popWaitingFor(), SelectSpace);
      expect(prompt.spaces.map((s) => s.id)).deep.eq([ocean.id]);
      prompt.process({type: 'space', spaceId: ocean.id});
      runAllActions(game);
      expect(ocean.tile?.tileType).eq(TileType.CITY);
      expect(ocean.tile?.covers).is.undefined;
      expect(ocean.player).eq(p1);
      expect(game.board.getOceanSpaces()).has.length(0);
    });

    it('`oceanRemovalPrompt` reports the counts around the engine\'s removal (the resolution step\'s own record)', () => {
      const [, p1] = table();
      const a = addOcean(p1);
      addOcean(p1);
      const counts: Array<{before: number, after: number}> = [];
      const prompt = oceanRemovalPrompt(p1, {onRemoved: (_space, c) => counts.push(c)});
      prompt.process({type: 'space', spaceId: a.id});
      expect(counts).deep.eq([{before: 2, after: 1}]);
    });
  });

  describe('the swing\'s RECORD', () => {
    it('`upLegs` measures the raise between two snapshots: before → peak per moved parameter, the rating per step, the claims it made', () => {
      const [game, p1] = table();
      setTemperature(game, -26);
      setOxygenLevel(game, 7);
      const before = snapshotParameters(game, p1);
      game.increaseTemperature(p1, 1); // −24: claims the heat threshold
      game.increaseOxygenLevel(p1, 1); // 8 %: +1 temperature (−22)
      addOcean(p1);
      const peak = snapshotParameters(game, p1);
      expect(upLegs(before, peak)).deep.eq([
        {parameter: 'temperature', before: -26, after: -22, tr: 2, claimed: ['temperature--24']},
        {parameter: 'oxygen', before: 7, after: 8, tr: 1, claimed: ['oxygen-8']},
        {parameter: 'oceans', before: 0, after: 1, tr: 1, claimed: []},
      ]);
      expect(upLegs(before, before), 'nothing moved — no legs').deep.eq([]);
      expect(upLegs(before, peak, false).map((l) => l.tr), 'a raise nobody was credited for pays no rating').deep.eq([0, 0, 0]);
    });

    it('the ring: one writer, the `seq` law (gameAge-based, monotonic), bounded, exported to the model only when something stands', () => {
      const [game, p1] = table();
      const card = fakeCard({name: CardName.ECOLOGICAL_EXPERIMENT});
      expect(game.parameterSwings).deep.eq([]);
      recordParameterSwing(p1, card, {up: [], down: [{parameter: 'oceans', atMax: true, at: 9}]});
      expect(game.parameterSwings).has.length(1);
      const first = game.parameterSwings[0];
      expect(first).deep.include({source: {card: CardName.ECOLOGICAL_EXPERIMENT}, player: p1.color, rating: p1.terraformRating});
      expect(first.seq).eq(game.gameAge * 100);
      for (let i = 0; i < 7; i++) {
        recordParameterSwing(p1, card, {up: [], down: []});
      }
      const seqs = game.parameterSwings.map((s) => s.seq);
      expect([...seqs].sort((a, b) => a - b), 'monotonic').deep.eq(seqs);
      expect(new Set(seqs).size, 'unique').eq(seqs.length);
      for (let i = 0; i < 3; i++) {
        recordParameterSwing(p1, card, {up: [], down: []});
      }
      expect(game.parameterSwings, 'bounded').has.length(8);
      const reloaded = Game.deserialize(structuredClone(game.serialize()));
      expect(reloaded.parameterSwings, 'never serialized').deep.eq([]);
    });

    it('a removal names the cell and the tile', () => {
      const [game, p1] = table();
      const ocean = addOcean(p1);
      recordParameterSwing(p1, fakeCard({name: CardName.ECOLOGICAL_EXPERIMENT}), {up: [], down: [{parameter: 'oceans', before: 1, after: 0}], removed: ocean});
      expect(game.parameterSwings[0].removed).deep.eq({space: ocean.id, tile: TileType.OCEAN});
    });
  });

  describe('parameterSwingTail — the composer\'s reading of the fall', () => {
    it('below the maximum: three «−1» chips read from the PEAK, the first opening the «THEN» phase, the oceans with their board step', () => {
      const [game, p1] = table();
      setTemperature(game, -12);
      setOxygenLevel(game, 4);
      addOcean(p1);
      addOcean(p1);
      addOcean(p1);
      const tail = parameterSwingTail(p1, {temperature: 1, oxygen: 1, oceans: 1});
      expect(tail.peak).deep.eq({temperature: -10, oxygenLevel: 5, oceans: 4});
      expect(tail.rating).eq(3);
      expect(tail.effects).deep.eq([
        {direction: 'cost', icon: 'oxygen', amount: 1, current: 5, resulting: 4, unit: '%', phase: THEN_PHASE},
        {direction: 'cost', icon: 'temperature', amount: 2, current: -10, resulting: -12, unit: '°C'},
        {direction: 'cost', icon: 'oceans', amount: 1, current: 4, resulting: 3, note: REMOVE_ANY_OCEAN_NOTE},
      ]);
      expect(tail.steps).deep.eq([{kind: 'note', noteKind: 'board', text: OCEAN_REMOVAL_NEXT_STEP}]);
    });

    it('at the maximum after the raise: the chip rests (current = resulting) and says «stays at maximum»; no board step', () => {
      const [game, p1] = table();
      setTemperature(game, 6);
      setOxygenLevel(game, 13);
      maxOutOceans(p1, 8);
      const tail = parameterSwingTail(p1, {temperature: 1, oxygen: 1, oceans: 1});
      expect(tail.peak).deep.eq({temperature: 8, oxygenLevel: 14, oceans: 9});
      expect(tail.rating).eq(3);
      expect(tail.effects.map((e) => `${e.icon}:${e.current}→${e.resulting}:${e.note ?? ''}`)).deep.eq([
        `oxygen:14→14:${STAYS_AT_MAXIMUM_NOTE}`, `temperature:8→8:${STAYS_AT_MAXIMUM_NOTE}`, `oceans:9→9:${STAYS_AT_MAXIMUM_NOTE}`,
      ]);
      expect(tail.steps).deep.eq([]);
    });

    it('the CASCADE is walked: 0 °C places a bonus ocean, 8 % oxygen raises the temperature a step — the fall reads the peak after both', () => {
      const [game, p1] = table();
      setTemperature(game, -2);
      setOxygenLevel(game, 7);
      maxOutOceans(p1, 5);
      const tail = parameterSwingTail(p1, {temperature: 1, oxygen: 1, oceans: 1});
      expect(tail.peak, 'temperature −2 → 0 (bonus ocean) → +2 (the 8 % step); oceans 5 + bonus + the card\'s').deep.eq({temperature: 2, oxygenLevel: 8, oceans: 7});
      expect(tail.rating, 'two temperature steps, one oxygen, two oceans').eq(5);
      expect(tail.effects.map((e) => `${e.icon}:${e.current}→${e.resulting}`)).deep.eq(['oxygen:8→7', 'temperature:2→0', 'oceans:7→6']);
    });

    it('a parameter already at its maximum before the play neither rises nor falls — and the raise pays no rating for it', () => {
      const [game, p1] = table();
      setTemperature(game, MAX_TEMPERATURE);
      setOxygenLevel(game, 0);
      const tail = parameterSwingTail(p1, {temperature: 1, oxygen: 1, oceans: 1});
      expect(tail.peak.temperature).eq(MAX_TEMPERATURE);
      expect(tail.rating, 'oxygen and the ocean only').eq(2);
      expect(tail.effects[1]).deep.include({icon: 'temperature', current: MAX_TEMPERATURE, resulting: MAX_TEMPERATURE, note: STAYS_AT_MAXIMUM_NOTE});
    });
  });

  it('a Capital beside the removed ocean is a point poorer — a fact on the removal\'s event (PL-041), never a mutation', () => {
    const [game, p1, p2] = table();
    const reserve = game.board.getAvailableSpacesForOcean(p1)[0];
    const beside = game.board.getAdjacentSpaces(reserve).find((s) => s.spaceType === 'land' && s.tile === undefined)!;
    game.addTile(p2, beside, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
    p2.playedCards.push(new Capital());
    addOcean(p1, reserve.id as SpaceId);
    game.defer(new RemoveOceanTile(p1));
    runAllActions(game);
    cast(p1.popWaitingFor(), SelectSpace).process({type: 'space', spaceId: reserve.id});
    runAllActions(game);
    const removed = game.events.serialize().events.find((e) => e.type === 'tile-removed');
    expect(removed?.impact.adjacencyVp?.map((c) => `${c.player}:${c.before}→${c.after}`)).deep.eq([`${p2.color}:1→0`]);
  });
});
