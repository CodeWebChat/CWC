export type Diff_Change = {
  value: string
  added: boolean
  removed: boolean
  count: number
}

type Edit = 'equal' | 'remove' | 'add'

const tokenize_lines = (text: string): string[] => {
  const parts = text.split(/(\r\n|\n)/)

  if (parts[parts.length - 1] === '') {
    parts.pop()
  }

  const lines: string[] = []
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      lines[lines.length - 1] += parts[i]
    } else {
      lines.push(parts[i])
    }
  }

  return lines.filter((line) => line.length > 0)
}

const backtrack = (params: {
  trace: Int32Array[]
  old_length: number
  new_length: number
}): Edit[] => {
  const edits: Edit[] = []
  let x = params.old_length
  let y = params.new_length

  for (let d = params.trace.length - 1; d >= 0; d--) {
    if (d === 0) {
      while (x > 0 && y > 0) {
        edits.push('equal')
        x--
        y--
      }
      break
    }

    const v = params.trace[d]
    const k = x - y
    const prev_k =
      k === -d || (k !== d && v[k - 1 + d] < v[k + 1 + d]) ? k + 1 : k - 1
    const prev_x = v[prev_k + d]
    const prev_y = prev_x - prev_k

    while (x > prev_x && y > prev_y) {
      edits.push('equal')
      x--
      y--
    }

    edits.push(x === prev_x ? 'add' : 'remove')

    x = prev_x
    y = prev_y
  }

  return edits.reverse()
}

const myers_edits = (a: string[], b: string[]): Edit[] => {
  const n = a.length
  const m = b.length

  if (n === 0) return new Array<Edit>(m).fill('add')
  if (m === 0) return new Array<Edit>(n).fill('remove')

  const max = n + m
  const offset = max
  const v = new Int32Array(2 * max + 2)
  const trace: Int32Array[] = []

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice(offset - d, offset + d + 2))

    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1]
      } else {
        x = v[offset + k - 1] + 1
      }
      let y = x - k

      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }

      v[offset + k] = x

      if (x >= n && y >= m) {
        return backtrack({ trace, old_length: n, new_length: m })
      }
    }
  }

  return []
}

const compute_edits = (a: string[], b: string[]): Edit[] => {
  const n = a.length
  const m = b.length

  let prefix = 0
  while (prefix < n && prefix < m && a[prefix] === b[prefix]) {
    prefix++
  }

  let suffix = 0
  while (
    suffix < n - prefix &&
    suffix < m - prefix &&
    a[n - 1 - suffix] === b[m - 1 - suffix]
  ) {
    suffix++
  }

  const middle = myers_edits(
    a.slice(prefix, n - suffix),
    b.slice(prefix, m - suffix)
  )

  const edits: Edit[] = []
  for (let i = 0; i < prefix; i++) edits.push('equal')
  for (const edit of middle) edits.push(edit)
  for (let i = 0; i < suffix; i++) edits.push('equal')

  return edits
}

export const diff_lines = (params: {
  old_str: string
  new_str: string
  ignore_whitespace?: boolean
}): Diff_Change[] => {
  const old_lines = tokenize_lines(params.old_str)
  const new_lines = tokenize_lines(params.new_str)

  const normalize = (line: string) =>
    params.ignore_whitespace ? line.trim() : line

  const edits = compute_edits(
    old_lines.map(normalize),
    new_lines.map(normalize)
  )

  const changes: Diff_Change[] = []
  let old_pos = 0
  let new_pos = 0
  let i = 0

  while (i < edits.length) {
    if (edits[i] === 'equal') {
      let value = ''
      let count = 0
      while (i < edits.length && edits[i] === 'equal') {
        value += new_lines[new_pos]
        old_pos++
        new_pos++
        count++
        i++
      }
      changes.push({ value, added: false, removed: false, count })
    } else {
      let removed_value = ''
      let removed_count = 0
      let added_value = ''
      let added_count = 0
      while (i < edits.length && edits[i] !== 'equal') {
        if (edits[i] === 'remove') {
          removed_value += old_lines[old_pos++]
          removed_count++
        } else {
          added_value += new_lines[new_pos++]
          added_count++
        }
        i++
      }
      if (removed_count) {
        changes.push({
          value: removed_value,
          added: false,
          removed: true,
          count: removed_count
        })
      }
      if (added_count) {
        changes.push({
          value: added_value,
          added: true,
          removed: false,
          count: added_count
        })
      }
    }
  }

  return changes
}
