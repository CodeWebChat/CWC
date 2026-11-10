import { Segment } from '../types'

const INVISIBLE_CHARS_REGEX = /[\u200B-\u200F\uFEFF]/g
const IGNORABLE_CHAR_REGEX = /[\s\u200B-\u200F\uFEFF]/

type Normalizer = (line: string) => string

type IndexedLine = {
  start: number
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

const compute_lcs = (a: string[], b: string[]): [number, number][] => {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const lcs: [number, number][] = []
  let i = m,
    j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.push([i - 1, j - 1])
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  return lcs.reverse()
}

type UpdStructure = {
  gaps: string[][]
  non_blanks: { text: string; normalized: string }[]
}

const get_non_blank_structure = (
  lines: string[],
  normalize: Normalizer
): UpdStructure => {
  const gaps: string[][] = [[]]
  const non_blanks: { text: string; normalized: string }[] = []

  for (const line of lines) {
    const norm = normalize(line)
    if (norm === '') {
      gaps[gaps.length - 1].push(line)
    } else {
      non_blanks.push({ text: line, normalized: norm })
      gaps.push([])
    }
  }
  return { gaps, non_blanks }
}

type BlockMatch = {
  match_start: number
  match_end: number
  original_start: number
  original_end: number
  original_indexed_lines: IndexedLine[]
  leading_newline_needed: boolean
  trailing_newline_needed: boolean
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
      original_start: params.from,
      original_end: params.from,
      original_indexed_lines: [],
      leading_newline_needed: false,
      trailing_newline_needed: false
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

  const original_indexed_lines = lines.slice(
    i + before.length,
    i + before.length + original.length
  )

  let original_start: number
  let original_end: number

  if (original.length > 0) {
    if (before.length > 0) {
      original_start = lines[i + before.length - 1].content_end
    } else {
      original_start = original_indexed_lines[0].start
    }
    original_end =
      original_indexed_lines[original_indexed_lines.length - 1].content_end
  } else {
    if (before.length > 0) {
      original_start = lines[i + before.length - 1].content_end
    } else {
      original_start = match_start
    }
    original_end = original_start
  }

  return {
    match_start,
    match_end,
    original_start,
    original_end,
    original_indexed_lines,
    leading_newline_needed: before.length > 0,
    trailing_newline_needed:
      original.length == 0 && before.length == 0 && after.length > 0
  }
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

    const upd_structure = get_non_blank_structure(
      segment.updated_lines,
      normalize_loose
    )
    const orig_normalized = match.original_indexed_lines.map((l) =>
      normalize_loose(current_content.slice(l.start, l.content_end))
    )
    const lcs_mapping = compute_lcs(
      orig_normalized,
      upd_structure.non_blanks.map((l) => l.normalized)
    )

    let replacement_text = ''
    let last_matched_orig_idx = -1

    for (let j = 0; j < upd_structure.non_blanks.length; j++) {
      const mapping = lcs_mapping.find((m) => m[1] === j)

      if (mapping) {
        const orig_idx = mapping[0]

        let gap_start: number
        if (orig_idx === 0) {
          gap_start = match.original_start
        } else {
          gap_start = match.original_indexed_lines[orig_idx - 1].content_end
        }
        const gap_end = match.original_indexed_lines[orig_idx].start

        let gap_text = current_content.slice(gap_start, gap_end)

        if (replacement_text.length === 0 && !match.leading_newline_needed) {
          gap_text = ''
        }

        if (replacement_text.length > 0 && !gap_text.includes('\n')) {
          if (!replacement_text.endsWith('\n')) {
            replacement_text += line_ending
          }
          const upd_gap = upd_structure.gaps[j]
          if (upd_gap.length > 0) {
            replacement_text +=
              upd_gap.map(strip_invisible).join(line_ending) + line_ending
          }
          gap_text = ''
        }

        replacement_text += gap_text
        replacement_text += upd_structure.non_blanks[j].text

        last_matched_orig_idx = orig_idx
      } else {
        let next_matched_orig_idx = match.original_indexed_lines.length
        for (let k = j + 1; k < upd_structure.non_blanks.length; k++) {
          const m = lcs_mapping.find((m) => m[1] === k)
          if (m) {
            next_matched_orig_idx = m[0]
            break
          }
        }

        let gap_to_use: string | null = null
        if (last_matched_orig_idx + 1 < next_matched_orig_idx) {
          const deleted_idx = last_matched_orig_idx + 1
          let g_start: number
          if (deleted_idx === 0) {
            g_start = match.original_start
          } else {
            g_start = match.original_indexed_lines[deleted_idx - 1].content_end
          }
          const g_end = match.original_indexed_lines[deleted_idx].start
          gap_to_use = current_content.slice(g_start, g_end)
          last_matched_orig_idx = deleted_idx
        }

        if (gap_to_use !== null) {
          replacement_text += gap_to_use
        } else {
          const needs_line_break =
            replacement_text.length > 0 || match.leading_newline_needed
          if (needs_line_break && !replacement_text.endsWith('\n')) {
            replacement_text += line_ending
          }
          const upd_gap = upd_structure.gaps[j]
          if (upd_gap.length > 0) {
            replacement_text +=
              upd_gap.map(strip_invisible).join(line_ending) + line_ending
          }
        }

        replacement_text += upd_structure.non_blanks[j].text
      }
    }

    let final_gap_start: number
    if (match.original_indexed_lines.length > 0) {
      final_gap_start =
        match.original_indexed_lines[match.original_indexed_lines.length - 1]
          .content_end
    } else {
      final_gap_start = match.original_start
    }
    replacement_text += current_content.slice(
      final_gap_start,
      match.original_end
    )

    const last_upd_gap = upd_structure.gaps[upd_structure.gaps.length - 1]
    if (last_upd_gap.length > 0) {
      if (replacement_text.length > 0 && !replacement_text.endsWith('\n')) {
        replacement_text += line_ending
      }
      replacement_text += last_upd_gap.map(strip_invisible).join(line_ending)
    }

    if (match.trailing_newline_needed && replacement_text.length > 0) {
      replacement_text += line_ending
    }

    // Deleting whole lines with no preceding context: the region starts at a
    // line start, so the line break after the last deleted line has to go too.
    let original_end = match.original_end
    if (
      replacement_text.length === 0 &&
      !match.leading_newline_needed &&
      match.original_indexed_lines.length > 0
    ) {
      const next_line_break = current_content.indexOf('\n', original_end)
      if (next_line_break !== -1) original_end = next_line_break + 1
    }
    current_content =
      current_content.slice(0, match.original_start) +
      replacement_text +
      current_content.slice(original_end)

    cursor = match.original_start + replacement_text.length
  }

  return current_content
}
