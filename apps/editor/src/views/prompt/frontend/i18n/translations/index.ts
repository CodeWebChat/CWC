import { header } from './header'
import { home } from './home'
import { configurations } from './configurations'
import { actions } from './actions'
import { prompt_field } from './prompt-field'
import { recent_donations } from './recent-donations'
import { main } from './main'
import { selected_files } from './selected-files'

import { footer } from './footer'
import { modals } from './modals'
import { response_preview } from './response-preview'

export const translations = {
  ...header,
  ...home,
  ...configurations,
  ...actions,
  ...prompt_field,
  ...recent_donations,
  ...footer,
  ...modals,
  ...main,
  ...selected_files,
  ...response_preview
}
