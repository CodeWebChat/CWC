import { Item } from './Item'

export default {
  component: Item,
  decorators: [
    (Story: any) => (
      <div
        style={{
          maxWidth: '600px',
          padding: '1rem',
          backgroundColor: 'var(--vscode-sideBar-background)',
          color: 'var(--vscode-foreground)'
        }}
      >
        <Story />
      </div>
    )
  ]
}

export const Default = {
  args: {
    title: 'Provider',
    description: 'Select the provider to use for this configuration.'
  }
}

export const WithChildren = {
  args: {
    title: 'API Key',
    description:
      'Enter your API key for the selected provider. It will be stored securely.',
    children: <div>Input goes here</div>
  }
}

export const Toggleable = {
  args: {
    title: 'Advanced Settings',
    description: 'Toggle to see more advanced options.',
    is_toggleable: true,
    translations: {
      expand: 'Expand',
      collapse: 'Collapse'
    },
    children: <div>Advanced content goes here</div>
  }
}
