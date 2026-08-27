import {Tag} from '@/common/cards/Tag';
import {tagNameKey} from '@/common/cards/tagNames';
import {translateText} from '@/client/directives/i18n';

/**
 * THE PLAYER'S OWN NAME FOR A TAG — «Здание», «Энергия», «Юпитер».
 *
 * The ONE place a tag becomes words on this client. A refusal that names the
 * tag it is about is the difference between «не хватает обязательной метки»
 * (true, and useless) and «не хватает метки: Здание» (the same sentence, and
 * actionable), and the two surfaces that state it — a card's disabled action
 * variant and the Hydronetwork plan panel — must state the same name.
 *
 * Falls back to '' for a tag with no printed name, so a caller can decide
 * between the named and the unnamed wording without a second table.
 */
export function tagLabel(tag: Tag | undefined): string {
  const key = tag === undefined ? undefined : tagNameKey(tag);
  return key === undefined ? '' : translateText(key);
}

/**
 * THE PARAMS A REASON RENDERS WITH — the one rule, for every surface that
 * states a refusal.
 *
 * «A reason ABOUT a tag fills its own `${0}` from that tag's name.» The tag
 * rides structurally (an enum), never as a worded param: the server picks WHICH
 * tag, the client picks the WORD, so the sentence is the player's language on
 * the card's disabled variant, in its browse tile and on the Hydronetwork plan
 * panel alike. Written once because it had already been written three times,
 * and two of them rendered «Не хватает обязательной метки:» with nothing after
 * the colon.
 */
export function reasonParams(
  params: ReadonlyArray<string | number> | undefined,
  tag: Tag | undefined,
): Array<string> {
  if (tag !== undefined) {
    const label = tagLabel(tag);
    if (label !== '') {
      return [label];
    }
  }
  return (params ?? []).map(String);
}
