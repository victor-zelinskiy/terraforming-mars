/**
 * THE PARLIAMENT'S STANDING EFFECTS AS EFFECTS-EXPLORER ENTRIES (Turmoil Redux «один фреймворк», 2026-10-24). A party's
 * passive and the enacted law's standing part are ordinary entries of «Информация › ЭФФЕКТЫ» — the same printed node
 * (`passiveEffectNodesOf`: the DSL the face, the plaque and the inspector draw), the same signature and family ladder,
 * the same tile, focus rows, facets, counts, X and detail layer. What differs is the BADGE (the party's emblem, its
 * name, its accent) and the meta line: a political source keeps no statistic, so the line is the honest READING OF
 * ACCESS — the parliament's own rows (glossary §5): «Доступен · партия правит», «… два ваших делегата…», «… по альянсу»,
 * «… выдан источником»; a law reads «Доступен всем», or — while it binds a seat (RX42) — «Под вето сейчас: …».
 *
 * A law's one-off payouts are never an effect (only its `effect()` nodes are read); a party with an empty passive
 * (Unity, the Industrialists, the Reds) contributes nothing here — its ACTION lives in «Действия карт».
 */
import {Color} from '@/common/Color';
import {ParliamentModel, seatRestricted} from '@/common/models/ParliamentModel';
import {ICardRenderRoot} from '@/common/cards/render/Types';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {
  NO_EFFECT_SIGNATURE,
  PoliticalEffectEntry,
  effectSignatureOf,
  passiveEffectNodesOf,
} from '@/client/components/effects/effectExtraction';
import {sourceKey} from '@/client/components/effects/effectSource';
import {accessReasonRows} from '@/client/console/parliament/consoleParliamentModel';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {PoliticalSourceVm} from '@/client/console/parliament/politicalSources';
import {translateTextWithParams} from '@/client/directives/i18n';

export type PoliticalEffectsContext = {
  parliament: ParliamentModel | undefined;
  /** The VIEWER's colour — a law's restriction names the viewer «you». */
  viewerColor?: Color | string;
  /** Display names by colour (a law's restriction names the seats it binds). */
  playerNames?: Readonly<Record<string, string>>;
};

/** The explorer's entries for every political source that prints a standing effect, in the sources' order. */
export function politicalEffectEntries(sources: ReadonlyArray<PoliticalSourceVm>, ctx: PoliticalEffectsContext): Array<PoliticalEffectEntry> {
  const out: Array<PoliticalEffectEntry> = [];
  for (const source of sources) {
    if (!source.hasPassive) {
      continue;
    }
    if (source.source.kind === 'party') {
      const effect = getPartyEffect(source.source.party);
      if (effect === undefined) {
        continue;
      }
      out.push(...entriesOf(source, effect.passiveRenderData, effect.text.passive, partyNameKey(source.party), partyAccessReading(source, ctx)));
    } else {
      const law = getResolution(source.source.resolution);
      if (law === undefined) {
        continue;
      }
      out.push(...entriesOf(source, law.renderData, law.text.passive, law.text.name, lawAccessReading(ctx)));
    }
  }
  return out;
}

function entriesOf(
  source: PoliticalSourceVm,
  root: ICardRenderRoot,
  passive: string | undefined,
  title: string,
  access: PoliticalEffectEntry['access'],
): Array<PoliticalEffectEntry> {
  const key = sourceKey(source.source);
  const nodes = passiveEffectNodesOf(root);
  const base = {source: source.source, isCorporation: false as const, isDisabled: false as const, party: source.party, title, access};
  if (nodes.length === 0) {
    // A standing effect with no printed effect() block — its sentence is the graphic (never a silent omission).
    return passive === undefined ? [] : [{...base, key: `${key}#text`, effectIndex: 0, effectNode: undefined, renderRoot: undefined, text: passive, description: passive, signature: NO_EFFECT_SIGNATURE}];
  }
  const captions = captionsFor(passive, nodes.length);
  return nodes.map((effectNode, i) => ({
    ...base,
    key: `${key}#${i}`,
    effectIndex: i,
    effectNode,
    renderRoot: undefined,
    text: undefined,
    description: captions[i],
    signature: effectSignatureOf(effectNode),
  }));
}

/**
 * The tile captions of an N-block passive: the printed sentence ONE PER BLOCK when it reads as exactly N sentences
 * (the Greens' «2 M€ per TR step… Raising your plant…», Mars First's steel and city card), else the whole sentence on
 * the first block and none beside it — never a guess at which half belongs to which block.
 */
function captionsFor(passive: string | undefined, count: number): Array<string | undefined> {
  if (passive === undefined) {
    return new Array(count).fill(undefined);
  }
  if (count === 1) {
    return [passive];
  }
  const sentences = passive.split(/(?<=\.)\s+/).filter((s) => s.trim() !== '');
  if (sentences.length === count) {
    return sentences;
  }
  return [passive, ...new Array(count - 1).fill(undefined)];
}

/** WHY the seat holds the party — the parliament's own access row for its road (glossary §5). */
function partyAccessReading(source: PoliticalSourceVm, ctx: PoliticalEffectsContext): PoliticalEffectEntry['access'] {
  const parliament = ctx.parliament;
  const rows = accessReasonRows(source.access, {
    party: source.party,
    enactedEmpty: parliament?.enacted === undefined,
    // The short ruling reading — the enacted card stands in the government; the meta line never restates it.
    enactedName: undefined,
    inArea: parliament?.slots.some((slot) => slot.party === source.party) ?? false,
  });
  // A held effect always has its road's row; the kicker's own words stand in only for a model with no access row.
  const holds = rows.find((row) => row.tone === 'holds');
  return {key: holds?.key ?? 'Party effect', params: holds?.params ?? [], tone: 'holds'};
}

/** A law holds for EVERY participant — unless it binds somebody right now (RX42's live leaders): then that is the line. */
function lawAccessReading(ctx: PoliticalEffectsContext): PoliticalEffectEntry['access'] {
  const model = ctx.parliament;
  const veto = model?.enacted?.trVeto;
  if (model !== undefined && veto !== undefined) {
    const bound = veto.leaders.filter((leader) => {
      const seat = model.players.find((p) => p.color === leader.color);
      return seat === undefined || seatRestricted(seat);
    });
    if (bound.length > 0) {
      const names = bound.map((leader) => leader.color === ctx.viewerColor ?
        translateTextWithParams('you (${0})', [String(leader.tr)]) :
        `${ctx.playerNames?.[leader.color] ?? leader.color} (${leader.tr})`);
      return {key: 'Under the veto now: ${0}', params: [names.join(', ')], tone: 'warn'};
    }
  }
  return {key: 'Available to every player', params: [], tone: 'holds'};
}
