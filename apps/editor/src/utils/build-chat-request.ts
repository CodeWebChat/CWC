import {
  is_anthropic_base_url,
  is_openai_base_url,
  strip_trailing_slashes
} from '@/utils/provider-base-url'

export { is_anthropic_base_url, is_openai_base_url }

const ANTHROPIC_MAX_TOKENS = 64000

export type ChatApiFormat =
  | 'chat-completions'
  | 'anthropic-messages'
  | 'openai-responses'

const get_text_from_content = (content: any): string => {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n\n')
  }
  return ''
}

const has_audio_input = (messages: any[]): boolean =>
  messages.some(
    (message) =>
      Array.isArray(message?.content) &&
      message.content.some((part: any) => part?.type === 'input_audio')
  )

const to_responses_content = (content: any): any => {
  if (!Array.isArray(content)) return content
  return content.map((part) => {
    if (part?.type === 'text') {
      return { ...part, type: 'input_text' }
    }
    if (part?.type === 'image_url') {
      const { image_url, ...rest } = part
      return {
        ...rest,
        type: 'input_image',
        image_url: typeof image_url === 'string' ? image_url : image_url?.url
      }
    }
    return part
  })
}

const build_openai_responses_request = (params: {
  base_url: string
  body: { [key: string]: any }
}): { url: string; body: { [key: string]: any }; format: ChatApiFormat } => {
  const { messages = [], ...rest } = params.body
  const instructions_parts: string[] = []
  const input: any[] = []

  for (const message of messages) {
    if (message.role === 'system') {
      const text = get_text_from_content(message.content)
      if (text) instructions_parts.push(text)
    } else {
      input.push({
        role: message.role,
        content: to_responses_content(message.content)
      })
    }
  }

  return {
    url: `${strip_trailing_slashes(params.base_url)}/responses`,
    body: {
      store: false,
      ...rest,
      ...(instructions_parts.length > 0
        ? { instructions: instructions_parts.join('\n\n') }
        : {}),
      input
    },
    format: 'openai-responses'
  }
}

export const build_chat_request = (params: {
  base_url: string
  body: { [key: string]: any }
}): { url: string; body: { [key: string]: any }; format: ChatApiFormat } => {
  const base_url = strip_trailing_slashes(params.base_url)

  if (is_openai_base_url(base_url)) {
    if (!has_audio_input(params.body.messages ?? [])) {
      return build_openai_responses_request(params)
    }

    const { reasoning, ...rest } = params.body
    return {
      url: `${base_url}/chat/completions`,
      body: reasoning?.effort
        ? { ...rest, reasoning_effort: reasoning.effort }
        : rest,
      format: 'chat-completions'
    }
  }

  if (!is_anthropic_base_url(base_url)) {
    return {
      url: `${base_url}/chat/completions`,
      body: params.body,
      format: 'chat-completions'
    }
  }

  const { messages = [], ...rest } = params.body
  const system_parts: string[] = []
  const native_messages: any[] = []

  for (const message of messages) {
    if (message.role === 'system') {
      const text = get_text_from_content(message.content)
      if (text) system_parts.push(text)
    } else {
      native_messages.push(message)
    }
  }

  return {
    url: `${base_url}/messages`,
    body: {
      max_tokens: ANTHROPIC_MAX_TOKENS,
      ...rest,
      ...(system_parts.length > 0 ? { system: system_parts.join('\n\n') } : {}),
      messages: native_messages
    },
    format: 'anthropic-messages'
  }
}
