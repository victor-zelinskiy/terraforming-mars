/*
 * ConsoleMandatoryAnnounce — the ONE calm «you have a pending decision» plate. A `<script setup>` component (step A
 * of docs/claude/vapor/RECIPES.md): everything it says comes in by props (the shell pre-translates the kicker and the
 * ask), it emits nothing (the shell handles A) and exposes nothing — so this spec reads what it renders for its props:
 * the neutral plate, a decision with a character, WHO asks (a card / an enacted resolution) and the sitting's
 * invitation with its two facts.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {allResolutions} from '@/client/parliament/ClientParliamentManifest';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {cardNumberDisplayState} from '@/client/components/premiumCard/cardNumberDisplay';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import {PromptTone, promptToneTagKey} from '@/client/console/promptTone';
import {SittingInvitationFacts} from '@/client/console/parliament/sittingInvitation';
import ConsoleMandatoryAnnounce from '@/client/components/console/ConsoleMandatoryAnnounce.vue';

// The emblem, the delegate figure and the glyph are their own subjects; this spec reads what the plate HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const EmblemStub = defineComponent({
  name: 'ConsolePromptEmblem',
  props: {tone: String},
  render: () => h('i', {class: 'emblem-stub'}),
});
const DelegateStub = defineComponent({
  name: 'PlayerDelegate',
  props: {color: String, size: Number, glow: Boolean, steel: Boolean},
  render: () => h('i', {class: 'delegate-stub'}),
});
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

type PlateProps = {
  kicker: string,
  ask: string,
  sourceCard?: CardName,
  sourceResolution?: string,
  openLabel?: string,
  tone?: PromptTone,
  invitation?: SittingInvitationFacts,
  invitationWinnerName?: string,
};

function plate(props: PlateProps) {
  return mount(ConsoleMandatoryAnnounce, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {ConsolePromptEmblem: EmblemStub, PlayerDelegate: DelegateStub, GamepadGlyph: GlyphStub}},
  });
}

describe('ConsoleMandatoryAnnounce — the pending decision\'s plate', () => {
  const numbersBefore = cardNumberDisplayState.enabled;

  afterEach(() => {
    // Module state is bundle-shared: the «card numbers» preference is put back for every later spec.
    cardNumberDisplayState.enabled = numbersBefore;
  });

  it('a free choice: the ⚑ plate names the decision, who asks (a card) and the ONE affordance on A', async () => {
    const w = plate({kicker: 'Decision', ask: 'Choose a card', sourceCard: CardName.ANTS});
    expect((w.element as HTMLElement).tagName, 'the template starts with its root').to.eq('DIV');
    expect(w.classes()).to.include('con-mandatory');
    expect(w.classes()).to.not.include('con-mandatory--sitting');
    expect(w.attributes('role')).to.eq('status');
    expect(w.attributes('aria-label')).to.eq('Decision: Choose a card');
    expect(w.attributes('data-test')).to.eq('con-mandatory-announce');

    expect(w.find('.con-mandatory__glyph').text()).to.eq('⚑');
    expect(w.findComponent(EmblemStub).exists(), 'a neutral decision wears no emblem').to.eq(false);
    expect(w.find('[data-prompt-tag]').exists()).to.eq(false);
    expect(w.find('.con-mandatory__kicker').text()).to.eq('Decision');
    expect(w.find('.con-mandatory__ask').text()).to.eq('Choose a card');
    expect(w.find('[data-sitting-invitation]').exists()).to.eq(false);

    const src = w.find('.con-mandatory__src');
    expect(src.text()).to.eq($t(CardName.ANTS));
    expect(src.classes()).to.not.include('con-mandatory__src--resolution');

    expect(w.findComponent(GlyphStub).props('control')).to.eq('confirm');
    expect(w.find('.con-mandatory__open span').text(), 'held: the default verb').to.eq($t('Open'));
    await w.setProps({openLabel: 'Return to the decision'});
    expect(w.find('.con-mandatory__open span').text(), 'deferred: the return verb').to.eq($t('Return to the decision'));
  });

  it('a decision with a CHARACTER wears the prompt family\'s emblem and its tag — a loss ▼, a gain ▲', async () => {
    const w = plate({kicker: 'Decision', ask: 'Lose production', tone: 'loss'});
    expect(w.find('.con-mandatory__glyph').exists()).to.eq(false);
    const emblem = w.findComponent(EmblemStub);
    expect(emblem.props('tone')).to.eq('loss');
    expect(emblem.classes()).to.include.members(['con-mandatory__emblem', 'con-mandatory__emblem--loss']);
    const tag = () => w.find('[data-prompt-tag]');
    expect(tag().text()).to.eq(`▼ ${$t(promptToneTagKey('loss') ?? '')}`);
    expect(tag().classes()).to.include('con-mandatory__tone--loss');
    expect(w.find('.con-mandatory__src').exists(), 'nobody named — no source line').to.eq(false);

    await w.setProps({tone: 'gain'});
    expect(w.findComponent(EmblemStub).props('tone')).to.eq('gain');
    expect(tag().text()).to.eq(`▲ ${$t(promptToneTagKey('gain') ?? '')}`);
    expect(tag().classes()).to.include('con-mandatory__tone--gain');
  });

  it('WHO asks — an enacted resolution outranks the card: its party\'s emblem, the kind, its name, its code by the preference', async () => {
    const law = allResolutions().find((resolution) => resolution.code !== undefined);
    if (law === undefined) {
      throw new Error('the generated parliament catalog holds no coded resolution');
    }
    cardNumberDisplayState.enabled = true;
    const w = plate({kicker: 'Decision', ask: 'Choose', sourceCard: CardName.ANTS, sourceResolution: law.id});
    expect(w.findAll('.con-mandatory__src'), 'said once — the resolution, not the card').to.have.length(1);
    const src = () => w.find('.con-mandatory__src');
    expect(src().classes()).to.include('con-mandatory__src--resolution');
    expect(src().attributes('data-source-resolution')).to.eq(law.id);
    expect(src().find('img.con-mandatory__src-emblem').attributes('src')).to.eq(partyEmblemUrl(law.party));
    expect(src().find('.con-mandatory__src-kind').text()).to.eq($t('Resolution'));
    expect(src().find('.con-mandatory__src-name').text()).to.eq($t(law.text.name));
    expect(src().find('.con-mandatory__src-code').text()).to.eq(String(law.code));

    cardNumberDisplayState.enabled = false;
    await nextTick();
    expect(src().find('.con-mandatory__src-code').exists(), 'the code follows the one «card numbers» preference').to.eq(false);

    // A law the catalog does not know is still NAMED (its id) — with no emblem and no code, never a blank chip.
    await w.setProps({sourceResolution: 'RDX_NOT_IN_THE_CATALOG'});
    expect(src().attributes('data-source-resolution')).to.eq('RDX_NOT_IN_THE_CATALOG');
    expect(src().find('.con-mandatory__src-name').text()).to.eq('RDX_NOT_IN_THE_CATALOG');
    expect(src().find('img').exists()).to.eq(false);
  });

  it('the sitting\'s invitation carries its TWO facts — the resolution and the winner — and never repeats the asking law', async () => {
    const facts: SittingInvitationFacts = {resolution: 'RDX_A_LAW', party: PartyName.GREENS, resolutionKey: 'Being enacted', winner: 'red', forecast: false};
    const w = plate({
      kicker: 'Parliament', ask: 'Sitting', sourceResolution: 'RDX_A_LAW', invitationWinnerName: 'Alice',
      invitation: {...facts, tieKey: 'Tie broken by the slot order'},
    });
    expect(w.classes()).to.include('con-mandatory--sitting');
    expect(w.find('[data-sitting-invitation]').attributes('data-invitation-forecast')).to.eq('false');

    const law = () => w.find('[data-invitation-fact="resolution"]');
    expect(law().attributes('data-resolution')).to.eq('RDX_A_LAW');
    expect(law().attributes('data-source-resolution'), 'the asking law IS this fact').to.eq('RDX_A_LAW');
    expect(law().find('.con-mandatory__fact-kicker').text()).to.eq($t('Being enacted'));
    expect(law().find('img').attributes('src')).to.eq(partyEmblemUrl(PartyName.GREENS));
    expect(law().find('.con-mandatory__fact-name').text()).to.eq('RDX_A_LAW');
    expect(w.find('.con-mandatory__src').exists(), 'the plate never repeats itself').to.eq(false);

    const winner = () => w.find('[data-invitation-fact="winner"]');
    expect(winner().attributes('data-winner')).to.eq('red');
    expect(winner().find('.con-mandatory__fact-kicker').text()).to.eq($t('Winner of the vote'));
    expect(winner().find('.con-mandatory__fact-name').text()).to.eq('Alice');
    expect(winner().find('.con-mandatory__fact-tie').text()).to.eq($t('Tie broken by the slot order'));
    const seat = () => w.findComponent(DelegateStub);
    expect([seat().props('color'), seat().props('size'), seat().props('glow'), seat().props('steel')]).to.deep.eq(['red', delegateFigurePx(16), false, false]);
    expect(seat().classes()).to.include('con-mandatory__fact-seat');

    // A FORECAST led by the neutral player, asked by ANOTHER law: «Leader», the steel figure, and the source stands again.
    await w.setProps({invitation: {...facts, winner: 'neutral', forecast: true, resolutionKey: 'Leading the vote'}, sourceResolution: 'RDX_ANOTHER_LAW', invitationWinnerName: 'Neutral'});
    expect(w.find('[data-sitting-invitation]').attributes('data-invitation-forecast')).to.eq('true');
    expect(law().attributes('data-source-resolution')).to.eq(undefined);
    expect(law().find('.con-mandatory__fact-kicker').text()).to.eq($t('Leading the vote'));
    expect(winner().attributes('data-winner')).to.eq('neutral');
    expect(winner().find('.con-mandatory__fact-kicker').text()).to.eq($t('Leader'));
    expect(winner().find('.con-mandatory__fact-tie').exists()).to.eq(false);
    expect([seat().props('color'), seat().props('steel')]).to.deep.eq(['neutral', true]);
    expect(w.find('.con-mandatory__src--resolution').attributes('data-source-resolution')).to.eq('RDX_ANOTHER_LAW');

    // No delegate on the card yet — the winner's box is not drawn at all.
    await w.setProps({invitation: {...facts, winner: undefined, forecast: true}});
    expect(winner().exists()).to.eq(false);
    expect(w.findComponent(DelegateStub).exists()).to.eq(false);
  });
});
