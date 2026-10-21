import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {ActionEffect, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {CardModel} from '@/common/models/CardModel';
import {ParliamentPhaseSummaryModel, ParliamentPlayerModel, RatingVetoModel} from '@/common/models/ParliamentModel';
import {gainAtParameterLimit, gainHasNoEffect, vetoedChip} from '@/client/components/actions/actionEffectReading';
import {handForecastPlate} from '@/client/console/countedPlay';
import {slotMeta, TILE_VETO_NOTE} from '@/client/console/actionTileView';
import {ConsoleActionTile} from '@/client/console/consoleCardActions';
import {buildLtQuickEntries} from '@/client/console/consoleQuickModel';
import {finaleYieldKey, YIELD_TR, YIELD_TR_VETOED} from '@/client/console/finalGreenery/finalGreeneryModel';
import {agendaWalkBonuses, agendaWalkReactions} from '@/client/console/parliament/agendaWalk';
import {careerWalkBonuses} from '@/client/console/parliament/careerGrantBeat';
import {resultsReadingOf} from '@/client/console/parliament/parliamentResultsModel';
import {dossierSealedFacts} from '@/client/console/infoDossierModel';
import {
  ratingVetoReadingOf, VETO_READING_OTHERS, VETO_READING_OTHERS_YOURS, VETO_READING_SOLO, VETO_READING_TIE, VETO_READING_YOU,
} from '@/client/console/parliament/voteInfoModel';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * UNMI VETO (Turmoil Redux, RX42) — THE READINGS of the rating veto: every surface that says «this rating will not
 * come» reads the SERVER's marks (`ActionEffect.vetoed`, `CardModel.ratingVetoed`, `RatingVetoModel`, the Agenda step's
 * `vetoed`) and counts nothing itself. Pinned here:
 *  · the chip: struck in the replaced-unit register, the law in its hint, NO tail; never «no effect» / «at maximum»;
 *  · the hand plate: the struck rating as the plate's last item, beside a counted plate or alone;
 *  · the action tile's third note («РТ под вето») — under a «no effect» verdict the verdict wins;
 *  · the basic-actions wheel: the heat verb's quiet note;
 *  · the finale's yield under the veto; the Career walk flies no token for a refused step;
 *  · the vote panel's reading — you first · a tie · the other first (with and without the subject's rating) · solo,
 *    an unbound seat (a bot outside the aspect) never named;
 *  · the results' veto line, the sealed dossier's fact.
 */
const LAW = 'RDX_REDS_UNMI_VETO';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const GREEN = 'green' as Color;

function lawName(): string {
  const resolution = getResolution(LAW);
  if (resolution === undefined) {
    throw new Error('UNMI Veto is not in the client manifest');
  }
  return resolution.text.name;
}

const vetoedTr = (steps: number, extra: Partial<ActionEffect> = {}): ActionEffect =>
  ({direction: 'gain', icon: 'tr', amount: steps, vetoed: {resolution: LAW, steps}, ...extra});

function seat(color: Color, extra: Partial<ParliamentPlayerModel> = {}): ParliamentPlayerModel {
  return {
    color, participates: true, enactment: true, seatGrant: true, restriction: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false,
    agenda: 3, influence: 2, access: [], partyActionUses: {}, resolutionActionUses: 0, ...extra,
  };
}

const nameOf = (color: Color): string => ({blue: 'Анна', red: 'Борис', green: 'Вера'} as Record<string, string>)[color] ?? color;

describe('UnmiVeto — the readings of the rating veto', () => {
  describe('the chip', () => {
    it('a vetoed rating is STRUCK in the replaced-unit register, names the law in its hint and grows no tail', () => {
      const w = mount(ActionEffectChip, {...globalConfig, props: {effect: vetoedTr(2, {current: 30, resulting: 32})}});
      const root = w.find('.action-effect-chip');
      expect(root.classes()).includes('action-effect-chip--diverted');
      expect(root.classes()).includes('action-effect-chip--vetoed');
      expect(root.classes()).includes('premium-tooltip');
      expect(root.attributes('data-vetoed')).eq('2');
      expect(root.attributes('data-hint') ?? '', 'the law by its printed name (the manifest one), translated where a locale is loaded').match(/UNMI Veto|Вето UNMI/);
      expect(lawName()).eq('UNMI Veto');
      expect(root.attributes('data-hint') ?? '').includes('2');
      expect(w.find('[data-chip-diverted]').exists(), 'nothing stands in the rating\'s place — no tail').is.false;
      expect(w.find('.action-effect-chip__note--noeffect').exists(), 'never «no effect»').is.false;
      w.unmount();
    });

    it('the reading helpers: a vetoed chip is never «no effect» nor «at the maximum»', () => {
      const chip = vetoedTr(1, {current: 30, resulting: 30});
      expect(vetoedChip(chip)).is.true;
      expect(gainHasNoEffect(chip)).is.false;
      expect(gainAtParameterLimit({...chip, icon: 'temperature'})).is.false;
      expect(vetoedChip({direction: 'gain', icon: 'tr', amount: 1})).is.false;
    });
  });

  describe('the hand plate', () => {
    const card = (extra: Partial<CardModel>): CardModel => ({name: CardName.ASTEROID, ...extra} as CardModel);

    it('the struck rating is the plate\'s last item — alone, or beside the counted plate', () => {
      const alone = handForecastPlate(card({ratingVetoed: {steps: 1}}));
      expect(alone?.veto).eq(1);
      expect(alone?.items.map((i) => i.struck)).deep.eq([true]);
      expect(alone?.items[0].amount).eq(1);
      expect(alone?.zero).is.false;
      const beside = handForecastPlate(card({countedPlay: [{direction: 'gain', icon: 'megacredits', amount: 4}], ratingVetoed: {steps: 2}}));
      expect(beside?.kind).eq('count');
      expect(beside?.items.map((i) => [i.amount, i.struck === true])).deep.eq([[4, false], [2, true]]);
      expect(beside?.veto).eq(2);
      expect(handForecastPlate(card({}))?.veto, 'nothing struck — no plate').is.undefined;
    });
  });

  describe('the action tile', () => {
    const tile = (extra: Partial<ConsoleActionTile>): ConsoleActionTile => ({
      key: 'x#0', cardName: CardName.WATER_SPLITTING_PLANT, nodeIndex: 0, node: {} as never, status: 'available', branch: undefined,
      costEffects: [], gainEffects: [], variableCost: [], variableGain: [], variableChoice: [], hasChoices: false, usedThisGen: false,
      choiceKinds: [], reason: undefined, blocker: undefined, ...extra,
    } as unknown as ConsoleActionTile);

    it('the third note «РТ под вето» — after the rules and the «no effect» verdict, before the continuation', () => {
      expect(slotMeta(tile({ratingVetoed: 1}))).deep.include({kind: 'veto', tone: 'warning'});
      expect(slotMeta(tile({ratingVetoed: 1})).text).eq(TILE_VETO_NOTE);
      expect(slotMeta(tile({ratingVetoed: 1, choiceKinds: ['card']})).kind, 'the veto before the continuation').eq('veto');
      expect(slotMeta(tile({ratingVetoed: 1, futile: {kind: 'rating-vetoed', reason: 'x'}})).kind, 'a «no effect» verdict outranks the note').eq('futile');
      expect(slotMeta(tile({ratingVetoed: 1, status: 'rules', reason: {message: 'No', params: []} as never})).kind, 'a blocked variant says why it is blocked').not.eq('veto');
      expect(slotMeta(tile({})).kind).eq('none');
    });
  });

  describe('the basic-actions wheel', () => {
    const ctx = (extra: Partial<Parameters<typeof buildLtQuickEntries>[0]>) => buildLtQuickEntries({
      myTurn: true, awaitingInput: true, stdAvailable: true, endTurnAvailable: false, passAvailable: true,
      convertPlantsAvailable: true, convertHeatAvailable: true, plantsNeeded: 8, heatNeeded: 8, ...extra,
    });

    it('the heat verb carries the quiet note under the veto — never under a «no effect» verdict, never when refused', () => {
      const heat = (entries: ReturnType<typeof buildLtQuickEntries>) => entries.find((e) => e.id === 'convertHeat');
      expect(heat(ctx({convertHeatVetoed: true}))?.note).eq('TR under the veto');
      expect(heat(ctx({}))?.note).is.undefined;
      expect(heat(ctx({convertHeatVetoed: true, convertHeatFutile: 'The temperature is at its maximum'}))?.note, 'the verdict says more').is.undefined;
      expect(heat(ctx({convertHeatVetoed: true, convertHeatAvailable: false}))?.note).is.undefined;
    });
  });

  describe('the finale and the Career', () => {
    it('the finale\'s yield under the veto says the rating does not come', () => {
      expect(finaleYieldKey(true)).eq(YIELD_TR);
      expect(finaleYieldKey(true, false, true)).eq(YIELD_TR_VETOED);
      expect(finaleYieldKey(false, false, true), 'no parliament, no veto').not.eq(YIELD_TR_VETOED);
    });

    it('a refused Career step flies no rating token and shares no answer; the record keeps the step', () => {
      const record = {player: BLUE, from: 1, to: 4, steps: [{to: 2, bonus: 'tr' as const, vetoed: true as const}, {to: 3}, {to: 4, bonus: 'tr' as const}]};
      const owed = agendaWalkBonuses(record, 4, [{channel: 'stock', resource: 'megacredits', amount: 2}]);
      expect(owed.map((o) => [o.step, o.kind])).deep.eq([[4, 'tr']]);
      expect(owed[0].reactions?.map((r) => r.amount)).deep.eq([2]);
      expect(agendaWalkReactions(record, {reactions: [{channel: 'stock', resource: 'megacredits', amount: 2}], known: {}}, undefined, undefined)).deep.eq([]);
      const career = careerWalkBonuses({key: 'k', player: BLUE, from: 1, to: 2, steps: [{to: 2, bonus: 'tr', vetoed: true}], generation: 4, viewer: true});
      expect(career).deep.eq([]);
    });
  });

  describe('the vote panel\'s reading', () => {
    const veto = (leaders: Array<{color: Color, tr: number}>): RatingVetoModel => ({leaders});
    const players = [seat(BLUE), seat(RED)];

    it('you first · a tie · the other first (with and without your rating) · solo', () => {
      const you = ratingVetoReadingOf(veto([{color: BLUE, tr: 32}]), BLUE, players, nameOf, 32);
      expect(you).deep.include({kind: 'you', key: VETO_READING_YOU, params: ['32']});
      const tie = ratingVetoReadingOf(veto([{color: BLUE, tr: 32}, {color: RED, tr: 32}]), BLUE, players, nameOf, 32);
      expect(tie).deep.include({kind: 'tie', key: VETO_READING_TIE, params: ['Борис', '32']});
      const others = ratingVetoReadingOf(veto([{color: RED, tr: 32}]), BLUE, players, nameOf, 28);
      expect(others).deep.include({kind: 'others', key: VETO_READING_OTHERS_YOURS, params: ['Борис', '32', '28']});
      const othersNoRating = ratingVetoReadingOf(veto([{color: RED, tr: 32}]), BLUE, players, nameOf);
      expect(othersNoRating).deep.include({kind: 'others', key: VETO_READING_OTHERS, params: ['Борис', '32']});
      const solo = ratingVetoReadingOf(veto([{color: BLUE, tr: 32}]), BLUE, [seat(BLUE)], nameOf, 32);
      expect(solo).deep.include({kind: 'solo', key: VETO_READING_SOLO, params: []});
      expect(ratingVetoReadingOf(undefined, BLUE, players, nameOf), 'no vetoing law').is.undefined;
      expect(ratingVetoReadingOf(veto([{color: RED, tr: 32}]), undefined, players, nameOf), 'no subject').is.undefined;
    });

    it('a seat outside the law\'s aspect (a bot under «none») leads the comparison unbound and is never named', () => {
      const bot = seat(GREEN, {restriction: false});
      const reading = ratingVetoReadingOf(veto([{color: GREEN, tr: 40}]), BLUE, [seat(BLUE), seat(RED), bot], nameOf, 30);
      expect(reading, 'nobody bound').is.undefined;
      const both = ratingVetoReadingOf(veto([{color: GREEN, tr: 40}, {color: RED, tr: 40}]), BLUE, [seat(BLUE), seat(RED), bot], nameOf, 30);
      expect(both?.params[0]).eq('Борис');
      expect(both?.leaders.map((l) => l.color)).deep.eq([RED]);
    });
  });

  describe('the results and the dossier', () => {
    it('the results carry the seats the law binds; the sealed dossier the law\'s name', () => {
      const summary: ParliamentPhaseSummaryModel = {
        generation: 3, final: false,
        winner: {instance: `${LAW}#0`, resolution: LAW, party: PartyName.REDS, votes: 1, player: BLUE},
        support: [], outcomes: [], refreshed: [], lobbyRefilled: [],
        enacted: {instance: `${LAW}#0`, resolution: LAW, party: PartyName.REDS},
      } as unknown as ParliamentPhaseSummaryModel;
      const reading = resultsReadingOf(summary, [{player: BLUE, lobby: true, reserve: 3}, {player: RED, lobby: true, reserve: 3}], [],
        {quiet: {kicker: 'Effect while enacted', kind: 'passive'}, veto: [{color: BLUE, tr: 32}]});
      expect(reading.veto).deep.eq([{color: BLUE, tr: 32}]);
      expect(reading.quiet?.kind).eq('passive');
      expect(resultsReadingOf(summary, [{player: BLUE, lobby: true, reserve: 3}], [], {veto: []}).veto, 'an empty list is no line').is.undefined;
      const sealed = dossierSealedFacts(32, BLUE, [], [], (name) => name, {law: 'UNMI Veto'});
      expect(sealed.veto).deep.eq({law: 'UNMI Veto'});
      expect(dossierSealedFacts(32, BLUE, [], [], (name) => name).veto).is.undefined;
    });
  });
});

/** The type the tile spec narrows to (the branch is read for its chips elsewhere). */
export type _Branch = ActionPreviewBranch;
