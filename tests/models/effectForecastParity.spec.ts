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
import {GameModule} from '../../src/common/cards/GameModule';
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
const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject']);

type Factory = new () => ICard;

function inScopeReactors(): Array<Factory> {
  const out: Array<Factory> = [];
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.has(manifest.module)) {
      continue;
    }
    for (const group of [manifest.projectCards, manifest.corporationCards, manifest.preludeCards]) {
      for (const name of Object.keys(group)) {
        const F = (group as Record<string, {Factory: Factory}>)[name]?.Factory;
        if (F === undefined) {
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

/** Trigger plays with NO prompt of their own — so the only prompt on the table is the reactor's. */
const TRIGGERS: ReadonlyArray<new () => IProjectCard> = [
  Research, NitriteReducingBacteria, Bushes, Pets, ImportedNitrogen, IoMiningIndustries, NoctisFarming, Livestock,
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

describe('effect-forecast ↔ execution parity', () => {
  it('every card-played / grant forecast in scope matches what its live hook records', () => {
    const reached = new Set<CardName>();
    const reactors = inScopeReactors();
    expect(reactors.length, 'hooked reactors in scope').to.be.greaterThan(25);
    let cases = 0;
    for (const F of reactors) {
      const probe = new F();
      const foreignToo = probe.onCardPlayedByAnyPlayer !== undefined;
      const variants = [{label: 'default', arrange: undefined as ((r: ICard) => void) | undefined}, ...(VARIANTS[probe.name] ?? [])];
      for (const variant of variants) {
        for (const foreign of foreignToo ? [false, true] : [false]) {
          for (const T of TRIGGERS) {
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
    const unreached = reactors.map((F) => new F().name).filter((name) => !reached.has(name));
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

    function tileCase(label: string, T: new () => IProjectCard, reactors: Array<{F: Factory, foreign: boolean}>): void {
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
          if (fact.certainty === 'deferred' && fact.effects.length > 0) {
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
