import { PROVIDERS } from '@/constants/providers'

export const strip_trailing_slashes = (base_url: string): string =>
  base_url.trim().replace(/\/+$/, '')

const is_same_base_url = (a: string, b: string): boolean =>
  strip_trailing_slashes(a).toLowerCase() ===
  strip_trailing_slashes(b).toLowerCase()

export const is_anthropic_base_url = (base_url: string): boolean =>
  is_same_base_url(base_url, PROVIDERS.Anthropic.base_url)

export const is_openai_base_url = (base_url: string): boolean =>
  is_same_base_url(base_url, PROVIDERS.OpenAI.base_url)

export const is_google_base_url = (base_url: string): boolean =>
  is_same_base_url(base_url, PROVIDERS.Google.base_url)
