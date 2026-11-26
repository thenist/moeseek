/**
 * moeseek — Host half.
 *
 * The session-scoped `moeseek` projection folds the last `/moeseek` invocation
 * from durable `command/run` events, keeping both the voice style and the
 * prompt language (en/ja/ko). The selection survives resume and is readable by
 * the Client without a custom event type. For each agent, one scoped
 * system-prompt section carries the full voice rules and one scoped dynamic
 * context carries the short reminder, both in the selected prompt language.
 * The `/moeseek` command is the single write path used by the composer menu.
 *
 * No Harness package is imported: every service is reached through `ctx`, so
 * the bundle installs without dependency resolution.
 */

import {
  DEFAULT_LANG,
  LANGS,
  LANG_IDS,
  STYLES,
  STYLE_IDS,
  contextFor,
  langFor,
  langIdList,
  parseRequest,
  promptFor,
  styleIdList,
  viewOf,
  voiceFor,
} from './styles.js'

/** Services the host half needs; the command child is optional. */
export const inject = ['agents', 'sessionProjections', 'systemPrompt']

const PROJECTION_KEY = 'moeseek'
const SECTION_NAME = 'moeseek:voice'
const CONTEXT_NAME = 'moeseek:voice-reminder'
const SECTION_ORDER = 11000
const CONTEXT_ORDER = 950

/** Normalize one persisted projection value; old or partial rows fall back safely. */
function normalizeState(value) {
  const raw = value !== null && typeof value === 'object' ? value : {}
  return {
    style: STYLE_IDS.has(raw.style) ? raw.style : 'off',
    lang: LANG_IDS.has(raw.lang) ? raw.lang : DEFAULT_LANG,
  }
}

/**
 * Structural schemas: the projection registry only calls `parse`, and avoiding
 * a Zod import keeps this bundle dependency-free.
 */
function stateSchema() {
  return { parse: normalizeState }
}

function viewSchema() {
  return { parse: normalizeState }
}

/**
 * Register the session projection, per-agent prompt layers, and the command.
 * @param ctx - the plugin context.
 */
export async function apply(ctx) {
  /** @type {{ stateOf(session: unknown): { style: string, lang: string } } | undefined} */
  let projection

  const selectionOfSession = (session) => {
    const fallback = { voice: voiceFor('off'), lang: langFor(DEFAULT_LANG) }
    if (projection === undefined) return fallback
    try {
      const state = projection.stateOf(session)
      return { voice: voiceFor(state?.style), lang: langFor(state?.lang) }
    } catch {
      return fallback
    }
  }

  /** @type {Map<object, () => void>} */
  const voiceDisposers = new Map()

  const attachVoice = (agent) => {
    if (voiceDisposers.has(agent)) return
    const dispose = agent.ctx.effect(() => {
      const releaseSection = agent.ctx.systemPrompt.section({
        name: SECTION_NAME,
        order: SECTION_ORDER,
        text: () => {
          const { voice, lang } = selectionOfSession(agent.session)
          return promptFor(voice, lang.id)
        },
      })
      const releaseContext = agent.ctx.systemPrompt.context({
        name: CONTEXT_NAME,
        order: CONTEXT_ORDER,
        text: () => {
          const { voice, lang } = selectionOfSession(agent.session)
          return contextFor(voice, lang.id)
        },
      })
      return () => {
        releaseSection()
        releaseContext()
      }
    }, 'moeseek: voice layer')
    voiceDisposers.set(agent, dispose)
  }

  ctx.on('agent/created', ({ agent }) => {
    attachVoice(agent)
  })

  ctx.on('agent/disposed', ({ agent }) => {
    voiceDisposers.delete(agent)
  })

  // Plugin unload must also release registrations owned by live agent contexts.
  ctx.effect(() => () => {
    for (const dispose of voiceDisposers.values()) {
      try {
        dispose()
      } catch {
        // The agent context may already have been disposed; nothing remains.
      }
    }
    voiceDisposers.clear()
  }, 'moeseek: detach live voices')

  projection = await ctx.sessionProjections.register({
    key: PROJECTION_KEY,
    stateVersion: 2,
    stateSchema: stateSchema(),
    init: () => ({ style: 'off', lang: DEFAULT_LANG }),
    apply(state, event) {
      if (event.type !== 'command/run' || event.data.name !== 'moeseek') return state
      const request = parseRequest(event.data.args)
      if (request.kind !== 'set') return state
      const style = request.style ?? state.style
      const lang = request.lang ?? state.lang
      if (style === state.style && lang === state.lang) return state
      return { style, lang }
    },
    wire: {
      viewSchema: viewSchema(),
      view: state => viewOf(state.style, state.lang),
    },
  })

  for (const agent of ctx.agents.list()) attachVoice(agent)

  ctx.inject(['commands'], (commandCtx) => {
    commandCtx.commands.register({
      name: 'moeseek',
      description: "Change this session's anime moe voice and prompt language",
      input: { hint: `[<style> [en|ja|ko] | lang <en|ja|ko> | list]` },
      handler: ({ agent, rawInput }) => {
        const selection = selectionOfSession(agent.session)
        const request = parseRequest(rawInput)

        if (request.kind === 'info') {
          return {
            kind: 'success',
            text: `${selection.voice.emoji} Current voice: ${selection.voice.names.en} · Prompt language: ${selection.lang.en} · Styles: ${styleIdList()} · Languages: ${langIdList()}`,
          }
        }
        if (request.kind === 'invalid') {
          const raw = typeof rawInput === 'string' ? rawInput.trim() : ''
          const shown = raw.length > 48 ? raw.slice(0, 48) + '…' : raw
          return {
            kind: 'error',
            text: `Unknown voice or language '${shown}'. Use /moeseek <style> [en|ja|ko], /moeseek lang <en|ja|ko>, or /moeseek list.`,
          }
        }

        const voice = request.style === undefined ? selection.voice : STYLES.get(request.style)
        const lang = request.lang === undefined ? selection.lang : LANGS.get(request.lang)
        const both = request.style !== undefined && request.lang !== undefined
        if (both) {
          return {
            kind: 'success',
            text: `${voice.emoji} Voice set to ${voice.names.en} · Prompt language: ${lang.en}. It applies from the next reply.`,
          }
        }
        if (request.style !== undefined) {
          return {
            kind: 'success',
            text: `${voice.emoji} Voice set to ${voice.names.en}. It applies from the next reply.`,
          }
        }
        return {
          kind: 'success',
          text: `Prompt language set to ${lang.en}. It applies from the next reply.`,
        }
      },
    })
  })
}
