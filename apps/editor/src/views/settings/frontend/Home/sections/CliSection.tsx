import { forwardRef } from 'react'
import { Section as UiSection } from '@ui/components/editor/settings-view/Section'
import { Group as UiGroup } from '@ui/components/editor/settings-view/Group/Group'
import { Item as UiItem } from '@ui/components/editor/settings-view/Item'
import { Notices as UiNotices } from '@ui/components/editor/settings-view/Notices'
import { SortableList } from '@ui/components/editor/settings-view/SortableList'
import { IconButton } from '@ui/components/editor/common/IconButton'
import { Dropdown as UiDropdown } from '@ui/components/editor/common/Dropdown'
import { Textarea as UiTextarea } from '@ui/components/editor/common/Textarea'
import { DefaultConfigurationSelector } from '@ui/components/editor/settings-view/DefaultConfigurationSelector'
import { CliConfiguration } from '@/types/cli-configuration'
import { use_translation } from '../../i18n/use-translation'
import { NavItem } from '../Home'

type Props = {
  cli_configurations: CliConfiguration[]
  set_cli_configurations: (configurations: CliConfiguration[]) => void
  agent_defaults: Record<string, string | null>
  on_set_default_cli_configuration: (
    cli_feature: string,
    name: string | null
  ) => void
  on_select_default_cli_configuration: (cli_feature: string) => void
  on_reorder_cli_configurations: (reordered: CliConfiguration[]) => void
  on_add_cli_configuration: (params?: {
    insertion_index?: number
    exact_insertion?: boolean
  }) => void
  on_edit_cli_configuration: (id: string) => void
  on_delete_cli_configuration: (name: string) => void
  on_toggle_pinned_cli_configuration: (config: CliConfiguration) => void
  agentic_search_instructions: string
  set_agentic_search_instructions: (instructions: string) => void
  on_agentic_search_instructions_blur: () => void
  default_agentic_search_instructions: string
  on_restore_agentic_search_instructions: () => void
  agentic_search_invocation_count: 1 | 2 | 3
  on_agentic_search_invocation_count_change: (count: 1 | 2 | 3) => void
  set_section_ref: (id: NavItem, el: HTMLDivElement | null) => void
}

export const CliSection = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { t } = use_translation()

  const selector_configurations = props.cli_configurations.map((config) => {
    const is_unnamed = /^\(\d+\)$/.test(config.name.trim())
    const display_name = is_unnamed
      ? config.agent
      : config.name.replace(/ \(\d+\)$/, '')

    const details: string[] = []
    if (!is_unnamed) {
      details.push(config.agent)
    }

    if (config.flags) {
      details.push(config.flags)
    }

    return {
      id: config.name,
      model: display_name,
      description: details.join(' · ')
    }
  })

  return (
    <UiSection ref={ref} title={t('cli.title')} subtitle={t('cli.subtitle')}>
      <div ref={(el) => props.set_section_ref('section:cli:group:agents', el)}>
        <UiGroup
          title={t('agents.configurations.title')}
          notice_slot={
            <UiNotices
              notices={[
                {
                  type: 'info',
                  message: t('cli.notice')
                }
              ]}
            />
          }
        >
          <SortableList
            items={props.cli_configurations.map((c) => ({
              ...c,
              id: c.name
            }))}
            on_reorder={(reordered) => {
              const restored = reordered.map(
                ({ id: _id, ...rest }) => rest as CliConfiguration
              )
              props.set_cli_configurations(restored)
              props.on_reorder_cli_configurations(restored)
            }}
            on_add={props.on_add_cli_configuration}
            translations={{
              add_title: t('actions.add-new'),
              item_text: t('agents.configurations.item'),
              items_text: t('agents.configurations.items'),
              items_text_many: t('agents.configurations.items-many')
            }}
            render_content={(config) => {
              const is_unnamed = /^\(\d+\)$/.test(config.name.trim())
              const display_name = is_unnamed
                ? config.agent
                : config.name.replace(/ \(\d+\)$/, '')

              const details: string[] = []
              if (!is_unnamed) {
                details.push(config.agent)
              }

              if (config.flags) {
                details.push(config.flags)
              }

              return (
                <>
                  <div
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    <span>{display_name}</span>
                    {details.length > 0 && (
                      <span
                        style={{
                          marginLeft: '0.5em',
                          opacity: 0.7,
                          fontSize: '0.9em'
                        }}
                      >
                        {details.join(' · ')}
                      </span>
                    )}
                  </div>
                </>
              )
            }}
            render_actions={(config, index) => (
              <>
                <IconButton
                  codicon_icon={config.is_pinned ? 'pinned' : 'pin'}
                  title={
                    config.is_pinned ? t('actions.unpin') : t('actions.pin')
                  }
                  on_click={(e) => {
                    e.stopPropagation()
                    props.on_toggle_pinned_cli_configuration(config)
                  }}
                />
                <IconButton
                  codicon_icon="insert"
                  title={t('actions.insert')}
                  on_click={() =>
                    props.on_add_cli_configuration({
                      insertion_index: index
                    })
                  }
                />
                <IconButton
                  codicon_icon="edit"
                  title={t('agents.configurations.action.edit')}
                  on_click={() => props.on_edit_cli_configuration(config.id)}
                />
                <IconButton
                  codicon_icon="trash"
                  title={t('agents.configurations.action.delete')}
                  on_click={(e) => {
                    e.stopPropagation()
                    props.on_delete_cli_configuration(config.id)
                  }}
                />
              </>
            )}
          />
        </UiGroup>
      </div>
      <div
        ref={(el) =>
          props.set_section_ref('section:cli:group:agentic-search', el)
        }
      >
        <UiGroup title={t('cli.agentic-search.title')}>
          <UiItem
            title={t('common.instructions')}
            description={t('cli.agentic-search.instructions.description')}
            is_toggleable
            translations={{
              expand: t('common.expand'),
              collapse: t('common.collapse')
            }}
          >
            <UiTextarea
              value={props.agentic_search_instructions}
              min_rows={3}
              on_change={props.set_agentic_search_instructions}
              on_blur={props.on_agentic_search_instructions_blur}
              action_icon={
                props.agentic_search_instructions !=
                props.default_agentic_search_instructions
                  ? 'discard'
                  : undefined
              }
              action_title={t('general.action.restore-default')}
              on_action_click={props.on_restore_agentic_search_instructions}
            />
          </UiItem>
          <UiItem
            title={t('cli.agentic-search.invocation-count.title')}
            description={t('cli.agentic-search.invocation-count.description')}
            slot_right={
              <UiDropdown
                options={[
                  { value: '1', label: '1' },
                  { value: '2', label: '2' },
                  { value: '3', label: '3' }
                ]}
                value={props.agentic_search_invocation_count.toString()}
                onChange={(val) =>
                  props.on_agentic_search_invocation_count_change(
                    parseInt(val, 10) as 1 | 2 | 3
                  )
                }
              />
            }
          />
        </UiGroup>
      </div>
      <div
        ref={(el) =>
          props.set_section_ref('section:cli:group:agent-defaults', el)
        }
      >
        <UiGroup
          title={t('common.defaults')}
          is_disabled={props.cli_configurations.length === 0}
        >
          <DefaultConfigurationSelector
            title={t('common.agentic-search')}
            value={props.agent_defaults['agentic-search'] || null}
            configurations={selector_configurations}
            on_unset={() =>
              props.on_set_default_cli_configuration('agentic-search', null)
            }
            on_select={() =>
              props.on_select_default_cli_configuration('agentic-search')
            }
            translations={{
              select: t('agents.configurations.action.select-default'),
              unset: t('common.unset-default')
            }}
          />
          <DefaultConfigurationSelector
            title={t('common.code-at-cursor')}
            value={props.agent_defaults['code-at-cursor'] || null}
            configurations={selector_configurations}
            on_unset={() =>
              props.on_set_default_cli_configuration('code-at-cursor', null)
            }
            on_select={() =>
              props.on_select_default_cli_configuration('code-at-cursor')
            }
            translations={{
              select: t('agents.configurations.action.select-default'),
              unset: t('common.unset-default')
            }}
          />
          <DefaultConfigurationSelector
            title={t('common.commit-message')}
            value={props.agent_defaults['commit-message'] || null}
            configurations={selector_configurations}
            on_unset={() =>
              props.on_set_default_cli_configuration('commit-message', null)
            }
            on_select={() =>
              props.on_select_default_cli_configuration('commit-message')
            }
            translations={{
              select: t('agents.configurations.action.select-default'),
              unset: t('common.unset-default')
            }}
          />
          <DefaultConfigurationSelector
            title={t('common.intelligent-search')}
            value={props.agent_defaults['intelligent-search'] || null}
            configurations={selector_configurations}
            on_unset={() =>
              props.on_set_default_cli_configuration('intelligent-search', null)
            }
            on_select={() =>
              props.on_select_default_cli_configuration('intelligent-search')
            }
            translations={{
              select: t('agents.configurations.action.select-default'),
              unset: t('common.unset-default')
            }}
          />
          <DefaultConfigurationSelector
            title={t('common.patch-repair')}
            value={props.agent_defaults['patch-repair'] || null}
            configurations={selector_configurations}
            on_unset={() =>
              props.on_set_default_cli_configuration('patch-repair', null)
            }
            on_select={() =>
              props.on_select_default_cli_configuration('patch-repair')
            }
            translations={{
              select: t('agents.configurations.action.select-default'),
              unset: t('common.unset-default')
            }}
          />
          <DefaultConfigurationSelector
            title={t('common.voice-input')}
            value={props.agent_defaults['voice-input'] || null}
            configurations={selector_configurations}
            on_unset={() =>
              props.on_set_default_cli_configuration('voice-input', null)
            }
            on_select={() =>
              props.on_select_default_cli_configuration('voice-input')
            }
            translations={{
              select: t('agents.configurations.action.select-default'),
              unset: t('common.unset-default')
            }}
          />
        </UiGroup>
      </div>
    </UiSection>
  )
})

CliSection.displayName = 'CliSection'
