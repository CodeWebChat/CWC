import path from 'path'
import type { StorybookConfig } from '@storybook/react-vite'
import type svgrPlugin from 'vite-plugin-svgr'

process.env.VITE_CJS_IGNORE_WARNING = 'true'

const config: StorybookConfig = {
  stories: ['../../../packages/ui/src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  core: {
    disableTelemetry: true
  },
  viteFinal: async (config) => {
    const svgrModule = await import('vite-plugin-svgr')
    const svgr = (
      typeof svgrModule.default === 'function'
        ? svgrModule.default
        : (svgrModule.default as unknown as { default: typeof svgrPlugin })
            .default
    ) as typeof svgrPlugin

    const ui_src = path.resolve(__dirname, '../../../packages/ui/src')
    const shared_src = path.resolve(__dirname, '../../../packages/shared/src')
    const foundation_path = path
      .resolve(ui_src, 'styles/foundation')
      .replace(/\\/g, '/')

    config.plugins = [...(config.plugins || []), svgr()]
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@ui': ui_src,
        '@shared': shared_src
      }
    }
    config.css = {
      ...config.css,
      preprocessorOptions: {
        ...config.css?.preprocessorOptions,
        scss: {
          ...config.css?.preprocessorOptions?.scss,
          silenceDeprecations: ['legacy-js-api'],
          additionalData: `@use "${foundation_path}" as *;`
        }
      }
    }

    return config
  }
}

export default config
