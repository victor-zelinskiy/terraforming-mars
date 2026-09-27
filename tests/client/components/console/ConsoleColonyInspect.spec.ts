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

function mountDossier(props: Record<string, unknown> = {}, stubs: Record<string, unknown> = {}): VueWrapper<any> {
  return mount(ConsoleColonyInspect, {
    global: {
      ...globalConfig.global,
      stubs: {GamepadGlyph: true, BarButtonIcon: true, ...stubs},
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
 * zones stand (the archive entry from the colony's OWN metadata, the shared
 * trade-track instrument with its anchors, the three printed rules, the act
 * block with the verdict-as-information, the totals and every payment
 * path), the host-agnostic shell strip, and the verbs (B leaves; A ALWAYS
 * goes on — the dossier never gates the act; the right stick and ↑/↓ scroll
 * the rules). The geometry is the e2e probe's.
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

  it('the LORE zone shows the colony\'s own archive entry in the shared block, at the top of the side column', () => {
    const w = mountDossier();
    const lore = w.find('.con-colinspect__side .con-colinspect__lore .card-zoom-lore');
    expect(lore.exists(), 'the shared archive block inside the side column').to.eq(true);
    expect(w.find('.card-zoom-lore__text').text()).to.eq(getColony(ColonyName.LUNA).lore);
    expect(w.find('.card-zoom-lore--fallback').exists(), 'Luna has real lore — never the fallback').to.eq(false);
    // TWO seats, one shown (the host's width decides, in CSS): the side
    // column, and — for a narrow host — inside the rules panel's scroll.
    expect(w.findAll('.con-colinspect__lore').length).to.eq(2);
    expect(w.find('.con-colinspect__rules-body .con-colinspect__lore--inline .card-zoom-lore__text').text()).to.eq(getColony(ColonyName.LUNA).lore);
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
    // The fleet is stated ONCE, under the planet — never as a rules group.
    expect(w.find('.con-colinspect__status .con-colinspect__fleetline').text()).to.eq('No trade fleet here');
  });

  it('the RULES panel states the three PRINTED rules and the recipients — nothing the instrument already draws', () => {
    const w = mountDossier();
    const kinds = w.findAll('.con-colinspect__rules .con-colinspect__kind').map((k) => k.text());
    expect(kinds).to.deep.eq(['Construction', 'Trade income', 'Owner bonus']);
    // The printed rules, straight from the metadata.
    const texts = w.findAll('.con-colinspect__text').map((t) => t.text());
    expect(texts).to.include(getColony(ColonyName.LUNA).build.description);
    expect(texts).to.include(getColony(ColonyName.LUNA).trade.description);
    expect(texts).to.include(getColony(ColonyName.LUNA).colony.description);
    // No restatement of the berths (seats), the level («СЕЙЧАС»), the fleet
    // or the availability inside the rules — those live on the instrument,
    // the status line and the act block.
    expect(w.find('.con-colinspect__rules .con-colinspect__seat').exists()).to.eq(false);
    expect(w.find('.con-colinspect__rules .con-colinspect__now').exists()).to.eq(false);
    expect(w.find('.con-colinspect__rules .con-colinspect__verdict').exists()).to.eq(false);
    expect(w.find('.con-colinspect__rules .con-colinspect__payrow').exists()).to.eq(false);
    // The recipients: Ada ×2 → +4, Bo → +2 (the rate is 2 M€); the viewer's row is marked.
    const owners = w.findAll('.con-colinspect__owner');
    expect(owners.length).to.eq(2);
    expect(owners[0].find('.con-colinspect__owner-name').text()).to.eq('Ada');
    expect(owners[0].find('.con-colinspect__owner-mult').text()).to.eq('×2');
    expect(owners[0].find('.con-colinspect__owner-total').text()).to.eq('+4');
    expect(owners[0].classes()).to.include('con-colinspect__owner--you');
    expect(owners[1].find('.con-colinspect__owner-total').text()).to.eq('+2');
    expect(owners[1].classes()).to.not.include('con-colinspect__owner--you');
  });

  it('the ACT BLOCK sits in the side column: the act\'s name, the verdict as information, the totals, EVERY payment path', () => {
    const w = mountDossier({
      actIntent: 'trade', actionAvailable: false, blockReason: 'Not your turn to take any actions', blockTone: 'warning',
      paymentOptions: [{title: 'Pay 9 M€', metadata: {icon: 'megacredits', resource: {current: 20, resulting: 11}}}],
      disabledPayments: [{title: 'Pay 3 energy', reason: 'Not enough energy'}],
    });
    const act = w.find('.con-colinspect__side .con-colinspect__act');
    expect(act.exists(), 'the act block lives in the side column').to.eq(true);
    expect(act.find('.con-colinspect__act-kind').text()).to.eq('Trading');
    // The verdict — beside the name, in the warning register; it gates nothing.
    const verdict = act.find('.con-colinspect__act-head .con-colinspect__verdict');
    expect(verdict.classes()).to.include('con-colinspect__verdict--notnow');
    expect(verdict.text()).to.contain('Not your turn to take any actions');
    // WHAT THE PLAYER RECEIVES: Luna at position 3 (index 2) pays 4 M€, and
    // the viewer's two settlements pay 2 M€ each — ONE line, «+8 M€» (the
    // shared reward package's merge, not a second arithmetic).
    expect(act.find('.con-colinspect__act-sec--gain .con-colinspect__act-label').text()).to.eq('You receive');
    const gains = act.findAll('.con-colinspect__gain');
    expect(gains.length).to.eq(1);
    expect(gains[0].find('.con-colinspect__gain-amount').text()).to.eq('+8');
    expect(gains[0].find('.con-colinspect__gain-icon').exists(), 'the M€ glyph').to.eq(true);
    expect(gains[0].find('.con-colinspect__gain-glyph--prod').exists(), 'stock, not production').to.eq(false);
    // No payment is dialed here — no `current → resulting` is claimed on a gain.
    expect(gains[0].text()).to.not.contain('→');
    // EVERY payment path, affordable and not.
    const rows = act.findAll('.con-colinspect__payrow');
    expect(rows.length).to.eq(2);
    expect(rows[0].find('.con-colinspect__payrow-delta').text()).to.eq('20 → 11');
    expect(rows[1].classes()).to.include('con-colinspect__payrow--off');
    expect(rows[1].find('.con-colinspect__payrow-reason').text()).to.eq('Not enough energy');
  });

  it('an OFFERED act reads its verb in the mint register; a BUILD reads the next berth\'s grant in the production frame', () => {
    const offered = mountDossier({actIntent: 'trade', actionAvailable: true});
    const verdict = offered.find('.con-colinspect__verdict');
    expect(verdict.classes()).to.include('con-colinspect__verdict--ok');
    expect(verdict.text()).to.contain('Trade available');

    const build = mountDossier({actIntent: 'build', actionAvailable: true, colony: luna({colonies: [BLUE]})});
    expect(build.find('.con-colinspect__act-kind').text()).to.eq('Construction');
    expect(build.find('.con-colinspect__verdict').text()).to.contain('Build here');
    // Luna's build grant is +2 M€ PRODUCTION on every berth.
    const gain = build.find('.con-colinspect__gain');
    expect(gain.find('.con-colinspect__gain-amount').text()).to.eq('+2');
    expect(gain.find('.con-colinspect__gain-glyph--prod').exists(), 'production is framed').to.eq(true);
    // A build has no payment table (the standard project prices it).
    expect(build.find('.con-colinspect__paytable').exists()).to.eq(false);
  });

  it('EMBEDDED strips the shell: no head, no band marker, no motion id (embed rule 1)', () => {
    const w = mountDossier({embedded: true});
    const root = w.find('.con-colinspect');
    expect(w.find('.con-wshead').exists()).to.eq(false);
    expect(root.classes()).to.not.include('con-ws');
    expect(root.attributes('data-motion-surface')).to.eq(undefined);
    expect(root.classes()).to.include('con-colinspect--embedded');
  });

  it('STANDALONE (the journal door) draws its own head; history keeps the level\'s income and drops the verdict + payments', () => {
    const w = mountDossier({embedded: false, readonly: true, hostRoot: 'Journal',
      paymentOptions: [{title: 'Pay 9 M€', metadata: {icon: 'megacredits', resource: {current: 20, resulting: 11}}}]});
    const root = w.find('.con-colinspect');
    expect(root.classes()).to.include('con-ws');
    expect(root.attributes('data-motion-surface')).to.eq('colony-inspect');
    const head = w.find('.con-wshead');
    expect(head.exists()).to.eq(true);
    expect(head.find('.con-wshead__root').text()).to.eq('Journal');
    expect(head.find('.con-wshead__subject').text()).to.eq('Luna');
    expect(head.find('.con-wshead__step').text()).to.eq('Inspection');
    // History is read-only: the income at the current level still reads, but
    // there is no verdict and no payment table to plan with.
    const act = w.find('.con-colinspect__act');
    expect(act.exists()).to.eq(true);
    expect(act.find('.con-colinspect__act-label').text()).to.eq('On the current level');
    expect(act.find('.con-colinspect__gain-amount').text()).to.eq('+8');
    expect(act.find('.con-colinspect__verdict').exists()).to.eq(false);
    expect(act.find('.con-colinspect__paytable').exists()).to.eq(false);
  });

  it('B leaves; A ALWAYS goes on — the dossier never gates the act (the stage carries the refusal); history never enters', () => {
    const blocked = mountDossier({actionAvailable: false, blockReason: 'Not enough energy'});
    blocked.vm.handleIntent(A);
    expect(blocked.emitted('enter')?.length, 'a refused act still leads on to the stage').to.eq(1);
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

  it('the RIGHT STICK and ↑/↓ scroll the rules panel through the scroll area\'s API', () => {
    const calls: Array<number> = [];
    const ScrollStub = {
      name: 'ConsoleScrollArea',
      template: '<div class="con-scroll-stub"><slot /></div>',
      methods: {
        scrollByPx(dy: number): void {
          calls.push(dy);
        },
      },
    };
    const w = mountDossier({}, {ConsoleScrollArea: ScrollStub});
    w.vm.handleIntent({kind: 'scroll', dx: 0, dy: 0.6});
    w.vm.handleIntent({kind: 'scroll', dx: 0, dy: -0.3});
    w.vm.handleIntent({kind: 'nav', dir: 'down'});
    w.vm.handleIntent({kind: 'nav', dir: 'up'});
    // A sideways stick / d-pad moves nothing.
    w.vm.handleIntent({kind: 'nav', dir: 'left'});
    expect(calls.length).to.eq(4);
    expect(calls[0], 'stick down scrolls down').to.be.greaterThan(0);
    expect(calls[1], 'stick up scrolls up').to.be.lessThan(0);
    expect(calls[2]).to.be.greaterThan(0);
    expect(calls[3]).to.be.lessThan(0);
    expect(Math.abs(calls[0]), 'one step, whatever the stick\'s deflection').to.eq(Math.abs(calls[1]));
    expect(w.emitted('enter'), 'scrolling never enters').to.eq(undefined);
  });
});
