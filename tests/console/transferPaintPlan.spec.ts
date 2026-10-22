import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  NO_TRANSFER_COVER, TRANSFER_HANDOVER_FROM, TRANSFER_HANDOVER_MS, TRANSFER_RETARGET_AT, TransferCover, TransferRect,
  boxInsideCover, transferPaintPlan, transferTurnDue,
} from '../../src/client/console/resourceTransfer/resourceTransferModel';

/*
 * «ЖЕТОН НИКОГДА НЕ КРАСИТСЯ ПОД ПОВЕРХНОСТЬЮ, НА КОТОРУЮ САДИТСЯ» (T12 / CA — the flights' third iteration, the owner's
 * report of 2026-10-22: «при размещении на поле от розыгрыша пролога ресурс летит ПОД панель, как будто проблема с
 * z-index»). It was no z bug: the 09-03 cut demoted a board-born wave by its SOURCE for its whole flight (11444), and the
 * rail it lands on stands lifted over it (11520). A flight's two ends live in different paint; the layer has a SHADED
 * TWIN and the token is HANDED OVER between them. The pure half — where a token paints and when it turns — is pinned
 * here; the DOM half (`measureTransferCover`, the sentinel, the twin layers) in
 * `tests/client/console/transferLayerHandover.spec.ts`, the z ladder in `flightLayerZOrder.spec.ts`.
 */

/** A 1920×1080 cockpit: the rail at the left (0–220), the strip at the top (0–80); the opening is the rest. */
const OPENING: TransferRect = {x: 220, y: 80, w: 1480, h: 920};
const COVER: TransferCover = {rects: [OPENING], everything: false};
const ENDGAME: TransferCover = {rects: [], everything: true};
/** A token of 54 px born on a board cell in the middle of the opening; the rail's M€ row; a covered cell. */
const ON_CELL: TransferRect = {x: 900, y: 500, w: 54, h: 54};
const ON_RAIL: TransferRect = {x: 120, y: 300, w: 54, h: 54};

describe('the paint of a flight — the pure half (T12 / CA)', () => {
  describe('transferPaintPlan — the axis is the DESTINATION, the birth keeps its own paint', () => {
    it('THE OWNER\'S CASE — a board-born token under a standing workspace, landing on the rail: born UNDER, turns UP', () => {
      expect(transferPaintPlan({sourceOnBoard: true, destinationOnBoard: false, birthBox: ON_CELL, destinationBox: ON_RAIL, cover: COVER}))
        .deep.eq({birth: 'under', end: 'lit', turn: 'up'});
    });

    it('no workspace stands: no cover — every token paints lit, the board IS the screen', () => {
      expect(transferPaintPlan({sourceOnBoard: true, destinationOnBoard: false, birthBox: ON_CELL, destinationBox: ON_RAIL, cover: NO_TRANSFER_COVER}))
        .deep.eq({birth: 'lit', end: 'lit', turn: 'none'});
    });

    it('a token born on a LIT surface (a played card, an action commit) is lit from its birth', () => {
      expect(transferPaintPlan({sourceOnBoard: false, destinationOnBoard: false, birthBox: ON_CELL, destinationBox: ON_RAIL, cover: COVER}))
        .deep.eq({birth: 'lit', end: 'lit', turn: 'none'});
    });

    it('a board cell OUTSIDE the cover (half under the rail\'s edge) is born lit — only a box wholly under the glass starts under', () => {
      const atEdge: TransferRect = {x: 200, y: 400, w: 54, h: 54};
      expect(transferPaintPlan({sourceOnBoard: true, destinationOnBoard: false, birthBox: atEdge, destinationBox: ON_RAIL, cover: COVER}).birth).eq('lit');
    });

    it('a LOSS drawn back INTO a covered cell (a rival\'s plant price, a VP share walked back): born lit on the panel, dives DOWN', () => {
      expect(transferPaintPlan({sourceOnBoard: false, destinationOnBoard: true, birthBox: ON_RAIL, destinationBox: ON_CELL, cover: COVER}))
        .deep.eq({birth: 'lit', end: 'under', turn: 'down'});
    });

    it('a token landing on a card that recedes with the board (the field\'s own scene) never surfaces: under to under', () => {
      expect(transferPaintPlan({sourceOnBoard: true, destinationOnBoard: true, birthBox: ON_CELL, destinationBox: {x: 1000, y: 600, w: 160, h: 220}, cover: COVER}))
        .deep.eq({birth: 'under', end: 'under', turn: 'none'});
    });

    it('under the endgame scene a board story keeps its layer to the end — never handed over the finale', () => {
      expect(transferPaintPlan({sourceOnBoard: true, destinationOnBoard: false, birthBox: ON_CELL, destinationBox: ON_RAIL, cover: ENDGAME}))
        .deep.eq({birth: 'under', end: 'under', turn: 'none'});
      expect(transferPaintPlan({sourceOnBoard: false, destinationOnBoard: false, birthBox: ON_RAIL, destinationBox: ON_RAIL, cover: ENDGAME}))
        .deep.eq({birth: 'lit', end: 'lit', turn: 'none'});
    });
  });

  describe('transferTurnDue — where the token is handed over', () => {
    it('UP: not while the box is wholly under the glass; the moment any part of it leaves the cover — before it could slide under the lit rail', () => {
      expect(transferTurnDue('up', ON_CELL, COVER, 0.3)).eq(false);
      // The leading edge reaches the rail's edge (x 220): the token surfaces there.
      expect(transferTurnDue('up', {x: 219, y: 400, w: 54, h: 54}, COVER, 0.4)).eq(true);
      expect(transferTurnDue('up', {x: 221, y: 400, w: 54, h: 54}, COVER, 0.4)).eq(false);
      // Rising into the strip's band (y 80) is leaving the cover too.
      expect(transferTurnDue('up', {x: 600, y: 70, w: 54, h: 54}, COVER, 0.4)).eq(true);
    });

    it('UP at the final approach at the latest — a lit destination standing INSIDE the opening (the satellite) is landed ON', () => {
      expect(transferTurnDue('up', ON_CELL, COVER, TRANSFER_RETARGET_AT - 0.01)).eq(false);
      expect(transferTurnDue('up', ON_CELL, COVER, TRANSFER_RETARGET_AT)).eq(true);
    });

    it('DOWN: only once the box is wholly under the glass (never half over the rail), at the touchdown at the latest', () => {
      expect(transferTurnDue('down', {x: 200, y: 400, w: 54, h: 54}, COVER, 0.5)).eq(false);
      expect(transferTurnDue('down', ON_CELL, COVER, 0.5)).eq(true);
      expect(transferTurnDue('down', {x: 200, y: 400, w: 54, h: 54}, COVER, 1)).eq(true);
    });

    it('a token with no turn is never handed', () => {
      expect(transferTurnDue('none', {x: 0, y: 0, w: 10, h: 10}, COVER, 1)).eq(false);
    });

    it('boxInsideCover: all four corners, any rect of the union; the endgame is everything', () => {
      const two: TransferCover = {rects: [{x: 0, y: 0, w: 100, h: 100}, {x: 100, y: 0, w: 100, h: 100}], everything: false};
      expect(boxInsideCover({x: 80, y: 10, w: 40, h: 40}, two), 'straddling two rects of the union is inside').eq(true);
      expect(boxInsideCover({x: 180, y: 10, w: 40, h: 40}, two)).eq(false);
      expect(boxInsideCover({x: -5000, y: -5000, w: 1, h: 1}, ENDGAME)).eq(true);
      expect(boxInsideCover(ON_CELL, NO_TRANSFER_COVER)).eq(false);
    });
  });

  it('the surfacing ramps up from the shade\'s paint in one short beat — never a flash from the glass to the rail', () => {
    expect(TRANSFER_HANDOVER_FROM).gt(0).and.lt(0.5);
    expect(TRANSFER_HANDOVER_MS).gt(0).and.lte(120);
  });
});

/*
 * THE SOURCE GUARDS — the director and the layer are DOM + GSAP (the transferFlightClock pattern): what must stay true
 * of their code is read off it.
 */
describe('the paint of a flight — the source guards (T12 / CA)', () => {
  const ROOT = path.join(__dirname, '..', '..');
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const director = read('src/client/console/resourceTransfer/resourceTransferDirector.ts');
  const layer = read('src/client/components/console/resourceTransfer/ConsoleResourceTransferLayer.vue');
  const engine = read('src/client/console/resourceTransfer/consoleResourceTransfer.ts');

  it('the layer never demotes the WHOLE wave by its source again — no `con-flight-to-board` on the transfer layer', () => {
    const template = layer.slice(0, layer.indexOf('<script'));
    expect(template.replace(/<!--[\s\S]*?-->/g, '')).not.match(/con-flight-to-board/);
  });

  it('the twin layers exist, and a token moves between them as the SAME element (`<Teleport :disabled>`), never re-rendered', () => {
    expect(layer).match(/class="con-transfer con-transfer--under" data-transfer-under/);
    expect(layer).match(/<Teleport defer to="\[data-transfer-under\]" :disabled="layerOf\(f\.id, 'chip'\) !== 'under'">/);
    expect(layer).match(/<Teleport defer to="\[data-transfer-under\]" :disabled="layerOf\(f\.id, 'end'\) !== 'under'">/);
    expect(layer).match(/:data-transfer-layer="layerOf\(f\.id, 'chip'\)"/);
  });

  it('the director plans in the birth frame, turns on the arc by the pure rule, at most once, and never moves a node by hand', () => {
    expect(director).match(/planPaint\(at\);/);
    expect(director).match(/planPaint\(opts\.from\);/);
    expect(director).match(/!turned && paint !== undefined && paint\.plan\.turn !== 'none' && transferTurnDue\(/);
    expect(director).not.match(/appendChild|insertBefore/);
  });

  it('the sentinel asks at the birth, the approach and the touchdown — only while the token is LIT', () => {
    for (const at of ['birth', 'approach', 'touchdown']) {
      expect(director, at).match(new RegExp(`askPaint\\('${at}'\\)`));
    }
    expect(director).match(/if \(layer !== 'lit' \|\| !chip\.isConnected\) \{/);
    expect(engine).match(/\[transfer\] token painted under/);
    expect(engine).match(/probePaint: tokenPaintedUnder,/);
  });

  it('only a BOARD-SOURCED run plans two paints; the gate keeps reading the wave\'s source (`boardSourcedTransferActive`)', () => {
    expect(engine).match(/\.\.\.\(run\.fromBoard === true \? \{paint: \(birthBox: TransferRect\) => paintOf\(e, birthBox\)\} : \{\}\),/);
    expect(engine).match(/export function boardSourcedTransferActive\(\): boolean \{/);
  });
});
