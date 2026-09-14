/*
 * The RULES PANEL of a parliament face in the fullscreen inspector (Turmoil
 * Redux): the right column beside a resolution or a party banner, in the
 * same `CardAnnotation` shape the card rules panel renders — structured
 * blocks, clearly told apart and never padded with an empty section: the
 * RESOLUTION's own effect (a dummy says honestly that it has none), the PARTY
 * effect and its action, the CHAIRMAN QUEST, the live STATUS (delegates,
 * leader, whether it wins now); for a party banner, the effect, the action's
 * state this generation, and — by the CURRENT game state, through the same
 * `accessReasonRows` the workspace's party detail and the Information strip
 * read — who holds it and why.
 */
import {CardAnnotation} from '@/client/components/cardAnnotations/annotationModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {PARTY_EFFECT_DELEGATES, ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {Color} from '@/common/Color';
import {translateText} from '@/client/directives/i18n';
import {accessReasonRows} from './consoleParliamentModel';

type RowText = {text: string, params?: ReadonlyArray<string>};

/**
 * A block's place in the panel: the SUBJECT's own rules first (a resolution's
 * effect, a party's effect and action), then what surrounds it (the party of
 * a resolution, the quest, the status, who holds it) — a reading order, never
 * the card panel's kind order.
 */
function block(id: string, kind: CardAnnotation['kind'], labelKey: string, rows: ReadonlyArray<string | RowText>, order: number): CardAnnotation {
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
  };
}

/** A row PARAM is a display string: a player's name as is, the neutral player translated. */
function nameOfColor(color: Color | 'neutral' | undefined, players: ReadonlyArray<{color: Color, name: string}> | undefined): string {
  if (color === undefined || color === 'neutral') {
    return translateText('the neutral player');
  }
  return players?.find((p) => p.color === color)?.name ?? color;
}

export function resolutionAnnotations(
  id: ResolutionId,
  model: ParliamentModel | undefined,
  viewer?: Color,
  players?: ReadonlyArray<{color: Color, name: string}>,
): ReadonlyArray<CardAnnotation> {
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
    const rows: Array<string | RowText> = [{text: 'Party: ${0} — every player holds its effect while this resolution is enacted', params: [resolution.party]}];
    if (party.text.passive !== undefined) {
      rows.push(party.text.passive);
    }
    if (party.text.action !== undefined) {
      rows.push({text: 'Action (once per generation): ${0}', params: [party.text.action]});
    }
    if (party.text.passive === undefined && party.text.action === undefined) {
      rows.push(party.text.rule);
    }
    out.push(block('group:party', 'effect', 'Party effect', rows, 3));
  }
  out.push(block('group:quest', 'note', 'Chairman quest', [resolution.text.quest, 'Completing it takes the chairman seat and advances your Agenda one step'], 4));
  if (model !== undefined) {
    const enacted = model.enacted?.resolution === id;
    const slot = model.slots.find((s) => s.resolution === id);
    if (enacted) {
      out.push(block('group:state', 'note', 'Status', ['Enacted — its party rules and every player has the party effect'], 5));
    } else if (slot !== undefined) {
      const rows: Array<string | RowText> = [];
      rows.push({text: 'In the voting area, slot V${0}: ${1} delegate(s)', params: [String(slot.tiePriority), String(slot.totalVotes)]});
      if (slot.leader !== undefined) {
        rows.push({text: 'Leader: ${0}', params: [nameOfColor(slot.leader, players)]});
      }
      rows.push(slot.isWinning ? 'Winning at the current distribution — enacted if the generation ended now' : 'Not the winning resolution at the current distribution');
      if (slot.tiePriority === 1) {
        rows.push('Closest to the government: wins a tie between resolutions');
      }
      if (viewer !== undefined) {
        const mine = slot.viewerVotes;
        if (mine >= PARTY_EFFECT_DELEGATES) {
          rows.push({text: 'Your delegates here: ${0} — the party effect is yours', params: [String(mine)]});
        } else {
          rows.push({text: 'Your delegates here: ${0} — ${1} grant(s) you the party effect', params: [String(mine), String(PARTY_EFFECT_DELEGATES)]});
        }
      }
      out.push(block('group:state', 'note', 'Status', rows, 5));
    }
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
    const rows: Array<string | RowText> = [effect.text.action, 'Once per generation'];
    if (model !== undefined && viewer !== undefined) {
      const me = model.players.find((p) => p.color === viewer);
      const uses = me?.partyActionUses[party] ?? 0;
      const action = model.viewer?.partyActions.find((a) => a.party === party);
      if (uses > 0) {
        rows.push('Used this generation');
      } else if (action !== undefined && action.hasAccess && !action.available && action.reason !== '') {
        rows.push(typeof action.reason === 'string' ? action.reason : action.reason.message);
      }
    }
    out.push(block('group:action', 'action', 'Party action', rows, 1));
  }
  if (effect.text.passive === undefined && effect.text.action === undefined) {
    out.push(block('group:effect', 'effect', 'Party effect', [effect.text.rule], 0));
  }
  out.push(block('group:access', 'note', 'Who has it', [
    'Every player while the party rules (its resolution is enacted; the Greens rule while nothing is)',
    'A player with two own delegates on the party\'s resolution in the voting area',
    'A card may grant the effect — the effect only, never the card requirement',
  ], 2));
  if (model !== undefined && viewer !== undefined) {
    const me = model.players.find((p) => p.color === viewer);
    const access = me?.access.find((a) => a.party === party);
    if (access !== undefined) {
      const enactedName = model.enacted === undefined ? undefined : (getResolution(model.enacted.resolution)?.text.name ?? model.enacted.resolution);
      const rows = accessReasonRows(access, {
        party,
        enactedEmpty: model.enacted === undefined,
        enactedName,
        inArea: model.slots.some((slot) => slot.party === party),
      }).map((row): RowText => ({text: row.key, params: row.params}));
      out.push(block('group:you', 'note', 'For you', rows, 3));
    }
  }
  return out;
}
