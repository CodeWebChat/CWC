import { diff_lines, Diff_Change } from './diff-lines'

const to_xml = (changes: Diff_Change[]): string =>
  changes
    .map((change) => {
      if (change.added) return `<ins>${change.value}</ins>`
      if (change.removed) return `<del>${change.value}</del>`
      return change.value
    })
    .join('')

describe('diff_lines', () => {
  it('should return an empty array for two empty strings', () => {
    expect(diff_lines({ old_str: '', new_str: '' })).toEqual([])
  })

  it('should treat identical texts as a single unchanged change', () => {
    expect(diff_lines({ old_str: 'a\nb\nc\n', new_str: 'a\nb\nc\n' })).toEqual([
      { value: 'a\nb\nc\n', added: false, removed: false, count: 3 }
    ])
  })

  it('should diff a replaced line', () => {
    const changes = diff_lines({
      old_str: 'line\nold value\nline',
      new_str: 'line\nnew value\nline'
    })
    expect(changes).toEqual([
      { value: 'line\n', added: false, removed: false, count: 1 },
      { value: 'old value\n', added: false, removed: true, count: 1 },
      { value: 'new value\n', added: true, removed: false, count: 1 },
      { value: 'line', added: false, removed: false, count: 1 }
    ])
  })

  it('should detect added lines', () => {
    const changes = diff_lines({ old_str: 'a\nd\n', new_str: 'a\nb\nc\nd\n' })
    expect(to_xml(changes)).toBe('a\n<ins>b\nc\n</ins>d\n')
    expect(changes[1].count).toBe(2)
  })

  it('should detect removed lines', () => {
    const changes = diff_lines({ old_str: 'a\nb\nc\nd\n', new_str: 'a\nd\n' })
    expect(to_xml(changes)).toBe('a\n<del>b\nc\n</del>d\n')
    expect(changes[1].count).toBe(2)
  })

  it('should handle an empty old string', () => {
    expect(diff_lines({ old_str: '', new_str: 'a\nb' })).toEqual([
      { value: 'a\nb', added: true, removed: false, count: 2 }
    ])
  })

  it('should handle an empty new string', () => {
    expect(diff_lines({ old_str: 'a\nb\n', new_str: '' })).toEqual([
      { value: 'a\nb\n', added: false, removed: true, count: 2 }
    ])
  })

  it('should treat a missing trailing newline as a change by default', () => {
    expect(to_xml(diff_lines({ old_str: 'a\nb', new_str: 'a\nb\n' }))).toBe(
      'a\n<del>b</del><ins>b\n</ins>'
    )
  })

  it('should handle windows line endings', () => {
    const changes = diff_lines({
      old_str: 'line\r\nold value\r\nline',
      new_str: 'line\r\nnew value\r\nline'
    })
    expect(to_xml(changes)).toBe(
      'line\r\n<del>old value\r\n</del><ins>new value\r\n</ins>line'
    )
  })

  it('should handle empty lines', () => {
    const changes = diff_lines({
      old_str: 'line\n\nold value\n\nline',
      new_str: 'line\n\nnew value\n\nline'
    })
    expect(to_xml(changes)).toBe(
      'line\n\n<del>old value\n</del><ins>new value\n</ins>\nline'
    )
  })

  it('should prefer deletions before insertions', () => {
    const changes = diff_lines({
      old_str: 'a\nb\nc\nd\n',
      new_str: 'a\nc\nb\nd\n'
    })
    expect(to_xml(changes)).toBe('a\n<del>b\n</del>c\n<ins>b\n</ins>d\n')

    const changes_reversed = diff_lines({
      old_str: 'a\nc\nb\nd\n',
      new_str: 'a\nb\nc\nd\n'
    })
    expect(to_xml(changes_reversed)).toBe(
      'a\n<del>c\n</del>b\n<ins>c\n</ins>d\n'
    )
  })

  it('should find a minimal diff for interleaved changes', () => {
    const changes = diff_lines({
      old_str: 'a\nb\nc\nd\ne\nf\n',
      new_str: 'a\nx\nc\ny\ne\nf\n'
    })
    expect(to_xml(changes)).toBe(
      'a\n<del>b\n</del><ins>x\n</ins>c\n<del>d\n</del><ins>y\n</ins>e\nf\n'
    )
  })

  it('should reconstruct both texts from the changes', () => {
    const old_str = 'one\ntwo\nthree\nfour\nfive\nsix\nseven\n'
    const new_str = 'zero\none\nthree\nfour\nFIVE\nsix\neight\nnine\n'
    const changes = diff_lines({ old_str, new_str })

    const rebuilt_old = changes
      .filter((change) => !change.added)
      .map((change) => change.value)
      .join('')
    const rebuilt_new = changes
      .filter((change) => !change.removed)
      .map((change) => change.value)
      .join('')

    expect(rebuilt_old).toBe(old_str)
    expect(rebuilt_new).toBe(new_str)
  })

  describe('ignore_whitespace', () => {
    it('should detect whitespace differences when disabled', () => {
      const changes = diff_lines({
        old_str: 'line\nvalue \nline',
        new_str: 'line\nvalue\nline'
      })
      expect(to_xml(changes)).toBe(
        'line\n<del>value \n</del><ins>value\n</ins>line'
      )
    })

    it('should ignore leading and trailing whitespace when enabled', () => {
      const changes = diff_lines({
        old_str: 'line\n  value \nline',
        new_str: 'line\nvalue\nline',
        ignore_whitespace: true
      })
      expect(changes).toEqual([
        { value: 'line\nvalue\nline', added: false, removed: false, count: 3 }
      ])
    })

    it('should ignore line ending differences when enabled', () => {
      const changes = diff_lines({
        old_str: 'a\r\nb\r\n',
        new_str: 'a\nb\n',
        ignore_whitespace: true
      })
      expect(changes.every((change) => !change.added && !change.removed)).toBe(
        true
      )
    })

    it('should not treat adding whitespace to an empty line as an insertion', () => {
      const changes = diff_lines({
        old_str: 'foo\n\nbar',
        new_str: 'foo\n \nbar',
        ignore_whitespace: true
      })
      expect(to_xml(changes)).toBe('foo\n \nbar')
    })

    it('should still report added whitespace-only lines at the end', () => {
      const changes = diff_lines({
        old_str: 'foo\nbar\n',
        new_str: 'foo\nbar\n  \n  \n  \n',
        ignore_whitespace: true
      })
      const last = changes[changes.length - 1]
      expect(last.added).toBe(true)
      expect(last.count).toBe(3)
    })

    it('should still report removed whitespace-only lines at the end', () => {
      const changes = diff_lines({
        old_str: 'foo\nbar\n\n',
        new_str: 'foo\nbar\n',
        ignore_whitespace: true
      })
      expect(changes[changes.length - 1].removed).toBe(true)
    })
  })
})
