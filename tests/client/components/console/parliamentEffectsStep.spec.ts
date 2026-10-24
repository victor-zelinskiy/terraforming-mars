import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsoleParliamentEffectsStep from '@/client/components/console/parliament/ConsoleParliamentEffectsStep.vue';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, PartyAccessModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {politicalSources} from '@/client/console/parliament/politicalSources';
import {politicalEffectEntries} from '@/client/console/parliament/politicalEffects';
import {parliamentActionSources} from '@/client/console/parliament/parliamentActionSources';
import {buildConsoleActionsModel} from '@/client/console/consoleCardActions';
import {createEffectsExplorerUi} from '@/client/console/consoleEffectsExplorer';
import {EffectsHostZone} from '@/client/console/parliament/parliamentEffectsHost';

/*
 * «ПАРЛАМЕНТ › ВАШИ ЭФФЕКТЫ» IS A HOST (ONE FRAMEWORK С6, decision Р4): the seat's Parliament ACTIONS are the «Действия
 * карт» group tiles (read-only), its STANDING EFFECTS are the effects explorer's political groups. No tile language of
 * its own, one cursor on screen.
 */
const BLUE = 'blue';

function access(party: ReduxParty, over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

/** The Reds rule (an action, no passive); the Scientists by two delegates (a passive AND an action). */
function model(): ParliamentModel {
  return {
    players: [{
      color: BLUE, participates: true, partyActionUses: {}, resolutionActionUses: 0, influence: 0,
      access: REDUX_PARTIES.map((p) => access(p, p === PartyName.REDS ? {hasEffect: true, ruling: true} :
        p === PartyName.SCIENTISTS ? {hasEffect: true, byDelegates: true, delegates: 2} : {})),
    }],
    slots: [],
  } as unknown as ParliamentModel;
}

function mountStep(zone: EffectsHostZone) {
  const parliament = model();
  const sources = parliamentActionSources({parliament, color: BLUE, viewerColor: BLUE, waitingFor: undefined});
  const groups = buildConsoleActionsModel([], new Map(), new Map(), {availability: 'all', activation: 'all'}, undefined, 2, sources).groups;
  return mount(ConsoleParliamentEffectsStep, {
    global: globalConfig.global,
    props: {
      groups,
      entries: politicalEffectEntries(politicalSources(parliament, BLUE), {parliament, viewerColor: BLUE}),
      color: BLUE,
      zone,
      actionCursor: 0,
      explorerUi: createEffectsExplorerUi(),
    },
  });
}

describe('ConsoleParliamentEffectsStep — the host of the two shared surfaces', () => {
  it('the actions are the «Действия карт» group tiles (one per source), the standing effects the explorer\'s groups', () => {
    const w = mountStep('actions');
    const tiles = w.findAll('[data-parl-effects-actions] [data-parl-fx-entry]');
    expect(tiles.map((t) => t.attributes('data-party'))).deep.eq([PartyName.REDS, PartyName.SCIENTISTS]);
    expect(tiles.every((t) => t.find('.con-cardactions__group').exists()), 'the acting workspace\'s own group view').is.true;
    const plates = w.findAll('[data-parl-effects-standing] .con-efx__plate--political');
    expect(plates.map((p) => p.attributes('data-efx-source')), 'the Reds print no passive').deep.eq(['party:Scientists']);
    expect(w.find('.con-parl-fx').exists(), 'no tile language of the step\'s own').is.false;
  });

  it('ONE cursor: the actions zone marks its tile and gates the explorer\'s; the effects zone marks no action tile', () => {
    const a = mountStep('actions');
    expect(a.findAll('.con-parl-fxhost__tile--focused')).length(1);
    expect(a.find('[data-parl-effects-step]').classes()).include('con-parl-fxhost--zone-actions');
    const e = mountStep('effects');
    expect(e.findAll('.con-parl-fxhost__tile--focused')).length(0);
    expect(e.find('[data-parl-effects-step]').attributes('data-parl-effects-zone')).eq('effects');
  });
});
