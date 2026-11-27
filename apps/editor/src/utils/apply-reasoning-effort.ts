import { ApiConfiguration, Provider } from '@/services/providers-manager'
import {
  is_anthropic_base_url,
  is_google_base_url,
  is_openai_base_url
} from '@/utils/provider-base-url'

export const apply_reasoning_effort = (params: {
  body: { [key: string]: any }
  provider: Provider
  reasoning_effort?: ApiConfiguration['reasoning_effort']
}) => {
  if (is_google_base_url(params.provider.base_url)) {
    if (params.reasoning_effort) {
      params.body.extra_body = {
        google: {
          thinking_config: {
            thinking_level: params.reasoning_effort,
            include_thoughts: true
          }
        }
      }
    }
  } else if (is_anthropic_base_url(params.provider.base_url)) {
    if (params.reasoning_effort === 'none') {
      params.body.thinking = { type: 'disabled' }
    } else if (params.reasoning_effort) {
      params.body.thinking = { type: 'adaptive', display: 'summarized' }
      params.body.output_config = { effort: params.reasoning_effort }
    }
  } else if (is_openai_base_url(params.provider.base_url)) {
    if (params.reasoning_effort) {
      params.body.reasoning =
        params.reasoning_effort === 'none'
          ? { effort: 'none' }
          : { effort: params.reasoning_effort, summary: 'auto' }
    }
  } else {
    if (params.reasoning_effort) {
      params.body.reasoning_effort = params.reasoning_effort
    }
  }
}
