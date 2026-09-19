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
};

/** The browse layer's verbs depend on the focused ZONE (one bar, one contract). */
function browseCommands(input: ParliamentCommandsInput, back: ConsoleCommand): Array<ConsoleCommand> {
  switch (parliamentFlow.zone) {
  case 'voting': {
    const cmds: Array<ConsoleCommand> = [];
    if (input.view.slots.length > 0) {
      cmds.push({control: 'confirm', label: 'Open the vote', enabled: true, highlight: input.canVoteNow});
    }
    // No X here: the voting area is ONE zone with no card of its own
    // selected — the inspector belongs to the mode's selected card.
    cmds.push(back);
    return cmds;
  }
  case 'government':
    return [{control: 'secondary', label: 'Inspect'}, back];
  case 'parties': {
    const state = input.partyActionStates[parliamentFlow.partyIndex];
    const cmds: Array<ConsoleCommand> = [];
    if (state !== undefined && state.kind !== 'none' && state.kind !== 'no-access') {
      cmds.push({control: 'confirm', label: 'Party action', enabled: state.kind === 'available', highlight: state.kind === 'available'});
    }
    cmds.push({control: 'secondary', label: 'Party effect'}, back);
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
  case 'submitting':
    return [{control: 'confirm', label: 'Performing…', enabled: false}];
  case 'paying':
    // The bill's own panel owns the bar while it stands in the mode's zone.
    return [];
  case 'landed':
    // The landing beat is a STATUS, not a verb: the bar echoes the CTA (busy until the cube lands) and offers nothing until the flow leaves.
    return [{control: 'confirm', label: parliamentVoteInFlight() ? 'Performing…' : 'Delegate placed', enabled: false}];
  }
}
