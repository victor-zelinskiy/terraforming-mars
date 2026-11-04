import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {CardReactionRecord} from '@/common/models/CardReactionModel';
import {GameEvent} from '@/common/events/GameEvent';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Phase} from '@/common/Phase';
import {slotMeta, TILE_VETO_NOTE} from '@/client/console/actionTileView';
import {ConsoleActionTile} from '@/client/console/consoleCardActions';
import {buildLtQuickEntries} from '@/client/console/consoleQuickModel';
import {RATING_REFUSAL_NOTE, ratingRefusalOfEffects, ratingRefusalSourceOf} from '@/client/console/ratingRefusal';
import {RATING_SKIP_MARK_HINT, ratingSkipMarkOf} from '@/client/console/railMarks';
import {reactionGroupOf, reactionImpactSpec} from '@/client/console/cardReaction/cardReactionModel';
import {diffRootNotifications} from '@/client/components/notifications/notificationModel';

/**
 * P57 PRESERVATION PROGRAM — THE READINGS of a CARD's refused rating («skip the first TR you gain in each
 * generation's action phase»). The same grammar as the law's veto (RX42), the CARD as the source:
 *  · the chip: struck, `data-veto-source="card"`, the card named in its hint — never the law's words;
 *  · the action tile's and the wheel's notes name the card's skip («Первый РТ пропускается»), the law's stay;
 *  · the rail mark: the server's `ratingSkip`, one sentence per state, `armed` naming the action phase;
 *  · the reaction: a `skip` impact is no token — the group carries it apart, nothing flies;
 *  · the feed: the viewer's own action's skip is ONE card naming the card and the lost step.
 */
const BLUE = 'blue' as Color;
const LAW = 'RDX_REDS_UNMI_VETO';
const CARD = CardName.PRESERVATION_PROGRAM;

const skippedTr = (extra: Partial<ActionEffect> = {}): ActionEffect =>
  ({direction: 'gain', icon: 'tr', amount: 1, vetoed: {card: CARD, steps: 1}, ...extra});

describe('PreservationProgram — the readings of a card\'s skipped rating', () => {
  describe('the source', () => {
    it('a mark names its refuser: a card when it carries one, else the law', () => {
      expect(ratingRefusalSourceOf({card: CARD})).eq('card');
      expect(ratingRefusalSourceOf({})).eq('law');
      expect(ratingRefusalOfEffects([{direction: 'gain', icon: 'tr', amount: 2}, skippedTr()])).eq('card');
      expect(ratingRefusalOfEffects([{direction: 'gain', icon: 'tr', amount: 2, vetoed: {resolution: LAW, steps: 2}}])).eq('law');
      expect(ratingRefusalOfEffects([{direction: 'gain', icon: 'tr', amount: 2}])).is.undefined;
    });
  });

  describe('the chip', () => {
    it('struck in the one register, the CARD in its hint and on `data-veto-source` — never the law', () => {
      const w = mount(ActionEffectChip, {...globalConfig, props: {effect: skippedTr()}});
      const root = w.find('.action-effect-chip');
      expect(root.classes()).includes('action-effect-chip--vetoed');
      expect(root.attributes('data-veto-source')).eq('card');
      expect(root.attributes('data-vetoed')).eq('1');
      const hint = root.attributes('data-hint') ?? '';
      expect(hint).match(/Preservation Program|Программа сохранения/);
      expect(hint).not.match(/UNMI|Veto|вето/i);
      w.unmount();
    });

    it('a law\'s chip keeps `data-veto-source="law"`', () => {
      const w = mount(ActionEffectChip, {...globalConfig, props: {effect: {direction: 'gain', icon: 'tr', amount: 1, vetoed: {resolution: LAW, steps: 1}}}});
      expect(w.find('.action-effect-chip').attributes('data-veto-source')).eq('law');
      w.unmount();
    });
  });

  describe('the notes before the press', () => {
    const tile = (extra: Partial<ConsoleActionTile>): ConsoleActionTile => ({
      key: 'x#0', cardName: CardName.WATER_SPLITTING_PLANT, nodeIndex: 0, node: {} as never, status: 'available', branch: undefined,
      costEffects: [], gainEffects: [], variableCost: [], variableGain: [], variableChoice: [], hasChoices: false, usedThisGen: false,
      choiceKinds: [], reason: undefined, blocker: undefined, ...extra,
    } as unknown as ConsoleActionTile);

    it('the action tile names the card\'s skip in the veto\'s slot — the law\'s note unchanged', () => {
      expect(slotMeta(tile({ratingVetoed: 1, ratingRefusal: 'card'})).text).eq(RATING_REFUSAL_NOTE.card);
      expect(slotMeta(tile({ratingVetoed: 1, ratingRefusal: 'card'})).kind).eq('veto');
      expect(slotMeta(tile({ratingVetoed: 1})).text).eq(TILE_VETO_NOTE);
    });

    it('the wheel\'s heat verb names the refuser', () => {
      const heat = (refusal: 'law' | 'card' | undefined) => buildLtQuickEntries({
        myTurn: true, awaitingInput: true, stdAvailable: true, endTurnAvailable: false, passAvailable: true,
        convertPlantsAvailable: true, convertHeatAvailable: true, plantsNeeded: 8, heatNeeded: 8,
        convertHeatVetoed: true, ...(refusal === undefined ? {} : {convertHeatRefusal: refusal}),
      }).find((e) => e.id === 'convertHeat');
      expect(heat('card')?.note).eq('First TR is skipped');
      expect(heat('law')?.note).eq('TR under the veto');
      expect(heat(undefined)?.note).eq('TR under the veto');
    });
  });

  describe('the rail mark', () => {
    it('the server\'s field, verbatim; `armed` names the action phase', () => {
      expect(ratingSkipMarkOf({ratingSkip: 'armed'})).eq('armed');
      expect(ratingSkipMarkOf({ratingSkip: 'spent'})).eq('spent');
      expect(ratingSkipMarkOf({})).is.undefined;
      expect(RATING_SKIP_MARK_HINT.armed).contains('action phase');
      expect(RATING_SKIP_MARK_HINT.armed).contains('${0}');
      expect(RATING_SKIP_MARK_HINT.spent).not.eq(RATING_SKIP_MARK_HINT.armed);
    });
  });

  describe('the reaction', () => {
    const record = (impacts: CardReactionRecord['impacts']): CardReactionRecord => ({
      seq: 1, root: {actionId: 5, player: BLUE}, owner: BLUE, kind: 'card', card: CARD, channel: 'rating-skipped', impacts,
    });

    it('a `skip` impact is no token: nothing on the rail, nothing on a card, nothing «elsewhere» — the group\'s own skips', () => {
      const skip = {kind: 'skip' as const, icon: 'tr' as const, amount: 1, to: BLUE};
      expect(reactionImpactSpec(skip)).is.undefined;
      const group = reactionGroupOf(record([skip]), BLUE);
      expect(group.rail).deep.eq([]);
      expect(group.cards).deep.eq([]);
      expect(group.elsewhere).deep.eq([]);
      expect(group.skips).deep.eq([skip]);
      expect(reactionGroupOf(record([skip]), 'red' as Color).skips, 'another seat\'s skip is not the viewer\'s').deep.eq([]);
    });
  });

  describe('the feed', () => {
    it('the viewer\'s OWN action whose rating the card skipped is ONE card: the card the source, the lost step named', () => {
      const header = new LogMessage(LogMessageType.DEFAULT, '${0} converted heat', [{type: LogMessageDataType.PLAYER, value: BLUE}]);
      header.correlationId = 40;
      header.role = 'root-action';
      header.category = 'standard-action';
      const ev = (e: Partial<GameEvent> & Pick<GameEvent, 'id' | 'type'>): GameEvent =>
        ({generation: 2, phase: Phase.ACTION, correlationId: 40, visibility: 'journal', impact: {}, ...e} as GameEvent);
      const chain = [
        ev({id: 40, type: 'action', player: BLUE, source: {kind: 'standard-action'} as never}),
        ev({id: 41, type: 'global-parameter-changed', player: BLUE, impact: {globalParameter: {parameter: 1 as never, steps: 1}}}),
        ev({id: 42, type: 'effect-triggered', player: BLUE, trigger: 'rating-skipped', parentId: 40, source: {kind: 'card', card: CARD, owner: BLUE} as never}),
        ev({id: 43, type: 'effect-skipped', player: BLUE, parentId: 42, source: {kind: 'card', card: CARD, owner: BLUE} as never,
          impact: {skipped: {label: 'Terraform rating', reason: 'Preservation Program skips the first TR you gain in each generation\'s action phase', effect: {direction: 'gain', icon: 'tr', amount: 1}}}}),
      ];
      const {models} = diffRootNotifications({messages: [header], events: chain, seen: new Set(), viewerColor: BLUE, generation: 2, createdAt: 1});
      expect(models).length(1);
      expect(models[0].variant).eq('passive-effect');
      expect(models[0].effectSource).deep.eq({kind: 'card', card: CARD});
      expect(models[0].skipped?.[0]).deep.include({label: 'Terraform rating', chip: {icon: 'tr', text: '+1'}});
      expect(models[0].cta?.action).eq('open-journal');
    });
  });
});
