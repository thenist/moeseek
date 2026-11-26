# Moeseek

Anime moe voice styles for the assistant in DeepSeek Harness. Pick a style and
a prompt language inside the composer model menu, and the assistant keeps its
technical accuracy while its chat prose turns sweet, cat-like, prickly, quiet,
explosive, or doting.

## Use it

Open the composer's model menu and find **Voice** in the root pane, below
**Model** and **Effort**. The group has two separate boxes:

1. a style grid, and
2. a **Prompt language** row.

| Style | Id | Flavor |
|---|---|---|
| Default | `off` | Leaves the normal assistant voice untouched. |
| Sweet moe | `moe` | Warm, affectionate, slightly clingy; a soft `♡` now and then. |
| Neko moe | `cat` | Playful cat-speak using the selected language's cat sounds (`nya~`, `にゃ`, `냥`), with the occasional purr. |
| Tsundere | `tsundere` | Prickly outside, caring inside, and still fully helpful. |
| Kuudere | `kuudere` | Short, calm, deadpan lines with rare warmth. |
| Genki max | `genki` | High-energy cheering with stars and exclamation marks. |
| Onee-san | `oneesan` | Gentle, confident, doting older-sister teasing. |

| Prompt language | Id | Default |
|---|---|---|
| English | `en` | |
| Japanese | `ja` | |
| Korean | `ko` | yes |

The prompt language chooses which language the voice rules and examples are
written in. It is **not** the UI locale: the menu itself follows the UI
language. The assistant still replies in the user's language; when that
language matches the selected prompt language, the native patterns apply
directly. When it differs, the model carries the equivalent tone into the
user's language instead of switching languages.

The same switch is available as a slash command:

```text
/moeseek moe
/moeseek moe ja
/moeseek cat en
/moeseek lang ko
/moeseek off
/moeseek list
/moeseek
```

- `/moeseek <style>` changes only the style and keeps the current language.
- `/moeseek <style> <en|ja|ko>` changes both.
- `/moeseek lang <en|ja|ko>` (or just `/moeseek <en|ja|ko>`) changes only the
  prompt language and keeps the current style.
- `/moeseek` or `/moeseek list` reports both current values and the available
  ids.

The slash-command confirmation is English, matching the base UI; the selected
voice still speaks in the user's language.

The menu stays open after a pick so the check mark, the **Now** value, and the
selected language can move when the Host confirms the change; a status line
reports `Applying` and then `Applied`. Escape or a click outside closes the
menu. On a failure, a toast explains the reason instead of exposing the raw
Host error.

### UI language and prompt language

The English dictionary stays English. This DSH Web release ships English,
Chinese, Japanese, and other UI locales but no Korean locale, so a Korean
browser falls back to English.

The bundle also ships a pure-Korean client dictionary and a Korean
`locale/ko.json` description. They are intentionally not mixed into the English
resources: install a separate Korean language pack that registers `ko` with an
`en` fallback, and the included Korean copy (말투, 프롬프트 언어, 달콤 모에,
냥냥 모에, …) is already registered to display as soon as that `ko` locale
becomes active. Without that pack, the plugin stays fully usable in English.

The menu labels, hints, errors, and Plugin Manager description follow the
active UI locale. The prompt language is independent of the UI locale, so the
English menu can drive Korean voice rules, or the Korean pack can drive English
voice rules.

## How it works

- **System prompt**: one scoped section per agent carries the delivery contract
  and the full voice rules in the selected prompt language.
- **Dynamic context**: one scoped context carries a short reminder in the
  selected prompt language, phrased as a state line rather than a request, so
  a style or language change reaches the model with the next admitted request
  without inviting an acknowledgement.
- **Durable selection**: the session-scoped `moeseek` projection folds the last
  `/moeseek` invocation from durable `command/run` events. It stores both the
  style and the prompt language, so the choice survives resume and needs no
  custom event type.
- **One write path**: the menu submits the same `/moeseek` command line as the
  slash command; the durable projection frame is the confirmation.

### Prompt design

The voice layer is deliberately verbose, because a short tone prompt tends to
be satisfied with one flavored line at the end. The layer states a
position-by-position contract instead: the voice starts in the first sentence,
stays in every prose paragraph, and covers openings, plans, transitions,
code-adjacent prose, progress notes, cautions, summaries, and closings. Each
voice also ships a short question-and-answer example that shows the tone spread
across the whole reply, not appended to its end, and the shared rules close
with an eight-point self-check that asks the model to look for a neutral body
with a cute coda and to verify that no "checked" or "passed" claim describes
something it did not observe.

The contract separates byte-exact zones (code, commands, paths, identifiers,
JSON and YAML, numbers, quotes, commit text, error strings, file contents, and
out-of-chat artifacts) from natural-language prose, so the voice never leaks
into material that must stay exact.

Each voice also names a **base sentence register** and a **per-sentence
marker** — soft polite plus a soft ending for moe, light spoken prose plus a
cat ending, interjection, or comparison for cat, prickly casual plus a prickly
aside for tsundere, terse declarative plus a clipped line for kuudere,
high-energy plus a burst of exclamation for genki, and gentle polite plus a
warm aside for oneesan. A voice that only adds a particle at the end of a
sentence reads as a stiff declarative body with a decoration taped on, so every
voice ships a bad pair (plain body plus one ending marker) next to a good pair;
the shared contract also forbids saving the marker for a paragraph's last
sentence. The cat voice in particular replaced its previous one-in-three rule,
which left most of the reply looking unvoiced.

Sweet moe gets the strongest version of this rule: every section opener carries
an interjection or a warm aside, each reply has at least two of each spread
across the opening, middle, and close, the `♡`/`♪` budget (three or more) is
split between the first and second half, and prose avoids report phrasing such
as "말씀드리면" or "it is recommended". Its bad/good pair contrasts a section
opener written in report voice with one that starts in the voice.

The layer separates **expression limits** from **safety limits**. There is no
shared emoji count cap, headings may carry one short marker, and a voice's
signature particle may repeat when it is the rhythm. Per-voice counts are
floors, not ceilings: moe's hearts, genki's stars, kuudere's ellipses, and
oneesan's teasing can go as far as the reply needs. Safety limits stay: no
decoration inside code, paths, identifiers, quoted text, or the sentence that
states a failure or risk; no fabricated claims; no insults, body claims, or
copyrighted impersonation; warnings stay serious.

Echoing gets its own section because a bare prohibition tends to surface in the
reply. The layer lists the phrasings a model reaches for when it narrates the
prompt ("I'll answer in the voice you picked", "as instructed", the setting
vocabulary, and the `[moeseek]` tag), tells the model to delete any sentence
that describes the voice instead of the task, and keeps the dynamic reminder a
plain state line, so a mid-session change is less likely to produce an
acknowledgement. The only exception is a stop request: it must point to
`/moeseek off` or the Voice menu, and the model must not claim it changed the
setting itself.

Cuteness drops for warnings, danger, sensitive topics, and distressed users,
and the layer never describes physical actions or impersonates a copyrighted
character.

## Limits

- The voice and prompt language apply from the next request; a running step
  keeps the prompt it assembled.
- The prompt language defaults to Korean. It can be changed per session and is
  remembered independently of the UI locale.
- Subagent sessions and generated session titles are not voiced by this plugin.
- The style and language catalogues are fixed in `styles.js`; there is no
  configuration knob.
- The menu needs the Web composer's model selection surface. Without it, use
  `/moeseek <style> [en|ja|ko]` from any command-capable client.
- The style is tone-only. It does not change tools, permissions, models, or
  answer length. The guardrails are prompt instructions, not a hard filter.
- The layer is intentionally verbose, several thousand characters per voice,
  and it rides in every request while a voice is enabled.
- After installing or updating the bundle, refresh the Web page once so the
  page loads the current client half. An in-place update that the running Host
  cannot compare may require a DSH restart to load the new Host code; the page
  refresh alone only updates the client half.

## Files

| File | Role |
|---|---|
| `index.js` | Host plugin: projection, per-agent prompt layers, `/moeseek` command. |
| `styles.js` | Guardrails, seven voice definitions, three prompt languages, command grammar. |
| `client.js` | Web client: the **Voice** group (style grid + prompt-language box) and locale dictionaries. |
| `cordis.patch.yml` | Inserts the `moeseek` Host row. |
| `locale/*.json` | Plugin Manager title and description in English, Korean, Japanese, and Chinese. |
| `icon.svg` | Original cat-eared speech-bubble icon. |
| `tests/contract.test.js` | Catalogue, grammar, fold, prompt-language, delivery-contract, and locale-parity tests; run `node --test tests/contract.test.js` (or `pnpm test`). |

The Host half imports no Harness package, so the bundle installs without
resolving extra dependencies. The client half uses only the browser's React
module and host theme tokens.
