import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {parliamentFlow, parliamentVoteInFlight} from './consoleParliamentFlow';
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
   * THE SITTING's own verbs (`consoleSittingFlow`): the A label for the page
   * (undefined = A does nothing here — a hosted step owns the bar, a wait pose
   * has nothing to press), whether X inspects an object on this page, and the
   * B verb's label (from the workspace phase — «Свернуть» past the commit,
   * nothing on the terminal closing page).
   */
  sitting?: {primary: string | undefined, inspect: boolean, back: string | undefined};
  /**
   * «ПРЕДСЕДАТЕЛЬСТВО»: the flow advertises A only once every beat has landed
   * («Закрыть»). While a beat is in flight A means «дожать» — unadvertised, on
   * the sitting's own grammar: a bar that offers «пропустить» invites the
   * player to skip the thing the flow exists to show. B is silent for the
   * whole flow: it is past the commit and there is no level to go back to.
   */
  quest?: {done: boolean};
};

/** The browse layer's verbs depend on the focused ZONE (one bar, one contract). */
function browseCommands(input: ParliamentCommandsInput, back: ConsoleCommand): Array<ConsoleCommand> {
  // The retired `government` zone reads as the ruler's tile (a restored stack may still name it).
  switch (parliamentFlow.zone === 'government' ? 'ruler' : parliamentFlow.zone) {
  case 'voting': {
    const cmds: Array<ConsoleCommand> = [];
    if (input.view.slots.length > 0) {
      cmds.push({control: 'confirm', label: 'Open the vote', enabled: true, highlight: input.canVoteNow});
    }
    if (input.view.enacted !== undefined) {
      cmds.push({control: 'stickR', label: 'Inspect the enacted resolution'});
    }
    // No X here: the voting area is ONE zone with no card of its own
    // selected — the inspector belongs to the mode's selected card.
    cmds.push(back);
    return cmds;
  }
  case 'ruler':
  case 'parties': {
    // The ruling party's tile stands in the government (v2) and answers as a party tile: the same verbs.
    const index = parliamentFlow.zone === 'ruler' ? input.view.parties.findIndex((p) => p.party === input.view.rulingParty) : parliamentFlow.partyIndex;
    const state = input.partyActionStates[index];
    const cmds: Array<ConsoleCommand> = [];
    // A party WITH an action always advertises A — available (lit), used or without access (dimmed; the
    // tile carries the reason and the press opens the action's surface, which states it). Only a party
    // with no action at all offers nothing (final polish P-05: «no-access» hid the verb altogether).
    if (state !== undefined && state.kind !== 'none') {
      cmds.push({control: 'confirm', label: 'Party action', enabled: state.kind === 'available', highlight: state.kind === 'available'});
    }
    // X is ONE verb across the parliament (glossary §5): «ОСМОТРЕТЬ», never the name of what it opens.
    cmds.push({control: 'secondary', label: 'Inspect'});
    if (input.view.enacted !== undefined) {
      cmds.push({control: 'stickR', label: 'Inspect the enacted resolution'});
    }
    cmds.push(back);
    return cmds;
  }
  }
}

export function parliamentCommandsOf(input: ParliamentCommandsInput): Array<ConsoleCommand> {
  const back: ConsoleCommand = {control: 'back', label: parliamentFlow.stage === 'browse' ? 'To the board' : 'Back'};
  switch (parliamentFlow.stage) {
  case 'browse':
    return browseCommands(input, back);
  case 'vote':
    return [{control: 'confirm', label: 'Send the delegate', enabled: input.canVoteNow, highlight: input.canVoteNow}, {control: 'secondary', label: 'Inspect'}, back];
  case 'seat':
    return [{control: 'confirm', label: 'Take the delegate', highlight: true}, {control: 'secondary', label: 'Inspect'}, {control: 'back', label: 'Minimize'}];
  case 'sitting': {
    // The sitting's page verbs; a hosted step (the picker, the take) owns the
    // bar while it stands in the stage's zone — then `primary` is undefined.
    const sitting = input.sitting;
    const cmds: Array<ConsoleCommand> = [];
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
    return [{control: 'confirm', label: parliamentVoteInFlight() ? 'Performing…' : 'Delegate placed', enabled: false}];
  }
}
