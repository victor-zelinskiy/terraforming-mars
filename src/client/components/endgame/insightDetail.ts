/*
 * Insight EXPLAINABILITY (Iteration 12) — the "why did the engine say this?" layer.
 *
 * Every important badge / chip on the endgame report becomes EXPLAINABLE: a typed
 * `ChipDetail` (title + plain explanation + evidence rows + confidence + why-it-matters)
 * that the premium hover/focus popover renders. The detail is DERIVED from the SAME
 * evidence the insight already carries (evidenceChips / scores / relatedPlayers) or, for
 * a player STYLE, from the SAME facts `duelStyle` reads — so the explanation can never
 * drift from the verdict.
 *
 * Design contract (mirrors insightEngine / gameStoryDna):
 *   • PURE — no Vue / DOM / i18n. Texts are English i18n KEYS the component translates.
 *   • NO runtime import of insightEngine (type-only) → no module cycle (the composer
 *     imports buildInsightDetail at runtime). Facts are read off `ctx` directly.
 *   • HONEST — confidence is surfaced (exact / measured / partial / ruleOnly); no fake
 *     VP/M€; a thin-evidence style says so.
 */
import type {Color} from '@/common/Color';
import type {EndgameFact} from '@/common/events/endgameFacts';
import type {EndgameCategoryKey, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import type {EvidenceChip, InsightCandidate, InsightContext, InsightFamily} from '@/client/components/endgame/insightEngine';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type ChipDetailConfidence = 'exact' | 'measured' | 'partial' | 'ruleOnly';

/** One evidence row inside a detail popover (same shape as EvidenceChip → rendered alike). */
export type DetailEvidenceRow = {t: 'raw' | 'i18n'; v: string; tone?: EvidenceChip['tone']};

export type ChipDetail = {
  /** i18n KEY — the badge / chip title. */
  title: string;
  /** i18n KEY — a 1–2 sentence plain-language meaning. */
  explanation: string;
  /** i18n KEY — why this mattered in context (optional). */
  whyItMatters?: string;
  /** Up to ~3 evidence rows (the numbers that produced the verdict). */
  evidence: ReadonlyArray<DetailEvidenceRow>;
  /** How trustworthy the number is (drives a chip in the popover). */
  confidence?: ChipDetailConfidence;
  /** An honest caveat (i18n KEY) — e.g. "card draw is not converted to M€". */
  caveat?: string;
  /** The family — drives the popover accent. */
  accent?: InsightFamily;
};

// ─────────────────────────────────────────────────────────────────────────
// Self-contained fact helpers (no insightEngine runtime import → no cycle)
// ─────────────────────────────────────────────────────────────────────────

function facts(ctx: InsightContext): ReadonlyArray<EndgameFact> {
  return ctx.facts ?? [];
}
function factOf(ctx: InsightContext, type: EndgameFact['type'], player: Color): EndgameFact | undefined {
  return facts(ctx).find((f) => f.type === type && f.player === player);
}
function m(f: EndgameFact | undefined, k: string): number {
  return f?.metrics[k] ?? 0;
}
const rawRow = (v: string, tone?: EvidenceChip['tone']): DetailEvidenceRow => ({t: 'raw', v, tone});
const i18nRow = (v: string, tone?: EvidenceChip['tone']): DetailEvidenceRow => ({t: 'i18n', v, tone});

// ─────────────────────────────────────────────────────────────────────────
// Per-cluster explanation registry — the meaning + why + default confidence.
// (Keys are English i18n strings translated in ru/endgame.json.)
// ─────────────────────────────────────────────────────────────────────────

type ClusterDetail = {explanation: string; why?: string; confidence?: ChipDetailConfidence; caveat?: string};

const CLUSTER_DETAIL: Readonly<Record<string, ClusterDetail>> = {
  economy: {
    explanation: 'Counts the value the engine produced — discounts, payment bonuses and trade savings that can be measured honestly.',
    why: 'Economy only matters once it becomes points, cards or board presence — it buys options, not VP by itself.',
    confidence: 'measured',
    caveat: 'Card draw is not converted to M€ — it is strategic value, not direct money.',
  },
  economyUpset: {
    explanation: 'The winner did not have the bigger economy — they turned fewer resources into more points.',
    why: 'Efficiency beats raw resources when the conversion into VP is tighter.',
    confidence: 'measured',
  },
  economyConversion: {
    explanation: 'A strong economy that bought tempo rather than the points that decide the game.',
    why: 'Resources are only an advantage if there is still time and room to spend them on scoring.',
    confidence: 'measured',
  },
  economyBurst: {
    explanation: 'A concentrated spike of economic value in a single late generation.',
    why: 'A late burst can fuel a final push exactly when it counts.',
    confidence: 'measured',
  },
  colony: {
    explanation: 'Colonies fed this player\'s engine through repeated trades.',
    why: 'Colony trades are a steady, compounding source of tempo.',
    confidence: 'partial',
  },
  colonyDomination: {
    explanation: 'One player used the colonies far more than the rest — not necessarily owning them all, but holding the trade tempo.',
    why: 'When one player trades far more, colonies become a private engine rather than a shared resource.',
    confidence: 'partial',
  },
  attackPressure: {
    explanation: 'Direct attacks stripped this player\'s resources across the game.',
    why: 'Attacks rarely take VP directly — they cost the victim tempo and options.',
    confidence: 'exact',
  },
  attackDamage: {
    explanation: 'The pressure landed on the resources this player\'s plan depended on.',
    why: 'An attack that hits a player\'s strongest plan does more than its raw resource count suggests.',
    confidence: 'exact',
  },
  productionSteal: {
    explanation: 'Production was not just destroyed — it shifted, slowing the victim and helping the attacker at once.',
    why: 'A transfer is a double swing: the victim loses tempo and the attacker gains it.',
    confidence: 'exact',
  },
  awardRace: {
    explanation: 'The award did not reward its funder — the points went to the opponent.',
    why: 'An award funded by one player but won by another is a swing the sponsor paid for.',
    confidence: 'exact',
  },
  milestoneRace: {
    explanation: 'Who claimed the milestones — and who was locked out of them.',
    why: 'Milestones are first-come points; being shut out of them is a quiet, permanent gap.',
    confidence: 'exact',
  },
  counterplay: {
    explanation: 'One player won a strong category; the opponent answered with a different one.',
    why: 'A strong category alone does not win if the opponent compensates elsewhere.',
    confidence: 'exact',
  },
  unusedMoney: {
    explanation: 'A large pile of resources was left at the finish that never became points.',
    why: 'In Terraforming Mars resources only matter if they convert into VP, cards, board or parameters in time.',
    confidence: 'partial',
    caveat: 'There is no exact proof these resources could have become VP — it is a signal of unused potential.',
  },
  resourceHoard: {
    explanation: 'Building material — steel and titanium — was left unspent at the finish.',
    why: 'Steel and titanium are not VP; left over, they are projects that never got built.',
    confidence: 'partial',
    caveat: 'Leftover material is unused potential, not a guaranteed lost win.',
  },
  almostMoney: {
    explanation: 'The runner-up finished on resources larger than the final gap.',
    why: 'It shows how close the margin was — not that the resources could have become VP.',
    confidence: 'partial',
    caveat: 'No direct conversion of leftover resources to VP is claimed.',
  },
  almostPenalty: {
    explanation: 'Penalty VP the runner-up lost exceeded the final margin.',
    why: 'Penalties are a direct, avoidable VP loss — here they were larger than the gap itself.',
    confidence: 'exact',
  },
  runnerUp: {
    explanation: 'The category the runner-up won — and what the winner covered it with.',
    why: 'It pinpoints exactly where second place was strong, and where it was answered.',
    confidence: 'exact',
  },
  turningPoint: {
    explanation: 'The winner trailed, then surged ahead late and held the lead.',
    why: 'A late lead change is the rarest, most decisive shape a game can take.',
    confidence: 'exact',
  },
  duelContrast: {
    explanation: 'Two different plans collided — and one proved better suited to this game.',
    why: 'The result was a clash of approaches, not just a higher score.',
    confidence: 'measured',
  },
  oneCategoryTrap: {
    explanation: 'A player ran away with one category but lacked the breadth to win.',
    why: 'One dominant category rarely wins alone — the points are spread across several races.',
    confidence: 'exact',
  },
  narrowEfficiency: {
    explanation: 'The winner dominated no single race but had enough in each to edge ahead.',
    why: 'A broad, balanced game can win without an MVP factor.',
    confidence: 'exact',
  },
  reveal: {
    explanation: 'This player saw more cards than usual through reveals and searches.',
    why: 'More cards seen means more options and a smoother engine.',
    confidence: 'exact',
  },
  cardFlow: {
    explanation: 'A steady flow of cards fed this player\'s scoring engine.',
    why: 'Card flow turns into points only when it is converted — here it was.',
    confidence: 'measured',
  },
  vermin: {
    explanation: 'Vermin grew animals that pressure every player\'s cities at scoring.',
    why: 'It is a slow, board-wide tax rather than a single hit — easy to under-rate.',
    confidence: 'partial',
  },
  predators: {
    explanation: 'Predators repeatedly hunted an opponent\'s animals off their cards.',
    why: 'It directly dismantles an animal engine the opponent was counting on.',
    confidence: 'exact',
  },
  resourceDisruption: {
    explanation: 'An opponent\'s card-resource engine was broken by repeated removal.',
    why: 'Resources stripped off a card are growth the opponent will never get back.',
    confidence: 'exact',
  },
  plantDenial: {
    explanation: 'Plants were stripped before they could become a greenery.',
    why: 'Denied plants are greeneries — and the board points with them — that never happened.',
    confidence: 'exact',
  },
  actionEngine: {
    explanation: 'A blue-card action fired repeatedly as a core engine.',
    why: 'A repeatable action compounds: every generation it adds value for free.',
    confidence: 'exact',
  },
  terraform: {
    explanation: 'This player drove the global parameters more than anyone.',
    why: 'Moving the planet is direct TR — but it is only part of the final score.',
    confidence: 'exact',
  },
  globalMismatch: {
    explanation: 'The most terraforming and the win belonged to different players.',
    why: 'It shows the game was decided off the visible board — in cards or laurels.',
    confidence: 'exact',
  },
  standardProject: {
    explanation: 'Standard projects were a steady, reliable plan rather than a card engine.',
    why: 'Projects are dependable points when the draw never delivers a combo.',
    confidence: 'exact',
  },
  projectStarvation: {
    explanation: 'Heavy standard-project use alongside thin card scoring.',
    why: 'Projects filled in for a card engine that never arrived.',
    confidence: 'exact',
  },
};

// Special by-id details (clusters that don't capture the meaning on their own).
const ID_DETAIL: Readonly<Record<string, ClusterDetail>> = {
  'cards.best-loser': {
    explanation: 'The single most valuable card of the game belonged to the player who lost.',
    why: 'A game is decided by the sum of categories and tempo, not by one big card.',
    confidence: 'exact',
  },
};

function clusterKey(c: InsightCandidate): string {
  return c.storyCluster ?? c.family ?? c.group;
}

/** Map evidence chips → detail rows (reused verbatim — same numbers as the card). */
function chipsToRows(c: InsightCandidate): Array<DetailEvidenceRow> {
  return (c.evidenceChips ?? []).map((ch) => ({t: ch.t, v: ch.v, tone: ch.tone}));
}

/**
 * Build the explainability detail for an insight, or undefined when the badge is
 * self-evident (no registered explanation) — the popover simply won't attach.
 */
export function buildInsightDetail(c: InsightCandidate): ChipDetail | undefined {
  const base = ID_DETAIL[c.id] ?? CLUSTER_DETAIL[clusterKey(c)];
  if (base === undefined) {
    return undefined;
  }
  // Confidence: an explicit exact/measured chip on the card overrides the cluster default.
  let confidence = base.confidence;
  for (const ch of c.evidenceChips ?? []) {
    if (ch.t === 'i18n' && (ch.v === 'exact' || ch.v === 'measured')) {
      confidence = ch.v;
    }
  }
  return {
    title: c.badge,
    explanation: base.explanation,
    whyItMatters: base.why,
    evidence: chipsToRows(c),
    confidence,
    caveat: base.caveat,
    accent: c.family,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Player STYLE explainability — "why did the engine call them an Aggressor?"
// Mirrors insightEngine.duelStyle's signals so the evidence matches the label.
// ─────────────────────────────────────────────────────────────────────────

type StyleDetail = {explanation: string; why: string};

const STYLE_DETAIL: Readonly<Record<string, StyleDetail>> = {
  'Disruptor': {
    explanation: 'This player leaned on direct interaction — attacks, resource loss and production cuts against opponents.',
    why: 'A disruptive plan doesn\'t just score; it breaks the opponent\'s tempo and plan.',
  },
  'Colony Trader': {
    explanation: 'This player used colonies as an engine — trading often and leaning on colony bonuses.',
    why: 'Colonies became a separate, compounding source of tempo rather than a one-off bonus.',
  },
  'Terraformer': {
    explanation: 'This player drove the planet itself — temperature, oxygen, oceans — for steady terraform rating.',
    why: 'Terraforming is direct, reliable TR that grows the score every step.',
  },
  'Card Engine': {
    explanation: 'This player made cards the core of the plan — drawing, scoring and value from the deck.',
    why: 'A card engine hides much of its scoring off the visible board.',
  },
  'Board Builder': {
    explanation: 'This player built on the planet — cities and greenery driving board points.',
    why: 'Board presence is visible, defensible scoring that also moves oxygen.',
  },
  'Economy Engine': {
    explanation: 'This player built a strong economy — discounts and payment value funding the whole plan.',
    why: 'Economy buys options and tempo, the runway every other plan is paid for with.',
  },
  'Standard Project Builder': {
    explanation: 'This player leaned on standard projects — the steady, reliable plan over a card combo.',
    why: 'Projects are dependable points when the draw never delivers an engine.',
  },
  'Blue Action Engine': {
    explanation: 'This player built repeatable blue-card actions, firing them many times.',
    why: 'A repeatable action compounds: free value every generation.',
  },
  'Award Hunter': {
    explanation: 'This player chased milestones and awards as a primary source of points.',
    why: 'Laurels are a hidden race — points that don\'t show on the board.',
  },
  'Card Flow': {
    explanation: 'This player saw far more cards than usual through reveals and searches.',
    why: 'More cards seen means more options and a smoother engine.',
  },
  'Balanced': {
    explanation: 'This player won no single category outright but scored enough across several directions.',
    why: 'A broad profile usually means a stable, well-rounded win without one MVP factor.',
  },
};

/** The evidence rows that justify a style, derived from the player's facts. */
function styleEvidence(ctx: InsightContext, color: Color, style: string, p: EndgamePlayerScore | undefined): Array<DetailEvidenceRow> {
  const rows: Array<DetailEvidenceRow> = [];
  const attacks = facts(ctx).filter((f) => f.type === 'negativeInteraction' && f.player === color);
  const lostTo = facts(ctx).filter((f) => (f.type === 'negativeInteraction' || f.type === 'cardAttack') && f.targetPlayer === color);
  const colony = factOf(ctx, 'colony', color);
  const econ = factOf(ctx, 'economy', color);
  const sp = factOf(ctx, 'standardProject', color);
  const reveal = factOf(ctx, 'reveal', color);
  const actions = facts(ctx).filter((f) => f.type === 'actionUsage' && f.player === color);
  switch (style) {
  case 'Disruptor': {
    const dealt = attacks.reduce((s, f) => s + m(f, 'totalLost'), 0);
    if (attacks.length > 0) {
      rows.push(rawRow(`×${attacks.length}`, 'bad'));
    }
    if (dealt > 0) {
      rows.push(rawRow(`−${dealt}`, 'bad'));
    }
    break;
  }
  case 'Colony Trader': {
    rows.push(rawRow(`${m(colony, 'trades')}`, 'good'), i18nRow('trades', 'neutral'));
    if (m(colony, 'trackBonusSteps') > 0) {
      rows.push(i18nRow('track bonuses', 'neutral'));
    }
    break;
  }
  case 'Economy Engine':
    rows.push(rawRow(`+${m(econ, 'savedMegacredits')}`, 'good'), i18nRow('measured', 'neutral'));
    break;
  case 'Standard Project Builder':
    rows.push(rawRow(`${m(sp, 'projects')}`, 'metric'), i18nRow('parameter steps', 'neutral'));
    break;
  case 'Blue Action Engine':
    rows.push(rawRow(`×${actions.reduce((s, f) => s + m(f, 'activations'), 0)}`, 'good'), i18nRow('blue action', 'neutral'));
    break;
  case 'Card Flow':
    rows.push(rawRow(`${m(reveal, 'revealed') + m(reveal, 'shown')}`, 'metric'), i18nRow('cards seen', 'neutral'));
    break;
  default:
    break;
  }
  // Always add the player's strongest VP category as supporting evidence.
  if (p?.strongestCategory !== undefined) {
    rows.push(i18nRow(CATEGORY_LABEL_KEY[p.strongestCategory], 'good'));
  }
  // If they were attacked, note it (context for any style).
  const received = lostTo.reduce((s, f) => s + (m(f, 'totalLost') || m(f, 'total')), 0);
  if (received >= 6 && style !== 'Disruptor') {
    rows.push(rawRow(`−${received}`, 'bad'));
  }
  return rows.slice(0, 4);
}

const CATEGORY_LABEL_KEY: Record<EndgameCategoryKey, string> = {
  tr: 'Terraform rating', cards: 'Cards', board: 'Cities & greenery',
  mca: 'Milestones & awards', moon: 'Moon', tracks: 'Planetary tracks',
};

/** Whether the style verdict rests on thin evidence (honest caveat in the popover). */
function styleIsThin(rows: ReadonlyArray<DetailEvidenceRow>): boolean {
  return rows.filter((r) => r.t === 'raw').length <= 1;
}

/**
 * Build the explainability detail for a player STYLE chip — the flagship "why did the
 * engine call them X?" Reuses the SAME facts duelStyle reads.
 */
export function buildStyleDetail(ctx: InsightContext, color: Color, style: string): ChipDetail {
  const p = ctx.players.find((x) => x.color === color);
  const meta = STYLE_DETAIL[style] ?? STYLE_DETAIL.Balanced;
  const evidence = styleEvidence(ctx, color, style, p);
  return {
    title: style,
    explanation: meta.explanation,
    whyItMatters: meta.why,
    evidence,
    confidence: style === 'Economy Engine' || style === 'Colony Trader' ? 'measured' : 'exact',
    caveat: styleIsThin(evidence) ? 'This style is read from limited data — the main signal is shown above.' : undefined,
    accent: 'duelContrast',
  };
}
