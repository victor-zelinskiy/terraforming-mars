import {expect} from 'chai';
import {CorporateEspionage} from '../../../src/server/cards/delta/CorporateEspionage';
import {DELTA_TRACK_TAGS, VP2_POSITION, VP5_POSITION} from '../../../src/server/delta/DeltaProjectExpansion';
import {DeltaEspionageInput} from '../../../src/server/delta/DeltaEspionageInput';
import {buildEspionageProjection} from '../../../src/server/delta/deltaEspionage';
import {SocialHeating} from '../../../src/server/cards/delta/SocialHeating';
import {DevelopmentManager} from '../../../src/server/cards/delta/DevelopmentManager';
import {StormSurgeBarrier} from '../../../src/server/cards/delta/StormSurgeBarrier';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Resource} from '../../../src/common/Resource';
import {IGame} from '../../../src/server/IGame';
import {IPlayer} from '../../../src/server/IPlayer';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {cast} from '../../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';

function playAllDeltaTrackTags(p: IPlayer) {
  p.playedCards.push(fakeCard({tags: DELTA_TRACK_TAGS.filter((t) => t !== undefined)}));
}

function logText(game: IGame): string {
  return game.gameLog.map((m) => m.message).join('\n');
}

function positionMovements(game: IGame) {
  return game.events.events.filter((e) => e.type === 'delta-position-changed');
}

/**
 * DP10 — CORPORATE ESPIONAGE: push another player 1 step back (unless they
 * are at a VP level), advance yourself 1 step (one required tag may be
 * ignored), and BOTH markers receive the reward of the stage they actually
 * land on — the target's whole resolution strictly BEFORE the owner's move.
 *
 * These specs pin the rule readings the card class documents: the mandatory
 * own advance as the play gate, the waiver through the shared evaluator, the
 * mandatory target pick, the VP/lower-bound protections, the strict order,
 * the exactly-once movements through the one ledger (two canonical facts),
 * the target-owned reward choices, and the MarsBot reading (retreats like
 * anyone, takes no row reward — the Solo Delta Project rule, named).
 */
describe('CorporateEspionage', () => {
  let card: CorporateEspionage;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;
  let third: TestPlayer;

  beforeEach(() => {
    card = new CorporateEspionage();
    [game, player, opponent, third] = testGame(3, {deltaProjectExpansion: true});
  });

  const playCard = () => cast(card.play(player), DeltaEspionageInput);

  it('registers with source-backed metadata', () => {
    expect(card.name).eq(CardName.CORPORATE_ESPIONAGE);
    expect(card.type).eq(CardType.EVENT);
    expect(card.cost).eq(5);
    expect(card.tags).deep.eq([Tag.EARTH]);
    expect(card.metadata.cardNumber).eq('DP10');
  });

  describe('the play gate — the mandatory own advance', () => {
    it('playable when the path requirements are fully met', () => {
      playAllDeltaTrackTags(player);
      expect(card.canPlay(player)).is.true;
      // No waiver is consumed or shown when none is needed.
      expect(buildEspionageProjection(player).owner.waivedTag).is.undefined;
    });

    it('one missing required tag is covered by the waiver — and NAMED', () => {
      // Position 0 → step to 1 requires BUILDING; the player has no tags.
      expect(player.deltaProjectData!.position).eq(0);
      expect(card.canPlay(player)).is.true;
      const projection = buildEspionageProjection(player);
      expect(projection.owner.legal).is.true;
      expect(projection.owner.waivedTag).eq(Tag.BUILDING);
    });

    it('two uncoverable required tags block the card', () => {
      player.deltaProjectData!.position = 1;
      // Step to 2 needs BUILDING + POWER on the path; the player has neither.
      expect(card.canPlay(player)).is.false;
      const reason = card.unplayableReason(player);
      expect(reason).is.not.undefined;
      expect(reason!.type).eq('tag');
    });

    it('the terminal position blocks the card', () => {
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = VP5_POSITION;
      expect(card.canPlay(player)).is.false;
      expect(card.unplayableReason(player)!.message).to.match(/end of the Hydronetwork/);
    });

    it('an occupied VP destination blocks the card', () => {
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 9;
      opponent.deltaProjectData!.position = VP2_POSITION;
      expect(card.canPlay(player)).is.false;
      expect(card.unplayableReason(player)!.message).to.match(/occupied/);
    });
  });

  describe('the projection', () => {
    it('lists every opponent, never the owner, blocked candidates included', () => {
      opponent.deltaProjectData!.position = 3;
      third.deltaProjectData!.position = VP2_POSITION;
      const projection = buildEspionageProjection(player);
      expect(projection.targets.map((t) => t.color)).deep.eq([opponent.color, third.color]);
      expect(projection.targets[0]).to.include({legal: true, fromPosition: 3, toPosition: 2});
      expect(projection.targets[1]).to.deep.include({legal: false, blocked: 'vp-protected'});
      expect(projection.hasLegalTarget).is.true;
    });

    it('a player on the track start is a named non-target', () => {
      const projection = buildEspionageProjection(player);
      expect(projection.targets[0]).to.deep.include({legal: false, blocked: 'track-start'});
    });

    it('states the target\'s OWN resulting reward (their tags, their tableau)', () => {
      opponent.deltaProjectData!.position = 7; // → 6, Plant stage: 1 plant per plant tag
      opponent.playedCards.push(fakeCard({tags: [Tag.PLANT, Tag.PLANT, Tag.PLANT]}));
      const projection = buildEspionageProjection(player);
      expect(projection.targets[0].reward).deep.eq({kind: 'stock', resource: Resource.PLANTS, amount: 3});
    });

    it('states the owner\'s resulting reward and passive movement bonuses', () => {
      playAllDeltaTrackTags(player);
      player.playedCards.push(new SocialHeating());
      player.deltaProjectData!.position = 2;
      const projection = buildEspionageProjection(player);
      expect(projection.owner.reward).deep.eq({kind: 'production', resource: Resource.MEGACREDITS, amount: 2});
      expect(projection.owner.movementBonuses).deep.eq([
        {card: CardName.SOCIAL_HEATING, resource: Resource.HEAT, amount: 1, before: 0, after: 1},
      ]);
    });
  });

  describe('target validation — loud, never corrective', () => {
    beforeEach(() => {
      playAllDeltaTrackTags(player);
    });

    it('with a legal candidate the target pick is MANDATORY', () => {
      opponent.deltaProjectData!.position = 3;
      const input = playCard();
      expect(() => input.process({type: 'deltaEspionage'})).to.throw(/target must be selected/);
      // Nothing moved, nothing was granted.
      expect(opponent.deltaProjectData!.position).eq(3);
      expect(player.deltaProjectData!.position).eq(0);
    });

    it('the owner can never be the target', () => {
      opponent.deltaProjectData!.position = 3;
      const input = playCard();
      expect(() => input.process({type: 'deltaEspionage', target: player.color})).to.throw(/no longer be pushed back/);
      expect(player.deltaProjectData!.position).eq(0);
    });

    it('a VP-protected player is refused', () => {
      opponent.deltaProjectData!.position = VP2_POSITION;
      third.deltaProjectData!.position = 3;
      const input = playCard();
      expect(() => input.process({type: 'deltaEspionage', target: opponent.color})).to.throw(/no longer be pushed back/);
      expect(opponent.deltaProjectData!.position).eq(VP2_POSITION);
    });

    it('a track-start player is refused', () => {
      third.deltaProjectData!.position = 3;
      const input = playCard();
      expect(() => input.process({type: 'deltaEspionage', target: opponent.color})).to.throw(/no longer be pushed back/);
    });

    it('a pinned stale position refuses instead of resolving an unseen move', () => {
      opponent.deltaProjectData!.position = 3;
      const input = playCard();
      expect(() => input.process({type: 'deltaEspionage', target: opponent.color, expectedTargetFrom: 5}))
        .to.throw(/has moved/);
      expect(opponent.deltaProjectData!.position).eq(3);
    });

    it('claiming «no target» while one exists is refused', () => {
      opponent.deltaProjectData!.position = 3;
      const input = playCard();
      expect(() => input.process({type: 'deltaEspionage'})).to.throw();
    });

    it('with NO legal target the attack is a NAMED skip and the owner still advances', () => {
      // Both opponents on the start cell — nobody can actually move back.
      const input = playCard();
      const projection = input.projection;
      expect(projection.hasLegalTarget).is.false;
      input.process({type: 'deltaEspionage'});
      runAllActions(game);
      expect(player.deltaProjectData!.position).eq(1);
      expect(logText(game)).to.match(/attack of .* is skipped/);
      // …and naming a target anyway would have been refused:
      // (fresh play on the next generation-like state)
      expect(positionMovements(game)).lengthOf(1);
    });
  });

  describe('the committed resolution', () => {
    beforeEach(() => {
      playAllDeltaTrackTags(player);
    });

    it('the target retreats exactly one actual step, first', () => {
      opponent.deltaProjectData!.position = 4; // → 3: +2 M€ production (deterministic)
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color, expectedTargetFrom: 4, expectedOwnerFrom: 0});
      // The retreat is committed inline — before the deferred owner advance.
      expect(opponent.deltaProjectData!.position).eq(3);
      expect(player.deltaProjectData!.position).eq(0);
      runAllActions(game);
      expect(player.deltaProjectData!.position).eq(1);
    });

    it('both players receive exactly ONE reward, each of their RESULTING stage', () => {
      opponent.deltaProjectData!.position = 4; // → 3: +2 M€ production
      const mcProdBefore = opponent.production.megacredits;
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color, ownerAnswer: {position: 1, rewardChoice: 1}});
      runAllActions(game);
      expect(opponent.production.megacredits).eq(mcProdBefore + 2);
      // Owner landed on stage 1 (Building) with the pre-answered choice: 2 plants.
      expect(player.plants).eq(2);
      expect(player.steel).eq(0);
    });

    it('the target records a stop at the resulting stage (their history stays honest)', () => {
      opponent.deltaProjectData!.position = 4;
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color});
      const stops = opponent.deltaProjectData!.stops ?? [];
      expect(stops[stops.length - 1]).to.deep.include({position: 3});
    });

    it('a target reward with a CHOICE belongs to the target — the owner waits', () => {
      opponent.deltaProjectData!.position = 2; // → 1: 2 steel OR 2 plants — the target's own decision
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color});
      runAllActions(game);
      // The target holds the prompt; the owner's advance has NOT run yet.
      const choice = cast(opponent.getWaitingFor(), OrOptions);
      expect(player.deltaProjectData!.position).eq(0);
      // The target answers (2 steel) → the barrier releases → the owner advances.
      const [waitingFor, cb] = opponent.popWaitingFor2();
      cast(waitingFor, OrOptions).options[0].cb(undefined);
      cb?.();
      runAllActions(game);
      expect(opponent.steel).eq(2);
      expect(player.deltaProjectData!.position).eq(1);
      expect(choice).is.not.undefined;
    });

    it('a stage-5 retreat draws for the TARGET (their private cards), before the owner moves', () => {
      opponent.deltaProjectData!.position = 6; // → 5: look at 4, keep 2
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color});
      runAllActions(game);
      const pick = cast(opponent.getWaitingFor(), SelectCard);
      expect(pick.cards).lengthOf(4);
      expect(player.deltaProjectData!.position).eq(0);
      const [waitingFor, cb] = opponent.popWaitingFor2();
      cast(waitingFor, SelectCard).process({type: 'card', cards: [pick.cards[0].name, pick.cards[1].name]});
      cb?.();
      runAllActions(game);
      expect(opponent.cardsInHand).lengthOf(2);
      expect(player.deltaProjectData!.position).eq(1);
    });

    it('the owner\'s interactive reward (stage 5) raises the owner\'s own prompt after the barrier', () => {
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 4; // → 5: draw 4 keep 2
      opponent.deltaProjectData!.position = 4; // → 3 deterministic
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color});
      runAllActions(game);
      expect(player.deltaProjectData!.position).eq(5);
      const pick = cast(player.getWaitingFor(), SelectCard);
      expect(pick.cards).lengthOf(4);
    });

    it('the owner\'s pre-answered repeat-action rides the invocation plan (nested choices preserved)', () => {
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 6; // → 7: repeat a used blue action
      opponent.deltaProjectData!.position = 4;
      // A used, repeatable action of the owner's: Storm Surge Barrier's energy mode.
      const ssb = new StormSurgeBarrier();
      player.playedCards.push(ssb);
      player.actionsThisGeneration.add(ssb.name);
      player.energy = 5; // keeps the SSB advance-mode candidate alive; energy mode needs no stock
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color,
        ownerAnswer: {position: 7, selectedCard: ssb.name}});
      runAllActions(game);
      expect(player.deltaProjectData!.position).eq(7);
      expect(logText(game)).to.match(/reused .* action via/);
    });

    it('entering the 2 VP terminal follows the standard claim (no stage reward, the VP line logs)', () => {
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 9;
      opponent.deltaProjectData!.position = 4;
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color});
      runAllActions(game);
      expect(player.deltaProjectData!.position).eq(VP2_POSITION);
      expect(logText(game)).to.match(/2 VP at game end/);
    });
  });

  describe('the canonical movement facts', () => {
    beforeEach(() => {
      playAllDeltaTrackTags(player);
    });

    it('publishes TWO separate facts with actor, from → to, signed steps and the attacker', () => {
      opponent.deltaProjectData!.position = 4;
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color});
      runAllActions(game);
      const movements = positionMovements(game);
      expect(movements).lengthOf(2);
      const [retreat, advance] = movements;
      expect(retreat.player).eq(opponent.color);
      expect(retreat.impact.deltaPosition).deep.eq({from: 4, to: 3, steps: -1});
      expect(retreat.source).deep.eq({kind: 'card', card: CardName.CORPORATE_ESPIONAGE, owner: player.color});
      expect(retreat.target).deep.eq({player: player.color});
      expect(retreat.tags).to.include('attack');
      expect(advance.player).eq(player.color);
      expect(advance.impact.deltaPosition).deep.eq({from: 0, to: 1, steps: 1});
      expect(advance.source).deep.eq({kind: 'card', card: CardName.CORPORATE_ESPIONAGE, owner: player.color});
    });

    it('Social Heating pays for the owner\'s ADVANCE only — a retreat is not an advance', () => {
      third.playedCards.push(new SocialHeating());
      opponent.deltaProjectData!.position = 4;
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color});
      runAllActions(game);
      // 1 heat for the owner's 1-step advance; the backward step pays nothing.
      expect(third.heat).eq(1);
    });

    it('Development Manager\'s advance threshold never sees the retreat', () => {
      opponent.playedCards.push(new DevelopmentManager());
      // 5 → 4 lands on the Space stage: +1 titanium production — below DM's
      // own production threshold, so any M€ paid could only have come from a
      // (wrongly fired) delta-advance hook.
      opponent.deltaProjectData!.position = 5;
      const mc = opponent.megaCredits;
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color});
      runAllActions(game);
      expect(opponent.megaCredits).eq(mc);
      expect(opponent.production.titanium).eq(1);
    });

    it('the retreat log names attacker, victim, stage and the card', () => {
      opponent.deltaProjectData!.position = 4;
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color});
      expect(logText(game)).to.match(/pushed .* back on the Hydronetwork/);
    });
  });

  describe('the owner\'s pre-answered landing ask', () => {
    beforeEach(() => {
      playAllDeltaTrackTags(player);
    });

    it('a choice-stage answer is consumed without a prompt', () => {
      player.deltaProjectData!.position = 1; // → 2: energy/heat production choice
      opponent.deltaProjectData!.position = 4;
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color, ownerAnswer: {position: 2, rewardChoice: 0}});
      runAllActions(game);
      expect(player.production.energy).eq(1);
      expect(player.getWaitingFor()).is.undefined;
    });

    it('an answer for a foreign position is refused structurally', () => {
      opponent.deltaProjectData!.position = 4;
      const input = playCard();
      expect(() => input.process({type: 'deltaEspionage', target: opponent.color, ownerAnswer: {position: 5, rewardChoice: 0}}))
        .to.throw(/your own destination/);
    });

    it('a stale answered pick degrades to the owner\'s own prompt, never a dropped reward', () => {
      player.deltaProjectData!.position = 6; // → 7: repeat — but the named card is not a candidate
      opponent.deltaProjectData!.position = 4;
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color,
        ownerAnswer: {position: 7, selectedCard: CardName.BIRDS}});
      runAllActions(game);
      // No candidate at all → the honest fizzle names itself.
      expect(logText(game)).to.match(/no usable action to repeat/);
    });
  });

  describe('MarsBot as a target — same contracts, the Solo reward rule named', () => {
    let agame: IGame;
    let human: TestPlayer;
    let bot: IPlayer;
    let acard: CorporateEspionage;

    beforeEach(() => {
      [agame, human, bot] = testAutomaGame({deltaProjectExpansion: true});
      acard = new CorporateEspionage();
      playAllDeltaTrackTags(human);
    });

    it('the bot appears among the candidates on common grounds', () => {
      bot.deltaProjectData!.position = 5;
      const projection = buildEspionageProjection(human);
      const botEntry = projection.targets.find((t) => t.color === bot.color);
      expect(botEntry).to.deep.include({legal: true, fromPosition: 5, toPosition: 4});
      expect(botEntry!.rewardSkipped).eq('automa-rules');
      expect(botEntry!.reward).is.undefined;
    });

    it('a VP-protected bot is protected like anyone', () => {
      bot.deltaProjectData!.position = VP2_POSITION;
      const projection = buildEspionageProjection(human);
      expect(projection.targets.find((t) => t.color === bot.color)).to.deep.include({legal: false, blocked: 'vp-protected'});
    });

    it('the bot retreats through the shared ledger, takes NO row reward (named), and never blocks the owner', () => {
      bot.deltaProjectData!.position = 2; // → 1 would be a CHOICE stage for a human
      const input = cast(acard.play(human), DeltaEspionageInput);
      input.process({type: 'deltaEspionage', target: bot.color});
      runAllActions(agame);
      expect(bot.deltaProjectData!.position).eq(1);
      // No prompt was deferred onto the bot (it never answers one) and no
      // stop/reward was recorded — the Solo rule, named in the log.
      expect(bot.deltaProjectData!.stops ?? []).lengthOf(0);
      expect(logText(agame)).to.match(/takes no Hydronetwork stage reward/);
      expect(human.deltaProjectData!.position).eq(1);
      const movements = positionMovements(agame);
      expect(movements.filter((m) => m.player === bot.color)).lengthOf(1);
      expect(movements.filter((m) => m.player === bot.color)[0].impact.deltaPosition).deep.eq({from: 2, to: 1, steps: -1});
    });
  });

  describe('exactly-once and idempotency', () => {
    beforeEach(() => {
      playAllDeltaTrackTags(player);
    });

    it('one committed play moves each marker exactly once and pays each reward exactly once', () => {
      opponent.deltaProjectData!.position = 4;
      const before = opponent.production.megacredits;
      const input = playCard();
      input.process({type: 'deltaEspionage', target: opponent.color});
      runAllActions(game);
      runAllActions(game); // a second drain finds nothing to repeat
      expect(positionMovements(game)).lengthOf(2);
      expect(opponent.production.megacredits).eq(before + 2);
      expect(opponent.deltaProjectData!.position).eq(3);
      expect(player.deltaProjectData!.position).eq(1);
    });

    it('a refused response leaves the world untouched — the ask stands, nothing half-ran', () => {
      opponent.deltaProjectData!.position = VP2_POSITION;
      third.deltaProjectData!.position = 4; // → 3: deterministic landing
      const input = playCard();
      expect(() => input.process({type: 'deltaEspionage', target: opponent.color})).to.throw();
      expect(opponent.deltaProjectData!.position).eq(VP2_POSITION);
      expect(player.deltaProjectData!.position).eq(0);
      expect(positionMovements(game)).lengthOf(0);
      // The same input then accepts a valid answer (the ask survived the refusal).
      input.process({type: 'deltaEspionage', target: third.color});
      runAllActions(game);
      expect(third.deltaProjectData!.position).eq(3);
      expect(player.deltaProjectData!.position).eq(1);
    });
  });
});
