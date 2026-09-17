/**
 * @console-shared — «Номера карт» («Настройки» → ИНТЕРФЕЙС).
 *
 * A card's printed CATALOG NUMBER («147», «X31», a resolution's «RX01») is
 * technical information — the key the art, the lore and the catalog search
 * resolve by, a debugging handle — not something a player reads while
 * playing. So every surface that prints it asks this ONE flag: the premium
 * face's corner stamp (`PremiumCard` → `.pcard__code`) and the source plate
 * (`ConsoleSourceDock` → `.con-src__plate-code`). The number itself stays in
 * the view-models (`PremiumCardVM.code`, `PromptSourceView.code`) — this flag
 * decides DISPLAY only.
 *
 * Default OFF; persisted; applied live (reactive — every mounted face
 * re-renders in place, nothing remounts). Developer surfaces whose subject IS
 * the catalog (the «Полигон» resolutions stand's own catalog labels) print
 * codes regardless.
 */
import {reactive} from 'vue';

const STORAGE_KEY = 'tm_console_card_numbers';

function readStored(): boolean {
  try {
    return (globalThis as {localStorage?: Storage}).localStorage?.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const cardNumberDisplayState = reactive({enabled: readStored()});

/** Persist + apply the «show card numbers» preference. */
export function setCardNumberDisplay(on: boolean): void {
  cardNumberDisplayState.enabled = on;
  try {
    const storage = (globalThis as {localStorage?: Storage}).localStorage;
    if (on) {
      storage?.setItem(STORAGE_KEY, '1');
    } else {
      storage?.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage unavailable — the in-session choice still applies
  }
}
