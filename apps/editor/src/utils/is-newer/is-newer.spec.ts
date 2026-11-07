import { is_newer } from './is-newer'

describe('is_newer', () => {
  it('returns true when the first version is newer', () => {
    expect(is_newer('1.0.1', '1.0.0')).toBe(true)
    expect(is_newer('2.0.0', '1.9.9')).toBe(true)
    expect(is_newer('1.1.0', '1.0.9')).toBe(true)
  })

  it('returns false when the first version is older', () => {
    expect(is_newer('1.0.0', '1.0.1')).toBe(false)
    expect(is_newer('0.9.9', '1.0.0')).toBe(false)
  })

  it('returns false when versions are identical', () => {
    expect(is_newer('1.0.0', '1.0.0')).toBe(false)
  })

  it('handles versions of different segment lengths', () => {
    expect(is_newer('1.0', '1.0.0')).toBe(false)
    expect(is_newer('1.0.1', '1.0')).toBe(true)
    expect(is_newer('2', '1.9.9')).toBe(true)
  })
})
