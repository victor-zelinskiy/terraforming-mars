/*
 * PLACEMENT MOVE — the SOURCE level of a move pick (Turmoil Redux TR14
 * Re-settlement) and the bar that names its verbs.
 *
 * Pure: a move is ONE prompt read at two levels — which city leaves, where it
 * lands — and everything the console draws for either level is derived from
 * the server's own marker (`SelectSpaceModel.tileMove`) by `moveLevelPrompt`.
 * These specs pin that the derivation invents nothing (no adjacency, no «is it
 * my city»), that B walks the levels one at a time, and that the bar says the
 * right thing at every one of them.
 */
import {expect} from 'chai';
import {SelectSpaceModel} from '../../src/common/models/PlayerInputModel';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {SpaceId} from '../../src/common/Types';
import {
  isMovePrompt, moveFirstDestination, moveFocusTile, moveLevelPrompt, moveSourceOf, pickUpMoveSource,
  placementMoveLevel, placementMoveState, putDownMoveSource, resetPlacementMove,
} from '../../src/client/console/tilePlacement/placementMove';
import {placementCommands, PlacementCommandState} from '../../src/client/console/tilePlacement/placementCommands';

const BOARD: ReadonlyArray<SpaceId> = ['03', '04', '05', '10', '11', '12', '20', '21', '22'];

/**
 * Two cities that may move — a plain city on 10 (→ 03, 04, 11) and the top
 * tier of a Capital stack on 20 (→ 11, 21) — and one that may not (22).
 * Cell 11 is offered to both; 05 and 12 to nobody.
 */
function movePrompt(): SelectSpaceModel {
  return {
    type: 'space',
    title: 'Move your city',
    buttonLabel: '',
    spaces: ['03', '04', '11', '21'],
    illegalSpaces: [
      {spaceId: '05', reason: 'not-adjacent-to-the-city'},
      {spaceId: '10', reason: 'occupied'},
      {spaceId: '12', reason: 'ocean-only'},
      {spaceId: '20', reason: 'occupied'},
      {spaceId: '22', reason: 'occupied'},
    ],
    placementType: 'city-move',
    placementEffect: 'move',
    tileType: TileType.CITY,
    sourceCard: CardName.RE_SETTLEMENT,
    tileMove: {
      sources: [
        {from: '10', tileType: TileType.CITY, tiers: 1, arrives: TileType.CITY, to: ['11', '04', '03'],
          illegal: [{spaceId: '21', reason: 'not-adjacent-to-the-city'}]},
        {from: '20', tileType: TileType.CAPITAL, card: CardName.CAPITAL, tiers: 2, arrives: TileType.CITY, to: ['21', '11'],
          illegal: [{spaceId: '03', reason: 'not-adjacent-to-the-city'}, {spaceId: '04', reason: 'not-adjacent-to-the-city'}]},
      ],
      disabledSources: [{spaceId: '22', reason: 'city-stands-on-ocean'}],
    },
  };
}

function plainPrompt(): SelectSpaceModel {
  return {type: 'space', title: 'Select space for city tile', buttonLabel: '', spaces: ['03'], placementType: 'city'};
}

const reasonOf = (prompt: SelectSpaceModel, id: SpaceId) => prompt.illegalSpaces?.find((e) => e.spaceId === id)?.reason;

describe('placementMove', () => {
  afterEach(() => resetPlacementMove());

  describe('the state — one lifted city, nothing else', () => {
    it('lifting, putting down and the reset are the whole lifecycle', () => {
      expect(placementMoveState.from).is.undefined;
      pickUpMoveSource('10');
      expect(placementMoveState.from).eq('10');
      pickUpMoveSource('20');
      expect(placementMoveState.from, 'another city replaces the lift').eq('20');
      putDownMoveSource();
      expect(placementMoveState.from).is.undefined;
      pickUpMoveSource('10');
      resetPlacementMove();
      expect(placementMoveState.from).is.undefined;
    });

    it('the level reads the MARKER: no marker — no level; a lifted cell that is no source — the city level', () => {
      expect(isMovePrompt(plainPrompt())).is.false;
      expect(placementMoveLevel(plainPrompt(), '10')).is.undefined;
      expect(placementMoveLevel(undefined, '10')).is.undefined;
      expect(isMovePrompt(movePrompt())).is.true;
      expect(placementMoveLevel(movePrompt(), undefined)).eq('city');
      expect(placementMoveLevel(movePrompt(), '10')).eq('cell');
      expect(placementMoveLevel(movePrompt(), '22'), 'a city that cannot move offers no destinations').eq('city');
      expect(placementMoveLevel(movePrompt(), '99'), 'a stale lift never opens the cell level').eq('city');
      expect(moveSourceOf(movePrompt(), '20')?.card).eq(CardName.CAPITAL);
    });

    it('with no explicit argument the level reads the module\'s own lift', () => {
      expect(placementMoveLevel(movePrompt())).eq('city');
      pickUpMoveSource('20');
      expect(placementMoveLevel(movePrompt())).eq('cell');
    });
  });

  describe('moveLevelPrompt — one prompt read at two levels', () => {
    it('a prompt that is not a move comes back as the SAME object', () => {
      const prompt = plainPrompt();
      expect(moveLevelPrompt(prompt, undefined, BOARD)).eq(prompt);
      expect(moveLevelPrompt(prompt, '10', BOARD)).eq(prompt);
    });

    it('CITY level: the legal cells are the cities that may move; a city that may not states its ONE reason', () => {
      const level = moveLevelPrompt(movePrompt(), undefined, BOARD);
      expect(level.spaces).deep.eq(['10', '20']);
      expect(reasonOf(level, '22')).eq('city-stands-on-ocean');
    });

    it('CITY level: every other cell is «not one of your cities on Mars» — by the marker\'s own exclusion', () => {
      const level = moveLevelPrompt(movePrompt(), undefined, BOARD);
      for (const id of ['03', '04', '05', '11', '12', '21'] as const) {
        expect(reasonOf(level, id), id).eq('not-your-city');
      }
      expect(reasonOf(level, '10'), 'a source carries no refusal').is.undefined;
      expect(level.illegalSpaces, 'each cell once').has.length(BOARD.length - 2);
    });

    it('CELL level: the legal cells are THAT city\'s destinations, in the server\'s own order', () => {
      const level = moveLevelPrompt(movePrompt(), '10', BOARD);
      expect(level.spaces).deep.eq(['11', '04', '03']);
      expect(moveLevelPrompt(movePrompt(), '20', BOARD).spaces).deep.eq(['21', '11']);
    });

    it('CELL level: a cell offered to a SIBLING city carries this city\'s reason; every other cell keeps the prompt\'s', () => {
      const level = moveLevelPrompt(movePrompt(), '10', BOARD);
      expect(reasonOf(level, '21'), 'the Capital\'s cell').eq('not-adjacent-to-the-city');
      expect(reasonOf(level, '05')).eq('not-adjacent-to-the-city');
      expect(reasonOf(level, '12')).eq('ocean-only');
      expect(reasonOf(level, '10'), 'the lifted city\'s own cell').eq('occupied');
      expect(reasonOf(level, '11'), 'a destination carries no refusal').is.undefined;
    });

    it('CELL level: `tileType` is what LANDS — a stack\'s top tier arrives as a plain city, even off a Capital', () => {
      expect(moveLevelPrompt(movePrompt(), '20', BOARD).tileType).eq(TileType.CITY);
      const capital = movePrompt();
      capital.tileMove!.sources[1].tiers = 1;
      capital.tileMove!.sources[1].arrives = TileType.CAPITAL;
      expect(moveLevelPrompt(capital, '20', BOARD).tileType).eq(TileType.CAPITAL);
    });

    it('both levels keep the marker, the kind, the effect, the source and the title — it is still the one prompt', () => {
      for (const from of [undefined, '10'] as const) {
        const level = moveLevelPrompt(movePrompt(), from, BOARD);
        expect(level.tileMove, String(from)).deep.eq(movePrompt().tileMove);
        expect(level.placementType).eq('city-move');
        expect(level.placementEffect).eq('move');
        expect(level.sourceCard).eq(CardName.RE_SETTLEMENT);
        expect(level.title).eq('Move your city');
      }
    });

    it('the level prompt never mutates the prompt it reads', () => {
      const prompt = movePrompt();
      const snapshot = JSON.stringify(prompt);
      moveLevelPrompt(prompt, undefined, BOARD);
      moveLevelPrompt(prompt, '10', BOARD);
      expect(JSON.stringify(prompt)).eq(snapshot);
    });
  });

  describe('what the reticle and the panel name, and where the cursor lands', () => {
    it('the focused city names its own tile; a lifted one names what lands; anything else is a plain city', () => {
      const capital = movePrompt();
      capital.tileMove!.sources[1].tiers = 1;
      capital.tileMove!.sources[1].arrives = TileType.CAPITAL;
      expect(moveFocusTile(capital, undefined, '20'), 'the cursor on the Capital').eq(TileType.CAPITAL);
      expect(moveFocusTile(capital, undefined, '10')).eq(TileType.CITY);
      expect(moveFocusTile(capital, undefined, '22'), 'a city that cannot move').eq(TileType.CITY);
      expect(moveFocusTile(capital, '20', '11'), 'the Capital lifted — the cursor on a destination').eq(TileType.CAPITAL);
      expect(moveFocusTile(plainPrompt(), undefined, '03'), 'not a move — no answer of this module\'s').is.undefined;
    });

    it('a lifted city sends the cursor to its FIRST destination — the server\'s order, never a client geometry', () => {
      expect(moveFirstDestination(movePrompt(), '10')).eq('11');
      expect(moveFirstDestination(movePrompt(), '20')).eq('21');
      expect(moveFirstDestination(movePrompt(), '22')).is.undefined;
      expect(moveFirstDestination(movePrompt(), undefined)).is.undefined;
    });
  });

  describe('placementCommands — the one bar, level by level', () => {
    const base: PlacementCommandState = {
      phase: 'navigate', twoStep: true, legal: true, cancellable: true, freeRoam: false, sourceInspectable: true,
    };
    const labels = (state: PlacementCommandState) => placementCommands(state).map((c) => `${c.control}:${c.label}`);

    it('an ordinary placement reads exactly as before', () => {
      expect(labels(base)).deep.eq(['dpad:Navigate', 'confirm:Select cell', 'stickL:Source', 'stickR:All cells', 'back:Cancel placement']);
      expect(labels({...base, twoStep: false})[1]).eq('confirm:Place here');
      expect(labels({...base, cancellable: false}), 'a mandatory B is not a hint').to.not.include('back:Cancel placement');
      expect(labels({...base, phase: 'locked'})).deep.eq(['confirm:Confirm placement', 'back:Change cell', 'stickL:Source']);
      expect(labels({...base, phase: 'committing'})).deep.eq(['confirm:Placing the tile']);
      expect(labels({...base, freeRoam: true})).to.include('stickR:Available only');
      expect(labels({...base, sourceInspectable: false})).to.not.include('stickL:Source');
    });

    it('CITY level: A «Take the city», B the whole-flow cancel, R3 and L3 stand', () => {
      const state: PlacementCommandState = {...base, moveLevel: 'city'};
      expect(labels(state)).deep.eq(['dpad:Navigate', 'confirm:Take the city', 'stickL:Source', 'stickR:All cells', 'back:Cancel placement']);
      // The same verb in single-press mode: lifting is one press in BOTH modes.
      expect(labels({...state, twoStep: false})[1]).eq('confirm:Take the city');
      // A live (mandatory) move has no cancel to offer on this level.
      expect(labels({...state, cancellable: false}).some((l) => l.startsWith('back:'))).is.false;
      // A city that cannot move under the cursor: the verb is there, disabled.
      const take = placementCommands({...state, legal: false}).find((c) => c.control === 'confirm')!;
      expect(take.enabled).is.false;
      expect(take.highlight).is.false;
    });

    it('CELL level: A selects the cell, B is «Another city» — one level, mandatory or not', () => {
      const state: PlacementCommandState = {...base, moveLevel: 'cell'};
      expect(labels(state)).deep.eq(['dpad:Navigate', 'confirm:Select cell', 'stickL:Source', 'stickR:All cells', 'back:Another city']);
      expect(labels({...state, twoStep: false})[1], 'single-press mode commits on this press').eq('confirm:Relocate here');
      expect(labels({...state, cancellable: false}), 'the city can always be put down').to.include('back:Another city');
      expect(labels(state), 'never the whole-flow cancel from here').to.not.include('back:Cancel placement');
    });

    it('LOCKED and COMMITTING speak of a relocation', () => {
      for (const moveLevel of ['cell'] as const) {
        expect(labels({...base, moveLevel, phase: 'locked'})).deep.eq(['confirm:Confirm relocation', 'back:Change cell', 'stickL:Source']);
        const committing = placementCommands({...base, moveLevel, phase: 'committing'});
        expect(committing.map((c) => c.label)).deep.eq(['Relocating the city']);
        expect(committing[0].enabled, 'a status, not a verb').is.false;
      }
    });

    it('the stick hints keep their explicit priorities — a verb with no other home is never the first to drop', () => {
      for (const moveLevel of [undefined, 'city', 'cell'] as const) {
        const cmds = placementCommands({...base, moveLevel});
        expect(cmds.find((c) => c.control === 'stickL')?.priority, String(moveLevel)).eq(1);
        expect(cmds.find((c) => c.control === 'stickR')?.priority, String(moveLevel)).eq(2);
      }
    });
  });
});
