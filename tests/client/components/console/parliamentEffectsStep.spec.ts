import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {PartyAccessModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {allResolutions, getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {emptyParliamentView, ParliamentPartyVm, ParliamentViewVm, PartyActionStateVm} from '@/client/console/parliament/consoleParliamentModel';
import {effectsStepCursorMove, EffectsStepModel, parliamentEffectsStep} from '@/client/console/parliament/parliamentEffectsStepModel';

/*
 * THE INNER STEP «ВАШИ ЭФФЕКТЫ» (Парламент v8 § 6): the overview block's sources, split into ДЕЙСТВИЯ and ПОСТОЯННЫЕ
 * ЭФФЕКТЫ, each with WHY it is the viewer's — read off the same `parliamentEffectItems` as the block (one rule of
 * «what is yours»), the law's one-time rows never listed.
 */

const VIEWER: Color = 'red';

function access(party: ReduxParty, over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

function partyVm(party: ReduxParty, ruling: boolean): ParliamentPartyVm {
  return {party, effect: getPartyEffect(party), rule: 'r', support: 0, inArea: false, ruling, access: undefined, actionId: undefined, action: undefined};
}

function view(ruler: ReduxParty, held: ReadonlyArray<PartyAccessModel>, enacted?: ParliamentViewVm['enacted']): ParliamentViewVm {
  return {
    ...emptyParliamentView(),
    rulingParty: ruler,
    enacted,
    parties: REDUX_PARTIES.map((p) => partyVm(p, p === ruler)),
    viewer: {
      color: VIEWER, name: 'me', participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0,
      access: held, partyActionUses: {}, resolutionActionUses: 0,
    },
  };
}

function states(kinds: Partial<Record<ReduxParty, PartyActionStateVm['kind']>>): Array<PartyActionStateVm> {
  return REDUX_PARTIES.map((p) => ({kind: kinds[p] ?? 'none'}) as PartyActionStateVm);
}

describe('parliamentEffectsStep — «ВАШИ ЭФФЕКТЫ», the inner step (Парламент v8)', () => {
  it('splits every held source into its ACTION and its STANDING effect, with the action\'s state', () => {
    const acting = REDUX_PARTIES.find((p) => p !== PartyName.MARS && getPartyEffect(p)?.actionRenderData !== undefined);
    expect(acting, 'a party with an action exists (anti-vacuous)').to.not.be.undefined;
    if (acting === undefined) {
      return;
    }
    const model = parliamentEffectsStep({
      view: view(PartyName.MARS, [access(acting, {delegates: 2, byDelegates: true, hasEffect: true})]),
      ruler: PartyName.MARS, enacted: undefined,
      partyActionStates: states({[acting]: 'used'}), resolutionActionState: undefined,
    });
    expect(model.actions.map((a) => [a.party, a.state])).to.deep.include([acting, 'used']);
    expect(model.standing[0]?.party, 'the ruling party leads the standing effects').to.eq(PartyName.MARS);
    expect(model.standing[0]?.whyReading.key).to.eq('rules · everyone\'s');
    const held = [...model.actions, ...model.standing].find((e) => e.party === acting);
    expect(held?.whyReading.key, 'held by delegates').to.match(/your delegates/);
  });

  it('a card\'s grant names the card', () => {
    const model = parliamentEffectsStep({
      view: view(PartyName.MARS, [access(PartyName.SCIENTISTS, {granted: ['Political Recognition'], hasEffect: true})]),
      ruler: PartyName.MARS, enacted: undefined, partyActionStates: states({}), resolutionActionState: undefined,
    });
    const granted = [...model.actions, ...model.standing].find((e) => e.party === PartyName.SCIENTISTS);
    expect(granted?.whyReading).to.deep.eq({key: 'by the card «${0}»', params: ['Political Recognition']});
  });

  it('the enacted law lists its PASSIVE part only (never the enactment\'s one-time rows)', () => {
    const law = allResolutions().find((r) => r.hasPassive && r.hasImmediate) ?? allResolutions().find((r) => r.hasPassive);
    expect(law, 'a resolution with a standing effect exists (anti-vacuous)').to.not.be.undefined;
    if (law === undefined) {
      return;
    }
    const model = parliamentEffectsStep({
      view: view(law.party, [], {instance: 'r1' as never, resolutionId: law.id, resolution: law, party: law.party}),
      ruler: law.party, enacted: {instance: 'r1' as never, resolutionId: law.id, resolution: law, party: law.party},
      partyActionStates: states({}), resolutionActionState: undefined,
    });
    const entry = model.standing.find((e) => e.kind === 'law');
    expect(entry, 'the law\'s standing effect is listed').to.not.be.undefined;
    expect(entry?.mechanics?.groups.every((g: {kind: string}) => g.kind === 'effect')).to.eq(true);
    expect(entry?.whyReading).to.deep.eq({key: 'the enacted law · «${0}»', params: [law.text.name]});
  });

  it('THE LAW\'S COUNT is the seat\'s live verdict (RX37 — 3 at influence 2+) with the uses left beside it; a law taken once reads 1 — never a constant', () => {
    const multi = allResolutions().find((r) => r.hasAction && r.actionUses !== undefined);
    const once = allResolutions().find((r) => r.hasAction && r.actionUses === undefined && r.hasPassive === false);
    expect(multi, 'a law taken more than once a generation exists (anti-vacuous)').to.not.be.undefined;
    expect(once, 'and a law taken once').to.not.be.undefined;
    if (multi === undefined || once === undefined) {
      return;
    }
    const step = (law: typeof multi, state: PartyActionStateVm) => {
      const enacted = {instance: 'r1' as never, resolutionId: law.id, resolution: law, party: law.party};
      return parliamentEffectsStep({
        view: view(law.party, [], enacted), ruler: law.party, enacted, partyActionStates: states({}), resolutionActionState: state,
      }).actions.find((a) => a.kind === 'law');
    };
    const live = step(multi, {kind: 'available', label: 'Available', reason: undefined, usesLeft: 1, usesPerGeneration: 3});
    expect(live?.usesPerGeneration).to.eq(3);
    expect(live?.usesLeft, 'what is still left rides beside the count').to.eq(1);
    expect(live?.state).to.eq('ready');
    const spent = step(multi, {kind: 'used', label: 'Already used', reason: undefined, usesLeft: 0, usesPerGeneration: 2});
    expect([spent?.usesPerGeneration, spent?.state]).to.deep.eq([2, 'used']);
    const single = step(once, {kind: 'available', label: 'Available', reason: undefined, usesLeft: 1, usesPerGeneration: 1});
    expect(single?.usesPerGeneration).to.eq(1);
    expect(single?.usesLeft, 'a once-a-generation law carries no «left»').to.be.undefined;
  });

  it('a spectator holds nothing', () => {
    const v = {...view(PartyName.MARS, []), viewer: undefined};
    const model = parliamentEffectsStep({view: v, ruler: PartyName.MARS, enacted: undefined, partyActionStates: states({}), resolutionActionState: undefined});
    expect(model).to.deep.eq({actions: [], standing: []});
  });

  it('the cursor walks the actions column and the standing grid, and never leaves the step', () => {
    const entry = (key: string) => ({key, kind: 'party' as const, party: PartyName.MARS as ReduxParty, why: 'ruling' as const, whyReading: {key: '', params: []}, name: '', rule: ''});
    const model: EffectsStepModel = {
      actions: [{...entry('a1'), state: 'ready', usesPerGeneration: 1}, {...entry('a2'), state: 'used', usesPerGeneration: 1}],
      standing: [entry('s1'), entry('s2'), entry('s3')],
    };
    expect(effectsStepCursorMove(model, 'a1', 'down', 2)).to.eq('a2');
    expect(effectsStepCursorMove(model, 'a2', 'down', 2), 'the column clamps').to.eq('a2');
    expect(effectsStepCursorMove(model, 'a1', 'up', 2), 'never up out of the step').to.eq('a1');
    expect(effectsStepCursorMove(model, 'a2', 'right', 2), 'to the grid row level with the cursor').to.eq('s3');
    expect(effectsStepCursorMove(model, 's1', 'right', 2)).to.eq('s2');
    expect(effectsStepCursorMove(model, 's2', 'right', 2), 'the grid clamps').to.eq('s2');
    expect(effectsStepCursorMove(model, 's1', 'down', 2)).to.eq('s3');
    expect(effectsStepCursorMove(model, 's3', 'left', 2), 'from the first column of the grid back to the actions').to.eq('a2');
    expect(effectsStepCursorMove(model, 's2', 'left', 2)).to.eq('s1');
    expect(effectsStepCursorMove(model, 's1', 'down', 1), 'one column on the Deck').to.eq('s2');
  });
});
