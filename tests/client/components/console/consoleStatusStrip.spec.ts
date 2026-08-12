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
function view(opts: {awaited?: boolean} = {}): PlayerViewModel {
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
      isTerraformed: false,
      lastSoloGeneration: 14,
      gameOptions: {expansions: {venus: false}},
    },
  } as unknown as PlayerViewModel;
}

function mountStrip(engageMs: number, opts: {awaited?: boolean} = {}) {
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
