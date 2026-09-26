import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsolePartyActionComposer from '@/client/components/console/parliament/ConsolePartyActionComposer.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, SelectOptionModel, SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {PartyName} from '@/common/turmoil/PartyName';
import {actionBillPrice} from '@/common/parliament/actionBill';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {consoleCardActionsUi} from '@/client/console/consoleCardActions';

/**
 * THE LAW WHOSE DECISION IS A CONFIRM WITH A PRICE (Turmoil Redux — Trade
 * Industries: «pay 12 M€ to gain an extra trade fleet; titanium accepted,
 * 2 M€ off per influence»).
 *
 * These specs pin the three stages of the flow as the composer shows them:
 * the PRICE stage (the server's own chips for this seat, the arithmetic line
 * from the ONE function the server charges by — the two agree by
 * construction; A commits the bare option inside its menu branch and names
 * the fleet in its detail); the BILL stage (the payment the confirm deferred,
 * found by its marker at stage `pay`, hosted in the composer's own zone —
 * the bar handed to the host, the stage never folding on «the menu entry is
 * gone»); and the closing beat (the fleet that arrived, what was paid).
 */
const LAW = 'RDX_UNITY_TRADE_INDUSTRIES';
const MARKER = {resolution: LAW, party: PartyName.UNITY, stage: 'choose', usesLeft: 1, usesPerGeneration: 1} as const;

/** The composer's own `PartyActionResult` (the .vue's named export is not visible to the test tree's `*.vue` shim). */
type PartyActionResult = {discarded: number, payout: number, tags: number, fleet?: {from: number, to: number, paid: {megacredits: number, titanium: number}}};

/** The server's own chips for a seat at influence 2 with 20 M€ and one fleet (what `preview(player)` computes). */
const PREVIEW: ReadonlyArray<ActionEffect> = [
  {direction: 'cost', icon: 'megacredits', amount: 8, current: 20, resulting: 12, note: 'titanium accepted', basis: [{count: 2, label: 'Influence'}, {count: 4, label: 'Discount'}]},
  {direction: 'gain', icon: 'trade-fleet', amount: 1, current: 1, resulting: 2},
];

function confirmPrompt(): SelectOptionModel {
  return {
    title: 'Pay 8 M€ for an extra trade fleet (Trade Industries)',
    buttonLabel: 'Buy fleet',
    type: 'option',
    metadata: {kind: 'generic', icon: 'megacredits', amount: 8, effects: PREVIEW},
    resolutionActionPrompt: MARKER,
  } as unknown as SelectOptionModel;
}

function bill(): SelectPaymentModel {
  return {
    title: 'Select how to pay 8 M€ for the trade fleet',
    buttonLabel: 'Pay',
    type: 'payment',
    amount: 8,
    paymentOptions: {titanium: true, heat: false},
    seeds: 0, auroraiData: 0, kuiperAsteroids: 0, spireScience: 0, reserveUnits: undefined,
    floaters: 0, microbes: 0, graphene: 0, floodgateSteel: 0,
    resolutionActionPrompt: {...MARKER, stage: 'pay'},
  } as unknown as SelectPaymentModel;
}

function menu(option: PlayerInputModel): PlayerInputModel {
  return {type: 'or', title: 'Take an action', buttonLabel: 'Take action', options: [{type: 'option', title: 'pass', buttonLabel: ''}, option]} as unknown as PlayerInputModel;
}

function playerView(wf: PlayerInputModel | undefined, over: {influence?: number, available?: boolean} = {}): PlayerViewModel {
  return {
    id: 'p1',
    waitingFor: wf,
    game: {gameAge: 1, parliament: {
      players: [{color: 'red', participates: true, influence: over.influence ?? 2}],
      viewer: {resolutionAction: {
        resolution: LAW, party: PartyName.UNITY, hasAccess: true,
        usesLeft: 1, usesPerGeneration: 1, available: over.available ?? true, reason: '', preview: PREVIEW,
      }},
    }},
    thisPlayer: {color: 'red', megacredits: 20, titanium: 2, fleetSize: 1},
    players: [],
  } as unknown as PlayerViewModel;
}

function mountLaw(view: PlayerViewModel, result?: PartyActionResult) {
  return mount(ConsolePartyActionComposer, {
    global: {
      ...globalConfig.global,
      stubs: {'premium-card-face': true},
      directives: {...globalConfig.global.directives, 'strip-action-prefix': {}},
    },
    props: {playerView: view, party: PartyName.UNITY, resolution: LAW, result},
  });
}

describe('ConsolePartyActionComposer — a law whose decision is a CONFIRM WITH A PRICE', () => {
  afterEach(() => {
    resetWorkspaceStack();
    consoleCardActionsUi.partyFlow = undefined;
    consoleCardActionsUi.billZone = '';
  });

  it('the manifest carries the bill as data, and the ONE price function reads it the way the server does', () => {
    const declared = getResolution(LAW)?.actionBill;
    expect(declared, 'the manifest declares the bill').to.deep.eq({amount: 12, discountPerInfluence: 2, titanium: true});
    expect(actionBillPrice(declared!, 2)).to.deep.eq({printed: 12, influence: 2, discount: 4, price: 8});
    expect(actionBillPrice(declared!, 6).price, 'influence 6 buys the fleet for nothing').to.eq(0);
  });

  it('the PRICE stage: no pick, no hand — the server\'s chips for this seat and the arithmetic line, which agrees with the chip', () => {
    const w = mountLaw(playerView(menu(confirmPrompt())));
    expect(w.find('[data-pact-price]').exists(), 'the price row stands').to.be.true;
    expect(w.find('[data-pact-repeat-slot]').exists(), 'no repeat slot').to.be.false;
    expect(w.find('.con-pact__handzone').exists(), 'no hand step').to.be.false;
    expect(w.find('.con-pact__hero--bill').exists(), 'the law\'s face is the hero').to.be.true;
    const chips = w.findAll('[data-pact-price] .action-effect-chip');
    expect(chips, 'the two server chips: the price, the fleet').to.have.length(2);
    expect(chips[0].text()).to.contain('20');
    expect(chips[0].text()).to.contain('12');
    const line = w.find('[data-pact-price-line]').text();
    expect(line, `the line states the price and its arithmetic (${line})`).to.contain('8');
    expect(line).to.contain('12');
    expect(line).to.contain('4');
    expect(line).to.contain('2');
    // The chip's amount and the line's arithmetic come from the same declaration.
    expect(actionBillPrice(getResolution(LAW)!.actionBill!, 2).price).to.eq(PREVIEW[0].amount);
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready'), 'a confirm is complete by standing').to.eq('');
    expect(w.find('[data-pact-cta] .con-pact__cta-label').text(), 'the server\'s own verb').to.eq('Buy fleet');
  });

  it('at influence 6 the line reads FREE', () => {
    const w = mountLaw(playerView(menu(confirmPrompt()), {influence: 6}));
    const line = w.find('[data-pact-price-line]').text();
    expect(line.toLowerCase(), line).to.match(/бесплатно|free/);
  });

  it('A commits the bare option INSIDE its menu branch and names the fleet in its detail — nothing else is sent', async () => {
    const w = mountLaw(playerView(menu(confirmPrompt())));
    await w.find('[data-pact-cta]').trigger('click');
    const emitted = w.emitted('confirm');
    expect(emitted, 'one confirm').to.have.length(1);
    expect(emitted![0][0]).to.deep.eq({type: 'or', index: 1, response: {type: 'option'}});
    expect(emitted![0][1]).to.deep.eq({expectedCards: 0, fleet: true});
  });

  it('the BILL stage: the payment standing for THIS law puts the zone up, hands the bar to the host, and never folds the stage', async () => {
    const w = mountLaw(playerView(menu(confirmPrompt())));
    // The answer landed: the menu entry is gone and the bill stands in its place.
    await w.setProps({playerView: playerView(bill())});
    expect(w.find('[data-pact-bill]').exists(), 'the bill stage').to.be.true;
    expect(w.find('[data-embed-slot="action-bill"]').exists(), 'the zone the payment host teleports into').to.be.true;
    expect(w.findAll('[data-pact-bill] .action-effect-chip'), 'the price recap above it').to.have.length(2);
    expect(w.find('[data-pact-price]').exists(), 'the price stage folded into the bill').to.be.false;
    expect(w.emitted('cancel'), 'a standing bill is not «the prompt moved on»').to.be.undefined;
    const commands = w.emitted('commands');
    expect(commands![commands!.length - 1][0], 'the host owns the bar').to.deep.eq([]);
    expect(w.find('.con-pact--resolution').attributes('data-pact-phase')).to.eq('pay');
    // The zone is PUBLISHED by this owner (post-flush) for the shell's payment host to teleport into…
    await w.vm.$nextTick();
    expect(consoleCardActionsUi.billZone, 'the zone is published').to.eq('.con-pact--resolution [data-embed-slot="action-bill"]');
    expect(w.find(consoleCardActionsUi.billZone.replace('.con-pact--resolution ', '')).exists(), 'and it names a node that exists').to.be.true;
    // …and retracted the moment the bill leaves.
    await w.setProps({playerView: playerView(undefined)});
    await w.vm.$nextTick();
    expect(consoleCardActionsUi.billZone, 'retracted').to.eq('');
  });

  it('the bill LEAVING with the flow past its commit folds nothing — the ending is the host\'s (the fleet beat, the conclusion)', async () => {
    const w = mountLaw(playerView(menu(confirmPrompt())));
    consoleCardActionsUi.partyFlow = {party: PartyName.UNITY, resolution: LAW, stage: 'committed', fleetBefore: 1, mcBefore: 20};
    await w.setProps({playerView: playerView(bill())});
    // The bill is settled: the menu no longer lists the spent action, and the fleet is in the model.
    await w.setProps({playerView: {...playerView(undefined), thisPlayer: {color: 'red', megacredits: 15, titanium: 1, fleetSize: 2}} as never});
    expect(w.emitted('cancel'), 'no cancel past the commit').to.be.undefined;
    // A flow of ANOTHER law does not protect this stage.
    consoleCardActionsUi.partyFlow = {party: PartyName.SCIENTISTS, resolution: 'RDX_SCIENTISTS_OPEN_IP_TRADE', stage: 'committed'};
    const other = mountLaw(playerView(menu(confirmPrompt())));
    await other.setProps({playerView: playerView(undefined)});
    expect(other.emitted('cancel'), 'the entry gone before any commit of ours → the stage folds').to.have.length(1);
  });

  it('a bill of ANOTHER law is not this stage\'s: the entry gone and no bill of ours → the stage folds', async () => {
    const w = mountLaw(playerView(menu(confirmPrompt())));
    const foreign = {...bill(), resolutionActionPrompt: {...MARKER, resolution: 'RDX_SCIENTISTS_OPEN_IP_TRADE', stage: 'pay'}} as unknown as SelectPaymentModel;
    await w.setProps({playerView: playerView(foreign)});
    expect(w.find('[data-pact-bill]').exists()).to.be.false;
    expect(w.emitted('cancel'), 'the prompt moved on').to.have.length(1);
  });

  it('the CLOSING BEAT reads the fleet that arrived and what was paid — M€ and titanium as cost chips, nothing at all as «free»', () => {
    const paid = mountLaw(playerView(undefined), {discarded: 0, payout: 0, tags: 0, fleet: {from: 1, to: 2, paid: {megacredits: 2, titanium: 2}}});
    expect(paid.find('[data-pact-result-fleet]').exists()).to.be.true;
    expect(paid.find('[data-pact-fleet-from]').text()).to.eq('1');
    expect(paid.find('[data-pact-fleet-to]').text()).to.eq('2');
    expect(paid.find('[data-pact-result-fleet] .colony-fleet-icon').exists(), 'the ship in the viewer\'s livery').to.be.true;
    expect(paid.findAll('.con-pact__result-row--pay .action-effect-chip'), 'M€ and titanium').to.have.length(2);
    expect(paid.find('[data-pact-result] .resource_icon--cards').exists(), 'never the Reds\' rows').to.be.false;
    const free = mountLaw(playerView(undefined), {discarded: 0, payout: 0, tags: 0, fleet: {from: 1, to: 2, paid: {megacredits: 0, titanium: 0}}});
    expect(free.findAll('.con-pact__result-row--pay .action-effect-chip')).to.have.length(0);
    expect(free.find('.con-pact__result-row--pay .con-pact__result-note').text().toLowerCase()).to.match(/бесплатно|free/);
  });
});
