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
import {noRecipientCompactNoteOf, oneNumberYieldsOf, voteYieldsOf, WinSuffix, winSuffixesOf} from './influenceYieldModel';
import {COLONY_LEDGER_EMPTY, COLONY_LEDGER_TOTAL, ColonyLedgerReading, colonyLedgerOf} from './colonyLedgerModel';
import {PartyReactionReading, partyReactionsOf, viewerHasSeat} from './partyReactionModel';
import {quietRewardPoseOf} from './quietRewardPose';

/**
 * English i18n keys of the reading's kicker (the panel's ONLY heading over the reading): the seated
 * viewer's payout, the spectator's plain «when enacted» — and, for a card that pays NOTHING at the
 * enactment (a passive, an action), the quiet reward's own kicker (`quietRewardPose.ts`), the same
 * words the sitting's REWARD stage prints later: the graphic under it is the effect, not a payout.
 */
export const READING_KICKER_SEATED = 'For you when enacted';
export const READING_KICKER_SPECTATOR = 'When enacted';
export const VOTE_KICKER = 'Your vote';
/** The party box's one line of moment (the graphic beside the reading — not a kicker, not a reading). */
export const PARTY_MOMENT = 'party effect · to every player when enacted';
/** …and of the suffix's words. */
export const SUFFIX_IF_YOU_WIN = 'if you win';
export const SUFFIX_STEP = 'step';
export const SUFFIX_HINT = 'If you win, your Agenda marker moves to step ${0} first. The effect uses that influence.';

/** «For you when enacted» — the panel's ONE reading. */
export type VoteReadingVm = {
  /** English i18n key over the block: personal for a seat, plain for a spectator / a card that scales nothing. */
  kicker: string;
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
  viewer: Color | undefined,
  tableau: ReadonlyArray<{name: CardName}>,
): VoteReadingVm {
  const none: VoteReadingVm = {kicker: READING_KICKER_SPECTATOR, yields: [], suffixes: [], reactions: [], note: undefined};
  if (resolution === undefined || !viewerHasSeat(model, viewer)) {
    return none;
  }
  const all = voteYieldsOf(resolution, model, viewer);
  const yields = oneNumberYieldsOf(all).filter((y) => y.context !== 'reference');
  if (yields.length === 0) {
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
  return {
    kicker: READING_KICKER_SEATED,
    yields,
    suffixes: winSuffixesOf(all),
    // The answer follows the number the panel SHOWS — the estimate, never the folded forecast.
    reactions: partyReactionsOf(resolution, yields),
    note,
    ...(ledger === undefined ? {} : {ledger}),
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
  viewer: Color | undefined;
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
    reading: voteReadingOf(input.resolution, input.model, input.viewer, input.tableau),
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
  const strings: Array<string> = [text(vm.reading.kicker)];
  for (const suffix of vm.reading.suffixes) {
    strings.push(text(SUFFIX_IF_YOU_WIN));
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
  // THE COLONY LEDGER's words: the tiles' names (one each — the bonus, the multiplier and the total are
  // icons and numbers), the «no colonies» line, the sums' kicker.
  const ledger = vm.reading.ledger;
  if (ledger !== undefined) {
    if (ledger.empty) {
      strings.push(text(COLONY_LEDGER_EMPTY));
    } else {
      strings.push(...ledger.rows.map((row) => text(row.colony)), text(COLONY_LEDGER_TOTAL));
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
    readings: contexts.size,
    facts: vm.vote.facts.length,
    words: countWords(strings.join(' ')),
    // The party box beside the reading prints a GRAPHIC (the emblem in the printed formula) and one
    // line of moment — counted apart from the decision text, against its own ceiling.
    moment: countWords(text(PARTY_MOMENT)),
  };
}
