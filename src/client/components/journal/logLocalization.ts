/**
 * @console-shared LIVE — the ONE localisation seam for TOKEN-RENDERED log
 * lines (journal rows, notification headlines / outcome lines, the bot turn
 * review). Everything that renders a `LogMessage` through
 * `JournalTokenRenderer` parses it here, never via a raw `Log.parse`:
 *
 *  1. the template translates as usual (the English string is the key);
 *  2. PLURAL GROUPS resolve ACROSS token boundaries — a translation may write
 *     «${0} поднял ${1} на ${2} {деление|деления|делений}», where the number
 *     the group agrees with arrives as a SEPARATE numeric token (`b.number` →
 *     RAW_STRING), invisible to the in-fragment resolver. This walker carries
 *     the nearest preceding number over the fragment seams, so «1 шаг(ов)» /
 *     «2 ряд(а)» stop being expressible in any tokenised line.
 *
 * The whole-string path (`translateMessage` — prompt titles, flat previews)
 * already resolves groups after substitution; this module is its twin for the
 * interleaved render. A FUTURE journal rework builds on the same seam — the
 * semantics live in the translation values, never in a notification-only
 * formatter.
 */
import {Log} from '@/common/logs/Log';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {resolvePluralGroups, trailingNumberOf} from '@/client/i18n/pluralForms';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {translateText} from '@/client/directives/i18n';

type ParsableLog = {message: string, data: ReadonlyArray<LogMessageData>};

/**
 * Resolve plural groups over an already-parsed entry list, carrying the
 * nearest preceding NUMBER across fragments (numeric tokens included).
 * Entries without a single group pass through untouched (the common case —
 * zero allocations beyond the guard scan).
 */
export function resolveEntriesPluralGroups(
  entries: ReadonlyArray<string | LogMessageData>,
  lang: string,
): ReadonlyArray<string | LogMessageData> {
  const hasGroup = entries.some((e) => typeof e === 'string' && e.includes('{') && e.includes('|'));
  if (!hasGroup) {
    return entries;
  }
  let lastNumber: number | undefined;
  return entries.map((e) => {
    if (typeof e !== 'string') {
      // A numeric token (`b.number` emits RAW_STRING) updates the agreement
      // context; every other token (a card chip, a player name) leaves it.
      if (e.type === LogMessageDataType.RAW_STRING) {
        const n = Number(String(e.value));
        if (!Number.isNaN(n) && String(e.value).trim() !== '') {
          lastNumber = n;
        }
      }
      return e;
    }
    const resolved = resolvePluralGroups(e, lang, lastNumber);
    // A number INSIDE this fragment (rare — a pre-formatted «+2») becomes the
    // context for the NEXT fragment's groups.
    lastNumber = trailingNumberOf(resolved) ?? lastNumber;
    return resolved;
  });
}

/**
 * Translate + parse ONE log line for token rendering, plural groups resolved.
 * The drop-in replacement for the hand-rolled
 * `Log.parse({message: $t(m.message), data: m.data})` at every render site.
 */
export function parseLocalizedLog(message: ParsableLog): ReadonlyArray<string | LogMessageData> {
  const entries = Log.parse({
    message: translateText(message.message),
    data: [...message.data],
  });
  return resolveEntriesPluralGroups(entries, getPreferences().lang);
}
