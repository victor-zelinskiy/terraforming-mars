// Campaign «ТЕНДЕРЫ» — THE ACTIVATION SHEET, the pure half (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §20).
//
// The owner, 2026-11-09: «когда мы разыгрываем карту проекта, мы видим карту и описание результата — игрок видит, что
// поменяется; а тут мы видим просто „A разыграть“ на фоне того же экрана». A tender chosen in the door's list therefore
// stands as the HERO of its own sheet — the certificate large on the left, on the right the RESULT in the table's live
// numbers (`from → to`, never a paraphrase of the rule), the consequences the player gives up or triggers, and ONE verb.
// The press plays the tender's activation (the Committee's stamp) and the sheet HANDS the screen to the page whose cards
// it changes, where the change plays as a physical scene (the cards that stay glide to their new places, the new ones
// come off the tender deck, the gamble's cards go back into it, the price ticks in the purchase ledger).
//
// Pure: no DOM, no wire. The host feeds the facts (the live deal, the picks, the money) and renders the plan.

import {TenderId, TENDER_BROAD_PORTFOLIO_PROJECTS, TENDER_COMPENSATION_MC, TENDER_OPEN_CALL_PRELUDES, TENDER_RESTRUCTURING_CANDIDATES, TENDER_SUBSIDY_FLOOR_MC, TENDER_TARGETED_REQUEST_CARDS} from '@/common/campaign/tenders';
import {tenderExecutionOf} from './tenderPortfolio';

/** What a row counts — the icon the sheet draws beside its number. */
export type ActivationUnit = 'prelude' | 'project' | 'corporation' | 'mc' | 'seat';

/** One line of the RESULT: a label and its value — a change (`from → to`) or a fact (`to` alone). */
export type ActivationRow = {
  /** i18n key (no params). */
  label: string;
  from?: number;
  to: number;
  unit: ActivationUnit;
  /** How the change reads for the player: a gain (mint), a cost (amber), or neutral. */
  tone: 'gain' | 'cost' | 'neutral';
};

/** A consequence said in words: an i18n key and its params. */
export type ActivationNote = {key: string, params: ReadonlyArray<string>, tone: 'warn' | 'info'};

/** HOW the press continues: executes here · goes to the page to mark cards · names a tag here · deals candidates. */
export type ActivationKind = 'confirm' | 'review' | 'tag' | 'restructure' | 'legacy';

export type TenderActivationPlan = {
  id: TenderId;
  kind: ActivationKind;
  /** The verb of the sheet's commit (an i18n key). */
  verb: string;
  rows: ReadonlyArray<ActivationRow>;
  notes: ReadonlyArray<ActivationNote>;
};

/** The table's facts the sheet reads — every number the RESULT prints. */
export type ActivationFacts = {
  preludesDealt: number;
  preludePick: number;
  projectsDealt: number;
  projectsMax: number;
  corporationsDealt: number;
  lineage: number;
  /** The price of ONE starting-hand card now. */
  cardCost: number;
  /** The projects picked so far and the funds left after them (undefined = unknown yet). */
  projectsPicked: number;
  fundsLeft: number | undefined;
  /** The picks standing on the prelude / project / corporation step (a gamble clears them). */
  preludesPicked: number;
  corporationPicked: boolean;
  /** «Замена»: how many cards its pool's deck can still give (the server's `deckLeft`). */
  deckLeft?: number;
  /** «Целевой запрос»: the named tag and how many cards with it the deck holds (the server's count). */
  tagCount?: number;
};

const n = (v: number) => String(v);

/** The note every tender carries: executing it gives up the Committee's compensation. */
function compensationNote(): ActivationNote {
  return {key: 'Executed, it no longer pays its ${0} M€ compensation', params: [n(TENDER_COMPENSATION_MC)], tone: 'info'};
}

/** THE SHEET's plan for one start-window tender, in the table's live numbers. */
export function startActivationPlan(id: TenderId, f: ActivationFacts): TenderActivationPlan {
  const execution = tenderExecutionOf(id);
  const notes: Array<ActivationNote> = [];
  const rows: Array<ActivationRow> = [];
  let kind: ActivationKind = 'confirm';
  let verb = 'Execute the tender';
  switch (id) {
  case 'openCall':
    rows.push({label: 'Preludes in the deal', from: f.preludesDealt, to: f.preludesDealt + TENDER_OPEN_CALL_PRELUDES, unit: 'prelude', tone: 'gain'});
    rows.push({label: 'You keep', to: f.preludePick, unit: 'prelude', tone: 'neutral'});
    break;
  case 'broadPortfolio':
    rows.push({label: 'Projects in the deal', from: f.projectsDealt, to: f.projectsDealt + TENDER_BROAD_PORTFOLIO_PROJECTS, unit: 'project', tone: 'gain'});
    rows.push({label: 'You can buy up to', to: f.projectsMax, unit: 'project', tone: 'neutral'});
    break;
  case 'targetedRequest':
    kind = 'tag';
    verb = 'Request the three cards';
    rows.push({label: 'Projects in the deal', from: f.projectsDealt, to: f.projectsDealt + Math.min(TENDER_TARGETED_REQUEST_CARDS, f.tagCount ?? TENDER_TARGETED_REQUEST_CARDS), unit: 'project', tone: 'gain'});
    notes.push({key: 'Name a tag: ${0} project cards with it come off the deck into your deal', params: [n(TENDER_TARGETED_REQUEST_CARDS)], tone: 'info'});
    break;
  case 'researchSubsidy': {
    const next = Math.max(TENDER_SUBSIDY_FLOOR_MC, f.cardCost - 1);
    const saved = (f.cardCost - next) * f.projectsPicked;
    rows.push({label: 'Price of a starting-hand card', from: f.cardCost, to: next, unit: 'mc', tone: 'gain'});
    if (f.projectsPicked > 0) {
      rows.push({label: 'Your purchase', from: f.cardCost * f.projectsPicked, to: next * f.projectsPicked, unit: 'mc', tone: 'gain'});
    }
    if (f.fundsLeft !== undefined) {
      rows.push({label: 'Funds left', from: f.fundsLeft, to: f.fundsLeft + saved, unit: 'mc', tone: 'gain'});
    }
    break;
  }
  case 'preludeReview':
  case 'projectReview': {
    kind = 'review';
    verb = 'Mark the cards to return';
    const pool = execution === 'keep-preludes' ? 'prelude' : 'project';
    const dealt = pool === 'prelude' ? f.preludesDealt : f.projectsDealt;
    rows.push({label: 'You may return up to', to: Math.min(dealt, f.deckLeft ?? dealt), unit: pool, tone: 'neutral'});
    rows.push({label: 'Fresh cards come in their place', to: Math.min(dealt, f.deckLeft ?? dealt), unit: pool, tone: 'gain'});
    notes.push({key: 'You mark the cards on the deal itself — the rest stay where they lie', params: [], tone: 'info'});
    break;
  }
  case 'gamblePreludes':
    rows.push({label: 'Back to the deck', to: f.preludesDealt, unit: 'prelude', tone: 'cost'});
    rows.push({label: 'A fresh deal', to: f.preludesDealt, unit: 'prelude', tone: 'gain'});
    if (f.preludesPicked > 0) {
      notes.push({key: 'Your ${0} picked prelude(s) go back too', params: [n(f.preludesPicked)], tone: 'warn'});
    }
    break;
  case 'gambleProjects':
    rows.push({label: 'Back to the deck', to: f.projectsDealt, unit: 'project', tone: 'cost'});
    rows.push({label: 'A fresh deal', to: f.projectsDealt, unit: 'project', tone: 'gain'});
    if (f.projectsPicked > 0) {
      notes.push({key: 'Your ${0} picked project(s) go back too', params: [n(f.projectsPicked)], tone: 'warn'});
    }
    break;
  case 'gambleCorporations':
    rows.push({label: 'Back to the deck', to: f.corporationsDealt, unit: 'corporation', tone: 'cost'});
    rows.push({label: 'A fresh deal', to: f.corporationsDealt, unit: 'corporation', tone: 'gain'});
    if (f.corporationPicked) {
      notes.push({key: 'Your picked corporation goes back too', params: [], tone: 'warn'});
    }
    break;
  case 'restructuring':
    kind = 'restructure';
    verb = 'Deal the candidates';
    rows.push({label: 'Your lineage', to: f.lineage, unit: 'corporation', tone: 'neutral'});
    rows.push({label: 'Candidates from the deck', to: TENDER_RESTRUCTURING_CANDIDATES, unit: 'corporation', tone: 'gain'});
    notes.push({key: 'One candidate may take the place of one lineage corporation — or you keep the lineage', params: [], tone: 'info'});
    notes.push({key: 'Once the candidates are dealt, the decision cannot be undone', params: [], tone: 'warn'});
    break;
  default:
    kind = 'legacy';
    verb = '';
    break;
  }
  notes.push(compensationNote());
  return {id, kind, verb, rows, notes};
}

/** The facts of the THRESHOLD's album the sheet reads. */
export type LegacyActivationFacts = {
  limit: number;
  handSize: number;
  preludeLimit: number;
  playedPreludes: number;
};

/** THE SHEET's plan for a legacy tender on the threshold. */
export function legacyActivationPlan(id: TenderId, f: LegacyActivationFacts): TenderActivationPlan {
  const rows: Array<ActivationRow> = [];
  const notes: Array<ActivationNote> = [];
  if (id === 'extendedLegacy') {
    rows.push({label: 'Legacy seats', from: f.limit, to: f.limit + 1, unit: 'seat', tone: 'gain'});
    rows.push({label: 'Cards in your hand', to: f.handSize, unit: 'project', tone: 'neutral'});
  } else if (id === 'programExtension') {
    rows.push({label: 'Preludes into the finale', from: f.preludeLimit, to: f.preludeLimit + 1, unit: 'prelude', tone: 'gain'});
    rows.push({label: 'Preludes you played', to: f.playedPreludes, unit: 'prelude', tone: 'neutral'});
    notes.push({key: 'You choose the prelude on the album, beside your legacy seats', params: [], tone: 'info'});
  }
  notes.push(compensationNote());
  return {id, kind: 'legacy', verb: 'Execute the tender', rows, notes};
}
