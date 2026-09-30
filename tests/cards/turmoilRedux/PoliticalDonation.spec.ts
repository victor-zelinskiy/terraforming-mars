import {expect} from 'chai';
import {
  POLITICAL_DONATION_NO_DELEGATE_REASON, POLITICAL_DONATION_NO_RESOLUTION_REASON, POLITICAL_DONATION_SUPPORT, PoliticalDonation,
} from '../../../src/server/cards/turmoilRedux/PoliticalDonation';
import {PoliticalScience} from '../../../src/server/cards/turmoilRedux/PoliticalScience';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {Server} from '../../../src/server/models/ServerModel';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {
  DELEGATE_ICON, NEUTRAL_DELEGATE_ICON, PARTY_EFFECT_DELEGATES, POPULAR_SUPPORT_LABEL, SUPPORT_LIMIT_REASON,
} from '../../../src/common/parliament/ParliamentTypes';
import {SelectPartyModel} from '../../../src/common/models/PlayerInputModel';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {Payment} from '../../../src/common/inputs/Payment';
import {cast} from '../../../src/common/utils/utils';
import {answerQuestGate, endGenerationThroughParliament, quietResolutionOf, seatQuiet, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';
import {recomputeRootImpact} from '../../../src/client/components/notifications/notificationModel';

/**
 * TR03 — POLITICAL DONATION: the first card of the set that PLACES A DELEGATE
 * by being played (the vote's third door — on the shared step, never a prompt
 * of its own) and the first card effect on POPULAR SUPPORT. Every rule reading
 * of the card file's header is pinned here.
 */
const G = PartyName.GREENS;
const M = PartyName.MARS;
const I = PartyName.INDUSTRIALISTS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: PoliticalDonation};

/** A two-seat Redux table with three QUIET real resolutions (Greens · Mars First · Industrialists) and the card in p1's hand. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, M, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  const card = new PoliticalDonation();
  p1.cardsInHand.push(card);
  p1.megaCredits = 20;
  return {game, p1, p2, parliament, card};
}

/** Leave exactly `n` neutral delegates in the common supply (the rest stand as neutral votes on slot 2). */
function drainNeutralSupply(parliament: Parliament, n: number): void {
  while (parliament.neutralSupply() > n) {
    parliament.slots[2].votes.push({owner: 'NEUTRAL', seq: ++parliament.voteSeq});
  }
}

/** Play the card for real and stop at its question. */
function playToPrompt(t: Table): SelectParty {
  t.p1.playCard(t.card);
  runAllActions(t.game);
  return cast(t.p1.getWaitingFor(), SelectParty);
}

function skipsOf(game: IGame) {
  return game.events.events.filter((e) => e.type === 'effect-skipped');
}

function grantStepOf(t: Table): Extract<ActionPreviewStep, {kind: 'delegateGrant'}> {
  const steps = cardPlayPreview(t.p1, t.card).branches[0].steps;
  const step = steps.find((s) => s.kind === 'delegateGrant');
  if (step === undefined || step.kind !== 'delegateGrant') {
    throw new Error('the play preview carries no delegateGrant step');
  }
  return step;
}

describe('PoliticalDonation', () => {
  it('registers with source-backed metadata (the scan: 4 · Mars · green · no requirement · no VP)', () => {
    const card = new PoliticalDonation();
    expect(card.name).eq(CardName.POLITICAL_DONATION);
    expect(card.type).eq(CardType.AUTOMATED);
    expect(card.cost).eq(4);
    expect(card.tags).deep.eq([Tag.MARS]);
    expect(card.metadata.cardNumber).eq('TR03');
    expect(card.requirements, 'the MIN box is empty').deep.eq([]);
    expect(card.victoryPoints, 'no VP badge').is.undefined;
    expect(card.resourceType).is.undefined;
    expect(POLITICAL_DONATION_SUPPORT).eq(3);
    // The graphic, row in row: the player's delegate · three NEUTRAL delegates · the «?» pill · the asterisk.
    const row = (card.metadata.renderData as unknown as {rows: Array<Array<{type?: string, amount?: number, text?: string}>>}).rows[0];
    const items = row.filter((node) => node.type !== undefined && node.type !== CardRenderItemType.NBSP);
    expect(items.map((node) => node.type).slice(0, 3)).deep.eq([CardRenderItemType.DELEGATES, CardRenderItemType.NEUTRAL_DELEGATE, CardRenderItemType.PLATE]);
    expect(items[0].amount).eq(1);
    expect(items[1].amount).eq(3);
    expect(items[2].text).eq('?');
    // Two info blocks in the order of execution, and no sequencing connective.
    const info = card.metadata.infoText!.map((entry) => entry.text);
    expect(info).has.length(2);
    expect(info.join(' ')).not.match(/\bthen\b/i);
  });

  describe('rule 2 — unplayable: ONE named blocker at a time, the voting area first', () => {
    it('no resolution up for a vote', () => {
      const t = table();
      t.parliament.slots = [];
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'party', message: POLITICAL_DONATION_NO_RESOLUTION_REASON}]);
      expect(POLITICAL_DONATION_NO_RESOLUTION_REASON).eq('No resolution is up for a vote');
    });

    it('an empty RESERVE — a cube standing in the lobby does not lift it, and the reason is about the reserve', () => {
      const t = table();
      while (t.parliament.reserve(t.p1) > 0) {
        t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      }
      expect(t.parliament.lobby.has(t.p1.id), 'the free delegate still stands in the lobby').is.true;
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'party', message: POLITICAL_DONATION_NO_DELEGATE_REASON, current: 0}]);
      expect(POLITICAL_DONATION_NO_DELEGATE_REASON).eq('No delegate in your reserve');
    });

    it('both at once: the voting area is named, never an «X or Y»', () => {
      const t = table();
      while (t.parliament.reserve(t.p1) > 0) {
        t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      }
      t.parliament.slots = [];
      expect(unplayableReasons(t.p1, t.card).map((r) => r.message)).deep.eq([POLITICAL_DONATION_NO_RESOLUTION_REASON]);
    });

    it('one delegate in the reserve is enough — and the money is the ordinary gate', () => {
      const t = table();
      while (t.parliament.reserve(t.p1) > 1) {
        t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      }
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
      t.p1.megaCredits = 3;
      expect(t.p1.canPlay(t.card)).is.false;
    });

    it('outside Turmoil Redux the card is never dealt — and `canPlay` answers false without throwing', () => {
      const [, plain] = testGame(2);
      const classic = testGame(2, {turmoilExtension: true})[1];
      for (const player of [plain, classic]) {
        const card = new PoliticalDonation();
        player.megaCredits = 20;
        player.cardsInHand.push(card);
        expect(player.canPlay(card)).is.false;
        expect(unplayableReasons(player, card).map((r) => r.message)).deep.eq([POLITICAL_DONATION_NO_RESOLUTION_REASON]);
        expect(() => cardPlayPreview(player, card)).not.to.throw();
        expect(cardPlayPreview(player, card).branches[0].steps, 'no door without a parliament').deep.eq([]);
      }
    });
  });

  describe('the play — rules 1, 3, 4, 5', () => {
    it('asks WHICH resolution through the shared grant (the giver is the card), even when one would do', () => {
      const t = table();
      t.parliament.slots = [t.parliament.slots[0]];
      const select = playToPrompt(t);
      expect(select.parties, 'a single candidate is still SHOWN').deep.eq([G]);
      expect(select.votePrompt?.source).eq('grant');
      expect(select.votePrompt?.count).eq(1);
      expect(select.votePrompt?.printed).eq(1);
      expect(select.choiceContext).deep.eq({source: {kind: 'card', card: CardName.POLITICAL_DONATION}, mode: 'reward'});
      expect(t.p1.playedCards.get(CardName.POLITICAL_DONATION), 'the card is on the table while its question stands').is.not.undefined;
    });

    it('the delegate leaves the RESERVE for the chosen resolution, the lobby is untouched, and the party takes 3 neutral delegates', () => {
      const t = table();
      const {game, p1, parliament} = t;
      const reserve = parliament.reserve(p1);
      const supply = parliament.neutralSupply();
      const neutralOnCard = parliament.neutralVotes(parliament.slots[1]);
      playToPrompt(t);
      p1.process({type: 'party', partyName: M});
      runAllActions(game);

      expect(parliament.votesOf(p1, parliament.slots[1])).eq(1);
      expect(parliament.reserve(p1)).eq(reserve - 1);
      expect(parliament.lobby.has(p1.id), 'rule 1: the lobby\'s cube is not the card\'s to spend').is.true;
      expect(parliament.popularSupportOf(M)).eq(3);
      expect(parliament.popularSupportOf(G), 'rule 3: only the chosen resolution\'s party').eq(0);
      expect(parliament.popularSupportOf(I)).eq(0);
      expect(parliament.neutralSupply()).eq(supply - 3);
      expect(parliament.neutralVotes(parliament.slots[1]), 'rule 5: support lies in the area, never on the card voted for').eq(neutralOnCard);
      expect(p1.totalDelegatesPlaced).eq(1);
      parliament.assertLedger(game);

      const lines = game.gameLog.map((m) => m.message);
      const delegate = lines.lastIndexOf('${0} added ${1} delegate(s) from the reserve to ${2}');
      const support = lines.lastIndexOf('${0} gain ${1} neutral delegate(s) in Popular Support (${2}/${3})');
      expect(delegate).gte(0);
      expect(support, '«then»').gt(delegate);
      expect(skipsOf(game)).deep.eq([]);
    });

    it('rule 4 — the area cuts it: 2 → 3, one lands, nothing is skipped', () => {
      const t = table();
      t.parliament.popularSupport.set(M, 2);
      const select = playToPrompt(t);
      expect(select.votePrompt?.support?.find((row) => row.party === M)).deep.eq({party: M, current: 2, gained: 1, resulting: 3, printed: 3, limit: 'area'});
      t.p1.process({type: 'party', partyName: M});
      expect(t.parliament.popularSupportOf(M)).eq(3);
      expect(skipsOf(t.game)).deep.eq([]);
    });

    it('rule 4 — the supply cuts it: two left, two land', () => {
      const t = table();
      drainNeutralSupply(t.parliament, 2);
      const select = playToPrompt(t);
      expect(select.votePrompt?.support?.find((row) => row.party === G)).deep.eq({party: G, current: 0, gained: 2, resulting: 2, printed: 3, limit: 'supply'});
      t.p1.process({type: 'party', partyName: G});
      expect(t.parliament.popularSupportOf(G)).eq(2);
      expect(t.parliament.neutralSupply()).eq(0);
    });

    for (const scenario of [
      {name: 'a full area', limit: 'area' as const, arrange: (p: Parliament) => p.popularSupport.set(G, 3)},
      {name: 'an empty supply', limit: 'supply' as const, arrange: (p: Parliament) => drainNeutralSupply(p, 0)},
    ]) {
      it(`rule 4 — ${scenario.name}: the card is still played, the delegate lands, and the lost support is a NAMED record under the card`, () => {
        const t = table();
        const {game, p1, parliament, card} = t;
        scenario.arrange(parliament);
        expect(p1.canPlay(card), 'a lost second effect never blocks the play').is.true;
        const select = playToPrompt(t);
        expect(select.votePrompt?.support?.find((row) => row.party === G)).deep.include({gained: 0, printed: 3, limit: scenario.limit});
        p1.process({type: 'party', partyName: G});
        runAllActions(game);
        expect(parliament.votesOf(p1, parliament.slots[0])).eq(1);
        const skips = skipsOf(game);
        expect(skips.map((e) => e.impact.skipped)).deep.eq([{
          label: POPULAR_SUPPORT_LABEL,
          reason: SUPPORT_LIMIT_REASON[scenario.limit],
          effect: {direction: 'gain', icon: NEUTRAL_DELEGATE_ICON, amount: POLITICAL_DONATION_SUPPORT},
        }]);
        expect(skips[0].player).eq(p1.color);
        expect(skips[0].visibility).eq('journal');
        const root = game.events.events.find((r) => r.id === skips[0].correlationId);
        expect(root?.source, 'the skip joins the play\'s own chain').deep.include({card: CardName.POLITICAL_DONATION});
      });
    }

    it('the player never picks the number: the only question is the resolution', () => {
      const t = table();
      playToPrompt(t);
      t.p1.process({type: 'party', partyName: G});
      runAllActions(t.game);
      expect(t.p1.getWaitingFor(), 'no amount, no second party').is.undefined;
    });

    it('a party the prompt does not offer is refused and nothing is placed', () => {
      const t = table();
      playToPrompt(t);
      expect(() => t.p1.process({type: 'party', partyName: PartyName.UNITY})).to.throw();
      expect(t.parliament.votesOf(t.p1)).eq(0);
    });
  });

  /*
   * RULE 5 ACROSS THE SITTINGS — the one way a party RULING BY AN ENACTED CARD holds popular support.
   * The sitting alone never pays the ruler (`ParliamentPhase.spec.ts` § ПРАВИТЕЛЬ БЕЗ ПОДДЕРЖКИ), but this card
   * pays the party of a resolution that is IN the area, and that resolution may win. Nothing takes a stock
   * but the deal of the party's next card (`moveSupportToSlot`), and the enacted party's card is never dealt —
   * so the stock rides into the government and waits there. The console's ruler plaque DRAWS it
   * (`ConsolePartyPlaque` § the ruler's sockets): a hidden stock would be three cubes gone from the supply
   * with nowhere to see them.
   */
  describe('rule 5 across the sittings — the stock rides into the government and votes on the party\'s next card', () => {
    it('the voted resolution wins: its party rules WITH the stock, gains nothing while it rules, and the stock votes on its next card', () => {
      const t = table();
      const {game, p1, parliament} = t;
      playToPrompt(t);
      p1.process({type: 'party', partyName: M});
      runAllActions(game);
      expect(parliament.popularSupportOf(M)).eq(3);

      // Generation 1: p1's delegate is the only vote — the voted card wins and its party comes to power.
      endGenerationThroughParliament(game);
      expect(parliament.rulingParty()).eq(M);
      expect(parliament.lastPhase!.support.map((entry) => entry.party), 'the sitting paid the winner nothing').not.includes(M);
      expect(parliament.popularSupportOf(M), 'the card\'s stock rode into the government — nothing took it').eq(3);
      expect(parliament.partiesInVotingArea(), 'the ruler\'s card is never dealt, so the stock waits').not.includes(M);
      parliament.assertLedger(game);

      // Generation 2: another party wins; a Mars First card waits on top of the deck for the refresh.
      game.phase = Phase.ACTION;
      for (let i = 0; i < parliament.slots.length; i++) {
        seatQuiet(parliament, i);
      }
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.addNeutralVote(parliament.slots[0]);
      const next = [...parliament.deck, ...parliament.discard].find((instance) => parliament.resolutionOf(instance).party === M);
      expect(next, 'the pool holds another Mars First card').is.not.undefined;
      parliament.deck = parliament.deck.filter((i) => i !== next);
      parliament.discard = parliament.discard.filter((i) => i !== next);
      parliament.deck.unshift(next!);
      endGenerationThroughParliament(game);

      const summary = parliament.lastPhase!;
      expect(parliament.rulingParty(), 'the government changed hands').not.eq(M);
      expect(summary.support.map((entry) => entry.party), 'still ENACTED at the support step: no «absent» cube on a full stock').not.includes(M);
      const dealt = parliament.slots.find((slot) => slot.instance === next);
      expect(dealt, 'the refresh dealt the party\'s next card').is.not.undefined;
      expect(parliament.neutralVotes(dealt), 'the stock became three votes on it').eq(3);
      expect(parliament.popularSupportOf(M)).eq(0);
      expect(summary.refreshed.find((entry) => entry.instance === next)?.neutralVotes).eq(3);
      parliament.assertLedger(game);
    });
  });

  describe('rule 6 — the card\'s delegate is an ORDINARY delegate', () => {
    it('a second delegate on one resolution opens the party\'s effect', () => {
      const t = table();
      const {p1, parliament} = t;
      // Mars First does not rule at this table (the empty government is the Greens' by the starting rule).
      parliament.placeVote(p1, parliament.slots[1], 'reserve');
      expect(parliament.access(p1, M).hasEffect).is.false;
      playToPrompt(t);
      p1.process({type: 'party', partyName: M});
      expect(parliament.votesOf(p1, parliament.slots[1])).eq(PARTY_EFFECT_DELEGATES);
      expect(parliament.access(p1, M).hasEffect).is.true;
    });

    it('TR02\'s «3 delegates on resolutions» sees it', () => {
      const t = table();
      const {p1, parliament} = t;
      const science = new PoliticalScience();
      p1.cardsInHand.push(science);
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.placeVote(p1, parliament.slots[1], 'reserve');
      expect(p1.canPlay(science)).is.false;
      playToPrompt(t);
      p1.process({type: 'party', partyName: I});
      expect(p1.canPlay(science)).is.true;
    });

    it('a chairman quest of «send N delegates» counts it — and the quest\'s gate stands AFTER the card\'s question (rule 7)', () => {
      const t = table();
      const {game, p1, parliament} = t;
      parliament.quest = {definition: {goal: {kind: 'delegates'}, count: 1}, source: 'spec', generation: game.generation, progress: new Map()};
      p1.takeAction();
      p1.cardsInHand = [t.card];
      const menu = p1.getWaitingFor()!;
      const play = (menu as unknown as {options: Array<{title: string | {message: string}}>}).options.findIndex((o) => o.title === 'Play project card');
      p1.process({type: 'or', index: play, response: {type: 'projectCard', card: t.card.name, payment: Payment.of({megacredits: 4})}});
      expect(p1.megaCredits, 'the play costs 4 M€ — the delegate itself is free').eq(16);
      // The card's own question first…
      const select = cast(p1.getWaitingFor(), SelectParty);
      expect(select.choiceContext?.source.card).eq(CardName.POLITICAL_DONATION);
      expect(parliament.quest.completedBy, 'not before the delegate lands').is.undefined;
      p1.process({type: 'party', partyName: G});
      expect(parliament.questProgressOf(p1)).eq(1);
      expect(parliament.quest.completedBy).eq(p1.id);
      // …and only then the chairmanship's gate.
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
    });
  });

  describe('the play preview — the DOOR and its read-only twin', () => {
    it('one branch: the delegate leaving the reserve (the only target-independent number) and the `delegateGrant` door', () => {
      const t = table();
      const reserve = t.parliament.reserve(t.p1);
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      expect(branch.available).is.true;
      expect(branch.effects).deep.eq([{direction: 'cost', icon: DELEGATE_ICON, amount: 1, current: reserve, resulting: reserve - 1, note: 'from the reserve'}]);
      expect(branch.effects.some((e) => e.icon === NEUTRAL_DELEGATE_ICON), 'the support depends on the target: never guessed before one exists').is.false;
      expect(branch.steps.map((s) => s.kind)).deep.eq(['delegateGrant']);
      expect(grantStepOf(t).staged.sourceCard).eq(CardName.POLITICAL_DONATION);
    });

    it('the staged prompt IS the live prompt: title, button, parties, the marker with its support projection, the giver', () => {
      const t = table();
      t.parliament.popularSupport.set(M, 2);
      t.parliament.popularSupport.set(I, 3);
      const staged = grantStepOf(t).staged.prompt;
      playToPrompt(t);
      const live = Server.getPlayerModel(t.p1).waitingFor as SelectPartyModel;
      expect(staged.type).eq('party');
      expect(staged.title).deep.eq(live.title);
      expect(staged.buttonLabel).eq(live.buttonLabel);
      expect(staged.parties).deep.eq(live.parties);
      expect(staged.votePrompt).deep.eq(live.votePrompt);
      expect(staged.choiceContext).deep.eq(live.choiceContext);
      expect(staged.votePrompt?.support).deep.eq([
        {party: G, current: 0, gained: 3, resulting: 3, printed: 3},
        {party: M, current: 2, gained: 1, resulting: 3, printed: 3, limit: 'area'},
        {party: I, current: 3, gained: 0, resulting: 3, printed: 3, limit: 'area'},
      ]);
    });

    it('building the preview changes nothing: no event, no journal line, no prompt, the same save', () => {
      const t = table();
      const before = JSON.stringify(t.game.serialize());
      const events = t.game.events.events.length;
      const logs = t.game.gameLog.length;
      cardPlayPreview(t.p1, t.card);
      cardPlayPreview(t.p1, t.card);
      expect(t.game.events.events.length).eq(events);
      expect(t.game.gameLog.length).eq(logs);
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  describe('what the TABLE is told — the journal row and a rival\'s notification', () => {
    /** Play through the real action menu (the play's own scope), answer the question. */
    function playFor(t: Table, party: PartyName): number {
      t.p1.takeAction();
      const menu = t.p1.getWaitingFor() as unknown as {options: Array<{title: string | {message: string}}>};
      const play = menu.options.findIndex((o) => o.title === 'Play project card');
      t.p1.process({type: 'or', index: play, response: {type: 'projectCard', card: t.card.name, payment: Payment.of({megacredits: 4})}});
      t.p1.process({type: 'party', partyName: party});
      runAllActions(t.game);
      const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.POLITICAL_DONATION);
      return root!.id;
    }

    it('two typed facts join the play\'s chain under the CARD: the delegate with its resolution, the support with its party', () => {
      const t = table();
      const root = playFor(t, M);
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      const resolution = t.parliament.resolutionOf(t.parliament.slots[1].instance).id;
      const placed = chain.find((e) => e.type === 'delegates-placed')!;
      const support = chain.find((e) => e.type === 'popular-support-gained')!;
      expect(placed.impact.delegates).deep.eq({count: 1, resolution});
      expect(support.impact.popularSupport).deep.eq({party: M, gained: 3, total: 3});
      for (const e of [placed, support]) {
        expect(e.player).eq(t.p1.color);
        expect(e.visibility).eq('journal');
        expect(e.source).deep.include({kind: 'card', card: CardName.POLITICAL_DONATION});
      }
      expect(chain.indexOf(support), '«then»').gt(chain.indexOf(placed));
    });

    it('the journal draws them as rows of the card: «[delegate] +1 · <resolution>», «[neutral] +3 · Popular support · <party> · 3/3»', () => {
      const t = table();
      const root = playFor(t, M);
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      const rows = buildEventChildren(chain, root, t.p1.color);
      const resolution = t.parliament.resolutionOf(t.parliament.slots[1].instance).id;
      const own = rows.filter((row) => row.source.kind === 'card' && row.source.card === CardName.POLITICAL_DONATION);
      expect(own.map((row) => ({chips: row.chips, political: row.political}))).deep.eq([
        {chips: [{icon: DELEGATE_ICON, text: '+1'}], political: {kind: 'resolution', resolution}},
        {chips: [{icon: NEUTRAL_DELEGATE_ICON, text: '+3'}], political: {kind: 'support', party: M, total: 3}},
      ]);
      // …and the payment reads LAST, as for any play.
      expect(rows[rows.length - 1].bucket).eq('payment');
    });

    it('a rival\'s notification carries both as the actor\'s pills — never a bare «played a card · −4 M€»', () => {
      const t = table();
      const root = playFor(t, M);
      const impact = recomputeRootImpact(t.game.events.events, root, t.p1.color, t.p2.color);
      const actor = impact.pillGroups.find((group) => group.scope === 'actor');
      expect(actor?.chips.map((chip) => `${chip.icon} ${chip.text}`)).to.include.members([`${DELEGATE_ICON} +1`, `${NEUTRAL_DELEGATE_ICON} +3`]);
      expect(impact.skipped).deep.eq([]);
    });

    it('a support that took nothing is the «Skipped» line beside the delegate\'s row', () => {
      const t = table();
      t.parliament.popularSupport.set(M, 3);
      const root = playFor(t, M);
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      const rows = buildEventChildren(chain, root, t.p1.color);
      expect(rows.some((row) => row.political?.kind === 'resolution'), 'the delegate is told').is.true;
      expect(rows.some((row) => row.political?.kind === 'support'), 'no support landed — no support row').is.false;
      const skipped = rows.find((row) => row.bucket === 'skipped');
      expect(skipped?.skipped).deep.eq({label: POPULAR_SUPPORT_LABEL, reason: SUPPORT_LIMIT_REASON.area, chip: {icon: NEUTRAL_DELEGATE_ICON, text: '+3'}});
      expect(recomputeRootImpact(t.game.events.events, root, t.p1.color, t.p2.color).skipped).has.length(1);
    });
  });

  it('save / load: the played card, its delegate and the party\'s support survive', () => {
    const t = table();
    playToPrompt(t);
    t.p1.process({type: 'party', partyName: M});
    runAllActions(t.game);
    const live = Game.deserialize(structuredClone(t.game.serialize()));
    const again = live.getPlayerById(t.p1.id);
    const parliament = live.parliament!;
    expect(again.playedCards.get(CardName.POLITICAL_DONATION)).is.not.undefined;
    expect(parliament.votesOf(again, parliament.slots[1])).eq(1);
    expect(parliament.popularSupportOf(M)).eq(3);
    parliament.assertLedger(live);
  });
});
