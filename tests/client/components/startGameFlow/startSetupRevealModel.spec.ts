import {expect} from 'chai';
import {
  hasPaymentStage,
  nextStartSetupStage,
  readStartSetupEvent,
  shouldRevealStartSetup,
  stagedNumbersFor,
} from '@/client/components/startGameFlow/startSetupRevealModel';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {StartingSetupModel, StartingSetupSnapshot} from '@/common/models/StartingSetupModel';
import {CardName} from '@/common/cards/CardName';

const ZERO: StartingSetupSnapshot = {
  megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0,
  production: {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0},
  terraformRating: 20,
};

function snapshot(overrides: Partial<StartingSetupModel> = {}): StartingSetupModel {
  return {
    corporation: CardName.INTERPLANETARY_CINEMATICS,
    before: ZERO,
    cardsBought: 3,
    megacreditsPaid: 9,
    generation: 1,
    ...overrides,
  };
}

// Minimal view — only the fields readStartSetupEvent touches. `final` = the
// committed corp-applied numbers (M€ already net of payment).
function view(startingSetup: StartingSetupModel | undefined, final: {megacredits?: number, steel?: number, terraformRating?: number} = {}): PlayerViewModel {
  return {
    startingSetup,
    thisPlayer: {
      color: 'red',
      megacredits: final.megacredits ?? 21, steel: final.steel ?? 20, titanium: 0, plants: 0, energy: 0, heat: 0,
      megacreditProduction: 0, steelProduction: 0, titaniumProduction: 0, plantProduction: 0, energyProduction: 0, heatProduction: 0,
      terraformRating: final.terraformRating ?? 20,
    },
  } as unknown as PlayerViewModel;
}

describe('startSetupRevealModel', () => {
  it('readStartSetupEvent returns undefined without a snapshot / on a spectator', () => {
    expect(readStartSetupEvent(view(undefined))).is.undefined;
    expect(readStartSetupEvent({runId: 'x'} as unknown as ViewModel)).is.undefined;
    expect(readStartSetupEvent(undefined)).is.undefined;
  });

  it('readStartSetupEvent resolves the event from the snapshot + final numbers', () => {
    const event = readStartSetupEvent(view(snapshot()));
    expect(event).is.not.undefined;
    expect(event?.color).eq('red');
    expect(event?.dedupeKey).eq('red:1');
    expect(event?.final.megacredits).eq(21);
    expect(event?.final.steel).eq(20);
  });

  it('stagedNumbersFor: baseline = pre-corp, corp = bonus (payment reversed), done = final', () => {
    const event = readStartSetupEvent(view(snapshot(), {megacredits: 21, steel: 20}))!;
    const baseline = stagedNumbersFor(event, 'baseline');
    expect(baseline.megacredits).eq(0);
    expect(baseline.steel).eq(0);
    expect(baseline.terraformRating).eq(20);

    const corp = stagedNumbersFor(event, 'corp');
    // Corp bonus applied, payment NOT yet → M€ = final (21) + payment (9) = 30.
    expect(corp.megacredits).eq(30);
    expect(corp.steel).eq(20);

    const done = stagedNumbersFor(event, 'done');
    expect(done.megacredits).eq(21);
    expect(done.steel).eq(20);
  });

  it('hasPaymentStage is true only when cards were bought', () => {
    expect(hasPaymentStage(snapshot())).is.true;
    expect(hasPaymentStage(snapshot({cardsBought: 0, megacreditsPaid: 0}))).is.false;
  });

  it('nextStartSetupStage: baseline → corp (with payment) else done; corp → done', () => {
    const withPay = snapshot();
    expect(nextStartSetupStage('baseline', withPay)).eq('corp');
    expect(nextStartSetupStage('corp', withPay)).eq('done');

    const noPay = snapshot({cardsBought: 0, megacreditsPaid: 0});
    expect(nextStartSetupStage('baseline', noPay)).eq('done');
  });

  it('shouldRevealStartSetup dedups + requires a previous view', () => {
    const event = readStartSetupEvent(view(snapshot()))!;
    const empty = new Set<string>();
    expect(shouldRevealStartSetup(view(undefined), event, empty)).is.true;
    // No previous view (fresh reload) → do not reveal.
    expect(shouldRevealStartSetup(undefined, event, empty)).is.false;
    // Already seen → do not reveal.
    expect(shouldRevealStartSetup(view(undefined), event, new Set([event.dedupeKey]))).is.false;
    // No event → false.
    expect(shouldRevealStartSetup(view(undefined), undefined, empty)).is.false;
  });
});
