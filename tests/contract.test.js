import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_LANG,
  GUARDRAILS,
  LANG_IDS,
  LANG_LIST,
  STYLE_LIST,
  STYLE_IDS,
  VIEWS,
  contextFor,
  langFor,
  langIdList,
  parseRequest,
  promptFor,
  styleIdList,
  viewOf,
  voiceFor,
} from '../styles.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const client = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
const hangul = /[\u3131-\u318E\uAC00-\uD7A3]/u
const kana = /[\u3040-\u30FF]/u
const han = /[\u4E00-\u9FFF]/u

function clientDict(name) {
  const match = new RegExp('const ' + name + ' = \\{([\\s\\S]*?)\\n    \\}\\n', 'm').exec(client)
  assert.ok(match, `client ${name} dictionary`)
  return match[1]
}

function dictionaryKeys(block) {
  return [...block.matchAll(/(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_]*)):/g)].map(match => match[1] ?? match[2])
}

test('host catalogue and ids', () => {
  assert.equal(STYLE_LIST.length, 7)
  assert.deepEqual([...STYLE_IDS], ['off', 'moe', 'cat', 'tsundere', 'kuudere', 'genki', 'oneesan'])
  assert.equal(LANG_LIST.length, 3)
  assert.equal(DEFAULT_LANG, 'ko')
  assert.equal(styleIdList(), 'off, moe, cat, tsundere, kuudere, genki, oneesan')
  assert.equal(langIdList(), 'en, ja, ko')
  assert.equal(voiceFor('missing').id, 'off')
  assert.equal(langFor('missing').id, DEFAULT_LANG)
})

test('command grammar', () => {
  const cases = [
    ['', 'info', undefined],
    ['   ', 'info', undefined],
    ['list', 'info', undefined],
    ['LIST', 'info', undefined],
    ['moe', 'set', { style: 'moe' }],
    [' MOE ', 'set', { style: 'moe' }],
    ['moe ja', 'set', { style: 'moe', lang: 'ja' }],
    ['moe KO', 'set', { style: 'moe', lang: 'ko' }],
    ['lang en', 'set', { lang: 'en' }],
    ['lang JA', 'set', { lang: 'ja' }],
    ['en', 'set', { lang: 'en' }],
    ['ko', 'set', { lang: 'ko' }],
    ['off', 'set', { style: 'off' }],
    ['off en', 'set', { style: 'off', lang: 'en' }],
    ['bogus', 'invalid', undefined],
    ['lang', 'invalid', undefined],
    ['lang bogus', 'invalid', undefined],
    ['moe bogus', 'invalid', undefined],
    ['moe ja extra', 'invalid', undefined],
    ['list extra', 'invalid', undefined],
    ['en moe', 'invalid', undefined],
    [undefined, 'info', undefined],
  ]
  for (const [input, kind, expected] of cases) {
    const request = parseRequest(input)
    assert.equal(request.kind, kind, `kind for ${JSON.stringify(input)}`)
    if (expected !== undefined) {
      assert.equal(request.style, expected.style, `style for ${JSON.stringify(input)}`)
      assert.equal(request.lang, expected.lang, `lang for ${JSON.stringify(input)}`)
    }
  }
})

test('projection fold changes only on valid set requests', () => {
  const apply = (state, args) => {
    const request = parseRequest(args)
    if (request.kind !== 'set') return state
    const style = request.style ?? state.style
    const lang = request.lang ?? state.lang
    if (style === state.style && lang === state.lang) return state
    return { style, lang }
  }
  const initial = { style: 'off', lang: 'ko' }
  assert.equal(apply(initial, ''), initial)
  assert.equal(apply(initial, 'bogus'), initial)
  const styleOnly = apply(initial, 'moe')
  assert.deepEqual(styleOnly, { style: 'moe', lang: 'ko' })
  const both = apply(styleOnly, 'moe ja')
  assert.deepEqual(both, { style: 'moe', lang: 'ja' })
  const langOnly = apply(both, 'lang en')
  assert.deepEqual(langOnly, { style: 'moe', lang: 'en' })
  assert.equal(apply(langOnly, 'moe en'), langOnly)
  assert.equal(apply(langOnly, 'en'), langOnly)
})

test('prompt and context variants use the selected language', () => {
  for (const style of STYLE_LIST) {
    for (const lang of ['en', 'ja', 'ko']) {
      assert.ok(style.names[lang], `name ${style.id}/${lang}`)
      assert.ok(lang in style.prompts, `prompt ${style.id}/${lang}`)
      const prompt = promptFor(style, lang)
      const context = contextFor(style, lang)
      if (style.id === 'off') {
        assert.equal(prompt, '')
        assert.equal(context, '')
        continue
      }
      assert.ok(prompt.startsWith(GUARDRAILS[lang]), `guardrails ${style.id}/${lang}`)
      assert.ok(context.length > 0, `context ${style.id}/${lang}`)
      assert.ok(!prompt.includes('{{'), `interpolation ${style.id}/${lang}`)
      if (lang === 'en') {
        assert.ok(!hangul.test(prompt) && !hangul.test(context), `English purity ${style.id}`)
      } else if (lang === 'ja') {
        assert.ok(kana.test(prompt) && kana.test(context), `Japanese kana ${style.id}`)
        assert.ok(!hangul.test(prompt) && !hangul.test(context), `Japanese purity ${style.id}`)
      } else {
        assert.ok(hangul.test(prompt) && hangul.test(context), `Korean Hangul ${style.id}`)
      }
    }
  }
})

test('voice prompts carry the coverage, anti-echo, and self-check contract', () => {
  const markers = {
    en: {
      coverage: 'first sentence',
      meta: 'meta',
      check: 'Self-check',
      positions: [/first sentence/i, /closing/i],
      example: 'Short example',
      baseRegister: 'Base register',
      density: 'Every sentence',
      badGood: 'Bad vs good',
      oldOpen: 'The user chose',
    },
    ja: {
      coverage: '最初の文',
      meta: 'メタ',
      check: '自己点検',
      positions: [/最初の文/, /締め/],
      example: '短い例',
      baseRegister: '基本の文体',
      density: 'すべての文',
      badGood: '悪い例と良い例',
      oldOpen: 'ユーザーはアニメ風',
    },
    ko: {
      coverage: '첫 문장',
      meta: '메타',
      check: '자체 점검',
      positions: [/첫 문장/, /마무리/],
      example: '짧은 예시',
      baseRegister: '기본 문체',
      density: '문장마다',
      badGood: '나쁜 예와 좋은 예',
      oldOpen: '사용자는 애니메이션',
    },
  }
  for (const style of STYLE_LIST) {
    if (style.id === 'off') continue
    for (const lang of ['en', 'ja', 'ko']) {
      const marker = markers[lang]
      const prompt = promptFor(style, lang)
      const own = style.prompts[lang]
      assert.ok(prompt.includes(marker.coverage), `coverage ${style.id}/${lang}`)
      assert.ok(prompt.includes(marker.meta), `anti-echo ${style.id}/${lang}`)
      assert.ok(prompt.includes(marker.check), `self-check ${style.id}/${lang}`)
      assert.ok(!prompt.includes(marker.oldOpen), `identity framing ${style.id}/${lang}`)
      assert.ok(prompt.length >= 2800, `prompt depth ${style.id}/${lang} (${prompt.length})`)
      assert.ok(own.includes(marker.example), `position example ${style.id}/${lang}`)
      assert.ok(own.includes(marker.baseRegister), `base register ${style.id}/${lang}`)
      assert.ok(own.includes(marker.density), `per-sentence density ${style.id}/${lang}`)
      assert.ok(own.includes(marker.badGood), `bad/good contrast ${style.id}/${lang}`)
      for (const position of marker.positions) {
        assert.match(own, position, `position guide ${style.id}/${lang}`)
      }
    }
  }
})

test('cat voice does not teach a plain body with a nya tail', () => {
  const cat = STYLE_LIST.find(style => style.id === 'cat')
  assert.ok(cat, 'cat voice')
  assert.ok(!cat.prompts.en.includes('Leave the rest plain'), 'English plain-body instruction')
  assert.ok(!cat.prompts.ko.includes('나머지는 평범하게'), 'Korean plain-body instruction')
  assert.ok(!cat.prompts.ja.includes('残りは普通'), 'Japanese plain-body instruction')
  assert.ok(!cat.prompts.en.includes('close the paragraph with "nya"'), 'English paragraph-tail instruction')
  assert.ok(!cat.prompts.ko.includes('문단을 닫는 문장에 "냥"을 붙인다'), 'Korean paragraph-tail instruction')
  assert.ok(!cat.prompts.ja.includes('段落の締めの文に「にゃ」を付ける'), 'Japanese paragraph-tail instruction')
  assert.ok(cat.prompts.en.includes('Bad vs good'), 'English bad/good contrast')
  assert.ok(cat.prompts.ko.includes('나쁜 예와 좋은 예'), 'Korean bad/good contrast')
  assert.ok(cat.prompts.ja.includes('悪い例と良い例'), 'Japanese bad/good contrast')
  assert.ok(!cat.prompts.en.includes('one sentence in three'), 'English sparse marker rule')
  assert.ok(!cat.prompts.ko.includes('세 문장 중'), 'Korean sparse marker rule')
  assert.ok(!cat.prompts.ja.includes('三文に一文'), 'Japanese sparse marker rule')
  assert.ok(cat.prompts.en.includes('Every sentence carries at least one cat marker'), 'English per-sentence marker')
  assert.ok(cat.prompts.ko.includes('문장마다 고양이 표지'), 'Korean per-sentence marker')
  assert.ok(cat.prompts.ja.includes('すべての文に猫の印'), 'Japanese per-sentence marker')
})

test('voice reminder states the active voice without instruction framing', () => {
  const banned = {
    en: /instruction|system prompt|\bmode\b/i,
    ja: /指示|システムプロンプト|モード/,
    ko: /지시|시스템 프롬프트|모드/,
  }
  const coverage = { en: 'first sentence', ja: '最初の文', ko: '첫 문장' }
  for (const style of STYLE_LIST) {
    if (style.id === 'off') continue
    for (const lang of ['en', 'ja', 'ko']) {
      const context = contextFor(style, lang)
      assert.ok(context.includes(style.names[lang]), `reminder name ${style.id}/${lang}`)
      assert.ok(context.includes(coverage[lang]), `reminder coverage ${style.id}/${lang}`)
      assert.doesNotMatch(context, banned[lang], `reminder echo priming ${style.id}/${lang}`)
      assert.ok(!context.includes('[moeseek]'), `reminder tag ${style.id}/${lang}`)
    }
  }
})

test('projection views are stable for every style and language pair', () => {
  assert.equal(Object.keys(VIEWS).length, STYLE_LIST.length * LANG_LIST.length)
  for (const style of STYLE_LIST) {
    for (const lang of LANG_LIST) {
      const view = viewOf(style.id, lang.id)
      assert.equal(view, viewOf(style.id, lang.id))
      assert.deepEqual(view, { style: style.id, lang: lang.id })
    }
  }
})

test('client catalogue matches the host catalogue', () => {
  const clientStyles = [...client.matchAll(/\{ id: '([^']+)', mark: /g)].map(match => match[1])
  assert.deepEqual(clientStyles, [...STYLE_IDS])
  const languages = /const LANGUAGES = \[([^\]]+)\]/.exec(client)
  assert.ok(languages, 'client LANGUAGES')
  const clientLangs = [...languages[1].matchAll(/'([^']+)'/g)].map(match => match[1])
  assert.deepEqual(clientLangs, [...LANG_IDS])
})

test('client dictionaries have identical keys and clean scripts', () => {
  const blocks = {
    en: clientDict('en'),
    ko: clientDict('ko'),
    ja: clientDict('ja'),
    zh: clientDict('zh'),
  }
  const keys = Object.fromEntries(Object.entries(blocks).map(([name, block]) => [name, dictionaryKeys(block)]))
  const base = keys.en
  assert.equal(new Set(base).size, base.length, 'English duplicate keys')
  for (const [name, list] of Object.entries(keys)) {
    assert.equal(new Set(list).size, list.length, `${name} duplicate keys`)
    assert.deepEqual([...list].sort(), [...base].sort(), `${name} key parity`)
  }
  assert.ok(!hangul.test(blocks.en), 'English dictionary has Hangul')
  assert.ok(hangul.test(blocks.ko), 'Korean dictionary missing Hangul')
  assert.ok(kana.test(blocks.ja), 'Japanese dictionary missing kana')
  assert.ok(han.test(blocks.zh), 'Chinese dictionary missing Han')
})
