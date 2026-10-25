import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {FleetDockOfferModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {ColonyTradeFollowUpModel} from '@/common/models/ColonyTradePreviewModel';
import {EffectForecastFact} from '@/common/models/EffectForecastModel';
import {Payment} from '@/common/inputs/Payment';
import {afterConfirmNotes} from '@/client/components/colonies/colonyTradePlan';
import {RATING_RAIL_KEY, railRewardSpecs} from '@/client/console/resourceTransfer/resourceTransferModel';
import {FLEET_DOCK_BUSY_REASON} from '@/common/colonies/fleetDock';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {isICardRenderItem} from '@/common/cards/render/Types';
import {getCard} from '@/client/cards/ClientCardManifest';
import {colonyNavStep} from '@/client/console/consoleColoniesModel';
import {
  ColonyCursor, DOCK_DOCKED_KEY, DOCK_DOCKED_SHORT_KEY, DOCK_FREE_KEY, FleetDockReasonInput, colonyCursorStep, fleetDockEffectNode,
  fleetDockOwnBlock, fleetDockReason, fleetDockRewardCategory, fleetDockScenePlan, fleetDockTileLabel, fleetDockTileStatus, fleetDockViews,
  reactionRailSpecs, tradeKnownRailMoves, cardTargetTokens, printedRewardUnits, planDockFit, fleetDockPrintedReward, DockFitInput,
} from '@/client/console/colonyTrade/fleetDockModel';
import {CardResource} from '@/common/CardResource';

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
      expect(fleetDockTileStatus(dock, input())).deep.eq({kind: 'docked', text: DOCK_DOCKED_KEY, short: DOCK_DOCKED_SHORT_KEY});
    });

    // PL-016: the whole sentence is 46 letters and the column holds about 17 — the tile says the STATE, the
    // rail under the grid says the rest. The whole statement stays the status's `text` (what the rail prints).
    it('the TILE prints the short form where a status has one, the whole statement otherwise', () => {
      const [docked] = fleetDockViews([card(DOCK, {fleetDocked: 'blue'})], isDock, [offer(false, FLEET_DOCK_BUSY_REASON)]);
      const dockedStatus = fleetDockTileStatus(docked, input());
      expect(fleetDockTileLabel(dockedStatus)).eq(DOCK_DOCKED_SHORT_KEY);
      expect(dockedStatus.text, 'the rail keeps the whole statement').eq(DOCK_DOCKED_KEY);
      const [free] = fleetDockViews([card(DOCK)], isDock, [offer(true)]);
      expect(fleetDockTileLabel(fleetDockTileStatus(free, input({tradeable: [DOCK]})))).eq(DOCK_FREE_KEY);
      const [refused] = fleetDockViews([card(DOCK)], isDock, [offer(false, 'No ocean tile is left')]);
      expect(fleetDockTileLabel(fleetDockTileStatus(refused, input({tradeable: ['Luna']}))), 'a refusal is the sentence the server sent').eq('No ocean tile is left');
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

  describe('colonyCursorStep — the docks as a ROW under the grid (`below`)', () => {
    const at = (zone: ColonyCursor['zone'], index: number, dock = 0): ColonyCursor => ({zone, index, dock});
    // Five colonies, 3 + 2; the docks stand under them.
    const step = (dir: 'up' | 'down' | 'left' | 'right', cursor: ColonyCursor, docks = 2) =>
      colonyCursorStep(dir, cursor, 5, 3, docks, colonyNavStep, 'below');

    it('▼ from the LAST row enters the row under the tile\'s own place; a higher row walks the grid', () => {
      expect(step('down', at('grid', 3))).deep.eq(at('docks', 3, 0));
      expect(step('down', at('grid', 4))).deep.eq(at('docks', 4, 1));
      expect(step('down', at('grid', 0))).deep.eq(at('grid', 3));
      expect(step('down', at('grid', 4), 1)).deep.eq(at('docks', 4, 0));
    });

    it('▶ at a row end walks the grid (the group is not to the side); ▲ returns to the VERY tile', () => {
      expect(step('right', at('grid', 2))).deep.eq(at('grid', colonyNavStep('right', 2, 5, 3)));
      expect(step('up', at('docks', 4, 1))).deep.eq(at('grid', 4, 1));
    });

    it('◀ / ▶ walk the row with the edge felt; ▼ stays', () => {
      expect(step('right', at('docks', 3, 0))).deep.eq(at('docks', 3, 1));
      expect(step('right', at('docks', 3, 1))).deep.eq(at('docks', 3, 1));
      expect(step('left', at('docks', 3, 0))).deep.eq(at('docks', 3, 0));
      expect(step('down', at('docks', 3, 0))).deep.eq(at('docks', 3, 0));
    });
  });

  describe('planDockFit — ONE tile size for the grid and the docks group', () => {
    // The 1080 opening's room around a 5-colony table (3 + 2), in px at ui-scale 1.
    const base: DockFitInput = {
      availW: 1650, availH: 900, cols: 3, rows: 2, docks: 1, baseW: 366, baseH: 214,
      colGap: 18, rowGap: 16, padX: 36, padY: 26, slack: 12, groupGap: 28, caption: 24,
    };
    const fits = (i: DockFitInput, r: {scale: number, placement: 'side' | 'below'}): boolean => {
      const k = r.scale;
      if (r.placement === 'side') {
        const w = 2 * i.padX + (i.cols + 1) * i.baseW * k + (i.cols - 1) * i.colGap + i.groupGap;
        const h = Math.max(i.padY + i.rows * i.baseH * k + (i.rows - 1) * i.rowGap, i.padY + i.caption + i.docks * i.baseH * k + (i.docks - 1) * i.rowGap);
        return w <= i.availW + 0.5 && h <= i.availH + 0.5;
      }
      const w = Math.max(i.padX + i.cols * i.baseW * k + (i.cols - 1) * i.colGap, i.padX + i.docks * i.baseW * k + (i.docks - 1) * i.colGap);
      const h = 2 * i.padY + (i.rows + 1) * i.baseH * k + (i.rows - 1) * i.rowGap + i.groupGap + i.caption;
      return w <= i.availW + 0.5 && h <= i.availH + 0.5;
    };

    it('a wide 3-column table puts the docks UNDER it (one more row costs less than one more column)', () => {
      const plan = planDockFit(base);
      expect(plan.placement).eq('below');
      expect(fits(base, plan)).is.true;
    });

    it('a 2 × 2 table, height-bound, puts them BESIDE it', () => {
      const input = {...base, cols: 2, rows: 2};
      const plan = planDockFit(input);
      expect(plan.placement).eq('side');
      expect(fits(input, plan)).is.true;
    });

    it('whichever it picks, it is the LARGER tile of the two and it fits — three docks too', () => {
      for (const docks of [1, 2, 3]) {
        for (const [cols, rows] of [[1, 1], [2, 1], [3, 1], [2, 2], [3, 2]]) {
          const input = {...base, cols, rows, docks};
          const plan = planDockFit(input);
          expect(fits(input, plan), `${cols}×${rows}, ${docks} docks`).is.true;
          const other = plan.placement === 'side' ? 'below' : 'side';
          // The other placement's own best is never larger by more than the tie margin.
          let lo = 0;
          let hi = 3;
          for (let n = 0; n < 40; n++) {
            const mid = (lo + hi) / 2;
            if (fits(input, {scale: mid, placement: other})) {
              lo = mid;
            } else {
              hi = mid;
            }
          }
          expect(plan.scale, `${cols}×${rows}, ${docks} docks`).to.be.at.least(lo * 0.98 - 1e-3);
        }
      }
    });
  });

  describe('fleetDockPrintedReward — what the trade gives, in the card\'s own print', () => {
    it('the RESULT half of «▲* : [reward]» — the ocean, the rating, Aurora\'s floaters and production', () => {
      const types = (name: CardName) => fleetDockPrintedReward(getCard(name)?.metadata.renderData)
        .map((n) => (isICardRenderItem(n) ? n.type : (n as {is?: string} | undefined)?.is));
      expect(types(CardName.WATER_HAULING)).deep.eq([CardRenderItemType.OCEANS]);
      expect(types(CardName.UNMI_LINER)).deep.eq([CardRenderItemType.TR]);
      expect(types(CardName.AURORA_STATION)).deep.eq([CardRenderItemType.RESOURCE, CardRenderItemType.RESOURCE, 'production-box']);
    });

    it('a face with no trade row prints nothing', () => {
      expect(fleetDockPrintedReward(getCard(CardName.ALGAE)?.metadata.renderData)).deep.eq([]);
    });
  });

  describe('THREE docks in one tableau (TR06 + TR26 + TR27)', () => {
    it('the column holds the three in tableau order, each with its own verdict', () => {
      const views = fleetDockViews(
        [card(CardName.AURORA_STATION), card(CardName.WATER_HAULING, {fleetDocked: 'blue'}), card(CardName.UNMI_LINER)],
        isDock,
        [{card: CardName.AURORA_STATION, available: true, effects: []}, {card: CardName.UNMI_LINER, available: true, effects: []}]);
      expect(views.map((v) => [v.card, v.dockedColor, v.offer?.available])).deep.eq([
        [CardName.AURORA_STATION, undefined, true],
        [CardName.WATER_HAULING, 'blue', undefined],
        [CardName.UNMI_LINER, undefined, true],
      ]);
      expect(fleetDockOwnBlock(views[1]), 'the taken one names itself').eq(FLEET_DOCK_BUSY_REASON);
    });

    it('Aurora Station\'s printed row: «▲* : [floater·V] [floater·V] [prod M€]» — two tokens off two icons', () => {
      const node = fleetDockEffectNode(getCard(CardName.AURORA_STATION)?.metadata.renderData);
      expect(node, 'the fleet has a ▲ to land on').is.not.undefined;
      expect(printedRewardUnits(node, CardResource.FLOATER, 2)).eq(2);
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

    it('finds UNMI Liner\'s «▲* : [TR]» effect the same way — no dock is found by its name', () => {
      const node = fleetDockEffectNode(getCard(CardName.UNMI_LINER)?.metadata.renderData);
      expect(node).is.not.undefined;
      const result = node?.rows[2] ?? [];
      expect(result.some((n) => isICardRenderItem(n) && n.type === CardRenderItemType.TR)).is.true;
    });
  });

  /*
   * HOW THE TRADE ENDS — the reward's category, read off the SERVER's preview
   * (its chips and its follow-ups) and nothing else. The three shapes below are
   * the three sisters' own previews: TR06 Water Hauling (a placement and its TR
   * chip), TR26 UNMI Liner (a plain gain, nothing asked), TR27 Aurora Station
   * (a card target and a production step).
   */
  describe('the reward\'s category and the scene\'s plan — from the server\'s preview', () => {
    const tr: ActionEffect = {direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21};
    const ocean: ActionEffect = {direction: 'gain', icon: 'oceans', amount: 1, current: 3, resulting: 4};
    const mcProduction: ActionEffect = {direction: 'gain', icon: 'megacredits', amount: 1, current: 0, resulting: 1, note: 'production'};
    const placeOcean: ColonyTradeFollowUpModel = {kind: 'note', role: 'tradeReward', note: 'placeOcean'};
    const floaterTarget: ColonyTradeFollowUpModel = {kind: 'cardTarget', role: 'tradeReward', resource: undefined, amount: 2, lost: false};
    const greens = (extra: Partial<EffectForecastFact> = {}): EffectForecastFact => ({
      id: 'greens-tr', source: {kind: 'party', name: 'Greens', owner: 'blue', channel: 'tr-increase'},
      certainty: 'exact', recipient: {kind: 'you'}, timing: 'immediate',
      effects: [{direction: 'gain', icon: 'megacredits', amount: 2, current: 0, resulting: 2}],
      reason: 'The Greens pay 2 M€ per TR step you gain', ...extra,
    } as EffectForecastFact);
    /** The dock preview's forecast — the plan reads its facts only. */
    const forecastOf = (facts: ReadonlyArray<EffectForecastFact>) => ({facts});

    it('three shapes of data, three categories', () => {
      expect(fleetDockRewardCategory([placeOcean]), 'TR06: the reward is ahead, on the board').eq('placement');
      expect(fleetDockRewardCategory([]), 'TR26: the reward arrived with the answer').eq('rail');
      expect(fleetDockRewardCategory([floaterTarget]), 'TR27: the reward lands on a card').eq('card');
    });

    it('seniority: a card outranks a surface ahead; a surface ahead outranks a plain gain', () => {
      expect(fleetDockRewardCategory([placeOcean, floaterTarget])).eq('card');
      // Water Hauling states BOTH a placement and a TR chip — the TR is the ocean's own, never the card's.
      expect(fleetDockScenePlan({effects: [ocean, tr], followUps: [placeOcean]})).deep.eq({category: 'placement', answer: 'global', specs: [], reactions: []});
    });

    it('a `placement` plan flies nothing and holds nothing, even when the table would answer its TR chip', () => {
      const plan = fleetDockScenePlan({effects: [ocean, tr], followUps: [placeOcean], forecast: forecastOf([greens()])});
      expect(plan.specs).deep.eq([]);
      expect(plan.reactions, 'the Greens pay at the placement — the board\'s story, not the stage\'s').deep.eq([]);
    });

    it('a `rail` plan: the TR flies off the printed rating (the impulse lands on the parameter), the Greens\' M€ follows it', () => {
      expect(fleetDockScenePlan({effects: [tr], followUps: [], forecast: forecastOf([greens()])})).deep.eq({
        category: 'rail', answer: 'global',
        specs: [{channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}],
        reactions: [{channel: 'stock', resource: 'megacredits', amount: 2}],
      });
    });

    it('a `rail` plan of a standard resource lands the impulse on THAT resource\'s printed icon', () => {
      expect(fleetDockScenePlan({effects: [mcProduction], followUps: []})).deep.eq({
        category: 'rail', answer: 'resources', firstResource: 'megacredits',
        specs: [{channel: 'production', resource: 'megacredits', amount: 1}], reactions: [],
      });
    });

    it('a `rail` reward with nothing the rail can carry is the mechanical commit alone', () => {
      expect(fleetDockScenePlan({effects: [{direction: 'gain', icon: 'floater', amount: 2, note: 'on this card'}], followUps: []}))
        .deep.eq({category: 'rail', answer: 'generic', specs: [], reactions: []});
    });

    it('a `card` plan with no receiving card named (no choice, no holder) is the honest default — nothing flown', () => {
      expect(fleetDockScenePlan({effects: [mcProduction], followUps: [floaterTarget]})).deep.eq({category: 'card', answer: 'generic', specs: [], reactions: []});
      const lost: ColonyTradeFollowUpModel = {kind: 'cardTarget', role: 'tradeReward', resource: CardResource.FLOATER, amount: 2, lost: true};
      expect(fleetDockScenePlan({effects: [mcProduction], followUps: [lost]}, {target: 'Aurora Station' as CardName, tokens: 2}).specs).deep.eq([]);
    });

    describe('a `card` plan — THE CARD PAYS A CARD (TR27 Aurora Station)', () => {
      const AURORA = 'Aurora Station' as CardName;
      const HABS = 'Floating Habs' as CardName;
      const floaterChip: ActionEffect = {direction: 'gain', icon: 'floater', amount: 2, note: 'to a card'};
      const target = (extra: Partial<Extract<ColonyTradeFollowUpModel, {kind: 'cardTarget'}>> = {}): ColonyTradeFollowUpModel => ({
        kind: 'cardTarget', role: 'tradeReward', resource: CardResource.FLOATER, amount: 2,
        vpSteps: {[AURORA]: [{from: 0, to: 0}, {from: 0, to: 1}], [HABS]: [{from: 0, to: 1}, {from: 0, to: 1}]},
        lost: false, ...extra,
      } as ColonyTradeFollowUpModel);

      it('ONE token per printed icon, onto the chosen card, then the rail half (the M€ production) — in print order', () => {
        const plan = fleetDockScenePlan({effects: [floaterChip, mcProduction], followUps: [target()]}, {target: HABS, tokens: 2});
        expect(plan).deep.eq({
          category: 'card', answer: 'resources', firstResource: 'floater', target: HABS,
          specs: [
            {channel: 'card-resource', resource: 'floater', amount: 1, targetCard: HABS},
            {channel: 'card-resource', resource: 'floater', amount: 1, targetCard: HABS},
            {channel: 'production', resource: 'megacredits', amount: 1},
          ],
          // Habs at 1 floater: the FIRST token makes 2 (+1 VP), the second makes 3 (nothing more) — the server's per-unit reading.
          vp: [1, 0, 0],
          reactions: [],
        });
      });

      it('no choice to make: the server\'s one holder (`auto`) receives — the dock itself, its point on the second token', () => {
        const plan = fleetDockScenePlan({effects: [floaterChip, mcProduction], followUps: [target({auto: AURORA})]}, {tokens: 2});
        expect(plan.target).eq(AURORA);
        expect(plan.specs.map((s) => s.targetCard)).deep.eq([AURORA, AURORA, undefined]);
        expect(plan.vp).deep.eq([0, 1, 0]);
      });

      it('fewer printed icons than units: the units ride fewer tokens (the remainder on the first); never more tokens than units', () => {
        const one = cardTargetTokens(target() as never, AURORA, 1);
        expect(one.specs.map((s) => s.amount)).deep.eq([2]);
        expect(one.vp).deep.eq([1]);
        const many = cardTargetTokens(target() as never, AURORA, 5);
        expect(many.specs.map((s) => s.amount)).deep.eq([1, 1]);
      });

      it('the printed icons are counted off the render data — two floater icons on Aurora\'s row, one when the row prints one', () => {
        const node = {is: 'effect', rows: [[{type: 'trade'}], [], [
          {is: 'item', type: 'resource', resource: CardResource.FLOATER},
          {is: 'item', type: 'resource', resource: CardResource.FLOATER},
          {is: 'production-box'},
        ]]} as never;
        expect(printedRewardUnits(node, CardResource.FLOATER, 2)).eq(2);
        expect(printedRewardUnits(node, CardResource.FLOATER, 1), 'never more tokens than units').eq(1);
        expect(printedRewardUnits(undefined, CardResource.FLOATER, 2), 'no row: one token').eq(1);
      });
    });

    it('NO preview at the press (it outran the fetch): the phrase every dock played before categories', () => {
      expect(fleetDockScenePlan(undefined)).deep.eq({category: 'placement', answer: 'global', specs: [], reactions: []});
    });

    it('the table\'s answer is held only when it is EXACT and the viewer\'s own', () => {
      expect(reactionRailSpecs([greens()])).deep.eq([{channel: 'stock', resource: 'megacredits', amount: 2}]);
      expect(reactionRailSpecs([greens({certainty: 'asks'})]), 'a question is not an arrival').deep.eq([]);
      expect(reactionRailSpecs([greens({certainty: 'deferred'})]), 'a later payout is not this response\'s').deep.eq([]);
      expect(reactionRailSpecs([greens({certainty: 'unknown', effects: []})])).deep.eq([]);
      expect(reactionRailSpecs([greens({recipient: {kind: 'player', color: 'red'}} as Partial<EffectForecastFact>)]), 'another seat\'s gain is not on this rail').deep.eq([]);
      expect(reactionRailSpecs(undefined)).deep.eq([]);
    });

    it('the rail specs are the transfer model\'s own reading of the chips (one function for every reward on the rail)', () => {
      expect(fleetDockScenePlan({effects: [tr], followUps: []}).specs).deep.eq(railRewardSpecs([tr]));
    });
  });

  describe('tradeKnownRailMoves — the trade\'s OTHER moves on the viewer\'s rail', () => {
    const option = (icon: string, current: number, resulting: number): SelectOptionModel =>
      ({type: 'option', title: 't', buttonLabel: 'b', metadata: {icon, resource: {current, resulting}}} as unknown as SelectOptionModel);

    it('the chosen path\'s fee is the server\'s own current → resulting on its option', () => {
      expect(tradeKnownRailMoves({option: option('energy', 6, 3)})).deep.eq({'stock:energy': -3});
      expect(tradeKnownRailMoves({option: option('megacredits', 12, 3)})).deep.eq({'stock:megacredits': -9});
    });

    it('an M€ path that ASKED for its payment: the captured payment, row by row (Helion\'s heat)', () => {
      const payment = {...Payment.EMPTY, megacredits: 5, heat: 4};
      expect(tradeKnownRailMoves({option: option('megacredits', 5, 0), payment})).deep.eq({'stock:megacredits': -5, 'stock:heat': -4});
    });

    it('an energy path under Delta Works: the composition it was paid with', () => {
      expect(tradeKnownRailMoves({option: option('energy', 2, 0), mix: {energy: 2, steel: 1}})).deep.eq({'stock:energy': -2, 'stock:steel': -1});
    });

    it('a flat every-trade bonus adds to its row; a free path and a card-resource fee leave no rail row', () => {
      expect(tradeKnownRailMoves({option: option('megacredits', 12, 3), flatBonuses: [{resource: 'megacredits', amount: 3}]})).deep.eq({'stock:megacredits': -6});
      expect(tradeKnownRailMoves({option: {type: 'option', title: 't', buttonLabel: 'b'} as unknown as SelectOptionModel})).deep.eq({});
      expect(tradeKnownRailMoves({option: option('floater', 2, 1)})).deep.eq({});
      expect(tradeKnownRailMoves({option: undefined})).deep.eq({});
    });
  });

  describe('the «after confirming» line — ONE table for the colony stage and the dock stage', () => {
    it('Water Hauling\'s follow-up reads the table\'s own key; a reward that raises nothing has no line', () => {
      expect(afterConfirmNotes([{kind: 'note', role: 'tradeReward', note: 'placeOcean'}])).deep.eq(['After confirming: place an ocean tile']);
      expect(afterConfirmNotes([])).deep.eq([]);
    });

    it('a card target is no «after confirming» line (it is a step, or a notice of its own)', () => {
      expect(afterConfirmNotes([{kind: 'cardTarget', role: 'tradeReward', resource: undefined, amount: 2, lost: false}])).deep.eq([]);
    });
  });
});
