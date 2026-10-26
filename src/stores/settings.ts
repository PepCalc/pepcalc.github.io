import { defineStore } from 'pinia'
import { ref } from 'vue'
import { repository } from '@/db'
import { syringeCatalog } from '@/data'

export type ThemePreference = 'system' | 'light' | 'dark'

/** Keys in the settings table. Renaming one orphans users' saved values: add, never rename. */
const SETTING_KEYS = {
  defaultSyringeId: 'defaultSyringeId',
  theme: 'theme',
  lastBackupAt: 'lastBackupAt',
  disclaimerAcceptedAt: 'disclaimerAcceptedAt',
  installHintDismissed: 'installHintDismissed',
} as const

export const useSettingsStore = defineStore('settings', () => {
  const loaded = ref(false)
  const defaultSyringeId = ref(syringeCatalog.defaultSyringeId)
  const theme = ref<ThemePreference>('system')
  const lastBackupAt = ref<string | null>(null)
  const disclaimerAcceptedAt = ref<string | null>(null)
  const installHintDismissed = ref(false)

  async function load() {
    const [syringe, themePref, backup, disclaimer, hint] = await Promise.all([
      repository.getSetting<string>(SETTING_KEYS.defaultSyringeId),
      repository.getSetting<ThemePreference>(SETTING_KEYS.theme),
      repository.getSetting<string>(SETTING_KEYS.lastBackupAt),
      repository.getSetting<string>(SETTING_KEYS.disclaimerAcceptedAt),
      repository.getSetting<boolean>(SETTING_KEYS.installHintDismissed),
    ])
    if (syringe && syringeCatalog.syringes.some((s) => s.id === syringe)) {
      defaultSyringeId.value = syringe
    }
    if (themePref) theme.value = themePref
    lastBackupAt.value = backup ?? null
    disclaimerAcceptedAt.value = disclaimer ?? null
    installHintDismissed.value = hint ?? false
    loaded.value = true
  }

  async function setDefaultSyringe(id: string) {
    defaultSyringeId.value = id
    await repository.setSetting(SETTING_KEYS.defaultSyringeId, id)
  }

  async function setTheme(value: ThemePreference) {
    theme.value = value
    await repository.setSetting(SETTING_KEYS.theme, value)
  }

  async function markBackedUp(at: string) {
    lastBackupAt.value = at
    await repository.setSetting(SETTING_KEYS.lastBackupAt, at)
  }

  async function acceptDisclaimer(at: string) {
    disclaimerAcceptedAt.value = at
    await repository.setSetting(SETTING_KEYS.disclaimerAcceptedAt, at)
  }

  async function dismissInstallHint() {
    installHintDismissed.value = true
    await repository.setSetting(SETTING_KEYS.installHintDismissed, true)
  }

  return {
    loaded,
    defaultSyringeId,
    theme,
    lastBackupAt,
    disclaimerAcceptedAt,
    installHintDismissed,
    load,
    setDefaultSyringe,
    setTheme,
    markBackedUp,
    acceptDisclaimer,
    dismissInstallHint,
  }
})
