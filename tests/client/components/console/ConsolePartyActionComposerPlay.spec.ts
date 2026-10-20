import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsolePartyActionComposer from '@/client/components/console/parliament/ConsolePartyActionComposer.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, SelectOptionModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {ResolutionPlayModel} from '@/common/models/ParliamentModel';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PartyName} from '@/common/turmoil/PartyName';
import {GlobalParameter} from '@/common/GlobalParameter';
import {RequirementType} from '@/common/cards/RequirementType';
import {Payment} from '@/common/inputs/Payment';
import {
  beginLawPlayLanding, cancelConsolePlayPick, consolePlayPickState, ConsolePlayPickResult, endLawPlayLanding, resetConsolePlayPick, resolveConsolePlayPick,
} from '@/client/console/consolePlayPick';
import {playedHeroState} from '@/client/console/played/consolePlayedHero';
import {resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';

/**
 * THE LAW WHOSE ACTION PLAYS A CARD (Turmoil Redux RX36 Live Experiments: «pay
 * 6 M€ to play a card ignoring all global parameter requirements»).
 *
 * «Which card, and how» is a question this console answers with ONE surface —
 * the hand album with the play composer one level deeper — so the law's stage
 * shows the decision as a SLOT (the repeat slot's grammar, RX26) and hands the
 * pick to the play pick bridge (`consolePlayPick`) with the law's PROMISED pick
 * (`ResolutionActionModel.play`). These specs pin: the slot (empty invites, the
 * commit dims), the door (the bridge gets the promise, the bill's reserve, the
 * law), the filled slot (the card's face, its price, «✓ благодаря закону»,
 * the TOTAL), «a choice is not a commit», and the wire form — ONE batch: the
 * menu option, the card pick ADDRESSED to the law, the card's own answers. A
 * bill that asks a payment of its own promises nothing pre-collectable: no
 * slot, the confirm road.
 */
const LAW = 'RDX_SCIENTISTS_LIVE_EXPERIMENTS';

function grass(decisive: boolean): CardModel {
  return {
    name: CardName.GRASS, calculatedCost: 11, resources: undefined,
    requirementEasing: [{
      key: 'req:temperature', index: 0, type: RequirementType.TEMPERATURE, parameter: GlobalParameter.TEMPERATURE, max: false,
      printed: -16, effective: 'waived', current: -30, met: true, decisive,
      sources: [{source: {kind: 'resolution', id: LAW}, kind: 'waive', oneShot: true}],
    }],
  } as unknown as CardModel;
}

function promised(decisive = true): SelectProjectCardToPlayModel {
  return {
    type: 'projectCard', title: 'Play project card', buttonLabel: 'Play card',
    cards: [grass(decisive), {name: CardName.ADAPTED_LICHEN, calculatedCost: 9} as unknown as CardModel],
    paymentOptions: {}, microbes: 0, floaters: 0, lunaArchivesScience: 0, seeds: 0, graphene: 0, kuiperAsteroids: 0,
    auroraiData: 0, spireScience: 0, floodgateSteel: 0, mechs: 0, constructionMechs: 0, supercomputerData: 0,
  } as unknown as SelectProjectCardToPlayModel;
}

function lawOption(): SelectOptionModel {
  return {
    type: 'option', title: 'Pay 6 M€ to play a card ignoring global requirements (Live Experiments)', buttonLabel: 'Play card',
    resolutionActionPrompt: {resolution: LAW, party: PartyName.SCIENTISTS, stage: 'choose', usesLeft: 1, usesPerGeneration: 1},
  } as unknown as SelectOptionModel;
}

function menu(option: PlayerInputModel): PlayerInputModel {
  return {type: 'or', title: 'Take an action', buttonLabel: 'Take action', options: [option]} as unknown as PlayerInputModel;
}

function playerView(play: ResolutionPlayModel | undefined): PlayerViewModel {
  return {
    id: 'p1',
    waitingFor: menu(lawOption()),
    game: {gameAge: 1, parliament: {
      players: [{color: 'red', influence: 2}],
      viewer: {resolutionAction: {
        resolution: LAW, party: PartyName.SCIENTISTS, hasAccess: true, usesLeft: 1, usesPerGeneration: 1, available: true, reason: '',
        preview: [{direction: 'cost', icon: 'megacredits', amount: 6, note: 'then play a card ignoring global requirements', current: 20, resulting: 14}],
        ...(play !== undefined ? {play} : {}),
      }},
    }},
    thisPlayer: {color: 'red'},
    players: [],
  } as unknown as PlayerViewModel;
}

function mountLaw(play: ResolutionPlayModel | undefined) {
  return mount(ConsolePartyActionComposer, {
    global: {
      ...globalConfig.global,
      stubs: {'premium-card-face': true, 'ConsoleCardFaceLite': true, 'ConsolePlayedReceivingStage': true},
      directives: {...globalConfig.global.directives, 'strip-action-prefix': {}},
    },
    props: {playerView: playerView(play), party: PartyName.SCIENTISTS, resolution: LAW},
  });
}

const PLAY: ResolutionPlayModel = {input: promised(), reserve: 6, billAsks: false};

function composed(): ConsolePlayPickResult {
  return {
    cardName: CardName.GRASS,
    payment: Payment.of({megacredits: 11}),
    branchIndex: -1,
    preResponses: [],
    optionResponse: undefined,
    stepResponses: [],
    cost: 11,
    scene: {},
  };
}

describe('ConsolePartyActionComposer — a law whose action PLAYS A CARD (RX36)', () => {
  afterEach(() => {
    resetConsolePlayPick();
    endLawPlayLanding();
    resetWorkspaceStack();
    playedHeroState.active = false;
    playedHeroState.phase = 'idle';
    playedHeroState.host = 'overlay';
    playedHeroState.card = undefined;
  });

  it('shows the decision as a SLOT with the price above it — empty, it invites; the commit is not armed', () => {
    const w = mountLaw(PLAY);
    expect(w.find('[data-pact-play-slot]').exists(), 'the slot stands').to.be.true;
    expect(w.find('[data-pact-price]').exists(), 'the law\'s price reads ALWAYS').to.be.true;
    expect(w.find('.con-pact__repeatslot-empty').exists(), 'empty, it invites').to.be.true;
    expect(w.find('[data-pact-play-total]').exists(), 'no total before a card').to.be.false;
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready'), 'nothing is pre-answered').to.be.undefined;
  });

  it('A on the slot hands the PROMISED pick to the play pick bridge — the bill\'s reserve and the law with it', async () => {
    const w = mountLaw(PLAY);
    await w.find('[data-pact-play-slot]').trigger('click');
    expect(consolePlayPickState.active, 'the bridge is out').to.be.true;
    const request = consolePlayPickState.request!;
    expect(request.input.cards.map((c) => c.name), 'the law\'s promise, never the menu\'s own play')
      .to.deep.eq([CardName.GRASS, CardName.ADAPTED_LICHEN]);
    expect(request.reserve).to.eq(6);
    expect(request.resolution).to.eq(LAW);
    expect(w.emitted('confirm'), 'opening the pick commits nothing').to.be.undefined;
  });

  it('the resolved play FILLS the slot — the card, its price, «✓ thanks to» the law, the TOTAL — and only then arms the commit', async () => {
    const w = mountLaw(PLAY);
    await w.find('[data-pact-play-slot]').trigger('click');
    resolveConsolePlayPick(composed());
    await w.vm.$nextTick();
    expect(w.find('[data-pact-play-name]').text()).to.eq(CardName.GRASS);
    expect(w.find('[data-pact-play-slot]').attributes('data-pact-play-card')).to.eq(CardName.GRASS);
    expect(w.find('[data-pact-play-eased]').text(), 'the law is what lets it through').to.contain('Live Experiments');
    expect(w.find('[data-pact-play-total]').text(), 'the law\'s 6 and the card\'s price, summed').to.contain('6 M€ for the law + 11 M€ for the card = 17 M€');
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready')).to.eq('');
    expect(w.emitted('confirm'), 'filling the slot is not committing').to.be.undefined;
  });

  it('a card playable WITHOUT the law reads no «thanks to»', async () => {
    const w = mountLaw({input: promised(false), reserve: 6, billAsks: false});
    await w.find('[data-pact-play-slot]').trigger('click');
    resolveConsolePlayPick(composed());
    await w.vm.$nextTick();
    expect(w.find('[data-pact-play-eased]').exists()).to.be.false;
  });

  it('a CANCELLED pick leaves the stage as it was — the slot empty, the flow alive', async () => {
    const w = mountLaw(PLAY);
    await w.find('[data-pact-play-slot]').trigger('click');
    cancelConsolePlayPick();
    await w.vm.$nextTick();
    expect(consolePlayPickState.active).to.be.false;
    expect(w.find('.con-pact__repeatslot-empty').exists()).to.be.true;
    expect(w.emitted('cancel')).to.be.undefined;
  });

  it('commits ONE batch: the menu option, the card pick ADDRESSED to the law, then the card\'s own answers — the play rides the detail', async () => {
    const w = mountLaw(PLAY);
    await w.find('[data-pact-play-slot]').trigger('click');
    resolveConsolePlayPick({...composed(), stepResponses: [{type: 'card', cards: [CardName.TARDIGRADES]}]});
    await w.vm.$nextTick();
    await w.find('[data-pact-cta]').trigger('click');
    const emitted = w.emitted('confirm');
    expect(emitted).to.have.length(1);
    expect(emitted![0][0]).to.deep.eq([
      {type: 'or', index: 0, response: {type: 'option'}},
      {type: 'projectCard', card: CardName.GRASS, payment: Payment.of({megacredits: 11}), for: {source: {kind: 'resolution', resolution: LAW}, role: 'projectCard'}},
      {type: 'card', cards: [CardName.TARDIGRADES]},
    ]);
    const detail = emitted![0][1] as {expectedCards: number, play?: ConsolePlayPickResult, lawBill?: {resolution: string, megacredits: number}};
    expect(detail.expectedCards).to.eq(0);
    expect(detail.play?.cardName, 'the host arms the landing off the slot').to.eq(CardName.GRASS);
    expect(detail.lawBill, 'the law\'s own price rides along — its token departs first (PL-725)').to.deep.eq({resolution: LAW, megacredits: 6});
  });

  it('THE CARD LANDS IN THE STAGE (PL-726): the receiving stage mounts hidden at the arm, rises with the scene, and the setup lets go under it', async () => {
    const w = mountLaw(PLAY);
    await w.find('[data-pact-play-slot]').trigger('click');
    resolveConsolePlayPick(composed());
    await w.vm.$nextTick();
    expect(w.find('[data-pact-landing]').exists(), 'nothing before the commit').to.be.false;
    beginLawPlayLanding({card: CardName.GRASS, resolution: LAW});
    playedHeroState.card = CardName.GRASS;
    playedHeroState.host = 'workspace';
    playedHeroState.active = true;
    playedHeroState.phase = 'armed';
    await w.vm.$nextTick();
    const layer = w.find('[data-pact-landing]');
    expect(layer.exists(), 'mounted from the arm (the prewarm window)').to.be.true;
    expect(layer.classes(), 'hidden while the answer is on the wire').not.to.include('con-pact__playstage--up');
    playedHeroState.phase = 'flying';
    await w.vm.$nextTick();
    expect(w.find('[data-pact-landing]').classes(), 'up with the scene').to.include('con-pact__playstage--up');
    expect(w.find('.con-pact--play').exists(), 'the stage stays the play form under the scene').to.be.true;
    // The answer takes the menu option away at the landing — the stage does not change what it is.
    await w.setProps({playerView: {...playerView(PLAY), waitingFor: {type: 'or', title: 'Take an action', buttonLabel: 'Take action', options: []}} as unknown as PlayerViewModel});
    await w.vm.$nextTick();
    expect(w.find('[data-pact-landing]').classes(), 'latched once it rose').to.include('con-pact__playstage--up');
  });

  it('a REFUSED play (the scene failed before it rose) brings the setup back — no stage left behind', async () => {
    const w = mountLaw(PLAY);
    await w.find('[data-pact-play-slot]').trigger('click');
    resolveConsolePlayPick(composed());
    beginLawPlayLanding({card: CardName.GRASS, resolution: LAW});
    playedHeroState.card = CardName.GRASS;
    playedHeroState.host = 'workspace';
    playedHeroState.active = true;
    playedHeroState.phase = 'armed';
    await w.vm.$nextTick();
    expect(w.find('[data-pact-landing]').exists()).to.be.true;
    playedHeroState.active = false;
    playedHeroState.phase = 'failed';
    endLawPlayLanding();
    await w.vm.$nextTick();
    expect(w.find('[data-pact-landing]').exists(), 'the stage is gone').to.be.false;
    expect(w.find('[data-pact-play-name]').text(), 'the slot still holds the card').to.eq(CardName.GRASS);
  });

  it('a bill that ASKS a payment of its own promises nothing pre-collectable — no slot, the confirm road', () => {
    const w = mountLaw({input: promised(), reserve: 6, billAsks: true});
    expect(w.find('[data-pact-play-slot]').exists()).to.be.false;
    expect(w.find('[data-pact-price]').exists(), 'the confirm with its price').to.be.true;
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready'), 'a confirm is complete by standing').to.eq('');
  });
});
