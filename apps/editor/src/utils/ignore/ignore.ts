type Rule = {
  regex: RegExp
  negative: boolean
  dir_only: boolean
}

const IS_WINDOWS = process.platform === 'win32'
const ANY = '[\\s\\S]'

const escape_char = (char: string): string =>
  /[\\^$.*+?()[\]{}|]/.test(char) ? `\\${char}` : char

const escape_member = (char: string): string =>
  '\\]^-['.includes(char) ? `\\${char}` : char

const has_trailing_backslash = (text: string): boolean => {
  let count = 0
  while (text[text.length - 1 - count] === '\\') count++
  return count % 2 === 1
}

const trim_trailing_spaces = (line: string): string => {
  let end = line.length
  while (end > 0 && line[end - 1] === ' ') end--

  if (end < line.length) {
    let backslashes = 0
    while (line[end - 1 - backslashes] === '\\') backslashes++
    if (backslashes % 2 === 1) end++
  }

  return line.slice(0, end)
}

const parse_bracket = (
  glob: string,
  start: number
): { source: string; end: number } | undefined => {
  let i = start + 1
  let negated = false

  if (glob[i] === '!' || glob[i] === '^') {
    negated = true
    i++
  }

  let members = ''
  let is_first = true

  while (i < glob.length) {
    let char = glob[i]

    if (char === ']' && !is_first) {
      const source = negated
        ? `[^/${members}]`
        : members
          ? `(?!/)[${members}]`
          : '(?!)'
      return { source, end: i }
    }
    is_first = false

    if (char === '\\') {
      i++
      if (i >= glob.length) return undefined
      char = glob[i]
    }

    if (glob[i + 1] === '-' && i + 2 < glob.length && glob[i + 2] !== ']') {
      let to = glob[i + 2]
      i += 3
      if (to === '\\') {
        to = glob[i]
        i++
        if (to === undefined) return undefined
      }
      if (char <= to) {
        members += `${escape_member(char)}-${escape_member(to)}`
      }
      continue
    }

    members += escape_member(char)
    i++
  }

  return undefined
}

const glob_to_source = (glob: string): string | undefined => {
  let source = ''
  let i = 0

  while (i < glob.length) {
    const char = glob[i]

    if (char === '\\') {
      source += escape_char(glob[i + 1])
      i += 2
    } else if (char === '*') {
      let end = i
      while (glob[end] === '*') end++

      const at_segment_start = i === 0 || glob[i - 1] === '/'
      const at_segment_end = end === glob.length || glob[end] === '/'

      if (end - i >= 2 && at_segment_start && at_segment_end) {
        if (end === glob.length) {
          source += `${ANY}+`
          i = end
        } else {
          source += `(?:${ANY}*/)?`
          i = end + 1
        }
      } else {
        source += '[^/]*'
        i = end
      }
    } else if (char === '?') {
      source += '[^/]'
      i++
    } else if (char === '[') {
      const bracket = parse_bracket(glob, i)
      if (!bracket) return undefined
      source += bracket.source
      i = bracket.end + 1
    } else {
      source += escape_char(char)
      i++
    }
  }

  return source
}

const parse_rule = (raw: string, ignore_case: boolean): Rule | undefined => {
  let body = trim_trailing_spaces(raw)
  if (!body || body.startsWith('#')) return undefined

  const negative = body.startsWith('!')
  if (negative) body = body.slice(1)

  body = body.replace(/^\\([!#])/, '$1')

  const dir_only = body.endsWith('/')
  if (dir_only) body = body.slice(0, -1)

  if (!body || has_trailing_backslash(body)) return undefined

  const anchored = body.includes('/')
  if (body.startsWith('/')) body = body.slice(1)
  if (!body) return undefined

  const source = glob_to_source(body)
  if (source === undefined) return undefined

  const prefix = anchored ? '' : `(?:${ANY}*/)?`

  return {
    regex: new RegExp(`^${prefix}${source}$`, ignore_case ? 'i' : ''),
    negative,
    dir_only
  }
}

export class Ignore {
  private _rules: Rule[] = []
  private _cache = new Map<string, boolean>()
  private _ignore_case: boolean

  constructor(options?: { ignore_case?: boolean }) {
    this._ignore_case = options?.ignore_case ?? true
  }

  add(patterns: string | readonly string[]): this {
    const entries = typeof patterns === 'string' ? [patterns] : patterns

    for (const entry of entries) {
      for (const line of entry.split(/\r?\n/)) {
        const rule = parse_rule(line, this._ignore_case)
        if (rule) this._rules.push(rule)
      }
    }

    this._cache.clear()
    return this
  }

  ignores(pathname: string): boolean {
    const normalized = IS_WINDOWS ? pathname.replace(/\\/g, '/') : pathname
    const is_dir = normalized.endsWith('/')
    const segments = normalized.split('/').filter(Boolean)

    let current = ''
    for (let i = 0; i < segments.length; i++) {
      current = current ? `${current}/${segments[i]}` : segments[i]
      const level_is_dir = is_dir || i < segments.length - 1
      if (this._test(current, level_is_dir)) return true
    }

    return false
  }

  private _test(path: string, is_dir: boolean): boolean {
    const key = is_dir ? `${path}/` : path
    const cached = this._cache.get(key)
    if (cached !== undefined) return cached

    let result = false
    for (let i = this._rules.length - 1; i >= 0; i--) {
      const rule = this._rules[i]
      if (rule.dir_only && !is_dir) continue
      if (rule.regex.test(path)) {
        result = !rule.negative
        break
      }
    }

    this._cache.set(key, result)
    return result
  }
}
