import {expect} from 'chai';
import {UNITY_CAMPAIGN_TITANIUM, UnityCampaign} from '../../../src/server/cards/turmoilRedux/UnityCampaign';
import {CAMPAIGN_SUPPORT, CAMPAIGN_SUPPORT_PRINT, PopularSupportCampaign} from '../../../src/server/cards/turmoilRedux/PopularSupportCampaign';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {GameCards} from '../../../src/server/GameCards';
import {Game} from '../../../src/server/Game';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {NeutralRallyModel} from '../../../src/common/models/ActionPreviewModel';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {PARLIAMENT_NEUTRAL_DELEGATES, REDUX_PARTIES} from '../../../src/common/parliament/ParliamentTypes';
import {Luna} from '../../../src/server/colonies/Luna';
import {Triton} from '../../../src/server/colonies/Triton';
import {VenusRedux} from '../../../src/server/colonies/VenusRedux';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {endGenerationThroughParliament, quietResolutionOf, quietWinnerIndex, seatQuiet, seatResolution} from '../../parliament/parliamentArrange';

/**
 * TRP2 — UNITY CAMPAIGN: the first of the six Prelude campaigns. Every rule reading of the card file's header (and of
 * `PopularSupportCampaign`'s) is pinned here; the preview's promise is held to the play.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: UnityCampaign};

function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
  game.phase = Phase.PRELUDES;
  // Two tiles whose build bonus asks nothing (Luna: +2 M€ production, Triton: +3 titanium) — the deal is random.
  game.colonies = [new Luna(), new Triton()];
  const parliament = game.parliament!;
  const card = new UnityCampaign();
  p1.preludeCardsInHand.push(card);
  return {game, p1, p2, parliament, card};
}

function options(overrides: Partial<GameOptions> = {}): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, coloniesExtension: true, ...overrides};
}

function skips(t: Table) {
  return t.game.events.events.filter((e) => e.type === 'effect-skipped');
}

/** Play the Prelude and run the queue up to its question (the colony pick, when it asks). */
function play(t: Table): SelectColony | undefined {
  cast(t.card.play(t.p1), undefined);
  runAllActions(t.game);
  const prompt = t.p1.getWaitingFor();
  return prompt instanceof SelectColony ? prompt : undefined;
}

/** Answer the colony pick on `name` and run the queue on. */
function build(t: Table, prompt: SelectColony, name: ColonyName): void {
  const colony = prompt.colonies.find((c) => c.name === name);
  expect(colony, `${name} is offered`).is.not.undefined;
  t.p1.popWaitingFor();
  prompt.cb(colony!);
  runAllActions(t.game);
}

function previewOf(t: Table) {
  return cardPlayPreview(t.p1, t.card).branches[0];
}

function rallyOf(t: Table): NeutralRallyModel {
  const step = previewOf(t).steps.find((s) => s.kind === 'neutralRally');
  expect(step, 'the support is a SHOW step of the preview').is.not.undefined;
  return (step as {kind: 'neutralRally', rally: NeutralRallyModel}).rally;
}

describe('UnityCampaign', () => {
  describe('the card as printed', () => {
    it('is a PRELUDE with the Jovian tag, no VP, TRP2 — printing «3 titanium · a colony · 3 neutral delegates [Unity]» in that order', () => {
      const card = new UnityCampaign();
      expect(card.type).eq(CardType.PRELUDE);
      expect(card.tags).deep.eq([Tag.JOVIAN]);
      expect(card.cost).eq(0);
      expect(card.victoryPoints).is.undefined;
      expect(card.requirements).deep.eq([]);
      expect(card.metadata.cardNumber).eq('TRP2');
      expect(card).instanceOf(PopularSupportCampaign);
      expect(card.campaignParty).eq(PartyName.UNITY);
      expect(card.behavior).deep.eq({stock: {titanium: UNITY_CAMPAIGN_TITANIUM}, colonies: {buildColony: {}}});
      expect([UNITY_CAMPAIGN_TITANIUM, CAMPAIGN_SUPPORT]).deep.eq([3, 3]);
      expect(CAMPAIGN_SUPPORT_PRINT).deep.eq({perResolution: 0, perArea: 3, recount: false});
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows).has.lengthOf(1);
      const items = rows[0].filter(isICardRenderItem) as Array<ICardRenderItem>;
      expect(items.map((i) => i.type)).deep.eq([
        CardRenderItemType.TITANIUM, CardRenderItemType.COLONIES, CardRenderItemType.NEUTRAL_DELEGATE, CardRenderItemType.PARTY_SEAL,
      ]);
      expect(items[0].amount).eq(3);
      expect(items[2].amount).eq(3);
      expect(items[3].party).eq(PartyName.UNITY);
    });
  });

  describe('deck wiring — a Prelude of the Redux manifest, dealt only beside the Prelude expansion', () => {
    it('is registered under `preludeCards` with the Prelude and Colonies marks', () => {
      expect(TURMOIL_REDUX_CARD_MANIFEST.preludeCards[CardName.UNITY_CAMPAIGN]?.compatibility).deep.eq(['prelude', 'colonies']);
      expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.UNITY_CAMPAIGN]).is.undefined;
    });

    it('joins the prelude deck with Redux + Preludes on, and never otherwise', () => {
      const names = (o: Partial<GameOptions>) => new GameCards(options(o)).getPreludeCards().map((c) => c.name);
      expect(names({turmoilReduxExpansion: true, preludeExtension: true})).contains(CardName.UNITY_CAMPAIGN);
      expect(names({turmoilReduxExpansion: true, preludeExtension: false})).not.contains(CardName.UNITY_CAMPAIGN);
      expect(names({turmoilReduxExpansion: false, preludeExtension: true})).not.contains(CardName.UNITY_CAMPAIGN);
    });
  });

  describe('the printed order: titanium, the colony ASKS, the support waits for its answer', () => {
    it('the play gains 3 titanium and raises the colony pick — and Unity\'s area is still empty', () => {
      const t = table();
      const prompt = play(t);
      expect(t.p1.titanium).eq(3);
      expect(prompt, 'the colony asks').is.not.undefined;
      expect(t.parliament.popularSupportOf(PartyName.UNITY), 'the support waits for the colony').eq(0);
      expect(t.parliament.lastRally).is.undefined;
    });

    it('the answer builds the colony, then the three neutrals land in Unity\'s area — one record, no recount, no M€', () => {
      const t = table();
      const megacredits = t.p1.megaCredits;
      const prompt = play(t)!;
      build(t, prompt, ColonyName.LUNA);
      expect(t.game.colonies[0].colonies).deep.eq([t.p1.id]);
      expect(t.parliament.popularSupportOf(PartyName.UNITY)).eq(3);
      for (const party of REDUX_PARTIES.filter((p) => p !== PartyName.UNITY)) {
        expect(t.parliament.popularSupportOf(party), `${party}'s area`).eq(0);
      }
      const record = t.parliament.lastRally!;
      expect(record).deep.include({player: t.p1.id, card: CardName.UNITY_CAMPAIGN, recount: false, megacredits: 0});
      expect(record.votes).deep.eq([]);
      expect(record.missing).deep.eq([]);
      expect(record.support).deep.eq([{party: PartyName.UNITY, current: 0, gained: 3, resulting: 3, printed: 3}]);
      expect(record.inUse).deep.eq({before: 0, after: 3});
      expect(t.p1.megaCredits, 'a campaign pays no recount').eq(megacredits);
      expect(t.parliament.neutralSupply()).eq(PARLIAMENT_NEUTRAL_DELEGATES - 3);
      expect(t.p1.getWaitingFor(), 'nothing else is asked').is.undefined;
      expect(skips(t)).is.empty;
      t.parliament.assertLedger(t.game);
    });

    it('a colony bonus that ASKS (the Redux Venus — 2 delegates to a resolution) is answered before the support lands', () => {
      const t = table();
      t.game.colonies = [new VenusRedux()];
      const prompt = play(t)!;
      build(t, prompt, ColonyName.VENUS_REDUX);
      const vote = t.p1.getWaitingFor();
      expect(vote, 'the Venus placement bonus asks for a resolution').instanceOf(SelectParty);
      expect(t.parliament.popularSupportOf(PartyName.UNITY), 'the support stands behind the bonus').eq(0);
      t.p1.process({type: 'party', partyName: t.parliament.partiesInVotingArea()[0]});
      runAllActions(t.game);
      expect(t.parliament.popularSupportOf(PartyName.UNITY)).eq(3);
    });

    it('no tile takes the colony: the Prelude cannot be played (it burns — Early Colonization\'s law); nothing is half-paid', () => {
      const t = table();
      t.game.colonies = [];
      expect(t.card.canPlay(t.p1)).is.false;
      t.game.colonies = [new Luna()];
      expect(t.card.canPlay(t.p1)).is.true;
    });
  });

  describe('rule 1 — Unity\'s resolution up for a vote takes NONE of the three: they WAIT in the area', () => {
    it('with Unity\'s card in the voting area the cubes go to the area; the card\'s votes do not move', () => {
      const t = table();
      seatResolution(t.parliament, 0, quietResolutionOf(PartyName.UNITY));
      const unity = t.parliament.slotOf(PartyName.UNITY)!;
      const votesBefore = unity.votes.length;
      const prompt = play(t)!;
      build(t, prompt, ColonyName.LUNA);
      expect(unity.votes.length, 'no vote on the standing card').eq(votesBefore);
      expect(t.parliament.neutralVotes(unity)).eq(0);
      expect(t.parliament.popularSupportOf(PartyName.UNITY)).eq(3);
      expect(t.parliament.lastRally!.votes).deep.eq([]);
    });

    it('…and they become votes only on a Unity card the REFRESH deals — never on the standing one, whatever the sitting decides', () => {
      const t = table();
      const winner = quietWinnerIndex(t.parliament);
      seatQuiet(t.parliament, winner);
      if (t.parliament.resolutionOf(t.parliament.slots[winner].instance).party === PartyName.UNITY) {
        // Unity's own quiet card sits on the winning slot: the standing Unity card is the one that wins.
        t.parliament.placeVote(t.p2, t.parliament.slots[winner], 'lobby');
      } else {
        seatResolution(t.parliament, (winner + 1) % t.parliament.slots.length, quietResolutionOf(PartyName.UNITY));
        t.parliament.placeVote(t.p2, t.parliament.slots[winner], 'lobby');
      }
      for (let i = 0; i < t.parliament.slots.length; i++) {
        if (i !== winner) {
          seatQuiet(t.parliament, i);
        }
      }
      const standing = t.parliament.slotOf(PartyName.UNITY)!.instance;
      const prompt = play(t)!;
      build(t, prompt, ColonyName.LUNA);
      expect(t.parliament.popularSupportOf(PartyName.UNITY)).eq(3);
      t.game.phase = Phase.ACTION;
      for (const player of [t.p1, t.p2]) {
        player.preludeCardsInHand = [];
      }

      endGenerationThroughParliament(t.game);

      const dealt = t.parliament.slotOf(PartyName.UNITY);
      if (t.parliament.rulingParty() === PartyName.UNITY) {
        // Unity's card won: the area keeps its three for Unity's NEXT card (the ruler's party is never dealt).
        expect(t.parliament.enacted).eq(standing);
        expect(dealt).is.undefined;
        expect(t.parliament.popularSupportOf(PartyName.UNITY)).eq(3);
      } else if (dealt !== undefined) {
        // A fresh Unity card came into the area: the area moved onto it as votes (the sitting's +1 / +2 was
        // discarded — the area already held its three).
        expect(dealt.instance).not.eq(standing);
        expect(t.parliament.neutralVotes(dealt)).eq(3);
        expect(t.parliament.popularSupportOf(PartyName.UNITY)).eq(0);
      } else {
        // No Unity card was dealt: the three still wait (and the sitting's own neutral for Unity was the excess).
        expect(t.parliament.popularSupportOf(PartyName.UNITY)).eq(3);
      }
    });
  });

  describe('rule 2 — the area holds three: as many land as the area and the supply take, a cut is NAMED', () => {
    it('an area at 2 takes ONE — the forecast names the ceiling; a partial landing is no skip (the shared payout\'s law, TR03)', () => {
      const t = table();
      t.parliament.addPopularSupport(PartyName.UNITY, 2);
      expect(rallyOf(t).support).deep.eq([{party: PartyName.UNITY, current: 2, gained: 1, resulting: 3, printed: 3, limit: 'area'}]);
      build(t, play(t)!, ColonyName.LUNA);
      expect(t.parliament.popularSupportOf(PartyName.UNITY)).eq(3);
      expect(t.parliament.lastRally!.support[0]).deep.include({gained: 1, limit: 'area'});
      expect(skips(t)).is.empty;
    });

    it('a full area takes none — the card is still played, the rest of it still comes', () => {
      const t = table();
      t.parliament.addPopularSupport(PartyName.UNITY, 3);
      build(t, play(t)!, ColonyName.LUNA);
      expect(t.p1.titanium).eq(3);
      expect(t.parliament.popularSupportOf(PartyName.UNITY)).eq(3);
      expect(t.parliament.lastRally!.support[0]).deep.include({gained: 0, limit: 'area'});
      expect(skips(t)).has.lengthOf(1);
    });

    it('a short common supply cuts the cubes it cannot give', () => {
      const t = table();
      // Fill other areas until only 2 neutrals are left in the supply.
      for (const party of REDUX_PARTIES.filter((p) => p !== PartyName.UNITY)) {
        const room = Math.min(3, t.parliament.neutralSupply() - 2);
        if (room > 0) {
          t.parliament.addPopularSupport(party, room);
        }
      }
      expect(t.parliament.neutralSupply()).eq(2);
      expect(rallyOf(t).support[0]).deep.include({gained: 2, resulting: 2, limit: 'supply'});
      build(t, play(t)!, ColonyName.LUNA);
      expect(t.parliament.popularSupportOf(PartyName.UNITY)).eq(2);
      expect(t.parliament.neutralSupply()).eq(0);
    });
  });

  describe('rule 5 — the delegates are neutral', () => {
    it('no player delegate moves, nobody\'s Agenda moves, nobody gains access to Unity', () => {
      const t = table();
      const reserve = t.parliament.reserve(t.p1);
      build(t, play(t)!, ColonyName.LUNA);
      expect(t.parliament.reserve(t.p1)).eq(reserve);
      expect(t.parliament.votesOf(t.p1)).eq(0);
      expect(t.parliament.agendaOf(t.p1)).eq(0);
      expect(t.parliament.access(t.p1, PartyName.UNITY).hasEffect).eq(t.parliament.rulingParty() === PartyName.UNITY);
    });
  });

  describe('the preview == the play', () => {
    it('chips: +3 titanium and «+3 [neutral] · to Popular Support»; steps: the colony pick, then the support\'s SHOW step', () => {
      const t = table();
      const branch = previewOf(t);
      expect(branch.effects.map((e) => [e.icon, e.amount])).deep.eq([['titanium', 3], ['neutral-delegate', 3]]);
      expect(branch.effects[1].note).eq('to Popular Support');
      expect(branch.steps.map((s) => s.kind)).deep.eq(['boardPlacement', 'neutralRally']);
      const rally = rallyOf(t);
      expect(rally).deep.include({recount: false, megacredits: 0});
      build(t, play(t)!, ColonyName.LUNA);
      expect(t.parliament.lastRally!.support).deep.eq(rally.support);
      expect(t.parliament.lastRally!.inUse).deep.eq(rally.inUse);
    });
  });

  describe('save / load', () => {
    it('the area survives a reload; the record (a presentation ring) does not', () => {
      const t = table();
      build(t, play(t)!, ColonyName.LUNA);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      expect(reloaded.parliament!.popularSupportOf(PartyName.UNITY)).eq(3);
      expect(reloaded.parliament!.lastRally).is.undefined;
    });
  });
});
