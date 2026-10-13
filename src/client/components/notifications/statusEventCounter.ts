/**
 * @console-shared — «Счётчик событий» («Настройки» → ИНТЕРФЕЙС).
 *
 * The status strip's pending-events instrument («◈ N» right after «ПКЛ.», `ConsoleStatusStrip` → `.con-status__evq`)
 * reads the notification FIFO's backlog while delivery is blocked — a window into the presentation machinery, useful
 * when developing it and noise for a player: a permanent slot in the top bar that says «0» almost all game. So it is an
 * opt-in, OFF by default (the owner's decision 2026-10-13). The slot existed with no switch before; the key is new, so
 * nobody inherits it ON.
 *
 * Persisted; applied live (the strip re-renders in place).
 */
import {reactive} from 'vue';

const STORAGE_KEY = 'tm_console_status_event_counter';

function readStored(): boolean {
  try {
    return (globalThis as {localStorage?: Storage}).localStorage?.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const statusEventCounterState = reactive({enabled: readStored()});

/** Persist + apply the «show the events counter in the top bar» preference. */
export function setStatusEventCounter(on: boolean): void {
  statusEventCounterState.enabled = on;
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

/** The storage key — for an e2e that drives the instrument (`localStorage.setItem` before boot). */
export const STATUS_EVENT_COUNTER_KEY = STORAGE_KEY;
