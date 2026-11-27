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
 * A session that never invokes `/moeseek` starts from the configured default
 * selection — `defaultStyle` and `defaultLang` in `config.js` — which the DSH
 * Settings → Plugins page edits as volatile fields. The defaults are read when
 * a session's projection is first materialized, so a settings write reaches
 * the next session, while a session whose own choice is in the event log keeps
 * that choice. `config.js` imports `@deepseek-ai/schemastery`, which resolves
 * from the DSH installation like every Harness package a bundle imports.
 */

import { Config } from './config.js'
import {
  LANGS,
  STYLES,
  contextFor,
  defaultsFrom,
  langFor,
  langIdList,
  normalizeState,
  parseRequest,
  promptFor,
  styleIdList,
  viewOf,
  voiceFor,
} from './styles.js'

export { Config }

/** Services the host half needs; the command child is optional. */
export const inject = ['agents', 'sessionProjections', 'systemPrompt']

const PROJECTION_KEY = 'moeseek'
const SECTION_NAME = 'moeseek:voice'
const CONTEXT_NAME = 'moeseek:voice-reminder'
const SECTION_ORDER = 11000
const CONTEXT_ORDER = 950

/**
 * Structural schemas: the projection registry only calls `parse`, and avoiding
 * extra imports keeps this module small. `defaults` is read per parse, so a
 * settings write reaches a session whose state is materialized afterwards.
 */
function stateSchema(defaults) {
  return { parse: value => normalizeState(value, defaults()) }
}

function viewSchema(defaults) {
  return { parse: value => normalizeState(value, defaults()) }
}

/** Read one Config field, accepting both a volatile reference and a plain value. */
function configValue(field) {
  if (field !== null && typeof field === 'object' && typeof field.get === 'function') return field.get()
  return field
}

/**
 * Register the session projection, per-agent prompt layers, and the command.
 * @param ctx - the plugin context.
 * @param config - the validated Config; its default selection is read live.
 */
export async function apply(ctx, config) {
  /** The default selection; read live so a volatile settings write reaches the next session. */
  const defaults = () => defaultsFrom(configValue(config?.defaultStyle), configValue(config?.defaultLang))

  /** @type {{ stateOf(session: unknown): { style: string, lang: string } } | undefined} */
  let projection

  const selectionOfSession = (session) => {
    const fallback = () => {
      const value = defaults()
      return { voice: voiceFor(value.style), lang: langFor(value.lang) }
    }
    if (projection === undefined) return fallback()
    try {
      const state = normalizeState(projection.stateOf(session), defaults())
      return { voice: voiceFor(state.style), lang: langFor(state.lang) }
    } catch {
      return fallback()
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
    stateVersion: 3,
    stateSchema: stateSchema(defaults),
    init: () => ({ ...defaults() }),
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
      viewSchema: viewSchema(defaults),
      view: state => {
        const value = normalizeState(state, defaults())
        return viewOf(value.style, value.lang)
      },
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
          const configured = defaults()
          const defaultVoice = voiceFor(configured.style)
          return {
            kind: 'success',
            text: `${selection.voice.emoji} Current voice: ${selection.voice.names.en} · Prompt language: ${selection.lang.en} · New-session default: ${defaultVoice.names.en} (${configured.lang}) · Styles: ${styleIdList()} · Languages: ${langIdList()}`,
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
