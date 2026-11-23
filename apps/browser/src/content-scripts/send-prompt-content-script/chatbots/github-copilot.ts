import { Chatbot } from '../types/chatbot'
import {
  bind_copy_button,
  observe_for_responses
} from '../utils/bind-copy-button'
import { report_initialization_error } from '../utils/report-initialization-error'

export const github_copilot: Chatbot = {
  wait_until_ready: async () => {
    await new Promise((resolve) => {
      const check_for_element = () => {
        if (document.querySelector('form button[aria-haspopup="true"]')) {
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
        function_name: 'enter_message',
        log_message: 'Message input textarea not found for GitHub Copilot'
      })
      return
    }
    input_element.value = params.message
    input_element.dispatchEvent(new Event('input', { bubbles: true }))
    input_element.focus()
  },
  setup_observer: (params) => {
    const bind_buttons = (footer: Element) => {
      bind_copy_button({
        client_id: params.client_id,
        raw_instructions: params.raw_instructions,
        footer,
        get_copy_button: (f) => {
          const copy_button = f.querySelector(
            'button:nth-of-type(3)'
          ) as HTMLElement
          if (!copy_button) {
            report_initialization_error({
              function_name: 'github_copilot.get_copy_button',
              log_message: 'Copy button not found'
            })
            return null
          }
          return copy_button
        }
      })
    }

    observe_for_responses({
      chatbot_name: 'GitHub Copilot',
      is_generating: () =>
        !!document.querySelector(
          'path[d="M5.75 4h4.5c.966 0 1.75.784 1.75 1.75v4.5A1.75 1.75 0 0 1 10.25 12h-4.5A1.75 1.75 0 0 1 4 10.25v-4.5C4 4.784 4.784 4 5.75 4Z"]'
        ),
      footer_selector: 'div[data-testid="nonshared-toolbar"]',
      bind_buttons: params.bind_copy ? bind_buttons : undefined
    })
  }
}
