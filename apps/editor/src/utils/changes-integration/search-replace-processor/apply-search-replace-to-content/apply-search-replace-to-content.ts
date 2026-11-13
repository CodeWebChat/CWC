import { Segment } from '../types'

const INVISIBLE_CHARS_REGEX =
  /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g
const IGNORABLE_CHAR_REGEX =
  /[\s\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/
const EQUALS_DIVIDER_REGEX = /^={7}$/
const MAX_CONTEXT_LINES = 5

type Normalizer = (line: string) => string

type IndexedLine = {
  start: number
  content_end: number
  normalized: string
}

type LineIndexCache = {
  content: string
  strict?: IndexedLine[]
  loose?: IndexedLine[]
}

const strip_invisible = (text: string): string =>
  text.replace(INVISIBLE_CHARS_REGEX, '')

const normalize_strict: Normalizer = (line) => strip_invisible(line).trim()

const normalize_loose: Normalizer = (line) =>
  strip_invisible(line)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-*+]\s+/, '- ')
    .replace(/^\d+[.)]\s+/, '1. ')

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
    if (line_end === -1) line_end = content.length

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

const slice_indexed_lines_from = (
  lines: IndexedLine[],
  from: number
): IndexedLine[] => {
  if (from === 0) return lines
  let lo = 0
  let hi = lines.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (lines[mid].start < from) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo === 0 ? lines : lines.slice(lo)
}

const get_indexed_lines = (params: {
  cache: LineIndexCache
  from: number
  mode: 'strict' | 'loose'
}): IndexedLine[] => {
  const { cache, from, mode } = params
  const normalize = mode === 'strict' ? normalize_strict : normalize_loose

  if (from === 0 || cache.content[from - 1] === '\n') {
    let indexed = cache[mode]
    if (!indexed) {
      indexed = index_non_blank_lines({
        content: cache.content,
        from: 0,
        normalize
      })
      cache[mode] = indexed
    }
    return slice_indexed_lines_from(indexed, from)
  }

  return index_non_blank_lines({
    content: cache.content,
    from,
    normalize
  })
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
  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix++
  }

  let suffix = 0
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++
  }

  const lcs: [number, number][] = []
  for (let i = 0; i < prefix; i++) {
    lcs.push([i, i])
  }

  const mid_a_end = a.length - suffix
  const mid_b_end = b.length - suffix
  const m = mid_a_end - prefix
  const n = mid_b_end - prefix

  if (m > 0 && n > 0) {
    const stride = n + 1
    const dp = new Int32Array((m + 1) * stride)

    for (let i = 1; i <= m; i++) {
      const a_val = a[prefix + i - 1]
      const row = i * stride
      const prev_row = (i - 1) * stride
      for (let j = 1; j <= n; j++) {
        if (a_val === b[prefix + j - 1]) {
          dp[row + j] = dp[prev_row + j - 1] + 1
        } else {
          const up = dp[prev_row + j]
          const left = dp[row + j - 1]
          dp[row + j] = up > left ? up : left
        }
      }
    }

    const mid_lcs: [number, number][] = []
    let i = m
    let j = n
    while (i > 0 && j > 0) {
      if (a[prefix + i - 1] === b[prefix + j - 1]) {
        mid_lcs.push([prefix + i - 1, prefix + j - 1])
        i--
        j--
      } else if (dp[(i - 1) * stride + j] > dp[i * stride + (j - 1)]) {
        i--
      } else {
        j--
      }
    }
    for (let k = mid_lcs.length - 1; k >= 0; k--) {
      lcs.push(mid_lcs[k])
    }
  }

  for (let s = suffix; s > 0; s--) {
    lcs.push([a.length - s, b.length - s])
  }

  return lcs
}

type BlockStructure = {
  gaps: string[][]
  non_blanks: { text: string; normalized: string }[]
}

const get_non_blank_structure = (
  lines: string[],
  normalize: Normalizer
): BlockStructure => {
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

const same_gap = (a: string[], b: string[]): boolean => a.length === b.length

type BlockMatch = {
  original_start: number
  original_end: number
  original_indexed_lines: IndexedLine[]
  leading_newline_needed: boolean
  trailing_newline_needed: boolean
}

const find_block = (params: {
  cache: LineIndexCache
  from: number
  context_before: string[]
  original: string[]
  context_after: string[]
  mode: 'strict' | 'loose'
}): BlockMatch | null => {
  const normalize =
    params.mode === 'strict' ? normalize_strict : normalize_loose
  const prepare = (lines: string[]) =>
    lines.map(normalize).filter((l) => l !== '')

  const before = prepare(params.context_before)
  const original = prepare(params.original)
  const after = prepare(params.context_after)
  const pattern = [...before, ...original, ...after]

  if (pattern.length === 0) {
    return {
      original_start: params.from,
      original_end: params.from,
      original_indexed_lines: [],
      leading_newline_needed: false,
      trailing_newline_needed:
        params.from < params.cache.content.length &&
        params.cache.content[params.from] !== '\n' &&
        params.cache.content[params.from] !== '\r'
    }
  }

  const lines = get_indexed_lines({
    cache: params.cache,
    from: params.from,
    mode: params.mode
  })
  const i = find_sequence(lines, pattern)
  if (i === -1) return null

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
      original_start = lines[i].start
    }
    original_end = original_start
  }

  return {
    original_start,
    original_end,
    original_indexed_lines,
    leading_newline_needed: before.length > 0,
    trailing_newline_needed:
      original.length === 0 && before.length === 0 && after.length > 0
  }
}

const find_block_with_fallback = (params: {
  cache: LineIndexCache
  cursor: number
  context_before: string[]
  original: string[]
  context_after: string[]
}): BlockMatch | null => {
  const find_params = {
    cache: params.cache,
    from: params.cursor,
    context_before: params.context_before,
    original: params.original,
    context_after: params.context_after
  }
  let match =
    find_block({ ...find_params, mode: 'strict' }) ??
    find_block({ ...find_params, mode: 'loose' })

  if (!match && params.cursor > 0) {
    const fallback_params = { ...find_params, from: 0 }
    match =
      find_block({ ...fallback_params, mode: 'strict' }) ??
      find_block({ ...fallback_params, mode: 'loose' })
  }

  return match
}

const recover_split_equals_block = (params: {
  cache: LineIndexCache
  cursor: number
  context_before: string[]
  original_lines: string[]
  updated_lines: string[]
  context_after: string[]
  initial_match: BlockMatch | null
}): {
  original_lines: string[]
  updated_lines: string[]
  match: BlockMatch | null
} => {
  const {
    cache,
    cursor,
    context_before,
    original_lines: raw_original,
    updated_lines: raw_updated,
    context_after,
    initial_match
  } = params

  const has_non_blank_after = context_after.some(
    (line) => normalize_loose(line) !== ''
  )
  if (initial_match && has_non_blank_after) {
    return {
      original_lines: raw_original,
      updated_lines: raw_updated,
      match: initial_match
    }
  }

  let original_lines = raw_original
  let updated_lines = raw_updated
  let match = initial_match

  for (let k = 0; k < raw_updated.length; k++) {
    if (!EQUALS_DIVIDER_REGEX.test(strip_invisible(raw_updated[k]).trim())) {
      continue
    }

    const cand_original = [
      ...raw_original,
      raw_updated[k],
      ...raw_updated.slice(0, k)
    ]

    const cand_match = find_block_with_fallback({
      cache,
      cursor,
      context_before,
      original: cand_original,
      context_after
    })

    if (cand_match) {
      original_lines = cand_original
      updated_lines = raw_updated.slice(k + 1)
      match = cand_match
    }
  }

  return { original_lines, updated_lines, match }
}

const align_non_blank_lines = (params: {
  current_content: string
  match: BlockMatch
  original_lines: string[]
  updated_lines: string[]
}): {
  orig_structure: BlockStructure
  upd_structure: BlockStructure
  aligned_orig_idx: (number | null)[]
} => {
  const { current_content, match, original_lines, updated_lines } = params
  const orig_structure = get_non_blank_structure(
    original_lines,
    normalize_loose
  )
  const upd_structure = get_non_blank_structure(updated_lines, normalize_loose)
  const orig_normalized = match.original_indexed_lines.map((l) =>
    normalize_loose(current_content.slice(l.start, l.content_end))
  )
  const lcs_mapping = compute_lcs(
    orig_normalized,
    upd_structure.non_blanks.map((l) => l.normalized)
  )

  const orig_count = match.original_indexed_lines.length
  const upd_count = upd_structure.non_blanks.length

  const aligned_orig_idx: (number | null)[] = Array(upd_count).fill(null)
  for (const [o_idx, u_idx] of lcs_mapping) {
    aligned_orig_idx[u_idx] = o_idx
  }

  const anchors: [number, number][] = [
    [-1, -1],
    ...lcs_mapping,
    [orig_count, upd_count]
  ]
  for (let a = 0; a + 1 < anchors.length; a++) {
    const [prev_orig, prev_upd] = anchors[a]
    const [next_orig, next_upd] = anchors[a + 1]
    const orig_hunk_start = prev_orig + 1
    const orig_hunk_len = next_orig - orig_hunk_start
    const upd_hunk_start = prev_upd + 1
    const upd_hunk_len = next_upd - upd_hunk_start

    if (upd_hunk_len === 0) continue

    if (orig_hunk_len === 0) {
      if (next_orig < orig_count) {
        aligned_orig_idx[upd_hunk_start] = next_orig
      }
    } else {
      aligned_orig_idx[upd_hunk_start] = orig_hunk_start
      if (orig_hunk_len === upd_hunk_len) {
        for (let offset = 1; offset < upd_hunk_len; offset++) {
          aligned_orig_idx[upd_hunk_start + offset] = orig_hunk_start + offset
        }
      } else if (orig_hunk_len >= 2 && upd_hunk_len > orig_hunk_len) {
        aligned_orig_idx[upd_hunk_start + upd_hunk_len - 1] =
          orig_hunk_start + orig_hunk_len - 1
      }
    }
  }

  return { orig_structure, upd_structure, aligned_orig_idx }
}

const build_replacement_text = (params: {
  current_content: string
  match: BlockMatch
  orig_structure: BlockStructure
  upd_structure: BlockStructure
  aligned_orig_idx: (number | null)[]
  line_ending: string
}): {
  replacement_text: string
  original_start: number
  original_end: number
} => {
  const {
    current_content,
    match,
    orig_structure,
    upd_structure,
    aligned_orig_idx,
    line_ending
  } = params
  const orig_count = match.original_indexed_lines.length
  const upd_count = upd_structure.non_blanks.length

  const get_curr_gap = (orig_idx: number): string => {
    const gap_start =
      orig_idx === 0
        ? match.original_start
        : match.original_indexed_lines[orig_idx - 1].content_end
    const gap_end = match.original_indexed_lines[orig_idx].start
    return current_content.slice(gap_start, gap_end)
  }

  let replacement_text = ''
  const format_upd_gap = (upd_idx: number): string => {
    let out = ''
    if (replacement_text.length > 0 || match.leading_newline_needed) {
      out += line_ending
    }
    const upd_gap = upd_structure.gaps[upd_idx]
    if (upd_gap.length > 0) {
      out += upd_gap.map(strip_invisible).join(line_ending) + line_ending
    }
    return out
  }

  const used_orig_gaps = new Set<number>()

  for (let j = 0; j < upd_count; j++) {
    const orig_idx = aligned_orig_idx[j]
    if (
      orig_idx !== null &&
      !used_orig_gaps.has(orig_idx) &&
      same_gap(orig_structure.gaps[orig_idx], upd_structure.gaps[j])
    ) {
      used_orig_gaps.add(orig_idx)
      let gap_text = get_curr_gap(orig_idx)
      if (replacement_text.length === 0 && !match.leading_newline_needed) {
        gap_text = ''
      } else if (replacement_text.length > 0 && !gap_text.includes('\n')) {
        gap_text = format_upd_gap(j)
      }
      replacement_text += gap_text
    } else {
      if (orig_idx !== null) {
        used_orig_gaps.add(orig_idx)
      }
      replacement_text += format_upd_gap(j)
    }

    replacement_text += strip_invisible(upd_structure.non_blanks[j].text)
  }

  let original_start = match.original_start
  let original_end = match.original_end
  const last_orig_gap = orig_structure.gaps[orig_count]
  const last_upd_gap = upd_structure.gaps[upd_count]

  if (!same_gap(last_orig_gap, last_upd_gap)) {
    if (last_upd_gap.length > last_orig_gap.length) {
      const extra_blank_lines = last_upd_gap.slice(last_orig_gap.length)
      if (replacement_text.length > 0 && !replacement_text.endsWith('\n')) {
        replacement_text += line_ending
      }
      replacement_text += extra_blank_lines
        .map(strip_invisible)
        .join(line_ending)
    } else {
      let to_remove = last_orig_gap.length - last_upd_gap.length
      while (to_remove > 0 && original_end < current_content.length) {
        const nl = current_content.indexOf('\n', original_end)
        if (nl === -1) break
        const next_nl = current_content.indexOf('\n', nl + 1)
        const line_end = next_nl === -1 ? current_content.length : next_nl
        const line_between = current_content.slice(nl + 1, line_end)
        if (normalize_loose(line_between) !== '') break
        original_end = line_end
        to_remove--
      }
    }
  }

  if (match.trailing_newline_needed && replacement_text.length > 0) {
    replacement_text += line_ending
  }

  if (
    replacement_text.length === 0 &&
    !match.leading_newline_needed &&
    match.original_indexed_lines.length > 0
  ) {
    const next_line_break = current_content.indexOf('\n', original_end)
    if (next_line_break !== -1) {
      original_end = next_line_break + 1
    } else if (
      original_start > 0 &&
      current_content[original_start - 1] === '\n'
    ) {
      original_start -=
        original_start >= 2 && current_content[original_start - 2] === '\r'
          ? 2
          : 1
    }
  }

  return { replacement_text, original_start, original_end }
}

const format_failed_match_error = (params: {
  segment_index: number
  context_before: string[]
  original_lines: string[]
  context_after: string[]
}): string => {
  const primary_lines =
    params.original_lines.length > 0
      ? params.original_lines
      : [...params.context_before, ...params.context_after]
  const preview = primary_lines.join('\n').slice(0, 200)
  return `Could not find content to replace for search replace block (segment ${params.segment_index}). Target:\n${preview}...`
}

export const apply_search_replace_to_content = (params: {
  original_content: string
  segments: Segment[]
}): string => {
  const line_ending = params.original_content.includes('\r\n') ? '\r\n' : '\n'
  let current_content = params.original_content
  const segments = params.segments
  let cursor = 0

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

    const cache: LineIndexCache = { content: current_content }

    const initial_match = find_block_with_fallback({
      cache,
      cursor,
      context_before,
      original: segment.original_lines,
      context_after
    })

    const { original_lines, updated_lines, match } = recover_split_equals_block(
      {
        cache,
        cursor,
        context_before,
        original_lines: segment.original_lines,
        updated_lines: segment.updated_lines,
        context_after,
        initial_match
      }
    )

    const is_noop =
      original_lines.length === updated_lines.length &&
      original_lines.every((line, idx) => line === updated_lines[idx])

    if (is_noop) {
      if (match) {
        cursor = Math.max(cursor, match.original_end)
      }
      continue
    }

    if (!match) {
      throw new Error(
        format_failed_match_error({
          segment_index: i,
          context_before,
          original_lines,
          context_after
        })
      )
    }

    const { orig_structure, upd_structure, aligned_orig_idx } =
      align_non_blank_lines({
        current_content,
        match,
        original_lines,
        updated_lines
      })

    const { replacement_text, original_start, original_end } =
      build_replacement_text({
        current_content,
        match,
        orig_structure,
        upd_structure,
        aligned_orig_idx,
        line_ending
      })

    const old_len = original_end - original_start
    const delta = replacement_text.length - old_len
    current_content =
      current_content.slice(0, original_start) +
      replacement_text +
      current_content.slice(original_end)

    cursor = Math.max(original_start + replacement_text.length, cursor + delta)
  }

  return current_content
}
