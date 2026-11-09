import { Segment } from '../types'

const INVISIBLE_CHARS_REGEX = /[\u200B-\u200F\uFEFF]/g
const IGNORABLE_CHAR_REGEX = /[\s\u200B-\u200F\uFEFF]/

type Normalizer = (line: string) => string

type IndexedLine = {
  // Absolute offset of the line start (including leading whitespace)
  start: number
  // Absolute offset right after the last visible character of the line
  content_end: number
  normalized: string
}

const strip_invisible = (text: string) =>
  text.replace(INVISIBLE_CHARS_REGEX, '')

const normalize_strict: Normalizer = (line) => strip_invisible(line).trim()

const normalize_loose: Normalizer = (line) =>
  strip_invisible(line).replace(/\s+/g, ' ').trim()

const index_non_blank_lines = (params: {
  content: string
  from: number
  normalize: Normalizer
}): IndexedLine[] => {
  const { content, from, normalize } = params
  const result: IndexedLine[] = []
  let line_start = from

  while (line_start <= content.length) {
    let line_end = content.indexOf('\n', line_start)
    if (line_end == -1) line_end = content.length

    const normalized = normalize(content.slice(line_start, line_end))
    if (normalized !== '') {
      let content_end = line_end
      while (
        content_end > line_start &&
        IGNORABLE_CHAR_REGEX.test(content[content_end - 1])
      ) {
        content_end--
      }
      result.push({ start: line_start, content_end, normalized })
    }

    line_start = line_end + 1
  }

  return result
}

const find_sequence = (lines: IndexedLine[], pattern: string[]): number => {
  outer: for (let i = 0; i + pattern.length <= lines.length; i++) {
    for (let k = 0; k < pattern.length; k++) {
      if (lines[i + k].normalized !== pattern[k]) continue outer
    }
    return i
  }
  return -1
}

type BlockMatch = {
  match_start: number
  match_end: number
  matched_before: string
  matched_after: string
}

const find_block = (params: {
  content: string
  from: number
  context_before: string[]
  original: string[]
  context_after: string[]
  normalize: Normalizer
}): BlockMatch | null => {
  const prepare = (lines: string[]) =>
    lines.map(params.normalize).filter((l) => l !== '')

  const before = prepare(params.context_before)
  const original = prepare(params.original)
  const after = prepare(params.context_after)
  const pattern = [...before, ...original, ...after]

  if (pattern.length == 0) {
    return {
      match_start: params.from,
      match_end: params.from,
      matched_before: '',
      matched_after: ''
    }
  }

  const lines = index_non_blank_lines({
    content: params.content,
    from: params.from,
    normalize: params.normalize
  })
  const i = find_sequence(lines, pattern)
  if (i == -1) return null

  const match_start = lines[i].start
  const match_end = lines[i + pattern.length - 1].content_end

  const matched_before =
    before.length > 0
      ? params.content.slice(
          match_start,
          lines[i + before.length - 1].content_end
        )
      : ''

  const matched_after =
    after.length > 0
      ? params.content.slice(
          lines[i + before.length + original.length].start,
          match_end
        )
      : ''

  return { match_start, match_end, matched_before, matched_after }
}

export const apply_search_replace_to_content = (params: {
  original_content: string
  segments: Segment[]
}): string => {
  const line_ending = params.original_content.includes('\r\n') ? '\r\n' : '\n'
  let current_content = params.original_content
  const segments = params.segments
  let cursor = 0

  const MAX_CONTEXT_LINES = 5

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (segment.type !== 'search_replace') continue

    const prev = i > 0 ? segments[i - 1] : undefined
    const next = i < segments.length - 1 ? segments[i + 1] : undefined

    const context_before =
      prev && prev.type === 'common' ? prev.lines.slice(-MAX_CONTEXT_LINES) : []
    const context_after =
      next && next.type === 'common'
        ? next.lines.slice(0, MAX_CONTEXT_LINES)
        : []

    // Line-based matching (no giant regex) - avoids stack overflows and
    // "regular expression too large" errors for long blocks, notably on
    // Windows where the thread stack is small.
    const find_params = {
      content: current_content,
      from: cursor,
      context_before,
      original: segment.original_lines,
      context_after
    }
    const match =
      find_block({ ...find_params, normalize: normalize_strict }) ??
      find_block({ ...find_params, normalize: normalize_loose })

    if (!match) {
      const all_search_lines = [
        ...context_before,
        ...segment.original_lines,
        ...context_after
      ]
      const search_text = all_search_lines.join('\n')
      throw new Error(
        `Could not find content to replace for search replace block. Context:\n${search_text.slice(
          0,
          100
        )}...`
      )
    }

    const match_index = match.match_start
    const matched_length = match.match_end - match.match_start
    const matched_before = match.matched_before
    const matched_after = match.matched_after

    const updated_text = segment.updated_lines
      .map((line) => strip_invisible(line))
      .join(line_ending)

    const replacement_parts: string[] = []
    if (matched_before) replacement_parts.push(matched_before)
    if (segment.updated_lines.length > 0) {
      replacement_parts.push(updated_text)
    }
    if (matched_after) replacement_parts.push(matched_after)

    const replacement_text = replacement_parts.join(line_ending)

    current_content =
      current_content.slice(0, match_index) +
      replacement_text +
      current_content.slice(match_index + matched_length)

    const content_before_after_context = matched_before
      ? matched_before + line_ending + updated_text
      : updated_text
    cursor = matched_after
      ? match_index + content_before_after_context.length
      : match_index + replacement_text.length
  }

  return current_content
}
