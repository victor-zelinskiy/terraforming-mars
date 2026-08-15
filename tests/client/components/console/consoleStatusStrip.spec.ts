import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleStatusStrip from '@/client/components/console/ConsoleStatusStrip.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Phase} from '@/common/Phase';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `awaited` = the server is waiting on the VIEWER (their chip reads active). */
function view(opts: {awaited?: boolean, isTerraformed?: boolean} = {}): PlayerViewModel {
  const awaited = opts.awaited ?? true;
  const players = [
    {color: 'red', name: 'Вы', actionsTakenThisRound: 0, isActive: awaited, isWaitingForInput: awaited},
    {color: 'green', name: 'Оппонент', actionsTakenThisRound: 0, isActive: !awaited, isWaitingForInput: !awaited},
  ];
  return {
    thisPlayer: players[0],
    players,
    runId: '',
    game: {
      temperature: -20,
      oxygenLevel: 3,
      oceans: 2,
      venusScaleLevel: 0,
      generation: 3,
      deckSize: 100,
      phase: Phase.ACTION,
      passedPlayers: [],
      isTerraformed: opts.isTerraformed ?? false,
      lastSoloGeneration: 14,
      gameOptions: {expansions: {venus: false}},
    },
  } as unknown as PlayerViewModel;
}

function mountStrip(engageMs: number, opts: {awaited?: boolean, isTerraformed?: boolean} = {}) {
  return mount(ConsoleStatusStrip, {
    global: {
      ...globalConfig.global,
      stubs: {AnimatedMetricValue: true, ConsoleFlipValue: true, ConsoleProjectDeck: true},
    },
    props: {playerView: view(opts), attentionPending: false, attentionEngageMs: engageMs},
  });
}

describe('ConsoleStatusStrip attention beacon', () => {
  it('idle: no attention class, no beacon', () => {
    const w = mountStrip(5);
    expect(w.find('.con-status__player--attention').exists()).to.be.false;
    expect(w.find('.con-status__beacon').exists()).to.be.false;
  });

  it('engages only after the debounce, on the VIEWER chip only', async () => {
    const w = mountStrip(5);
    await w.setProps({attentionPending: true});
    // Immediately after the raw signal: still off (debounce pending).
    expect(w.find('.con-status__player--attention').exists()).to.be.false;
    await sleep(25);
    await w.vm.$nextTick();
    const chips = w.findAll('.con-status__player');
    expect(chips[0].classes()).to.include('con-status__player--attention');
    expect(chips[1].classes()).to.not.include('con-status__player--attention');
    // The beacon badge lives inside the viewer chip.
    expect(chips[0].find('.con-status__beacon').exists()).to.be.true;
    expect(chips[1].find('.con-status__beacon').exists()).to.be.false;
  });

  it('releases INSTANTLY when the raw signal drops (the CTA card took over)', async () => {
    const w = mountStrip(5);
    await w.setProps({attentionPending: true});
    await sleep(25);
    await w.vm.$nextTick();
    expect(w.find('.con-status__player--attention').exists()).to.be.true;
    await w.setProps({attentionPending: false});
    expect(w.find('.con-status__player--attention').exists()).to.be.false;
  });

  it('a transient flicker shorter than the debounce never engages', async () => {
    const w = mountStrip(50);
    await w.setProps({attentionPending: true});
    await sleep(5);
    await w.setProps({attentionPending: false});
    await sleep(80);
    await w.vm.$nextTick();
    expect(w.find('.con-status__player--attention').exists()).to.be.false;
    expect(w.find('.con-status__beacon').exists()).to.be.false;
  });

  // A decision can be OWED while the table is still busy elsewhere (the corp
  // first action during another player's preludes; a minimized start
  // workspace). The player is then free to walk the interface, and an alarm
  // would demand something they cannot do — while the chip's own pill says
  // «ОЖИДАЕТ», which the flash flatly contradicted.
  it('stays silent while the viewer\'s status is NOT answerable', async () => {
    const w = mountStrip(5, {awaited: false});
    await w.setProps({attentionPending: true});
    await sleep(25);
    await w.vm.$nextTick();
    expect(w.find('.con-status__player--attention').exists()).to.be.false;
    expect(w.find('.con-status__beacon').exists()).to.be.false;
  });

  it('lights the INSTANT the status turns answerable (the debounce is spent)', async () => {
    const w = mountStrip(5, {awaited: false});
    await w.setProps({attentionPending: true});
    await sleep(25);
    await w.vm.$nextTick();
    expect(w.find('.con-status__beacon').exists()).to.be.false;
    // The server hands the viewer their turn: no second debounce — the pending
    // half has been engaged all along.
    await w.setProps({playerView: view({awaited: true})});
    await w.vm.$nextTick();
    expect(w.find('.con-status__player--attention').exists()).to.be.true;
    expect(w.find('.con-status__beacon').exists()).to.be.true;
  });

  it('goes quiet again if the status stops being answerable', async () => {
    const w = mountStrip(5);
    await w.setProps({attentionPending: true});
    await sleep(25);
    await w.vm.$nextTick();
    expect(w.find('.con-status__beacon').exists()).to.be.true;
    await w.setProps({playerView: view({awaited: false})});
    await w.vm.$nextTick();
    expect(w.find('.con-status__beacon').exists()).to.be.false;
  });
});

// The FINAL generation is signalled by COLOUR ONLY (the --final gold on the
// same element): the label stays the ordinary «GEN.» — same text, same box,
// zero layout shift, never an added word/badge/icon. The English key IS the
// i18n key, so asserting the raw label also pins every locale: a locale can
// only translate the ONE ordinary key.
describe('ConsoleStatusStrip generation label', () => {
  it('ordinary generation: the «GEN.» label without the final marker class', () => {
    const w = mountStrip(5);
    const gen = w.find('.con-status__gen');
    expect(gen.exists()).to.be.true;
    expect(gen.find('.con-status__gen-label').text()).to.equal('GEN.');
    expect(gen.classes()).to.not.include('con-status__gen--final');
  });

  it('FINAL generation: the SAME «GEN.» label — colour class is the whole signal', () => {
    const w = mountStrip(5, {isTerraformed: true});
    const gen = w.find('.con-status__gen');
    expect(gen.classes()).to.include('con-status__gen--final');
    // Same text, no added word — «ФИНАЛЬНОЕ» (or any other marker) may not
    // reappear in any locale: the one key rendered is the ordinary one.
    expect(gen.find('.con-status__gen-label').text()).to.equal('GEN.');
    expect(gen.text()).to.not.match(/FINAL/i);
    // No extra badge/icon nodes joined the block for the final state.
    expect(gen.findAll('.con-status__gen-label').length).to.equal(1);
  });
});
