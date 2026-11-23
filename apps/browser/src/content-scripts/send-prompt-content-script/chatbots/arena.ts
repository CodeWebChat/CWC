import { Chatbot } from '../types/chatbot'
import {
  bind_copy_button,
  observe_for_responses
} from '../utils/bind-copy-button'
import { report_initialization_error } from '../utils/report-initialization-error'

export const arena: Chatbot = {
  wait_until_ready: async () => {
    await new Promise((resolve) => {
      const check_for_element = () => {
        if (document.querySelector('textarea[aria-hidden="true"]')) {
          resolve(null)
        } else {
          setTimeout(check_for_element, 100)
        }
      }
      check_for_element()
    })
  },
  enter_message: async (params) => {
    const input_element = document.querySelector(
      'textarea'
    ) as HTMLTextAreaElement
    if (!input_element) {
      report_initialization_error({
        function_name: 'arena.enter_message',
        log_message: 'Message input textarea not found'
      })
      return
    }
    input_element.value = params.message
    input_element.dispatchEvent(new Event('input', { bubbles: true }))
  },
  setup_observer: (params) => {
    const bind_buttons = (footer: Element) => {
      bind_copy_button({
        client_id: params.client_id,
        raw_instructions: params.raw_instructions,
        footer,
        get_copy_button: (f) => {
          const copy_button = f.querySelector(
            'button:has([d="M15 9V4.6C15 4.26863 14.7314 4 14.4 4H4.6C4.26863 4 4 4.26863 4 4.6V14.4C4 14.7314 4.26863 15 4.6 15H9"])'
          ) as HTMLElement
          if (!copy_button) {
            report_initialization_error({
              function_name: 'arena.get_copy_button',
              log_message: 'Copy button not found'
            })
            return null
          }
          return copy_button
        }
      })
    }

    observe_for_responses({
      chatbot_name: 'Arena',
      is_generating: () => !!document.querySelector('ol .animate-spin'),
      footer_selector:
        'ol .bg-surface-primary > div:last-child > div > div, [role="presentation"] > div',
      bind_buttons: params.bind_copy ? bind_buttons : undefined
    })
  }
}
