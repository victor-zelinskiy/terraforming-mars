/*
 * Virtual-keyboard LAYOUTS — resolved from the USER'S real language
 * preferences, NOT the game's UI language.
 *
 * The on-screen keyboard should offer the layouts a player would actually
 * type in, which is what their OS / browser language settings encode
 * (`navigator.languages` — on the Steam Deck / Electron this reflects the
 * system locale). Tying it to the game's translated languages would offer,
 * say, RU to someone whose device is DE/EN. So:
 *   1. an explicit override wins (localStorage `tm_kb_layouts` = comma ids —
 *      a future settings surface can write it);
 *   2. else derive from `navigator.languages`, mapped through the registry,
 *      order-preserving + deduped;
 *   3. a Latin (EN) layout is ALWAYS included as the universal fallback for
 *      ASCII names, appended if the user's languages didn't already bring it.
 *
 * The registry only holds layouts we can ship CORRECTLY (adding a wrong
 * layout is worse than falling back to Latin); extend it as real data lands.
 */

export type VkLayout = {
  /** simple-keyboard layoutName base (its shift variant is `<id>Shift`). */
  id: string;
  /** Short badge shown on the panel + the {lang} key. */
  code: string;
  /** The 4 character rows (digits / letters / letters / shift+letters+bksp). */
  rows: ReadonlyArray<string>;
  /** The 4 SHIFTED character rows. */
  shiftRows: ReadonlyArray<string>;
};

const EN: VkLayout = {
  id: 'en',
  code: 'ENG',
  rows: [
    '1 2 3 4 5 6 7 8 9 0',
    'q w e r t y u i o p',
    'a s d f g h j k l',
    '{shift} z x c v b n m {bksp}',
  ],
  shiftRows: [
    '1 2 3 4 5 6 7 8 9 0',
    'Q W E R T Y U I O P',
    'A S D F G H J K L',
    '{shift} Z X C V B N M {bksp}',
  ],
};

const RU: VkLayout = {
  id: 'ru',
  code: 'РУС',
  rows: [
    '1 2 3 4 5 6 7 8 9 0',
    'й ц у к е н г ш щ з х',
    'ф ы в а п р о л д ж э',
    '{shift} я ч с м и т ь б ю {bksp}',
  ],
  shiftRows: [
    '1 2 3 4 5 6 7 8 9 0',
    'Й Ц У К Е Н Г Ш Щ З Х',
    'Ф Ы В А П Р О Л Д Ж Э',
    '{shift} Я Ч С М И Т Ь Б Ю {bksp}',
  ],
};

const UK: VkLayout = {
  id: 'uk',
  code: 'УКР',
  rows: [
    '1 2 3 4 5 6 7 8 9 0',
    'й ц у к е н г ш щ з х ї',
    'ф і в а п р о л д ж є ґ',
    '{shift} я ч с м и т ь б ю {bksp}',
  ],
  shiftRows: [
    '1 2 3 4 5 6 7 8 9 0',
    'Й Ц У К Е Н Г Ш Щ З Х Ї',
    'Ф І В А П Р О Л Д Ж Є Ґ',
    '{shift} Я Ч С М И Т Ь Б Ю {bksp}',
  ],
};

const REGISTRY: Record<string, VkLayout> = {en: EN, ru: RU, uk: UK};

/** Universal Latin fallback — always available for ASCII names. */
const FALLBACK_ID = 'en';
/** Keep the language-cycle sane on the pad. */
const MAX_LAYOUTS = 4;
const OVERRIDE_KEY = 'tm_kb_layouts';

/** Map a BCP-47 tag's base subtag to a registry layout id (honest — no guesses). */
function layoutIdForTag(tag: string): string | undefined {
  const base = tag.toLowerCase().split(/[-_]/)[0];
  switch (base) {
  case 'ru': return 'ru';
  case 'uk': case 'ua': return 'uk';
  case 'en': return 'en';
  default: return undefined; // Unknown → the Latin fallback covers it.
  }
}

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function overrideIds(): ReadonlyArray<string> {
  try {
    const raw = storage()?.getItem(OVERRIDE_KEY) ?? '';
    return raw.split(',').map((s) => s.trim().toLowerCase()).filter((id) => id in REGISTRY);
  } catch {
    return [];
  }
}

function navigatorLangs(): ReadonlyArray<string> {
  if (typeof navigator === 'undefined') {
    return [];
  }
  const list = Array.isArray(navigator.languages) ? navigator.languages : [];
  return list.length > 0 ? list : (navigator.language !== undefined ? [navigator.language] : []);
}

/**
 * The layouts to offer, in the player's own priority order, with the Latin
 * fallback guaranteed. Never empty. The virtual keyboard cycles these with the
 * language hotkey.
 */
export function resolveUserKeyboardLayouts(): ReadonlyArray<VkLayout> {
  const ids: Array<string> = [];
  const add = (id: string | undefined) => {
    if (id !== undefined && id in REGISTRY && !ids.includes(id)) {
      ids.push(id);
    }
  };

  const override = overrideIds();
  if (override.length > 0) {
    override.forEach(add);
  } else {
    for (const tag of navigatorLangs()) {
      add(layoutIdForTag(tag));
    }
  }
  // Guarantee a Latin fallback for ASCII names, and never end up empty.
  add(FALLBACK_ID);
  return ids.slice(0, MAX_LAYOUTS).map((id) => REGISTRY[id]);
}
