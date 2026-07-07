import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Resource} from '@/common/Resource';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {ViewModel} from '@/common/models/PlayerModel';
import {
  ATTACK_MS,
  MAX_TURN_MS,
  MIN_STEP_MS,
  REDUCED_STEP_MS,
  THINKING_MS,
  buildTheaterSteps,
  marsBotOfView,
  theaterTotalMs,
  turnDedupeKey,
} from '@/client/components/marsbot/marsBotTheaterModel';
import {
  detectMarsBotTurn,
  dismissMarsBotTheater,
  endMarsBotTheater,
  marsBotTheaterState,
  resetMarsBotTheater,
} from '@/client/components/marsbot/marsBotTheaterState';
import {trackCells} from '@/client/components/marsbot/marsBotView';
import {MarsBotTrackModel} from '@/common/models/MarsBotModel';

function view(turn: MarsBotTurn | undefined): ViewModel {
  return {
    players: [
      {color: 'blue', name: 'Human'},
      {color: 'red', name: 'MarsBot', isMarsBot: true},
    ],
    game: {
      automa: {
        difficulty: 'normal',
        tracks: [
          {tags: [Tag.BUILDING], position: 0, maxPosition: 18, layout: [], regressed: []},
          {tags: [Tag.SCIENCE], position: 2, maxPosition: 18, layout: [], regressed: []},
        ],
        actionDeckSize: 3,
        bonusDeckSize: 5,
        bonusDiscard: [],
        destroyedBonusCards: [],
        playedPile: [],
        floaters: 0,
        lastTurn: turn,
      },
    },
  } as unknown as ViewModel;
}

function turnOf(steps: MarsBotTurn['steps'], id = 1): MarsBotTurn {
  return {id, generation: 1, steps};
}

describe('marsBotTheaterModel', () => {
  beforeEach(() => {
    resetMarsBotTheater();
  });

  it('opens with a thinking beat and maps script steps in order', () => {
    const turn = turnOf([
      {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
      {kind: 'tag', tag: Tag.SCIENCE, trackIndex: 1},
      {kind: 'advance', trackIndex: 1, from: 2, to: 3},
    ]);
    const steps = buildTheaterSteps(turn, view(turn), false);
    expect(steps.map((s) => s.kind)).deep.eq(['thinking', 'reveal', 'tag', 'advance']);
    expect(steps[0].durationMs).eq(THINKING_MS);
    const tag = steps[2];
    if (tag.kind === 'tag') {
      expect(tag.targetTag).eq(Tag.SCIENCE);
      expect(tag.ignored).is.false;
    }
    const advance = steps[3];
    if (advance.kind === 'advance') {
      expect(advance.trackTag).eq(Tag.SCIENCE);
      expect(advance.from).eq(2);
      expect(advance.to).eq(3);
    }
  });

  it('maps an attack step with its own (longer) beat and the full payload', () => {
    const turn = turnOf([
      {kind: 'attack', attack: {
        target: 'blue' as Color, resource: Resource.PLANTS, demanded: 5, removed: 0,
        before: 0, after: 0, outcome: 'nothing-to-lose',
      }},
    ]);
    const steps = buildTheaterSteps(turn, view(turn), false);
    expect(steps.map((s) => s.kind)).deep.eq(['thinking', 'attack']);
    const attack = steps[1];
    if (attack.kind === 'attack') {
      expect(attack.durationMs).eq(ATTACK_MS);
      expect(attack.attack.target).eq('blue');
      expect(attack.attack.outcome).eq('nothing-to-lose');
    }
  });

  it('marks an unused-expansion tag as ignored', () => {
    const turn = turnOf([{kind: 'tag', tag: Tag.VENUS}]);
    const steps = buildTheaterSteps(turn, view(turn), false);
    const tag = steps[1];
    if (tag.kind === 'tag') {
      expect(tag.ignored).is.true;
      expect(tag.targetTag).is.undefined;
    }
  });

  it('compresses a monster turn toward the cap without dropping steps', () => {
    const long = turnOf(Array.from({length: 40}, () => ({kind: 'advance' as const, trackIndex: 0, from: 0, to: 1})));
    const steps = buildTheaterSteps(long, view(long), false);
    expect(steps).has.length(41);
    // The readability floor wins over the cap, so a 41-step chain may exceed
    // it slightly — but never by more than ~10% (31s of raw script → <15.5s).
    expect(theaterTotalMs(steps)).to.be.at.most(Math.round(MAX_TURN_MS * 1.1));
    for (const s of steps) {
      expect(s.durationMs).to.be.at.least(MIN_STEP_MS);
    }
    // A moderately long turn genuinely lands under the cap.
    const medium = turnOf(Array.from({length: 14}, () => ({kind: 'log' as const, message: {message: 'x', data: []} as never})));
    const mediumSteps = buildTheaterSteps(medium, view(medium), false);
    expect(theaterTotalMs(mediumSteps)).to.be.at.most(MAX_TURN_MS + mediumSteps.length);
  });

  it('reduced motion flattens every step to one short beat', () => {
    const turn = turnOf([
      {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
      {kind: 'failed', reason: 'no-tags', mc: 5},
    ]);
    const steps = buildTheaterSteps(turn, view(turn), true);
    for (const s of steps) {
      expect(s.durationMs).eq(REDUCED_STEP_MS);
    }
  });

  it('resolves the bot participant of a view', () => {
    const v = view(undefined);
    expect(marsBotOfView(v)).deep.eq({color: 'red', name: 'MarsBot'});
    expect(marsBotOfView(undefined)).is.undefined;
  });

  it('trackCells normalizes the JSON null empty slots (the blank-board bug)', () => {
    // The layout's empty slots are authored as `undefined` but arrive as
    // `null` over JSON — un-normalized they crashed the glyph resolver and
    // blanked the whole printed board.
    const track = {
      tags: [Tag.BUILDING],
      position: 1,
      maxPosition: 3,
      layout: [null, 'advance', null, 'tr2'],
      regressed: [2],
    } as unknown as MarsBotTrackModel;
    const cells = trackCells(track);
    expect(cells.map((c) => c.action)).deep.eq([undefined, 'advance', undefined, 'tr2']);
    expect(cells[1].current).is.true;
    expect(cells[2].regressed).is.true;
  });

  it('a naturally finished replay LINGERS until dismissed; dismiss clears it', () => {
    marsBotTheaterState.steps = [{kind: 'thinking', durationMs: 100}];
    marsBotTheaterState.active = true;
    marsBotTheaterState.currentIndex = 0;

    endMarsBotTheater(); // the commit path, after the new view landed
    expect(marsBotTheaterState.active).is.false;
    expect(marsBotTheaterState.lingering, 'the narration must stay readable').is.true;
    expect(marsBotTheaterState.finished).is.true;
    expect(marsBotTheaterState.steps).has.length(1);

    dismissMarsBotTheater();
    expect(marsBotTheaterState.lingering).is.false;
    expect(marsBotTheaterState.steps).is.empty;
  });

  it('an empty replay never lingers', () => {
    marsBotTheaterState.active = true;
    marsBotTheaterState.steps = [];
    endMarsBotTheater();
    expect(marsBotTheaterState.lingering).is.false;
  });

  it('detect claims silently on a fresh session and dedups replays', () => {
    const turn = turnOf([{kind: 'pass'}]);
    const next = view(turn);
    // Fresh load: claimed, not replayed.
    expect(detectMarsBotTurn(undefined, next)).is.undefined;
    // The same turn re-fetched by a poll: still nothing.
    expect(detectMarsBotTurn(next, next)).is.undefined;
    // A NEW turn id replays.
    const turn2 = turnOf([{kind: 'pass'}], 2);
    const next2 = view(turn2);
    expect(detectMarsBotTurn(next, next2)).deep.eq(turn2);
    expect(detectMarsBotTurn(next, next2)).is.undefined;
    expect(turnDedupeKey(turn2, 'red')).eq('red:1:2');
  });
});
