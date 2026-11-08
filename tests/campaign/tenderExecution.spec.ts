import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {Player} from '../../src/server/Player';
import {GameOptions} from '../../src/server/game/GameOptions';
import {CardName} from '../../src/common/cards/CardName';
import {cast} from '../../src/common/utils/utils';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectInitialCards} from '../../src/server/inputs/SelectInitialCards';
import {ICorporationCard, isICorporationCard} from '../../src/server/cards/corporation/ICorporationCard';
import {newCorporationCard} from '../../src/server/createCard';
import {IGame} from '../../src/server/IGame';
import {TENDER_COMPENSATION_MC, TenderId} from '../../src/common/campaign/tenders';
import {
  campaignCorporationQueue,
  campaignLineageOf,
  campaignPreludePickCount,
  campaignSetupExtrasOwed,
  campaignSetupResumeInput,
  campaignStartingBudget,
  executeTender,
  TENDER_START_REFUSAL,
  tenderStartRefusal,
  grantCarriedPreludes,
  runCampaignDeploymentChain,
  tenderCompensationPending,
} from '../../src/server/campaign/CampaignMissionSetup';

const LINEAGE = [CardName.CREDICOR, CardName.THORGATE, CardName.PHOBOLOG];

function finaleOptions(tenders: ReadonlyArray<TenderId>, overrides: Partial<GameOptions> = {}, rewardMode: 'tenders' | 'titles' = 'tenders'): Partial<GameOptions> {
  return {
    corporateEra: true,
    preludeExtension: true,
    bannedCards: [CardName.MERGER, ...LINEAGE, CardName.HELION, CardName.TERACTOR, CardName.INTERPLANETARY_CINEMATICS],
    campaign: {
      campaignId: 'ctest',
      campaignName: 'Test Campaign',
      missionSlot: 3,
      missionCount: 4,
      final: true,
      ...(rewardMode === 'tenders' ? {rewardMode} : {}),
      grants: [
        {seat: 0, color: 'blue', bonusMegaCredits: 5, corporations: LINEAGE, titlePoints: [],
          ...(tenders.length > 0 ? {tenders: tenders.map((id, i) => ({instance: `t${i}`, id}))} : {})},
        {seat: 1, color: 'red', bonusMegaCredits: 0, corporations: [CardName.HELION, CardName.TERACTOR, CardName.INTERPLANETARY_CINEMATICS], titlePoints: []},
      ],
    },
    ...overrides,
  };
}

function finale(tenders: ReadonlyArray<TenderId>, opts: {carriedPreludes?: Array<CardName>, rewardMode?: 'tenders' | 'titles', options?: Partial<GameOptions>} = {}): {game: IGame, p1: Player, p2: Player} {
  const p1 = new Player('Alice', 'blue', false, 0, 'p-tend-a');
  const p2 = new Player('Bruno', 'red', false, 0, 'p-tend-b');
  p1.campaignSeat = 0;
  p2.campaignSeat = 1;
  if (tenders.length > 0) {
    p1.campaignTenders = tenders.map((id, i) => ({instance: `t${i}`, id, status: 'held' as const}));
  }
  if (opts.carriedPreludes !== undefined) {
    p1.campaignCarriedPreludes = [...opts.carriedPreludes];
  }
  const game = Game.newInstance('g-tend-finale', [p1, p2], p1, 's-tend', finaleOptions(tenders, opts.options, opts.rewardMode ?? 'tenders'), 0.42);
  return {game, p1, p2};
}

function selectionOf(p: Player): SelectInitialCards {
  return cast(p.getWaitingFor(), SelectInitialCards);
}

/** Answers the finale's selection: `preludes` picked, no projects bought. */
function finishSelection(p: Player, preludes: Array<CardName>, projects: Array<CardName> = []): void {
  p.process({type: 'initialCards', responses: [{type: 'card', cards: preludes}, {type: 'card', cards: projects}]});
}

describe('tender execution at the finale\'s start', () => {
  it('the window: the finale of a tenders campaign, while the selection stands — nowhere else', () => {
    const {p1} = finale(['openCall']);
    expect(p1.getWaitingFor()?.type).eq('initialCards');
    expect(() => executeTender(p1, {type: 'tender', instance: 'missing'})).throws(/no such tender/);
    const titles = finale(['openCall'], {rewardMode: 'titles'});
    expect(() => executeTender(titles.p1, {type: 'tender', instance: 't0'})).throws(/only while the finale/);
    // A refused tender answer keeps the SAME prompt standing (the serial is restored).
    const before = titles.p1.waitingForSerial;
    expect(() => titles.p1.process({type: 'tender', instance: 't0'})).throws();
    expect(titles.p1.getWaitingFor()?.type).eq('initialCards');
    expect(titles.p1.waitingForSerial).eq(before);
    // Past the selection the window is closed.
    p1.initialCardSelectionDone = true;
    expect(() => executeTender(p1, {type: 'tender', instance: 't0'})).throws(/only while the finale/);
  });

  it('«Дополнительный пролог»: the pick rises to 3, the standing step follows, the selection is served again', () => {
    const {p1} = finale(['additionalPrelude']);
    const serial = p1.waitingForSerial;
    const selection = selectionOf(p1);
    expect(cast(selection.inputs.prelude, SelectCard).config.max).eq(2);
    p1.process({type: 'tender', instance: 't0'});
    expect(campaignPreludePickCount(p1)).eq(3);
    expect(p1.getWaitingFor(), 'the very same selection stands').eq(selection);
    expect(p1.waitingForSerial, 'with a fresh identity').not.eq(serial);
    expect(cast(selection.inputs.prelude, SelectCard).config.max).eq(3);
    expect(cast(selection.inputs.prelude, SelectCard).config.min).eq(3);
    expect(selection.toModel(p1).tenders).deep.eq([{instance: 't0', id: 'additionalPrelude', status: 'executed', window: 'start'}]);
    // A second execution of the same instance is refused.
    expect(() => p1.process({type: 'tender', instance: 't0'})).throws(/already executed/);
    // Three preludes are now the answer; two are refused.
    const dealt = p1.dealtPreludeCards.map((c) => c.name);
    expect(() => finishSelection(p1, dealt.slice(0, 2))).throws();
    finishSelection(p1, dealt.slice(0, 3));
    expect(p1.preludeCardsInHand.map((c) => c.name)).deep.eq(dealt.slice(0, 3));
    expect(p1.initialCardSelectionDone).is.true;
  });

  it('«Открытый конкурс» deals 2 more preludes; «Широкий портфель» 4 more projects — in place, under the standing steps', () => {
    const {game, p1} = finale(['openCall', 'broadPortfolio']);
    const selection = selectionOf(p1);
    const preludeDeck = game.preludeDeck.drawPile.length;
    const projectDeck = game.projectDeck.drawPile.length;
    p1.process({type: 'tender', instance: 't0'});
    expect(p1.dealtPreludeCards).has.length(6);
    expect(cast(selection.inputs.prelude, SelectCard).cards).has.length(6);
    expect(game.preludeDeck.drawPile).has.length(preludeDeck - 2);
    p1.process({type: 'tender', instance: 't1'});
    expect(p1.dealtProjectCards).has.length(14);
    expect(cast(selection.inputs.project, SelectCard).cards).has.length(14);
    expect(game.projectDeck.drawPile).has.length(projectDeck - 4);
  });

  it('«Субсидия на исследования»: the starting hand costs 1 M€ less per card — in the budget and at the payment', () => {
    const {p1} = finale(['researchSubsidy']);
    expect(campaignStartingBudget(p1, undefined).cardCost).eq(3);
    p1.process({type: 'tender', instance: 't0'});
    expect(campaignStartingBudget(p1, undefined).cardCost).eq(2);
    const preludes = p1.dealtPreludeCards.slice(0, 2).map((c) => c.name);
    finishSelection(p1, preludes, p1.dealtProjectCards.slice(0, 2).map((c) => c.name));
    expect(p1.cardsInHand).has.length(2);
    runCampaignDeploymentChain(p1, {deferCardPayment: false});
    // CrediCor's 57 − 2 cards × (3 − 1) — the merges and the bonus stand on their own presses.
    expect(p1.megaCredits).eq(57 - 2 * 2);
  });

  it('«Пересмотр прологов» keeps at most one and redeals the rest once', () => {
    const {p1} = finale(['preludeReview']);
    const before = p1.dealtPreludeCards.map((c) => c.name);
    expect(() => p1.process({type: 'tender', instance: 't0', keep: [before[0], before[1]]})).throws(/at most 1/);
    expect(() => p1.process({type: 'tender', instance: 't0', keep: [CardName.MERGER]})).throws(/not in your deal/);
    p1.process({type: 'tender', instance: 't0', keep: [before[1]]});
    const after = p1.dealtPreludeCards.map((c) => c.name);
    expect(after).has.length(4);
    expect(after[0]).eq(before[1]);
    for (const name of after.slice(1)) {
      expect(before, `${name} was redealt fresh`).not.includes(name);
    }
    expect(p1.campaignTenders![0].status).eq('executed');
  });

  it('«Пересмотр проектов» does the same for the ten projects; «Авантюра» redeals everything, keeping nothing', () => {
    const {p1} = finale(['projectReview', 'gamble']);
    const projects = p1.dealtProjectCards.map((c) => c.name);
    p1.process({type: 'tender', instance: 't0', keep: [projects[3]]});
    const reviewed = p1.dealtProjectCards.map((c) => c.name);
    expect(reviewed).has.length(10);
    expect(reviewed).includes(projects[3]);
    expect(reviewed.filter((n) => projects.includes(n))).deep.eq([projects[3]]);
    const preludes = p1.dealtPreludeCards.map((c) => c.name);
    p1.process({type: 'tender', instance: 't1'});
    expect(p1.dealtPreludeCards.map((c) => c.name).some((n) => preludes.includes(n))).is.false;
    expect(p1.dealtProjectCards.map((c) => c.name).some((n) => reviewed.includes(n))).is.false;
    expect(p1.dealtPreludeCards).has.length(4);
    expect(p1.dealtProjectCards).has.length(10);
  });

  it('«Реструктуризация»: deal two, decline or take one in place of a lineage corporation — the deployment follows', () => {
    const {game, p1} = finale(['restructuring']);
    const deck = game.corporationDeck.drawPile.length;
    expect(() => p1.process({type: 'tender', instance: 't0', take: CardName.ECOLINE, replace: CardName.THORGATE})).throws(/Deal the candidates first/);
    p1.process({type: 'tender', instance: 't0'});
    const offer = p1.campaignTenders![0].offer!;
    expect(offer).has.length(2);
    expect(p1.campaignTenders![0].status, 'the tender stays held until the choice').eq('held');
    expect(game.corporationDeck.drawPile).has.length(deck - 2);
    expect(selectionOf(p1).toModel(p1).tenders![0].offer).deep.eq(offer);
    // Decline: the candidates go back, the tender is still held (the compensation can buy it back).
    p1.process({type: 'tender', instance: 't0', decline: true});
    expect(p1.campaignTenders![0].offer).is.undefined;
    expect(p1.campaignTenders![0].status).eq('held');
    expect(game.corporationDeck.discardPile.map((c) => c.name)).includes(offer[0]);
    // Deal again, then take.
    p1.process({type: 'tender', instance: 't0'});
    const second = p1.campaignTenders![0].offer!;
    expect(() => p1.process({type: 'tender', instance: 't0', take: CardName.ECOLINE, replace: CardName.THORGATE})).throws(/Take one of the dealt/);
    expect(() => p1.process({type: 'tender', instance: 't0', take: second[0], replace: CardName.ECOLINE})).throws(/Name the lineage corporation/);
    p1.process({type: 'tender', instance: 't0', take: second[0], replace: CardName.THORGATE});
    expect(campaignLineageOf(p1)).deep.eq([CardName.CREDICOR, second[0], CardName.PHOBOLOG]);
    expect(campaignCorporationQueue(p1).map((c) => c.name)).deep.eq([CardName.CREDICOR, second[0], CardName.PHOBOLOG]);
    expect(p1.campaignTenders![0].status).eq('executed');
    expect(game.corporationDeck.discardPile.map((c) => c.name)).includes(second[1]);
    // The deployment plays the REWRITTEN lineage.
    finishSelection(p1, p1.dealtPreludeCards.slice(0, 2).map((c) => c.name));
    runCampaignDeploymentChain(p1, {deferCardPayment: false});
    p1.process({type: 'option'}); // the bonus
    expect(cast(p1.getWaitingFor(), SelectCard<ICorporationCard>).cards[0].name).eq(second[0]);
    p1.process({type: 'card', cards: [second[0]]});
    p1.process({type: 'card', cards: [CardName.PHOBOLOG]});
    expect(p1.playedCards.filter(isICorporationCard).map((c) => c.name)).deep.eq([CardName.CREDICOR, second[0], CardName.PHOBOLOG]);
  });

  it('«КОМПЕНСАЦИЯ»: the tenders left unexecuted are bought back as the LAST press of the deployment', () => {
    const {p1} = finale(['openCall', 'gamble']);
    expect(tenderCompensationPending(p1), 'nothing owed while the selection stands').deep.eq({tenders: 0, megaCredits: 0});
    finishSelection(p1, p1.dealtPreludeCards.slice(0, 2).map((c) => c.name));
    expect(tenderCompensationPending(p1)).deep.eq({tenders: 2, megaCredits: 2 * TENDER_COMPENSATION_MC});
    expect(campaignSetupExtrasOwed(p1)).is.true;
    runCampaignDeploymentChain(p1, {deferCardPayment: false});
    p1.process({type: 'option'}); // bonus
    p1.process({type: 'card', cards: [CardName.THORGATE]});
    p1.process({type: 'card', cards: [CardName.PHOBOLOG]});
    const press = p1.getWaitingFor() as any;
    expect(press?.startGamePrompt?.kind).eq('tenderCompensation');
    expect(press?.startGamePrompt?.compensation).deep.eq({tenders: 2, megaCredits: 6});
    const before = p1.megaCredits;
    p1.process({type: 'option'});
    expect(p1.megaCredits).eq(before + 6);
    expect(p1.campaignTenders!.map((t) => t.status)).deep.eq(['cashed', 'cashed']);
    expect(p1.campaignTendersCompensated).is.true;
    expect(tenderCompensationPending(p1)).deep.eq({tenders: 0, megaCredits: 0});
    expect(campaignSetupExtrasOwed(p1)).is.false;
    expect((p1.game as any).researchedPlayers.has(p1.id), 'the last press released the barrier').is.true;
  });

  it('reload recovery re-raises the owed compensation press', () => {
    const {p1} = finale(['broadPortfolio']);
    finishSelection(p1, p1.dealtPreludeCards.slice(0, 2).map((c) => c.name));
    for (const name of LINEAGE) {
      p1.playCorporationCard(newCorporationCard(name)!, {holdResearchRelease: true});
    }
    p1.campaignBonusGranted = true;
    p1.campaignMergeFeesPaid = 2;
    expect(campaignSetupExtrasOwed(p1)).is.true;
    const resume = campaignSetupResumeInput(p1) as any;
    expect(resume?.startGamePrompt?.kind).eq('tenderCompensation');
    expect(resume?.startGamePrompt?.compensation).deep.eq({tenders: 1, megaCredits: 3});
  });

  it('a carried prelude («Продление программы») is reserved out of the deck and joins the picked preludes exactly once', () => {
    const {game, p1, p2} = finale([], {carriedPreludes: [CardName.BIOFUELS]});
    expect(game.preludeDeck.drawPile.map((c) => c.name)).not.includes(CardName.BIOFUELS);
    expect(p1.dealtPreludeCards.map((c) => c.name)).not.includes(CardName.BIOFUELS);
    expect(p2.dealtPreludeCards.map((c) => c.name)).not.includes(CardName.BIOFUELS);
    const picked = p1.dealtPreludeCards.slice(0, 2).map((c) => c.name);
    finishSelection(p1, picked);
    expect(p1.preludeCardsInHand.map((c) => c.name)).deep.eq([...picked, CardName.BIOFUELS]);
    expect(p1.campaignCarriedPreludesGranted).is.true;
    grantCarriedPreludes(p1);
    expect(p1.preludeCardsInHand).has.length(3);
  });

  it('the selection model names each tender\'s WINDOW and the server\'s REASON when it cannot go — the one reader the executor refuses by', () => {
    const {game, p1} = finale(['extendedLegacy', 'openCall', 'researchSubsidy', 'restructuring']);
    const read = () => selectionOf(p1).toModel(p1).tenders!.map((t) => [t.id, t.window, t.blocked]);
    expect(read()).deep.eq([
      ['extendedLegacy', 'legacy', TENDER_START_REFUSAL.legacyWindow],
      ['openCall', 'start', undefined],
      ['researchSubsidy', 'start', undefined],
      ['restructuring', 'start', undefined],
    ]);
    expect(() => executeTender(p1, {type: 'tender', instance: 't0'})).to.throw(TENDER_START_REFUSAL.legacyWindow);
    // The prelude deck runs dry: «Открытый конкурс» cannot deal — the model says so BEFORE a press, the press is refused by the same words.
    game.preludeDeck.drawPile.splice(0);
    game.preludeDeck.discardPile.splice(0);
    expect(tenderStartRefusal(p1, {id: 'openCall'})).eq(TENDER_START_REFUSAL.preludeDeckShort);
    expect(read()[1]).deep.eq(['openCall', 'start', TENDER_START_REFUSAL.preludeDeckShort]);
    expect(() => executeTender(p1, {type: 'tender', instance: 't1'})).to.throw(TENDER_START_REFUSAL.preludeDeckShort);
    // A hand already free: «Субсидия» would buy nothing — refused, so the compensation stays the better deal.
    p1.campaignStartingHandDiscount = 99;
    expect(read()[2]).deep.eq(['researchSubsidy', 'start', TENDER_START_REFUSAL.handAlreadyFree]);
    // The corporation deck runs dry: «Реструктуризация» has nothing to deal.
    game.corporationDeck.drawPile.splice(0);
    game.corporationDeck.discardPile.splice(0);
    expect(read()[3]).deep.eq(['restructuring', 'start', TENDER_START_REFUSAL.corporationDeckShort]);
    expect(() => executeTender(p1, {type: 'tender', instance: 't3'})).to.throw(TENDER_START_REFUSAL.corporationDeckShort);
  });

  it('a tenders finale scores no «Титулы» category; a titles finale still does', () => {
    const tenders = finale([]);
    expect(tenders.p1.getVictoryPoints().titles).is.undefined;
    const titles = finale([], {rewardMode: 'titles'});
    expect(titles.p1.getVictoryPoints().titles).eq(0);
  });
});
