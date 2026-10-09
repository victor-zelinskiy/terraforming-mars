import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentAdvanceModel, ParliamentModel} from '@/common/models/ParliamentModel';
import {markerTimings} from '@/client/console/hydroMarker/hydroMarkerModel';
import {
  agendaWalkBonuses, agendaWalkFlow, agendaWalkHostFor, agendaWalkLiveIn, agendaWalkOwedTo, detectAgendaWalk, dropAgendaWalkPromise,
  promiseAgendaWalk, questBeforeWalk, releaseAgendaWalkHolds, releaseAgendaWalkQuest, resetAgendaWalkFlow, seedAgendaWalkHolds,
} from '@/client/console/parliament/agendaWalk';
import {
  AGENDA_BEAT_GAP_MS, AGENDA_SEGMENT_MS, AGENDA_WALK_HOLD_BASE_MS, AGENDA_WALK_HOLD_STEP_MS, AgendaWalkBeatScheduler, AgendaWalkLeg, agendaWalkBudgetMs,
  agendaWalkHoldMs, agendaWalkPlan, runAgendaWalk,
} from '@/client/console/parliament/agendaWalkDirector';
import {finishParliamentFlights, scheduleHurriedParliamentBeat, setParliamentFlightsHurried} from '@/client/console/parliament/parliamentFlights';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {
  agendaCardOwed, parliamentAgendaBonusHeld, parliamentParksReveal, parliamentRewardState, queueAgendaBonuses, RATING_RAIL_KEY, resetParliamentRewards,
} from '@/client/console/parliament/parliamentRewardBeat';
import {agendaWalkMotion, deliverAgendaStepReward} from '@/client/console/parliament/agendaWalkDirector';
import {abortBoardCardBonus, boardCardBonusState, resetBoardCardBonus} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {drawnCardsState, reconcileDrawnCards} from '@/client/components/drawnCards/drawnCardsState';
import {releaseInFlight} from '@/client/console/handDock/handDeliveryState';
import {CardModel} from '@/common/models/CardModel';
import {parliamentCrumbCommitted, parliamentCrumbStage, parliamentFlow, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {descendWorkspaceFrame, enterWorkspace, resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {heroRewardEffectsOf, playCommitVerb, playDoorOf} from '@/client/console/consolePlayCardComposer';
import {AGENDA_WALK_STEP_STAGE} from '@/client/console/consoleTaskRouter';
import {ActionPreviewBranch, AgendaWalkModel} from '@/common/models/ActionPreviewModel';

/*
 * «КАРЬЕРА» — a card's WALK of the Agenda track (TR04 Minority Representation),
 * the PURE half: what the answer carried is detected by its RECORD (never a
 * title), its holds are seeded only when somebody is there to play them, the
 * workspace's conclusion reads the walk as an owed step and then as a live
 * outcome, and the director's PLAN is one leg per recorded step — the first
 * charging, the last releasing — with N = 1 costing exactly the sitting's own
 * beat.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const A = 'RDX_GREENS_AQUIFER_CONTEST#0';
const CARD = CardName.MINORITY_REPRESENTATION;

function model(over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {
    slots: [{instance: A, resolution: 'RDX_GREENS_AQUIFER_CONTEST', party: PartyName.GREENS, votes: [], totalVotes: 0, isWinning: true, tiePriority: 1, viewerVotes: 0}],
    rulingParty: PartyName.GREENS, popularSupport: {}, deckSize: 10, discardSize: 0, neutralSupply: 14, botMode: 'none',
    players: [BLUE, RED].map((color) => ({
      color, participates: true, lobby: true, reserve: 5, onResolutions: 0,
      chairman: false, agenda: color === BLUE ? 1 : 3, influence: color === BLUE ? 1 : 2, access: [], partyActionUses: {}, resolutionActionUses: 0,
    })),
    ...over,
  } as unknown as ParliamentModel;
}

function view(parliament: ParliamentModel, generation = 3): PlayerViewModel {
  return {
    thisPlayer: {color: BLUE},
    players: [{color: BLUE, name: 'Blue'}, {color: RED, name: 'Red'}],
    game: {generation, parliament},
  } as unknown as PlayerViewModel;
}

/** The walk TR04 makes from step 1: the TR of step 2, then the influence of step 3. */
const WALK: ParliamentAdvanceModel = {seq: 5, player: BLUE, from: 1, to: 3, steps: [{to: 2, bonus: 'tr'}, {to: 3}], reason: 'card', card: CARD, generation: 3};

function pair(after: Partial<ParliamentAdvanceModel> = {}) {
  const before = view(model({lastAdvance: {seq: 4, player: RED, from: 0, to: 1, steps: [{to: 1}], reason: 'phase', generation: 2}} as never));
  const walked = view(model({lastAdvance: {...WALK, ...after}} as never));
  return {before, after: walked};
}

function resetAll(): void {
  resetAgendaWalkFlow();
  resetParliamentHolds();
  resetParliamentRewards();
  resetParliamentFlow();
  resetWorkspaceStack();
  resetBoardCardBonus();
  reconcileDrawnCards([]);
  agendaWalkMotion.awaitingCard = undefined;
}

/** A Parliament with its Agenda track ON SCREEN (the cover scene's one precondition), torn down by the caller. */
function trackOnScreen(): HTMLElement {
  const parl = document.createElement('div');
  parl.className = 'con-parl';
  const track = document.createElement('div');
  track.setAttribute('data-parl-agenda', '');
  parl.appendChild(track);
  document.body.appendChild(parl);
  return parl;
}

/** The server dealt the card step's batch with the answer: ONE reveal of `source: agenda`. */
function agendaBatch(name: CardName, id = 41): void {
  reconcileDrawnCards([{id, source: {type: 'agenda'}, cards: [{name} as CardModel]}]);
}

/** The hand the card was played from, with its descent standing (the composer's home). */
function handDescended(): void {
  enterWorkspace('hand', {anchor: {type: 'always'}});
  descendWorkspaceFrame('hand', CARD, 'Playing', {type: 'always'});
}

describe('«КАРЬЕРА» — a card\'s walk of the Agenda track (the pure half)', () => {
  beforeEach(resetAll);
  after(resetAll);

  describe('DETECT — the record, never a title', () => {
    it('the viewer\'s own card walk whose serial GREW; never an echo, a first view, a rival\'s or the quest\'s', () => {
      const {before, after} = pair();
      expect(detectAgendaWalk(before, after)).deep.include({seq: 5, player: BLUE, from: 1, to: 3, reason: 'card', card: CARD});
      expect(detectAgendaWalk(after, after), 'the same record twice (an echo frame)').is.undefined;
      expect(detectAgendaWalk(undefined, after), 'a first view — a reload has nothing to move from').is.undefined;
      expect(detectAgendaWalk(before, pair({player: RED}).after), 'a rival\'s walk is the tier\'s watcher\'s').is.undefined;
      expect(detectAgendaWalk(before, pair({reason: 'quest'}).after), 'the quest\'s step is «ПРЕДСЕДАТЕЛЬСТВО»\'s').is.undefined;
      expect(detectAgendaWalk(before, pair({reason: 'phase'}).after), 'the phase\'s step is the sitting\'s').is.undefined;
    });
  });

  describe('SEED — only when somebody is there to play it', () => {
    it('the HAND with its descent standing hosts it: the marker is held on its old step, one bonus per paying step is owed, the promise is kept', () => {
      handDescended();
      promiseAgendaWalk(CARD, 'hand');
      expect(agendaWalkHostFor()).eq('hand');
      const {before, after} = pair();
      seedAgendaWalkHolds(before, after);
      expect(agendaWalkFlow.owed).deep.include({seq: 5, player: BLUE, from: 1, to: 3, card: CARD, generation: 3, host: 'hand'});
      expect(agendaWalkFlow.promised, 'the record IS the answer').is.undefined;
      expect(parliamentHolds.agendaAwaits, 'the marker stands on its OLD step until the walk moves it').deep.eq({player: BLUE, from: 1, to: 3});
      expect(parliamentRewardState.agendaBonuses.map((b) => [b.step, b.kind])).deep.eq([[2, 'tr']]);
      expect(parliamentRewardState.agendaBonuses[0].spec).deep.eq({channel: 'stock', resource: RATING_RAIL_KEY, amount: 1});
      // An echo frame seeds nothing twice.
      seedAgendaWalkHolds(after, after);
      expect(parliamentRewardState.agendaBonuses).has.lengthOf(1);
    });

    it('a Parliament standing ON ITS OWN hosts it (its tier\'s watcher plays the record)', () => {
      enterWorkspace('parliament', {anchor: {type: 'always'}});
      expect(agendaWalkHostFor()).eq('parliament');
      const {before, after} = pair();
      seedAgendaWalkHolds(before, after);
      expect(agendaWalkFlow.owed?.host).eq('parliament');
      expect(parliamentHolds.agendaAwaits).is.not.undefined;
    });

    it('NOBODY there: no hold is seeded (a hold nobody would consume freezes the track), the promise is dropped, the state just updates', () => {
      promiseAgendaWalk(CARD, 'hand');
      expect(agendaWalkHostFor()).is.undefined;
      const {before, after} = pair();
      seedAgendaWalkHolds(before, after);
      expect(agendaWalkFlow.owed).is.undefined;
      expect(agendaWalkFlow.promised).is.undefined;
      expect(parliamentHolds.agendaAwaits).is.undefined;
      expect(parliamentRewardState.agendaBonuses).deep.eq([]);
    });

    it('the CHAIRMAN QUEST the walk\'s TR closed keeps its old face — open, at its old progress — until the walk\'s rewards have landed; a quest the walk left alone holds nothing', () => {
      const quest = (progress: Record<string, number>, completedBy?: Color, generation = 3) => ({
        definition: {goal: {kind: 'tr'}, count: 3}, source: 'starter', generation, progress, ...(completedBy === undefined ? {} : {completedBy}),
      });
      const before = view(model({lastAdvance: {seq: 4, player: RED, from: 0, to: 1, steps: [{to: 1}], reason: 'phase', generation: 2}, quest: quest({blue: 2})} as never));
      const after = view(model({lastAdvance: WALK, quest: quest({blue: 3}, BLUE)} as never));
      handDescended();
      seedAgendaWalkHolds(before, after);
      const held = parliamentHolds.questWalkBefore;
      expect(held, 'the quest the walk closed is held').is.not.undefined;
      expect(held?.completedBy, '…open — never «✓ Выполнено» over a marker that has not moved').is.undefined;
      expect(held?.progress.find((row) => row.color === BLUE)?.value, '…at its old progress').eq(2);
      releaseAgendaWalkQuest();
      expect(parliamentHolds.questWalkBefore, 'the rewards landed: the server\'s answer reads').is.undefined;
      // Every other ending lets it go too (the section unmounts, the motion is cut).
      seedAgendaWalkHolds(before, view(model({lastAdvance: {...WALK, seq: 6}, quest: quest({blue: 3}, BLUE)} as never)));
      expect(parliamentHolds.questWalkBefore).is.not.undefined;
      releaseAgendaWalkHolds('unmount');
      expect(parliamentHolds.questWalkBefore).is.undefined;
      // Nothing to hold: the walk left the quest as it was, or the quest is another generation's.
      expect(questBeforeWalk(view(model({quest: quest({blue: 1})} as never)), view(model({quest: quest({blue: 1})} as never)))).is.undefined;
      expect(questBeforeWalk(view(model({quest: quest({blue: 2}, undefined, 2)} as never)), after)).is.undefined;
      expect(questBeforeWalk(undefined, after), 'a first view has nothing to move from').is.undefined;
    });

    it('the bonuses of a walk, in the walk\'s order: a TR step holds a rating, a card step parks a reveal, an influence step owes nothing', () => {
      const bonuses = agendaWalkBonuses({player: BLUE, from: 5, to: 8, steps: [{to: 6, bonus: 'tr'}, {to: 7, bonus: 'card'}, {to: 8}]}, 4);
      expect(bonuses.map((b) => [b.step, b.kind, b.generation])).deep.eq([[6, 'tr', 4], [7, 'card', 4]]);
    });

  });

  describe('THE CONCLUSION reads the walk — owed, then live', () => {
    it('a PROMISED walk is an owed step until the record arrives; a seeded walk stays owed until the pose opens; a playing walk is a live outcome; a done walk holds nothing', () => {
      promiseAgendaWalk(CARD, 'hand');
      expect(agendaWalkOwedTo('hand'), 'promised, not arrived').is.true;
      expect(agendaWalkOwedTo('parliament'), 'owed to the hand, not to a Parliament').is.false;
      expect(agendaWalkLiveIn('hand')).is.false;
      handDescended();
      const {before, after} = pair();
      seedAgendaWalkHolds(before, after);
      expect(agendaWalkOwedTo('hand'), 'arrived, the pose not opened yet (the landing ritual still playing)').is.true;
      agendaWalkFlow.live = true;
      agendaWalkFlow.beat = 'walk';
      expect(agendaWalkOwedTo('hand')).is.false;
      expect(agendaWalkLiveIn('hand'), 'the marker moving — a live outcome').is.true;
      agendaWalkFlow.beat = 'read';
      expect(agendaWalkLiveIn('hand'), 'the read beat is the walk\'s too').is.true;
      agendaWalkFlow.beat = 'done';
      expect(agendaWalkLiveIn('hand'), 'done — the flow may leave').is.false;
      expect(agendaWalkOwedTo('hand')).is.false;
    });

    it('a refused play drops the promise: nothing is owed', () => {
      promiseAgendaWalk(CARD, 'hand');
      dropAgendaWalkPromise();
      expect(agendaWalkOwedTo('hand')).is.false;
    });

    it('RELEASE lets every hold go at once (the section unmounts, the motion is cut) and forgets the walk', () => {
      handDescended();
      const {before, after} = pair();
      seedAgendaWalkHolds(before, after);
      agendaWalkFlow.live = true;
      releaseAgendaWalkHolds('unmount');
      expect(parliamentHolds.agendaAwaits).is.undefined;
      expect(parliamentRewardState.agendaBonuses).deep.eq([]);
      expect(agendaWalkFlow.owed).is.undefined;
      expect(agendaWalkFlow.live).is.false;
    });
  });

  describe('THE PLAN — one leg per recorded step', () => {
    it('N = 2: the first leg charges, the last releases; N = 1 is the sitting\'s own beat', () => {
      const legs = agendaWalkPlan({player: BLUE, from: 1, to: 3, steps: [{to: 2, bonus: 'tr'}, {to: 3}]});
      expect(legs.map((l) => [l.from, l.to, l.charge, l.last])).deep.eq([[1, 2, true, false], [2, 3, false, true]]);
      expect(legs[0].step).deep.eq({to: 2, bonus: 'tr'});
      const one = agendaWalkPlan({player: BLUE, from: 1, to: 2, steps: [{to: 2, bonus: 'tr'}]});
      expect(one.map((l) => [l.from, l.to, l.charge, l.last])).deep.eq([[1, 2, true, true]]);
      // A record with no steps (an older reader's one-step move) is one leg.
      expect(agendaWalkPlan({player: BLUE, from: 4, to: 5, steps: []}).map((l) => [l.from, l.to])).deep.eq([[4, 5]]);
      expect(agendaWalkPlan({player: BLUE, from: 12, to: 12, steps: []})).deep.eq([]);
    });

    it('THE BUDGET: N = 1 is the lead plus the shared glide (the v4 window 700–1450 ms); N = 2 adds the gap and a leg that does not charge', () => {
      const t = markerTimings();
      const leg = t.liftMs + t.glideMs + t.arriveMinMs + t.lockMs;
      const one = agendaWalkBudgetMs({player: BLUE, from: 1, to: 2, steps: [{to: 2, bonus: 'tr'}]});
      expect(one).eq(AGENDA_SEGMENT_MS + t.chargeMs + leg + t.pulseMs);
      expect(one).to.be.within(700, 1450);
      const two = agendaWalkBudgetMs({player: BLUE, from: 1, to: 3, steps: [{to: 2, bonus: 'tr'}, {to: 3}]});
      expect(two).eq(one + AGENDA_BEAT_GAP_MS + AGENDA_SEGMENT_MS + leg);
      expect(two, 'the walk itself, before the TR chip\'s flight, stays well inside the 4 s budget').to.be.lessThan(3000);
      expect(agendaWalkHoldMs({player: BLUE, from: 1, to: 2, steps: [{to: 2}]})).eq(AGENDA_WALK_HOLD_BASE_MS);
      expect(agendaWalkHoldMs({player: BLUE, from: 1, to: 3, steps: [{to: 2}, {to: 3}]})).eq(AGENDA_WALK_HOLD_BASE_MS + AGENDA_WALK_HOLD_STEP_MS);
    });

    it('THE ORDER: lead → leg → landing → reward (waited for) → gap → lead → leg → landing → release → landed; the last step\'s reward is the caller\'s', async () => {
      const trail: Array<string> = [];
      const record = {player: BLUE, from: 1, to: 3, steps: [{to: 2, bonus: 'tr' as const}, {to: 3}]};
      let rewardDone: (() => void) | undefined;
      const handle = runAgendaWalk(record, {
        onLead: (leg: AgendaWalkLeg) => trail.push(`lead:${leg.from}→${leg.to}`),
        glide: (leg, onLocked) => {
          trail.push(`glide:${leg.to}${leg.charge ? ':charge' : ''}`);
          onLocked();
        },
        onStep: (leg) => trail.push(`step:${leg.to}`),
        rewardStep: (leg, done) => {
          trail.push(`reward:${leg.to}`);
          rewardDone = done;
        },
        release: (onGone) => {
          trail.push('release');
          onGone();
        },
        onLanded: () => trail.push('landed'),
      });
      expect(handle.active()).is.true;
      await new Promise((resolve) => setTimeout(resolve, AGENDA_SEGMENT_MS + 120));
      expect(trail).deep.eq(['lead:1→2', 'glide:2:charge', 'step:2', 'reward:2']);
      // The next segment WAITS for the reward to land — a hold, never a clock.
      await new Promise((resolve) => setTimeout(resolve, AGENDA_BEAT_GAP_MS + AGENDA_SEGMENT_MS + 120));
      expect(trail, 'nothing moved while the chip was in the air').deep.eq(['lead:1→2', 'glide:2:charge', 'step:2', 'reward:2']);
      rewardDone?.();
      await new Promise((resolve) => setTimeout(resolve, AGENDA_BEAT_GAP_MS + AGENDA_SEGMENT_MS + 160));
      expect(trail).deep.eq(['lead:1→2', 'glide:2:charge', 'step:2', 'reward:2', 'lead:2→3', 'glide:3', 'step:3', 'release', 'landed']);
      expect(handle.active()).is.false;
      handle.skip();
    });

    it('SKIP tears the beats down: nothing fires after it', async () => {
      const trail: Array<string> = [];
      const handle = runAgendaWalk({player: BLUE, from: 1, to: 2, steps: [{to: 2}]}, {
        onLead: () => trail.push('lead'),
        glide: (_leg, onLocked) => {
          trail.push('glide');
          onLocked();
        },
        rewardStep: (_leg, done) => done(),
        release: (onGone) => onGone(),
        onLanded: () => trail.push('landed'),
      });
      handle.skip();
      handle.skip();
      await new Promise((resolve) => setTimeout(resolve, AGENDA_SEGMENT_MS + 120));
      expect(trail).deep.eq(['lead']);
      expect(handle.active()).is.false;
    });

    it('THE CLOCK is the caller\'s: the lead and the gaps go through the scheduler a director hands in; the waits for a lock and a landing stay real', () => {
      const trail: Array<string> = [];
      const asked: Array<number> = [];
      const beat: AgendaWalkBeatScheduler = (ms, fire) => {
        asked.push(ms);
        fire();
        return {kill: () => undefined};
      };
      let rewardDone: (() => void) | undefined;
      runAgendaWalk({player: BLUE, from: 1, to: 3, steps: [{to: 2, bonus: 'tr'}, {to: 3}]}, {
        beat,
        onLead: (leg) => trail.push(`lead:${leg.to}`),
        glide: (leg, onLocked) => {
          trail.push(`glide:${leg.to}`);
          onLocked();
        },
        rewardStep: (leg, done) => {
          trail.push(`reward:${leg.to}`);
          rewardDone = done;
        },
        release: (onGone) => {
          trail.push('release');
          onGone();
        },
        onLanded: () => trail.push('landed'),
      });
      expect(asked, 'the lead asked the caller\'s clock').deep.eq([AGENDA_SEGMENT_MS]);
      expect(trail, 'the reward\'s landing is still waited for').deep.eq(['lead:2', 'glide:2', 'reward:2']);
      rewardDone?.();
      expect(asked, 'the gap and the next lead too').deep.eq([AGENDA_SEGMENT_MS, AGENDA_BEAT_GAP_MS, AGENDA_SEGMENT_MS]);
      expect(trail).deep.eq(['lead:2', 'glide:2', 'reward:2', 'lead:3', 'glide:3', 'release', 'landed']);
    });

    it('«ДОЖАТЬ» owns the sitting\'s clock: an armed hurry fires a beat at once, a pending beat goes with the flights (once), a killed one never', () => {
      const trail: Array<string> = [];
      setParliamentFlightsHurried(false);
      const pending = scheduleHurriedParliamentBeat(1000, () => trail.push('pending'));
      const dropped = scheduleHurriedParliamentBeat(1000, () => trail.push('dropped'));
      dropped.kill();
      finishParliamentFlights();
      expect(trail).deep.eq(['pending']);
      finishParliamentFlights();
      expect(trail, 'fired once').deep.eq(['pending']);
      setParliamentFlightsHurried(true);
      scheduleHurriedParliamentBeat(1000, () => trail.push('armed'));
      expect(trail).deep.eq(['pending', 'armed']);
      setParliamentFlightsHurried(false);
      pending.kill();
    });
  });

  describe('THE CARD STEP\'S REWARD (TR37) — the cover scene armed at the marker\'s LOCK, `done` on the card\'s TOUCHDOWN', () => {
    const root = () => document.createElement('div');

    it('the marker locked on ⑦: the scene is armed off THAT node at once (`landed`), the walk holds stand down, and the next leg waits for the card to land in the dock', () => {
      const parl = trackOnScreen();
      try {
        agendaBatch(CardName.FISH);
        queueAgendaBonuses([{generation: 3, player: BLUE, step: 7, kind: 'card'}, {generation: 3, player: BLUE, step: 8, kind: 'tr', spec: {channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}}]);
        let done = 0;
        deliverAgendaStepReward(root(), 3, 7, () => done++);
        expect(boardCardBonusState.active, 'the cover scene is armed').is.true;
        expect(boardCardBonusState.source).deep.eq({kind: 'agenda-step', step: 7, landed: true});
        expect(agendaWalkMotion.awaitingCard, 'the take is the player\'s: the holds stand down').eq(7);
        expect(done, 'the next leg WAITS').eq(0);
        expect(agendaCardOwed(7), 'the step is owed until the card has landed').is.true;
        // Another card landing in the dock (an unrelated intake) is not this step's.
        releaseInFlight(CardName.BIRDS);
        expect(done).eq(0);
        // THE TOUCHDOWN of the batch's own card: the step is paid, the walk goes on, the holds stand up again.
        releaseInFlight(CardName.FISH);
        expect(done, 'done on the touchdown').eq(1);
        expect(agendaCardOwed(7)).is.false;
        expect(agendaWalkMotion.awaitingCard).is.undefined;
        expect(parliamentRewardState.agendaBonuses.map((b) => b.step), 'the TR step is still queued for its own leg').deep.eq([8]);
        releaseInFlight(CardName.FISH);
        expect(done, 'a later touchdown of the same name is nobody\'s').eq(1);
      } finally {
        parl.remove();
      }
    });

    it('the scene dies before its cover lifts (no measurable node): the park lets the batch go so the standard draw presents it, and the walk still waits for the touchdown', () => {
      const parl = trackOnScreen();
      try {
        agendaBatch(CardName.FISH);
        queueAgendaBonuses([{generation: 3, player: BLUE, step: 7, kind: 'card'}]);
        let done = 0;
        deliverAgendaStepReward(root(), 3, 7, () => done++);
        expect(parliamentParksReveal({type: 'agenda'}), 'parked while the cover is still to lift').is.true;
        expect(parliamentAgendaBonusHeld(), 'the ledger holds until the lift').is.true;
        abortBoardCardBonus('instant', 'no-source-icon');
        expect(parliamentParksReveal({type: 'agenda'}), 'the scene is gone: the park may not outlive it').is.false;
        expect(parliamentAgendaBonusHeld(), 'a lifted card step holds nothing — the take is the player\'s').is.false;
        expect(done, 'the walk still waits for the card to land').eq(0);
        expect(agendaCardOwed(7)).is.true;
        releaseInFlight(CardName.FISH);
        expect(done).eq(1);
      } finally {
        parl.remove();
      }
    });

    it('a flush (the section unmounts, the motion is cut) ends the wait honestly', () => {
      const parl = trackOnScreen();
      try {
        agendaBatch(CardName.FISH);
        queueAgendaBonuses([{generation: 3, player: BLUE, step: 7, kind: 'card'}]);
        let done = 0;
        deliverAgendaStepReward(root(), 3, 7, () => done++);
        expect(done).eq(0);
        resetParliamentRewards();
        expect(done, 'the entry left the queue — the walk goes on').eq(1);
        expect(agendaWalkMotion.awaitingCard).is.undefined;
      } finally {
        parl.remove();
      }
    });

    it('nothing to lift — no batch (an empty deck), no track on screen, or another scene owning the layer: released at once, honestly', () => {
      queueAgendaBonuses([{generation: 3, player: BLUE, step: 7, kind: 'card'}]);
      let done = 0;
      deliverAgendaStepReward(root(), 3, 7, () => done++);
      expect(done, 'no track on screen — the standard draw presents it').eq(1);
      expect(boardCardBonusState.active).is.false;
      expect(agendaCardOwed(7), 'paid at once').is.false;

      const parl = trackOnScreen();
      try {
        queueAgendaBonuses([{generation: 3, player: BLUE, step: 7, kind: 'card'}]);
        deliverAgendaStepReward(root(), 3, 7, () => done++);
        expect(done, 'no batch to lift (the deck was empty) — at once').eq(2);
        expect(boardCardBonusState.active).is.false;

        agendaBatch(CardName.FISH);
        queueAgendaBonuses([{generation: 3, player: BLUE, step: 7, kind: 'card'}]);
        boardCardBonusState.active = true; // another scene owns the layer
        deliverAgendaStepReward(root(), 3, 7, () => done++);
        expect(done, 'the layer is taken — at once').eq(3);
        expect(agendaWalkMotion.awaitingCard).is.undefined;
      } finally {
        parl.remove();
      }
      expect(drawnCardsState.events, 'the batch is untouched — the standard draw presents it').has.lengthOf(1);
    });

    it('a step that pays no card (a TR step, nothing owed) never touches the scene', () => {
      const parl = trackOnScreen();
      try {
        agendaBatch(CardName.FISH);
        let done = 0;
        deliverAgendaStepReward(root(), 3, 8, () => done++);
        expect(done, 'nothing owed → at once').eq(1);
        expect(boardCardBonusState.active).is.false;
      } finally {
        parl.remove();
      }
    });
  });

  describe('THE CRUMB and THE COMPOSER', () => {
    it('the walk\'s stage is the track\'s own word, past the commit — the same key the hosted frame is pushed with', () => {
      parliamentFlow.stage = 'walk';
      expect(parliamentCrumbStage('', '')).eq('Agenda track');
      expect(parliamentCrumbStage('', '')).eq(AGENDA_WALK_STEP_STAGE);
      expect(parliamentCrumbCommitted()).is.true;
    });

    it('the SHOW step is not a door: the CTA stays «Play card», the play submits as any other', () => {
      const walk: AgendaWalkModel = {from: 1, to: 3, printed: 2, walked: 2, steps: [{to: 2, kind: 'tr'}, {to: 3, kind: 'influence', level: 2}], influence: {current: 1, resulting: 2}};
      const branch = {index: -1, title: '', available: true, renderKeys: [], effects: [], steps: [{kind: 'agendaWalk', walk}]} as unknown as ActionPreviewBranch;
      expect(playDoorOf(branch)).is.undefined;
      expect(playCommitVerb(playDoorOf(branch))).eq('Play card');
    });

    it('the landing scene delivers NONE of the walk\'s chips — the TR, the draw, the track and the influence are the walk\'s own; a branch with no walk keeps every chip', () => {
      const walk: AgendaWalkModel = {from: 5, to: 7, printed: 2, walked: 2, steps: [{to: 6, kind: 'tr'}, {to: 7, kind: 'card'}], influence: {current: 3, resulting: 3}};
      const effects = [
        {direction: 'gain', icon: 'agenda', amount: 2, current: 5, resulting: 7},
        {direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21},
        {direction: 'gain', icon: 'cards', amount: 1, note: 'draw'},
        {direction: 'gain', icon: 'influence', amount: 1, current: 1, resulting: 2},
        {direction: 'gain', icon: 'megacredits', amount: 3, current: 0, resulting: 3},
        {direction: 'cost', icon: 'tr', amount: 1, current: 20, resulting: 19},
      ];
      const withWalk = {index: -1, title: '', available: true, renderKeys: [], effects, steps: [{kind: 'agendaWalk', walk}]} as unknown as ActionPreviewBranch;
      expect(heroRewardEffectsOf(withWalk).map((e) => `${e.direction}:${e.icon}`)).deep.eq(['gain:megacredits', 'cost:tr']);
      const plain = {...withWalk, steps: []} as unknown as ActionPreviewBranch;
      expect(heroRewardEffectsOf(plain)).deep.eq(effects);
      expect(heroRewardEffectsOf(undefined)).deep.eq([]);
    });
  });
});
