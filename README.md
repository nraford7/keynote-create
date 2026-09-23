# Keynote Create

**Turn notes, research or an existing draft into a presentation with a clear point and a connected argument.**

Keynote Create is a skill for Claude Code and Codex. It helps you work out what your audience needs to understand, find the strongest supported point in your material, and build slides that explain it clearly.

Read the slide headlines in order and the argument should make sense. The images, charts, supporting text and speaker notes give it depth.

You get an editable Markdown source, a browser presentation and a PDF. The browser presentation supports fullscreen delivery and arrow-key navigation. It does not create PowerPoint `.pptx` or Apple Keynote `.key` files.

## How it works

1. **Understand the assignment.** Who is it for? What should they understand, decide or do afterward? Will you present it live, send it to be read, or need both? What are the time and length limits?
2. **Find the point.** Read the source for useful findings, strong evidence, unanswered questions and limits. Compare possible main points and ways to explain them. A straightforward explanation is a valid choice; a narrative arc is used when it helps and the material supports it.
3. **Approve the brief.** Agree on the point, structure and treatment before drafting. A point you supply stays yours; the skill can challenge its support or suggest improvements, but should not silently replace it.
4. **Write and review.** Build the headline sequence, supporting content and narration. Check whether the argument works, serves the intended purpose and preserves the source's uncertainty.
5. **Plan the visuals.** Decide what each slide needs to show. A comparison might need a table; a mechanism might need a diagram; a conclusion might need only a sentence. Apply your existing style or choose a visual direction.
6. **Build and check the deck.** Render the slides, check that reviewed content survived the layout, inspect the visuals and PDF, and test the presentation controls.

If you already have an approved narrative, you can start at slide planning. If you only need to restyle or export an existing deck, you do not have to repeat discovery.

### Fast or Deep — you choose

For a new narrative, the skill asks you to choose. **There is no default.**

- **Deep:** work through the important framing questions together, using what you have already supplied and asking about what remains unresolved.
- **Fast:** perform the same analysis, infer missing answers, and show the assumptions and choices together in one brief.

Both require approval of the completed brief before drafting. Fast shortens the conversation; it does not remove the framing or review work.

### Two presentation styles

| Style | What changes |
|---|---|
| **Boardroom** | Usually uses complete sentence headlines and structured supporting evidence. |
| **Keynote** | Can use connected fragments, sparse captions and more spoken explanation. |

Both must make sense as a headline sequence. Both can use charts, diagrams, images or plain text. The style does not determine the audience, purpose or narrative arc.

A deck people read alone needs enough visible explanation to stand on its own. A live talk can use narration to elaborate. If you need both, the skill can prepare separate versions of the same argument.

### Where Narrative Engine and Art Direct fit

**[Narrative Engine](https://github.com/nraford7/Narrative-Engine)** handles the audience, purpose, main point, structure, writing and narrative review. A reviewed version is included, so you do not need to install it separately. Narrative Engine also works independently for prose and other narrative work.

**Art Direct**, when installed, helps choose a visual language, develop image and graphic concepts, and review the finished visuals. It receives the approved brief and slide plan. It does not choose a different argument or require a metaphor for every slide. Without it, Keynote Create prepares the visual briefs directly.

**Keynote Create** coordinates the presentation: slide planning, styles, assets, layouts, rendering and delivery checks.

## A worked example

Suppose your source says:

> Twenty employees volunteered for a four-week pilot of a new tool. All twenty reported satisfaction. Productivity was not measured, there was no control group, and operating costs are unknown. The team recommends four more weeks to measure productivity and costs before deciding on wider expansion.

You want the operations director to approve that limited extension.

A weak deck might have these headings:

> Background → Pilot results → Limitations → Next steps

Keynote Create should turn them into a connected argument:

1. **Extend the pilot to gather evidence before expanding.**
2. **All twenty volunteers reported satisfaction.**
3. **But productivity was unmeasured, there was no control group, and costs remain unknown.**
4. **Approve four more weeks to measure productivity and costs.**

The result slide could show the twenty responses, clearly labeled as satisfaction. The limitations slide could compare what was measured with what remains unknown. Neither needs a decorative photograph.

The source cannot support “The pilot proved productivity gains.” The evidence review should catch that overstatement. A layout must also keep the qualifications visible rather than reducing the finding to a misleading giant number.

The review checks the presentation against your material. It does not independently establish that every claim in the source is true.

## What it is good at

- Turning reports, research and rough notes into an argument an audience can follow.
- Improving disconnected headings and finding a useful opening in the source.
- Explaining, persuading, reporting or teaching without forcing everything into the same story shape.
- Keeping important evidence and qualifications while making slides clearer.
- Reusing a house style and preserving unchanged slide designs through revisions.
- Producing browser presentations and PDFs from editable source files.

## What it is not so good at

- **Fixing weak evidence.** It can identify gaps and narrow a claim, but cannot invent the missing support.
- **Producing finished imagery in one pass.** Good visuals still need suitable assets, an available image tool and review. Missing assets remain marked as draft placeholders.
- **Replacing visual judgment.** Automated checks catch missing text and some layout problems. They do not prove that a chart is accurate or an image helps explain the point.
- **Predicting exact delivery time.** Script estimates help; rehearsal is still needed.
- **Creating native slide files.** The outputs are Markdown, HTML and PDF, not editable PowerPoint or Apple Keynote files.

## How to install it

The current rendering setup targets **macOS**. You need Git, Node.js with npm, and Google Chrome installed at `/Applications/Google Chrome.app`. Use Claude Code or Codex with local file and command access. Independent narrative reviews also need support for isolated agents.

For a **new Claude Code installation**:

```sh
mkdir -p ~/.claude/skills
git clone https://github.com/nraford7/keynote-create-skill.git ~/.claude/skills/keynote-create
cd ~/.claude/skills/keynote-create
```

For a **new Codex installation**:

```sh
mkdir -p ~/.agents/skills
git clone https://github.com/nraford7/keynote-create-skill.git ~/.agents/skills/keynote-create
cd ~/.agents/skills/keynote-create
```

Then, from the installed folder, check the bundled Narrative Engine and install the browser tools used for visual checks:

```sh
node scripts/narrative-sync.mjs --check
npm install --no-save playwright
npx playwright install chromium
```

Install the whole folder, not just `SKILL.md`. The default style downloads Google Fonts; styles with local fonts can render without those downloads. Image creation needs an available image-generation tool. Optional web publishing also uses ImageMagick 7 for image optimization.

### Updating an existing installation

If you installed by cloning this repository, run these from that folder:

```sh
git status --short
git pull --ff-only
node scripts/narrative-sync.mjs --check
```

Preserve local changes before updating. If your installation is a copied folder or a symlink, update its source checkout and synchronize the complete folder. Keep personal styles and publishing settings outside the repository.

## How to use it

Provide your source file or text and ask your agent to use `keynote-create`. For example:

> Use keynote-create in Deep mode to turn this report into a ten-minute presentation for the investment committee. Help me establish the main point before drafting. Use our house style and prepare a version people can read afterward.

Or, for an existing deck:

> Use keynote-create to improve the visuals in this deck. Keep the approved argument and headlines. Use diagrams where they explain more clearly than photographs.

You can supply a style guide, reference deck, screenshots or a description. Style priority is your explicit request, then the project style, then your saved house default, then neutral. The skill tells you which it is using.

Open the finished HTML file in a browser and press **`p`** to present. Use the arrow keys to advance and **Escape** to return to reading mode.

Optional extras include a timed speaker script, worksheets for activities, and publishing a separately prepared public copy to your website. Hidden speaker notes remain in the HTML source, so remove private material from the public copy before publishing.

## More detail

- [Example deck](docs/fixtures/sample-ne.md): a small source file you can render.
- [Technical guide](docs/technical-guide.md): rendering, dependencies, styles and publishing.
- [Visual production](references/visual-production.md): slide planning, Art Direct, saved layouts and content checks.
- [Narrative Engine integration](references/narrative-engine-integration.md): the narrative handoff and review process.
- [Title craft](references/title-craft.md): headline examples and common failures.

The bundled Narrative Engine version is recorded in its [manifest](vendor/narrative-engine/manifest.json). Updates are deliberate; the narrative process does not change silently during a deck build.
