/*
 * The RULES PANEL of a parliament face in the fullscreen inspector (Turmoil
 * Redux): the right column beside a resolution or a party banner, in the
 * same `CardAnnotation` shape the card rules panel renders — three blocks,
 * clearly told apart: the RESOLUTION's own effect (a dummy says honestly
 * that it has none), the PARTY effect, and the CHAIRMAN QUEST; for a party
 * banner, the effect and — when the viewer's game is known — WHO holds it
 * and why.
 */
import {CardAnnotation} from '@/client/components/cardAnnotations/annotationModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {Color} from '@/common/Color';

/**
 * A block's place in the panel: the SUBJECT's own rules first (a resolution's
 * effect, a party's effect and action), then what surrounds it (the party of
 * a resolution, the quest, the status, who holds it) — a reading order, never
 * the card panel's kind order.
 */
function block(id: string, kind: CardAnnotation['kind'], labelKey: string, rows: ReadonlyArray<string>, order: number): CardAnnotation {
  return {
    id,
    kind,
    labelKey,
    rows: rows.map((text, i) => ({id: `${id}:${i}`, text, special: false, anyPlayer: false})),
    special: false,
    anyPlayer: false,
    order,
  };
}

export function resolutionAnnotations(id: ResolutionId, model: ParliamentModel | undefined): ReadonlyArray<CardAnnotation> {
  const resolution = getResolution(id);
  if (resolution === undefined) {
    return [];
  }
  const out: Array<CardAnnotation> = [];
  if (resolution.dummy || (resolution.text.effect === undefined && resolution.text.passive === undefined && resolution.text.action === undefined)) {
    out.push(block('group:immediate', 'immediate', 'Resolution effect', ['No effect of its own (a dummy resolution of iteration 0)'], 0));
  } else {
    if (resolution.text.effect !== undefined) {
      out.push(block('group:immediate', 'immediate', 'Resolution effect', [resolution.text.effect], 0));
    }
    if (resolution.text.passive !== undefined) {
      out.push(block('group:effect', 'effect', 'Resolution effect', [resolution.text.passive], 1));
    }
    if (resolution.text.action !== undefined) {
      out.push(block('group:action', 'action', 'Resolution action', [resolution.text.action], 2));
    }
  }
  const party = getPartyEffect(resolution.party);
  if (party !== undefined) {
    out.push(block('group:party', 'effect', 'Party effect', [party.text.rule], 3));
  }
  out.push(block('group:quest', 'note', 'Chairman quest', [resolution.text.quest], 4));
  const enacted = model?.enacted?.resolution === id;
  const inArea = model?.slots.some((slot) => slot.resolution === id) === true;
  if (enacted) {
    out.push(block('group:state', 'note', 'Status', ['Enacted — its party rules and every player has the party effect'], 5));
  } else if (inArea) {
    out.push(block('group:state', 'note', 'Status', ['In the voting area — two of your delegates on it grant you the party effect'], 5));
  }
  return out;
}

export function partyAnnotations(party: ReduxParty, model: ParliamentModel | undefined, viewer: Color | undefined): ReadonlyArray<CardAnnotation> {
  const effect = getPartyEffect(party);
  if (effect === undefined) {
    return [];
  }
  const out: Array<CardAnnotation> = [];
  if (effect.text.passive !== undefined) {
    out.push(block('group:effect', 'effect', 'Party effect', [effect.text.passive], 0));
  }
  if (effect.text.action !== undefined) {
    out.push(block('group:action', 'action', 'Party action', [effect.text.action, 'Once per generation'], 1));
  }
  if (effect.text.passive === undefined && effect.text.action === undefined) {
    out.push(block('group:effect', 'effect', 'Party effect', [effect.text.rule], 0));
  }
  out.push(block('group:access', 'note', 'Who has it', [
    'Every player while the party rules (its resolution is enacted)',
    'A player with two own delegates on the party\'s resolution in the voting area',
  ], 2));
  if (model !== undefined && viewer !== undefined) {
    const me = model.players.find((p) => p.color === viewer);
    const access = me?.access.find((a) => a.party === party);
    if (access !== undefined) {
      const rows: Array<string> = [];
      if (access.ruling) {
        rows.push('You have it: the party rules');
      }
      if (access.byDelegates) {
        rows.push('You have it: two of your delegates are on its resolution');
      }
      if (access.granted.length > 0) {
        rows.push('You have it: granted by a card');
      }
      if (rows.length === 0) {
        rows.push(access.delegates > 0 ? 'You do not have it yet — one more delegate on its resolution would grant it' : 'You do not have it');
      }
      out.push(block('group:you', 'note', 'For you', rows, 3));
    }
  }
  return out;
}
