import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsoleParliamentEffects from '@/client/components/console/parliament/ConsoleParliamentEffects.vue';
import {effectsTileSize, EffectItem} from '@/client/console/parliament/parliamentEffectsModel';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {PartyAccessModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {allResolutions, getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {emptyParliamentView, ParliamentPartyVm, ParliamentViewVm, PartyActionStateVm} from '@/client/console/parliament/consoleParliamentModel';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';

/*
 * «ВАШИ ЭФФЕКТЫ» (Парламент v8 «Пленарный зал», docs/TURMOIL_REDUX_PARLIAMENT_V8_PLAN.md § 6): under BOTH the benches
 * and the dais, ONE tile per source the viewer holds — the ruling party (everyone's), a party by the viewer's
 * delegates or a card's grant, the enacted law's STANDING part — and the tiles SCALE with their count while the
 * panel keeps one box. The owner's point 11: only what lasts (a passive, an action) — never the law's one-time
 * payout rows.
 */

const VIEWER: Color = 'red';

function access(party: ReduxParty, over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

function partyVm(party: ReduxParty, ruling: boolean): ParliamentPartyVm {
  return {party, effect: getPartyEffect(party), rule: 'r', support: 0, inArea: false, ruling, access: undefined, actionId: undefined, action: undefined, bannerCubes: []};
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

function states(ready: ReadonlyArray<ReduxParty> = []): Array<PartyActionStateVm> {
  return REDUX_PARTIES.map((p) => (ready.includes(p) ? {kind: 'available'} : {kind: 'none'}) as PartyActionStateVm);
}

function make(v: ParliamentViewVm, actionStates: ReadonlyArray<PartyActionStateVm> = states()) {
  return mount(ConsoleParliamentEffects, {...globalConfig, props: {view: v, viewerColor: VIEWER, partyActionStates: actionStates}});
}

describe('ConsoleParliamentEffects — «ВАШИ ЭФФЕКТЫ» across the chamber (Парламент v8)', () => {
  it('the tiles scale with their count: 1–2 large · 3 in a row · 4 as 2×2 · 5–6 compact', () => {
    expect([1, 2, 3, 4, 5, 6].map(effectsTileSize)).to.deep.eq(['l', 'l', 'm', 'q', 's', 's']);
  });

  it('the ruling party leads (everyone\'s, the crown), then a party the viewer holds by delegates (two places)', () => {
    const w = make(view(PartyName.MARS, [access(PartyName.SCIENTISTS, {delegates: 2, byDelegates: true, hasEffect: true})]));
    const rows = w.findAll('.con-parl__effects-row');
    expect(rows.map((r) => r.attributes('data-party'))).to.deep.eq([PartyName.MARS, PartyName.SCIENTISTS]);
    expect(rows.map((r) => r.find('[data-parl-effects-why]').attributes('data-parl-effects-why'))).to.deep.eq(['ruling', 'delegates']);
    expect(w.find('[data-parl-effects]').classes()).to.include('con-parl__effects--l');
    expect(w.find('[data-parl-effects]').attributes('data-parl-effects-count')).to.eq('2');
  });

  it('a party the viewer does not hold is never a tile; the ruler is never listed twice', () => {
    const w = make(view(PartyName.MARS, [
      access(PartyName.GREENS, {delegates: 1}),
      access(PartyName.MARS, {ruling: true, hasEffect: true}),
    ]));
    expect(w.findAll('.con-parl__effects-row').map((r) => r.attributes('data-party'))).to.deep.eq([PartyName.MARS]);
  });

  it('a held party\'s action reads its state on the tile and in the head\'s count', () => {
    const acting = REDUX_PARTIES.find((p) => p !== PartyName.MARS && getPartyEffect(p)?.actionRenderData !== undefined);
    expect(acting, 'a party with an action exists in the catalogue (anti-vacuous)').to.not.be.undefined;
    if (acting === undefined) {
      return;
    }
    const w = make(view(PartyName.MARS, [access(acting, {delegates: 2, byDelegates: true, hasEffect: true})]), states([acting]));
    expect(w.find(`.con-parl__effects-row[data-party="${acting}"] [data-parl-effects-action]`).attributes('data-parl-effects-action')).to.eq('ready');
    expect(w.find('[data-parl-effects-ready]').text()).to.contain('1');
  });

  it('the enacted law shows its STANDING part only — never the enactment\'s one-time rows', () => {
    const law = allResolutions().find((r) => r.hasPassive && r.hasImmediate) ?? allResolutions().find((r) => r.hasPassive);
    expect(law, 'a resolution with a standing effect exists in the catalogue').to.not.be.undefined;
    if (law === undefined) {
      return;
    }
    const w = make(view(law.party, [], {instance: 'r1' as never, resolutionId: law.id, resolution: law, party: law.party}));
    const items = (w.vm as unknown as {items: Array<EffectItem>}).items;
    const lawItem = items.find((i) => i.kind === 'law');
    expect(lawItem, 'the law has its tile').to.not.be.undefined;
    expect(lawItem?.lawMechanics?.groups.length).to.be.greaterThan(0);
    expect(lawItem?.lawMechanics?.groups.every((g: {kind: string}) => g.kind === 'effect' || g.kind === 'action'), 'only the passive / action groups').to.eq(true);
    expect(w.find('[data-parl-enacted-effect]').exists()).to.eq(true);
  });

  it('during the sitting the strip reads the government AS SHOWN — the live ruler not yet seated is no tile of the viewer\'s', () => {
    // The response carries Mars First ruling; the walk still shows the Greens on the dais (the swap's hold).
    const live = view(PartyName.MARS, [
      access(PartyName.MARS, {ruling: true, hasEffect: true}),
      access(PartyName.SCIENTISTS, {ruling: false, delegates: 2, byDelegates: true, hasEffect: true}),
    ]);
    parliamentHolds.rulerBefore = PartyName.GREENS;
    try {
      const rows = make(live).findAll('.con-parl__effects-row');
      expect(rows.map((r) => r.attributes('data-party'))).to.deep.eq([PartyName.GREENS, PartyName.SCIENTISTS]);
      expect(rows.map((r) => r.find('[data-parl-effects-why]').attributes('data-parl-effects-why'))).to.deep.eq(['ruling', 'delegates']);
    } finally {
      parliamentHolds.rulerBefore = undefined;
    }
  });

  it('a spectator holds nothing — the block is not drawn', () => {
    const v = {...view(PartyName.MARS, []), viewer: undefined};
    expect(make(v).find('[data-parl-effects]').exists()).to.eq(false);
  });
});
