/*
 * THE READING BLOCKS of a parliament subject in the fullscreen inspector
 * (Turmoil Redux), in the same `CardAnnotation` shape the card rules panel
 * renders — with the PRINTED GRAPHIC beside a sentence where the subject
 * has one (`CardAnnotation.graphic`).
 *
 * A RESOLUTION reads as ONE scene of three columns and a footer:
 *   · the RIGHT column is the resolution's OWN rules (`resolutionAnnotations`)
 *     — its printed effect (the graphic + the sentence + what the framework
 *     knows about its parts), then the chairman quest's CONDITION;
 *   · the LEFT column is its PARTY (`resolutionPartyAnnotations`) — the
 *     mechanics' sentences under the party plaque (which draws the graphic):
 *     the standing effect and the action, the action's LIVE state beside it;
 *   · the FOOTER states where the card stands and the viewer's access
 *     (`resolutionInspectModel.ts`) — nothing here repeats it, and no block
 *     retells the general political rules.
 * A PARTY opened on its own (`partyAnnotations`) keeps its fuller reading:
 * the same mechanics blocks, plus «for you» and the one reference line.
 *
 * Everything the panel prints is an English i18n key; a name that reaches a
 * row as a PARAM is a display string and is translated HERE.
 */
import {CardAnnotation, CardAnnotationKind} from '@/client/components/cardAnnotations/annotationModel';
import {ICardRenderRoot} from '@/common/cards/render/Types';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {PartyName} from '@/common/turmoil/PartyName';
import {ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';
import {IClientPartyEffect} from '@/common/parliament/IClientResolution';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {Color} from '@/common/Color';
import {translateText} from '@/client/directives/i18n';
import {accessReasonRows} from './consoleParliamentModel';

type RowText = {text: string, params?: ReadonlyArray<string>};

/**
 * A block's place in the panel: the SUBJECT's own rules first, then what
 * surrounds it — a reading order, never the card panel's kind order.
 */
function block(id: string, kind: CardAnnotationKind, labelKey: string, rows: ReadonlyArray<string | RowText>, order: number, graphic?: ICardRenderRoot): CardAnnotation {
  return {
    id,
    kind,
    labelKey,
    rows: rows.map((row, i) => {
      const text = typeof row === 'string' ? row : row.text;
      const params = typeof row === 'string' ? undefined : row.params;
      return {id: `${id}:${i}`, text, params: params === undefined ? undefined : [...params], special: false, anyPlayer: false};
    }),
    special: false,
    anyPlayer: false,
    order,
    graphic,
  };
}

/** The nuance a party's action carries beyond its one sentence (rulebook footnotes), if any. */
function partyActionNotes(party: ReduxParty): ReadonlyArray<string> {
  switch (party) {
  case PartyName.INDUSTRIALISTS:
    return ['You may decrease the very production you increase'];
  case PartyName.REDS:
    return ['The draw cannot be undone; the discard that follows is mandatory'];
  default:
    return [];
  }
}

/**
 * The action's LIVE state for the viewer — one short line closing the action
 * block. Three facts told apart, as the rules tell them apart: the action was
 * USED this generation (the access stands, the passive effect too), it is
 * AVAILABLE (and whether right now — the viewer's own action window is an
 * execution gate, never a reason), or a real reason the server names.
 */
function partyActionState(party: ReduxParty, model: ParliamentModel | undefined, viewer: Color | undefined, canActNow: boolean | undefined): string | RowText {
  if (model === undefined || viewer === undefined) {
    return 'Once per generation';
  }
  const me = model.players.find((p) => p.color === viewer);
  const uses = me?.partyActionUses[party] ?? 0;
  const action = model.viewer?.partyActions.find((a) => a.party === party);
  if (uses > 0) {
    return 'Once per generation · used this generation';
  }
  if (action !== undefined && action.hasAccess && !action.available && action.reason !== '') {
    return {text: 'Once per generation · ${0}', params: [typeof action.reason === 'string' ? translateText(action.reason) : action.reason.message]};
  }
  if (action !== undefined && action.hasAccess) {
    return canActNow === false ? 'Once per generation · available on your turn' : 'Once per generation · available';
  }
  return 'Once per generation';
}

/**
 * The party's MECHANICS as reading blocks — the standing effect and the
 * action (its sentence, its rulebook nuance, its live state). ONE derivation
 * for the party's own inspector and for the party column beside a
 * resolution, so the two can never word the same mechanic differently.
 */
function partyMechanicBlocks(party: ReduxParty, effect: IClientPartyEffect, model: ParliamentModel | undefined, viewer: Color | undefined, canActNow: boolean | undefined): Array<CardAnnotation> {
  const out: Array<CardAnnotation> = [];
  if (effect.text.passive !== undefined) {
    out.push(block('group:effect', 'effect', 'Party effect', [effect.text.passive], 0));
  }
  if (effect.text.action !== undefined) {
    const rows: Array<string | RowText> = [effect.text.action, ...partyActionNotes(party), partyActionState(party, model, viewer, canActNow)];
    out.push(block('group:action', 'action', 'Party action', rows, 1));
  }
  if (effect.text.passive === undefined && effect.text.action === undefined) {
    out.push(block('group:effect', 'effect', 'Party effect', [effect.text.rule], 0));
  }
  return out;
}

/**
 * THE RESOLUTION'S OWN READING — the right column. Its printed effect leads
 * (the graphic drawn once, beside the first sentence), then the chairman
 * quest's condition with its graphic. The reward of the quest is the same
 * for every resolution and lives in the government block; the card's
 * standing and the viewer's access live in the footer — neither is here.
 */
export function resolutionAnnotations(id: ResolutionId): ReadonlyArray<CardAnnotation> {
  const resolution = getResolution(id);
  if (resolution === undefined) {
    return [];
  }
  const out: Array<CardAnnotation> = [];
  const text = resolution.text;
  const noEffect = resolution.dummy || (text.effect === undefined && text.passive === undefined && text.action === undefined);
  if (noEffect) {
    // A dummy says calmly, and once, that it has none: the block stands in
    // the same place a real effect will fill — never demoted for it.
    out.push(block('group:immediate', 'immediate', 'Resolution effect', ['No effect of its own'], 0));
  } else {
    // The printed graphic is ONE drawing (the face's render root); it rides
    // the first block of the reading, whichever part that is.
    let graphic: ICardRenderRoot | undefined = resolution.renderData;
    const take = (): ICardRenderRoot | undefined => {
      const g = graphic;
      graphic = undefined;
      return g;
    };
    if (text.effect !== undefined) {
      const rows: Array<string | RowText> = [text.effect];
      // What the framework knows beyond the sentence: a WINNER-ONLY part
      // goes to the player whose delegates won the vote, never to the
      // neutral player (rulebook FAQ p.18).
      if (resolution.hasWinnerEffect) {
        rows.push('Its winner\'s part goes to the player who won the vote — never to the neutral player');
      }
      out.push(block('group:immediate', 'immediate', 'Resolution effect', rows, 0, take()));
    }
    if (text.passive !== undefined) {
      out.push(block('group:effect', 'effect', 'Resolution effect', [text.passive, 'While enacted, every player has this effect'], 1, take()));
    }
    if (text.action !== undefined) {
      out.push(block('group:action', 'action', 'Resolution action', [text.action, 'While enacted, every player may use it'], 2, take()));
    }
  }
  // THE CHAIRMAN QUEST — the printed CONDITION, as a graphic and a sentence.
  out.push(block('group:quest', 'note', 'Chairman quest', [text.quest], 4, resolution.questRenderData));
  return out;
}

/**
 * THE PARTY COLUMN beside a resolution: the party's mechanics as sentences
 * (the plaque above draws the graphic). No «for you», no reference line —
 * the footer carries the viewer's access, the party's own inspector the rule.
 */
export function resolutionPartyAnnotations(party: ReduxParty, model: ParliamentModel | undefined, viewer: Color | undefined, canActNow?: boolean): ReadonlyArray<CardAnnotation> {
  const effect = getPartyEffect(party);
  if (effect === undefined) {
    return [];
  }
  return partyMechanicBlocks(party, effect, model, viewer, canActNow);
}

export function partyAnnotations(party: ReduxParty, model: ParliamentModel | undefined, viewer: Color | undefined, canActNow?: boolean): ReadonlyArray<CardAnnotation> {
  const effect = getPartyEffect(party);
  if (effect === undefined) {
    return [];
  }
  // 1–2. THE EFFECT and THE ACTION — the shared mechanics blocks.
  const out: Array<CardAnnotation> = partyMechanicBlocks(party, effect, model, viewer, canActNow);
  // 3. FOR YOU — the viewer's STATE in one short line (held / not held, and
  //    the one live basis), never the rule restated: the reference block
  //    below carries the rule once.
  if (model !== undefined && viewer !== undefined) {
    const me = model.players.find((p) => p.color === viewer);
    const access = me?.access.find((a) => a.party === party);
    if (access !== undefined) {
      const enactedName = model.enacted === undefined ? undefined : translateText(getResolution(model.enacted.resolution)?.text.name ?? model.enacted.resolution);
      const rows = accessReasonRows(access, {
        party,
        enactedEmpty: model.enacted === undefined,
        enactedName,
        inArea: model.slots.some((slot) => slot.party === party),
      })
        // The card-requirement note earns its line only where it SURPRISES —
        // a granted effect that does not count. «Met» is the ordinary case of
        // holding the effect, and the panel must fit the Deck's viewer.
        .filter((row) => row.key !== 'Card requirement of this party: met')
        .map((row): RowText => ({text: row.key, params: row.params}));
      out.push(block('group:you', 'note', 'For you', rows, 2));
    }
  }
  // 4. THE REFERENCE — how a party effect is held: the whole rule, once.
  out.push(block('group:access', 'note', 'Access', [
    'The ruling party\'s effect belongs to every player; a party with two of your delegates on its resolution gives its effect to you as well',
  ], 3));
  return out;
}
