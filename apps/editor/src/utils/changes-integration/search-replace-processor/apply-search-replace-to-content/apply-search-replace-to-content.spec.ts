import * as fs from 'fs'
import * as path from 'path'
import { apply_search_replace_to_content } from './apply-search-replace-to-content'
import { parse_search_replace_segments } from '../parse-search-replace-segments'

describe('search-replace-parser', () => {
  const load_test_case_file = (test_case: string, filename: string): string => {
    return fs.readFileSync(
      path.join(__dirname, 'test-cases', test_case, filename),
      'utf-8'
    )
  }

  const run_test_case = (test_case: string) => {
    const original_content = load_test_case_file(test_case, 'original.txt')
    const markers_content = load_test_case_file(test_case, 'markers.txt')
    const expected_content = load_test_case_file(test_case, 'expected.txt')
    const segments = parse_search_replace_segments(markers_content)

    const result = apply_search_replace_to_content({
      original_content,
      segments
    })

    expect(result).toBe(expected_content)
  }

  describe('apply_search_replace_to_content', () => {
    it('applies a basic search replace block correctly', () => {
      run_test_case('basic-conflict')
    })

    it('applies multiple search replace blocks in a single file', () => {
      run_test_case('multiple-conflicts')
    })

    it('handles deletions via empty updated blocks', () => {
      run_test_case('deletion')
    })

    it('throws an error when context cannot be found', () => {
      const original_content = 'Some random text'
      const markers_content = '<<<<<<<\nMissing\n=======\nFound\n>>>>>>>'
      const segments = parse_search_replace_segments(markers_content)

      expect(() =>
        apply_search_replace_to_content({
          original_content,
          segments
        })
      ).toThrow(/Could not find content to replace/)
    })

    it('handles whitespace issues in search replace blocks', () => {
      run_test_case('whitespace-issues')
    })

    it('handles trailing whitespace correctly without deleting it', () => {
      run_test_case('trailing-whitespace')
    })

    it('handles rst syntax correctly', () => {
      run_test_case('rst-syntax')
    })

    it('keeps the original blank lines when the search block has extra or missing ones', () => {
      run_test_case('extra-blank-lines-in-search')
    })

    it('applies several blocks to similar code with repeated lines', () => {
      run_test_case('similar-code-multiple-blocks')
    })

    it('inserts a line between preceding context and a matched line', () => {
      run_test_case('insert-after-context')
    })

    it('inserts lines before following context when the search block is empty', () => {
      run_test_case('insert-before-context')
    })

    it('deletes the first line without leaving a stray newline', () => {
      run_test_case('delete-first-line')
    })

    it('does not prepend a newline when the first kept line moves without context', () => {
      run_test_case('reorder-without-context')
    })

    it('applies search replace blocks that appear out of file order', () => {
      run_test_case('out-of-order-blocks')
    })

    it('skips no-op blocks without failing on unmatched ones', () => {
      run_test_case('noop-blocks')
    })

    it('prepends content at the start of the file when the search block is empty', () => {
      run_test_case('prepend-empty-search')
    })

    it('adds a blank line between existing lines', () => {
      run_test_case('add-blank-line')
    })

    it('removes a blank line between existing lines', () => {
      run_test_case('remove-blank-line')
    })

    it('preserves blank lines at the boundaries of a search replace block', () => {
      run_test_case('preserve-boundary-blank-lines')
    })

    it('expands a line into multiple lines before a blank line', () => {
      run_test_case('expand-line-before-blank-line')
    })

    it('handles seven-character equals underlines inside search and replace blocks', () => {
      run_test_case('seven-char-equals-underline')
    })

    it('matches the intended occurrence when out-of-order blocks follow a duplicate snippet', () => {
      run_test_case('out-of-order-with-duplicate-snippet')
    })

    it('adds and removes trailing blank lines at the end of a search replace block', () => {
      run_test_case('trailing-blank-lines-diff')
    })

    it('handles multiple seven-character equals underlines inside a single search block', () => {
      run_test_case('multiple-seven-char-equals-underlines')
    })

    it('prefers an exact match over an earlier loose-whitespace match', () => {
      run_test_case('strict-match-precedence')
    })

    it('adjusts the cursor properly when an out-of-order block shrinks earlier content', () => {
      run_test_case('out-of-order-shrinking-block')
    })

    it('applies back-to-back blocks targeting identical duplicate snippets in order', () => {
      run_test_case('adjacent-blocks-and-duplicate-snippets')
    })

    it('ignores invisible formatting characters and normalizes list markers in loose mode', () => {
      run_test_case('invisible-chars-and-list-markers')
    })
  })
})
