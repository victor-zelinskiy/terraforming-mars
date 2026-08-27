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
