import {expect} from 'chai';
import {nextTick} from 'vue';
import {contributionChips, deckLine, deckMeterView} from '@/client/console/menu/deckCompositionModel';
import {
  deckCompositionKey,
  deckCompositionState,
  resetDeckCompositionState,
  setDeckCompositionFetcher,
  trackDeckComposition,
} from '@/client/console/menu/deckCompositionState';
import {DECK_COMPOSITION_EXPANSIONS, DeckCompositionModel} from '@/common/models/DeckCompositionModel';
import {PREMIUM_EXPANSIONS} from '@/client/components/create/premium/createGameMeta';
import {createGameState, resetCreateGameState} from '@/client/components/create/premium/createGameState';
import {buildCreateGamePayloadFromPremiumState} from '@/client/components/create/premium/buildCreateGamePayload';
import {NewGameConfig} from '@/common/game/NewGameConfig';
import {expansionRows, toggleExpansion} from '@/client/console/menu/consoleCreateModel';

/** A composition as the server answers it — the numbers are the server's, the model only reads them. */
function composition(over: Partial<DeckCompositionModel> = {}): DeckCompositionModel {
  return {
    projects: {total: 200, byType: {automated: 120, active: 50, event: 30}, byModule: {base: 140, corpera: 60}},
    corporations: {total: 12, byModule: {base: 2, corpera: 10}},
    preludes: {total: 0, byModule: {}},
    extras: {},
    contributions: {
      prelude: {projects: 0, corporations: 0, preludes: 35, colonies: 0, resolutions: 0, classic: 0},
      ares: {projects: 0, corporations: 0, preludes: 0, colonies: 0, resolutions: 0, classic: 0},
      turmoilRedux: {projects: 71, corporations: 0, preludes: 0, colonies: 2, resolutions: 42, classic: 1},
    },
    ...over,
  };
}

describe('deckCompositionModel — the deck meter reads the server\'s count', () => {
  it('three totals in the deck order; the projects by colour in the FIXED order green · blue · red, shares of the deck', () => {
    const view = deckMeterView(composition());
    expect(view.tiles.map((t) => [t.id, t.total])).deep.eq([['projects', 200], ['corporations', 12], ['preludes', 0]]);
    expect(view.segments.map((s) => s.kind)).deep.eq(['automated', 'active', 'event']);
    expect(view.segments.map((s) => s.count)).deep.eq([120, 50, 30]);
    expect(view.segments.reduce((sum, s) => sum + s.share, 0)).closeTo(1, 1e-9);
    // Never re-ordered by size: a deck with more events keeps the order.
    const events = deckMeterView(composition({projects: {total: 10, byType: {automated: 1, active: 2, event: 7}, byModule: {}}}));
    expect(events.segments.map((s) => s.kind)).deep.eq(['automated', 'active', 'event']);
  });

  it('an empty project deck shares nothing (no NaN)', () => {
    const view = deckMeterView(composition({projects: {total: 0, byType: {automated: 0, active: 0, event: 0}, byModule: {}}}));
    expect(view.segments.every((s) => s.share === 0)).is.true;
  });

  it('«also in the party» — each extra only with the expansion that brings it', () => {
    expect(deckMeterView(composition()).extras).deep.eq([]);
    const extras = deckMeterView(composition({extras: {colonies: {inPlay: 5, pool: 13}, resolutions: 42}})).extras;
    expect(extras.map((e) => [e.id, e.params])).deep.eq([['colonies', ['5', '13']], ['resolutions', ['42']]]);
  });

  it('an expansion\'s chips: the server\'s contribution, in the deck order, a zero never printed', () => {
    const redux = contributionChips(composition(), 'turmoilRedux');
    expect(redux.map((c) => [c.id, c.amount])).deep.eq([['projects', 71], ['resolutions', 42], ['colonies', 2], ['classic', 1]]);
    expect(contributionChips(composition(), 'prelude').map((c) => c.id)).deep.eq(['preludes']);
    expect(contributionChips(composition(), 'ares'), 'an expansion that adds no cards prints no «+0»').deep.eq([]);
    expect(contributionChips(undefined, 'turmoilRedux'), 'no answer yet — no chips').deep.eq([]);
    expect(contributionChips(composition(), 'venus'), 'a toggle the server did not price').deep.eq([]);
  });

  it('the launch plate\'s line leaves out an empty deck', () => {
    expect(deckLine(composition()).map((p) => [p.id, p.amount])).deep.eq([['projects', 200], ['corporations', 12]]);
  });

  it('the creator\'s toggles are exactly the expansions the server prices', () => {
    expect(PREMIUM_EXPANSIONS.map((e) => e.id)).deep.eq([...DECK_COMPOSITION_EXPANSIONS]);
  });
});

describe('expansionRows — the plate names what it requires', () => {
  beforeEach(() => {
    resetCreateGameState();
  });

  it('Turmoil Redux requires Colonies: met while Colonies is on, not met otherwise; nobody else requires anything', () => {
    createGameState.config.selectedExpansions.colonies = true;
    const redux = () => expansionRows().find((r) => r.meta.id === 'turmoilRedux')!;
    expect(redux().requires).deep.eq([{id: 'colonies', labelKey: 'Colonies', met: true}]);
    toggleExpansion('colonies');
    expect(redux().requires[0].met).is.false;
    expect(expansionRows().filter((r) => r.meta.id !== 'turmoilRedux').every((r) => r.requires.length === 0)).is.true;
  });
});

describe('deckCompositionState — asked by the creator, live on every toggle', () => {
  let restore: () => void;
  let asked: Array<NewGameConfig>;
  let answers: Array<(model: DeckCompositionModel) => void>;
  let failures: Array<(error: Error) => void>;
  let stop: (() => void) | undefined;

  beforeEach(() => {
    resetCreateGameState();
    resetDeckCompositionState();
    asked = [];
    answers = [];
    failures = [];
    restore = setDeckCompositionFetcher((body) => new Promise((resolve, reject) => {
      asked.push(body);
      answers.push(resolve);
      failures.push(reject);
    }));
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    restore();
    resetDeckCompositionState();
    resetCreateGameState();
  });

  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

  it('the key ignores the names, the map and the seed — a name being typed never re-asks', () => {
    const a = buildCreateGamePayloadFromPremiumState(createGameState.config);
    createGameState.config.players[0].name = 'Somebody';
    createGameState.config.mapMode = 'specific';
    const b = buildCreateGamePayloadFromPremiumState(createGameState.config);
    expect(deckCompositionKey(a)).eq(deckCompositionKey(b));
    createGameState.config.selectedExpansions.venus = !createGameState.config.selectedExpansions.venus;
    expect(deckCompositionKey(buildCreateGamePayloadFromPremiumState(createGameState.config))).not.eq(deckCompositionKey(a));
  });

  it('asks once at mount with the LAUNCH BODY; a burst of toggles is ONE ask; the answer lands', async () => {
    stop = trackDeckComposition();
    await tick();
    expect(asked).has.length(1);
    expect(asked[0].expansions).deep.include({prelude: createGameState.config.selectedExpansions.prelude});
    answers[0](composition());
    await tick();
    expect(deckCompositionState.status).eq('ok');
    expect(deckCompositionState.composition?.projects.total).eq(200);

    toggleExpansion('venus');
    toggleExpansion('ares');
    await nextTick();
    await tick();
    expect(asked, 'two toggles in one task → one ask').has.length(2);
    expect(deckCompositionState.status, 'in flight').eq('loading');
    expect(deckCompositionState.composition?.projects.total, 'the previous numbers stay while asking').eq(200);
  });

  it('an answer older than the latest ask is dropped; a failure keeps the numbers and says so quietly', async () => {
    stop = trackDeckComposition();
    await tick();
    answers[0](composition());
    await tick();
    toggleExpansion('venus');
    await nextTick();
    await tick();
    toggleExpansion('ares');
    await nextTick();
    await tick();
    expect(asked).has.length(3);
    answers[2](composition({corporations: {total: 30, byModule: {}}}));
    await tick();
    answers[1](composition({corporations: {total: 99, byModule: {}}}));
    await tick();
    expect(deckCompositionState.composition?.corporations.total, 'the stale answer never lands').eq(30);

    toggleExpansion('promo');
    await nextTick();
    await tick();
    failures[3](new Error('offline'));
    await tick();
    expect(deckCompositionState.status).eq('error');
    expect(deckCompositionState.composition?.corporations.total, 'the numbers stand').eq(30);
  });
});
