import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {Player} from '../../src/server/Player';
import {GameOptions} from '../../src/server/game/GameOptions';
import {CardName} from '../../src/common/cards/CardName';
import {cast} from '../../src/common/utils/utils';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {ICorporationCard, isICorporationCard} from '../../src/server/cards/corporation/ICorporationCard';
import {newCorporationCard} from '../../src/server/createCard';
import {
  campaignCorporationQueue,
  campaignStartingBudget,
  expectedCorporationCount,
  campaignSetupResumeInput,
  grantCarriedProjectCards,
  runCampaignDeploymentChain,
} from '../../src/server/campaign/CampaignMissionSetup';
import {computeMissionStandings} from '../../src/server/campaign/missionStandings';
import {Merger} from '../../src/server/cards/promo/Merger';
import {CAMPAIGN_MERGE_COST} from '../../src/common/campaign/CampaignTypes';
import {SelectInitialCards} from '../../src/server/inputs/SelectInitialCards';
import {IGame} from '../../src/server/IGame';

const CARRIED = CardName.ACQUIRED_COMPANY;

function missionOptions(overrides: Partial<GameOptions['campaign'] & {final: boolean}> = {}, lineage0: Array<CardName> = [CardName.CREDICOR]): Partial<GameOptions> {
  const final = overrides.final ?? false;
  return {
    corporateEra: true,
    bannedCards: [CardName.MERGER, ...lineage0],
    campaign: {
      campaignId: 'ctest',
      campaignName: 'Test Campaign',
      missionSlot: final ? 3 : 1,
      missionCount: 4,
      final,
      grants: [
        {seat: 0, color: 'blue', bonusMegaCredits: 5, corporations: lineage0, titlePoints: []},
        {seat: 1, color: 'red', bonusMegaCredits: 0, corporations: [], titlePoints: []},
      ],
    },
  };
}

function newMissionGame(options: Partial<GameOptions>, carried: Array<CardName> = []): {game: IGame, p1: Player, p2: Player} {
  const p1 = new Player('Alice', 'blue', false, 0, 'p-camp-a');
  const p2 = new Player('Bruno', 'red', false, 0, 'p-camp-b');
  p1.campaignSeat = 0;
  p2.campaignSeat = 1;
  if (carried.length > 0) {
    p1.campaignCarriedCards = [...carried];
  }
  const game = Game.newInstance('g-camp-mission', [p1, p2], p1, 's-camp', options, 0.42);
  return {game, p1, p2};
}

describe('CampaignMissionSetup', () => {
  it('reservation: a carried project card is removed from the deck before any deal', () => {
    const {game, p1, p2} = newMissionGame(missionOptions(), [CARRIED]);
    expect(game.projectDeck.drawPile.map((c) => c.name)).not.includes(CARRIED);
    expect(game.projectDeck.discardPile.map((c) => c.name)).not.includes(CARRIED);
    expect(p1.dealtProjectCards.map((c) => c.name)).not.includes(CARRIED);
    expect(p2.dealtProjectCards.map((c) => c.name)).not.includes(CARRIED);
  });

  it('expected corporation counts: lineage + pick for missions 2-3, lineage only for the final', () => {
    const m2 = newMissionGame(missionOptions());
    expect(expectedCorporationCount(m2.p1)).eq(2);
    expect(expectedCorporationCount(m2.p2)).eq(1);

    const m4 = newMissionGame(missionOptions({final: true}, [CardName.CREDICOR, CardName.THORGATE, CardName.PHOBOLOG]));
    expect(expectedCorporationCount(m4.p1)).eq(3);
  });

  it('the deployment chain is STAGED: base → bonus → merge(+fee) → legacy', () => {
    const {game, p1} = newMissionGame(missionOptions(), [CARRIED]);
    p1.pickedCorporationCard = newCorporationCard(CardName.THORGATE)!;
    // Two bought starting cards (the affordability the deployment must honor).
    p1.cardsInHand.push(...p1.dealtProjectCards.slice(0, 2));

    runCampaignDeploymentChain(p1, {deferCardPayment: false});

    // Stage 1 — only the base is on the tableau; the bonus press stands next.
    expect(p1.playedCards.filter(isICorporationCard).map((c) => c.name)).deep.eq([CardName.CREDICOR]);
    // Credicor 57 − 2×3 M€ hand purchase (synchronous in this variant); the
    // BONUS has not arrived yet — its press owns it.
    expect(p1.megaCredits).eq(57 - 6);
    expect((p1.getWaitingFor() as any).startGamePrompt?.kind).eq('campaignBonus');
    expect((p1.getWaitingFor() as any).startGamePrompt?.bonus?.megaCredits).eq(5);
    expect((game as any).researchedPlayers.has(p1.id)).is.false;

    // Stage 2 — the bonus press grants the comeback M€.
    p1.process({type: 'option'});
    expect(p1.megaCredits).eq(57 - 6 + 5);
    expect(p1.campaignBonusGranted).is.true;
    const merge = cast(p1.getWaitingFor(), SelectCard<ICorporationCard>);
    expect(merge.cards.map((c) => c.name)).deep.eq([CardName.THORGATE]);
    expect((p1.getWaitingFor() as any).startGamePrompt?.kind).eq('corporationMerge');

    // Stage 3 — the merge press plays the pick on top of the base AND charges
    // the Merger-rule fee (42 M€, auto-paid in the same drain when only M€
    // can pay) — AFTER the new corp's own resources, exactly as Merger does.
    p1.process({type: 'card', cards: [CardName.THORGATE]});
    expect(p1.playedCards.filter(isICorporationCard).map((c) => c.name)).deep.eq([CardName.CREDICOR, CardName.THORGATE]);
    expect(p1.megaCredits).eq(57 - 6 + 5 + 48 - 42);
    expect(p1.campaignMergeFeesPaid).eq(1);
    // The carried card has NOT arrived yet — the legacy stage owns it.
    expect(p1.cardsInHand).has.length(2);
    expect((p1.getWaitingFor() as any).startGamePrompt?.kind).eq('campaignLegacy');
    expect((p1.getWaitingFor() as any).startGamePrompt?.legacy?.cards).eq(1);

    // Stage 4 — the legacy press: the carried card joins the hand FREE, with
    // NO reveal batch (the owner sees it face-up in the queue; the client
    // flies it into the dock exactly like the bought projects).
    p1.process({type: 'option'});
    expect(p1.cardsInHand.map((c) => c.name)).includes(CARRIED);
    expect(p1.cardsInHand).has.length(3);
    expect(p1.campaignCarriedGranted).is.true;
    expect(p1.cardDrawReveals).is.empty;
    // Exactly once: a re-grant is a no-op.
    grantCarriedProjectCards(p1);
    expect(p1.cardsInHand).has.length(3);
    // The queue is empty after the full chain (idempotent by tableau).
    expect(campaignCorporationQueue(p1)).is.empty;
    // Only the LAST stage released the player into the research barrier.
    expect((game as any).researchedPlayers.has(p1.id)).is.true;
  });

  it('the CANONICAL deferred order: base → bonus → merge(+fee) → hand payment', () => {
    const {p1} = newMissionGame(missionOptions());
    p1.pickedCorporationCard = newCorporationCard(CardName.THORGATE)!;
    // Two bought starting cards, paid by their own press (the deferred beat).
    p1.cardsInHand.push(...p1.dealtProjectCards.slice(0, 2));

    runCampaignDeploymentChain(p1, {deferCardPayment: true});

    // Base's own resources first; the BONUS press is the next beat.
    expect((p1.getWaitingFor() as any).startGamePrompt?.kind).eq('campaignBonus');
    expect(p1.megaCredits).eq(57);

    p1.process({type: 'option'});
    expect(p1.megaCredits).eq(57 + 5);
    expect((p1.getWaitingFor() as any).startGamePrompt?.kind).eq('corporationMerge');

    // The merge press: the pick plays, its fee auto-pays from the assembled
    // capital, and only THEN the hand payment press is offered — the bill
    // arrives after every corporation's capital and every fee.
    p1.process({type: 'card', cards: [CardName.THORGATE]});
    expect(p1.megaCredits).eq(57 + 5 + 48 - 42);
    expect((p1.getWaitingFor() as any).startGamePrompt?.kind).eq('corporationPay');

    p1.process({type: 'option'});
    expect(p1.megaCredits).eq(57 + 5 + 48 - 42 - 6);
  });

  it('a crash mid-sequence resumes exactly where it stopped (queue skips played corps)', () => {
    const {p1} = newMissionGame(missionOptions());
    const picked = newCorporationCard(CardName.THORGATE)!;
    p1.pickedCorporationCard = picked;
    // Simulate the crash: only the lineage base got played.
    p1.playCorporationCard(newCorporationCard(CardName.CREDICOR)!, {holdResearchRelease: true});
    const queue = campaignCorporationQueue(p1);
    expect(queue.map((c) => c.name)).deep.eq([CardName.THORGATE]);
  });

  it('reload recovery reconstructs the exact owed STAGE (base → bonus → merge → fee → legacy → done)', () => {
    const {p1} = newMissionGame(missionOptions(), [CARRIED]);
    p1.pickedCorporationCard = newCorporationCard(CardName.THORGATE)!;

    // Fresh mission 2: the BASE press is owed first.
    const base = campaignSetupResumeInput(p1);
    expect((base as any)?.startGamePrompt?.kind).eq('corporationPlay');
    expect(cast(base, SelectCard<ICorporationCard>).cards[0].name).eq(CardName.CREDICOR);

    // Base played, crash: the BONUS press is what's owed.
    p1.playCorporationCard(newCorporationCard(CardName.CREDICOR)!, {holdResearchRelease: true});
    const bonus = campaignSetupResumeInput(p1);
    expect((bonus as any)?.startGamePrompt?.kind).eq('campaignBonus');
    expect((bonus as any)?.startGamePrompt?.bonus?.megaCredits).eq(5);

    // Bonus granted, crash: the MERGE press is what's owed.
    p1.campaignBonusGranted = true;
    const merge = campaignSetupResumeInput(p1);
    expect((merge as any)?.startGamePrompt?.kind).eq('corporationMerge');
    expect(cast(merge, SelectCard<ICorporationCard>).cards[0].name).eq(CardName.THORGATE);

    // Merge played but the FEE not yet charged (a reload can land exactly
    // there — the payment is a deferred beat): the recovery re-raises the
    // merge stage, whose press now only completes it (charges the 42 M€).
    p1.playCorporationCard(newCorporationCard(CardName.THORGATE)!, {holdResearchRelease: true});
    const fee = campaignSetupResumeInput(p1);
    expect((fee as any)?.startGamePrompt?.kind).eq('corporationMerge');

    // Fee charged: the LEGACY press is what's owed.
    p1.campaignMergeFeesPaid = 1;
    const legacy = campaignSetupResumeInput(p1);
    expect((legacy as any)?.startGamePrompt?.kind).eq('campaignLegacy');
    expect((legacy as any)?.startGamePrompt?.legacy?.cards).eq(1);

    // Cards granted: the chain is done — nothing left to resume.
    grantCarriedProjectCards(p1);
    expect(campaignSetupResumeInput(p1)).is.undefined;
  });

  it('campaignStartingBudget matches what the deployment actually grants (a fee per ADDITIONAL corp)', () => {
    const {p1} = newMissionGame(missionOptions());
    const picked = newCorporationCard(CardName.THORGATE)!;
    const budget = campaignStartingBudget(p1, picked);
    expect(budget.megaCredits).eq(57 + 5 + 48 - 42);
    expect(budget.cardCost).eq(3);

    // Final mission (3-corp lineage, no pick): TWO additional corps → 2×42.
    const m4 = newMissionGame(missionOptions({final: true}, [CardName.CREDICOR, CardName.THORGATE, CardName.PHOBOLOG]));
    const finalBudget = campaignStartingBudget(m4.p1, undefined);
    expect(finalBudget.megaCredits).eq(57 + 5 + 48 + 23 - 2 * 42);
  });

  it('the merge fee IS the Merger prelude\'s own cost — the common mirror may never drift', () => {
    expect(CAMPAIGN_MERGE_COST).eq(Merger.mergerCost);
  });

  it('final mission: no corporations dealt, the selection has no corp step, «Штаб» plays the whole lineage', () => {
    const lineage = [CardName.CREDICOR, CardName.THORGATE, CardName.PHOBOLOG];
    const options = missionOptions({final: true}, lineage);
    // Both seats hold a full 3-corp lineage by mission 4.
    (options.campaign!.grants[1] as any).corporations = [CardName.HELION, CardName.TERACTOR, CardName.INTERPLANETARY_CINEMATICS];
    const {game, p1, p2} = newMissionGame(options);
    expect(p1.dealtCorporationCards).is.empty;
    // Preludes/projects steps are untouched; the corp step is omitted.
    const selection = new SelectInitialCards(p1, () => undefined);
    expect(selection.inputs.corp).is.undefined;
    expect(selection.inputs.project).is.not.undefined;

    // Complete both selections (no corp pick) through the game's own barrier.
    (game as any).playerHasPickedCorporationCard(p1, undefined);
    (game as any).playerHasPickedCorporationCard(p2, undefined);
    expect(p1.initialCardSelectionDone).is.true;
    // The deployment prompt's subject is the FIRST lineage corporation.
    const waiting = cast(p1.getWaitingFor(), SelectCard<ICorporationCard>);
    expect(waiting.cards[0].name).eq(CardName.CREDICOR);

    // The «Штаб» deployment is the SAME canonical sequence: base press →
    // bonus press → one MERGE press per remaining lineage corp, each charging
    // the Merger-rule fee AGAIN (missions 3–4 pay for corp №3 too).
    runCampaignDeploymentChain(p1, {deferCardPayment: false});
    expect((p1.getWaitingFor() as any).startGamePrompt?.kind).eq('campaignBonus');
    p1.process({type: 'option'});
    expect((p1.getWaitingFor() as any).startGamePrompt?.kind).eq('corporationMerge');
    expect(cast(p1.getWaitingFor(), SelectCard<ICorporationCard>).cards[0].name).eq(CardName.THORGATE);
    p1.process({type: 'card', cards: [CardName.THORGATE]});
    expect((p1.getWaitingFor() as any).startGamePrompt?.kind).eq('corporationMerge');
    expect(cast(p1.getWaitingFor(), SelectCard<ICorporationCard>).cards[0].name).eq(CardName.PHOBOLOG);
    p1.process({type: 'card', cards: [CardName.PHOBOLOG]});

    const corps = p1.playedCards.filter(isICorporationCard).map((c) => c.name);
    expect(corps).deep.eq(lineage);
    // All three starting M€ stacks (D4) + the 5 M€ bonus − TWO merge fees.
    expect(p1.megaCredits).eq(57 + 48 + 23 + 5 - 2 * 42);
    expect(p1.campaignMergeFeesPaid).eq(2);
  });

  it('an ordinary game is untouched: no reservation, no bonus, expected count 1', () => {
    const p1 = new Player('Solo1', 'blue', false, 0, 'p-ord-a');
    const p2 = new Player('Solo2', 'red', false, 0, 'p-ord-b');
    const game = Game.newInstance('g-ordinary', [p1, p2], p1, 's-ord', {corporateEra: true}, 0.42);
    expect(game.gameOptions.campaign).is.undefined;
    expect(expectedCorporationCount(p1)).eq(1);
    const before = p1.megaCredits;
    p1.playCorporationCard(newCorporationCard(CardName.CREDICOR)!);
    expect(p1.megaCredits).eq(before + 57);
    expect(p1.campaignCarriedGranted).is.false;
  });

  it('computeMissionStandings: shared places (competition ranking) via the shared comparator', () => {
    const fakePlayer = (seat: number, total: number, megaCredits: number) => ({
      campaignSeat: seat,
      megaCredits,
      getVictoryPoints: () => ({total}),
      playedCards: {filter: () => []},
    });
    const game = {players: [
      fakePlayer(0, 60, 20),
      fakePlayer(1, 60, 20), // full tie with seat 0
      fakePlayer(2, 60, 10), // same VP, lower M€ — the M€ tie-break decides
      fakePlayer(3, 40, 99),
    ]} as unknown as IGame;
    const standings = computeMissionStandings(game);
    expect(standings.map((s) => [s.seat, s.place])).deep.eq([[0, 1], [1, 1], [2, 3], [3, 4]]);
    expect(standings[0].tiedWith).deep.eq([1]);
    expect(standings[1].tiedWith).deep.eq([0]);
    expect(standings[2].tiedWith).is.empty;
  });
});
