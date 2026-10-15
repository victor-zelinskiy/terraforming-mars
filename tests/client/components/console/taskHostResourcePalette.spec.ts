import {expect} from 'chai';
import ConsoleTaskHost from '@/client/components/console/ConsoleTaskHost.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

/*
 * THE LIVE «WHICH STANDARD RESOURCE» PROMPT AS A PALETTE (TR54, H4). The task host drew `SelectResource` as six bare
 * icons — no number, no `current → resulting`. It is the variant grammar's palette now: each tile the resource's hero,
 * the number the SERVER states (`SelectResourceModel.amount`) and the viewer's own pool `current → current + amount`;
 * a prompt that states no number keeps the hero alone (never a guessed «+1»). The computeds run against a stub `this`.
 */
type Computeds = Record<string, (this: unknown) => unknown>;
const host = (ConsoleTaskHost as unknown as {computed: Computeds}).computed;

const VIEW = {
  thisPlayer: {color: 'blue', megacredits: 12, steel: 3, titanium: 0, plants: 5, energy: 2, heat: 7},
  players: [],
} as unknown as PlayerViewModel;

function ctx(wf: PlayerInputModel, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const self: Record<string, unknown> = {
    playerView: VIEW,
    wf,
    focusIdx: 1,
    armed: false,
    ...extra,
  };
  for (const name of ['resourceUnits', 'resourceGainAmount', 'resourceReadings', 'resourcePaletteOptions']) {
    Object.defineProperty(self, name, {get: () => host[name].call(self), configurable: true});
  }
  return self;
}

const prompt = (amount?: number) => ({
  type: 'resource', title: 'Gain 3 units of a standard resource', buttonLabel: 'Select',
  include: ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'], ...(amount !== undefined ? {amount} : {}),
} as unknown as PlayerInputModel);

describe('ConsoleTaskHost — the live resource prompt is a PALETTE', () => {
  it('every tile a hero with the server\'s number, the reading the viewer\'s own pool', () => {
    const self = ctx(prompt(3));
    const options = self.resourcePaletteOptions as Array<{hero: {icon: string, amount?: number}, title: string, state: {focused: boolean}}>;
    expect(options.map((o) => [o.hero.icon, o.hero.amount])).deep.eq([
      ['megacredits', 3], ['steel', 3], ['titanium', 3], ['plants', 3], ['energy', 3], ['heat', 3],
    ]);
    expect(options.every((o) => o.title === ''), 'the hero and the number speak; no words').is.true;
    expect(options.map((o) => o.state.focused)).deep.eq([false, true, false, false, false, false]);
    const readings = self.resourceReadings as Array<{current: number, resulting: number}>;
    expect(readings.map((r) => [r.current, r.resulting])).deep.eq([[12, 15], [3, 6], [0, 3], [5, 8], [2, 5], [7, 10]]);
  });

  it('a prompt that states no number keeps the hero alone — no figure, no reading, never a guess', () => {
    const self = ctx(prompt());
    const options = self.resourcePaletteOptions as Array<{hero: {amount?: number}}>;
    expect(options.every((o) => o.hero.amount === undefined)).is.true;
    expect((self.resourceReadings as Array<unknown>).every((r) => r === undefined)).is.true;
  });

  it('the ARMED tile wears the seal (the host\'s own select → confirm)', () => {
    const options = ctx(prompt(1), {focusIdx: 3, armed: true}).resourcePaletteOptions as Array<{state: {selected: boolean}}>;
    expect(options.map((o) => o.state.selected)).deep.eq([false, false, false, true, false, false]);
  });
});
