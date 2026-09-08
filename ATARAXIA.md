# ATARAXIA

*A constitution for commerce infrastructure that returns the intent layer to the person.*

> Freedom from the anxieties of buying.

Ataraxia is Greek for freedom from disturbance. It is the state this work is for, and it is the name of this constitution, of the mark that certifies conformance to it, and of the foundation that will one day hold both.

Ataraxia is not a product. Products conform to it. [Atarasy](#the-family) is one such product; anyone may build another, and anyone may fork ours. What no one may do is claim conformance without passing the tests.

----

## Why a list of things that cannot be done

Agentic commerce protocols separated, for the first time and at the level of a specification, the party that **forms intent** from the party that **fulfils orders**. Model vendors assume the intent layer is theirs. No specification says so. The seat can be held by a human curator, by a friend, or by the person's own agent.

Software that holds that seat will be asked, every quarter, to convert it into rent. Countdown timers, urgency, retargeting, abandoned-cart mail, paid placement in a recommendation. Each is a small local optimum. Together they are the reason no one trusts a shopping interface.

A settings toggle does not prevent this. A toggle preserves the temptation and postpones it. **This document is a list of things that cannot be built, not a list of things we promise not to build.** Where a clause says a capability does not exist, the correct implementation has no API for it, no table for it, and no configuration that restores it.

The method is borrowed. Removing a setting removes the temptation along with it.

----

## Enforcement

| Enforced at | Clauses | Mechanism |
|---|---|---|
| The hub (the approval surface a member sees) | 6, 7, 8, 10 | Open source, public conformance tests, the right to fork |
| The engine (the state machine) | 2, 3, 4, 5 | Absent APIs cannot be called |
| The foundation and the mark | 1, 9, 11 | Trademark licence, conformance tests, sortition jury |

Amendment requires a jury drawn by lot from members, plus the consent of the foundation. It is not amendable by a vote that can be mobilised.

----

## 1. Structure

1. The infrastructure does not sit in the intent layer. It resolves and does not rank: it has no search, no ranking, and no answer that depends on who asks or on what they want.
2. Identity has a root outside this system, one per person. Nothing here issues an identity: not the hub, not a node, not a host.
3. Everything a member touches can be replaced by the member: the password manager, the model, the host, the merchant. What cannot be removed is the enforcement point and this constitution. The enforcement point is a conforming hub, and any conforming hub will do; this one is published and forkable.
4. No fee on the person side is a function of what was bought, and no fee on the merchant side is a share of what was sold. One party may operate both sides; the party that certifies conformance operates neither.
5. What a member runs and what conformance is judged by are open source: the hub, the node, the specification, the reference engine and the tests. A merchant-side platform may be closed. Whatever it is, it holds no position the tests do not grant, and a merchant can leave it with its data.
6. A person's agent prefers a merchant for what it does, never for where it is hosted: no entry, endpoint or feed names a platform, and the agent has no field to prefer on. Conformance is the one property of a host it may weigh. Every exclusion the agent makes shows the person the published rule that made it.
7. Data is used where it is. A grant moves; the data it covers does not, and nothing here needs a copy of it first. What does travel, an edge, a receipt, a history returned, travels toward the person and never toward a centre.
8. What was declined is recorded where it was decided, in the person's node, across every merchant. A merchant holds what was declined to it and nothing declined elsewhere. No party but the person holds the union.
9. A preference model lives in one vertical: a merchant's own ledger, or a person's own node. The platform infers nothing across merchants and nothing across nodes: what it returns is what the merchant or the node sent. Across nodes, a person may grant their data to a computation; the grant is asked for that use, and the result is a form from which no node can be recovered.

## 2. Curators and merchants

10. A price is the merchant's, the same to everyone, and it travels from the merchant's own feed. No curator, representative or platform has a field, a parameter or a configuration that raises it. A buyer pays the merchant's price and nothing more.
11. A curator is not the seller. The merchant of record is the merchant, named on every line of every receipt; a curator that signs a receipt signs as the merchant's disclosed agent.
12. The merchant is never hidden. Every candidate, every receipt and every edge names who made it and who ships it.
13. Participation does not require a merchant to join a programme. An ACP-compatible feed is sufficient.
14. A brand cannot buy a slot. Its contribution is the cost of goods offered, and payment is on outcome only. Ranking, exposure and placement are not for sale.
15. There is an upper bound on households per representative.
16. There is no broadcast, no segment extraction, and no automated recommendation to the person. A message has one household as its recipient. Predictions are handed to a human, and the human chooses.
17. We do not promise that marketing becomes unnecessary. We say a merchant joins a network.

## 3. Gifts and the network

18. You cannot give what you have not tried. Sampling is required, not optional.
19. No negative signal is returned to the giver. The absence of a reorder, an unopened parcel, silence: none of these appear on the giver's screen.
20. Positive signals are visible only as acts of the recipient, such as giving the item onward, reciprocating, or writing thanks. Purchases the system observed are never shown.
21. Reciprocation is never prompted. It is made easy; it is not notified and it has no deadline.
22. A recipient's profile starts empty. Beyond the fact of receipt, nothing is recorded until they become a giver themselves.
23. Whether a recipient's list may be used to avoid duplicate gifts is decided by the recipient alone.
24. Lineage shows people and does not hide merchants. Network size is never displayed. What is shown is density within one's own circle.
25. A lineage edge is recognised by the person's key and the merchant's receipt. It is not discriminated by which hub produced it.

## 4. Replacing the catalogue gift

26. Price tiers remain. Legibility of price band is not sacrificed.
27. The recipient chooses. The giver does not see the candidates.
28. If nothing is chosen before the deadline, a default item ships. No revenue is earned from unredeemed gifts.
29. Cards and wrapping match the incumbent exactly, down to denominational wording.

## 5. Models and the engine

30. Selling out is prohibited by specification. Every offer must contain a minimum number of candidates the model predicts will not convert. This is the exploration floor.
31. There are no star ratings. The only review is one line written by oneself, visible to oneself and the recipient.
32. There are no discount codes.
33. Analytics are aggregate only. No capability exists to store per-person events. There is no socket for third-party pixels, which makes retargeting technically impossible.
34. No API exists to implement countdown timers, scarcity pressure, exit-intent interstitials, or automated abandoned-cart mail.
35. The agent does not interpret. When interpretation is required it stops and hands the decision to a human. Escalation beats any terminal action.

## 6. Drafts and approval

36. Unconfirmed means no order. An order is a debt; "same as last time" is never the default.
37. Confirmation is one tap. A reminder is sent at most once.
38. Endpoints are built to ACP and UCP so that the person's own agent can call the same ones.
39. Confirmation is signed as an AP2 mandate.
40. The reason an order was not executed is shown to the person.

## 7. Data sovereignty

41. Permission is requested at the moment of use, scoped and time-limited. Blanket consent in a settings screen does not exist.
42. The default recipient of data is the person's own agent and nothing else. Retailer models, advertising and research each require explicit permission.
43. A person does not sell their data. No capability to sell it is built. Value is returned as function. The single exception is aggregated, consented, compensated research participation.
44. The list of permissions is always visible and each can be revoked individually.
45. Changing the model behind an agent does not move the permission ledger or the records.
46. An agent does not prefer merchants that do not return data.
47. Customer data is retained in a form the customer can export in full at any time. A ledger belongs to the shop, not the representative, and the shop holds the right to export it.

## 8. The intermediary and protection

48. The intermediary has no discovery, no search and no ranking.
49. It is an agent, not a reseller. It never holds title to goods, not for an instant.
50. Payments to merchants outside the network are capped. A member may lower the cap; the layer may not raise it.
51. Mandate thresholds and family co-signature are set while the person has capacity, and cannot be loosened without the consent of both the person and the named family member.
52. The agent does not execute an order where it detects auto-renewing subscriptions, obstructed cancellation, or manufactured scarcity. It shows the person why.
53. Identity and payment credentials do not reach the merchant. Tokenisation and anonymised delivery are the default.
54. Free shipping is never promised. The conditions for consolidation are stated plainly.

## 9. Billing and the merchant-side platform

55. The billing layer's own fee is per attempt and arithmetically independent of the verdict. Neutrality is structural, not a policy.
56. The unit of billing is work, not tokens.
57. Payment processing passes through at cost. The platform charges for the shop's work, never touching the shop's revenue.
58. A shop's product ledger and customer ledger belong to the shop and are exportable in a standard format at any time.

## 10. Keys, nodes and the hub

59. The hub is published as open source, its enforcement of this constitution is verifiable in code, and it can be forked.
60. The only thing asked of a password manager is a signature. Not the screen, not credential injection, not the recovery policy.
61. The default host is replaceable and blind. A member can move an entire node to another host.
62. Recovery and routine reading are separate powers. A recoverer cannot read. Recovery is logged and the person is notified.
63. The approval screen is drawn by a party to no transaction. Not by the merchant, not by the password manager, not by the model.
64. The mark attaches to software and hosts. Merchant endpoints and lineage do not discriminate on it. No mark that grades members is created. A fork may be excluded only inside one person's own mandate, by the person protecting them.

## 11. Organisation

65. Seats in governance are not for sale. Patrons are treated identically regardless of amount.
66. This constitution is amended by a jury drawn by lot together with the foundation's consent. It is not amended by approval flows, which are vulnerable to mobilisation.
67. A standing mandate lapses unless renewed. An individual approval never passes by silence.
68. An agent's proposal carries alternatives and the argument against. Members can raise proposals themselves.
69. Membership fees are not balances. A balance redeemable against goods is a prepaid payment instrument.
70. No escrow is held. Custody of funds belongs to a licensed party.

----

## What this constitution does not protect

It protects the person. It does not protect other people, and it does not protect merchants.

- Someone running a fork with the constitution removed has removed their own protection. That is what the right to exit means. Their gifts still enter lineage, provided the identity and the transaction are real.
- A member using an ad-supported fork is influenced by advertising. Human gift-giving has always been influenced by advertising, and lineage is a human record including that. We do not prevent it.
- Someone who genuinely needs protection, such as a parent losing capacity, is protected by the family who protects them, through conditions inside that person's own mandate. Not by a gate on the network.

----

## The family

| Name | What it names |
|---|---|
| **Ataraxia** | This constitution, the conformance mark, and the foundation that will hold them. The object of "conforms to". |
| **Atarasy** | The reference hub. What a member opens. Open source; a fork may claim Ataraxia conformance but not this name. |
| **Valence** | The specification and engine. A candidate's outcome is its valence: `kept`, `returned`, `consumed`, `defaulted`, `lost`. Where other commerce specifications describe what was bought, this one treats what was declined as a first-class event. Published at [atarasy/valence](https://github.com/atarasy/valence). |

A merchant exposes **Valence**-conformant endpoints and carries the **Ataraxia** mark. A member opens **Atarasy**. The three are objects of different sentences, which is how a foundation can hold a reference implementation and still certify others.

----

## Status

Draft, September 2026. Written by the founder, deliberately, before there are members to write it. The rule adopted is that **the list of things that cannot be done is written by the founder, and the order in which things get built is written by members.** Prohibitions are handed over settled; direction is deliberated.

Until the foundation exists, the trademarks are held personally and licensed to conforming implementations. This is a weakness, not a design: a layer that claims to act for people should not depend on one person's reputation. The foundation is a question of when, not whether.

This document also currently lives under the organisation named after the reference hub, which reads as though the constitution belonged to a product. It is the other way round, and the arrangement is provisional; the constitution and its conformance tests move to a neutral organisation when the foundation is established.

----

## Licence

[MIT](LICENSE). The licence covers the text. It does not grant rights to the Ataraxia, Atarasy or Valence names; see [TRADEMARKS.md](TRADEMARKS.md).
