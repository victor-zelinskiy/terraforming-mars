import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {parliamentFlow, parliamentSupportInFlight, parliamentVoteInFlight} from './consoleParliamentFlow';
import {PartyActionStateVm, ParliamentViewVm} from './consoleParliamentModel';

/*
 * THE ONE COMMAND CONTRACT of the Parliament workspace — what the shell's
 * command bar advertises for the stage the player is in (and, on the browse
 * layer, for the zone the cursor stands on). Pure over the flow record; the
 * section publishes the result into `consoleParliamentUi.commands`.
 */
export type ParliamentCommandsInput = {
  view: ParliamentViewVm;
  canVoteNow: boolean;
  partyActionStates: ReadonlyArray<PartyActionStateVm>;
  /**
   * THE ENACTED RESOLUTION'S ACTION (Open IP Trade) — the party action's twin, on its own verb (Y) from every
   * browse zone: the law belongs to the whole table, not to one tile of the ring. `none` = no enacted law has one.
   */
  resolutionAction?: PartyActionStateVm;
  /**
   * THE SITTING's own verbs (`consoleSittingFlow`): the A label for the page
   * (undefined = A does nothing here — a hosted step owns the bar, a wait pose
   * has nothing to press), whether X inspects an object on this page, and the
   * B verb's label (from the workspace phase — «Свернуть» past the commit,
   * nothing on the terminal closing page).
   */
  /**
   * `payouts`: «ПОДРОБНОСТИ ВЫПЛАТ» on the results page — `door` (X inspects the payouts, L3 the enacted law — their
   * source), `open` (the step stands: X / B fold it back, the table scrolls, L3 still the source); absent = no door.
   */
  sitting?: {primary: string | undefined, inspect: boolean, back: string | undefined, payouts?: 'door' | 'open'};
  /**
   * «ПРЕДСЕДАТЕЛЬСТВО»: the flow advertises A only once every beat has landed
   * («Закрыть»). While a beat is in flight A means «дожать» — unadvertised, on
   * the sitting's own grammar: a bar that offers «пропустить» invites the
   * player to skip the thing the flow exists to show. B is silent for the
   * whole flow: it is past the commit and there is no level to go back to.
   */
  quest?: {done: boolean};
  /**
   * THE VOTE MODE'S ROW OF SEATS has somebody else on it — LB/RB then move the
   * SUBJECT of the reading along it («ИГРОКИ», the console's own word for that
   * jump everywhere else). A table of one seat advertises nothing: the bar
   * never offers a verb that would do nothing.
   */
  voteSubjects?: number;
  /**
   * THE VOTE MODE SERVES A DELEGATE GRANT (Turmoil Redux — the Venus tile's
   * «add 2 delegates to a resolution»): `count` delegates go at once (the verb
   * says «delegates»), and B is «Свернуть» — the grant is mandatory and past
   * the commit of the flow that paid it, there is no browse layer to fold to.
   */
  grant?: {
    count: number,
    /**
     * The door is STAGED (a card that places a delegate by being played — TR03): nothing has been sent, so A
     * is the PLAY's own commit («Разыграть карту») and B is one reversible level back to the composer («Назад»).
     */
    staged?: boolean,
    /**
     * …and the staged door is a blue card's ACTION (TR15 — «3 data → a delegate»), not a play: A is the action's own
     * commit verb («Подтвердить»), never «Разыграть карту» — nothing is being played.
     */
    stagedFlow?: 'play' | 'action',
    /** The giver is a CARD: L3 «Источник» opens it over the mode (X belongs to the selected resolution). */
    source?: boolean,
  };
  /** «ЗНАМЯ» (Septem Tribus:redux): the press is in · the giver is a card (L3) · the banner under the cursor is on offer. */
  banner?: {committed: boolean, source: boolean, available: boolean};
  /**
   * THE SUPPORT-AREA MODE (TR12 Party Sanctions, «САНКЦИИ»): A commits the pick of the plaque under the cursor —
   * a STAGED door's flow verb («Разыграть карту»), a live door's «Выбрать» — lit only on an area on offer (a
   * refused plaque carries its reason); B is «Назад» on a staged door, «Свернуть» on a live one.
   */
  support?: {
    staged: boolean,
    stagedFlow?: 'play' | 'action',
    source: boolean,
    available: boolean,
  };
  /**
   * THE DELEGATE MODE (TR72 Banned Delegate:redux, «ИЗГНАНИЕ»): A commits the figure under the cursor — a STAGED
   * door's flow verb, a live door's «Изгнать делегата»; every stop is a candidate, so A is always lit while a figure
   * stands; B is «Назад» on a staged door, «Свернуть» on a live one; L3 the card that asks.
   */
  delegate?: {
    staged: boolean,
    stagedFlow?: 'play' | 'action',
    source: boolean,
    available: boolean,
    /** The pick EXCHANGES the figure (TR74 Recruitment — the marker's `exchange`): the verbs are the recruiter's. */
    exchange?: boolean,
  };
  /**
   * «ВАШИ ЭФФЕКТЫ» (Парламент v8 § 6): on the overview's block `count` sources stand (A opens the inner step when
   * there is one). Inside the step (ONE FRAMEWORK С6 — a host): in the ACTIONS zone the tile under the cursor is an
   * action (`use` — whether it can be taken now); in the EFFECTS zone the explorer owns the cursor (`detail` — its
   * dossier layer stands).
   */
  effects?: {count: number, use?: boolean, zone?: 'actions' | 'effects', detail?: boolean};
  /** A read-only DOSSIER of the hall stands (the chairman quest's): B closes it, nothing else is offered. */
  dossier?: boolean;
};

/**
 * THE STAGED DOOR'S A — the flow's own commit verb, the one the composer would have carried had the card
 * asked nothing: a PLAY's «Разыграть карту» (TR03), an ACTION's «Подтвердить» (TR15). One verb for one act,
 * read by the bar and by the mode's own confirm alike.
 */
export function stagedDoorVerb(flow: 'play' | 'action' | undefined): string {
  return flow === 'action' ? 'Confirm' : 'Play card';
}

/** The law's verb — the ruler's A when its party has no action of its own (Open IP Trade): lit only when it can be taken now. */
function resolutionActionCommand(input: ParliamentCommandsInput): ConsoleCommand | undefined {
  const state = input.resolutionAction;
  if (state === undefined || state.kind === 'none') {
    return undefined;
  }
  return {control: 'confirm', label: 'Resolution action', enabled: state.kind === 'available', highlight: state.kind === 'available'};
}

/**
 * THE BROWSE LAYER'S VERBS («Зал» v7) depend on the focused ZONE — one bar, one contract, VERBS ONLY (the plan's
 * § 4): A on a bill opens the vote, A on a medallion is the party action's door (the ruler's: the law's action
 * when the party has none), X inspects the object under the cursor, B leaves. The edge (the engine, the track) has
 * no verb of its own but X.
 */
function browseCommands(input: ParliamentCommandsInput, back: ConsoleCommand): Array<ConsoleCommand> {
  // The retired `government` zone reads as the ruler's medallion (a restored stack may still name it).
  switch (parliamentFlow.zone === 'government' ? 'ruler' : parliamentFlow.zone) {
  case 'voting': {
    const cmds: Array<ConsoleCommand> = [];
    if (input.view.slots.length > 0) {
      cmds.push({control: 'confirm', label: 'Open the vote', enabled: true, highlight: input.canVoteNow});
      // X is ONE verb across the parliament (glossary §5): «ОСМОТРЕТЬ», never the name of what it opens.
      cmds.push({control: 'secondary', label: 'Inspect'});
    }
    cmds.push(back);
    return cmds;
  }
  case 'ruler':
  case 'parties': {
    const index = parliamentFlow.zone === 'ruler' ? input.view.parties.findIndex((p) => p.party === input.view.rulingParty) : parliamentFlow.partyIndex;
    const state = input.partyActionStates[index];
    const cmds: Array<ConsoleCommand> = [];
    // A party WITH an action always advertises A — available (lit), used or without access (dimmed; the press opens
    // the action's surface, which states the reason). The ruler's medallion with no party action offers the LAW's.
    if (state !== undefined && state.kind !== 'none') {
      cmds.push({control: 'confirm', label: 'Party action', enabled: state.kind === 'available', highlight: state.kind === 'available'});
    } else if (parliamentFlow.zone === 'ruler') {
      const law = resolutionActionCommand(input);
      if (law !== undefined) {
        cmds.push(law);
      }
    }
    cmds.push({control: 'secondary', label: 'Inspect'});
    cmds.push(back);
    return cmds;
  }
  case 'engine':
    return [{control: 'secondary', label: 'Inspect'}, back];
  // The career is ONE stop (v8): X reads its dossier.
  case 'agenda':
    return [{control: 'secondary', label: 'Inspect'}, back];
  case 'effects':
    // «ВАШИ ЭФФЕКТЫ» (v8 § 6): A opens the inner step — the full list, the actions with their door.
    return (input.effects?.count ?? 0) > 0 ? [{control: 'confirm', label: 'Open', highlight: true}, back] : [back];
  }
}

export function parliamentCommandsOf(input: ParliamentCommandsInput): Array<ConsoleCommand> {
  const back: ConsoleCommand = {control: 'back', label: parliamentFlow.stage === 'browse' ? 'To the board' : 'Back'};
  if (input.dossier === true) {
    return [{control: 'back', label: 'Close'}];
  }
  switch (parliamentFlow.stage) {
  case 'browse':
    return browseCommands(input, back);
  case 'vote': {
    const grant = input.grant;
    const staged = grant?.staged === true;
    // A STAGED door's A is the FLOW's commit — the play's «Разыграть карту», the action's «Подтвердить».
    const verb = staged ? stagedDoorVerb(grant?.stagedFlow) : (grant !== undefined && grant.count > 1 ? 'Send the delegates' : 'Send the delegate');
    const cmds: Array<ConsoleCommand> = [
      {control: 'confirm', label: verb, enabled: input.canVoteNow, highlight: input.canVoteNow},
      {control: 'secondary', label: 'Inspect'},
    ];
    if ((input.voteSubjects ?? 0) > 1) {
      cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Players'});
    }
    if (grant?.source === true) {
      // The console's one short word for it (a long label is the first thing a full bar drops).
      cmds.push({control: 'stickL', label: 'Source', priority: 1});
    }
    // B: a staged door is REVERSIBLE («Назад» — back to the composer, nothing was sent); a live grant is
    // mandatory and past the commit of the flow that paid it («Свернуть»).
    cmds.push(grant !== undefined && !staged ? {control: 'back', label: 'Minimize'} : back);
    return cmds;
  }
  case 'seat':
    return [{control: 'confirm', label: 'Take the delegate', highlight: true}, {control: 'secondary', label: 'Inspect'}, {control: 'back', label: 'Minimize'}];
  case 'sitting': {
    // The sitting's page verbs; a hosted step (the picker, the take) owns the
    // bar while it stands in the stage's zone — then `primary` is undefined.
    const sitting = input.sitting;
    const cmds: Array<ConsoleCommand> = [];
    // THE RESULTS PAGE WITH «ПОДРОБНОСТИ ВЫПЛАТ» (the owner, 2026-10-24): A stands LAST — the bar's right zone packs
    // from the right edge, so the last command never moves while its neighbours change (the card ⇄ the step); the
    // step offers no X of its own (B is the way back), L3 the law and the scroll.
    if (sitting?.payouts !== undefined) {
      if (sitting.payouts === 'door') {
        cmds.push({control: 'secondary', label: 'Inspect'});
      }
      cmds.push({control: 'stickL', label: 'Source', priority: 1});
      if (sitting.payouts === 'open') {
        cmds.push({control: 'stickScroll', label: 'Scroll', priority: 1});
      }
      if (sitting.back !== undefined) {
        cmds.push({control: 'back', label: sitting.back});
      }
      if (sitting.primary !== undefined) {
        cmds.push({control: 'confirm', label: sitting.primary, highlight: true});
      }
      return cmds;
    }
    if (sitting?.primary !== undefined) {
      cmds.push({control: 'confirm', label: sitting.primary, highlight: true});
    }
    if (sitting?.inspect === true) {
      cmds.push({control: 'secondary', label: 'Inspect'});
    }
    if (sitting?.back !== undefined) {
      cmds.push({control: 'back', label: sitting.back});
    }
    return cmds;
  }
  case 'quest':
    return input.quest?.done === true ? [{control: 'confirm', label: 'Close', highlight: true}] : [];
  // THE INNER STEP «ВАШИ ЭФФЕКТЫ»: A takes the action under the cursor (the bench's own door), X reads its source, B is
  // one level back to the overview (the cursor on the block).
  case 'effects': {
    // The EFFECTS zone is the explorer's: A opens an effect's dossier, LB/RB walk the dossiers, X reads the source.
    if (input.effects?.zone === 'effects') {
      return input.effects.detail === true ?
        [{control: 'bumperL', control2: 'bumperR', label: 'Other effects', priority: 1}, {control: 'secondary', label: 'Inspect'}, {control: 'back', label: 'Back'}] :
        [{control: 'confirm', label: 'Open'}, {control: 'secondary', label: 'Inspect'}, {control: 'back', label: 'Back'}];
    }
    const use = input.effects?.use;
    const cmds: Array<ConsoleCommand> = [];
    if (use !== undefined) {
      cmds.push({control: 'confirm', label: 'Use', enabled: use, highlight: use});
    }
    cmds.push({control: 'secondary', label: 'Inspect'});
    cmds.push({control: 'back', label: 'Back'});
    return cmds;
  }
  case 'support': {
    // Past the press the answer plays on this stage (the cubes, the Agenda step): a STATUS, never a verb — the bar
    // echoes the busy confirm (the landing's precedent) and offers nothing until the flow leaves by itself. An empty
    // list would fall back to «На поле», a verb the absorbed beat does not honour.
    if (parliamentFlow.supportCommitted) {
      return [{control: 'confirm', label: 'Performing…', enabled: false}];
    }
    const support = input.support;
    const cmds: Array<ConsoleCommand> = [
      {
        control: 'confirm', label: support?.staged === true ? stagedDoorVerb(support.stagedFlow) : 'Select',
      {control: 'dpad', label: 'Party choice', priority: 1},
        enabled: support?.available === true, highlight: support?.available === true,
      },
      {control: 'secondary', label: 'Inspect'},
    ];
    if (support?.source === true) {
      cmds.push({control: 'stickL', label: 'Source', priority: 1});
    }
    cmds.push(support?.staged === true ? back : {control: 'back', label: 'Minimize'});
    return cmds;
  }
  case 'banner': {
    // Past the press the cube is carried onto the banner on this stage: a STATUS, never a verb (the support mode's law).
    if (parliamentFlow.bannerCommitted) {
      return [{control: 'confirm', label: parliamentFlow.bannerBeat === 'done' || parliamentFlow.bannerBeat === 'read' ? 'Cube placed' : 'Performing…', enabled: false}];
    }
    const banner = input.banner;
    const cmds: Array<ConsoleCommand> = [
      {control: 'confirm', label: 'Place cube', enabled: banner?.available === true, highlight: banner?.available === true},
    // THE D-PAD CHOOSES THE PARTY (the owner, 2026-10-25): the bar says so first — the plaques are the mode's only stops.
      {control: 'secondary', label: 'Inspect'},
      {control: 'dpad', label: 'Party choice', priority: 1},
    ];
    if (banner?.source === true) {
      cmds.push({control: 'stickL', label: 'Source', priority: 1});
    }
    // The first action is mandatory and its confirm is behind the player: «Свернуть» parks the whole stack.
    cmds.push({control: 'back', label: 'Minimize'});
    return cmds;
  }
  case 'delegate': {
    // Past the press the figure is carried home on this stage: a STATUS, never a verb (the support mode's law).
    if (parliamentFlow.delegateCommitted) {
      const done = delegate?.exchange === true ? 'Delegate recruited' : 'Delegate removed';
      return [{control: 'confirm', label: parliamentFlow.delegateBeat === 'done' ? done : 'Performing…', enabled: false}];
    }
    const delegate = input.delegate;
    const cmds: Array<ConsoleCommand> = [
      {
        control: 'confirm', label: delegate?.staged === true ? stagedDoorVerb(delegate.stagedFlow) : delegate?.exchange === true ? 'Recruit delegate' : 'Remove delegate',
        enabled: delegate?.available === true, highlight: delegate?.available === true,
      },
      {control: 'secondary', label: 'Inspect'},
    ];
    if (delegate?.source === true) {
      cmds.push({control: 'stickL', label: 'Source', priority: 1});
    }
    cmds.push(delegate?.staged === true ? back : {control: 'back', label: 'Minimize'});
    return cmds;
  }
  // A card's WALK (TR04): the outcome of a play made elsewhere — nothing to confirm (the composer's preview already
  // said «1 → 3 · +1 РТ»), nothing to go back to; the flow leaves by itself once the marker has settled. …And a
  // card's RALLY of neutral delegates (TR31): the same outcome grammar — the composer said everything, the beats
  // absorb the bar, the flow leaves by itself once the coin has landed and been read. A STATUS, never a verb (the
  // support mode's precedent): an empty list fell back to the host's «B На поле» — a verb the absorbed beat does
  // not honour (PL-083).
  case 'walk':
  case 'rally':
    return [{control: 'confirm', label: 'Performing…', enabled: false}];
  case 'submitting':
    // A SUBMIT INSIDE THE CHAIRMANSHIP FLOW is not a wait the player watches —
    // the reading beat plays over it, so the bar stays as quiet as it is
    // during every other beat of the flow.
    if (parliamentFlow.stageBeforeSubmit === 'quest') {
      return [];
    }
    return [{control: 'confirm', label: 'Performing…', enabled: false}];
  case 'paying':
    // The bill's own panel owns the bar while it stands in the mode's zone.
    return [];
  case 'landed':
    // The landing beat is a STATUS, not a verb: the bar echoes the CTA (busy until the cube lands) and offers nothing until the flow leaves.
    return [{control: 'confirm', label: parliamentVoteInFlight() || parliamentSupportInFlight() ? 'Performing…' : 'Delegate placed', enabled: false}];
  case 'access':
    // THE ACCESS SCENE (2026-10-25) — the seal travelling into «ВАШИ ЭФФЕКТЫ»: a STATUS (what the hall is telling),
    // never a verb; the flow leaves by itself once it has been read.
    return [{control: 'confirm', label: parliamentFlow.accessBeat === 'landed' || parliamentFlow.accessBeat === 'done' ? 'Party effect gained' : 'Performing…', enabled: false}];
  }
}
