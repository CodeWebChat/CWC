export const is_newer = (latest: string, current: string) => {
  const l = latest.split('.').map(Number)
  const c = current.split('.').map(Number)
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const l_val = l[i] || 0
    const c_val = c[i] || 0
    if (l_val > c_val) return true
    if (l_val < c_val) return false
  }
  return false
}
