import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {PARLIAMENT_GRAPHIC} from '@/client/components/premiumCard/resolutionPremiumVm';
import {accessRoadBesidesRuling, accessRoadOf, alliancePartnerOf, hasBannerCube, ParliamentViewVm, PartyActionStateVm} from './consoleParliamentModel';

/*
 * «ВАШИ ЭФФЕКТЫ» (Парламент v8 «Пленарный зал», docs/TURMOIL_REDUX_PARLIAMENT_V8_PLAN.md § 6) — the pure half of the
 * panel under the chamber: ONE item per source the viewer holds for as long as the parliament stands — the ruling
 * party (everyone's), a party by the viewer's delegates or a card's grant, the enacted law's STANDING part (its
 * passive and its action; the enactment's one-time rows are its face's, never «yours» — the owner's point 11) —
 * and the tile size the panel draws them at (one box, the tiles scale with their count).
 */

/** WHY the viewer holds a source — the tile's one mark (`alliance` — TR62: through the partner party `via`). */
export type EffectWhy = 'ruling' | 'delegates' | 'alliance' | 'granted' | 'banner' | 'law';
/** An action's state on a tile: usable now, spent this generation, or held but not usable now. */
export type EffectActionState = 'ready' | 'used' | 'locked';

export type EffectItem = {
  key: string;
  kind: 'party' | 'law';
  party: ReduxParty;
  why: EffectWhy;
  /** For `alliance` (TR62): the partner party that stands for this one — its emblem is the tile's mark. */
  via?: ReduxParty;
  /** The source has a STANDING effect (a passive). */
  effect: boolean;
  /** The source has an action — and its state for the viewer. */
  action?: EffectActionState;
  lawName?: string;
  lawMechanics?: MechanicsVM;
  lawPart?: 'effect' | 'action';
};

export type EffectsTileSize = 'l' | 'm' | 'q' | 's';

/** The tile size by the number of sources (§ 6): 1–2 large · 3 in a row · 4 as 2×2 · 5–6 compact 3×2. */
export function effectsTileSize(count: number): EffectsTileSize {
  return count <= 2 ? 'l' : count === 3 ? 'm' : count === 4 ? 'q' : 's';
}

function actionStateOf(state: PartyActionStateVm | undefined): EffectActionState | undefined {
  if (state === undefined || state.kind === 'none' || state.kind === 'no-access') {
    return undefined;
  }
  return state.kind === 'available' ? 'ready' : state.kind === 'used' ? 'used' : 'locked';
}

export type EffectItemsInput = {
  view: ParliamentViewVm;
  /** The ruling party AS SHOWN (the sitting holds the previous ruler until the medallions have changed places). */
  ruler: ReduxParty;
  /** The enacted law AS SHOWN (the sitting holds the previous government). */
  enacted: ParliamentViewVm['enacted'];
  /** Index-aligned with `view.parties`. */
  partyActionStates: ReadonlyArray<PartyActionStateVm>;
  resolutionActionState: PartyActionStateVm | undefined;
};

/** The viewer's standing sources, in reading order: the ruler, the held parties (the board's order), the law. */
export function parliamentEffectItems(input: EffectItemsInput): Array<EffectItem> {
  const {view} = input;
  const viewer = view.viewer;
  if (viewer === undefined) {
    return [];
  }
  const out: Array<EffectItem> = [];
  const partyItem = (party: ReduxParty, why: EffectWhy): EffectItem | undefined => {
    const index = view.parties.findIndex((p) => p.party === party);
    const vm = view.parties[index];
    if (vm?.effect === undefined) {
      return undefined;
    }
    const action = vm.effect.actionRenderData === undefined ? undefined : actionStateOf(input.partyActionStates[index]);
    // An ACTION-ONLY party (Unity, Industrialists, Reds) prints an EMPTY passive root — and an empty builder is
    // `[[]]`, one row with nothing in it. A passive exists only when some row draws something: counted by rows, the
    // action landed in «ПОСТОЯННЫЕ ЭФФЕКТЫ» too, as «Печатного эффекта нет» over the action's own sentence.
    const effect = vm.effect.passiveRenderData.rows.some((row) => row.length > 0);
    return {key: `party:${party}`, kind: 'party', party, why, effect, ...(action === undefined ? {} : {action})};
  };
  const ruler = partyItem(input.ruler, 'ruling');
  if (ruler !== undefined) {
    out.push(ruler);
  }
  for (const access of viewer.access) {
    if (!access.hasEffect || access.party === input.ruler) {
      continue;
    }
    const road = accessRoadOf(access);
    // THE LIVE RULER THE SITTING HAS NOT SEATED YET (Парламент v8 П4): the response carries the new government while the
    // walk still shows the old one — its «everyone's» effect arrives with the medallions' swap. Held only by ruling, it
    // is not the viewer's yet on screen (the strip read it as «granted by a card» under the Agenda beat); held by the
    // viewer's own road as well, it shows by that road.
    const shown = road === 'ruling' ? accessRoadBesidesRuling(access) : road;
    if (shown === undefined) {
      continue;
    }
    // A grant that is the viewer's cube on the party's banner (Septem Tribus:redux) says so — `banner`, never the generic grant.
    const why: EffectWhy = shown === 'delegates' ? 'delegates' : shown === 'alliance' ? 'alliance' : hasBannerCube(access) ? 'banner' : 'granted';
    const item = partyItem(access.party, why);
    const via = why === 'alliance' ? alliancePartnerOf(access) : undefined;
    if (item !== undefined) {
      out.push(via === undefined ? item : {...item, via});
    }
  }
  const resolution = input.enacted?.resolution;
  if (resolution !== undefined && (resolution.hasPassive || resolution.hasAction)) {
    const mechanics = buildMechanics(resolution.renderData, PARLIAMENT_GRAPHIC);
    const groups = mechanics.groups.filter((g) => g.kind === 'effect' || g.kind === 'action');
    if (groups.length > 0) {
      const action = resolution.hasAction ? actionStateOf(input.resolutionActionState) : undefined;
      out.push({
        key: `law:${resolution.id}`,
        kind: 'law',
        party: resolution.party,
        why: 'law',
        effect: resolution.hasPassive,
        ...(action === undefined ? {} : {action}),
        lawName: resolution.text.name,
        lawMechanics: {...mechanics, groups, textOnly: false},
        lawPart: resolution.hasAction && !resolution.hasPassive ? 'action' : 'effect',
      });
    }
  }
  return out;
}
