import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {FleetDockOfferModel} from '@/common/models/PlayerInputModel';
import {FLEET_DOCK_BUSY_REASON} from '@/common/colonies/fleetDock';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {isICardRenderItem} from '@/common/cards/render/Types';
import {getCard} from '@/client/cards/ClientCardManifest';
import {colonyNavStep} from '@/client/console/consoleColoniesModel';
import {
  ColonyCursor, DOCK_DOCKED_KEY, DOCK_FREE_KEY, FleetDockReasonInput, colonyCursorStep, fleetDockEffectNode,
  fleetDockOwnBlock, fleetDockReason, fleetDockTileStatus, fleetDockViews,
} from '@/client/console/colonyTrade/fleetDockModel';

const DOCK = CardName.WATER_HAULING;
const isDock = (name: CardName) => getCard(name)?.fleetDock === true;
const card = (name: CardName, extra: Partial<CardModel> = {}): CardModel => ({name, ...extra} as CardModel);
const offer = (available: boolean, reason?: string): FleetDockOfferModel => ({
  card: DOCK, available, reason, effects: [{direction: 'gain', icon: 'oceans', amount: 1, current: 3, resulting: 4}],
});
const input = (extra: Partial<FleetDockReasonInput> = {}): FleetDockReasonInput => ({
  tradeable: [], viewerColor: 'blue', availableFleets: 1, myTurn: false, awaitingInput: false, ...extra,
});

describe('fleetDockModel — the «ПРИЧАЛЫ» column (TR06 Water Hauling)', () => {
  describe('fleetDockViews — which docks stand in the column', () => {
    it('only the viewer\'s DOCK cards stand (the manifest flag), in tableau order, each with its live verdict', () => {
      const views = fleetDockViews([card(CardName.BIRDS), card(DOCK)], isDock, [offer(true)]);
      expect(views.map((v) => v.card)).deep.eq([DOCK]);
      expect(views[0].offer?.available).is.true;
      expect(views[0].dockedColor).is.undefined;
    });

    it('outside the trade window a dock stands on its public state — the fleet on it, in the owner\'s livery', () => {
      const views = fleetDockViews([card(DOCK, {fleetDocked: 'red'})], isDock, []);
      expect(views[0].offer).is.undefined;
      expect(views[0].dockedColor).eq('red');
    });

    it('no dock in the tableau → no column', () => {
      expect(fleetDockViews([card(CardName.BIRDS)], isDock, [])).deep.eq([]);
    });
  });

  describe('the dock\'s OWN refusal and the colony ladder', () => {
    it('the marker\'s reason wins in the window; the public state says «busy» outside it', () => {
      const [inWindow] = fleetDockViews([card(DOCK)], isDock, [offer(false, 'No ocean tile is left')]);
      expect(fleetDockOwnBlock(inWindow)).eq('No ocean tile is left');
      const [outside] = fleetDockViews([card(DOCK, {fleetDocked: 'blue'})], isDock, []);
      expect(fleetDockOwnBlock(outside)).eq(FLEET_DOCK_BUSY_REASON);
      const [free] = fleetDockViews([card(DOCK)], isDock, [offer(true)]);
      expect(fleetDockOwnBlock(free)).is.undefined;
    });

    it('an offered dock has no reason; a refused one ranks its own refusal FIRST (intrinsic), before the fleet and the turn', () => {
      const [free] = fleetDockViews([card(DOCK)], isDock, [offer(true)]);
      expect(fleetDockReason(free, input({tradeable: [DOCK]}))).is.undefined;
      const [busy] = fleetDockViews([card(DOCK)], isDock, [offer(false, FLEET_DOCK_BUSY_REASON)]);
      const reason = fleetDockReason(busy, input({availableFleets: 0, tradeable: []}));
      expect(reason?.key).eq(FLEET_DOCK_BUSY_REASON);
      expect(reason?.intrinsic).is.true;
    });

    it('no free fleet — the ladder\'s own rung; the turn is the calm last resort', () => {
      const [dock] = fleetDockViews([card(DOCK)], isDock, []);
      expect(fleetDockReason(dock, input({availableFleets: 0}))?.key).eq('No trade fleet available');
      const turn = fleetDockReason(dock, input({availableFleets: 1}));
      expect(turn?.key).eq('Not your turn to take any actions');
      expect(turn?.blocker.tone).eq('warning');
    });
  });

  describe('fleetDockTileStatus — free · the fleet on the card · the reason', () => {
    it('a free dock in the window reads «Причал свободен»', () => {
      const [dock] = fleetDockViews([card(DOCK)], isDock, [offer(true)]);
      expect(fleetDockTileStatus(dock, input({tradeable: [DOCK]}))).deep.eq({kind: 'free', text: DOCK_FREE_KEY});
    });

    it('the fleet on the card — until the generation ends', () => {
      const [dock] = fleetDockViews([card(DOCK, {fleetDocked: 'blue'})], isDock, [offer(false, FLEET_DOCK_BUSY_REASON)]);
      expect(fleetDockTileStatus(dock, input())).deep.eq({kind: 'docked', text: DOCK_DOCKED_KEY});
    });

    it('the reward\'s own refusal is the tile\'s reason', () => {
      const [dock] = fleetDockViews([card(DOCK)], isDock, [offer(false, 'No ocean tile is left')]);
      expect(fleetDockTileStatus(dock, input({tradeable: ['Luna']}))).deep.eq({kind: 'blocked', text: 'No ocean tile is left'});
    });

    it('OUTSIDE the window (no prompt, not the turn) the dock itself is free — the turn never reads on a tile', () => {
      const [dock] = fleetDockViews([card(DOCK)], isDock, []);
      expect(fleetDockTileStatus(dock, input())).deep.eq({kind: 'free', text: DOCK_FREE_KEY});
    });
  });

  describe('colonyCursorStep — the column is a stop of the overview\'s ring', () => {
    const at = (zone: ColonyCursor['zone'], index: number, dock = 0): ColonyCursor => ({zone, index, dock});
    // Six colonies, 3 × 2.
    const step = (dir: 'up' | 'down' | 'left' | 'right', cursor: ColonyCursor, docks = 1) => colonyCursorStep(dir, cursor, 6, 3, docks, colonyNavStep);

    it('▶ from a row\'s LAST tile enters the column at that row\'s height (clamped to the docks)', () => {
      expect(step('right', at('grid', 2))).deep.eq(at('docks', 2, 0));
      expect(step('right', at('grid', 5), 3)).deep.eq(at('docks', 5, 1));
      expect(step('right', at('grid', 5), 1)).deep.eq(at('docks', 5, 0));
    });

    it('▶ inside a row walks the grid as before', () => {
      expect(step('right', at('grid', 0))).deep.eq(at('grid', 1));
      expect(step('down', at('grid', 1))).deep.eq(at('grid', 4));
    });

    it('◀ returns to the VERY tile it left; ↑/↓ walk the column with the edge felt; ▶ stays', () => {
      expect(step('left', at('docks', 5, 0))).deep.eq(at('grid', 5, 0));
      expect(step('down', at('docks', 2, 0), 3)).deep.eq(at('docks', 2, 1));
      expect(step('down', at('docks', 2, 2), 3)).deep.eq(at('docks', 2, 2));
      expect(step('up', at('docks', 2, 0), 3)).deep.eq(at('docks', 2, 0));
      expect(step('right', at('docks', 2, 0))).deep.eq(at('docks', 2, 0));
    });

    it('with no dock the grid is all there is; with no colony the cursor lives in the column', () => {
      // (The grid's own step: ▶ at a row's end walks on into the next row, as it always has.)
      expect(step('right', at('grid', 2), 0)).deep.eq(at('grid', colonyNavStep('right', 2, 6, 3)));
      expect(colonyCursorStep('left', at('docks', 0, 0), 0, 3, 1, colonyNavStep)).deep.eq(at('docks', 0, 0));
    });

    it('an incomplete last row: its last tile is a row end (5 colonies, 3 + 2)', () => {
      expect(colonyCursorStep('right', at('grid', 4), 5, 3, 1, colonyNavStep)).deep.eq(at('docks', 4, 0));
    });
  });

  describe('fleetDockEffectNode — the printed row the card answers with', () => {
    it('finds Water Hauling\'s «▲* : [ocean]» effect by its TRADE cause', () => {
      const node = fleetDockEffectNode(getCard(DOCK)?.metadata.renderData);
      expect(node).is.not.undefined;
      const cause = node?.rows[0] ?? [];
      expect(cause.some((n) => isICardRenderItem(n) && n.type === CardRenderItemType.TRADE)).is.true;
      const result = node?.rows[2] ?? [];
      expect(result.some((n) => isICardRenderItem(n) && n.type === CardRenderItemType.OCEANS)).is.true;
    });

    it('a card with no such row answers undefined (the impulse degrades to the plate)', () => {
      expect(fleetDockEffectNode(getCard(CardName.BIRDS)?.metadata.renderData)).is.undefined;
      expect(fleetDockEffectNode(undefined)).is.undefined;
    });
  });
});
