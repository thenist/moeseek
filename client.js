/**
 * moeseek — Client half.
 *
 * Adds a "Voice" group to the composer model menu: a style grid and a separate
 * prompt-language selection box. The current values come from the Host
 * `moeseek` Session projection; a pick submits the same `/moeseek` command
 * line the slash command uses, so there is one write path and the durable
 * projection frame is the confirmation.
 *
 * The English dictionary stays English. The pure-Korean dictionary and the
 * `locale/ko.json` description are ready for a separate Korean language pack;
 * they activate as soon as that pack registers the `ko` locale.
 */
window.__ModuleLoader__.load({
  id: '@local/moeseek',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useId, useRef, useState } = React

    const NS = 'moeseek.voice'

    const STYLES = [
      { id: 'off', mark: '○' },
      { id: 'moe', mark: '♡' },
      { id: 'cat', mark: 'ฅ' },
      { id: 'tsundere', mark: '✖' },
      { id: 'kuudere', mark: '❄\uFE0E' },
      { id: 'genki', mark: '☆' },
      { id: 'oneesan', mark: '✿' },
    ]

    const LANGUAGES = ['en', 'ja', 'ko']

    const ERROR_KEYS = {
      'session/writer-held': 'error.writerHeld',
      'session/agent-busy': 'error.busy',
      'session/not-found': 'error.notFound',
      'session/not-materialized': 'error.notMaterialized',
      'command/missing': 'error.commandMissing',
    }

    const en = {
      title: 'Voice',
      hint: 'Pick a voice and prompt language · applies from the next reply',
      current: 'Now',
      loading: 'Loading…',
      'status.applying': 'Applying…',
      'status.applied': 'Applied',
      language: 'Prompt language',
      'language.en': 'English',
      'language.ja': 'Japanese',
      'language.ko': 'Korean',
      'language.hint': 'Language of the voice rules the model reads — replies and this menu stay in your language',
      'language.unavailable': 'Restart DSH to enable prompt languages',
      'settings.summary': 'Default voice and prompt language',
      'settings.title': 'Default voice',
      'settings.hint': 'New sessions start with this voice and prompt language. A session that picks its own voice with /moeseek or the Voice menu keeps that choice.',
      'settings.style': 'Default style',
      'settings.unavailable': 'Voice settings are not available in this profile.',
      'settings.readOnly': 'This profile stores settings read-only.',
      'settings.save': 'Save defaults',
      'settings.saving': 'Saving…',
      'settings.saved': 'Saved',
      'settings.saveFailed': 'Could not save the defaults. Try again.',
      'style.off.label': 'Default',
      'style.off.hint': 'Keep the normal voice',
      'style.moe.label': 'Sweet moe',
      'style.moe.hint': 'Warm and sweet, a little clingy',
      'style.cat.label': 'Neko moe',
      'style.cat.hint': 'Playful cat-speak with nya~',
      'style.tsundere.label': 'Tsundere',
      'style.tsundere.hint': 'Prickly outside, helpful inside',
      'style.kuudere.label': 'Kuudere',
      'style.kuudere.hint': 'Quiet, deadpan, quietly caring',
      'style.genki.label': 'Genki max',
      'style.genki.hint': 'Explosive energy and stars',
      'style.oneesan.label': 'Onee-san',
      'style.oneesan.hint': 'Gentle, confident, doting',
      'error.writerHeld': 'Another running DSH instance owns this session. Quit it and try again.',
      'error.busy': 'The assistant is busy. Try changing the voice again in a moment.',
      'error.notFound': 'This session could not be found.',
      'error.notMaterialized': 'This session is not ready yet. Try again in a moment.',
      'error.commandMissing': 'The host does not offer the /moeseek command.',
      'error.generic': 'Could not change the voice. Try again in a moment.',
    }

    const ko = {
      title: '말투',
      hint: '말투와 프롬프트 언어를 골라 주세요 · 다음 답변부터 적용',
      current: '지금',
      loading: '불러오는 중…',
      'status.applying': '적용 중…',
      'status.applied': '적용 완료',
      language: '프롬프트 언어',
      'language.en': '영어',
      'language.ja': '일본어',
      'language.ko': '한국어',
      'language.hint': '모델이 읽는 말투 규칙의 언어입니다 — 답변과 이 메뉴는 사용자의 언어를 따릅니다',
      'language.unavailable': '프롬프트 언어를 사용하려면 DSH를 재시작하세요',
      'settings.summary': '기본 말투와 프롬프트 언어',
      'settings.title': '기본 말투',
      'settings.hint': '새 세션은 이 말투와 프롬프트 언어로 시작합니다. 세션에서 /moeseek이나 말투 메뉴로 직접 고르면 그 선택이 유지됩니다.',
      'settings.style': '기본 스타일',
      'settings.unavailable': '이 프로필에서는 말투 설정을 사용할 수 없어요.',
      'settings.readOnly': '이 프로필은 설정을 읽기 전용으로 저장해요.',
      'settings.save': '기본값 저장',
      'settings.saving': '저장 중…',
      'settings.saved': '저장됨',
      'settings.saveFailed': '기본값을 저장하지 못했어요. 다시 시도해 주세요.',
      'style.off.label': '기본',
      'style.off.hint': '원래 말투 그대로',
      'style.moe.label': '달콤 모에',
      'style.moe.hint': '다정하고 달콤한 ♡ 말투',
      'style.cat.label': '냥냥 모에',
      'style.cat.hint': '고양이 말투 ~냥',
      'style.tsundere.label': '츤데레',
      'style.tsundere.hint': '툴툴대지만 다 도와줘요',
      'style.kuudere.label': '쿨데레',
      'style.kuudere.hint': '조용하고 담백한 말투',
      'style.genki.label': '텐션 MAX',
      'style.genki.hint': '에너지 폭발☆ 말투',
      'style.oneesan.label': '오네상',
      'style.oneesan.hint': '다정하고 여유로운 말투',
      'error.writerHeld': '다른 DSH 인스턴스가 이 세션을 쓰고 있어요. 그 인스턴스를 종료하고 다시 시도해 주세요.',
      'error.busy': '지금 답변 중이라 말투를 바꿀 수 없어요. 잠시 후 다시 시도해 주세요.',
      'error.notFound': '세션을 찾을 수 없어요.',
      'error.notMaterialized': '이 세션은 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.',
      'error.commandMissing': '호스트에서 /moeseek 명령을 사용할 수 없어요.',
      'error.generic': '말투를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.',
    }

    const ja = {
      title: '口調',
      hint: '口調とプロンプト言語を選んでね · 次の返信から適用',
      current: 'いま',
      loading: '読み込み中…',
      'status.applying': '適用中…',
      'status.applied': '適用完了',
      language: 'プロンプト言語',
      'language.en': '英語',
      'language.ja': '日本語',
      'language.ko': '韓国語',
      'language.hint': 'モデルが読む口調ルールの言語です — 返信とこのメニューはユーザーの言語のままです',
      'language.unavailable': 'プロンプト言語を使うには DSH を再起動してください',
      'settings.summary': '既定の口調とプロンプト言語',
      'settings.title': '既定の口調',
      'settings.hint': '新しいセッションはこの口調とプロンプト言語で始まります。/moeseek や口調メニューで選んだセッションはその選択を保ちます。',
      'settings.style': '既定のスタイル',
      'settings.unavailable': 'このプロファイルでは口調設定を利用できません。',
      'settings.readOnly': 'このプロファイルは設定を読み取り専用で保存します。',
      'settings.save': '既定値を保存',
      'settings.saving': '保存中…',
      'settings.saved': '保存しました',
      'settings.saveFailed': '既定値を保存できませんでした。もう一度お試しください。',
      'style.off.label': 'デフォルト',
      'style.off.hint': 'いつもの口調',
      'style.moe.label': '甘々モエ',
      'style.moe.hint': 'やさしく甘い♡口調',
      'style.cat.label': 'にゃんにゃん',
      'style.cat.hint': '猫語尾の ~にゃ 口調',
      'style.tsundere.label': 'ツンデレ',
      'style.tsundere.hint': 'ツンツンしても全部手伝うよ',
      'style.kuudere.label': 'クーデレ',
      'style.kuudere.hint': '静かで淡々とした口調',
      'style.genki.label': 'テンションMAX',
      'style.genki.hint': '元気いっぱい☆の口調',
      'style.oneesan.label': 'お姉さん',
      'style.oneesan.hint': 'やさしく余裕のある口調',
      'error.writerHeld': '別の DSH インスタンスがこのセッションを使用中です。終了してから再試行してください。',
      'error.busy': 'いま応答中なので口調を変更できません。少し待って再試行してください。',
      'error.notFound': 'セッションが見つかりません。',
      'error.notMaterialized': 'このセッションはまだ準備できていません。少し待って再試行してください。',
      'error.commandMissing': 'ホストで /moeseek コマンドを利用できません。',
      'error.generic': '口調を変更できませんでした。少し待って再試行してください。',
    }

    const zh = {
      title: '语气',
      hint: '选择语气和提示词语言 · 从下一条回复开始生效',
      current: '当前',
      loading: '加载中…',
      'status.applying': '正在应用…',
      'status.applied': '已应用',
      language: '提示词语言',
      'language.en': '英语',
      'language.ja': '日语',
      'language.ko': '韩语',
      'language.hint': '模型读取的语气规则语言 — 回复和此菜单仍使用你的语言',
      'language.unavailable': '重启 DSH 后可启用提示词语言',
      'settings.summary': '默认语气和提示词语言',
      'settings.title': '默认语气',
      'settings.hint': '新会话以这个语气和提示词语言开始。通过 /moeseek 或语气菜单自行选择的会话会保留自己的选择。',
      'settings.style': '默认风格',
      'settings.unavailable': '此配置环境中无法使用语气设置。',
      'settings.readOnly': '此配置环境以只读方式保存设置。',
      'settings.save': '保存默认值',
      'settings.saving': '保存中…',
      'settings.saved': '已保存',
      'settings.saveFailed': '未能保存默认值，请重试。',
      'style.off.label': '默认',
      'style.off.hint': '保持原本语气',
      'style.moe.label': '甜萌',
      'style.moe.hint': '温柔甜美的♡语气',
      'style.cat.label': '喵喵萌',
      'style.cat.hint': '带 ~喵 的猫娘语气',
      'style.tsundere.label': '傲娇',
      'style.tsundere.hint': '嘴上不饶人，但会全力帮忙',
      'style.kuudere.label': '三无',
      'style.kuudere.hint': '安静平淡的语气',
      'style.genki.label': '元气MAX',
      'style.genki.hint': '活力爆棚☆的语气',
      'style.oneesan.label': '大姐姐',
      'style.oneesan.hint': '温柔从容的语气',
      'error.writerHeld': '另一个正在运行的 DSH 实例占用了此会话。请退出该实例后重试。',
      'error.busy': '助手正在回复，暂时无法切换语气。请稍后重试。',
      'error.notFound': '找不到此会话。',
      'error.notMaterialized': '此会话尚未准备好，请稍后重试。',
      'error.commandMissing': '宿主未提供 /moeseek 命令。',
      'error.generic': '无法切换语气，请稍后重试。',
    }

    const CSS = `
.moeseek-panel{box-sizing:border-box;display:flex;flex-direction:column;gap:2px;min-height:0;max-height:min(270px,calc(100dvh - 172px));overflow-y:auto;margin-top:3px;padding-top:6px;border-top:0.5px solid var(--dsw-alias-border-l2);}
.moeseek-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 8px;}
.moeseek-title{flex:0 0 auto;font-size:11px;line-height:16px;font-weight:500;color:var(--dsw-alias-label-tertiary);}
.moeseek-current{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption);}
.moeseek-status{margin:0 8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);}
.moeseek-status:empty{display:none;}
.moeseek-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2px;}
.moeseek-chip{box-sizing:border-box;display:flex;align-items:center;gap:6px;min-width:0;min-height:34px;padding:4px 8px;border:0;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:20px;font-weight:400;text-align:left;cursor:pointer;}
@media (hover:hover){.moeseek-chip:hover:not(:disabled):not([aria-disabled="true"]){background:var(--dsw-alias-interactive-bg-hover);}}
.moeseek-chip:focus-visible{outline:none;background:var(--dsw-alias-interactive-bg-hover);}
.moeseek-chip:disabled,.moeseek-chip[aria-disabled="true"]{color:var(--dsw-alias-label-dimmed);cursor:default;}
.moeseek-mark{flex:0 0 16px;width:16px;text-align:center;font-size:13px;line-height:20px;}
.moeseek-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.moeseek-check{flex:0 0 auto;margin-left:auto;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary);}
.moeseek-lang{display:flex;flex-direction:column;gap:2px;margin-top:2px;padding-top:4px;border-top:0.5px solid var(--dsw-alias-border-l2);}
.moeseek-lang-label{margin:0 8px;font-size:11px;line-height:16px;font-weight:500;color:var(--dsw-alias-label-tertiary);}
.moeseek-lang-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;}
.moeseek-lang-chip{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:4px;min-width:0;min-height:32px;padding:4px 6px;border:0;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:16px;font-weight:400;text-align:center;cursor:pointer;}
@media (hover:hover){.moeseek-lang-chip:hover:not(:disabled):not([aria-disabled="true"]){background:var(--dsw-alias-interactive-bg-hover);}}
.moeseek-lang-chip:focus-visible{outline:none;background:var(--dsw-alias-interactive-bg-hover);}
.moeseek-lang-chip:disabled,.moeseek-lang-chip[aria-disabled="true"]{color:var(--dsw-alias-label-dimmed);cursor:default;}
.moeseek-lang-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.moeseek-hint{margin:2px 8px 3px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);}
`

    const SETTINGS_CSS = `
.moeseek-defaults{display:flex;flex-direction:column;gap:12px;font-family:inherit;}
.moeseek-defaults-hint{max-width:52ch;margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}
.moeseek-defaults-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;}
.moeseek-defaults-field{display:flex;flex-direction:column;gap:4px;min-width:0;}
.moeseek-defaults-field label{font-size:13px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-primary);}
.moeseek-defaults-field select{box-sizing:border-box;min-height:32px;padding:4px 8px;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;}
.moeseek-defaults-field select:disabled{color:var(--dsw-alias-label-dimmed);cursor:default;}
.moeseek-defaults-field select:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px;}
.moeseek-defaults-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;}
.moeseek-defaults-status{min-width:0;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);}
.moeseek-defaults-status[data-failed="true"]{color:var(--dsw-alias-label-error);}
.moeseek-defaults-save{appearance:none;border:1px solid transparent;border-radius:var(--dsw-radius-md);padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);}
.moeseek-defaults-save:disabled{opacity:0.4;cursor:default;}
.moeseek-defaults-save:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px;}
.moeseek-defaults-note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);}
`

    /** Resolve one failure to localized copy without exposing raw Host text. */
    function messageFor(error, t) {
      const code = error !== null && typeof error === 'object' ? error.moeseekCode : undefined
      return t(ERROR_KEYS[code] ?? 'error.generic')
    }

    function VoiceOptions({ locked, selectStyle, selectLang, reportFailure, useProjection, t }) {
      const view = useProjection('moeseek')
      const viewStyle = typeof view === 'string' ? view : view !== null && typeof view === 'object' ? view.style : undefined
      const knownStyle = STYLES.some(style => style.id === viewStyle)
      const currentStyle = knownStyle ? viewStyle : null
      const hasLang = view !== null && typeof view === 'object' && LANGUAGES.includes(view.lang)
      // A Host from before the prompt-language update serves only `{ style }`.
      // Keep the style box usable and ask for the restart that enables the
      // separate language box instead of showing a broken selection.
      const legacy = knownStyle && !hasLang
      const currentLang = hasLang ? view.lang : legacy ? 'ko' : null
      const languageDisabled = locked || legacy || currentLang === null
      const [pending, setPending] = useState(null)
      const [requested, setRequested] = useState(null)
      const [hintFocus, setHintFocus] = useState(null)
      const panelRef = useRef(null)
      const hintId = useId()
      const busy = pending !== null
      const styleLabel = currentStyle === null ? null : t('style.' + currentStyle + '.label')
      const langLabel = currentLang === null ? null : t('language.' + currentLang)
      const headerValue = legacy
        ? (styleLabel ?? t('loading'))
        : styleLabel === null || langLabel === null
          ? t('loading')
          : styleLabel + ' · ' + langLabel
      const hint = hintFocus === null
        ? legacy ? t('language.unavailable') : t('hint')
        : hintFocus.kind === 'style'
          ? t('style.' + hintFocus.id + '.hint')
          : legacy ? t('language.unavailable') : t('language.hint')
      const applyConfirmed = requested !== null && (
        requested.kind === 'style' ? requested.id === currentStyle : requested.id === currentLang
      )
      const status = legacy
        ? t('language.unavailable')
        : pending !== null
          ? t('status.applying')
          : applyConfirmed ? '✓ ' + t('status.applied') : ''

      const run = (kind, id, task) => {
        if (busy || locked) return
        setRequested(null)
        setPending({ kind, id })
        Promise.resolve()
          .then(task)
          .then(() => {
            setPending(null)
            setRequested({ kind, id })
          })
          .catch((error) => {
            setPending(null)
            console.warn('[moeseek] voice switch failed', error)
            reportFailure(messageFor(error, t))
          })
      }

      const chooseStyle = (id) => {
        if (id === currentStyle) return
        run('style', id, () => selectStyle(id))
      }

      const chooseLang = (code) => {
        if (languageDisabled || code === currentLang) return
        run('lang', code, () => selectLang(code))
      }

      /** Two side-by-side boxes: a 2-column style grid above a 3-column language row. */
      const onPanelKeyDown = (event) => {
        const panel = panelRef.current
        if (panel === null) return
        const styleButtons = Array.from(panel.querySelectorAll('[data-moeseek-kind="style"]'))
        const langButtons = Array.from(panel.querySelectorAll('[data-moeseek-kind="lang"]'))
        const styleIndex = styleButtons.indexOf(event.target)
        const langIndex = langButtons.indexOf(event.target)
        if (styleIndex < 0 && langIndex < 0) return
        const consume = () => {
          event.preventDefault()
          event.stopPropagation()
        }
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
        if (styleIndex >= 0) {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            consume()
            styleButtons[clamp(styleIndex + (event.key === 'ArrowLeft' ? -1 : 1), 0, styleButtons.length - 1)]?.focus()
          } else if (event.key === 'ArrowUp') {
            if (styleIndex >= 2) {
              consume()
              styleButtons[styleIndex - 2]?.focus()
            }
          } else if (event.key === 'ArrowDown') {
            const next = styleIndex + 2
            if (next < styleButtons.length) {
              consume()
              styleButtons[next]?.focus()
            } else if (styleIndex + 1 < styleButtons.length) {
              // Odd last row: the right-column chip steps to the single chip below it.
              consume()
              styleButtons[styleIndex + 1]?.focus()
            } else {
              const target = langButtons.find(button => button.getAttribute('aria-current') === 'true') ?? langButtons[0]
              if (target !== undefined && !target.disabled) {
                consume()
                target.focus()
              }
              // No enabled language button (locked): let the host leave the group.
            }
          }
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          consume()
          langButtons[clamp(langIndex + (event.key === 'ArrowLeft' ? -1 : 1), 0, langButtons.length - 1)]?.focus()
        } else if (event.key === 'ArrowUp') {
          consume()
          styleButtons[styleButtons.length - 1]?.focus()
        }
        // ArrowDown from the language row is left to the host so it can leave the group.
      }

      return h('div', {
        className: 'moeseek-panel',
        ref: panelRef,
        role: 'group',
        'aria-label': t('title'),
        'aria-busy': busy || currentStyle === null || currentLang === null,
        onKeyDown: onPanelKeyDown,
      },
      h('style', null, CSS),
      h('div', { className: 'moeseek-head' },
        h('span', { className: 'moeseek-title' }, t('title')),
        h('span', { className: 'moeseek-current' }, t('current') + ': ' + headerValue)),
      h('div', { className: 'moeseek-status', role: 'status', 'aria-live': 'polite' }, status),
      h('div', { className: 'moeseek-grid' },
        STYLES.map(style => h('button', {
          key: style.id,
          type: 'button',
          role: 'menuitem',
          'aria-current': style.id === currentStyle ? 'true' : undefined,
          'aria-disabled': busy || undefined,
          'aria-describedby': hintId,
          'data-moeseek-kind': 'style',
          className: 'moeseek-chip',
          disabled: locked,
          title: t('style.' + style.id + '.hint'),
          onFocus: () => { setHintFocus({ kind: 'style', id: style.id }) },
          onMouseEnter: () => { setHintFocus({ kind: 'style', id: style.id }) },
          onClick: () => { chooseStyle(style.id) },
        },
        h('span', { className: 'moeseek-mark', 'aria-hidden': 'true' },
          pending !== null && pending.kind === 'style' && pending.id === style.id ? '…' : style.mark),
        h('span', { className: 'moeseek-label' }, t('style.' + style.id + '.label')),
        style.id === currentStyle
          ? h('span', { className: 'moeseek-check', 'aria-hidden': 'true' }, '✓')
          : null))),
      h('div', { className: 'moeseek-lang' },
        h('span', { className: 'moeseek-lang-label' }, t('language')),
        h('div', { className: 'moeseek-lang-row', role: 'group', 'aria-label': t('language') },
          LANGUAGES.map(code => h('button', {
            key: code,
            type: 'button',
            role: 'menuitem',
            'aria-current': code === currentLang ? 'true' : undefined,
            'aria-disabled': busy || languageDisabled || undefined,
            'aria-describedby': hintId,
            'data-moeseek-kind': 'lang',
            className: 'moeseek-lang-chip',
            disabled: locked,
            title: legacy ? t('language.unavailable') : t('language.hint'),
            onFocus: () => { setHintFocus({ kind: 'lang', id: code }) },
            onMouseEnter: () => { setHintFocus({ kind: 'lang', id: code }) },
            onClick: () => { chooseLang(code) },
          },
          h('span', { className: 'moeseek-lang-name' }, t('language.' + code)),
          pending !== null && pending.kind === 'lang' && pending.id === code
            ? h('span', { className: 'moeseek-check', 'aria-hidden': 'true' }, '…')
            : code === currentLang
              ? h('span', { className: 'moeseek-check', 'aria-hidden': 'true' }, '✓')
              : null)))),
      h('div', { className: 'moeseek-hint', id: hintId }, hint))
    }

    /** A known style id from a resolved settings value; the catalogue default otherwise. */
    function styleIdOf(value) {
      return STYLES.some(style => style.id === value) ? value : 'off'
    }

    /** A known prompt-language id from a resolved settings value; the catalogue default otherwise. */
    function langIdOf(value) {
      return LANGUAGES.includes(value) ? value : 'ko'
    }

    /**
     * The moeseek row's configuration on the Plugins page: a summary line, and
     * the form that writes the default voice and prompt language. The values and
     * the revision fence come from the page's config form; the summary view
     * receives no form, so it names the setting instead of reading it.
     */
    function DefaultVoiceSettings(props) {
      const { t } = props
      if (props.view === 'summary') return t('settings.summary')
      const form = props.form
      if (form === undefined) {
        return h('p', { className: 'moeseek-defaults-note', role: 'status' }, t('settings.unavailable'))
      }
      if (form.state.status === 'loading') {
        return h('p', { className: 'moeseek-defaults-note', role: 'status' }, t('loading'))
      }
      if (form.state.status === 'unavailable') {
        return h('p', { className: 'moeseek-defaults-note', role: 'status' }, t('settings.unavailable'))
      }
      return h(DefaultVoiceForm, { t, form })
    }

    function DefaultVoiceForm({ t, form }) {
      const snapshot = form.state
      const value = snapshot.value !== null && typeof snapshot.value === 'object' ? snapshot.value : {}
      const host = { style: styleIdOf(value.defaultStyle), lang: langIdOf(value.defaultLang) }
      const [staged, setStaged] = useState(null)
      const [optimistic, setOptimistic] = useState(null)
      const [saving, setSaving] = useState(false)
      const [failed, setFailed] = useState(false)
      const [saved, setSaved] = useState(false)
      const [hostKey, setHostKey] = useState(host.style + ':' + host.lang)
      const nextKey = host.style + ':' + host.lang
      // A save shows its own values until the page's next snapshot carries them.
      // Any host change clears that optimism, so an external edit wins.
      if (hostKey !== nextKey) {
        setHostKey(nextKey)
        setOptimistic(null)
      }
      const current = staged ?? optimistic ?? host
      const dirty = staged !== null && (staged.style !== host.style || staged.lang !== host.lang)
      const disabled = !snapshot.writable || saving
      const styleInput = useId()
      const langInput = useId()

      const edit = (field, next) => {
        if (next === current[field]) return
        setStaged({ ...current, [field]: next })
        setSaved(false)
        setFailed(false)
      }

      const save = () => {
        if (disabled || !dirty) return
        const submitted = { style: current.style, lang: current.lang }
        setSaving(true)
        setFailed(false)
        setSaved(false)
        Promise.resolve()
          .then(() => form.mutate([
            { op: 'set', path: ['defaultStyle'], value: submitted.style },
            { op: 'set', path: ['defaultLang'], value: submitted.lang },
          ], snapshot.revision))
          .then((accepted) => {
            setSaving(false)
            if (!accepted) {
              setFailed(true)
              return
            }
            setOptimistic(submitted)
            setStaged(null)
            setSaved(true)
          })
          .catch((error) => {
            setSaving(false)
            setFailed(true)
            console.warn('[moeseek] default voice save failed', error)
          })
      }

      const statusText = failed ? t('settings.saveFailed') : saved ? t('settings.saved') : ''

      return h('section', { className: 'moeseek-defaults', 'aria-label': t('settings.title') },
        h('style', null, SETTINGS_CSS),
        h('p', { className: 'moeseek-defaults-hint' }, t('settings.hint')),
        snapshot.writable
          ? null
          : h('p', { className: 'moeseek-defaults-note', role: 'status' }, t('settings.readOnly')),
        h('div', { className: 'moeseek-defaults-grid' },
          h('div', { className: 'moeseek-defaults-field' },
            h('label', { htmlFor: styleInput }, t('settings.style')),
            h('select', {
              id: styleInput,
              value: current.style,
              disabled,
              onChange: (event) => { edit('style', styleIdOf(event.target.value)) },
            }, STYLES.map(style => h('option', { key: style.id, value: style.id },
              t('style.' + style.id + '.label'))))),
          h('div', { className: 'moeseek-defaults-field' },
            h('label', { htmlFor: langInput }, t('language')),
            h('select', {
              id: langInput,
              value: current.lang,
              disabled,
              onChange: (event) => { edit('lang', langIdOf(event.target.value)) },
            }, LANGUAGES.map(code => h('option', { key: code, value: code }, t('language.' + code)))))),
        h('div', { className: 'moeseek-defaults-foot' },
          h('span', {
            className: 'moeseek-defaults-status',
            role: 'status',
            'aria-live': 'polite',
            'data-failed': failed ? 'true' : undefined,
          }, statusText),
          h('button', {
            type: 'button',
            className: 'moeseek-defaults-save',
            disabled: disabled || !dirty,
            onClick: save,
          }, saving ? t('settings.saving') : t('settings.save'))))
    }

    return {
      inject: ['slots', 'sessions', 'locale'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, { en, ko, ja, zh }),
          'moeseek: voice dictionaries',
        )

        ctx.slots.inject('conversation.input.model.options', () => ctx.slots.register({
          name: 'conversation.input.model.options',
          id: 'moeseek',
          order: 50,
          locale: NS,
          inject: (sessionId) => {
            const submit = async (line) => {
              const fail = (code) => {
                const error = new Error(code)
                error.moeseekCode = code
                throw error
              }
              const live = ctx.sessions.binding(sessionId)?.session
              if (live === undefined) fail('session/not-materialized')
              const result = await live.command(line)
              if (!result.ok) {
                const error = new Error(result.error.message)
                error.moeseekCode = result.error.code
                throw error
              }
              if (!result.value.matched) fail('command/missing')
            }
            return {
              selectStyle: (styleId) => submit('/moeseek ' + styleId),
              selectLang: (code) => submit('/moeseek lang ' + code),
            }
          },
        }, VoiceOptions))

        // Settings → Plugins → moeseek → the row's configuration. The key is
        // the bundle name plus the row id its patch inserts.
        ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
          name: 'plugins.row.config',
          key: '@local/moeseek#moeseek',
          locale: NS,
        }, DefaultVoiceSettings))
      },
    }
  },
})
