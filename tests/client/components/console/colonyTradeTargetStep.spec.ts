import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {ColonyTradeFollowUpRole} from '@/common/models/ColonyTradePreviewModel';
import {TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {
  buildColonyTradeTargetModel, colonyTradeCardDestinations, colonyTradeTargetIcon,
  presentedTargetModel,
} from '@/client/console/colonyTrade/colonyTradeTargetStep';

const card = (name: string, resources?: number): CardModel => ({name, resources} as CardModel);

function pickStep(opts: {
  role?: ColonyTradeFollowUpRole,
  resource?: string,
  amount?: number,
  cards: ReadonlyArray<CardModel>,
}): Extract<TradeStep, {kind: 'cardTarget'}> {
  return {
    kind: 'cardTarget',
    role: opts.role ?? 'tradeReward',
    resource: opts.resource,
    amount: opts.amount ?? 1,
    pick: {title: 'Select card to add', cards: opts.cards} as SelectCardModel,
  };
}

const PLAYERS = [
  {name: 'admin', color: 'red', tableau: [{name: 'Dirigibles'}, {name: 'Jupiter Floating Station'}]},
  {name: 'victor', color: 'blue', tableau: [{name: 'Pets'}]},
];

describe('colonyTradeTargetStep — the trade reward on the SHARED target selector', () => {
  /**
   * THE WHOLE POINT of the glue: the trade's card-target step must produce the
   * very model the blue-action / play composers feed the shared selector — the
   * same physical faces, ownership and honest `current → resulting` — never a
   * colony-only parallel picker.
   */
  it('builds the shared selector model from the trade step', () => {
    const step = pickStep({resource: 'Floater', amount: 2, cards: [card('Dirigibles', 2), card('Jupiter Floating Station')]});
    const m = buildColonyTradeTargetModel({
      step, ask: 'Выберите карту', players: PLAYERS, viewerColor: 'red',
      typeOf: () => CardType.ACTIVE, resourceOf: () => undefined,
    });
    expect(m.owners).to.have.length(1);
    expect(m.owners[0].self).to.eq(true);
    expect(m.contract.targetCount).to.eq(2);
    const dirigibles = m.owners[0].candidates.find((c) => c.cardName === 'Dirigibles');
    const impact = dirigibles?.preview[0]?.impacts[0];
    expect(impact?.from, 'the honest before').to.eq(2);
    expect(impact?.to, 'the honest after').to.eq(4);
    expect(impact?.icon).to.eq('floater');
    // ZERO IS A READING: an empty legal target still answers «сколько там».
    const station = m.owners[0].candidates.find((c) => c.cardName === 'Jupiter Floating Station');
    expect(station?.resourceContext).to.deep.eq({icon: 'floater', count: 0, showZero: true});
    expect(station?.preview[0]?.impacts[0]?.from).to.eq(0);
    expect(station?.preview[0]?.impacts[0]?.to).to.eq(2);
  });

  /** No source CARD stands on the colony stage (the hero is the planet), so
   *  the «ЭТА КАРТА» proxy must never appear — every candidate is a face. */
  it('never marks a source-card relation', () => {
    const step = pickStep({resource: 'Floater', cards: [card('Dirigibles'), card('Jupiter Floating Station')]});
    const m = buildColonyTradeTargetModel({
      step, ask: '', players: PLAYERS, viewerColor: 'red',
      typeOf: () => CardType.ACTIVE, resourceOf: () => undefined,
    });
    expect(m.owners[0].candidates.every((c) => c.relation === 'external-card')).to.eq(true);
  });

  /** The Venus «any resource» step names no resource — the icon then answers
   *  PER CANDIDATE, from the card's own resource type. */
  it('resolves the icon per candidate when the step names no resource', () => {
    expect(colonyTradeTargetIcon({resource: 'Floater'}, () => 'animal', 'X' as CardName)).to.eq('floater');
    expect(colonyTradeTargetIcon({resource: undefined}, () => 'Animal', 'X' as CardName)).to.eq('animal');
    expect(colonyTradeTargetIcon({resource: undefined}, () => undefined, 'X' as CardName)).to.eq(undefined);
  });

  describe('colonyTradeCardDestinations — ONE read for the flight and the scene', () => {
    const steps: Array<TradeStep> = [
      pickStep({role: 'colonyBonus', resource: 'Floater', amount: 1, cards: [card('Dirigibles', 2), card('Jupiter Floating Station')]}),
      pickStep({role: 'tradeReward', resource: 'Floater', amount: 2, cards: [card('Dirigibles', 2), card('Jupiter Floating Station')]}),
    ];
    const stepKeys = ['target:0', 'target:1'];

    it('carries picked targets into both the flight targets and the presented scene', () => {
      const {targets, presented} = colonyTradeCardDestinations({
        steps, stepKeys,
        captures: {'target:0': 'Jupiter Floating Station', 'target:1': 'Dirigibles'},
        notices: [],
        resourceOf: () => undefined,
        beforeOf: () => 0,
      });
      expect(targets.incomeTargetCard).to.eq('Dirigibles');
      expect(targets.bonusTargetCards).to.deep.eq(['Jupiter Floating Station']);
      expect(presented.map((p) => p.card)).to.deep.eq(['Jupiter Floating Station', 'Dirigibles']);
      expect(presented[1].before, 'before comes from the pick list\'s live count').to.eq(2);
      expect(presented[1].amount).to.eq(2);
    });

    /** An AUTO target (a single candidate the server applies without a
     *  prompt) is still a DESTINATION: the chip must land on the real card
     *  and the scene must present it. */
    it('includes the auto single-candidate target', () => {
      const {targets, presented} = colonyTradeCardDestinations({
        steps: [], stepKeys: [],
        captures: {},
        notices: [
          {kind: 'autoTarget', role: 'tradeReward', resource: 'Floater', amount: 1, card: 'Dirigibles' as CardName},
          {kind: 'lostResource', role: 'colonyBonus', resource: 'Floater', amount: 1},
        ],
        resourceOf: () => undefined,
        beforeOf: (name) => name === 'Dirigibles' ? 3 : 0,
      });
      expect(targets.incomeTargetCard).to.eq('Dirigibles');
      expect(presented).to.have.length(1);
      expect(presented[0].before, 'the auto target\'s before is the tableau truth').to.eq(3);
    });

    /** An uncaptured pick contributes nothing — the destination list may
     *  never guess (the batch truncates there too). */
    it('skips uncaptured steps', () => {
      const {targets, presented} = colonyTradeCardDestinations({
        steps, stepKeys, captures: {'target:0': 'Jupiter Floating Station'},
        notices: [], resourceOf: () => undefined, beforeOf: () => 0,
      });
      expect(targets.incomeTargetCard).to.eq(undefined);
      expect(presented).to.have.length(1);
    });

    /** Income and bonus aimed at the SAME card are one physical face whose
     *  amounts accumulate — never two copies of one object on stage. */
    it('merges presented rows per card', () => {
      const {presented} = colonyTradeCardDestinations({
        steps, stepKeys,
        captures: {'target:0': 'Dirigibles', 'target:1': 'Dirigibles'},
        notices: [], resourceOf: () => undefined, beforeOf: () => 0,
      });
      expect(presented).to.have.length(1);
      expect(presented[0].card).to.eq('Dirigibles');
      expect(presented[0].amount).to.eq(3);
      expect(presented[0].before, 'the pre-trade truth, once').to.eq(2);
    });
  });

  /**
   * A BUILD'S PLACEMENT BONUS IS THE SAME DECISION. It rides the same step
   * shape and the same destination read, so its card is pre-collected on the
   * stage and answered in the build's own batch — never a prompt after the
   * cube has landed. Its target is the ACT's primary one (`incomeTargetCard`,
   * what the transaction flies), not a per-cube bonus list.
   */
  it('routes a BUILD bonus target like the act\'s primary destination', () => {
    const step = pickStep({role: 'buildBonus', resource: 'Floater', amount: 3, cards: [card('Dirigibles', 1)]});
    const {targets, presented} = colonyTradeCardDestinations({
      steps: [step], stepKeys: ['target:0'],
      captures: {'target:0': 'Dirigibles'},
      notices: [], resourceOf: () => undefined, beforeOf: () => 0,
    });
    expect(targets.incomeTargetCard).to.eq('Dirigibles');
    expect(targets.bonusTargetCards, 'a build has no per-cube list').is.undefined;
    expect(presented).to.deep.eq([
      {card: 'Dirigibles', role: 'buildBonus', icon: 'floater', amount: 3, before: 1},
    ]);
  });

  /**
   * THE HONEST COUNTER: frozen at the pre-trade value, ticking by exactly
   * what has PHYSICALLY landed — a multi-chip payout ticks per contact — and
   * never past the promised total, whatever the store underneath commits.
   */
  it('presentedTargetModel freezes, ticks per landing, and clamps', () => {
    const t = {card: 'Dirigibles' as CardName, role: 'tradeReward' as const, icon: 'floater', amount: 2, before: 1};
    const live = card('Dirigibles', 3); // the store already committed +2
    expect(presentedTargetModel(t, live, 0).resources, 'frozen before any contact').to.eq(1);
    expect(presentedTargetModel(t, live, 1).resources, 'ticks per landed chip').to.eq(2);
    expect(presentedTargetModel(t, live, 2).resources).to.eq(3);
    expect(presentedTargetModel(t, live, 9).resources, 'never past the promise').to.eq(3);
    expect(presentedTargetModel(t, undefined, 0).resources, 'a missing live model still reads').to.eq(1);
  });
});
