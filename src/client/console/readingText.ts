/*
 * @console-shared LIVE — console native stands on this file.
 *
 * ONE RENDERER FOR A READING THAT CARRIES PARAMS (PL-160, the polish
 * remediation iteration № 1, 2026-10-11).
 *
 * THE DEFECT CLASS. A reading is an i18n key plus its `${n}` params («Spend
 * ${0} from here: +${1}» → `['1', '1']`). Three surfaces printed the same
 * reading — the played-target step's rail, the action composer's answered
 * target row, the play composer's answered target row — and TWO of them ran
 * the key through `$t(label)` with no params, so the TV read «Потратьте ${0}
 * отсюда: +${1}» (the owner's photo, Aerial Mappers, 2026-10-10 22:31). A
 * raw `${n}` on screen is a CLASS of defect, not a typo: it reappears wherever
 * a new surface prints a reading by hand.
 *
 * THE LAW. A reading is rendered by THIS module and nowhere else. The params
 * are ALWAYS passed (an empty list for a key without placeholders — harmless),
 * the tail phrase goes the same way with its own params, and a result that
 * still carries a `${n}` names itself in a dev build. The guards: the unit
 * `tests/console/readingParamsGuard.spec.ts` (no placeholder key reaches
 * `$t(` / `translateText(` without params; every reading field prints through
 * here) and the e2e-wide page scan in `tests/e2e/consoleTest.ts` (no `${` in
 * rendered text after any test).
 */
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

/** A reading: an i18n key (or a resolved proper name when `translate` is false) and its number params. */
export type Reading = {
  label: string;
  params?: ReadonlyArray<string>;
  translate?: boolean;
};

/** A reading with a TAIL phrase after it — its own key, its own params (a payment's «where», an action good's «of what»). */
export type TailedReading = Reading & {
  tail?: string;
  tailParams?: ReadonlyArray<string>;
};

const RAW_TEMPLATE = /\$\{\d+\}/;

/** The reading's text — translated with its params; a resolved name as is. */
export function readingText(reading: Reading): string {
  if (reading.translate === false) {
    return reading.label;
  }
  const params = reading.params ?? [];
  const text = params.length === 0 && !RAW_TEMPLATE.test(reading.label) ?
    translateText(reading.label) :
    translateTextWithParams(reading.label, [...params]);
  if (process.env.NODE_ENV !== 'production' && RAW_TEMPLATE.test(text)) {
    console.warn(`[reading] RAW TEMPLATE on screen: «${text}» — key «${reading.label}», params ${JSON.stringify(params)}`);
  }
  return text;
}

/** The tail's text — `undefined` when the reading has none. */
export function readingTailText(reading: TailedReading): string | undefined {
  if (reading.tail === undefined) {
    return undefined;
  }
  return readingText({label: reading.tail, params: reading.tailParams});
}

/** The whole line — the reading and its tail, one space between (an aria sentence, a log line). */
export function readingLineText(reading: TailedReading): string {
  const tail = readingTailText(reading);
  const head = readingText(reading);
  return tail === undefined ? head : `${head} ${tail}`;
}
