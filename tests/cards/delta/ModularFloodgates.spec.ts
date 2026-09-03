import {expect} from 'chai';
import {ModularFloodgates} from '../../../src/server/cards/delta/ModularFloodgates';
import {DELTA_TRACK_TAGS, DP10_ADVANCE, DeltaProjectExpansion, MAX_TRACK_POSITION, VP2_POSITION, VP5_POSITION} from '../../../src/server/delta/DeltaProjectExpansion';
import {DeltaBlockadeInput} from '../../../src/server/delta/DeltaBlockadeInput';
import {buildBlockadeProjection} from '../../../src/server/delta/deltaFloodgates';
import {activeDeltaBlockade, commitDeltaMovement} from '../../../src/server/delta/deltaMovement';
import {DeltaProject} from '../../../src/server/cards/delta/DeltaProject';
import {DeltaWorks} from '../../../src/server/cards/delta/DeltaWorks';
import {DutchMountains} from '../../../src/server/cards/delta/DutchMountains';
import {StormSurgeBarrier} from '../../../src/server/cards/delta/StormSurgeBarrier';
import {CorporateEspionage} from '../../../src/server/cards/delta/CorporateEspionage';
import {BonusDeltaAdvance} from '../../../src/server/deferredActions/BonusDeltaAdvance';
import {AutomaDeltaProject} from '../../../src/server/automa/AutomaDeltaProject';
import {potentialHydroAdvance} from '../../../src/server/models/potentialActions';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Payment} from '../../../src/common/inputs/Payment';
import {IGame} from '../../../src/server/IGame';
import {IPlayer} from '../../../src/server/IPlayer';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {cast} from '../../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {marsBotOf} from '../../../src/server/automa/AutomaUtil';

function playAllDeltaTrackTags(p: IPlayer) {
  p.playedCards.push(fakeCard({tags: DELTA_TRACK_TAGS.filter((t) => t !== undefined)}));
}

function logText(game: IGame): string {
  return game.gameLog.map((m) => m.message).join('\n');
}

function blockadeEvents(game: IGame) {
  return game.events.events.filter((e) => e.type === 'delta-blockade-changed');
}

/**
 * DP11 — MODULAR FLOODGATES: one blue-card action, exactly one of two
 * variants — (A) store 1 steel ON the card («counts as on your player
 * board»: the `floodgateSteel` payment source), or (B) remove 1 stored steel
 * and deploy a BLOCKADE in front of another player's marker (excluding the
 * VP steps), forbidding EVERY forward Hydronetwork advancement of theirs for
 * this generation; removed at the start of the next one.
 *
 * These specs pin the rule readings the card class documents: the resource
 * lives on the card and never merges into `player.steel`; the spend paths
 * (building payment at the live steel value, the DP06 energy substitution)
 * deduct from the card and are never auto-taken; the blockade is ONE
 * player-targeted domain status every movement source obeys (the standard
 * action, DP03, DP04, DP07's multi-step, DP10's own advance, the MarsBot
 * Increase, and the ledger's hard gate for any future writer), while
 * non-movement flows (DP08's reward-only grant, a backward push) stay legal;
 * the expiration is the generation boundary's own, exactly once, steel not
 * returned.
 */
describe('ModularFloodgates', () => {
  let card: ModularFloodgates;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;
  let third: TestPlayer;

  beforeEach(() => {
    card = new ModularFloodgates();
    [game, player, opponent, third] = testGame(3, {deltaProjectExpansion: true});
    player.playedCards.push(card);
  });

  /** Drive variant B end to end: action → OrOptions → the blockade input →
   *  the target response. */
  function deployAgainst(target: TestPlayer): void {
    const options = cast(card.action(player), OrOptions);
    const input = cast(options.options[1].cb(undefined), DeltaBlockadeInput);
    input.process({type: 'deltaBlockade', target: target.color});
  }

  it('registers with source-backed metadata', () => {
    expect(card.name).eq(CardName.MODULAR_FLOODGATES);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(7);
    expect(card.tags).deep.eq([Tag.EARTH]);
    expect(card.resourceType).eq(CardResource.STEEL);
    expect(card.metadata.cardNumber).eq('DP11');
  });

  describe('the action variants', () => {
    it('the action is always available — variant A has no precondition', () => {
      expect(card.canAct()).is.true;
      expect(card.resourceCount).eq(0);
    });

    it('with no stored steel the action collapses to variant A alone, and adds the steel to the CARD', () => {
      const before = player.steel;
      const result = card.action(player);
      // One live option auto-resolves (the autoResolveSingle convention).
      expect(result).is.undefined;
      expect(card.resourceCount).eq(1);
      // NEVER the player board: the resource lives on the card.
      expect(player.steel).eq(before);
      expect(player.production.steel).eq(0);
    });

    it('with a stored steel and a legal target the action offers BOTH variants', () => {
      card.resourceCount = 1;
      const options = cast(card.action(player), OrOptions);
      expect(options.options).has.length(2);
    });

    it('variant B unavailability NAMES its one blocker, in check order', () => {
      // 0 steel on the card — the module premise.
      const preview0 = card.actionPreview(player);
      expect(preview0.branches[1].available).is.false;
      expect(preview0.branches[1].unavailableReason).eq('Not enough resources on this card');
      // Steel present but no legal target (everyone protected).
      card.resourceCount = 1;
      opponent.deltaProjectData!.position = 9; // next cell = VP2 → protected
      third.deltaProjectData!.position = MAX_TRACK_POSITION; // track end
      const preview1 = card.actionPreview(player);
      expect(preview1.branches[1].available).is.false;
      expect(preview1.branches[1].unavailableReason).to.match(/No opponent can receive/);
      // Variant A stays live either way.
      expect(preview0.branches[0].available).is.true;
      expect(preview1.branches[0].available).is.true;
    });
  });

  describe('the projection (one derivation for selector and commit)', () => {
    beforeEach(() => {
      card.resourceCount = 1;
    });

    it('lists every opponent, legal and blocked alike, never the owner', () => {
      const projection = buildBlockadeProjection(player, card);
      expect(projection.targets.map((t) => t.color)).deep.eq([opponent.color, third.color]);
      expect(projection.cardSteel).eq(1);
      expect(projection.activeGeneration).eq(game.generation);
    });

    it('a target whose NEXT cell is a VP step is protected — positions 9 and 10', () => {
      opponent.deltaProjectData!.position = VP2_POSITION - 1;
      third.deltaProjectData!.position = VP2_POSITION;
      const projection = buildBlockadeProjection(player, card);
      expect(projection.targets[0]).to.include({legal: false, blocked: 'vp-protected'});
      expect(projection.targets[1]).to.include({legal: false, blocked: 'vp-protected'});
    });

    it('the end of the track leaves nothing to block', () => {
      opponent.deltaProjectData!.position = VP5_POSITION;
      const projection = buildBlockadeProjection(player, card);
      expect(projection.targets[0]).to.include({legal: false, blocked: 'track-end'});
    });

    it('an already-blocked target is named, not re-blockable', () => {
      DeltaProjectExpansion.placeBlockade(opponent, {source: card.name, by: player});
      const projection = buildBlockadeProjection(player, card);
      expect(projection.targets[0]).to.include({legal: false, blocked: 'already-blocked'});
    });

    it('a legal target carries the blockade cell (position + 1)', () => {
      opponent.deltaProjectData!.position = 3;
      const projection = buildBlockadeProjection(player, card);
      expect(projection.targets[0]).to.include({legal: true, position: 3, blockadePosition: 4});
    });

    it('a target whose standard advance is already spent is WARNED, never hidden or blocked', () => {
      opponent.deltaProjectData!.usedThisGeneration = true;
      const projection = buildBlockadeProjection(player, card);
      expect(projection.targets[0]).to.include({legal: true, standardMoveSpent: true});
      // …and the flag is absent (not false) for a fresh target — the
      // historical payload stays byte-identical.
      expect('standardMoveSpent' in projection.targets[1]).is.false;
    });
  });

  describe('the input — loud validation, never corrective', () => {
    beforeEach(() => {
      card.resourceCount = 1;
    });

    it('refuses a missing / illegal / unknown target and a stale position pin', () => {
      const input = new DeltaBlockadeInput(buildBlockadeProjection(player, card));
      expect(() => input.process({type: 'deltaBlockade'} as never)).to.throw();
      expect(() => input.process({type: 'deltaBlockade', target: player.color})).to.throw(/no longer be blocked/);
      expect(() => input.process({type: 'deltaBlockade', target: opponent.color, expectedTargetFrom: 5})).to.throw(/has moved/);
    });

    it('refuses when the card no longer holds a steel', () => {
      const projection = buildBlockadeProjection(player, card);
      card.resourceCount = 0;
      const input = new DeltaBlockadeInput({...projection, cardSteel: 0});
      expect(() => input.process({type: 'deltaBlockade', target: opponent.color})).to.throw(/No steel resource/);
    });
  });

  describe('the commit — atomic spend + one player-targeted status', () => {
    beforeEach(() => {
      card.resourceCount = 2;
    });

    it('removes exactly one steel from the CARD and writes the blockade', () => {
      const steelBefore = player.steel;
      deployAgainst(opponent);
      expect(card.resourceCount).eq(1);
      expect(player.steel).eq(steelBefore);
      const blockade = opponent.deltaProjectData!.blockade;
      expect(blockade).deep.eq({by: player.color, card: CardName.MODULAR_FLOODGATES, generation: game.generation});
      expect(activeDeltaBlockade(opponent)).is.not.undefined;
      expect(logText(game)).to.match(/deployed .* their advancement is blocked/);
    });

    it('publishes the canonical fact: victim as player, deployer as attacker', () => {
      deployAgainst(opponent);
      const events = blockadeEvents(game);
      expect(events).has.length(1);
      const e = events[0];
      expect(e.player).eq(opponent.color);
      expect(e.target?.player).eq(player.color);
      expect(e.source).deep.include({kind: 'card', card: CardName.MODULAR_FLOODGATES, owner: player.color});
      expect(e.impact.deltaBlockade).deep.eq({phase: 'placed', untilGeneration: game.generation + 1});
      expect(e.tags).to.include('attack');
    });

    it('the commit re-validates the live target — a protected one throws before anything mutates', () => {
      const options = cast(card.action(player), OrOptions);
      const input = cast(options.options[1].cb(undefined), DeltaBlockadeInput);
      // The state moves under the standing input: the target reaches pos 9.
      opponent.deltaProjectData!.position = VP2_POSITION - 1;
      expect(() => input.process({type: 'deltaBlockade', target: opponent.color})).to.throw();
      expect(card.resourceCount).eq(2);
      expect(opponent.deltaProjectData!.blockade).is.undefined;
    });
  });

  describe('THE ONE CAN-ADVANCE CONTRACT — every forward source is closed', () => {
    beforeEach(() => {
      card.resourceCount = 1;
      playAllDeltaTrackTags(opponent);
      opponent.energy = 10;
      deployAgainst(opponent);
    });

    it('the standard advance answers no steps, no potential, and the ONE named reason', () => {
      expect(DeltaProjectExpansion.getValidAdvanceSteps(opponent)).deep.eq([]);
      expect(DeltaProjectExpansion.maxSteps(opponent)).eq(0);
      expect(potentialHydroAdvance(opponent)).is.false;
      const dp01 = new DeltaProject();
      expect(dp01.canAct(opponent)).is.false;
      expect(dp01.actionUnavailableReason(opponent)!.message).to.match(/blocked by Modular Floodgates/);
    });

    it('the preview states the blockade and confirms nothing', () => {
      const preview = DeltaProjectExpansion.getPreview(opponent);
      expect(preview.blockade).deep.eq({by: player.color, card: CardName.MODULAR_FLOODGATES, generation: game.generation});
      expect(preview.maxLegalSteps).eq(0);
    });

    it('DP03\'s bonus step drops with a NAMED skip — never silently', () => {
      const source = fakeCard({name: CardName.DYNAMIC_OCEAN_BARRIER});
      const offer = new BonusDeltaAdvance(opponent, source);
      expect(offer.execute()).is.undefined;
      expect(logText(game)).to.match(/could not take the bonus Hydronetwork step/);
    });

    it('DP04\'s advance branch is refused with the blockade reason', () => {
      const dp04 = new StormSurgeBarrier();
      const reason = DeltaProjectExpansion.bonusAdvanceUnavailableReason(opponent, undefined);
      expect(reason!.message).to.match(/blocked by Modular Floodgates/);
      // The card's own preview names it on the branch.
      opponent.playedCards.push(dp04);
      const preview = dp04.actionPreview(opponent);
      expect(preview.branches[1].available).is.false;
      expect(preview.branches[1].unavailableReason).to.match(/blocked by Modular Floodgates/);
    });

    it('DP07\'s multi-step advance is refused before any payment or traversal', () => {
      opponent.playedCards.push(fakeCard({name: CardName.DELTA_SURGE, grantsDeltaTraversalRewards: true}));
      expect(() => DeltaProjectExpansion.advance(opponent, 3)).to.throw(/Invalid Delta Project advance/);
      expect(opponent.deltaProjectData!.position).eq(0);
      expect(opponent.energy).eq(10);
    });

    it('DP10\'s own advance is blocked — the waiver does not pierce a blockade', () => {
      expect(DeltaProjectExpansion.getValidAdvanceSteps(opponent, DP10_ADVANCE)).deep.eq([]);
      const dp10 = new CorporateEspionage();
      expect(dp10.canPlay(opponent)).is.false;
      expect(dp10.unplayableReason(opponent)!.message).to.match(/blocked by Modular Floodgates/);
    });

    it('the LEDGER is the hard gate: a direct commit attempt throws', () => {
      expect(() => commitDeltaMovement(opponent, 1, {kind: 'standard'})).to.throw(/blocked by Modular Floodgates/);
      expect(opponent.deltaProjectData!.position).eq(0);
    });

    it('a generic future movement command is closed by the same gate', () => {
      expect(() => commitDeltaMovement(opponent, 2, {kind: 'card', card: CardName.DELTA_SURGE})).to.throw(/blocked/);
    });
  });

  describe('what the blockade deliberately does NOT block', () => {
    beforeEach(() => {
      card.resourceCount = 1;
    });

    it('DP08\'s reward-only grant (no movement) stays legal', () => {
      playAllDeltaTrackTags(opponent);
      opponent.deltaProjectData!.position = 4;
      deployAgainst(opponent);
      const dp08 = new DutchMountains();
      opponent.energy = 5;
      expect(DeltaProjectExpansion.rewardClaimableStages(opponent)).deep.eq([1, 2, 3, 4]);
      expect(dp08.canAct(opponent)).is.true;
      // The grant itself resolves (stage 3: +2 M€ production) — no throw.
      DeltaProjectExpansion.grantStageReward(opponent, 3, {source: dp08.name});
      expect(opponent.production.megacredits).eq(2);
    });

    it('a backward push stays legal, and the blockade stays ATTACHED to the player', () => {
      opponent.deltaProjectData!.position = 3;
      deployAgainst(opponent);
      DeltaProjectExpansion.retreat(opponent, {source: CardName.CORPORATE_ESPIONAGE, by: third});
      runAllActions(game);
      expect(opponent.deltaProjectData!.position).eq(2);
      // Player-targeted, never cell-bound: the status survives the move…
      expect(activeDeltaBlockade(opponent)).is.not.undefined;
      // …and keeps blocking forward movement from the NEW position.
      playAllDeltaTrackTags(opponent);
      opponent.energy = 5;
      expect(DeltaProjectExpansion.getValidAdvanceSteps(opponent)).deep.eq([]);
    });

    it('an espionage attack against a BLOCKED player is expressible (the attacker\'s own advance is theirs)', () => {
      opponent.deltaProjectData!.position = 3;
      deployAgainst(opponent);
      expect(DeltaProjectExpansion.retreatBlockedReason(opponent)).is.undefined;
    });
  });

  describe('MarsBot — a full citizen of the same contract', () => {
    it('the bot is a legal target on the shared terms', () => {
      const [g, human] = testAutomaGame({deltaProjectExpansion: true});
      const bot = marsBotOf(g);
      const botCard = new ModularFloodgates();
      human.playedCards.push(botCard);
      botCard.resourceCount = 1;
      const projection = buildBlockadeProjection(human, botCard);
      const botTarget = projection.targets.find((t) => t.color === bot.color);
      expect(botTarget).is.not.undefined;
      expect(botTarget!.legal).is.true;
    });

    it('a blocked bot does not move, spends no power, and its turn NAMES the prevented Increase', () => {
      const [g, human] = testAutomaGame({deltaProjectExpansion: true});
      const bot = marsBotOf(g);
      const botCard = new ModularFloodgates();
      human.playedCards.push(botCard);
      botCard.resourceCount = 1;
      const options = cast(botCard.action(human), OrOptions);
      const input = cast(options.options[1].cb(undefined), DeltaBlockadeInput);
      input.process({type: 'deltaBlockade', target: bot.color});
      expect(activeDeltaBlockade(bot)).is.not.undefined;
      // Give the bot the power/tags it would otherwise advance with.
      const automa = g.automa!;
      for (const track of automa.board.tracks) {
        track.position = 3;
      }
      expect(AutomaDeltaProject.getValidAdvanceSteps(g)).deep.eq([]);
      const powerBefore = automa.deltaPowerConsumed;
      const positionBefore = bot.deltaProjectData!.position;
      AutomaDeltaProject.resolve(g);
      expect(bot.deltaProjectData!.position).eq(positionBefore);
      expect(automa.deltaPowerConsumed).eq(powerBefore);
      expect(logText(g)).to.match(/could not advance on the Hydronetwork — blocked by/);
      // The same domain status as a human's — one shape, one lifecycle.
      expect(bot.deltaProjectData!.blockade!.card).eq(CardName.MODULAR_FLOODGATES);
    });
  });

  describe('expiration — the generation boundary, exactly once', () => {
    beforeEach(() => {
      card.resourceCount = 1;
      deployAgainst(opponent);
    });

    it('a NEXT-generation record is inert for the validator even before cleanup', () => {
      playAllDeltaTrackTags(opponent);
      opponent.energy = 5;
      // Simulate the boundary crossing before the cleanup ran.
      (game as {generation: number}).generation++;
      expect(activeDeltaBlockade(opponent)).is.undefined;
      expect(DeltaProjectExpansion.getValidAdvanceSteps(opponent)).to.not.deep.eq([]);
    });

    it('expireBlockades removes the record exactly once, returns NO steel, and records the quiet fact', () => {
      (game as {generation: number}).generation++;
      DeltaProjectExpansion.expireBlockades(game);
      expect(opponent.deltaProjectData!.blockade).is.undefined;
      // The module steel is spent, not refunded — to either pool.
      expect(card.resourceCount).eq(0);
      const expired = blockadeEvents(game).filter((e) => e.impact.deltaBlockade?.phase === 'expired');
      expect(expired).has.length(1);
      expect(expired[0].tags ?? []).to.not.include('attack');
      expect(logText(game)).to.match(/blockade in front of .* is removed/);
      // Exactly once: a second sweep finds nothing.
      DeltaProjectExpansion.expireBlockades(game);
      expect(blockadeEvents(game).filter((e) => e.impact.deltaBlockade?.phase === 'expired')).has.length(1);
    });

    it('an ACTIVE blockade survives a sweep of its own generation (no early removal)', () => {
      DeltaProjectExpansion.expireBlockades(game);
      expect(opponent.deltaProjectData!.blockade).is.not.undefined;
    });
  });

  describe('save / reload', () => {
    it('the stored steel and the standing blockade both survive serialization', () => {
      card.resourceCount = 2;
      deployAgainst(opponent);
      const serializedTarget = opponent.serialize();
      const serializedActor = player.serialize();
      expect(serializedTarget.deltaProject?.blockade).deep.eq({by: player.color, card: CardName.MODULAR_FLOODGATES, generation: game.generation});
      const actorCard = serializedActor.playedCards.find((c) => c.name === CardName.MODULAR_FLOODGATES);
      expect(actorCard?.resourceCount).eq(1);
    });
  });

  describe('the payment source — floodgateSteel', () => {
    beforeEach(() => {
      card.resourceCount = 3;
    });

    it('is offered exactly where ordinary steel is (building tags), at the live steel value', () => {
      player.steel = 0;
      player.megaCredits = 0;
      // A 6 M€ bill payable with steel: 3 card steel at value 2 covers it —
      // the availability aggregate counts the CARD's pool (never doubled).
      expect(player.canAfford({cost: 6, steel: true, floodgateSteel: true})).is.true;
      expect(player.canAfford({cost: 7, steel: true, floodgateSteel: true})).is.false;
      expect(player.payingAmount(Payment.of({floodgateSteel: 3}), {floodgateSteel: true})).eq(6);
      // Modifier: steel value 3 (Advanced Alloys) raises the same unit.
      player.increaseSteelValue();
      expect(player.payingAmount(Payment.of({floodgateSteel: 3}), {floodgateSteel: true})).eq(9);
      player.decreaseSteelValue();
    });

    it('is NOT usable where steel is not (no building tag)', () => {
      expect(player.payingAmount(Payment.of({floodgateSteel: 3}), {})).eq(0);
    });

    it('canSpend counts the CARD, so one unit can never serve two purposes', () => {
      expect(player.canSpend(Payment.of({floodgateSteel: 3}))).is.true;
      expect(player.canSpend(Payment.of({floodgateSteel: 4}))).is.false;
      // A deploy consumes one — the spendable pool follows the card.
      deployAgainst(opponent);
      expect(player.getSpendable('floodgateSteel')).eq(2);
      expect(player.canSpend(Payment.of({floodgateSteel: 3}))).is.false;
    });

    it('pay() deducts from the CARD, never the stock, and records the payment', () => {
      const steelBefore = player.steel;
      player.pay(Payment.of({floodgateSteel: 2}));
      expect(card.resourceCount).eq(1);
      expect(player.steel).eq(steelBefore);
      const paymentEvents = game.events.events.filter((e) =>
        e.impact.cardResourcesSpentAsPayment !== undefined || (e.impact.cardResources ?? []).some((cr) => cr.target === CardName.MODULAR_FLOODGATES && cr.amount < 0));
      expect(paymentEvents.length).greaterThan(0);
    });

    it('a real building play spends the mix atomically through checkPaymentAndPlayCard', () => {
      player.steel = 1;
      player.megaCredits = 1;
      const building = fakeCard({name: 'Floodgate Mix Building' as CardName, cost: 7, tags: [Tag.BUILDING]});
      player.cardsInHand.push(building);
      // 1 M€ + 1 steel (2) + 2 card steel (4) = 7.
      player.checkPaymentAndPlayCard(building, Payment.of({megacredits: 1, steel: 1, floodgateSteel: 2}));
      runAllActions(game);
      expect(card.resourceCount).eq(1);
      expect(player.steel).eq(0);
      expect(player.megaCredits).eq(0);
    });
  });

  describe('DP06 — card steel as energy for the Hydronetwork advance', () => {
    beforeEach(() => {
      card.resourceCount = 2;
      playAllDeltaTrackTags(player);
      player.playedCards.push(new DeltaWorks());
    });

    it('widens the substitute pool as its OWN source — only under Delta Works', () => {
      expect(DeltaWorks.floodgateSteelSubstituteAvailable(player)).eq(2);
      const preview = DeltaProjectExpansion.getPreview(player);
      expect(preview.availableFloodgateSteelSubstitute).eq(2);
      // Without Delta Works the pool answers 0 — the rule is DP06's.
      const [, loner] = testGame(2, {deltaProjectExpansion: true});
      const lonerCard = new ModularFloodgates();
      loner.playedCards.push(lonerCard);
      lonerCard.resourceCount = 2;
      expect(DeltaWorks.floodgateSteelSubstituteAvailable(loner)).eq(0);
    });

    it('an explicit mix pays with card steel — deducted from the card, 1:1', () => {
      player.energy = 1;
      DeltaProjectExpansion.advance(player, 3, undefined, {payment: {energy: 1, steel: 0, cardSteel: 2}});
      runAllActions(game);
      expect(player.deltaProjectData!.position).eq(3);
      expect(player.energy).eq(0);
      expect(card.resourceCount).eq(0);
      expect(logText(game)).to.match(/of the steel came from/);
    });

    it('a mixed three-source payment spends each pool exactly as declared', () => {
      player.energy = 1;
      player.steel = 1;
      DeltaProjectExpansion.advance(player, 3, undefined, {payment: {energy: 1, steel: 1, cardSteel: 1}});
      runAllActions(game);
      expect(player.deltaProjectData!.position).eq(3);
      expect(player.energy).eq(0);
      expect(player.steel).eq(0);
      expect(card.resourceCount).eq(1);
    });

    it('the DEFAULT mix never touches the card — a deficit refuses instead of auto-draining', () => {
      player.energy = 1;
      player.steel = 0;
      expect(() => DeltaProjectExpansion.advance(player, 3)).to.throw(/Not enough energy/);
      expect(card.resourceCount).eq(2);
      expect(player.deltaProjectData!.position).eq(0);
    });

    it('over-claiming the card refuses atomically', () => {
      // The budget admits 3 steps (1 energy + 2 card steel), so the refusal
      // is the SOURCE cap itself, not the earlier step-count gate.
      player.energy = 1;
      expect(() => DeltaProjectExpansion.advance(player, 3, undefined, {payment: {energy: 0, steel: 0, cardSteel: 3}}))
        .to.throw(/Not enough steel on Modular Floodgates/);
      expect(card.resourceCount).eq(2);
      expect(player.deltaProjectData!.position).eq(0);
    });

    it('card steel cannot substitute energy without Delta Works', () => {
      const [, loner] = testGame(2, {deltaProjectExpansion: true});
      playAllDeltaTrackTags(loner);
      const lonerCard = new ModularFloodgates();
      loner.playedCards.push(lonerCard);
      lonerCard.resourceCount = 2;
      // Energy alone admits the 2-step move, so the refusal is the
      // substitution rule itself (DP06 absent), not the budget.
      loner.energy = 2;
      expect(() => DeltaProjectExpansion.advance(loner, 2, undefined, {payment: {energy: 1, steel: 0, cardSteel: 1}}))
        .to.throw(/without Delta Works/);
    });
  });
});
