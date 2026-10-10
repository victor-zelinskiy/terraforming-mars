/**
 * WHAT A CARD'S STORED RESOURCE IS FOR — the ROLE of a holder (PL-030 /
 * PL-075, the TR34 walk): the one vocabulary the ДОП. РЕСУРСЫ satellite splits
 * its chips by and the played-target step names a candidate's value with, so
 * a mech on EVA Mechs («5 M€ for a Space card»), on Mech Sports («1 VP»), on
 * Mars Army Mechs («a delegate on a resolution») and on Automated Convoys («a
 * free trade») never read as one number under one coin.
 *
 * Two roles are STRUCTURAL on the client and need no declaration: a PAYMENT
 * unit (`CARD_FOR_SPENDABLE_RESOURCE` names the enabling card) and VP
 * (`victoryPoints.resourcesHere`). The two that no structure tells are
 * DECLARED by the card itself, co-located (`ICard.resourceRole`, exported to
 * the client card): a resource SPENT FOR A DELEGATE (the census family — TR15,
 * TR24, TR34, TR35) and a resource SPENT FOR A TRADE (TR66). A holder with no
 * role of either kind is plain STORAGE and says nothing.
 */
export type DeclaredHolderRole = {kind: 'delegate'} | {kind: 'trade'};
