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
  ColonyCursor, DOCK_DOCKED_KEY, DOCK_FREE_KEY, FleetDockReasonInput, colonyCursorStep, fleetDockEffectNode,
  fleetDockOwnBlock, fleetDockReason, fleetDockRewardCategory, fleetDockScenePlan, fleetDockTileStatus, fleetDockViews,
  reactionRailSpecs, tradeKnownRailMoves,
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

    it('three shapes of data, three categories', () => {
      expect(fleetDockRewardCategory([placeOcean]), 'TR06: the reward is ahead, on the board').eq('placement');
      expect(fleetDockRewardCategory([]), 'TR26: the reward arrived with the answer').eq('rail');
      expect(fleetDockRewardCategory([floaterTarget]), 'TR27: the reward asks').eq('question');
    });

    it('seniority: a question outranks a surface ahead; a surface ahead outranks a plain gain', () => {
      expect(fleetDockRewardCategory([placeOcean, floaterTarget])).eq('question');
      // Water Hauling states BOTH a placement and a TR chip — the TR is the ocean's own, never the card's.
      expect(fleetDockScenePlan({effects: [ocean, tr], followUps: [placeOcean]})).deep.eq({category: 'placement', answer: 'global', specs: [], reactions: []});
    });

    it('a `placement` plan flies nothing and holds nothing, even when the table would answer its TR chip', () => {
      const plan = fleetDockScenePlan({effects: [ocean, tr], followUps: [placeOcean], reactions: [greens()]});
      expect(plan.specs).deep.eq([]);
      expect(plan.reactions, 'the Greens pay at the placement — the board\'s story, not the stage\'s').deep.eq([]);
    });

    it('a `rail` plan: the TR flies off the printed rating (the impulse lands on the parameter), the Greens\' M€ follows it', () => {
      expect(fleetDockScenePlan({effects: [tr], followUps: [], reactions: [greens()]})).deep.eq({
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

    it('a `question` is named and NOT built: the honest default — nothing flown, nothing withheld', () => {
      expect(fleetDockScenePlan({effects: [mcProduction], followUps: [floaterTarget]})).deep.eq({category: 'question', answer: 'generic', specs: [], reactions: []});
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
