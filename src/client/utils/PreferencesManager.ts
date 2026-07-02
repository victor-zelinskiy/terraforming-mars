export type Preferences = {
  learner_mode: boolean,
  enable_sounds: boolean,
  magnify_cards: boolean,
  fullscreen_cards_on_dblclick: boolean,
  show_alerts: boolean,
  hide_hand: boolean,
  hide_awards_and_milestones: boolean,
  show_milestone_details: boolean,
  show_award_details: boolean,
  hide_top_bar: boolean,
  small_cards: boolean,
  remove_background: boolean,
  hide_active_cards: boolean,
  hide_automated_cards: boolean,
  hide_event_cards: boolean,
  hide_tile_confirmation: boolean,
  hide_discount_on_cards: boolean,
  hide_animated_sidebar: boolean,
  debug_view: boolean,
  symbol_overlay: boolean,
  animated_title: boolean,
  experimental_ui: boolean,
  gamepad_enabled: boolean,
  lang: string,
}

export type Preference = keyof Preferences;

/*
 * vize1215 fork defaults — locked to the exact configuration that the
 * Preferences dialog used to expose. The dialog itself was removed
 * from the in-game sidebar (Sidebar.vue) to keep the right rail
 * uncluttered; players on this fork should not need to discover the
 * "right" combination of toggles for the new sci-fi UI to work
 * correctly. Each non-upstream change is annotated.
 *
 * If you later resurface the Preferences dialog (e.g. for a future
 * settings overlay), these are still safe defaults — none of them
 * disable functionality, they only mirror the curated UX.
 */
const defaults: Preferences = {
  learner_mode: true,
  enable_sounds: false,                  // vize1215: silence the upstream sfx by default — this build relies on visual feedback instead.
  magnify_cards: true,
  fullscreen_cards_on_dblclick: true,
  show_alerts: true,
  lang: 'ru',                            // vize1215: Russian is the only locale this fork is curated for.

  hide_hand: false,
  hide_awards_and_milestones: true,      // vize1215: legacy inline strip is replaced by dedicated Awards / Milestones overlays — keep the inline list off.
  show_milestone_details: true,
  show_award_details: true,
  hide_top_bar: false,
  small_cards: false,
  remove_background: false,
  hide_active_cards: false,
  hide_automated_cards: false,
  hide_event_cards: false,
  hide_tile_confirmation: true,          // vize1215: tile-confirmation modal is redundant once placement banner + amber preview do the same job.
  hide_discount_on_cards: false,
  hide_animated_sidebar: false,

  symbol_overlay: false,
  animated_title: true,

  experimental_ui: false,
  debug_view: false,
  gamepad_enabled: true,                 // vize1215: premium controller mode (GAMEPAD_SUPPORT_DESIGN.md) — inert until a pad button is pressed; `?gp=0` is the session kill switch.
};

export class PreferencesManager {
  public static INSTANCE = new PreferencesManager();
  private readonly _values: Preferences;

  private localStorageSupported(): boolean {
    return typeof localStorage !== 'undefined';
  }

  public static resetForTest() {
    this.INSTANCE = new PreferencesManager();
  }

  private constructor() {
    this._values = {...defaults};
    for (const key of Object.keys(defaults) as Array<Preference>) {
      const value = this.localStorageSupported() ? localStorage.getItem(key) : undefined;
      if (value) {
        this._set(key, value);
      }
    }
  }

  private _set(key: Preference, val: string | boolean) {
    if (key === 'lang') {
      this._values.lang = String(val);
    } else {
      this._values[key] = typeof(val) === 'boolean' ? val : (val === '1');
    }
  }

  // Making this Readonly means that it's Typescript-impossible to
  // set preferences through the fields themselves.
  values(): Readonly<Preferences> {
    return this._values;
  }

  set(name: Preference, val: string | boolean, setOnChange = false): void {
    // Don't set values if nothing has changed.
    if (setOnChange && this._values[name] === val) {
      return;
    }
    this._set(name, val);
    if (this.localStorageSupported()) {
      if (name === 'lang') {
        localStorage.setItem(name, this._values.lang);
      } else {
        localStorage.setItem(name, val ? '1' : '0');
      }
    }
  }
}

export function getPreferences(): Readonly<Preferences> {
  return PreferencesManager.INSTANCE.values();
}
