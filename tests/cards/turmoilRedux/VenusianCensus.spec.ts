import {expect} from 'chai';
import {VenusianCensus, VENUSIAN_CENSUS_DATA_PER_STEP} from '../../../src/server/cards/turmoilRedux/VenusianCensus';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {MartianFiber} from '../../../src/server/cards/turmoilRedux/MartianFiber';
import {Aphrodite} from '../../../src/server/cards/venusNext/Aphrodite';
import {CENSUS_ADD_TITLE, CENSUS_SHORT_DATA_REASON, CENSUS_VOTE_TITLE} from '../../../src/server/cards/turmoilRedux/censusAction';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {Server} from '../../../src/server/models/ServerModel';
import {VenusRedux} from '../../../src/server/colonies/VenusRedux';
import {SpinInducingAsteroid} from '../../../src/server/cards/venusNext/SpinInducingAsteroid';
import {GAS_EXPORT_ID} from '../../../src/server/parliament/resolutions/reds/GasExport';
import {winnerParameterStep} from '../../../src/server/parliament/resolutions/WinnerParameterStep';
import {EnactContext} from '../../../src/server/parliament/resolutions/IResolution';
import {CardRenderer} from '../../../src/server/cards/render/CardRenderer';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {GlobalParameter} from '../../../src/common/GlobalParameter';
import {Resource} from '../../../src/common/Resource';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {resolutionInstanceId} from '../../../src/common/parliament/ParliamentTypes';
import {cast, toName} from '../../../src/common/utils/utils';
import {digit, all} from '../../../src/server/cards/Options';
import {Size} from '../../../src/common/cards/render/Size';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {endGenerationThroughParliament, quietResolutionOf, seatEnacted, seatResolution, settleParliamentGates} from '../../parliament/parliamentArrange';
import {runAllActions, setVenusScaleLevel} from '../../TestingUtils';

/**
 * TR24 — VENUSIAN CENSUS: the set's first Venus tag, Unity's plate, and the
 * first card of the fork whose effect answers A STEP OF A SCALE whoever made it
 * (`ICard.onGlobalParameterRaised`, the dispatcher Aphrodite now shares). Every
 * rule reading of the card file's header is pinned here; the action is the
 * shared census action (`censusAction.ts`) — its whole contract is pinned
 * through TR15 (`MartianCensus.spec.ts`), so only the wiring is checked here.
 */
const G = PartyName.GREENS;
const U = PartyName.UNITY;
const I = PartyName.INDUSTRIALISTS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: VenusianCensus};

/** A two-seat Redux + Venus Next table with three QUIET real resolutions (Greens · Unity · Industrialists) — the Greens rule by the starting rule. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, U, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  const card = new VenusianCensus();
  return {game, p1, p2, parliament, card};
}

/** The same table with the card on p1's table (the effect / the action). */
function owned(): Table {
  const t = table();
  t.p1.playedCards.push(t.card);
  return t;
}

/** The `effect-triggered` markers of `card` (the dispatcher's lazy scope — emitted exactly once per firing that acted). */
function triggers(game: IGame, card: CardName = CardName.VENUSIAN_CENSUS) {
  return game.events.events.filter((e) =>
    e.type === 'effect-triggered' && e.source !== undefined && 'card' in e.source && e.source.card === card);
}

function options(overrides: Partial<GameOptions>): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...overrides};
}

describe('VenusianCensus', () => {
  describe('the card', () => {
    it('registers with source-backed metadata (the scan: 6 · Venus · blue · Unity · data · no VP · Venus Next)', () => {
      const card = new VenusianCensus();
      expect(card.name).eq(CardName.VENUSIAN_CENSUS);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(6);
      expect(card.tags, 'the blue «V» disc in the corner — the set\'s first Venus tag').deep.eq([Tag.VENUS]);
      expect(card.metadata.cardNumber).eq('TR24');
      expect(card.resourceType).eq(CardResource.DATA);
      expect(requiredPartyOf(card), 'the MIN plate holds Unity\'s emblem — a requirement, not a tag').eq(U);
      expect(card.requirements).has.length(1);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(VENUSIAN_CENSUS_DATA_PER_STEP).eq(2);
      expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.VENUSIAN_CENSUS]?.compatibility,
        'the Venus Next icon at the bottom left (rulebook p.8); never \'turmoil\'').eq('venus');
    });

    it('the face reads as printed: [Venus scale, ANY player] : [data][data] — then TR15\'s two action rows', () => {
      const card = new VenusianCensus();
      type Node = {is?: string, type?: string, amount?: number, anyPlayer?: boolean, showDigit?: boolean, rows?: Array<Array<Node | string>>};
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
      expect(rows.map((row) => row[0].is === 'effect' ? 'box' : row[0].type)).deep.eq(['box', 'box', 'OR', 'box']);
      const [effect, a, , b] = rows.map((row) => row[0]);
      const cause = (box: Node) => (box.rows?.[0] ?? []) as Array<Node>;
      const result = (box: Node) => (box.rows?.[2] ?? []) as Array<Node | string>;
      expect(cause(effect)[0], 'the scale wears the red-and-yellow «any player» halo (Aphrodite\'s reading)').deep.include({type: CardRenderItemType.VENUS, anyPlayer: true});
      const gain = result(effect)[0] as Node;
      expect(gain).deep.include({type: CardRenderItemType.RESOURCE, amount: 2});
      expect(gain.showDigit, 'two ICONS, as printed — never «2×»').not.eq(true);
      expect(result(effect)).deep.include('Effect: After each time Venus is terraformed 1 step, add 2 data resources to this card.');
      expect(result(a)).deep.include('Action: Add 1 data resource here.');
      expect(result(b)).deep.include('Action: Spend 3 data from here to add a delegate to a resolution.');
    });

    it('the two action rows are SHARED — TR15\'s face is byte-for-byte what it was before the extraction', () => {
      // TR15's builder as it stood before `censusActionRows` existed (ff2c9513c5), verbatim.
      const before = CardRenderer.builder((b) => {
        b.effect('Whenever ANY player places a city on Mars, add a data resource to this card.', (eb) => {
          eb.city({size: Size.SMALL, all}).asterix().startEffect.resource(CardResource.DATA);
        }).br;
        b.action('Add 1 data resource here.', (eb) => {
          eb.empty().startAction.resource(CardResource.DATA);
        }).br;
        b.or().br;
        b.action('Spend 3 data from here to add a delegate to a resolution.', (eb) => {
          eb.resource(CardResource.DATA, {amount: 3, digit}).startAction.delegates(1);
        });
      });
      expect(JSON.parse(JSON.stringify(new MartianCensus().metadata.renderData))).deep.eq(JSON.parse(JSON.stringify(before)));
      // …and the census twins print the very same action rows.
      const actionRows = (card: {metadata: {renderData?: unknown}}) => JSON.stringify((card.metadata.renderData as {rows: Array<unknown>}).rows.slice(1));
      expect(actionRows(new VenusianCensus())).eq(actionRows(new MartianCensus()));
    });

    it('the deck gate: dealt with Turmoil Redux AND Venus Next, never without Venus Next', () => {
      const withVenus = new GameCards(options({turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true})).getProjectCards().map(toName);
      const withoutVenus = new GameCards(options({turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: false})).getProjectCards().map(toName);
      expect(withVenus).includes(CardName.VENUSIAN_CENSUS);
      expect(withoutVenus).not.includes(CardName.VENUSIAN_CENSUS);
      expect(withoutVenus, 'its sister needs nothing else').includes(CardName.MARTIAN_CENSUS);
    });
  });

  describe('rule 1 — the requirement: Unity rules, or 2 of your delegates on its resolution', () => {
    it('neither road: unplayable with a NAMED reason — Unity, «0 of 2»', () => {
      const t = table();
      t.p1.megaCredits = 20;
      t.p1.cardsInHand.push(t.card);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [U, '2'], party: U, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('two delegates on its resolution: playable', () => {
      const t = table();
      t.p1.megaCredits = 20;
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('Unity rules: playable with no delegate anywhere', () => {
      const t = table();
      t.p1.megaCredits = 20;
      seatEnacted(t.parliament, quietResolutionOf(U));
      expect(t.parliament.rulingParty()).eq(U);
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('rule 5 — the play places nothing: no data, Venus untouched', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(U));
      t.p1.megaCredits = 20;
      setVenusScaleLevel(t.game, 10);
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
      expect(t.game.getVenusScaleLevel()).eq(10);
    });
  });

  describe('rule 2 — EVERY raise of the Venus scale, by anyone and by anything', () => {
    it('the owner\'s own raise: +2', () => {
      const t = owned();
      t.game.increaseVenusScaleLevel(t.p1, 1);
      expect(t.card.resourceCount).eq(2);
    });

    it('an opponent\'s raise: +2 on the OWNER\'s card, recorded as the OWNER\'s effect (the dispatcher\'s withEffect)', () => {
      const t = owned();
      t.game.increaseVenusScaleLevel(t.p2, 1);
      expect(t.card.resourceCount).eq(2);
      const fired = triggers(t.game);
      expect(fired.map((e) => [e.player, e.trigger])).deep.eq([[t.p1.color, 'global-parameter']]);
    });

    it('MarsBot\'s raise: +2 on the human\'s card', () => {
      const [game, human, bot] = testAutomaGame({venusNextExtension: true});
      const card = new VenusianCensus();
      human.playedCards.push(card);
      game.increaseVenusScaleLevel(bot, 1);
      expect(card.resourceCount).eq(2);
    });

    it('a trade with Redux Venus («Terraform Venus 1 step») by an opponent: +2', () => {
      const t = owned();
      const venus = new VenusRedux();
      t.game.colonies = [venus];
      venus.trackPosition = 1;
      venus.trade(t.p2);
      runAllActions(t.game);
      expect(t.game.getVenusScaleLevel()).eq(2);
      expect(t.card.resourceCount).eq(2);
    });

    it('a resolution winner\'s Venus step (the shared executor, REWARDED): +2, and the step is the winner\'s', () => {
      const t = owned();
      t.game.phase = Phase.PARLIAMENT;
      const tr = t.p2.terraformRating;
      const step = winnerParameterStep('RDX_TEST', {kind: 'parameter', parameter: 'venus', steps: 1});
      step.run({game: t.game, parliament: t.parliament, player: t.p2, winner: t.p2, influence: 0,
        source: {kind: 'resolution', id: 'RDX_TEST'}, state: {}, report: () => {}} as unknown as EnactContext);
      expect(t.card.resourceCount).eq(2);
      expect(t.p2.terraformRating, 'the winner\'s TR — a rewarded step').eq(tr + 1);
      expect(t.game.scaleStepRewards.at(-1)?.by, 'credited to the winner').eq(t.p2.color);
    });

    it('a resolution\'s WORLD move with no TR (RX12 Gas Export, Venus 10 % → 14 %): +4, credited to nobody', () => {
      const t = owned();
      const {game, p1, p2, parliament} = t;
      seatResolution(parliament, 0, resolutionInstanceId(GAS_EXPORT_ID, 0));
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      setVenusScaleLevel(game, 10);
      const tr = [p1.terraformRating, p2.terraformRating];
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(game.getVenusScaleLevel()).eq(14);
      expect(t.card.resourceCount, '2 steps × 2').eq(4);
      expect(p2.terraformRating, 'nobody is credited the world\'s move').eq(tr[1]);
      const record = game.scaleStepRewards.find((r) => r.card === CardName.VENUSIAN_CENSUS);
      expect(record).deep.include({parameter: GlobalParameter.VENUS, steps: 2, before: 10, after: 14, owner: p1.color});
      expect(record?.by, 'a world move has no author').is.undefined;
    });

    it('the World Government\'s Solar Phase terraforming: +2, credited to nobody', () => {
      const t = owned();
      t.game.phase = Phase.SOLAR;
      t.game.increaseVenusScaleLevel(t.p2, 1);
      expect(t.card.resourceCount).eq(2);
      expect(t.game.scaleStepRewards.at(-1)?.by).is.undefined;
    });

    it('two owners: the dispatcher walks the seats in generation order', () => {
      const t = owned();
      const theirs = new VenusianCensus();
      t.p2.playedCards.push(theirs);
      t.game.increaseVenusScaleLevel(t.p2, 1);
      expect([t.card.resourceCount, theirs.resourceCount]).deep.eq([2, 2]);
      expect(triggers(t.game).map((e) => e.player)).deep.eq(t.game.playersInGenerationOrder.map((p) => p.color));
    });
  });

  describe('rule 3 — +2 data per STEP MADE (a step is 2 %)', () => {
    it('a raise of 2 steps (Venus 4 % → 8 %): +4', () => {
      const t = owned();
      setVenusScaleLevel(t.game, 4);
      t.game.increaseVenusScaleLevel(t.p2, 2);
      expect(t.card.resourceCount).eq(4);
    });

    it('at 28 % a raise «by 2» makes ONE step: +2', () => {
      const t = owned();
      setVenusScaleLevel(t.game, 28);
      expect(t.game.increaseVenusScaleLevel(t.p2, 2)).eq(1);
      expect(t.card.resourceCount).eq(2);
    });

    it('at 30 %: nothing — no call, no record', () => {
      const t = owned();
      setVenusScaleLevel(t.game, 30);
      t.game.increaseVenusScaleLevel(t.p2, 1);
      expect(t.card.resourceCount).eq(0);
      expect(triggers(t.game)).has.length(0);
      expect(t.game.scaleStepRewards).has.length(0);
    });

    it('a LOWERING (the Reds\' P3) is no trigger', () => {
      const t = owned();
      setVenusScaleLevel(t.game, 10);
      t.game.increaseVenusScaleLevel(t.p2, -1);
      expect(t.game.getVenusScaleLevel()).eq(8);
      expect(t.card.resourceCount).eq(0);
    });

    it('another scale is not Venus: oxygen and temperature pay nothing', () => {
      const t = owned();
      t.game.increaseOxygenLevel(t.p2, 1);
      t.game.increaseTemperature(t.p2, 1);
      expect(t.card.resourceCount).eq(0);
    });
  });

  describe('rule 8 — the data are ordinary data', () => {
    it('the owner\'s TR18 Martian Fiber pays +1 M€ per data the census adds — under an OPPONENT\'s raise', () => {
      const t = owned();
      t.p1.playedCards.push(new MartianFiber());
      t.p1.megaCredits = 0;
      t.game.increaseVenusScaleLevel(t.p2, 1);
      expect(t.card.resourceCount).eq(2);
      expect(t.p1.megaCredits).eq(2);
    });
  });

  it('rule 7 — the Venus tag moves RX12\'s chairman quest «play 2 Venus tags»', () => {
    const t = table();
    const {game, p1, parliament, card} = t;
    seatEnacted(parliament, quietResolutionOf(U));
    parliament.quest = {definition: {goal: {kind: 'tag', tag: Tag.VENUS}, count: 2}, source: GAS_EXPORT_ID, generation: game.generation, progress: new Map()};
    p1.megaCredits = 20;
    game.events.beginAction(p1, {kind: 'card', card: card.name, owner: p1.color}, {category: 'card-play'});
    try {
      p1.playCard(card);
    } finally {
      game.events.endScope();
    }
    runAllActions(game);
    expect(parliament.questProgressOf(p1)).eq(1);
  });

  describe('the forecast twin — what a Venus play promises, and the live raise keeps it', () => {
    function forecastOf(player: TestPlayer) {
      const asteroid = new SpinInducingAsteroid();
      player.cardsInHand.push(asteroid);
      return effectForecastForPlay(player, asteroid, cardPlayPreview(player, asteroid))
        .facts.filter((f) => f.source.name === CardName.VENUSIAN_CENSUS);
    }

    it('an opponent\'s Spin-Inducing Asteroid (Venus +2 steps): one exact fact on the owner\'s card, «+4 data» — and the play lands there', () => {
      const t = owned();
      t.card.resourceCount = 1;
      t.p2.megaCredits = 40;
      const facts = forecastOf(t.p2);
      expect(facts).has.length(1);
      expect(facts[0].certainty).eq('exact');
      expect(facts[0].source.channel).eq('global-parameter');
      expect(facts[0].recipient).deep.eq({kind: 'player', color: t.p1.color});
      expect(facts[0].effects[0]).deep.include({direction: 'gain', icon: 'data', amount: 4, current: 1, resulting: 5});
      t.p2.playCard(t.p2.cardsInHand.find((c) => c.name === CardName.SPIN_INDUCING_ASTEROID)!);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(5);
    });

    it('the owner\'s own play: the fact is the viewer\'s own («you»)', () => {
      const t = owned();
      t.p1.megaCredits = 40;
      const facts = forecastOf(t.p1);
      expect(facts).has.length(1);
      expect(facts[0].recipient).deep.eq({kind: 'you'});
    });

    it('at 28 % the forecast counts the ONE step the ceiling leaves: +2; at 30 % no fact at all', () => {
      const t = owned();
      t.p2.megaCredits = 40;
      setVenusScaleLevel(t.game, 28);
      expect(forecastOf(t.p2)[0]?.effects[0]).deep.include({amount: 2});
      setVenusScaleLevel(t.game, 30);
      expect(forecastOf(t.p2)).deep.eq([]);
    });
  });

  describe('rule 6 — the action is the shared census action', () => {
    it('A alone while B is refused (2 data): no prompt — the action IS +1 data; the refused B is shown', () => {
      const t = owned();
      t.card.resourceCount = 2;
      const preview = actionPreview(t.p1, t.card);
      expect(preview.branches.map((b) => b.title)).deep.eq([CENSUS_ADD_TITLE, CENSUS_VOTE_TITLE]);
      expect(preview.branches[1].unavailableReason).eq(CENSUS_SHORT_DATA_REASON);
      expect(t.card.action(t.p1)).is.undefined;
      expect(t.card.resourceCount).eq(3);
    });

    it('B at 3 data: an OrOptions whose giver is THIS card', () => {
      const t = owned();
      t.card.resourceCount = 3;
      const or = cast(t.card.action(t.p1), OrOptions);
      expect(or.choiceContext?.source).deep.eq({kind: 'card', card: CardName.VENUSIAN_CENSUS});
    });
  });

  describe('the scene\'s record — `GameModel.scaleStepRewards`', () => {
    it('one record per payout: the raise\'s levels, the owner, the gain, the credited raiser — and it rides the public model', () => {
      const t = owned();
      setVenusScaleLevel(t.game, 8);
      t.game.increaseVenusScaleLevel(t.p2, 2);
      const record = t.game.scaleStepRewards.at(-1);
      expect(record).deep.include({
        parameter: GlobalParameter.VENUS, steps: 2, before: 8, after: 12, owner: t.p1.color, card: CardName.VENUSIAN_CENSUS,
        gain: {kind: 'cardResource', resource: CardResource.DATA, amount: 4}, by: t.p2.color,
      });
      expect(record?.seq).is.a('number');
      for (const viewer of [t.p1, t.p2]) {
        expect(Server.getPlayerModel(viewer).game.scaleStepRewards?.at(-1)).deep.eq(record);
      }
    });

    it('the ring is bounded and its seq monotonic', () => {
      const t = owned();
      for (let i = 0; i < 12; i++) {
        t.game.increaseVenusScaleLevel(t.p2, 1);
      }
      expect(t.game.scaleStepRewards).has.length(8);
      const seqs = t.game.scaleStepRewards.map((r) => r.seq);
      expect([...seqs].sort((a, b) => a - b)).deep.eq(seqs);
      expect(new Set(seqs).size).eq(seqs.length);
    });
  });

  it('save / load: the stored data survive a round trip, the card still answers the scale (the ring does not travel)', () => {
    const t = owned();
    t.card.resourceCount = 5;
    t.game.increaseVenusScaleLevel(t.p2, 1);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const census = reloaded.getPlayerById(t.p1.id).tableau.get(CardName.VENUSIAN_CENSUS);
    expect(census?.resourceCount).eq(7);
    expect(reloaded.scaleStepRewards, 'presentation only — a restart loses the animation, never the rule').deep.eq([]);
    reloaded.increaseVenusScaleLevel(reloaded.getPlayerById(t.p2.id), 1);
    expect(census?.resourceCount).eq(9);
  });

  it('Aphrodite and the census answer the SAME raise, each its own owner, in generation order', () => {
    const t = owned();
    const before = t.p2.megaCredits;
    // p2 holds Aphrodite: one Venus step pays p1's census 2 data and p2's corporation 2 M€.
    t.p2.playedCards.push(new Aphrodite());
    t.game.increaseVenusScaleLevel(t.p1, 1);
    expect(t.card.resourceCount).eq(2);
    expect(t.p2.megaCredits - before).eq(2);
    expect(t.game.scaleStepRewards.map((r) => [r.owner, r.card, r.gain.kind])).deep.eq([
      [t.p1.color, CardName.VENUSIAN_CENSUS, 'cardResource'],
      [t.p2.color, CardName.APHRODITE, 'stock'],
    ]);
    expect(t.game.scaleStepRewards.at(-1)?.gain).deep.eq({kind: 'stock', resource: Resource.MEGACREDITS, amount: 2});
  });
});
