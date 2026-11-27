import {
  is_anthropic_base_url,
  is_openai_base_url
} from '@/utils/provider-base-url'
import { Provider } from '@/services/providers-manager'

export const build_user_content = (params: {
  provider: Provider
  part1: string
  part2: string
  disable_cache?: boolean
}): any => {
  const is_anthropic = is_anthropic_base_url(params.provider.base_url)
  const is_openai = is_openai_base_url(params.provider.base_url)

  const parse_text_with_images = (text: string) => {
    if (!text.includes('<cwc-image>')) {
      return [{ type: 'text', text }]
    }
    const parsed: any[] = []
    const parts = text.split(/<cwc-image>([\s\S]*?)<\/cwc-image>/)
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i % 2 === 0) {
        if (part.length > 0) {
          parsed.push({ type: 'text', text: part.trim() })
        }
      } else {
        parsed.push(
          is_anthropic
            ? {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: part
                }
              }
            : {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${part}`
                }
              }
        )
      }
    }
    return parsed
  }

  if (is_anthropic || is_openai) {
    const cache_config: any = {}

    if (!params.disable_cache) {
      if (is_anthropic) {
        cache_config.cache_control = { type: 'ephemeral' }
        if (params.provider.extended_cache) {
          cache_config.cache_control.ttl = '1h'
        }
      } else if (is_openai) {
        cache_config.prompt_cache_breakpoint = { mode: 'explicit' }
        if (params.provider.extended_cache) {
          cache_config.prompt_cache_breakpoint.ttl = '12h'
        }
      }
    }

    const user_content: any[] = []

    if (params.part1.trim()) {
      const part1_blocks = parse_text_with_images(params.part1).filter(
        (part) => part.type !== 'text' || part.text.trim()
      )
      if (part1_blocks.length > 0) {
        const last_index = part1_blocks.length - 1
        part1_blocks[last_index] = {
          ...part1_blocks[last_index],
          ...cache_config
        }
        user_content.push(...part1_blocks)
      }
    }

    if (!params.part2.includes('<cwc-image>')) {
      if (params.part2.trim()) {
        user_content.push({ type: 'text', text: params.part2 })
      }
    } else {
      user_content.push(
        ...parse_text_with_images(params.part2).filter(
          (part) => part.type !== 'text' || part.text.trim()
        )
      )
    }

    return user_content
  } else {
    const content = params.part1 + params.part2
    if (content.includes('<cwc-image>')) {
      return parse_text_with_images(content)
    }
    return content
  }
}
