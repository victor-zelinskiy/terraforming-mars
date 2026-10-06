import {expect} from 'chai';
import {EffectForecast, EffectForecastFact} from '@/common/models/EffectForecastModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {effectForecastOpen, openEffectForecastLayer, resetEffectForecastUi} from '@/client/console/consoleEffectForecast';
import {foldForecastHost, forecastHostIntent, forecastOwnerColors} from '@/client/console/consoleForecastHost';

/**
 * PL-066: the phrase every STAGE that opens the R3 «Эффекты» layer speaks (the dock's, the colony's) — ONE module, so
 * a third host cannot drift from the first two: whose stats the layer asks for, what B / R3 do while it stands, and
 * that a fold is instant.
 */
const fact = (source: EffectForecastFact['source']): EffectForecastFact => ({
  id: source.name + '|' + source.kind, source, certainty: 'exact', recipient: {kind: 'you'}, timing: 'immediate',
  effects: [{direction: 'gain', icon: 'megacredits', amount: 2}], reason: 'r',
} as unknown as EffectForecastFact);
const forecastOf = (facts: ReadonlyArray<EffectForecastFact>, byBranch?: EffectForecast['byBranch']): EffectForecast =>
  ({facts, byBranch, discounts: {base: 0, final: 0, items: [], other: 0}, paymentValues: [], coverage: 'complete'});
const press = (button: string): GamepadIntent => ({kind: 'press', button} as unknown as GamepadIntent);

describe('consoleForecastHost — the stages\' shared phrase of the R3 «Эффекты» layer', () => {
  afterEach(() => {
    resetEffectForecastUi();
  });

  it('forecastOwnerColors: the seats whose CARDS react — a party, a resolution, the bot\'s corporation and a bot\'s card ask no stats; branch-tied facts count', () => {
    const forecast = forecastOf([
      fact({kind: 'card', name: 'Meat Industry', owner: 'blue', channel: 'resource-added'} as EffectForecastFact['source']),
      fact({kind: 'party', name: 'Greens', owner: 'blue', channel: 'tr-increase'} as EffectForecastFact['source']),
      fact({kind: 'resolution', name: 'RDX_X', owner: 'blue', channel: 'tr-increase'} as EffectForecastFact['source']),
      fact({kind: 'card', name: 'Poseidon', owner: 'red', channel: 'colony-added'} as EffectForecastFact['source']),
      fact({kind: 'card', name: 'Bot card', owner: 'green', channel: 'colony-added'} as EffectForecastFact['source']),
    ], {0: [fact({kind: 'card', name: 'Manutech', owner: 'yellow', channel: 'production-gain'} as EffectForecastFact['source'])]});
    const players = [{color: 'blue'}, {color: 'red'}, {color: 'green', isMarsBot: true}, {color: 'yellow'}];
    expect(forecastOwnerColors(forecast, players)).deep.eq(['blue', 'red', 'yellow']);
    expect(forecastOwnerColors(undefined, players)).deep.eq([]);
  });

  it('forecastHostIntent: R3 closes the layer whole; B folds the explorer\'s dossier first and closes only when it had nothing to fold; the rest is the explorer\'s', () => {
    const calls: Array<string> = [];
    const layer = (back: boolean) => ({
      consumeBack: () => {
        calls.push('back');
        return back;
      },
      handleIntent: (intent: GamepadIntent) => {
        calls.push('intent:' + intent.kind);
      },
    });
    openEffectForecastLayer('colony');
    forecastHostIntent('colony', press('back'), layer(true));
    expect(effectForecastOpen('colony'), 'the dossier folded, the layer stands').is.true;
    forecastHostIntent('colony', press('back'), layer(false));
    expect(effectForecastOpen('colony'), 'nothing left to fold — the layer closes').is.false;
    openEffectForecastLayer('colony');
    forecastHostIntent('colony', {kind: 'nav', dir: 'down'} as unknown as GamepadIntent, layer(false));
    expect(calls.at(-1)).eq('intent:nav');
    forecastHostIntent('colony', press('stickR'), layer(true));
    expect(effectForecastOpen('colony'), 'R3 closes it whole, the dossier notwithstanding').is.false;
    expect(calls.filter((c) => c === 'back')).has.lengthOf(2);
  });

  it('foldForecastHost: an open layer folds instantly, a closed one is left alone, another host\'s is never touched', () => {
    openEffectForecastLayer('dock');
    foldForecastHost('colony');
    expect(effectForecastOpen('dock'), 'the dock\'s layer is not the colony\'s').is.true;
    foldForecastHost('dock');
    expect(effectForecastOpen('dock')).is.false;
    foldForecastHost('dock');
    expect(effectForecastOpen()).is.false;
  });
});
