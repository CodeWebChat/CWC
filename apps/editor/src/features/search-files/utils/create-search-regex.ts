export const create_search_regex = (
  search_term: string,
  options?: { is_phrase_search?: boolean }
): RegExp => {
  let actual_term = search_term
  let is_exact_match = false

  if (
    !options?.is_phrase_search &&
    actual_term.length >= 2 &&
    actual_term.startsWith('"') &&
    actual_term.endsWith('"')
  ) {
    is_exact_match = true
    actual_term = actual_term.slice(1, -1)
  }

  const escaped_term = actual_term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let pattern = escaped_term.replace(/\s+/g, '\\s+')

  if (is_exact_match) {
    pattern = `\\b${pattern}\\b`
  }

  const flags = is_exact_match ? 'm' : 'mi'
  return new RegExp(pattern, flags)
}
