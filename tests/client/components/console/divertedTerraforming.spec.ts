import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {ActionEffect, ActionPreviewBranch, ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {divertedChip, gainAtParameterLimit, gainHasNoEffect} from '@/client/components/actions/actionEffectReading';
import {commitKindForBranch, commitRewardSpecs} from '@/client/console/consoleActionCommit';
import {extractPlayRewards} from '@/client/console/resourceTransfer/resourceTransferModel';
import {findConvertPlantsOption} from '@/client/console/turnIntents';
import {buildFinalGreenery, finaleYieldKey, YIELD_DATA, YIELD_TR} from '@/client/console/finalGreenery/finalGreeneryModel';
import {promptReceiveFamily} from '@/client/console/cardReceive/promptReceive';
import {isDivertedPick, isResolutionAsk} from '@/client/console/consoleMandatoryGate';
import {followUpStepStage} from '@/client/console/consoleTaskRouter';

/*
 * A UNIT A LAW REPLACES (Turmoil Redux RX35 Diverted Research) — the client's readings of the server's ONE exit
 * pass and ONE marker: the struck chip (never «no effect», never «at maximum»), the commit category (the data's
 * landing, never the HUD scale), the token born on the struck icon, the plant conversion found as an OPTION by its
 * structural card, the finale's replaced greenery, and the live «where» told from a sitting's ask by the marker.
 */
const LAW = 'RDX_REDS_DIVERTED_RESEARCH';
const SOURCE = {kind: 'resolution', resolution: LAW} as const;

const struck = (icon: string, data: number, lost = false): ActionEffect => ({
  direction: 'gain', icon, amount: data, current: 13, resulting: 14, unit: '%',
  diverted: {resolution: LAW, data, ...(lost ? {lost: true as const} : {})},
});

const whereInput = (over: Record<string, unknown> = {}): PlayerInputModel => ({
  type: 'card', title: 'Select the card for ${0} data diverted from terraforming', buttonLabel: 'Add resources',
  cards: [{name: CardName.SUPERCOMPUTER, resources: 0}], min: 1, max: 1,
  choiceContext: {source: SOURCE, mode: 'reward'},
  resourceGainPrompt: {amount: 1, cardResource: 'data', diverted: {resolution: LAW}},
  ...over,
} as unknown as PlayerInputModel);

const whereStep = (amount = 1): ActionPreviewStep => ({
  kind: 'input', input: whereInput({resourceGainPrompt: {amount, cardResource: 'data', diverted: {resolution: LAW}}}),
  amount, cardResource: 'data', for: {role: 'card', source: SOURCE},
});

const branch = (over: Partial<ActionPreviewBranch>): ActionPreviewBranch =>
  ({index: -1, title: '', available: true, renderKeys: [], effects: [], steps: [], ...over});

describe('divertedTerraforming — the client readings of a replaced unit (RX35)', () => {
  describe('the chip reading', () => {
    it('a struck chip is never «no effect» nor «at maximum» — even at the ceiling', () => {
      const chip = {...struck('oxygen', 1), current: 14, resulting: 14};
      expect(divertedChip(chip)).to.eq(true);
      expect(gainHasNoEffect(chip)).to.eq(false);
      expect(gainAtParameterLimit(chip)).to.eq(false);
      expect(gainAtParameterLimit({...chip, diverted: undefined}), 'the same chip unstruck reads the limit').to.eq(true);
    });

    it('the chip component: the struck face, the data tail, the loss', () => {
      const w = mount(ActionEffectChip, {...globalConfig, props: {effect: struck('temperature', 2)}});
      expect(w.find('.action-effect-chip--diverted').exists(), 'the struck face').to.eq(true);
      expect(w.find('.action-effect-chip--noeffect').exists(), 'never muted').to.eq(false);
      expect(w.find('[data-chip-diverted]').text().replace(/\s/g, '')).to.contain('+2');
      expect(w.find('.action-effect-chip__diverted-icon').classes()).to.include('card-resource-data');
      expect(w.find('[data-chip-diverted]').attributes('data-hint')).to.be.a('string').and.not.empty;
      expect(w.find('.action-effect-chip__diverted-lost').exists()).to.eq(false);
      w.unmount();
      const lost = mount(ActionEffectChip, {...globalConfig, props: {effect: struck('oceans', 1, true)}});
      expect(lost.find('.action-effect-chip--diverted-lost').exists(), 'the loss').to.eq(true);
      expect(lost.find('.action-effect-chip__diverted-lost').exists()).to.eq(true);
      lost.unmount();
    });
  });

  describe('the commit', () => {
    it('a struck scale never owns the HUD scale; with the «where» answered the category is the data\'s landing', () => {
      const b = branch({effects: [{direction: 'cost', icon: 'heat', amount: 8}, struck('temperature', 1)], steps: [whereStep()]});
      expect(commitKindForBranch(b, {0: {type: 'card', cards: [CardName.SUPERCOMPUTER]}})).to.eq('resources');
      expect(commitKindForBranch(b, {}), 'no answer yet — never global').to.not.eq('global');
    });

    it('the «where» spec lands on the picked card and is BORN on the struck printed icon', () => {
      const specs = commitRewardSpecs(CardName.ASTEROID, branch({effects: [struck('temperature', 1)], steps: [whereStep()]}),
        {0: {type: 'card', cards: [CardName.SUPERCOMPUTER]}});
      expect(specs).to.deep.eq([{channel: 'card-resource', resource: 'data', amount: 1, targetCard: CardName.SUPERCOMPUTER, bornOn: 'temperature'}]);
      const plain = extractPlayRewards({cardName: CardName.PETS, effects: [], steps: [{kind: 'input', input: whereInput({resourceGainPrompt: {amount: 1, cardResource: 'data'}}), amount: 1, cardResource: 'data'}],
        stepResponses: {0: {type: 'card', cards: [CardName.SUPERCOMPUTER]}}});
      expect(plain[0].bornOn, 'an ordinary pick is born on its own icon').to.be.undefined;
    });
  });

  describe('the wheel', () => {
    it('the plant conversion is found as an OPTION by its structural card (never its title) — and the board pick as before', () => {
      const menu = {type: 'or', title: 'menu', options: [
        {type: 'option', title: 'Потратить растения', metadata: {kind: 'globalParameter', icon: 'greenery', card: CardName.CONVERT_PLANTS, steps: [whereStep()]}},
      ]} as unknown as PlayerInputModel;
      const found = findConvertPlantsOption(menu, true);
      expect(found?.path).to.deep.eq([0]);
      expect(found?.option?.metadata?.card).to.eq(CardName.CONVERT_PLANTS);
      expect(found?.spacePrompt).to.be.undefined;
      const untitled = {type: 'or', title: 'menu', options: [{type: 'option', title: 'Convert 8 plants into greenery'}]} as unknown as PlayerInputModel;
      expect(findConvertPlantsOption(untitled, true), 'a title alone is no conversion').to.be.undefined;
    });
  });

  describe('the finale', () => {
    const viewer = {plants: 16, plantsNeededForGreenery: 8};
    it('under the law the placing branch is the first LEAF, the stop the second; the yield reads data', () => {
      const prompt = {type: 'or', title: 'x', buttonLabel: 'Confirm', options: [
        {type: 'option', title: 'Convert 8 plants into greenery', buttonLabel: 'Convert plants'},
        {type: 'option', title: 'Don\'t place a greenery', buttonLabel: 'Confirm'},
      ], finalGreeneryPrompt: {spaces: 3, diverted: {resolution: LAW, data: 1}}} as unknown as PlayerInputModel;
      const vm = buildFinalGreenery(prompt, viewer)!;
      expect(vm.placeIndex).to.eq(0);
      expect(vm.stopIndex).to.eq(1);
      expect(vm.diverted).to.deep.eq({resolution: LAW, data: 1});
      expect(finaleYieldKey(true, true)).to.eq(YIELD_DATA);
      expect(finaleYieldKey(true)).to.eq(YIELD_TR);
    });
  });

  describe('the live «where» is the seat\'s own, never a sitting\'s ask', () => {
    it('the family is the plate; it is no resolution ask; it is no sitting step', () => {
      const wf = whereInput();
      expect(isDivertedPick(wf)).to.eq(true);
      expect(promptReceiveFamily(wf)).to.eq('plate');
      expect(isResolutionAsk(wf)).to.eq(false);
      expect(followUpStepStage('cardSelect', wf)).to.be.undefined;
      const payout = whereInput({resourceGainPrompt: {amount: 1, cardResource: 'data'}});
      expect(isDivertedPick(payout)).to.eq(false);
      expect(promptReceiveFamily(payout), 'the enactment\'s payout keeps its own gate').to.be.undefined;
      expect(isResolutionAsk(payout)).to.eq(true);
      expect(followUpStepStage('cardSelect', payout)).to.eq('Choice');
    });
  });
});
