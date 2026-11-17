import { Ignore } from './ignore'

const make = (...patterns: string[]) => new Ignore().add(patterns)

describe('Ignore', () => {
  it('should ignore nothing without rules', () => {
    expect(new Ignore().ignores('a/b.js')).toBe(false)
  })

  it('should return false for an empty path', () => {
    expect(make('*').ignores('')).toBe(false)
  })

  it('should skip blank lines and comments, and support escaped hash', () => {
    const ig = make('# comment', '', '   ', '\\#hash')
    expect(ig.ignores('# comment')).toBe(false)
    expect(ig.ignores('#hash')).toBe(true)
  })

  it('should split multi-line strings', () => {
    const ig = new Ignore().add('a\r\nb\n#c\n')
    expect(ig.ignores('a')).toBe(true)
    expect(ig.ignores('b')).toBe(true)
    expect(ig.ignores('#c')).toBe(false)
  })

  it('should match a basename pattern at any depth and below', () => {
    const ig = make('foo')
    expect(ig.ignores('foo')).toBe(true)
    expect(ig.ignores('a/foo')).toBe(true)
    expect(ig.ignores('a/b/foo')).toBe(true)
    expect(ig.ignores('foo/bar')).toBe(true)
    expect(ig.ignores('foobar')).toBe(false)
  })

  it('should not let wildcards cross a slash', () => {
    expect(make('*.log').ignores('x/y.log')).toBe(true)
    expect(make('*.log').ignores('a.txt')).toBe(false)
    expect(make('a*c').ignores('a/c')).toBe(false)
    expect(make('a*c').ignores('abc')).toBe(true)
  })

  it('should support question marks', () => {
    const ig = make('foo?bar')
    expect(ig.ignores('fooxbar')).toBe(true)
    expect(ig.ignores('foo/bar')).toBe(false)
    expect(ig.ignores('fooxxbar')).toBe(false)
  })

  it('should anchor patterns with a leading or middle slash', () => {
    expect(make('/a.js').ignores('a.js')).toBe(true)
    expect(make('/a.js').ignores('b/a.js')).toBe(false)
    expect(make('doc/frotz').ignores('doc/frotz')).toBe(true)
    expect(make('doc/frotz').ignores('a/doc/frotz')).toBe(false)
  })

  it('should match only directories for a trailing slash', () => {
    const ig = make('build/')
    expect(ig.ignores('build')).toBe(false)
    expect(ig.ignores('build/')).toBe(true)
    expect(ig.ignores('build/x.js')).toBe(true)
    expect(ig.ignores('src/build/')).toBe(true)
  })

  it('should re-include with negation', () => {
    const ig = make('*.js', '!keep.js')
    expect(ig.ignores('keep.js')).toBe(false)
    expect(ig.ignores('other.js')).toBe(true)
  })

  it('should let the last matching rule win', () => {
    expect(make('a', '!a', 'a').ignores('a')).toBe(true)
  })

  it('should not re-include a file inside an ignored directory', () => {
    const ig = make('/abc/', '!/abc/a.js')
    expect(ig.ignores('abc/a.js')).toBe(true)
  })

  it('should re-include a file when only its contents are ignored', () => {
    const ig = make('foo/*', '!foo/bar.js')
    expect(ig.ignores('foo/bar.js')).toBe(false)
    expect(ig.ignores('foo/baz.js')).toBe(true)
    expect(ig.ignores('foo/bar/x')).toBe(true)
  })

  it('should support a leading globstar', () => {
    const ig = make('**/foo')
    expect(ig.ignores('foo')).toBe(true)
    expect(ig.ignores('a/b/foo')).toBe(true)
    expect(ig.ignores('a/b/foo/c')).toBe(true)
  })

  it('should support a trailing globstar without matching the folder', () => {
    const ig = make('abc/**')
    expect(ig.ignores('abc')).toBe(false)
    expect(ig.ignores('abc/a')).toBe(true)
    expect(ig.ignores('abc/d/e')).toBe(true)
  })

  it('should support a middle globstar', () => {
    const ig = make('a/**/b')
    expect(ig.ignores('a/b')).toBe(true)
    expect(ig.ignores('a/x/b')).toBe(true)
    expect(ig.ignores('a/x/y/b')).toBe(true)
    expect(ig.ignores('a/x/c')).toBe(false)
    expect(ig.ignores('b/a/b')).toBe(false)
  })

  it('should support bracket expressions', () => {
    expect(make('*.[oa]').ignores('x.o')).toBe(true)
    expect(make('*.[oa]').ignores('x.c')).toBe(false)
    expect(make('file[0-9]').ignores('file5')).toBe(true)
    expect(make('file[0-9]').ignores('filea')).toBe(false)
    expect(make('[!a].txt').ignores('a.txt')).toBe(false)
    expect(make('[!a].txt').ignores('b.txt')).toBe(true)
    expect(make('a[/]b').ignores('a/b')).toBe(false)
  })

  it('should match nothing for an unterminated bracket expression', () => {
    const ig = make('*.[a-')
    expect(ig.ignores('a.a')).toBe(false)
    expect(ig.ignores('a.-')).toBe(false)
  })

  it('should treat an escaped star as a literal', () => {
    const ig = make('a\\*')
    expect(ig.ignores('a*')).toBe(true)
    expect(ig.ignores('ab')).toBe(false)
  })

  it('should trim unescaped trailing spaces only', () => {
    expect(make('abc  ').ignores('abc')).toBe(true)
    const ig = make('abc\\ ')
    expect(ig.ignores('abc ')).toBe(true)
    expect(ig.ignores('abc')).toBe(false)
  })

  it('should ignore a trailing unpaired backslash', () => {
    expect(make('test\\').ignores('test')).toBe(false)
  })

  it('should be case-insensitive by default and configurable', () => {
    expect(make('README').ignores('readme')).toBe(true)

    const strict = new Ignore({ ignore_case: false }).add('README')
    expect(strict.ignores('readme')).toBe(false)
    expect(strict.ignores('README')).toBe(true)
  })

  it('should invalidate its cache when rules are added', () => {
    const ig = new Ignore().add('a')
    expect(ig.ignores('a')).toBe(true)
    ig.add('!a')
    expect(ig.ignores('a')).toBe(false)
  })
})
