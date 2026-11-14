import axios from 'axios'
import { parseHTML } from 'linkedom'
import * as dns from 'dns'
import * as http from 'http'
import * as https from 'https'
import { Readability, isProbablyReaderable } from '@mozilla/readability'
import TurndownService from 'turndown'

const remove_markdown_images = (text: string) => {
  const without_images = text.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '')
  return without_images.replace(/\n{3,}/g, '\n\n')
}

const create_turndown_service = () => {
  const turndown_service = new TurndownService({
    codeBlockStyle: 'fenced'
  })
  turndown_service.addRule('fencedCodeBlock', {
    filter: (node: any, options: any) => {
      return (
        options.codeBlockStyle === 'fenced' &&
        node.nodeName === 'PRE' &&
        node.querySelector('code')
      )
    },
    replacement: (_: any, node: any, options: any) => {
      const element = node as HTMLElement
      const language = (element
        .querySelector('code')
        ?.className.match(/language-(\S+)/) || [null, ''])[1]

      return (
        '\n\n' +
        options.fence +
        language +
        '\n' +
        element.textContent +
        '\n' +
        options.fence +
        '\n\n'
      )
    }
  })
  turndown_service.addRule('multiplemath', {
    filter(node) {
      return (
        node.nodeName === 'SPAN' &&
        (node as HTMLElement).classList.contains('katex-display')
      )
    },
    replacement(_, node) {
      const annotation = (node as HTMLElement).querySelector(
        'annotation'
      )?.textContent
      if (!annotation) return ''
      return `$$\n${annotation}\n$$`
    }
  })
  turndown_service.addRule('multiplemath', {
    filter(node) {
      return (
        node.nodeName === 'SPAN' &&
        (node as HTMLElement).classList.contains('katex')
      )
    },
    replacement(_, node) {
      const is_block =
        node.parentNode?.nodeName === 'P' &&
        node.parentNode.childNodes.length === 1
      const annotation = (node as HTMLElement).querySelector(
        'annotation'
      )?.textContent
      if (!annotation) return ''
      return is_block ? `$$ ${annotation} $$` : `$${annotation}$`
    }
  })
  turndown_service.addRule('stripElements', {
    filter: ['figure', 'picture', 'sup'],
    replacement: () => ''
  })
  turndown_service.addRule('removeLinks', {
    filter: 'a',
    replacement: (content) => content
  })
  return turndown_service
}

const is_private_ip = (ip: string): boolean => {
  let normalized_ip = ip.toLowerCase()
  if (normalized_ip.startsWith('::ffff:')) {
    normalized_ip = normalized_ip.replace(/^::ffff:/, '')
  }

  if (/^127\./.test(normalized_ip)) return true
  if (/^10\./.test(normalized_ip)) return true
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(normalized_ip)) return true
  if (/^192\.168\./.test(normalized_ip)) return true
  if (/^169\.254\./.test(normalized_ip)) return true
  if (/^0\./.test(normalized_ip)) return true
  if (/^255\.255\.255\.255$/.test(normalized_ip)) return true
  if (normalized_ip === '::1' || normalized_ip === '::') return true
  if (/^fe80:/.test(normalized_ip)) return true
  if (
    /^fc[0-9a-f]{2}:/.test(normalized_ip) ||
    /^fd[0-9a-f]{2}:/.test(normalized_ip)
  )
    return true
  return false
}

const custom_lookup = (
  hostname: string,
  options:
    | dns.LookupOneOptions
    | ((
        err: NodeJS.ErrnoException | null,
        address: string,
        family: number
      ) => void),
  callback?: (
    err: NodeJS.ErrnoException | null,
    address: string,
    family: number
  ) => void
) => {
  const cb = (typeof options === 'function' ? options : callback) as (
    err: NodeJS.ErrnoException | null,
    address: string,
    family: number
  ) => void
  const opts = typeof options === 'function' ? {} : options

  dns.lookup(hostname, opts, (err, address, family) => {
    if (err) return cb(err, address, family)

    if (typeof address === 'string' && is_private_ip(address)) {
      return cb(
        new Error(`SSRF blocked: private IP address ${address}`),
        address,
        family
      )
    }

    if (Array.isArray(address)) {
      for (const record of address) {
        if (
          typeof record.address === 'string' &&
          is_private_ip(record.address)
        ) {
          return cb(
            new Error(`SSRF blocked: private IP address ${record.address}`),
            address as any,
            family
          )
        }
      }
    }

    cb(null, address as any, family)
  })
}

const http_agent = new http.Agent({ lookup: custom_lookup as any })
const https_agent = new https.Agent({ lookup: custom_lookup as any })

export const fetch_website = async (
  url: string,
  abort_signal?: AbortSignal
): Promise<{ content: string; title: string } | null> => {
  try {
    const parsed_url = new URL(url)
    if (parsed_url.protocol !== 'http:' && parsed_url.protocol !== 'https:') {
      return null
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
      },
      timeout: 5000,
      signal: abort_signal,
      httpAgent: http_agent,
      httpsAgent: https_agent
    })

    if (response.status === 200) {
      const content_type = (
        (response.headers as any)['content-type'] || ''
      ).toLowerCase()

      if (
        content_type.includes('application/json') ||
        typeof response.data === 'object'
      ) {
        const content =
          typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data, null, 2)
        return { content, title: '' }
      }

      if (typeof response.data === 'string') {
        const is_html =
          content_type.includes('text/html') ||
          response.data.trim().toLowerCase().startsWith('<!doctype html') ||
          response.data.trim().toLowerCase().startsWith('<html')

        if (!is_html) {
          const is_text =
            content_type.includes('text/') ||
            content_type.includes('json') ||
            content_type.includes('xml') ||
            content_type.includes('javascript') ||
            content_type.includes('yaml') ||
            content_type.includes('csv') ||
            content_type === ''

          if (is_text) {
            return { content: response.data, title: '' }
          }
          return null
        }

        const html = response.data
        const { document: doc } = parseHTML(html)
        try {
          Object.defineProperty(doc, 'documentURI', { value: url })
        } catch {
          // Ignore
        }

        doc.querySelectorAll('pre').forEach((pre) => {
          const code = pre.querySelector('code')
          const language = (code?.className.match(/language-(\S+)/) ||
            pre.className.match(/language-(\S+)/) || [null, ''])[1]

          let text = ''
          const lines = pre.querySelectorAll('.line')
          if (lines.length > 0) {
            text = Array.from(lines)
              .map((l) => l.textContent)
              .join('\n')
          } else {
            text = pre.textContent || ''
          }

          pre.innerHTML = ''
          const new_code = doc.createElement('code')
          if (language) {
            new_code.className = `language-${language}`
          }
          new_code.textContent = text
          pre.appendChild(new_code)

          let current: Element = pre
          while (
            current.parentElement &&
            current.parentElement.tagName === 'DIV' &&
            current.parentElement.textContent?.trim() ===
              pre.textContent?.trim()
          ) {
            current = current.parentElement
          }
          if (current !== pre && current.parentElement) {
            current.parentElement.insertBefore(pre, current)
            current.remove()
          }
        })

        if (isProbablyReaderable(doc as any)) {
          const reader = new Readability(doc as any, { keepClasses: true })
          const article = reader.parse()

          if (article && article.content) {
            const turndown_service = create_turndown_service()
            const { document: article_doc } = parseHTML(
              `<!DOCTYPE html><html><body>${article.content}</body></html>`
            )
            let content = turndown_service.turndown(
              (article_doc.body || article_doc.documentElement) as any
            )
            content = remove_markdown_images(content)

            if (content && content.trim().length > 0) {
              return { content, title: article.title || doc.title || '' }
            }
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}
