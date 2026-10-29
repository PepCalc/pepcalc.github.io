import { defineStore } from 'pinia'
import { ref } from 'vue'
import { repository } from '@/db'
import { syringeCatalog } from '@/data'
import { areValidLimits, type AgeLimits } from '@/domain/vialAge'

export type ThemePreference = 'system' | 'light' | 'dark'

/** `sourced`: each vial's cited use window; `custom`: the user's own day thresholds. */
export type VialAgeMode = 'sourced' | 'custom'

/** Starting values offered for custom thresholds; the user's choice, not a sourced limit. */
export const DEFAULT_CUSTOM_AGE_LIMITS: AgeLimits = { nearingDays: 45, pastDays: 90 }

/** Keys in the settings table. Renaming one orphans users' saved values: add, never rename. */
const SETTING_KEYS = {
  defaultSyringeId: 'defaultSyringeId',
  theme: 'theme',
  lastBackupAt: 'lastBackupAt',
  disclaimerAcceptedAt: 'disclaimerAcceptedAt',
  installHintDismissed: 'installHintDismissed',
  vialAgeMode: 'vialAgeMode',
  customAgeLimits: 'customAgeLimits',
} as const

export const useSettingsStore = defineStore('settings', () => {
  const loaded = ref(false)
  const defaultSyringeId = ref(syringeCatalog.defaultSyringeId)
  const theme = ref<ThemePreference>('system')
  const lastBackupAt = ref<string | null>(null)
  const disclaimerAcceptedAt = ref<string | null>(null)
  const installHintDismissed = ref(false)
  const vialAgeMode = ref<VialAgeMode>('sourced')
  const customAgeLimits = ref<AgeLimits>({ ...DEFAULT_CUSTOM_AGE_LIMITS })

  async function load() {
    const [syringe, themePref, backup, disclaimer, hint, ageMode, ageLimits] = await Promise.all([
      repository.getSetting<string>(SETTING_KEYS.defaultSyringeId),
      repository.getSetting<ThemePreference>(SETTING_KEYS.theme),
      repository.getSetting<string>(SETTING_KEYS.lastBackupAt),
      repository.getSetting<string>(SETTING_KEYS.disclaimerAcceptedAt),
      repository.getSetting<boolean>(SETTING_KEYS.installHintDismissed),
      repository.getSetting<VialAgeMode>(SETTING_KEYS.vialAgeMode),
      repository.getSetting<AgeLimits>(SETTING_KEYS.customAgeLimits),
    ])
    if (syringe && syringeCatalog.syringes.some((s) => s.id === syringe)) {
      defaultSyringeId.value = syringe
    }
    if (themePref) theme.value = themePref
    lastBackupAt.value = backup ?? null
    disclaimerAcceptedAt.value = disclaimer ?? null
    installHintDismissed.value = hint ?? false
    if (ageMode === 'custom') vialAgeMode.value = ageMode
    // A restored backup is untrusted input; fall back rather than chart nonsense tiers.
    if (ageLimits && areValidLimits(ageLimits)) customAgeLimits.value = ageLimits
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

  /**
   * Record the acknowledgement on disk first, then close the dialog: closing optimistically let a
   * reload in that window bring the dialog back. Rejects, leaving it open, if the write fails.
   */
  async function acceptDisclaimer(at: string) {
    await repository.setSetting(SETTING_KEYS.disclaimerAcceptedAt, at)
    disclaimerAcceptedAt.value = at
  }

  async function dismissInstallHint() {
    installHintDismissed.value = true
    await repository.setSetting(SETTING_KEYS.installHintDismissed, true)
  }

  async function setVialAgeMode(value: VialAgeMode) {
    vialAgeMode.value = value
    await repository.setSetting(SETTING_KEYS.vialAgeMode, value)
  }

  /** Saves custom thresholds; ignores limits that fail `areValidLimits`. */
  async function setCustomAgeLimits(limits: AgeLimits) {
    if (!areValidLimits(limits)) return
    customAgeLimits.value = { ...limits }
    await repository.setSetting(SETTING_KEYS.customAgeLimits, { ...limits })
  }

  return {
    loaded,
    defaultSyringeId,
    theme,
    lastBackupAt,
    disclaimerAcceptedAt,
    installHintDismissed,
    vialAgeMode,
    customAgeLimits,
    load,
    setDefaultSyringe,
    setTheme,
    markBackedUp,
    acceptDisclaimer,
    dismissInstallHint,
    setVialAgeMode,
    setCustomAgeLimits,
  }
})
