import {expect} from 'chai';
import {
  AWAITING_SAFETY_MS,
  AwaitingHandoff,
  DEPARTURE_FRESH_MS,
  SurfaceDeparture,
  WHEEL_ORIGIN_FRESH_MS,
  awaitingExpired,
  classifySurfaceTransition,
  departureUsable,
  isPhasePair,
  resolveAwaiting,
  wheelOriginUsable,
} from '@/client/console/surfaceMotion/surfaceMotionModel';
import {
  addShadeOwner,
  beginAwaitingHandoff,
  clearAwaitingHandoff,
  isSurfaceAwaitingHandoff,
  markWheelHandoff,
  removeShadeOwner,
  resetSurfaceMotion,
  setPickSuppressed,
  surfaceMotionState,
  surfaceShadeOn,
  takeSurfaceDeparture,
  takeWheelChosenSlot,
  takeWheelOrigin,
} from '@/client/console/surfaceMotion/surfaceMotionState';

describe('surfaceMotionModel (the pure transition vocabulary)', () => {
  describe('classifySurfaceTransition', () => {
    it('first appearance is an open, final exit a dismiss', () => {
      expect(classifySurfaceTransition(undefined, 'task-host')).to.eq('open');
      expect(classifySurfaceTransition('task-host', undefined)).to.eq('dismiss');
    });

    it('the composer → reveal chain is a PHASE (one operation, next stage)', () => {
      expect(classifySurfaceTransition('action-composer', 'reveal')).to.eq('phase');
      expect(classifySurfaceTransition('card-actions', 'reveal')).to.eq('phase');
      expect(classifySurfaceTransition('task-host', 'reveal')).to.eq('phase');
      expect(classifySurfaceTransition('reveal', 'task-host')).to.eq('phase');
      expect(isPhasePair('action-composer', 'reveal')).to.be.true;
    });

    it('unrelated surfaces exchanging the band is a handoff', () => {
      expect(classifySurfaceTransition('std-projects', 'card-actions')).to.eq('handoff');
      expect(classifySurfaceTransition('reveal', 'std-projects')).to.eq('handoff');
      expect(isPhasePair('std-projects', 'card-actions')).to.be.false;
    });

    it('the quick wheel family always wins the classification', () => {
      expect(classifySurfaceTransition(undefined, 'quick')).to.eq('wheel-open');
      expect(classifySurfaceTransition('quick', undefined)).to.eq('wheel-dismiss');
      expect(classifySurfaceTransition('quick', 'std-projects')).to.eq('wheel-handoff');
      expect(classifySurfaceTransition('quick', 'card-actions')).to.eq('wheel-handoff');
    });
  });

  describe('departureUsable (the anchored FLIP source)', () => {
    const dep = (from: SurfaceDeparture['from'], at: number): SurfaceDeparture => ({
      from, at, panel: {left: 0, top: 0, width: 100, height: 100}, anchors: new Map(),
    });

    it('fresh + phase-linked departures fuel the incoming FLIP', () => {
      expect(departureUsable(dep('action-composer', 1000), 'reveal', 1000 + DEPARTURE_FRESH_MS)).to.be.true;
    });

    it('a stale capture is a different scene — never a FLIP source', () => {
      expect(departureUsable(dep('action-composer', 1000), 'reveal', 1001 + DEPARTURE_FRESH_MS)).to.be.false;
    });

    it('a non-phase pair never FLIPs (an unrelated open stays an open)', () => {
      expect(departureUsable(dep('std-projects', 1000), 'card-actions', 1050)).to.be.false;
      expect(departureUsable(undefined, 'reveal', 1000)).to.be.false;
    });
  });

  describe('wheelOriginUsable', () => {
    it('only a fresh chosen-slot origin drives the directional entry', () => {
      expect(wheelOriginUsable({x: 1, y: 2, at: 500}, 500 + WHEEL_ORIGIN_FRESH_MS)).to.be.true;
      expect(wheelOriginUsable({x: 1, y: 2, at: 500}, 501 + WHEEL_ORIGIN_FRESH_MS)).to.be.false;
      expect(wheelOriginUsable(undefined, 0)).to.be.false;
    });
  });

  describe('resolveAwaiting (the committed hold)', () => {
    const aw: AwaitingHandoff = {from: 'action-composer', startedAt: 10_000, gameAge: 40, undoCount: 2};

    it('holds while the answer has not landed (same game age, no reveal)', () => {
      expect(resolveAwaiting(aw, {gameAge: 40, undoCount: 2, revealArrived: false}, 10_100))
        .to.deep.eq({kind: 'hold'});
    });

    it('a reveal in the answer continues the scene as a PHASE', () => {
      expect(resolveAwaiting(aw, {gameAge: 41, undoCount: 2, revealArrived: true}, 10_100))
        .to.deep.eq({kind: 'phase'});
      // Even when the fingerprint is racy, the reveal itself is decisive.
      expect(resolveAwaiting(aw, {gameAge: 40, undoCount: 2, revealArrived: true}, 10_100))
        .to.deep.eq({kind: 'phase'});
    });

    it('a game step with no reveal dismisses the held stage', () => {
      expect(resolveAwaiting(aw, {gameAge: 41, undoCount: 2, revealArrived: false}, 10_100))
        .to.deep.eq({kind: 'dismiss'});
      expect(resolveAwaiting(aw, {gameAge: 40, undoCount: 3, revealArrived: false}, 10_100))
        .to.deep.eq({kind: 'dismiss'});
    });

    it('a lost response expires into a dismiss (never a stuck shell)', () => {
      const late = aw.startedAt + AWAITING_SAFETY_MS + 1;
      expect(awaitingExpired(aw, late)).to.be.true;
      expect(resolveAwaiting(aw, {gameAge: 40, undoCount: 2, revealArrived: false}, late))
        .to.deep.eq({kind: 'dismiss'});
    });
  });
});

describe('surfaceMotionState (the reactive store)', () => {
  beforeEach(() => resetSurfaceMotion());
  after(() => resetSurfaceMotion());

  describe('the shade ownership', () => {
    it('is ON while ≥1 owner is live and never duplicates an owner', () => {
      expect(surfaceShadeOn()).to.be.false;
      addShadeOwner('quick');
      addShadeOwner('quick');
      expect(surfaceMotionState.shadeOwners).to.deep.eq(['quick']);
      expect(surfaceShadeOn()).to.be.true;
      removeShadeOwner('quick');
      expect(surfaceShadeOn()).to.be.false;
    });

    it('stays ON across a same-flush handoff (owner 1→2→1, never 0)', () => {
      addShadeOwner('quick');
      addShadeOwner('std-projects'); // the incoming surface registers…
      removeShadeOwner('quick'); // …before the outgoing one releases
      expect(surfaceShadeOn()).to.be.true;
    });

    it('yields to a live pick bridge (the composer is v-show hidden)', () => {
      addShadeOwner('card-actions');
      setPickSuppressed(true);
      expect(surfaceShadeOn()).to.be.false;
      setPickSuppressed(false);
      expect(surfaceShadeOn()).to.be.true;
    });

    it('an awaiting handoff holds the shade even with no DOM owner', () => {
      beginAwaitingHandoff('action-composer', {gameAge: 1, undoCount: 0});
      expect(surfaceShadeOn()).to.be.true;
      clearAwaitingHandoff();
      expect(surfaceShadeOn()).to.be.false;
    });
  });

  describe('the awaiting handoff lifecycle', () => {
    it('begin → gate the pad → clear', () => {
      expect(isSurfaceAwaitingHandoff()).to.be.false;
      beginAwaitingHandoff('action-composer', {gameAge: 7, undoCount: 1});
      expect(isSurfaceAwaitingHandoff()).to.be.true;
      expect(surfaceMotionState.awaiting?.gameAge).to.eq(7);
      clearAwaitingHandoff();
      expect(isSurfaceAwaitingHandoff()).to.be.false;
    });

    it('a re-begin replaces the fingerprint (the newest submit wins)', () => {
      beginAwaitingHandoff('action-composer', {gameAge: 7, undoCount: 1});
      beginAwaitingHandoff('action-composer', {gameAge: 9, undoCount: 1});
      expect(surfaceMotionState.awaiting?.gameAge).to.eq(9);
    });
  });

  describe('the wheel handoff marks', () => {
    it('records the chosen slot and clears it on a single take', () => {
      markWheelHandoff('up', null);
      expect(takeWheelChosenSlot()).to.eq('up');
      expect(takeWheelChosenSlot()).to.be.undefined;
    });

    it('a null slot element records no origin (JSDOM-safe)', () => {
      markWheelHandoff('center', null);
      expect(takeWheelOrigin()).to.be.undefined;
    });
  });

  describe('the departure capture', () => {
    it('take without a capture yields nothing', () => {
      expect(takeSurfaceDeparture('reveal')).to.be.undefined;
    });

    it('a stored capture is single-take and phase-gated', () => {
      surfaceMotionState.departure = {
        from: 'action-composer',
        at: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
        panel: {left: 10, top: 10, width: 500, height: 400},
        anchors: new Map([['card:X', {left: 20, top: 20, width: 200, height: 280}]]),
      };
      // A non-phase target must not consume it…
      expect(takeSurfaceDeparture('std-projects')).to.be.undefined;
      // …the phase target takes it exactly once.
      const dep = takeSurfaceDeparture('reveal');
      expect(dep?.from).to.eq('action-composer');
      expect(dep?.anchors.get('card:X')?.width).to.eq(200);
      expect(takeSurfaceDeparture('reveal')).to.be.undefined;
    });
  });

  describe('resetSurfaceMotion', () => {
    it('drops every hold across a game switch', () => {
      addShadeOwner('reveal');
      beginAwaitingHandoff('action-composer', {gameAge: 1, undoCount: 0});
      markWheelHandoff('down', null);
      setPickSuppressed(true);
      resetSurfaceMotion();
      expect(surfaceShadeOn()).to.be.false;
      expect(isSurfaceAwaitingHandoff()).to.be.false;
      expect(surfaceMotionState.wheelChosenSlot).to.be.undefined;
      expect(surfaceMotionState.pickSuppressed).to.be.false;
    });
  });
});
