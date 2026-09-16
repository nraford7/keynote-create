# Keynote Create

**Turn source material into a presentation whose headlines tell the whole argument.**

Give it research notes, a report, a draft, interview findings or an existing deck. It helps identify the point, builds a connected headline sequence, checks the claims against your material, then produces slides you can present in a browser or share as a PDF.

Keynote Create is an agent skill for **Claude Code and Codex**. “Keynote” describes a presentation style: it does **not** create Apple Keynote `.key` files or PowerPoint `.pptx` files.

## What you get

- **An editable Markdown deck:** the headlines, supporting content and delivery notes.
- **An HTML presentation:** open it in a browser; press `p` to present, use the arrow keys to advance, and press Escape to leave presentation mode.
- **A PDF:** for review, sharing or printing.
- **Separate review records:** the writing brief, source notes and checks stay outside the presentation.

Optional extras include a full speaker script with timings, a workshop worksheet when there are activities, and publishing a separately prepared public version to your website.

## One rule, two presentation styles

**Read the headlines in order and you should understand the entire argument.** Each headline introduces a point, builds on the previous one or takes the argument to its conclusion. Supporting text, images and narration add depth; they cannot fill gaps in the reasoning.

| | Boardroom | Keynote |
|---|---|---|
| Best for | Decisions, strategy, research and material people will read independently | Talks, pitches and presentations delivered by a speaker |
| Visual approach | Text, evidence, charts and structured layouts | Large images, sparse captions and visual contrasts |
| Headlines | Usually complete sentences | Connected fragments, clauses or short sentences |
| Supporting detail | More of it appears on the slide | More of it can sit in delivery notes |
| What stays the same | The headline sequence carries the complete argument | The headline sequence carries the complete argument |

A Keynote headline does not need to be a complete sentence. **The sequence does need to be a complete argument.** A list such as “The problem / Our findings / Next steps” fails in either mode, even if a spoken script explains it beautifully.

## A worked example

Suppose your source says:

> Twenty employees volunteered for a four-week pilot of a new tool. All twenty reported satisfaction. Productivity was not measured, there was no control group, and operating costs are unknown. The team recommends a capped four-week extension to measure productivity and costs before deciding on wider expansion.

The audience is the operations director. The decision is whether to approve the extension.

The same argument could become:

| Slide | Boardroom headline | Keynote headline |
|---|---|---|
| 1 | Extend the pilot to gather evidence before deciding on wider expansion. | A limited extension before wider expansion. |
| 2 | All twenty pilot volunteers reported satisfaction. | Twenty satisfied volunteers. |
| 3 | Productivity was unmeasured, there was no control group, and costs remain unknown. | But productivity unmeasured, no control, costs unknown. |
| 4 | Approve four more weeks to measure productivity and costs. | Approve four more weeks to measure productivity and costs. |

Read either column from top to bottom. The recommendation, evidence, limitations and decision are all there without a speaker filling in the logic.

The source does **not** support “The pilot proved productivity gains.” The evidence review should reject that claim, however persuasive the slide looks. The review compares your deck with the material you supplied; it does not independently establish that every statement in that material is true.

A [small example deck](docs/fixtures/sample-ne.md) is included so you can inspect the Markdown format and try the renderer.

## How it works

1. **Understand the material and the audience.** Establish who the deck is for and what they should understand, decide or do. Read the source for its strongest evidence, limitations and possible main points.
2. **Agree on the argument.** Build a plain outline before choosing a storytelling structure. The default puts the answer early. A reveal or dramatic arc is used only when the source supports it.
3. **Draft the headlines first.** Make the complete argument work as a sequence. Then add support, citations, written narration and visual suggestions. Keynote includes actual narration lines, not imagined delivery.
4. **Review and repair.** Check that the structure fits the material, a fresh reader can recover the argument, the writing avoids repetitive or forced structure, and the claims preserve the source's evidence and uncertainty. Problems return to the writer for correction; unresolved problems are surfaced rather than quietly passed.
5. **Design and render.** Apply a style pack, prepare images or diagrams, render HTML and PDF, and check slide layout. Changes to the argument or claims go back through the relevant writing checks.

The narrative work comes from a bundled, versioned copy of [Narrative Engine](https://github.com/nraford7/Narrative-Engine). Keynote Create handles the presentation style, assets, rendering and optional publication. You do not need to install Narrative Engine separately.

### Fast or Guided

- **Fast:** infer sensible choices from your material and instructions, then show one compact brief for corrections or confirmation. If you explicitly ask it to proceed without questions, it does so with stated assumptions.
- **Guided:** work through the audience, main point, style and other choices together.

A point you explicitly supply remains your point. Reviewers may recommend a different angle, but do not silently replace it. Length follows the material and your slide or speaking-time budget; the process does not pad a deck to fit a formula.

## Install

The current renderer targets **macOS**: PDF export expects Google Chrome at `/Applications/Google Chrome.app`. You also need **Git**, **Node.js with npm**, and Claude Code or Codex with local file and command access. Independent narrative reviews require a host that supports isolated subagents.

Choose the installation for your agent. These commands are for a **new installation**; if the destination already exists, follow [Updating an existing installation](#updating-an-existing-installation) instead.

### Claude Code

```sh
mkdir -p ~/.claude/skills
git clone https://github.com/nraford7/keynote-create.git ~/.claude/skills/keynote-create
cd ~/.claude/skills/keynote-create
node scripts/narrative-sync.mjs --check
```

### Codex

```sh
mkdir -p ~/.agents/skills
git clone https://github.com/nraford7/keynote-create.git ~/.agents/skills/keynote-create
cd ~/.agents/skills/keynote-create
node scripts/narrative-sync.mjs --check
```

Install the **whole folder**, including `scripts`, `references`, `packs` and `vendor`. Copying only `SKILL.md` is not enough. The integrity check confirms that the bundled Narrative Engine files match the recorded version; it does not run the writing process.

### Enable visual checks

From the installed skill directory:

```sh
npm install --no-save playwright
npx playwright install chromium
```

Playwright is used for slide screenshots, layout checks and browser testing. The basic renderer can produce HTML/PDF without it, but the full visual-check workflow needs it. For web publishing's image optimization, also install **ImageMagick 7**, which provides the `magick` command.

The bundled neutral style fetches Google Fonts over the network. A style pack with local font files supports rendering without those downloads. Creating new images requires an available image tool; otherwise the skill can prepare image briefs and render clearly labeled placeholders.

### Updating an existing installation

If you installed by cloning the repository, enter that directory and run:

```sh
git status --short
git pull --ff-only
node scripts/narrative-sync.mjs --check
```

Preserve any local changes before updating. If your skill folder is a copied directory or a symlink, update its source checkout and synchronize the complete folder instead. Keep personal style packs and publishing settings outside the repository; the [technical guide](docs/technical-guide.md) explains their locations.

## Use it

Once installed, ask your agent to use `keynote-create` and provide the source text or file. For example:

> Use keynote-create to turn these research notes into a Boardroom deck for the investment committee. The decision is whether to fund the next pilot. Use Fast mode, keep it within eight slides, and preserve uncertainty in the evidence.

> Use keynote-create to turn this essay into a ten-minute Keynote talk for a general audience. Use connected headline fragments so the full argument reads without the speaker. Make image briefs and include delivery notes.

> Use keynote-create to tighten this existing deck. Keep the main point, remove repetition and check that the headlines still tell the whole argument.

For a visual style, ask for the bundled neutral style, a saved house style, or provide a reference deck, screenshots or a style description. A saved default is reused unless you ask for another style.

## Try the renderer directly

From the installed skill directory:

```sh
node scripts/keynote-render.mjs docs/fixtures/sample-ne.md \
  --mode boardroom --no-cover --style packs/neutral --out ./demo-output
```

This creates `demo-output/sample-ne.html` and `demo-output/sample-ne.pdf`. Change `--mode boardroom` to `--mode keynote` to see the other visual treatment. The example has no image files, so Keynote shows placeholders. Add `--no-pdf` if you only want HTML.

`--no-cover` keeps the example's exact slide count; it already specifies every slide. The renderer only converts an existing deck. It does not generate the argument or run the narrative reviews by itself.

## Optional talk kits and publishing

A **talk kit** expands delivery notes into a timed script, keeping preparation-only source cautions separate from spoken copy. An activity deck can also produce a worksheet.

**Publishing** starts from a separate, human-curated public copy. The workflow optimizes its images, adds page metadata, checks it in a browser and publishes to a configured website target after your approval. Hidden speaker notes are still present in HTML source: remove private notes from the public copy before publishing.

## Further reading

- [Technical guide](docs/technical-guide.md): scripts, style packs, dependencies, publishing and maintenance.
- [Narrative Engine integration](references/narrative-engine-integration.md): ownership, headline rule, review handoff and repair process.
- [Title craft](references/title-craft.md): connected headlines, failure modes and examples.
- [Audit and recommendations](docs/narrative-engine-audit.md): what changed and what could improve next.
- [Validation record](docs/narrative-engine-validation.md): automated checks and their limits.

The bundled Narrative Engine version and file hashes are recorded in its [manifest](vendor/narrative-engine/manifest.json). Updates are explicit; the skill does not silently change its narrative process during a deck build.
