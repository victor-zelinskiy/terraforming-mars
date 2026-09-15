/*
 * The RULES PANEL of a parliament subject in the fullscreen inspector (Turmoil
 * Redux): the right column beside a resolution card or a party plaque, in the
 * same `CardAnnotation` shape the card rules panel renders.
 *
 * THREE KINDS OF INFORMATION, NEVER MIXED. The subject's OWN rule (what the
 * resolution / the party does — one sentence each), the LIVE reading (what it
 * means for the viewer right now, what state it is in), and ONE line of
 * general reference (how access works) — each its own block, each said once.
 * The overview screen carries none of the reference: the inspector is where
 * the player asks for it.
 *
 * Everything the panel prints is an English i18n key; a name that reaches a
 * row as a PARAM is a display string and is translated HERE (a party name is
 * an i18n key of its own — «Партия: Reds» was the mixed-language row this
 * module used to print). The six current parties and the dummy resolutions
 * fit the panel without a scroll on TV and Deck; a future resolution with a
 * genuinely longer rule adds rows to ITS block, never a general paragraph.
 */
import {CardAnnotation} from '@/client/components/cardAnnotations/annotationModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {PartyName} from '@/common/turmoil/PartyName';
import {PARTY_EFFECT_DELEGATES, ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {Color} from '@/common/Color';
import {translateText} from '@/client/directives/i18n';
import {accessReasonRows} from './consoleParliamentModel';

type RowText = {text: string, params?: ReadonlyArray<string>};

/**
 * A block's place in the panel: the SUBJECT's own rules first, then what
 * surrounds it (the party of a resolution, the quest, the live status, the
 * reference) — a reading order, never the card panel's kind order.
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
  // 1. THE RESOLUTION'S OWN EFFECT — a dummy says so, calmly and once.
  if (resolution.dummy || (resolution.text.effect === undefined && resolution.text.passive === undefined && resolution.text.action === undefined)) {
    out.push(block('group:immediate', 'immediate', 'Resolution effect', ['No effect of its own'], 0));
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
  // 2. THE PARTY — what enacting this resolution gives everyone. Said as a
  //    CONDITION while the card is up for the vote; once enacted the STATUS
  //    block below states it, and this block keeps only the effect.
  const enactedNow = model?.enacted?.resolution === id;
  const party = getPartyEffect(resolution.party);
  if (party !== undefined) {
    const rows: Array<string | RowText> = enactedNow ? [] :
      [{text: 'If enacted: ${0} rule, and every player has their effect', params: [translateText(resolution.party)]}];
    // The effect, said ONCE: the passive effect where the party has one,
    // else its action — the party's own inspector (X on its plaque) carries
    // the action's full reading, and this panel must fit the viewer's band.
    if (party.text.passive !== undefined) {
      rows.push(party.text.passive);
    } else if (party.text.action !== undefined) {
      rows.push({text: 'Action, once per generation: ${0}', params: [translateText(party.text.action)]});
    } else {
      rows.push(party.text.rule);
    }
    out.push(block('group:party', 'effect', 'Party effect', rows, 3));
  }
  // 3. THE CHAIRMAN QUEST — the printed condition and its reward, one line each.
  out.push(block('group:quest', 'note', 'Chairman quest', [{text: '${0} · reward: the chairman seat and one Agenda step', params: [translateText(resolution.text.quest)]}], 4));
  // 4. THE LIVE STATUS — where the card stands right now.
  if (model !== undefined) {
    const enacted = model.enacted?.resolution === id;
    const slot = model.slots.find((s) => s.resolution === id);
    if (enacted) {
      out.push(block('group:state', 'note', 'Status', [{text: 'Enacted — ${0} rule', params: [translateText(resolution.party)]}], 5));
    } else if (slot !== undefined) {
      const rows: Array<string | RowText> = [];
      const leader = slot.leader === undefined ? translateText('no leader yet') : nameOfColor(slot.leader, players);
      rows.push({
        text: 'On the card: ${0} delegates · leader: ${1} · ${2}',
        params: [String(slot.totalVotes), leader, translateText(slot.isWinning ? 'winning now' : 'not winning')],
      });
      if (viewer !== undefined) {
        const mine = slot.viewerVotes;
        rows.push(mine >= PARTY_EFFECT_DELEGATES ?
          {text: 'Your delegates: ${0} — the party effect is yours', params: [String(mine)]} :
          {text: 'Your delegates: ${0} of ${1} for the party effect', params: [String(mine), String(PARTY_EFFECT_DELEGATES)]});
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
  // 1. THE EFFECT — one sentence.
  if (effect.text.passive !== undefined) {
    out.push(block('group:effect', 'effect', 'Party effect', [effect.text.passive], 0));
  }
  // 2. THE ACTION — its sentence, its limit, its nuance, and its LIVE state.
  if (effect.text.action !== undefined) {
    const rows: Array<string | RowText> = [effect.text.action, ...partyActionNotes(party)];
    let state: string | RowText = 'Once per generation';
    if (model !== undefined && viewer !== undefined) {
      const me = model.players.find((p) => p.color === viewer);
      const uses = me?.partyActionUses[party] ?? 0;
      const action = model.viewer?.partyActions.find((a) => a.party === party);
      if (uses > 0) {
        state = 'Once per generation · used this generation';
      } else if (action !== undefined && action.hasAccess && !action.available && action.reason !== '') {
        state = {text: 'Once per generation · ${0}', params: [typeof action.reason === 'string' ? translateText(action.reason) : action.reason.message]};
      } else if (action !== undefined && action.hasAccess) {
        state = 'Once per generation · available';
      }
    }
    rows.push(state);
    out.push(block('group:action', 'action', 'Party action', rows, 1));
  }
  if (effect.text.passive === undefined && effect.text.action === undefined) {
    out.push(block('group:effect', 'effect', 'Party effect', [effect.text.rule], 0));
  }
  // 3. FOR YOU — the live basis of the viewer's access (by the CURRENT state).
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
  // 4. THE REFERENCE — how a party effect is held, in one line.
  out.push(block('group:access', 'note', 'Access', [
    'Rule: the ruling party — everyone; two of your delegates on its resolution — you',
  ], 3));
  return out;
}
