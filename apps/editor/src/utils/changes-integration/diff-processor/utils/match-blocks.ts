import { NormalizedLine, SearchBlock } from '../types'

export const match_blocks = (params: {
  search_replace_blocks: SearchBlock[]
  original_code_lines_normalized: NormalizedLine[]
  use_strict_whitespace?: boolean
}): void => {
  const normalize_added_line = (raw_line: string): string => {
    if (raw_line.trim() === '') {
      return '~nnn'
    }
    const clean_invisibles = raw_line
      .replace(/\r\n/g, '')
      .replace(/\r/g, '')
      .replace(/\n/g, '')
      .replace(/[\u200B-\u200F\uFEFF]/g, '')
    return params.use_strict_whitespace
      ? clean_invisibles
      : clean_invisibles.replace(/\s+/g, '')
  }

  let previous_found_index = 0
  for (let i = 0; i < params.search_replace_blocks.length; i++) {
    const block = params.search_replace_blocks[i]

    if (block.search_lines.length === 0 && previous_found_index === 0) {
      block.search_block_start_index = -1
      continue
    }

    const safe_trim_indices: number[] = []
    for (const replace_line of block.replace_lines) {
      if (replace_line.search_index === null) {
        break
      }
      safe_trim_indices.push(replace_line.search_index)
    }

    let max_trim_top = 0
    for (let k = 0; k < safe_trim_indices.length; k++) {
      if (safe_trim_indices[k] === k) {
        max_trim_top = k + 1
      } else {
        break
      }
    }

    if (max_trim_top > 0 && safe_trim_indices.length === max_trim_top) {
      if (
        max_trim_top < block.replace_lines.length &&
        block.replace_lines[max_trim_top].search_index === null
      ) {
        let has_deletion = true
        for (let r = max_trim_top + 1; r < block.replace_lines.length; r++) {
          if (block.replace_lines[r].search_index === max_trim_top) {
            has_deletion = false
            break
          }
        }
        if (!has_deletion) {
          max_trim_top -= 1
        }
      }
    }

    const find_match = (
      search_start_index: number
    ): {
      found: boolean
      matched_info: {
        start_index: number
        actual_count: number
        map: Map<number, number>
      } | null
      used_trim_top: number
    } => {
      let found = false
      let matched_info: {
        start_index: number
        actual_count: number
        map: Map<number, number>
      } | null = null
      let used_trim_top = 0

      for (let trim_cnt = 0; trim_cnt <= max_trim_top; trim_cnt++) {
        const current_search_lines = block.search_lines.slice(trim_cnt)
        if (current_search_lines.length === 0) continue

        for (
          let j = search_start_index;
          j < params.original_code_lines_normalized.length;
          j++
        ) {
          let search_ptr = 0
          let original_ptr = j
          const matched_indices: number[] = []
          const current_search_to_original = new Map<number, number>()

          while (
            search_ptr < current_search_lines.length &&
            original_ptr < params.original_code_lines_normalized.length
          ) {
            const s_val = current_search_lines[search_ptr]
            const o_val =
              params.original_code_lines_normalized[original_ptr].value

            if (s_val === o_val) {
              current_search_to_original.set(
                search_ptr + trim_cnt,
                params.original_code_lines_normalized[original_ptr].key
              )
              matched_indices.push(
                params.original_code_lines_normalized[original_ptr].key
              )
              search_ptr++
              original_ptr++
            } else if (o_val === '~nnn') {
              original_ptr++
            } else if (s_val === '~nnn') {
              search_ptr++
            } else {
              break
            }
          }

          if (search_ptr === current_search_lines.length) {
            matched_info = {
              start_index:
                matched_indices.length > 0
                  ? matched_indices[0]
                  : params.original_code_lines_normalized[j].key,
              actual_count:
                matched_indices.length > 0
                  ? matched_indices[matched_indices.length - 1] -
                    matched_indices[0] +
                    1
                  : 0,
              map: current_search_to_original
            }
            found = true
            break
          }
        }

        if (found) {
          used_trim_top = trim_cnt
          break
        }
      }

      if (!found) {
        for (let trim_cnt = 0; trim_cnt <= max_trim_top; trim_cnt++) {
          const current_search_lines = block.search_lines.slice(trim_cnt)
          if (current_search_lines.length === 0) continue

          for (
            let j = search_start_index;
            j < params.original_code_lines_normalized.length;
            j++
          ) {
            let search_ptr = 0
            let original_ptr = j
            const matched_indices: number[] = []
            const current_search_to_original = new Map<number, number>()
            let match_failed = false

            while (
              search_ptr < current_search_lines.length &&
              original_ptr < params.original_code_lines_normalized.length
            ) {
              const s_val = current_search_lines[search_ptr]
              const o_val =
                params.original_code_lines_normalized[original_ptr].value

              if (s_val === o_val) {
                current_search_to_original.set(
                  search_ptr + trim_cnt,
                  params.original_code_lines_normalized[original_ptr].key
                )
                matched_indices.push(
                  params.original_code_lines_normalized[original_ptr].key
                )
                search_ptr++
                original_ptr++
              } else if (o_val === '~nnn') {
                original_ptr++
              } else if (s_val === '~nnn') {
                search_ptr++
              } else {
                let found_ahead = false
                const max_lookahead = 50
                for (
                  let k = 1;
                  k <= max_lookahead &&
                  original_ptr + k <
                    params.original_code_lines_normalized.length;
                  k++
                ) {
                  if (
                    params.original_code_lines_normalized[original_ptr + k]
                      .value === s_val
                  ) {
                    found_ahead = true
                    original_ptr += k
                    break
                  }
                }
                if (!found_ahead) {
                  match_failed = true
                  break
                }
              }
            }

            if (!match_failed && search_ptr === current_search_lines.length) {
              matched_info = {
                start_index:
                  matched_indices.length > 0
                    ? matched_indices[0]
                    : params.original_code_lines_normalized[j].key,
                actual_count:
                  matched_indices.length > 0
                    ? matched_indices[matched_indices.length - 1] -
                      matched_indices[0] +
                      1
                    : 0,
                map: current_search_to_original
              }
              found = true
              break
            }
          }

          if (found) {
            used_trim_top = trim_cnt
            break
          }
        }
      }

      return { found, matched_info, used_trim_top }
    }

    let { found, matched_info, used_trim_top } =
      find_match(previous_found_index)

    if (!found && previous_found_index > 0) {
      ;({ found, matched_info, used_trim_top } = find_match(0))
    }

    if (found && matched_info) {
      block.search_block_start_index = matched_info.start_index
      block.actual_original_line_count = matched_info.actual_count
      block.search_to_original_map = matched_info.map

      if (used_trim_top > 0) {
        block.search_lines = block.search_lines.slice(used_trim_top)
        block.replace_lines = block.replace_lines.filter(
          (l) => l.search_index === null || l.search_index >= used_trim_top
        )
      }

      const has_additions = block.replace_lines.some(
        (l) => l.search_index === null
      )
      const is_noop =
        block.search_lines.length === block.after_search_lines.length &&
        block.search_lines.every((v, i) => v === block.after_search_lines[i])

      if (has_additions && !is_noop) {
        const check_start = Math.max(
          0,
          matched_info.start_index - block.after_search_lines.length
        )
        const check_end = Math.min(
          params.original_code_lines_normalized.length - 1,
          matched_info.start_index + matched_info.actual_count
        )

        let already_applied = false
        for (let j = check_start; j <= check_end; j++) {
          let after_ptr = 0
          let orig_ptr = j

          while (
            after_ptr < block.after_search_lines.length &&
            orig_ptr < params.original_code_lines_normalized.length
          ) {
            const a_val = block.after_search_lines[after_ptr]
            const o_val = params.original_code_lines_normalized[orig_ptr].value

            if (a_val === o_val) {
              after_ptr++
              orig_ptr++
            } else if (o_val === '~nnn') {
              orig_ptr++
            } else if (a_val === '~nnn') {
              after_ptr++
            } else {
              break
            }
          }

          if (after_ptr === block.after_search_lines.length) {
            already_applied = true
            break
          }
        }

        if (already_applied) {
          block.search_block_start_index = -2
        }
      }

      if (block.search_block_start_index !== -2 && has_additions && !is_noop) {
        const added_line_values = new Set<string>()
        for (const line of block.replace_lines) {
          if (line.search_index === null) {
            const norm = normalize_added_line(line.content)
            if (norm !== '~nnn') {
              added_line_values.add(norm)
            }
          }
        }

        const matched_original_indices = new Set(matched_info.map.values())
        const span_end =
          matched_info.start_index + matched_info.actual_count - 1
        for (let idx = matched_info.start_index; idx <= span_end; idx++) {
          if (!matched_original_indices.has(idx)) {
            const orig_val = params.original_code_lines_normalized[idx].value
            if (orig_val !== '~nnn' && added_line_values.has(orig_val)) {
              block.search_block_start_index = -2
              break
            }
          }
        }

        if (
          block.search_block_start_index !== -2 &&
          block.replace_lines[block.replace_lines.length - 1].search_index ===
            null
        ) {
          const trailing_additions: string[] = []
          for (let r = block.replace_lines.length - 1; r >= 0; r--) {
            if (block.replace_lines[r].search_index === null) {
              trailing_additions.unshift(
                normalize_added_line(block.replace_lines[r].content)
              )
            } else {
              break
            }
          }

          let orig_ptr = span_end + 1
          let add_ptr = 0
          let matched_non_empty = false
          while (
            add_ptr < trailing_additions.length &&
            orig_ptr < params.original_code_lines_normalized.length
          ) {
            const a_val = trailing_additions[add_ptr]
            const o_val = params.original_code_lines_normalized[orig_ptr].value
            if (a_val === o_val) {
              if (a_val !== '~nnn') {
                matched_non_empty = true
              }
              add_ptr++
              orig_ptr++
            } else if (o_val === '~nnn') {
              orig_ptr++
            } else if (a_val === '~nnn') {
              add_ptr++
            } else {
              break
            }
          }

          if (matched_non_empty) {
            block.search_block_start_index = -2
          }
        }
      }

      if (block.search_block_start_index !== -2) {
        const indices = Array.from(matched_info.map.values())
        previous_found_index = Math.max(...indices) + 1
      }
    } else {
      block.search_block_start_index = -2
    }
  }
}
