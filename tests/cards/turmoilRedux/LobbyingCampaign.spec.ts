import {expect} from 'chai';
import {LOBBYING_CAMPAIGN_DELEGATES, LOBBYING_CAMPAIGN_PRODUCTION, LOBBYING_CAMPAIGN_STEPS, LobbyingCampaign} from '../../../src/server/cards/turmoilRedux/LobbyingCampaign';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {GameCards} from '../../../src/server/GameCards';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {AGENDA_TRACK_ICON} from '../../../src/server/cards/actionPreviews';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem, isICardRenderProductionBox} from '../../../src/common/cards/render/Types';
import {AgendaWalkModel} from '../../../src/common/models/ActionPreviewModel';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {ReduxParty} from '../../../src/common/parliament/ParliamentTypes';
import {PARLIAMENT_AGENDA_STEPS} from '../../../src/common/parliament/ParliamentTypes';

/**
 * TRP1 — LOBBYING CAMPAIGN: the set's first Prelude. Every rule reading of the
 * card file's header is pinned here; the preview's promise is held to the play.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: LobbyingCampaign};

function table(options: Partial<GameOptions> = {}): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true, ...options});
  game.phase = Phase.PRELUDES;
  const parliament = game.parliament!;
  const card = new LobbyingCampaign();
  p1.preludeCardsInHand.push(card);
  return {game, p1, p2, parliament, card};
}

function options(overrides: Partial<GameOptions> = {}): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, coloniesExtension: true, ...overrides};
}

const ADVANCE = '${0} advances on the Agenda track to step ${1}';
const END_LINE = '${0} is already at the end of the Agenda track';

function walkLines(game: IGame, from: number): Array<string> {
  return game.gameLog.slice(from).map((entry) => entry.message).filter((message) => message === ADVANCE || message === END_LINE);
}

function skips(t: Table) {
  return t.game.events.events.filter((e) => e.type === 'effect-skipped');
}

function emptyReserve(t: Table, keep = 0): void {
  while (t.parliament.reserve(t.p1) > keep) {
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
  }
}

/** Play the Prelude and run the queue up to its question (the grant's `SelectParty`, when it asks). */
function play(t: Table): SelectParty | undefined {
  cast(t.card.play(t.p1), undefined);
  runAllActions(t.game);
  const prompt = t.p1.getWaitingFor();
  return prompt instanceof SelectParty ? prompt : undefined;
}

function previewOf(t: Table) {
  return cardPlayPreview(t.p1, t.card).branches[0];
}

function walkOf(t: Table): AgendaWalkModel {
  const step = previewOf(t).steps.find((s) => s.kind === 'agendaWalk');
  expect(step, 'the walk is a step of the preview').is.not.undefined;
  return (step as {kind: 'agendaWalk', walk: AgendaWalkModel}).walk;
}

describe('LobbyingCampaign', () => {
  describe('the card as printed', () => {
    it('is a PRELUDE with the Mars tag, no VP, TRP1 — printing «+2 M€ production · 2 delegates · 1 Agenda step» in that order', () => {
      const card = new LobbyingCampaign();
      expect(card.type).eq(CardType.PRELUDE);
      expect(card.tags).deep.eq([Tag.MARS]);
      expect(card.cost).eq(0);
      expect(card.victoryPoints).is.undefined;
      expect(card.requirements).deep.eq([]);
      expect(card.metadata.cardNumber).eq('TRP1');
      expect([LOBBYING_CAMPAIGN_PRODUCTION, LOBBYING_CAMPAIGN_DELEGATES, LOBBYING_CAMPAIGN_STEPS]).deep.eq([2, 2, 1]);
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows).has.lengthOf(1);
      const [production, ...rest] = rows[0].filter((node: ItemType) => isICardRenderProductionBox(node) || isICardRenderItem(node));
      expect(isICardRenderProductionBox(production), 'the production plate comes first').is.true;
      const items = rest as Array<ICardRenderItem>;
      expect(items.map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.DELEGATES, 2], [CardRenderItemType.AGENDA_STEP, 1]]);
    });

    it('declares the production and the delegates; the walk is the card\'s own (bespoke) half', () => {
      const card = new LobbyingCampaign();
      expect(card.behavior).deep.eq({production: {megacredits: 2}, turmoil: {sendDelegates: {count: 2}}});
      expect(card.agendaWalkForecast).is.a('function');
    });
  });

  describe('deck wiring — a Prelude of the Redux manifest, dealt only beside the Prelude expansion', () => {
    it('is registered under `preludeCards` with `compatibility: \'prelude\'`', () => {
      expect(TURMOIL_REDUX_CARD_MANIFEST.preludeCards[CardName.LOBBYING_CAMPAIGN]?.compatibility).eq('prelude');
      expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.LOBBYING_CAMPAIGN]).is.undefined;
    });

    it('joins the prelude deck with Redux + Preludes on, and never otherwise (Valley Trust\'s fallback deck stays classic)', () => {
      const names = (o: Partial<GameOptions>) => new GameCards(options(o)).getPreludeCards().map((c) => c.name);
      expect(names({turmoilReduxExpansion: true, preludeExtension: true})).contains(CardName.LOBBYING_CAMPAIGN);
      expect(names({turmoilReduxExpansion: true, preludeExtension: false})).not.contains(CardName.LOBBYING_CAMPAIGN);
      expect(names({turmoilReduxExpansion: false, preludeExtension: true})).not.contains(CardName.LOBBYING_CAMPAIGN);
      expect(new GameCards(options({turmoilReduxExpansion: true, preludeExtension: false})).getPreludeCards()).is.not.empty;
    });
  });

  describe('rule 1 — the printed order: production, the delegates ASK, the walk waits for their answer', () => {
    it('the play raises the vote grant for 2 delegates after +2 M€ production — and the marker has NOT moved yet', () => {
      const t = table();
      const reserve = t.parliament.reserve(t.p1);
      const prompt = play(t);
      expect(t.p1.production.megacredits).eq(2);
      expect(prompt, 'the grant asks').is.not.undefined;
      expect(prompt!.votePrompt).deep.include({source: 'grant', count: 2});
      expect(prompt!.choiceContext?.source).deep.eq({kind: 'card', card: CardName.LOBBYING_CAMPAIGN});
      expect(t.parliament.agendaOf(t.p1), 'the walk waits for the vote').eq(0);
      expect(t.parliament.reserve(t.p1)).eq(reserve);
      expect(t.parliament.lastAdvance).is.undefined;
    });

    it('the answer lands both cubes on the chosen resolution, then the marker walks ONE step — seated on step 1, influence 1', () => {
      const t = table();
      const reserve = t.parliament.reserve(t.p1);
      const logFrom = t.game.gameLog.length;
      play(t);
      const party: ReduxParty = t.parliament.partiesInVotingArea()[1];
      t.p1.process({type: 'party', partyName: party});
      runAllActions(t.game);
      expect(t.parliament.votesOf(t.p1, t.parliament.slotOf(party)!)).eq(2);
      expect(t.parliament.votesOf(t.p1)).eq(2);
      expect(t.parliament.reserve(t.p1)).eq(reserve - 2);
      expect(t.parliament.agendaOf(t.p1)).eq(1);
      expect(t.parliament.influence(t.p1)).eq(1);
      expect(t.parliament.lastAdvance).deep.include({player: t.p1.id, from: 0, to: 1, reason: 'card', card: CardName.LOBBYING_CAMPAIGN});
      expect(walkLines(t.game, logFrom)).deep.eq([ADVANCE]);
      expect(t.p1.getWaitingFor(), 'nothing else is asked').is.undefined;
      expect(skips(t)).is.empty;
    });
  });

  describe('rule 2 — the reserve decides how many can go', () => {
    it('with ONE delegate in the reserve the grant offers that one (printed 2), and the walk still follows', () => {
      const t = table();
      emptyReserve(t, 1);
      const prompt = play(t);
      expect(prompt!.votePrompt).deep.include({source: 'grant', count: 1});
      expect(previewOf(t).steps[0]).deep.eq({kind: 'delegateGrantFollowUp', count: 1, printed: 2});
      const party = t.parliament.partiesInVotingArea()[0];
      t.p1.process({type: 'party', partyName: party});
      runAllActions(t.game);
      expect(t.parliament.reserve(t.p1)).eq(0);
      expect(t.parliament.agendaOf(t.p1)).eq(1);
    });
  });

  describe('rule 3 — an empty reserve is a NAMED skip; the production and the walk still come, in the play\'s own response', () => {
    it('asks nothing, records the skip, walks the marker', () => {
      const t = table();
      emptyReserve(t);
      const logFrom = t.game.gameLog.length;
      const prompt = play(t);
      expect(prompt).is.undefined;
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.p1.production.megacredits).eq(2);
      expect(t.parliament.agendaOf(t.p1)).eq(1);
      expect(walkLines(t.game, logFrom)).deep.eq([ADVANCE]);
      expect(skips(t), 'the lost delegates are named').has.lengthOf(1);
      // The preview says so BEFORE the press: the grant\'s named skip stands where its door would.
      const steps = previewOf(t).steps;
      expect(steps.map((s) => s.kind)).deep.eq(['note', 'agendaWalk']);
    });
  });

  describe('rule 4 — the walk is one step with its bonus, cut honestly by the track\'s end', () => {
    it('from 0 the preview promises 0 → 1 with the influence step', () => {
      const t = table();
      const walk = walkOf(t);
      expect(walk).deep.include({from: 0, to: 1, printed: 1, walked: 1});
      expect(walk.steps.map((s) => s.to)).deep.eq([1]);
    });

    it('from 11 it reaches the end; from 12 it walks none and logs «already at the end» once', () => {
      const atEnd = table();
      atEnd.parliament.agenda.set(atEnd.p1.id, PARLIAMENT_AGENDA_STEPS - 1);
      expect(walkOf(atEnd)).deep.include({from: PARLIAMENT_AGENDA_STEPS - 1, to: PARLIAMENT_AGENDA_STEPS, walked: 1});

      const t = table();
      t.parliament.agenda.set(t.p1.id, PARLIAMENT_AGENDA_STEPS);
      expect(walkOf(t)).deep.include({from: PARLIAMENT_AGENDA_STEPS, to: PARLIAMENT_AGENDA_STEPS, walked: 0});
      const logFrom = t.game.gameLog.length;
      emptyReserve(t);
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(PARLIAMENT_AGENDA_STEPS);
      expect(walkLines(t.game, logFrom)).deep.eq([END_LINE]);
    });
  });

  describe('the preview — the play read before the press, in print order', () => {
    it('chips: the production (the behavior\'s), the Agenda track; steps: the delegates\' follow-up, then the walk', () => {
      const t = table();
      const branch = previewOf(t);
      expect(branch.available).is.true;
      const icons = branch.effects.map((e) => e.icon);
      expect(branch.effects[0], 'the production chip comes first').deep.include({direction: 'gain', amount: 2});
      expect(icons[0]).contains('megacredits');
      expect(icons, 'the track chip').contains(AGENDA_TRACK_ICON);
      expect(branch.effects.find((e) => e.icon === AGENDA_TRACK_ICON)).deep.include({amount: 1, current: 0, resulting: 1});
      expect(branch.steps.map((s) => s.kind)).deep.eq(['delegateGrantFollowUp', 'agendaWalk']);
      expect(branch.steps[0]).deep.eq({kind: 'delegateGrantFollowUp', count: 2, printed: 2});
    });
  });
});
