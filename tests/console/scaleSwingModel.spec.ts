import {expect} from 'chai';
import {GameModel} from '../../src/common/models/GameModel';
import {ParameterSwingModel} from '../../src/common/models/ParameterSwingModel';
import {freshParameterSwings, swingPlanOf, swingTagOf} from '../../src/client/console/scaleSwing/scaleSwingModel';
import {HeldGlobalParams} from '../../src/client/console/planetFocus';

/**
 * «ОБРАТНЫЙ ХОД» — the pure half of a PARAMETER SWING's scene (Turmoil Redux
 * TR47 Ecological Experiment). The record is the SERVER's; the two views only
 * say what the player has already seen. Pinned on the four stands the e2e
 * fixtures arrange: the raise shown by the play and the fall by the removal
 * (two responses), the raise and the fall in ONE response (the diff reads
 * zero — the scene owns the raise and its rating), everything at its maximum
 * (named, nothing moves), and the cascade (an earlier response showed the
 * peak, the fall alone is the scene's).
 */
const seen = (temperature: number, oxygenLevel: number, oceans: number): HeldGlobalParams => ({temperature, oxygenLevel, oceans, venusScaleLevel: 0});
const live = (temperature: number, oxygenLevel: number, oceans: number): GameModel => ({temperature, oxygenLevel, oceans, venusScaleLevel: 0} as unknown as GameModel);

function record(over: Partial<ParameterSwingModel>): ParameterSwingModel {
  return {seq: 101, source: {card: 'Ecological Experiment'}, player: 'blue', up: [], down: [], rating: 22, ...over} as ParameterSwingModel;
}

const legKeys = (legs: ReadonlyArray<{kind: string, parameter: string}>) => legs.map((l) => `${l.kind}:${l.parameter}`);

describe('scaleSwingModel — the plan of a parameter swing', () => {
  it('a record is new once: by seq, oldest first; a first view or another seat\'s claims nothing', () => {
    const a = record({seq: 101});
    const b = record({seq: 102});
    expect(freshParameterSwings([a], [a, b], true).map((r) => r.seq)).deep.eq([102]);
    expect(freshParameterSwings(undefined, [b, a], true).map((r) => r.seq)).deep.eq([101, 102]);
    expect(freshParameterSwings([], [a], false), 'a reload replays nothing').deep.eq([]);
    expect(freshParameterSwings([a], undefined, true)).deep.eq([]);
  });

  it('TWO RESPONSES (the removal asked): the raise was shown by the play — the scene owns the fall alone, from the peak, in the record\'s order', () => {
    const r = record({
      up: [
        {parameter: 'temperature', before: -12, after: -10, tr: 1, claimed: []},
        {parameter: 'oxygen', before: 4, after: 5, tr: 1, claimed: []},
        {parameter: 'oceans', before: 3, after: 4, tr: 1, claimed: []},
      ],
      down: [
        {parameter: 'oceans', before: 4, after: 3},
        {parameter: 'temperature', before: -10, after: -12},
        {parameter: 'oxygen', before: 5, after: 4},
      ],
      removed: {space: '07', tile: 1},
    } as Partial<ParameterSwingModel>);
    const plan = swingPlanOf(r, seen(-10, 5, 4), live(-12, 4, 3), 'blue');
    expect(legKeys(plan.legs)).deep.eq(['down:oceans', 'down:temperature', 'down:oxygen']);
    expect(plan.start, 'the display stands on the peak until each leg\'s turn').deep.eq({oceans: 4, temperature: -10, oxygenLevel: 5});
    expect(plan.rating, 'the raise\'s rating was the play\'s — never flown twice').eq(0);
    expect(plan.removed).eq('07');
    expect(plan.own).is.true;
  });

  it('ONE RESPONSE (the oceans at their maximum — the diff reads zero): the scene raises, flies the rating, names the ocean, and lowers', () => {
    const r = record({
      up: [
        {parameter: 'temperature', before: -12, after: -10, tr: 1, claimed: []},
        {parameter: 'oxygen', before: 4, after: 5, tr: 1, claimed: []},
      ],
      down: [
        {parameter: 'oceans', atMax: true, at: 9},
        {parameter: 'temperature', before: -10, after: -12},
        {parameter: 'oxygen', before: 5, after: 4},
      ],
    } as Partial<ParameterSwingModel>);
    const own = swingPlanOf(r, seen(-12, 4, 9), live(-12, 4, 9), 'blue');
    expect(legKeys(own.legs)).deep.eq(['up:temperature', 'up:oxygen', 'max:oceans', 'down:temperature', 'down:oxygen']);
    expect(own.start, 'the display starts from what was seen and glides up from there').deep.eq({temperature: -12, oxygenLevel: 4});
    expect(own.rating, 'the two raises\' rating is the scene\'s to fly').eq(2);
    const rival = swingPlanOf(r, seen(-12, 4, 9), live(-12, 4, 9), 'red');
    expect(legKeys(rival.legs), 'every seat watches the same story').deep.eq(legKeys(own.legs));
    expect(rival.rating, 'a rival\'s rail owns no rating of the mover\'s').eq(0);
    expect(rival.own).is.false;
  });

  it('EVERYTHING AT ITS MAXIMUM: the raise is the ordinary diff\'s (the view ends on the peak), the fall names all three and moves nothing', () => {
    const r = record({
      up: [
        {parameter: 'temperature', before: 6, after: 8, tr: 1, claimed: []},
        {parameter: 'oxygen', before: 13, after: 14, tr: 1, claimed: []},
        {parameter: 'oceans', before: 8, after: 9, tr: 1, claimed: []},
      ],
      down: [
        {parameter: 'oceans', atMax: true, at: 9},
        {parameter: 'temperature', atMax: true, at: 8},
        {parameter: 'oxygen', atMax: true, at: 14},
      ],
    } as Partial<ParameterSwingModel>);
    const plan = swingPlanOf(r, seen(6, 13, 8), live(8, 14, 9), 'blue');
    expect(legKeys(plan.legs)).deep.eq(['max:oceans', 'max:temperature', 'max:oxygen']);
    expect(plan.start, 'nothing is held back — the diff glides the raise').deep.eq({});
    expect(plan.rating).eq(0);
  });

  it('a fall the applied view does not end on is not this record\'s to tell (a later response moved it again)', () => {
    const r = record({down: [{parameter: 'temperature', before: -10, after: -12}]} as Partial<ParameterSwingModel>);
    expect(swingPlanOf(r, seen(-10, 5, 4), live(-8, 5, 4), 'blue').legs).deep.eq([]);
  });

  it('the tags: the fall\'s amount, a limit named; a raise wears none', () => {
    const plan = swingPlanOf(record({
      up: [{parameter: 'temperature', before: -12, after: -10, tr: 1, claimed: []}],
      down: [{parameter: 'oceans', atMax: true, at: 9}, {parameter: 'temperature', before: -10, after: -12}, {parameter: 'oxygen', atMin: true, at: 0}],
    } as Partial<ParameterSwingModel>), seen(-12, 0, 9), live(-12, 0, 9), 'blue');
    expect(plan.legs.map((leg) => swingTagOf(leg))).deep.eq([
      undefined,
      {kind: 'max', amount: 0, unit: ''},
      {kind: 'down', amount: 2, unit: '°C'},
      {kind: 'min', amount: 0, unit: ''},
    ]);
  });
});
