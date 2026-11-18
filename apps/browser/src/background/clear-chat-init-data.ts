export const clear_chat_init_data = async () => {
  try {
    const items = await chrome.storage.local.get()
    const chat_init_keys = Object.keys(items).filter((key) =>
      key.startsWith('chat-init:')
    )
    if (chat_init_keys.length > 0) {
      await chrome.storage.local.remove(chat_init_keys)
    }
  } catch (error) {
    console.error('Error clearing chat init data:', error)
  }
}
