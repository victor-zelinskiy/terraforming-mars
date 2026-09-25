/*
 * THE VOTE PANEL — «ONE NUMBER» (Turmoil Redux, the Parliament's vote mode).
 *
 * The panel under the three cards answers ONE question for the selected
 * card — «what do I get if this is enacted» — with one number, and states
 * this vote's two (on the edge three) consequences beside the delegate it
 * sends. Every sentence, every «if» and every conditional value lives in the
 * fullscreen inspector (X), never here. This module IS the panel's content,
 * pure: no Vue, no DOM, no i18n — English keys, numbers and the readings the
 * shared models already computed. `ConsoleParliamentSection.vue` renders it
 * and derives nothing; `voteInfoBudget` is what keeps the next resolution
 * from bringing the overload back (the guard `voteInfoBudget.spec.ts`
 * iterates the whole catalog through it).
 *
 * THE READING is `voteYieldsOf`'s ESTIMATE per scaled effect. The «if you
 * win» forecast is never a second plate: it folds into a SUFFIX of the same
 * reading («+1 if you win · step 3»), one per effect whose number the win
 * raises (`winSuffixesOf` — a sequel chain gets one per link). The ruling
 * party's answer stands on the number SHOWN. A viewer without a seat gets no
 * personal number and no «for you» — the card's graphic alone.
 *
 * THE FACTS are current → projected, from the server's own projection
 * (`voteForecastOf`): the LEADER and the WINNING state always; the PARTY
 * EFFECT only on the edge where this very delegate grants it — everywhere
 * else the places under the card already say n/2. The delegate count is not
 * a fact here: the ribbon of cubes under the card IS that fact. A fact's
 * NOTE (the tie rule, «two of your delegates») is the inspector's line.
 */
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {InfluenceYield} from '@/common/parliament/influenceScaling';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {ParliamentPartyVm, ParliamentSlotVm, voteAccessOf, VoteForecastVm} from './consoleParliamentModel';
import {
  levelLossNoteOf, levelPresentation, levelYieldIsNone, noRecipientCompactNoteOf, oneNumberYieldsOf, PRODUCTION_HORIZON_KEY,
  productionHorizonOn, ReadingPerson, voteLevyOf, voteYieldsOf, WinSuffix, winSuffixesOf,
} from './influenceYieldModel';
import {LevyReading, levyShortNoteKey} from '@/common/parliament/resolutionLevy';
import {colonyLedgerEmptyKey, COLONY_LEDGER_TOTAL, ColonyLedgerReading, colonyLedgerOf} from './colonyLedgerModel';
import {PartyReactionReading, partyReactionsOf, viewerHasSeat} from './partyReactionModel';
import {quietRewardPoseOf} from './quietRewardPose';
import {TileGrantReading, tileGrantCaptionOf, tileGrantDetailOf, tileGrantLabelKey, tileGrantReadingOf} from './tileGrantModel';

/**
 * English i18n keys of the reading's kicker (the panel's ONLY heading over the reading): the seated
 * viewer's payout, the spectator's plain «when enacted» — and, for a card that pays NOTHING at the
 * enactment (a passive, an action), the quiet reward's own kicker (`quietRewardPose.ts`), the same
 * words the sitting's REWARD stage prints later: the graphic under it is the effect, not a payout.
 */
export const READING_KICKER_SEATED = 'For you when enacted';
/**
 * …and the kicker of ANOTHER SEAT's reading: the subject is named ONCE, here,
 * by its cube and its display name («ДЛЯ ▮ АННА ПРИ ПРИНЯТИИ»). Everything
 * below speaks in the third person and repeats no name — one panel, one
 * reading, one subject.
 */
export const READING_KICKER_RIVAL = 'For ${0} when enacted';
export const READING_KICKER_SPECTATOR = 'When enacted';
/** «ВАШ ГОЛОС» is the VIEWER's, at every subject: A always sends the viewer's own delegate. */
export const VOTE_KICKER = 'Your vote';
/** The party box's one line of moment (the graphic beside the reading — not a kicker, not a reading). */
export const PARTY_MOMENT = 'party effect · to every player when enacted';
/** …and of the suffix's words. */
export const SUFFIX_IF_YOU_WIN = 'if you win';
/** The same suffix about ANOTHER seat (the subject is the kicker's, never the suffix's). */
export const SUFFIX_IF_THEY_WIN = 'if they win';
export const SUFFIX_STEP = 'step';
export const SUFFIX_HINT = 'If you win, your Agenda marker moves to step ${0} first. The effect uses that influence.';
export const SUFFIX_HINT_THEIRS = 'If they win, the Agenda marker moves to step ${0} first. The effect uses that influence.';

/** The suffix's words for a reading of `person` — one place, so the panel and the inspector cannot drift. */
export function suffixWinKey(person: ReadingPerson): string {
  return person === 'they' ? SUFFIX_IF_THEY_WIN : SUFFIX_IF_YOU_WIN;
}

export function suffixHintKey(person: ReadingPerson): string {
  return person === 'they' ? SUFFIX_HINT_THEIRS : SUFFIX_HINT;
}

/** «For you when enacted» — the panel's ONE reading. */
export type VoteReadingVm = {
  /** English i18n key over the block: personal for a seat, plain for a spectator / a card that scales nothing. */
  kicker: string;
  /**
   * WHOSE reading this is. `you` — the viewer's own (the panel's «mine»
   * register: the cyan frame, «у вас 7», «если победите»); `they` — another
   * seat's, named by `subject` and spoken of in the third person throughout.
   */
  person: ReadingPerson;
  /** The SUBJECT when it is not the viewer: its cube and its display name (a raw string, never a key). */
  subject?: {color: Color, name: string};
  /** ONE reading per scaled effect — the estimate; never a forecast plate. Empty for a spectator or a card that scales nothing. */
  yields: ReadonlyArray<InfluenceYield>;
  /** What the win adds, per effect whose number it raises — a suffix of the reading above, never a reading. */
  suffixes: ReadonlyArray<WinSuffix>;
  /** The ruling party's answer to the number SHOWN (the estimate). */
  reactions: ReadonlyArray<PartyReactionReading>;
  /** The honest recipient note, in the server's own compact words (English key); undefined when the payout can land. */
  note: string | undefined;
  /**
   * THE COLONY LEDGER (Colonial Affairs): the viewer's tiles multiplied by the reading's number — the
   * rows the «×k» stands on, from the SERVER's registry. Undefined for every other resolution.
   */
  ledger?: ColonyLedgerReading;
  /**
   * THE LEVY (a budget: «lose 10 M€» first) — what it takes from the supply the viewer holds NOW, netted
   * against the estimate of the payout in the same currency: the head and the tail of that payout's plate
   * («−10 → +7 = −3»). A short seat's warning is the reading's `note`. Undefined for every other resolution.
   */
  levy?: LevyReading;
  /**
   * A TILE GRANTED BY THRESHOLD (Skyscrapers): the viewer's standing at the vote — theirs at their
   * influence or only by winning, and the cities on Mars it may land on. Undefined for every other resolution.
   */
  grant?: TileGrantReading;
};

/** One side of a fact: a translatable key with params, or a RAW display string (a player's name), optionally with the leader's cube. */
export type FactValue = {
  key: string;
  params?: ReadonlyArray<string>;
  /** `key` is a display string (a seat's name) — never translated. */
  raw?: boolean;
  /** A cube beside the words (the leader's colour). */
  cube?: Color | 'neutral';
  /** The panel prints a dash for this side (the inspector prints the words). */
  dash?: boolean;
};

export type VoteFactId = 'lead' | 'win' | 'access';

export type VoteFactVm = {
  id: VoteFactId;
  /** English i18n key of the row's label. */
  label: string;
  before: FactValue;
  after: FactValue;
  /** The same reading on both sides — the row shows ONE value (an arrow to the same reading is noise). */
  unchanged: boolean;
  /** `gain` — this vote wins the viewer something (lit); `keep` — holds it; `none` — quiet. */
  tone: 'gain' | 'keep' | 'none';
  /** English i18n key of the qualification the INSPECTOR prints under the fact — never the panel. */
  note: string | undefined;
};

export type VoteFactsVm = {lead: VoteFactVm, win: VoteFactVm, access: VoteFactVm};

/** The vote's counts (the inspector's row; the panel leaves them to the ribbon under the card). */
export type VoteNumbersVm = {votesBefore: number, votesAfter: number, mineBefore: number, mineAfter: number};

export type VoteInfoVm = {
  instance: string;
  /** English i18n key of the resolution's name. */
  name: string;
  party: ReduxParty;
  winning: boolean;
  reading: VoteReadingVm;
  vote: {
    /** English i18n key. */
    kicker: string;
    /** Where the delegate leaves from — the server's own answer ('none': nothing to send; the confirm carries the reason). */
    source: 'lobby' | 'reserve' | 'none';
    /** Its price in M€ (0 from the lobby). */
    cost: number;
    /** The panel's facts: the leader, the winning state, and the party effect ONLY on its edge. */
    facts: ReadonlyArray<VoteFactVm>;
    /** Every fact — the inspector's full reading. */
    all: VoteFactsVm;
    numbers: VoteNumbersVm;
  };
};

// ── THE READING ─────────────────────────────────────────────────────────────

export function voteReadingOf(
  resolution: IClientResolution | undefined,
  model: ParliamentModel | undefined,
  /**
   * THE SUBJECT — whose outcome this reading is about. The functions below take
   * a COLOUR and have never known which of them is «me»: that is `rival`'s job.
   */
  subject: Color | undefined,
  tableau: ReadonlyArray<{name: CardName}>,
  /**
   * Present when the subject is NOT the viewer. The reading then speaks in the
   * third person throughout — one flag, so no phrase can be left in the second
   * person by omission. `name` is the subject's display name FOR THE KICKER,
   * and only where this block is the one that names it: inside a surface that
   * already says whose standing it shows (the Information zone's «ИНФОРМАЦИЯ ›
   * Анна › ПАРЛАМЕНТ») the name is omitted and the kicker stays plain — a
   * subject named twice is the same noise as a subject named nowhere.
   */
  rival?: {name?: string},
): VoteReadingVm {
  const person: ReadingPerson = rival === undefined ? 'you' : 'they';
  const none: VoteReadingVm = {kicker: READING_KICKER_SPECTATOR, person, yields: [], suffixes: [], reactions: [], note: undefined};
  if (resolution === undefined || !viewerHasSeat(model, subject)) {
    return none;
  }
  const viewer = subject;
  const named: VoteReadingVm = rival?.name === undefined || rival.name === '' || subject === undefined ?
    {...none, kicker: READING_KICKER_SPECTATOR} :
    {...none, kicker: READING_KICKER_RIVAL, subject: {color: subject, name: rival.name}};
  const seated = rival === undefined ? {...none, kicker: READING_KICKER_SEATED} : named;
  const all = voteYieldsOf(resolution, model, viewer);
  const yields = oneNumberYieldsOf(all).filter((y) => y.context !== 'reference');
  const grantReading = tileGrantReadingOf(resolution, model, viewer);
  const grant = grantReading === undefined || grantReading.context === 'reference' ? undefined : grantReading;
  if (yields.length === 0) {
    // A tile granted by threshold pays no number, but it is the seat's OWN reading all the same.
    if (grant !== undefined) {
      return {...seated, grant};
    }
    // Nothing to pay at the enactment: a passive / an action reads under the quiet reward's kicker
    // (what the card gives while enacted); a card with neither keeps the spectator's plain heading.
    const quiet = quietRewardPoseOf(resolution);
    return quiet === undefined ? none : {...none, kicker: quiet.kicker};
  }
  let note: string | undefined;
  for (const effect of resolution.scaled ?? []) {
    note = note ?? noRecipientCompactNoteOf(effect, tableau);
  }
  const ledger = colonyLedgerOf(resolution, model, viewer);
  // THE LEVY's warning — the seat holds less than the levy takes — is the panel's one honest note for a budget:
  // the income of the production phase arrives BEFORE the sitting, so the viewer can still set money aside.
  const levy = voteLevyOf(resolution, model, viewer);
  if (levy !== undefined && levy.short) {
    note = note ?? levyShortNoteKey(levy.resource);
  }
  // A LEVEL that CUTS (Plant Ban) warns the seat that HAS something to lose — the vote is the only
  // defence this law leaves, so its price has to stand on the panel BEFORE the vote, not in the results.
  // A seat at or below the limit is told nothing: there is no warning to give.
  note = note ?? levelLossNoteOf(yields);
  return {
    ...seated,
    yields,
    suffixes: winSuffixesOf(all),
    // The answer follows the number the panel SHOWS — the estimate, never the folded forecast.
    reactions: partyReactionsOf(resolution, yields),
    note,
    ...(ledger === undefined ? {} : {ledger}),
    ...(levy === undefined ? {} : {levy}),
    ...(grant === undefined ? {} : {grant}),
  };
}

// ── THE FACTS ────────────────────────────────────────────────────────────────

export type VoteFactsInput = {
  slot: ParliamentSlotVm | undefined;
  /** The card's party on the table (its access model for the viewer). */
  party: ParliamentPartyVm | undefined;
  viewer: Color | undefined;
  /** The server's projection of this vote (undefined for a spectator / no vote option). */
  forecast: VoteForecastVm | undefined;
  /** The submit SNAPSHOT — the pre-vote state the mode keeps until the cube lands; undefined before the submit. */
  snapshot: {leader: Color | 'neutral' | undefined, winning: boolean} | undefined;
  /** The cube has landed: the live model reads on both sides. */
  landed: boolean;
  /** The viewer's own delegates on the card, as the mode shows them: before and after this vote. */
  mineBefore: number;
  mineAfter: number;
  nameOf: (color: Color) => string;
};

export function voteFactsOf(input: VoteFactsInput): VoteFactsVm {
  const {slot, party, viewer: me, forecast: f, snapshot, landed, nameOf} = input;
  // THE LEADER — before the submit the live model and its projection; in the
  // air the snapshot on the left and the live model on the right; landed, the
  // live model on both sides. A snapshot WITHOUT a leader is a real «before»
  // (nobody led the card yet) — never a fall-through to the live leader.
  const leaderBefore = snapshot !== undefined ? snapshot.leader : slot?.leader;
  const leaderAfter = landed ? slot?.leader : (f?.leaderAfter ?? (snapshot !== undefined ? slot?.leader : leaderBefore));
  const leadTone: VoteFactVm['tone'] = leaderAfter !== undefined && leaderAfter === me ? (leaderBefore === me ? 'keep' : 'gain') : 'none';
  const leaderValue = (leader: Color | 'neutral' | undefined, side: 'before' | 'after'): FactValue => {
    if (leader === undefined) {
      return {key: 'no leader yet', dash: side === 'before'};
    }
    if (leader === me) {
      return {key: side === 'after' && leadTone === 'gain' && f?.tieNote === 'earlier-delegate' ? 'you (earlier delegate)' : 'you', cube: leader};
    }
    if (leader === 'neutral') {
      return {key: 'the neutral player', cube: 'neutral'};
    }
    return {key: nameOf(leader), raw: true, cube: leader};
  };
  // THE WINNING STATE — the same three moments (in the air, the right side is
  // the live model's answer, exactly as the leader's is).
  const winningBefore = snapshot !== undefined ? snapshot.winning : (slot?.isWinning ?? false);
  const winningAfter = landed ? (slot?.isWinning ?? false) : (f?.winningAfter ?? (snapshot !== undefined ? (slot?.isWinning ?? false) : winningBefore));
  const winTone: VoteFactVm['tone'] = winningAfter ? (winningBefore ? 'keep' : 'gain') : 'none';
  // THE PARTY EFFECT — the viewer's own delegates toward the threshold, unless the effect is already theirs for another reason.
  const access = voteAccessOf(slot, party, input.mineAfter, input.mineBefore);
  const held: FactValue = {key: 'effect is yours'};
  const places = (n: number): FactValue => ({key: '${0} of ${1}', params: [String(n), String(access.threshold)]});
  const unlocks = !access.heldByOther && access.after >= access.threshold && access.before < access.threshold;
  const accessTone: VoteFactVm['tone'] = access.heldByOther ? 'keep' :
    (access.after >= access.threshold ? (access.before >= access.threshold ? 'keep' : 'gain') : (access.after > access.before ? 'keep' : 'none'));
  return {
    lead: {
      id: 'lead', label: 'Leader',
      before: leaderValue(leaderBefore, 'before'), after: leaderValue(leaderAfter, 'after'),
      unchanged: leaderBefore === leaderAfter, tone: leadTone, note: undefined,
    },
    win: {
      id: 'win', label: 'Winning',
      before: {key: winningBefore ? 'yes' : 'no'}, after: {key: winningAfter ? 'yes' : 'no'},
      unchanged: winningBefore === winningAfter, tone: winTone,
      note: winTone === 'gain' && f?.tieNote === 'slot-priority' ? 'wins the tie: closer to the government' :
        (winTone === 'none' && !winningAfter ? 'another resolution leads' : undefined),
    },
    access: {
      id: 'access', label: 'Party effect',
      before: access.heldByOther ? held : places(access.before),
      after: access.heldByOther || access.after >= access.threshold ? held : places(access.after),
      unchanged: access.heldByOther || access.before === access.after || (access.before >= access.threshold && access.after >= access.threshold),
      tone: accessTone,
      note: access.heldByOther ? access.reason : (unlocks ? 'two of your delegates' : undefined),
    },
  };
}

/** The panel's facts: the leader and the winning state always; the party effect only on the edge this delegate crosses. */
export function panelFactsOf(facts: VoteFactsVm): Array<VoteFactVm> {
  const out = [facts.lead, facts.win];
  if (facts.access.tone === 'gain' && !facts.access.unchanged) {
    out.push(facts.access);
  }
  return out;
}

/**
 * THE FOOTER'S FACTS (the fullscreen inspector): the leader and the winning
 * state, in the panel's own `before → after` rows — never a sentence. The
 * party effect's edge is the status chip's own projection there
 * (`resolutionStatusOf` → `unlocksWithVote`), so the footer says it once.
 */
export function footerFactsOf(facts: VoteFactsVm): Array<VoteFactVm> {
  return [facts.lead, facts.win];
}

// ── THE PANEL ────────────────────────────────────────────────────────────────

export type VoteInfoInput = {
  slot: ParliamentSlotVm;
  resolution: IClientResolution | undefined;
  model: ParliamentModel | undefined;
  /**
   * WHOSE outcome the reading is about — the viewer unless the player moved
   * the subject along the row of seats. The VOTE half of the panel is never
   * about anybody but the viewer, at any subject.
   */
  subject: Color | undefined;
  /** Present when the subject is not the viewer: its display name (the kicker's). */
  rival?: {name: string};
  /** The SUBJECT's public tableau — the holder law is read for the seat the reading is about. */
  tableau: ReadonlyArray<{name: CardName}>;
  /** The resolution's name (English key) and the winning flag as the mode shows them. */
  name: string;
  winning: boolean;
  source: 'lobby' | 'reserve' | 'none';
  cost: number;
  facts: VoteFactsVm;
  numbers: VoteNumbersVm;
};

export function voteInfoOf(input: VoteInfoInput): VoteInfoVm {
  return {
    instance: input.slot.instance,
    name: input.name,
    party: input.slot.party,
    winning: input.winning,
    reading: voteReadingOf(input.resolution, input.model, input.subject, input.tableau, input.rival),
    vote: {
      kicker: VOTE_KICKER,
      source: input.source,
      cost: input.source === 'reserve' ? input.cost : 0,
      facts: panelFactsOf(input.facts),
      all: input.facts,
      numbers: input.numbers,
    },
  };
}

// ── THE WORDS OF A FACT ───────────────────────────────────────────────────────

export type TextFn = (key: string, params?: ReadonlyArray<string>) => string;

/** One side of a fact as words (a seat's NAME is a display string, never a key). */
export function factValueText(value: FactValue, text: TextFn): string {
  return value.raw === true ? value.key : text(value.key, value.params);
}

// ── THE BUDGET — the rule the overload cannot come back through ─────────────

export type VoteInfoBudget = {
  /** Headings on the panel (the reading's and the vote's). */
  kickers: number;
  /** Reading CONTEXTS drawn (a chain is one reading; a forecast plate would be a second). */
  readings: number;
  facts: number;
  /** Words the panel prints outside the head line and the confirm (numbers and icons are not words). */
  words: number;
  /** Words of the party box's one line of moment beside the reading (a caption under a graphic — not decision text; its own ceiling). */
  moment: number;
};

/** The ceilings `voteInfoBudget.spec.ts` holds every resolution of the catalog to. */
export const VOTE_INFO_LIMITS = {kickers: 3, readings: 1, facts: 2, factsOnEdge: 3, words: 28, momentWords: 5} as const;

const IDENTITY: TextFn = (key, params) => (params ?? []).reduce<string>((acc, p, i) => acc.split('${' + i + '}').join(p), key);

/** The ONE word a subject's display name is worth to the budget (it stands exactly where «вас» stood). */
const NAME_TOKEN = 'N';

/** Words in a rendered string — runs of letters (a digit, an icon or a glyph is not a word). */
export function countWords(rendered: string): number {
  return (rendered.match(/[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё'’-]*/g) ?? []).length;
}

/**
 * The panel's content, counted. `text` renders a key the way the panel does —
 * the guard passes the real RU dictionary, so the count is what the player
 * reads; without one the English keys are counted.
 */
export function voteInfoBudget(vm: VoteInfoVm, text: TextFn = IDENTITY): VoteInfoBudget {
  const person = vm.reading.person;
  // THE SUBJECT'S NAME IS NOT PANEL COPY. «ДЛЯ ▮ АННА ПРИ ПРИНЯТИИ» costs exactly what «ДЛЯ ВАС ПРИ
  // ПРИНЯТИИ» costs — the name stands where «вас» stood — so the ceiling is held against ONE token
  // and a two-word display name cannot fail the whole catalog for a seat that happens to be at the table.
  const strings: Array<string> = [text(vm.reading.kicker, vm.reading.subject === undefined ? undefined : [NAME_TOKEN])];
  for (const suffix of vm.reading.suffixes) {
    strings.push(text(suffixWinKey(person)));
    if (suffix.agendaStep !== undefined) {
      strings.push(text(SUFFIX_STEP));
    }
  }
  for (const reaction of vm.reading.reactions) {
    strings.push(text(reaction.party));
  }
  if (vm.reading.note !== undefined) {
    strings.push(text(vm.reading.note));
  }
  // THE LEVY's words: «of 10» beside a short seat's take…
  const levy = vm.reading.levy;
  if (levy !== undefined && levy.short) {
    strings.push(text('of ${0}', [String(levy.owed)]));
  }
  // …and the HORIZON under a production part that stands beside something paid TODAY (a levy, or a supply part
  // of the same card) — the block's own predicate, so the budget counts exactly the note the block prints.
  const effects = vm.reading.yields.map((y) => y.effect);
  if (effects.some((effect) => productionHorizonOn(effects, effect, levy !== undefined))) {
    strings.push(text(PRODUCTION_HORIZON_KEY));
  }
  // A LEVEL part's words: the term's own word before the target («up to» / «max»), its own phrase beside
  // the level («in hand» / «of yours»), and the calm «no draw needed» / «nothing to lose» in the
  // result's slot when the seat is already at the level.
  for (const y of vm.reading.yields) {
    const term = y.effect.level;
    if (term === undefined || y.target === undefined || y.total === undefined) {
      continue;
    }
    const words = levelPresentation(term, person);
    strings.push(text(words.wordKey), text(words.levelKey, [String(y.total.before)]));
    if (levelYieldIsNone(y)) {
      strings.push(text(words.noneKey));
    }
  }
  // THE COLONY LEDGER's words: the tiles' names (one each — the bonus, the multiplier and the total are
  // icons and numbers), the «no colonies» line, the sums' kicker.
  const ledger = vm.reading.ledger;
  if (ledger !== undefined) {
    if (ledger.empty) {
      strings.push(text(colonyLedgerEmptyKey(person)));
    } else {
      strings.push(...ledger.rows.map((row) => text(row.colony)), text(COLONY_LEDGER_TOTAL));
    }
  }
  // A TILE GRANTED BY THRESHOLD's words: the tile, the viewer's standing and their destinations (the inline
  // row prints no head and no «where» — the arrow onto the base city and the card's own graphic say it).
  const grant = vm.reading.grant;
  if (grant !== undefined) {
    strings.push(text(tileGrantLabelKey(grant.grant)));
    const caption = tileGrantCaptionOf(grant, person);
    if (caption !== undefined) {
      strings.push(text(caption.key, caption.params === undefined ? undefined : [...caption.params]));
    }
    const detail = tileGrantDetailOf(grant, person);
    if (detail !== undefined) {
      strings.push(text(detail.key, detail.params === undefined ? undefined : [...detail.params]));
    }
  }
  strings.push(text(vm.vote.kicker));
  if (vm.vote.source === 'lobby') {
    strings.push(text('from the lobby · free'));
  } else if (vm.vote.source === 'reserve') {
    strings.push(text('from the reserve'), 'M€');
  }
  for (const fact of vm.vote.facts) {
    strings.push(text(fact.label));
    // The leader's «before» is a cube on the panel (a dash without one) — no words.
    if (!fact.unchanged && fact.id !== 'lead') {
      strings.push(factValueText(fact.before, text));
    }
    strings.push(factValueText(fact.after, text));
  }
  const contexts = new Set(vm.reading.yields.filter((y) => y.context !== 'reference').map((y) => y.context));
  return {
    kickers: 2,
    // A grant is ONE reading of its own (the seat's standing) where no number is paid.
    readings: contexts.size + (grant !== undefined ? 1 : 0),
    facts: vm.vote.facts.length,
    words: countWords(strings.join(' ')),
    // The party box beside the reading prints a GRAPHIC (the emblem in the printed formula) and one
    // line of moment — counted apart from the decision text, against its own ceiling.
    moment: countWords(text(PARTY_MOMENT)),
  };
}
