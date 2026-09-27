import {expect} from 'chai';
import {mount, VueWrapper} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import ConsoleColonyInspect from '@/client/components/console/ConsoleColonyInspect.vue';

const RED: Color = 'red';
const BLUE: Color = 'blue';

const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};

function luna(over: Partial<ColonyModel> = {}): ColonyModel {
  return {name: ColonyName.LUNA, isActive: true, trackPosition: 2, visitor: undefined, colonies: [RED, RED, BLUE], ...over};
}

function players(): Array<PublicPlayerModel> {
  return [
    {color: RED, name: 'Ada', tableau: []} as unknown as PublicPlayerModel,
    {color: BLUE, name: 'Bo', tableau: []} as unknown as PublicPlayerModel,
  ];
}

function mountDossier(props: Record<string, unknown> = {}): VueWrapper<any> {
  return mount(ConsoleColonyInspect, {
    global: {
      ...globalConfig.global,
      stubs: {GamepadGlyph: true, BarButtonIcon: true},
    },
    props: {
      colony: luna(),
      players: players(),
      viewerColor: RED,
      embedded: true,
      ...props,
    },
  });
}

/*
 * THE COLONY DOSSIER — one composition, two hosts. What this spec owns: the
 * three zones stand (the archive entry from the colony's OWN metadata, the
 * shared trade-track instrument with its anchors, the rules groups), the
 * host-agnostic shell strip, and the two verbs (B leaves; A enters the act
 * only when the server offers it). The geometry is the e2e probe's.
 */
describe('ConsoleColonyInspect', () => {
  let originalTranslations: unknown;

  beforeEach(() => {
    originalTranslations = (window as any)._translations;
    (window as any)._translations = {};
  });

  afterEach(() => {
    (window as any)._translations = originalTranslations;
  });

  it('the LORE zone shows the colony\'s own archive entry in the shared block', () => {
    const w = mountDossier();
    const lore = w.find('.con-colinspect__lore .card-zoom-lore');
    expect(lore.exists(), 'the shared archive block').to.eq(true);
    expect(w.find('.card-zoom-lore__text').text()).to.eq(getColony(ColonyName.LUNA).lore);
    expect(w.find('.card-zoom-lore--fallback').exists(), 'Luna has real lore — never the fallback').to.eq(false);
  });

  it('the CENTRE is the planet disc + the SAME trade-track instrument the stage resolves on', () => {
    const w = mountDossier();
    const planet = w.find('[data-colony-focus-planet]');
    expect(planet.exists()).to.eq(true);
    expect(planet.classes()).to.include('con-planet');
    expect(planet.classes()).to.include('Luna-background');
    expect(w.find('[data-fleet-berth="Luna"]').exists(), 'the orbital berth anchor').to.eq(true);
    // The instrument: seven cells with their marker seats, three berths with
    // their cube seats, the carry targets — the trade layers' own anchors.
    expect(w.findAll('.con-colfocus__xcell').length).to.eq(7);
    expect(w.findAll('[data-colony-track-cell]').length).to.eq(7);
    expect(w.find('[data-colony-track-cell="Luna#2"]').exists()).to.eq(true);
    expect(w.findAll('.con-colfocus__berth').length).to.eq(3);
    expect(w.findAll('[data-colony-build-seat]').length).to.eq(3);
    expect(w.find('[data-colony-focus-track]').exists()).to.eq(true);
    expect(w.find('[data-colony-focus-slots]').exists()).to.eq(true);
    // The marker stands where the model says; two positions are protected.
    expect(w.findAll('.con-colfocus__xcell--marker').length).to.eq(1);
    expect(w.find('.con-colfocus__xcell--marker .con-colfocus__xcell-num').text()).to.eq('3');
    expect(w.findAll('.con-colfocus__xcell--protected').length).to.eq(3);
    expect(w.findAll('.con-colfocus__berth--taken').length).to.eq(3);
  });

  it('the RULES panel states every group — build, trade income with the live reading, owner bonus with the recipients, fleet', () => {
    const w = mountDossier();
    const kinds = w.findAll('.con-colinspect__kind').map((k) => k.text());
    expect(kinds).to.include('Construction');
    expect(kinds).to.include('Trade income');
    expect(kinds).to.include('Owner bonus');
    expect(kinds).to.include('Fleet');
    // The printed rules, straight from the metadata.
    const texts = w.findAll('.con-colinspect__text').map((t) => t.text());
    expect(texts).to.include(getColony(ColonyName.LUNA).build.description);
    expect(texts).to.include(getColony(ColonyName.LUNA).trade.description);
    expect(texts).to.include(getColony(ColonyName.LUNA).colony.description);
    // What a trade reads NOW: Luna at position 3 (index 2) pays 4 M€.
    expect(w.find('.con-colinspect__now-value b').text()).to.eq('+4');
    expect(w.find('.con-colinspect__now-pos').text()).to.contain('3/7');
    // The recipients: Ada ×2 → +4, Bo → +2 (the rate is 2 M€).
    const owners = w.findAll('.con-colinspect__owner');
    expect(owners.length).to.eq(2);
    expect(owners[0].find('.con-colinspect__owner-name').text()).to.eq('Ada');
    expect(owners[0].find('.con-colinspect__owner-mult').text()).to.eq('×2');
    expect(owners[0].find('.con-colinspect__owner-total').text()).to.eq('+4');
    expect(owners[1].find('.con-colinspect__owner-total').text()).to.eq('+2');
    // Nobody parked: the fleet group says so honestly.
    expect(w.find('.con-colinspect__line--fleet .con-colinspect__text').text()).to.eq('No trade fleet here');
  });

  it('EMBEDDED strips the shell: no head, no band marker, no motion id (embed rule 1)', () => {
    const w = mountDossier({embedded: true});
    const root = w.find('.con-colinspect');
    expect(w.find('.con-wshead').exists()).to.eq(false);
    expect(root.classes()).to.not.include('con-ws');
    expect(root.attributes('data-motion-surface')).to.eq(undefined);
    expect(root.classes()).to.include('con-colinspect--embedded');
  });

  it('STANDALONE (the journal door) draws its own head with the host root and «Inspection» as the stage', () => {
    const w = mountDossier({embedded: false, readonly: true, hostRoot: 'Journal'});
    const root = w.find('.con-colinspect');
    expect(root.classes()).to.include('con-ws');
    expect(root.attributes('data-motion-surface')).to.eq('colony-inspect');
    const head = w.find('.con-wshead');
    expect(head.exists()).to.eq(true);
    expect(head.find('.con-wshead__root').text()).to.eq('Journal');
    expect(head.find('.con-wshead__subject').text()).to.eq('Luna');
    expect(head.find('.con-wshead__step').text()).to.eq('Inspection');
    // History is read-only: no verdict, no payment table.
    expect(w.find('.con-colinspect__group--avail').exists()).to.eq(false);
  });

  it('the interactive door states the verdict with its tone and EVERY payment path', () => {
    const w = mountDossier({
      actIntent: 'trade', actionAvailable: false, blockReason: 'Not your turn to take any actions', blockTone: 'warning',
      paymentOptions: [{title: 'Pay 9 M€', metadata: {icon: 'megacredits', resource: {current: 20, resulting: 11}}}],
      disabledPayments: [{title: 'Pay 3 energy', reason: 'Not enough energy'}],
    });
    const verdict = w.find('.con-colinspect__verdict');
    expect(verdict.classes()).to.include('con-colinspect__verdict--notnow');
    expect(verdict.text()).to.contain('Not your turn to take any actions');
    const rows = w.findAll('.con-colinspect__payrow');
    expect(rows.length).to.eq(2);
    expect(rows[0].find('.con-colinspect__payrow-delta').text()).to.eq('20 → 11');
    expect(rows[1].classes()).to.include('con-colinspect__payrow--off');
    expect(rows[1].find('.con-colinspect__payrow-reason').text()).to.eq('Not enough energy');
  });

  it('B leaves; A enters the act ONLY when the server offers it', async () => {
    const blocked = mountDossier({actionAvailable: false});
    blocked.vm.handleIntent(A);
    expect(blocked.emitted('enter'), 'a blocked act never enters').to.eq(undefined);
    blocked.vm.handleIntent(B);
    expect(blocked.emitted('cancel')?.length).to.eq(1);

    const offered = mountDossier({actionAvailable: true});
    offered.vm.handleIntent(A);
    expect(offered.emitted('enter')?.length).to.eq(1);

    // History (the journal) never enters.
    const history = mountDossier({embedded: false, readonly: true, actionAvailable: true});
    history.vm.handleIntent(A);
    expect(history.emitted('enter')).to.eq(undefined);
  });
});
