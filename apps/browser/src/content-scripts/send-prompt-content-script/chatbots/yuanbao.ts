import { Chatbot } from '../types/chatbot'
import {
  bind_copy_button,
  observe_for_responses
} from '../utils/bind-copy-button'
import { report_initialization_error } from '../utils/report-initialization-error'

export const yuanbao: Chatbot = {
  wait_until_ready: async () => {
    await new Promise((resolve) => {
      const check_for_element = () => {
        if (document.querySelector('div[contenteditable="true"]')) {
          resolve(null)
        } else {
          setTimeout(check_for_element, 100)
        }
      }
      check_for_element()
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
  },
  enter_message: async (params) => {
    const input_element = document.querySelector(
      'div[contenteditable="true"]'
    ) as HTMLElement
    if (!input_element) {
      report_initialization_error({
        function_name: 'yuanbao.enter_message',
        log_message: 'Message input not found'
      })
      return
    }

    input_element.textContent = params.message
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
            'div[class*="ToolbarCopy_"]'
          ) as HTMLElement
          if (!copy_button) {
            report_initialization_error({
              function_name: 'yuanbao.get_copy_button',
              log_message: 'Copy button not found'
            })
            return null
          }
          return copy_button
        }
      })
    }

    observe_for_responses({
      chatbot_name: 'Yuanbao',
      is_generating: () => !!document.querySelector('rect[x="7.71448"]'),
      footer_selector: '.agent-chat__toolbar__right',
      bind_buttons: params.bind_copy ? bind_buttons : undefined
    })
  }
}
