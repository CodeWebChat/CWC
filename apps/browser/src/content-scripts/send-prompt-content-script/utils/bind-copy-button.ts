import { show_response_ready_notification } from './show-response-ready-notification'
import { session_state } from './session-state'
import { Message } from '@/types/messages'

const bound_elements = new WeakSet<Element>()

const trigger_apply = (params: {
  client_id: string
  raw_instructions?: string
}) => {
  let client_id = params.client_id
  let raw_instructions = params.raw_instructions
  let web_configuration_details = undefined

  try {
    if (session_state) {
      if (session_state.client_id !== undefined) {
        client_id = session_state.client_id
        raw_instructions = session_state.raw_instructions
        web_configuration_details = session_state.web_configuration_details
      }
    }
  } catch (error) {
    console.error('Error reading CWC session data', error)
  }

  chrome.runtime
    .sendMessage<Message>({
      action: 'apply-response',
      client_id,
      raw_instructions,
      web_configuration_details
    })
    .catch((e) => console.debug('Failed to send apply-response message', e))
}

export const wait_for_copy_and_apply = (params: {
  client_id: string
  raw_instructions?: string
}) => {
  let triggered = false

  const finish = () => {
    if (triggered) return
    triggered = true
    observer.disconnect()

    setTimeout(() => {
      trigger_apply(params)
    }, 500)
  }

  const observer = new MutationObserver(() => {
    finish()
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true
  })
}

export const bind_copy_button = (params: {
  client_id: string
  raw_instructions?: string
  footer: Element
  get_copy_button: (footer: Element) => HTMLElement | null | undefined
}) => {
  const copy_button = params.get_copy_button(params.footer)

  if (!copy_button) return

  if (bound_elements.has(copy_button)) return
  bound_elements.add(copy_button)

  copy_button.addEventListener('click', () => {
    wait_for_copy_and_apply(params)
  })

  copy_button.focus({ preventScroll: true, focusVisible: true })
  copy_button.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  })
}

let active_observer: MutationObserver | null = null

export const observe_for_responses = (params: {
  chatbot_name: string
  is_generating: () => boolean
  footer_selector: string
  bind_buttons?: (footer: Element) => void
}) => {
  if (active_observer) {
    active_observer.disconnect()
  }

  let has_sent_finished_responding = true

  const observer = new MutationObserver(() => {
    if (params.is_generating()) {
      has_sent_finished_responding = false
      return
    }

    if (!has_sent_finished_responding) {
      chrome.runtime
        .sendMessage<Message>({
          action: 'finished-responding'
        })
        .catch((e) =>
          console.debug('Failed to send finished-responding message', e)
        )
      has_sent_finished_responding = true
      show_response_ready_notification({ chatbot_name: params.chatbot_name })
    }

    if (!params.bind_buttons) {
      return
    }

    const all_footers = document.querySelectorAll(params.footer_selector)
    if (all_footers.length === 0) {
      return
    }

    all_footers.forEach((footer) => {
      params.bind_buttons!(footer)
    })
  })

  active_observer = observer

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  })
}
