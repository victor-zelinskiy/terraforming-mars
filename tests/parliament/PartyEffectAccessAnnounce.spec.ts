import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {CouncilSeat} from '../../src/server/cards/turmoilRedux/CouncilSeat';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {GameEvent} from '../../src/common/events/GameEvent';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {cast} from '../../src/common/utils/utils';
import {formatMessage} from '../TestingUtils';
import {endGenerationThroughParliament, quietResolutionOf, seatEnacted, seatResolution} from './parliamentArrange';

/**
 * PL-112 — «ЭФФЕКТ ПАРТИИ ПОЛУЧЕН / ПОТЕРЯН», ALL ROADS. The law of access is
 * read live (`Parliament.access`), so until this diff nothing told a seat that
 * its second cube opened a party's effect, that TR36 made its first one
 * enough, that a card granted one, or that the refresh took one away. ONE
 * function (`announceAccessChanges`) diffs every seat against the snapshot
 * the Parliament keeps and serializes; it runs after every answered input and
 * after every step of a sitting. What it pins:
 *  · the second cube → gained (delegates, 2); the cube taken back → lost;
 *  · TR36 on the table → ONE cube is the road (delegates, 1);
 *  · a grant → gained (card, the source named); revoked → lost;
 *  · the enactment → NOTHING per seat (everyone's — the sitting tells it once), the snapshot moves;
 *  · the refresh discarding a seat's resolution → lost, inside the sitting;
 *  · the first diff (a new game, an older save) takes the picture silently; a reload never tells twice;
 *  · MarsBot — never.
 */
const G = PartyName.GREENS;
const R = PartyName.REDS;

function table(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  // The Reds rule by an enacted card; the Greens' and the Reds' quiet resolutions stand in slots 0 / 1.
  seatEnacted(parliament, quietResolutionOf(R));
  seatResolution(parliament, 0, quietResolutionOf(G));
  seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
  seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
  // The first diff takes the picture silently.
  parliament.announceAccessChanges(game);
  return [game, p1, p2, parliament];
}

function announced(game: IGame, from = 0): Array<GameEvent> {
  return game.events.events.slice(from).filter((e) => e.type === 'party-effect-gained' || e.type === 'party-effect-lost');
}

function lines(game: IGame, from: number): Array<string> {
  return game.gameLog.slice(from).map((m) => formatMessage(m)).filter((l) => /party effect/.test(l));
}

describe('PL-112 — a party\'s effect gained / lost is announced by the one diff of the law of access', () => {
  it('the first diff takes the picture and announces nothing (the starting rule\'s Greens are not news)', () => {
    const [game] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const parl = game.parliament!;
    expect(parl.partyEffectAccess).is.undefined;
    parl.announceAccessChanges(game);
    expect(announced(game)).deep.eq([]);
    expect(parl.partyEffectAccess?.get(game.players[0].id)?.[G], 'the Greens by the starting rule, snapshotted').eq('ruling');
  });

  it('the SECOND cube opens the effect: one root of its own — the line, then the typed event (delegates · 2); the cube taken back loses it', () => {
    const [game, p1, , parliament] = table();
    const slot = parliament.slotOf(G)!;
    const at = game.events.events.length;
    const logAt = game.gameLog.length;
    parliament.placeVote(p1, slot, 'lobby');
    parliament.announceAccessChanges(game);
    expect(announced(game, at), 'one cube is not the road').deep.eq([]);
    parliament.placeVote(p1, slot, 'reserve');
    parliament.announceAccessChanges(game);
    const gained = announced(game, at);
    expect(gained).has.length(1);
    expect(gained[0]).deep.include({type: 'party-effect-gained', player: p1.color, visibility: 'journal'});
    expect(gained[0].impact.partyEffect).deep.eq({party: G, basis: 'delegates', delegates: 2});
    expect(gained[0].source).deep.eq({kind: 'parliament'});
    // Its own root: the announcement's `action` root heads the chain, the line is the chain's first message.
    const root = game.events.events.find((e) => e.id === gained[0].correlationId);
    expect(root?.type).eq('action');
    expect(root?.category).eq('parliament');
    expect(lines(game, logAt)).deep.eq(['blue gains the Greens party effect: 2 delegate(s) on its resolution']);
    // Idempotent: nothing changed, nothing is told twice.
    parliament.announceAccessChanges(game);
    expect(announced(game, at)).has.length(1);
    // The cube taken back.
    const at2 = game.events.events.length;
    parliament.removeLatestVote(p1, slot);
    parliament.announceAccessChanges(game);
    const lost = announced(game, at2);
    expect(lost).has.length(1);
    expect(lost[0]).deep.include({type: 'party-effect-lost', player: p1.color});
    expect(lost[0].impact.partyEffect).deep.eq({party: G, basis: 'delegates', delegates: 2});
    expect(lines(game, logAt).at(-1)).eq('blue loses the Greens party effect: fewer than 2 delegate(s) on its resolution');
  });

  it('TR36 Council Seat on the table: ONE cube is the road (delegates · 1)', () => {
    const [game, p1, , parliament] = table();
    p1.playedCards.push(new CouncilSeat());
    parliament.announceAccessChanges(game);
    const at = game.events.events.length;
    parliament.placeVote(p1, parliament.slotOf(G)!, 'lobby');
    parliament.announceAccessChanges(game);
    const gained = announced(game, at);
    expect(gained).has.length(1);
    expect(gained[0].impact.partyEffect).deep.eq({party: G, basis: 'delegates', delegates: 1});
  });

  it('a GRANT opens the effect (card · the source named); revoked, it is lost', () => {
    const [game, p1, , parliament] = table();
    const at = game.events.events.length;
    const logAt = game.gameLog.length;
    parliament.grantPartyEffect(p1, PartyName.MARS, 'Septem Tribus');
    parliament.announceAccessChanges(game);
    const gained = announced(game, at);
    expect(gained).has.length(1);
    expect(gained[0].impact.partyEffect).deep.eq({party: PartyName.MARS, basis: 'card', source: 'Septem Tribus'});
    expect(lines(game, logAt)).deep.eq(['blue gains the Mars First party effect — granted by Septem Tribus']);
    const at2 = game.events.events.length;
    parliament.revokePartyEffect(p1, PartyName.MARS, 'Septem Tribus');
    parliament.announceAccessChanges(game);
    const lost = announced(game, at2);
    expect(lost).has.length(1);
    expect(lost[0].impact.partyEffect).deep.eq({party: PartyName.MARS, basis: 'card'});
    expect(lines(game, logAt).at(-1)).eq('blue loses the Mars First party effect — the grant is gone');
  });

  it('a road swapped under a STANDING effect is no news: two cubes on the ruling party\'s resolution, then the cubes gone while it still rules', () => {
    // The Greens rule by the starting rule; p1 puts two cubes on the Greens' resolution in slot 0.
    const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    seatResolution(parliament, 0, quietResolutionOf(G));
    parliament.announceAccessChanges(game);
    expect(parliament.rulingParty()).eq(G);
    const at = game.events.events.length;
    const slot = parliament.slotOf(G)!;
    parliament.placeVote(p1, slot, 'lobby');
    parliament.placeVote(p1, slot, 'reserve');
    parliament.announceAccessChanges(game);
    expect(announced(game, at), 'the effect was theirs by the ruling party already').deep.eq([]);
    parliament.removeLatestVote(p1, slot);
    parliament.removeLatestVote(p1, slot);
    parliament.announceAccessChanges(game);
    expect(announced(game, at), '…and still is').deep.eq([]);
  });

  it('the ENACTMENT is everyone\'s: no seat gets an event, the snapshot moves; the REFRESH that discards a seat\'s resolution takes its road away — inside the sitting', () => {
    const [game, p1, p2, parliament] = table();
    // p1 holds the Greens' effect by two cubes on the Greens' resolution in slot 0; p2 puts one cube on Mars First (slot 2)
    // so the Greens' card loses the vote and the refresh discards it.
    const greens = parliament.slotOf(G)!;
    parliament.placeVote(p1, greens, 'lobby');
    parliament.placeVote(p1, greens, 'reserve');
    const mars = parliament.slotOf(PartyName.MARS)!;
    parliament.placeVote(p2, mars, 'lobby');
    parliament.placeVote(p2, mars, 'reserve');
    parliament.placeVote(p2, mars, 'reserve');
    parliament.announceAccessChanges(game);
    expect(parliament.hasPartyEffect(p1, G)).is.true;
    const at = game.events.events.length;
    endGenerationThroughParliament(game);
    expect(parliament.rulingParty(), 'Mars First won and rules').eq(PartyName.MARS);
    const told = announced(game, at);
    // Nobody is told «you gained Mars First» — the sitting's own line says it for everyone…
    expect(told.filter((e) => e.impact.partyEffect?.party === PartyName.MARS)).deep.eq([]);
    // …and p1 is told the Greens' effect is gone: its resolution lost and was discarded, its cubes went home.
    const lost = told.filter((e) => e.impact.partyEffect?.party === G);
    expect(lost).has.length(1);
    expect(lost[0]).deep.include({type: 'party-effect-lost', player: p1.color});
    expect(lost[0].impact.partyEffect).deep.eq({party: G, basis: 'delegates', delegates: 2});
    // Inside the sitting: the announcement joins the sitting's own chain (one journal entry per sitting).
    const sitting = game.events.events.find((e) => e.type === 'action' && e.category === 'political-phase');
    expect(sitting, 'the sitting\'s root').is.not.undefined;
    expect(lost[0].correlationId).eq(sitting!.correlationId);
    expect(parliament.partyEffectAccess?.get(p1.id)?.[PartyName.MARS]).eq('ruling');
    expect(parliament.partyEffectAccess?.get(p1.id)?.[G]).is.undefined;
  });

  it('the diff runs after every answered input: a vote through `player.process` announces on its own, with no second call', () => {
    const [game, p1, , parliament] = table();
    const slot = parliament.slotOf(G)!;
    parliament.placeVote(p1, slot, 'reserve');
    parliament.announceAccessChanges(game);
    const at = game.events.events.length;
    const vote = cast(ParliamentHandler.voteOption(p1), SelectParty);
    p1.setWaitingFor(vote, () => {});
    p1.process({type: 'party', partyName: G});
    const gained = announced(game, at);
    expect(gained).has.length(1);
    expect(gained[0].impact.partyEffect).deep.eq({party: G, basis: 'delegates', delegates: 2});
  });

  it('serialization: the snapshot survives the round trip, so a reload announces nothing twice; an older save takes it silently', () => {
    const [game, p1, , parliament] = table();
    const slot = parliament.slotOf(G)!;
    parliament.placeVote(p1, slot, 'lobby');
    parliament.placeVote(p1, slot, 'reserve');
    parliament.announceAccessChanges(game);
    const saved = game.serialize();
    const restored = Game.deserialize(structuredClone(saved));
    const copy = restored.parliament!;
    expect(copy.serialize().partyEffectAccess).deep.eq(parliament.serialize().partyEffectAccess);
    const at = restored.events.events.length;
    copy.announceAccessChanges(restored);
    expect(announced(restored, at), 'nothing is told twice').deep.eq([]);
    // An older save: no field — the first diff takes the picture silently.
    const older = structuredClone(saved) as {parliament?: {partyEffectAccess?: unknown}};
    delete older.parliament?.partyEffectAccess;
    const old = Game.deserialize(older as Parameters<typeof Game.deserialize>[0]);
    expect(old.parliament!.partyEffectAccess).is.undefined;
    const at2 = old.events.events.length;
    old.parliament!.announceAccessChanges(old);
    expect(announced(old, at2)).deep.eq([]);
    expect(old.parliament!.partyEffectAccess?.get(p1.id)?.[G]).eq('delegates');
  });

  it('MarsBot holds no effect by any road — the bot is never announced', () => {
    const [game, , bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    seatResolution(parliament, 0, quietResolutionOf(G));
    parliament.announceAccessChanges(game);
    const at = game.events.events.length;
    const slot = parliament.slotOf(G)!;
    parliament.placeVote(bot, slot, 'lobby');
    parliament.placeVote(bot, slot, 'reserve');
    parliament.announceAccessChanges(game);
    expect(announced(game, at)).deep.eq([]);
    expect(parliament.partyEffectAccess?.has(bot.id), 'not even in the picture').is.false;
  });
});
