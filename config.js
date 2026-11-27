/**
 * moeseek — Host configuration.
 *
 * Two volatile fields set the voice a session starts with. Volatile fields are
 * the ones the plugin manager's row page renders and edits: the write lands in
 * the active profile patch and takes effect without remounting the plugin.
 * That page is the `moeseek` row inside the sidebar's Plugins panel, not the
 * read-only inventory under Settings → Built-in plugins.
 * `index.js` reads them when a session projection is first materialized, so a
 * change reaches sessions that have not chosen a voice and never rewrites a
 * session whose own `/moeseek` choice is already in the event log.
 *
 * `@deepseek-ai/schemastery` resolves from the DSH installation, as every
 * Harness package does for a bundle; the package itself still has no
 * dependency of its own to install.
 */

import z from '@deepseek-ai/schemastery'
import { DEFAULT_LANG, DEFAULT_STYLE, LANG_IDS, STYLE_IDS } from './styles.js'

const styleIds = [...STYLE_IDS]
const langIds = [...LANG_IDS]

export const Config = z.object({
  defaultStyle: z.union(styleIds).default(DEFAULT_STYLE)
    .description('Voice style for a session that has not chosen one with /moeseek or the Voice menu.')
    .volatile(),
  defaultLang: z.union(langIds).default(DEFAULT_LANG)
    .description('Prompt language of the voice rules for sessions that use the default voice.')
    .volatile(),
})
