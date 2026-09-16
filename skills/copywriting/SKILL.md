---
name: copywriting
description: Writes user-facing product or marketing text, including onboarding, UI states and translations. Not for logs or code comments.
---

# Copywriting — copy first, then implement

This is a **workflow pattern plus a writing-system document**, not a single-agent skill. The writing
system rides VERBATIM in every copy prompt; the workflow is what turns it into strings in the code.
Everything project-specific enters as **INPUTS** — a facts/source doc, a voice sample set, an intent
catalog — and nothing brandful, nothing product-named, lives in the skill itself. Swap the inputs and
the same machine writes for a different product.

Run it as a `Workflow()`: one intent phase, a fan-out of writers (one per item), a mechanical gate,
parallel verification seats, and a user who ships.

## When to use it

Trigger: **any increment that puts human-readable strings into a product.**

**The copy phase runs BEFORE implementation.** Implementation must consume *finished* strings.
Placeholder copy in the tree leaks to production renders — that is not a hypothetical, it is what
placeholders do — so the increment's strings are settled, verified and keyed before the implementer
starts. `implement-review-verify` then treats the copy artifact as part of its spec.

Do NOT use it for internal-only text — logs, code comments, developer-facing errors — which is text
in the *codebase*, not in the product. Everything user-visible is in scope; what scales is the
fan-out, not the trigger. A single string still gets an intent, the writing system and a named source
line; it just gets one writer and the critic instead of a full phase.

## The two-layer contract

Two documents, and keeping them separate is the whole discipline.

### Intent catalog — per increment, the WHAT

Every visible string gets a key plus a **goal-level intent**:

- **what the string must communicate** — the claim, not the phrasing;
- **its audience beat** — where the reader is when they hit it, and what they need next;
- **its constraints** — interpolation params, casing rules, a length **budget for the whole slot**;
- **its data shape** — line-break convention, interpolation slots, plural forms;
- **a classification: copy key vs invariant data.** Proper nouns, product names, numerals and
  identifiers are invariant data and are never rewritten or "translated"; everything else is a copy
  key.

**An intent must NEVER carry example prose or the designer's imagery.** This rule is load-bearing: an
intent that prescribes imagery turns the writer into a translator of someone else's draft instead of
someone writing from the goal. State the communicative goal; let the writer construct the sentence.

### Writing system — global, the HOW

One document, phrased **positively with a pass/fail check on every rule**. Prohibition-framed rules
("don't be salesy") fail: the model needs the replacement named, not the vice.

**Page layer.** One page, one action. The headline names the **reader's outcome**, and passes the
competitor-swap test — if a competitor could paste it unchanged, it says nothing. Every claim carries
its proof within a screen. Build from the customer's verbatim words. Prefer nouns, verbs and numbers
over adjectives. Second person, active voice, present tense. Buttons complete "I want to ___". Name
the objections instead of hoping they go unasked. One name per thing, everywhere. Then cut, read
aloud, and stranger-test.

**Generation layer.** Load the SOURCE block before asking for a single word — every claim must trace
to a source line. Specify the sentence (below). Use a positive punctuation palette: periods, commas,
colons, question marks; a pivot gets a colon or two sentences. Set a **concreteness quota** per
section — at least one number, name, or observable detail taken from SOURCE. Give slot structure with
word budgets. Supply 2–3 admired samples to match sentence-length distribution. Mandate variants for
load-bearing strings. Run a separate fresh-context critic. Do the mechanical punctuation pass **last**,
by hand, converting the em-dash/en-dash/semicolon habits and the "not just X, it's Y" frame.

## Specify the SENTENCE, not the vibe

The single most important idea in this skill.

**Texture adjectives in a prompt — "punchy", "snappy", "bold", "crisp" — directly produce the
fragment-triad tell they were gesturing away from** ("Verified. Ready. Go."). The model has no
grounded referent for a texture word, so it reaches for the most-marked surface pattern it knows.

Replace the vibe with a **construction spec**: every sentence has a subject and a finite verb; 8–22
words; alternating lengths across the slot. That makes the tell *structurally impossible* rather than
discouraged. Same rule for length: **budget the SLOT total, never per line.** A per-line character
budget is read as "one fragment per line" and manufactures the staccato directly. A line break is
where a sentence *wraps*, never where it *ends*.

## Voice and tone are INPUTS, never hardcoded

Three inputs, supplied per project, carried verbatim in every copy prompt:

1. **A register sentence naming speaker and situation** — "a knowledgeable friend explaining this
   across a table" — never texture adjectives. Speaker + situation is checkable; "warm but
   professional" is not.
2. **2–3 admired samples**, present so the writer can match the *sentence-length distribution*, not to
   be imitated phrase-for-phrase.
3. **A SOURCE block** — the facts doc every claim must trace to, line by line. No source line, no
   claim; the writer names the line it used.

The skill never states what the voice is. A skill that hardcodes a voice is a brand guideline wearing
a workflow costume.

## Mandated variants and the human-judgment zone

For load-bearing strings (headline, hero, primary CTA), the model does not produce *an* answer — it
produces **structurally distinct variants**, each naming its source line. A standing set of five for a
headline: the outcome, the reader's question, a customer quote, the mechanism, a number. Structurally
distinct means a different construction, not the same sentence reworded.

**A person ships one.** The hero and the headline are a human-judgment zone: the model supplies
candidates, the user picks. This is not a bottleneck to optimize away — variant generation is cheap
and picking is exactly the part a model cannot ground.

## Multilingual (only if the product ships more than one locale)

Skip this section entirely for a single-locale product.

**One agent per locale, all locales in ONE parallel phase, each deriving NATIVELY from the intent.**
Never translate a pivot language; never go locale-to-locale. An approved source-language string is
only *that language's* realization of the intent — pivot translation produces translated register
everywhere, in every other locale at once.

Carry the intent as a **comment at the key's reference site** in the component source, so a future
re-derivation needs no archaeology to recover what the string was supposed to do.

**Syntax law is a mechanical check, not a writer's promise.** String libraries reserve meta-characters
(plural or context separators, interpolation delimiters); one left unescaped can silently truncate a
rendered string with no error anywhere. Ban them unescaped and grep for them in the gate. Also gate
**key parity**: exact key-set equality across locales, because a missing key renders a raw keypath to a
visitor.

## Verification — what makes this a workflow

Four stages, in this order: a tool, two agents, a person.

1. **Mechanical gate — a committed ONE-COMMAND TOOL, not a seat.** It RECOMPUTES everything from the
   files: key parity across locales, slot budgets, syntax law, the forbidden-literals grep, and a
   source-language leak check (a value identical to the pivot's is suspect). Commit it as a script
   and put the exact invocation in every prompt, because several seats hand-rolling the same checks
   is cost with a disagreement risk attached. It has no prompt template because it has no judgment to
   template. **It never trusts a writer's self-report** — a self-report is only a truncation and
   dishonesty detector, never evidence.
2. **Source-verify seat** (`agentType:'copy-source-verify'`) — a **detail-strong model, never the
   smallest**. Every factual claim against the facts doc *and* the live artifact. Register discipline
   in every language, including the ones nobody on the team reads (wording that implies a temporary
   state where a permanent one is promised is the standing example). Superlatives need grounding.
   **Observed, not recalled:** agents will confidently misremember the wording of real-world artifacts,
   so fetch and transcribe, label such data "observed", and never let an agent cite an authority it did
   not check.
3. **Fresh-context critic** (`agentType:'copy-critic'`) — a seat that never saw the writing happen.
   Models audit far better than they compose. It names each sentence's source line, lists every
   sentence lacking a subject and a finite verb, and counts the tell markers. It audits; it never
   rewrites.
4. **A user reads the load-bearing strings before ship.** Non-negotiable, and cheap: it is a handful
   of sentences.

Alongside stages 2 and 3 — inside Verify, and always **before** the user — runs the **completeness
pass**: "which item is missing entirely?" Per-item checks structurally cannot see an absent item, and
absences are the worst defect class to ship, so the question gets asked once, explicitly, of the
whole work-list.

## The forbidden-literals manifest

When the copy replaces a design draft's placeholder prose, enumerate the draft's **distinctive
phrases** as an explicit, greppable ban list — all locales, calques included — with generic chrome
vocabulary ("Sign in", "Learn more") exempted.

"Don't copy the draft" is unenforceable without an executable check. The manifest is that check, and it
runs in the mechanical gate.

## The shape

Five phases: **Intent → Write → Gate → Verify → User.**

- **Intent** — the catalog above is written or ruled before any writer starts. No catalog, no launch:
  without goal-level intents the writers each invent their own bar and the critic has nothing to check
  against.
- **Write** — a fan-out of `agentType:'copywriter'`, **one item per agent**. One agent writing N
  sections or N locales is a batch grind: quality degrades at the tail and absences hide inside a
  plausible-looking report. Each writer gets the writing system verbatim, its ONE intent, the voice
  inputs and the SOURCE block.
- **Gate** — mechanical, recomputed from the files, run before a user's attention is spent.
- **Verify** — `copy-source-verify` and `copy-critic` in parallel (they share no state), plus the
  completeness pass.
- **User** — picks the variants for load-bearing strings and reads them in place.

## Laws

1. **Copy first; implementation consumes finished strings.** No placeholder prose ever lands in the
   tree.
2. **One item per agent.** Never a batch grind, and always an end-of-run completeness pass over the
   work-list.
3. **Every claim traces to a SOURCE line, named.** No source line, no claim.
4. **Gates recompute from artifacts.** A self-report is never evidence.
5. **Explicit model AND effort on every seat, never inherited** — and never the smallest model on the
   source-verify seat.
6. **The user ships the load-bearing strings.** The model supplies structurally distinct variants.

## Agent prompt templates (verbatim base, append-only)

Every agent this skill spawns has a fixed template in `agents/` — `agents/copywriter.md`,
`agents/copy-source-verify.md`, `agents/copy-critic.md`. That file's body is the agent's
**authoritative rules** and is used **VERBATIM** as the start of its prompt; invoke via
`agentType:'copywriter'` / `'copy-source-verify'` / `'copy-critic'`. The string passed to `agent()` is
**ONLY the task-specific context APPENDED** after that base — the writing system, the item's intent,
the voice inputs, the SOURCE block. Do NOT modify, reorder or paraphrase the base rules inline.

## What did NOT work (keep these)

The most valuable section in the skill. Each of these was tried and produced worse copy.

- **Pivot translation** (write one language, translate outward). Produces translated register in every
  other locale simultaneously — the source string is only one language's realization of the intent.
  Killed in favour of native derivation from the intent, per locale.
- **Per-line character budgets on headlines.** The writer reads "≤16 characters per line" as "one
  fragment per line" and ships the staccato tell. Budget the slot total instead; a line break is where
  a sentence wraps, not where it ends.
- **Texture adjectives in prompts** ("punchy", "snappy", "bold"). They directly produce the fragment
  rhythm they were meant to prevent, because the model has no grounded referent for them. Specify the
  sentence construction instead.
- **One-shot batch grinds** (one agent writing N locales or N sections). Quality degrades at the tail
  and absences hide. Decompose per item and add a completeness pass, because per-item checks
  structurally cannot see a missing item.
- **Intents that carry the draft's imagery.** The writer then translates the draft instead of writing
  from the goal. Intents state the communicative goal only.
- **Storing uppercase strings.** Casing is presentation: store regular case and uppercase in CSS,
  otherwise every token's casing dies in every locale that cases differently.
- **Placeholder copy in the tree.** It leaks to production renders. Copy phase first; implementation
  consumes finished strings.
- **Prohibition-framed style rules** ("don't be salesy"). The model needs the replacement named, not
  the vice. Every rule is a "do" with a pass/fail check.
