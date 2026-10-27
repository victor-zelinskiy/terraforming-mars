import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {CardName} from '../../src/common/cards/CardName';
import {GameEvent} from '../../src/common/events/GameEvent';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../src/server/models/effectForecast';
import {EffectForecastFact} from '../../src/common/models/EffectForecastModel';
import {Research} from '../../src/server/cards/base/Research';
import {NitriteReducingBacteria} from '../../src/server/cards/base/NitriteReducingBacteria';
import {Bushes} from '../../src/server/cards/base/Bushes';
import {Pets} from '../../src/server/cards/base/Pets';
import {ImportedNitrogen} from '../../src/server/cards/base/ImportedNitrogen';
import {IoMiningIndustries} from '../../src/server/cards/base/IoMiningIndustries';
import {NoctisFarming} from '../../src/server/cards/base/NoctisFarming';
import {Livestock} from '../../src/server/cards/base/Livestock';
import {ImmigrantCity} from '../../src/server/cards/base/ImmigrantCity';
import {SubterraneanReservoir} from '../../src/server/cards/base/SubterraneanReservoir';
import {Mangrove} from '../../src/server/cards/base/Mangrove';
import {RoverConstruction} from '../../src/server/cards/base/RoverConstruction';
import {Hospitals} from '../../src/server/cards/promo/Hospitals';
import {Vermin} from '../../src/server/cards/promo/Vermin';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';
import {ArcticAlgae} from '../../src/server/cards/base/ArcticAlgae';
import {NeptunianPowerConsultants} from '../../src/server/cards/promo/NeptunianPowerConsultants';
import {PolderTechDutch} from '../../src/server/cards/promo/PolderTechDutch';
import {Herbivores} from '../../src/server/cards/base/Herbivores';
import {VectorComputations} from '../../src/server/cards/turmoilRedux/VectorComputations';
import {SpinInducingAsteroid} from '../../src/server/cards/venusNext/SpinInducingAsteroid';
import {NitrogenRichAsteroid} from '../../src/server/cards/base/NitrogenRichAsteroid';
import {ReleaseOfInertGases} from '../../src/server/cards/base/ReleaseOfInertGases';
import {Poseidon} from '../../src/server/cards/colonies/Poseidon';
import {MiningColony} from '../../src/server/cards/colonies/MiningColony';
import {NuclearZone} from '../../src/server/cards/base/NuclearZone';
import {RedMuseum} from '../../src/server/cards/turmoilRedux/RedMuseum';
import {HartlanHeating} from '../../src/server/cards/turmoilRedux/HartlanHeating';
import {Proteus} from '../../src/server/cards/turmoilRedux/Proteus';
import {Biolab} from '../../src/server/cards/prelude/Biolab';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {PREMIUM_SCOPE_MODULES, inPremiumScope} from '../../src/common/cards/premiumScope';

/**
 * THE EFFECT FORECAST ↔ EXECUTION PARITY GUARD.
 *
 * A forecast is only worth showing if it is what happens. For every in-scope
 * card with a forecast hook this spec arranges a table with that ONE reactor,
 * sweeps a pool of trigger cards, and for each trigger the forecast says
 * fires it (an `exact` / `asks` / cell-independent `deferred` fact) plays the
 * trigger FOR REAL and reads the event stream:
 *   · an `exact` / `deferred` fact ⇒ an `effect-triggered` event of the SAME
 *     source card on the SAME channel (`EventTrigger`) for the SAME seat;
 *   · an `asks` fact ⇒ the prompt that arrived carries the reactor's own
 *     `choiceContext` marker (the structural «who asks», never a title).
 * Every hooked card must be REACHED by at least one arrangement (the
 * anti-vacuous floor), so a hook the sweep cannot fire is a spec bug, not a
 * green.
 */
const SCOPE = PREMIUM_SCOPE_MODULES;

type Factory = new () => ICard;

function inScopeReactors(): Array<Factory> {
  const out: Array<Factory> = [];
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.includes(manifest.module)) {
      continue;
    }
    for (const group of [manifest.projectCards, manifest.corporationCards, manifest.preludeCards]) {
      for (const name of Object.keys(group)) {
        const F = (group as Record<string, {Factory: Factory}>)[name]?.Factory;
        if (F === undefined || !inPremiumScope({module: manifest.module, name}, SCOPE)) {
          continue;
        }
        let card: ICard;
        try {
          card = new F();
        } catch {
          continue;
        }
        if (card.cardPlayedForecast !== undefined || card.grantForecast !== undefined) {
          out.push(F);
        }
      }
    }
  }
  return out;
}

/**
 * A reactor whose ONLY mirrored hook is «a colony was built»: no prompt-less
 * trigger of the pool fires it (a colony build asks which tile), so the sweep
 * leaves it to the colony block — which must then cover every one of them.
 */
function colonyOnly(card: ICard): boolean {
  return card.onColonyAddedByAnyPlayer !== undefined && card.cardPlayedForecast === undefined &&
    card.onProductionGain === undefined && card.onResourceAdded === undefined &&
    card.onGlobalParameterIncrease === undefined && card.onGlobalParameterRaised === undefined;
}

/**
 * A reactor that answers ONLY «a green card that places a tile» (TR80 Hartlan Heating — the printed class
 * `cards/cardPlacesTile.ts`): no prompt-less trigger of the pool places a tile, so the sweep cannot fire it — its own
 * block below plays a tile card and answers the cell (the anti-vacuous floor is the class itself).
 */
const TILE_PLAY_REACTORS: ReadonlyArray<Factory> = [HartlanHeating];

function tilePlayOnly(card: ICard): boolean {
  return TILE_PLAY_REACTORS.some((F) => new F().name === card.name);
}

/**
 * A reactor that answers ONLY «a played tag matching a tag on your OTHER Preludes» (TR82 Proteus — `matchingPreludeTags`):
 * the sweep's table holds no Prelude, so it cannot fire — its own block below seats a Prelude and plays a matching card.
 */
const PRELUDE_TAG_REACTORS: ReadonlyArray<Factory> = [Proteus];

function preludeTagOnly(card: ICard): boolean {
  return PRELUDE_TAG_REACTORS.some((F) => new F().name === card.name);
}

/**
 * Trigger plays with NO prompt of their own — so the only prompt on the table is the reactor's.
 * Vector Computations is the pool's DATA grant: its own play puts 2 data on itself (TR18 Martian Fiber).
 * Spin-Inducing Asteroid is the pool's VENUS raise (2 steps — Aphrodite, TR24 Venusian Census) and
 * Nitrogen-Rich Asteroid its TEMPERATURE raise (Homeostasis Bureau): a scale step is a `global` grant.
 * Release of Inert Gases is the pool's EXPLICIT rating (+2 TR, no scale): the rating pass's `tr` grant on its own
 * (TR81 Lotus Innovations — the scale raisers above reach it too, a scale step being a rating step).
 */
const TRIGGERS: ReadonlyArray<new () => IProjectCard> = [
  Research, NitriteReducingBacteria, Bushes, Pets, ImportedNitrogen, IoMiningIndustries, NoctisFarming, Livestock,
  VectorComputations, SpinInducingAsteroid, NitrogenRichAsteroid, ReleaseOfInertGases,
];

/** Extra STATES of a reactor that flip its answer (the same predicates the live hook reads). */
const VARIANTS: Partial<Record<CardName, ReadonlyArray<{label: string, arrange: (reactor: ICard) => void}>>> = {
  [CardName.OLYMPUS_CONFERENCE]: [{label: 'one science stored', arrange: (r) => {
    r.resourceCount = 1;
  }}],
  [CardName.RECYCLON]: [{label: 'two microbes stored', arrange: (r) => {
    r.resourceCount = 2;
  }}],
  [CardName.PHARMACY_UNION]: [{label: 'one disease stored', arrange: (r) => {
    r.resourceCount = 1;
  }}],
};

function firedMarkers(events: ReadonlyArray<GameEvent>, fact: EffectForecastFact, recipientColor: string): Array<GameEvent> {
  return events.filter((e) => e.type === 'effect-triggered' &&
    e.source !== undefined && 'card' in e.source && e.source.card === fact.source.name &&
    e.trigger === fact.source.channel &&
    e.player === recipientColor);
}

/**
 * The live queue PAUSES on a prompt: a gain deferred BEHIND a question (the
 * Splice owner's M€ at GAIN_RESOURCE_OR_PRODUCTION behind the card player's
 * DEFAULT choice, Arctic Algae's plants behind Neptunian's OPPONENT_TRIGGER
 * question) lands only once the question is answered. Answer every standing
 * prompt of the REACTORS under test with their first option — the forecast's
 * own «first outcome» — so the exact facts behind it can be checked.
 */
function answerReactorPrompts(game: IGame, players: ReadonlyArray<TestPlayer>, reactors: ReadonlySet<string>): void {
  for (let round = 0; round < 6; round++) {
    let answered = false;
    for (const p of players) {
      const prompt = p.getWaitingFor();
      const source = prompt?.choiceContext?.source;
      if (prompt === undefined || source === undefined || !('card' in source) || !reactors.has(String(source.card))) {
        continue;
      }
      if (prompt instanceof OrOptions) {
        // The first option may itself be a card pick (Mars University's
        // «discard a card»): answer it with its first candidate.
        const first = prompt.options[0];
        const response = first instanceof SelectCard ?
          {type: 'card' as const, cards: [first.cards[0].name]} :
          {type: 'option' as const};
        p.process({type: 'or', index: 0, response});
      } else if (prompt instanceof SelectCard) {
        p.process({type: 'card', cards: [prompt.cards[0].name]});
      } else {
        continue;
      }
      runAllActions(game);
      answered = true;
    }
    if (!answered) {
      return;
    }
  }
}

function recipientColorOf(fact: EffectForecastFact, active: IPlayer): string {
  return fact.recipient.kind === 'you' ? active.color : fact.recipient.color;
}

type Table = {game: IGame, player: TestPlayer, owner: TestPlayer, reactor: ICard};

function arrange(F: Factory, foreign: boolean, variant: ((r: ICard) => void) | undefined, suffix: string): Table {
  const [game, player, opponent] = testGame(2, {aresExtension: true, deltaProjectExpansion: true} as never, suffix);
  const owner = foreign ? opponent : player;
  const reactor = new F();
  variant?.(reactor);
  owner.playedCards.push(reactor);
  player.megaCredits = 40;
  opponent.megaCredits = 40;
  player.production.override({energy: 2});
  // A spare hand card: Mars University's «discard one to draw one» is only
  // asked when the hand AFTER the play is not empty (the live predicate).
  player.cardsInHand.push(new Livestock());
  return {game, player, owner, reactor};
}

function assertParity(table: Table, trigger: IProjectCard, facts: ReadonlyArray<EffectForecastFact>, label: string): void {
  const {game, player, reactor} = table;
  const before = game.events.events.length;
  player.playCard(trigger);
  runAllActions(game);
  // The QUESTIONS first — they stand exactly where the live queue paused.
  for (const fact of facts) {
    if (fact.certainty === 'asks') {
      const asked = fact.recipient.kind === 'you' ? player : table.owner;
      const prompt = asked.getWaitingFor();
      expect(prompt, `${label}: the asks fact of ${reactor.name} must have raised a prompt`).to.not.be.undefined;
      expect(prompt?.choiceContext?.source, `${label}: the prompt must be ${reactor.name}'s own (choiceContext)`).to.deep.include({card: reactor.name});
    }
  }
  // …then the gains queued BEHIND them (answer, drain, read the stream).
  answerReactorPrompts(game, [player, table.owner], new Set([reactor.name]));
  const after = game.events.events.slice(before);
  for (const fact of facts) {
    if (fact.certainty === 'exact' || (fact.certainty === 'deferred' && fact.effects.length > 0)) {
      const markers = firedMarkers(after, fact, recipientColorOf(fact, player));
      expect(markers.length, `${label}: the ${fact.certainty} fact «${String(fact.reason)}» of ${reactor.name} must have fired as an effect-triggered event on '${fact.source.channel}'`).to.be.greaterThan(0);
    }
  }
}

describe('effect-forecast ↔ execution parity', function() {
  // The corpus sweep plays every in-scope reactor's live hook: ~1.5 s alone, past mocha's 2 s default
  // under a full-suite load (measured 2026-09-28) — the ceiling follows the `boardBeatPark.spec` precedent.
  // eslint-disable-next-line no-invalid-this
  this.timeout(15_000);
  it('every card-played / grant forecast in scope matches what its live hook records', () => {
    const reached = new Set<CardName>();
    const reactors = inScopeReactors();
    expect(reactors.length, 'hooked reactors in scope').to.be.greaterThan(25);
    let cases = 0;
    for (const F of reactors) {
      const probe = new F();
      // A «colony built» reactor is fired by a play that ASKS (which tile) — its own block below.
      if (colonyOnly(probe)) {
        continue;
      }
      // «Any player plays», «the scale is raised, whoever raised it» and «any player gains TR» all ask a FOREIGN owner.
      const foreignToo = probe.onCardPlayedByAnyPlayer !== undefined || probe.onGlobalParameterRaised !== undefined ||
        probe.onIncreaseTerraformRatingByAnyPlayer !== undefined;
      const variants = [{label: 'default', arrange: undefined as ((r: ICard) => void) | undefined}, ...(VARIANTS[probe.name] ?? [])];
      for (const variant of variants) {
        for (const foreign of foreignToo ? [false, true] : [false]) {
          for (const T of TRIGGERS) {
            // A card already on the table is never played a second time (Vector Computations is both).
            if (new T().name === probe.name) {
              continue;
            }
            const suffix = `-${probe.name}-${variant.label}-${foreign ? 'foreign' : 'own'}-${T.name}`.replace(/\s+/g, '');
            // The forecast, on a table arranged exactly like the one played below.
            const forecastTable = arrange(F, foreign, variant.arrange, `${suffix}-fc`);
            const trigger = new T();
            forecastTable.player.cardsInHand.push(trigger);
            const forecast = effectForecastForPlay(forecastTable.player, trigger, cardPlayPreview(forecastTable.player, trigger));
            const facts = forecast.facts.filter((f) => f.source.name === probe.name &&
              (f.certainty === 'exact' || f.certainty === 'asks' || (f.certainty === 'deferred' && f.effects.length > 0)));
            if (facts.length === 0) {
              continue;
            }
            // The SAME arrangement, played for real.
            const liveTable = arrange(F, foreign, variant.arrange, `${suffix}-live`);
            const liveTrigger = new T();
            liveTable.player.cardsInHand.push(liveTrigger);
            assertParity(liveTable, liveTrigger, facts, `${probe.name} [${variant.label}, ${foreign ? 'foreign' : 'own'}] ← ${liveTrigger.name}`);
            reached.add(probe.name);
            cases++;
          }
        }
      }
    }
    const unreached = reactors.map((F) => new F()).filter((card) => !colonyOnly(card) && !tilePlayOnly(card) && !preludeTagOnly(card)).map((card) => card.name).filter((name) => !reached.has(name));
    expect(unreached, 'every forecast hook must be fired by at least one trigger of the pool (extend TRIGGERS / VARIANTS)').to.deep.eq([]);
    expect(cases, 'parity cases exercised').to.be.greaterThan(40);
  });

  describe('tile triggers (deferred facts with cell-independent numbers)', () => {
    function placeFirst(game: IGame, player: TestPlayer): void {
      const prompt = cast(player.getWaitingFor(), SelectSpace);
      const space = prompt.spaces[0];
      expect(space, 'a legal cell').to.not.be.undefined;
      prompt.cb(space);
      runAllActions(game);
    }

    /**
     * `cellDecided` — reactors whose fact carries NO number (the cell decides it: Mining Guild, TR30 Red Museum)
     * but which the FIRST legal cell of a fresh board satisfies: their marker must fire too.
     */
    function tileCase(label: string, T: new () => IProjectCard, reactors: Array<{F: Factory, foreign: boolean}>, cellDecided: ReadonlyArray<CardName> = []): void {
      it(label, () => {
        const [game, player, opponent] = testGame(2, undefined, `-tile-${T.name}`);
        player.megaCredits = 40;
        opponent.megaCredits = 40;
        player.production.override({energy: 2});
        const placed = reactors.map(({F, foreign}) => {
          const card = new F();
          (foreign ? opponent : player).playedCards.push(card);
          return card;
        });
        const trigger = new T();
        player.cardsInHand.push(trigger);
        const forecast = effectForecastForPlay(player, trigger, cardPlayPreview(player, trigger));
        const facts = forecast.facts.filter((f) => f.timing === 'after-placement' && (f.certainty === 'deferred' || f.certainty === 'asks'));
        expect(facts.length, 'the tile pass produced facts').to.be.greaterThan(0);
        for (const card of placed) {
          expect(facts.some((f) => f.source.name === card.name), `${card.name} reacts in the forecast`).to.be.true;
        }
        const before = game.events.events.length;
        player.playCard(trigger);
        runAllActions(game);
        placeFirst(game, player);
        for (const fact of facts) {
          if (fact.certainty === 'asks') {
            const asked = fact.recipient.kind === 'you' ? player : opponent;
            expect(asked.getWaitingFor()?.choiceContext?.source, `${fact.source.name} must be asking`).to.deep.include({card: fact.source.name});
          }
        }
        // A question of one reactor pauses the queue in front of the others'
        // gains (Neptunian's OPPONENT_TRIGGER prompt ahead of Arctic Algae's
        // plants): answer it, then read the stream.
        answerReactorPrompts(game, [player, opponent], new Set(placed.map((c) => c.name)));
        const after = game.events.events.slice(before);
        for (const fact of facts) {
          if (fact.certainty === 'deferred' && (fact.effects.length > 0 || cellDecided.includes(fact.source.name as CardName))) {
            const markers = firedMarkers(after, fact, recipientColorOf(fact, player));
            expect(markers.length, `${fact.source.name}: «${String(fact.reason)}» must have fired on 'tile-placed'`).to.be.greaterThan(0);
          }
        }
      });
    }

    tileCase('a city: Rover Construction, Pets, Hospitals (foreign), Vermin, Tharsis Republic and Immigrant City itself', ImmigrantCity, [
      {F: RoverConstruction, foreign: false}, {F: Pets, foreign: false}, {F: Hospitals, foreign: true},
      {F: Vermin, foreign: true}, {F: TharsisRepublic, foreign: false},
    ]);
    tileCase('an ocean: Arctic Algae (foreign), Neptunian Power Consultants (asks), PolderTech Dutch', SubterraneanReservoir, [
      {F: ArcticAlgae, foreign: true}, {F: NeptunianPowerConsultants, foreign: false}, {F: PolderTechDutch, foreign: false},
    ]);
    tileCase('a greenery: Herbivores and PolderTech Dutch', Mangrove, [
      {F: Herbivores, foreign: false}, {F: PolderTechDutch, foreign: false},
    ]);
    // A SPECIAL tile on a clean cell (the first legal one of a fresh board): TR30's cell-decided fact must fire.
    tileCase('a special tile: Nuclear Zone with Red Museum (the cell decides — a clean cell pays)', NuclearZone, [
      {F: RedMuseum, foreign: false},
    ], [CardName.RED_MUSEUM]);
  });

  /*
   * THE COLONY PASS — «a colony was built» (`onColonyAddedByAnyPlayer`). The
   * trigger asks WHICH tile, so it cannot ride the prompt-less sweep above:
   * the play's own colony pick is answered here, and the reaction — which does
   * not depend on the tile — is read off the stream. Every in-scope reactor of
   * the class must be exercised (the anti-vacuous floor is the class itself).
   */
  /*
   * THE TILE-PLAY PASS — «a green card that places a tile» (TR80 Hartlan Heating, `onCardPlayed` on the printed class
   * `cards/cardPlacesTile.ts`). The trigger asks WHERE, so it cannot ride the prompt-less sweep above: the play's own
   * cell is answered here, and the reaction — deferred behind that prompt at the gain's own priority — is read off
   * the stream. Every in-scope reactor of the class must be exercised (the anti-vacuous floor is the class itself).
   */
  describe('green tile plays (exact facts behind the cell prompt)', () => {
    it('the block covers every in-scope «green tile play» reactor', () => {
      const inScope = inScopeReactors().map((F) => new F()).filter((card) => tilePlayOnly(card)).map((card) => card.name);
      expect(inScope.sort()).deep.eq(TILE_PLAY_REACTORS.map((F) => new F().name).sort());
    });

    for (const F of TILE_PLAY_REACTORS) {
      const name = new F().name;
      it(`${name} ← Nuclear Zone (a green card with a declarative tile): the fact, then the event after the cell`, () => {
        const forecastTable = arrange(F, false, undefined, `-tile-play-${name}-fc`);
        const trigger = new NuclearZone();
        forecastTable.player.cardsInHand.push(trigger);
        const forecast = effectForecastForPlay(forecastTable.player, trigger, cardPlayPreview(forecastTable.player, trigger));
        const facts = forecast.facts.filter((f) => f.source.name === name);
        expect(facts.map((f) => f.certainty), 'the card-played pass states ONE exact reaction').deep.eq(['exact']);
        expect(facts[0].source.channel).eq('card-played');
        expect(facts[0].timing, 'behind the play\'s own cell prompt').eq('after-card');

        const {game, player} = arrange(F, false, undefined, `-tile-play-${name}-live`);
        const liveTrigger = new NuclearZone();
        player.cardsInHand.push(liveTrigger);
        const before = game.events.events.length;
        player.playCard(liveTrigger);
        runAllActions(game);
        expect(firedMarkers(game.events.events.slice(before), facts[0], player.color), 'nothing fires before the cell is chosen').deep.eq([]);
        const prompt = cast(player.getWaitingFor(), SelectSpace);
        prompt.cb(prompt.spaces[0]);
        runAllActions(game);
        const markers = firedMarkers(game.events.events.slice(before), facts[0], player.color);
        expect(markers.length, `${name} must have fired on 'card-played' once the tile landed`).to.be.greaterThan(0);
      });

      it(`${name} ← Research (a green card with no tile): no fact, no event`, () => {
        const {game, player} = arrange(F, false, undefined, `-tile-play-${name}-none`);
        const trigger = new Research();
        player.cardsInHand.push(trigger);
        const forecast = effectForecastForPlay(player, trigger, cardPlayPreview(player, trigger));
        expect(forecast.facts.filter((f) => f.source.name === name)).deep.eq([]);
        const before = game.events.events.length;
        player.playCard(trigger);
        runAllActions(game);
        expect(game.events.events.slice(before).filter((e) => e.type === 'effect-triggered' && e.source !== undefined && 'card' in e.source && e.source.card === name)).deep.eq([]);
      });
    }
  });

  /*
   * THE PRELUDE-TAG PASS — «a played tag matching a tag on your Preludes» (TR82 Proteus). The table seats a Prelude
   * (Biolab, Science) beside the reactor; Research (two Science tags) is the trigger — one exact fact PER matching tag.
   */
  describe('prelude-tag plays (one exact fact per matching tag)', () => {
    it('the block covers every in-scope «prelude tag» reactor', () => {
      const inScope = inScopeReactors().map((F) => new F()).filter((card) => preludeTagOnly(card)).map((card) => card.name);
      expect(inScope.sort()).deep.eq(PRELUDE_TAG_REACTORS.map((F) => new F().name).sort());
    });

    for (const F of PRELUDE_TAG_REACTORS) {
      const name = new F().name;
      it(`${name} ← Research beside a Science Prelude: two facts, the card-played event`, () => {
        const forecastTable = arrange(F, false, undefined, `-prelude-tag-${name}-fc`);
        forecastTable.owner.playedCards.push(new Biolab());
        const trigger = new Research();
        forecastTable.player.cardsInHand.push(trigger);
        const forecast = effectForecastForPlay(forecastTable.player, trigger, cardPlayPreview(forecastTable.player, trigger));
        const facts = forecast.facts.filter((f) => f.source.name === name);
        expect(facts.map((f) => f.certainty), 'one exact fact per matching Science tag').deep.eq(['exact', 'exact']);

        const liveTable = arrange(F, false, undefined, `-prelude-tag-${name}-live`);
        liveTable.owner.playedCards.push(new Biolab());
        const liveTrigger = new Research();
        liveTable.player.cardsInHand.push(liveTrigger);
        assertParity(liveTable, liveTrigger, facts, `${name} ← Research (Biolab seated)`);
      });
    }
  });

  describe('colony builds (exact facts, whichever tile is picked)', () => {
    const COLONY_REACTORS: ReadonlyArray<Factory> = [Poseidon];

    it('the block covers every in-scope «colony built» reactor', () => {
      const inScope = inScopeReactors().map((F) => new F()).filter((card) => card.onColonyAddedByAnyPlayer !== undefined).map((card) => card.name);
      expect(inScope.sort()).deep.eq(COLONY_REACTORS.map((F) => new F().name).sort());
    });

    function colonyTable(F: Factory, foreign: boolean, suffix: string): Table {
      const [game, player, opponent] = testGame(2, {coloniesExtension: true}, suffix);
      const owner = foreign ? opponent : player;
      const reactor = new F();
      owner.playedCards.push(reactor);
      player.megaCredits = 40;
      return {game, player, owner, reactor};
    }

    for (const F of COLONY_REACTORS) {
      for (const foreign of [false, true]) {
        const name = new F().name;
        it(`${name} [${foreign ? 'foreign' : 'own'}] ← Mining Colony (a declarative buildColony)`, () => {
          const forecastTable = colonyTable(F, foreign, `-colony-${foreign}-fc`);
          const trigger = new MiningColony();
          forecastTable.player.cardsInHand.push(trigger);
          const forecast = effectForecastForPlay(forecastTable.player, trigger, cardPlayPreview(forecastTable.player, trigger));
          const facts = forecast.facts.filter((f) => f.source.name === name);
          expect(facts.map((f) => f.certainty), 'the colony pass states the reaction').deep.eq(['exact']);
          expect(facts[0].source.channel).eq('colony-added');
          expect(facts[0].recipient.kind).eq(foreign ? 'player' : 'you');

          const {game, player, owner} = colonyTable(F, foreign, `-colony-${foreign}-live`);
          const liveTrigger = new MiningColony();
          player.cardsInHand.push(liveTrigger);
          const before = game.events.events.length;
          const production = owner.production.megacredits;
          player.playCard(liveTrigger);
          runAllActions(game);
          const pick = cast(player.popWaitingFor(), SelectColony);
          pick.cb(pick.colonies[0]);
          runAllActions(game);
          const markers = firedMarkers(game.events.events.slice(before), facts[0], recipientColorOf(facts[0], player));
          expect(markers.length, `${name} must have fired on 'colony-added'`).to.be.greaterThan(0);
          // …and what it promised is what landed (the chip's own delta).
          expect(owner.production.megacredits - production).eq(facts[0].effects[0].amount);
        });
      }
    }

    it('an operation that builds no colony states no colony fact', () => {
      const table = colonyTable(Poseidon, false, '-colony-none');
      const trigger = new Research();
      table.player.cardsInHand.push(trigger);
      const forecast = effectForecastForPlay(table.player, trigger, cardPlayPreview(table.player, trigger));
      expect(forecast.facts.filter((f) => f.source.name === CardName.POSEIDON)).deep.eq([]);
    });
  });

  describe('MarsBot corporations', () => {
    function botCase(label: string, corporation: MarsBotCorpId, T: new () => IProjectCard, expectHumanAsk: boolean): void {
      it(label, () => {
        const [game, human] = testAutomaGame({corporation}, `-fc-parity-${corporation}`);
        game.playerIsFinishedWithResearchPhase(human);
        human.megaCredits = 40;
        const trigger = new T();
        human.cardsInHand.push(trigger);
        const forecast = effectForecastForPlay(human, trigger, cardPlayPreview(human, trigger));
        const facts = forecast.facts.filter((f) => f.source.kind === 'automa-corporation');
        expect(facts.length, 'the bot corporation forecasts').to.be.greaterThan(0);
        const before = game.events.events.length;
        human.playCard(trigger);
        runAllActions(game);
        if (expectHumanAsk) {
          expect(facts.some((f) => f.certainty === 'asks' && f.recipient.kind === 'you'), 'the human is asked').to.be.true;
          expect(human.getWaitingFor()?.choiceContext?.source).to.deep.include({card: CardName.SPLICE});
          answerReactorPrompts(game, [human], new Set([CardName.SPLICE]));
        }
        const after = game.events.events.slice(before);
        for (const fact of facts) {
          if (fact.certainty === 'exact') {
            const markers = after.filter((e) => e.type === 'effect-triggered' &&
              e.source !== undefined && 'card' in e.source && e.source.card === fact.source.name && e.trigger === fact.source.channel);
            expect(markers.length, `${fact.source.name}: «${String(fact.reason)}» must have fired on '${fact.source.channel}'`).to.be.greaterThan(0);
          }
        }
      });
    }

    botCase('Saturn Systems advances the event track on a Jovian card', MarsBotCorpId.C08_SATURN_SYSTEMS, IoMiningIndustries, false);
    botCase('Pharmacy Union loses 4 M€ on a microbe card', MarsBotCorpId.C21_PHARMACY_UNION, NitriteReducingBacteria, false);
    botCase('Splice pays the bot and asks the human on a microbe card', MarsBotCorpId.C24_SPLICE, NitriteReducingBacteria, true);
  });
});
