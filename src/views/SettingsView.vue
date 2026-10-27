<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { db } from '@/db'
import {
  backupFileName,
  BackupFormatError,
  exportBackup,
  parseBackup,
  restoreBackup,
} from '@/db/backup'
import { catalog, syringeCatalog } from '@/data'
import { areValidLimits } from '@/domain/vialAge'
import {
  DEFAULT_CUSTOM_AGE_LIMITS,
  useSettingsStore,
  type ThemePreference,
  type VialAgeMode,
} from '@/stores/settings'
import { useShelfStore } from '@/stores/shelf'
import { useNotifyStore } from '@/stores/notify'
import { useConfirmStore } from '@/stores/confirm'
import { useStoragePersistence } from '@/composables/useStoragePersistence'
import { useInstallPrompt, type InstallPlatform } from '@/composables/useInstallPrompt'
import androidChromeShot from '@/assets/install/android-chrome.webp'
import androidFirefoxShot from '@/assets/install/android-firefox.webp'
import iosChromeShot from '@/assets/install/ios-chrome.webp'
import iosSafariShot from '@/assets/install/ios-safari.webp'
import { saveFile } from '@/services/fileTransfer'
import { daysBetween, formatDateTime, systemClock } from '@/services/time'
import {
  mdiCellphoneArrowDown,
  mdiCheckCircleOutline,
  mdiCloudOffOutline,
  mdiDownload,
  mdiShieldLockOutline,
  mdiTrayArrowUp,
} from '@/plugins/icons'

const settings = useSettingsStore()
const shelf = useShelfStore()
const notify = useNotifyStore()
const confirm = useConfirmStore()
const theme = useTheme()
const storage = useStoragePersistence()
const install = useInstallPrompt()
// Android file providers often label a .json backup as a generic type, which would grey it out
// in the native picker; parseBackup rejects anything that is not a backup.
const backupAccept = __NATIVE__ ? undefined : 'application/json,.json'
const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)

const version = __APP_VERSION__

const themeModel = computed({
  get: () => settings.theme,
  set: (value: ThemePreference) => {
    void settings.setTheme(value)
    theme.change(value)
  },
})

const syringeModel = computed({
  get: () => settings.defaultSyringeId,
  set: (id: string) => void settings.setDefaultSyringe(id),
})

const ageModeModel = computed({
  get: () => settings.vialAgeMode,
  set: (mode: VialAgeMode) => void settings.setVialAgeMode(mode),
})

// Text fields hold what the user is typing; only a valid pair reaches the store.
const ageForm = reactive({ nearing: '', past: '' })
watch(
  () => settings.customAgeLimits,
  (limits) => {
    ageForm.nearing = String(limits.nearingDays)
    ageForm.past = String(limits.pastDays)
  },
  { immediate: true },
)
const typedLimits = computed(() => ({
  nearingDays: Number(ageForm.nearing),
  pastDays: Number(ageForm.past),
}))
const ageFormError = computed(() =>
  areValidLimits(typedLimits.value)
    ? undefined
    : 'Use whole days, with "use soon" earlier than "past".',
)
watch(typedLimits, (typed) => {
  const saved = settings.customAgeLimits
  if (typed.nearingDays === saved.nearingDays && typed.pastDays === saved.pastDays) return
  void settings.setCustomAgeLimits(typed)
})
function resetAgeLimits() {
  void settings.setCustomAgeLimits(DEFAULT_CUSTOM_AGE_LIMITS)
}

const backupAge = computed(() =>
  settings.lastBackupAt ? daysBetween(settings.lastBackupAt, systemClock()) : null,
)
const backupStale = computed(
  () => shelf.vials.length > 0 && (backupAge.value === null || backupAge.value > 14),
)

async function exportData() {
  busy.value = true
  try {
    const backup = await exportBackup(db)
    const result = await saveFile(
      backupFileName(backup.exportedAt),
      JSON.stringify(backup, null, 2),
    )
    if (result !== 'cancelled') {
      await settings.markBackedUp(backup.exportedAt)
      notify.show('Backup saved. Keep it somewhere safe.', 'success')
    }
  } finally {
    busy.value = false
  }
}

async function importData(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const backup = parseBackup(await file.text())
    const ok = await confirm.ask({
      title: 'Replace everything on this device?',
      text: `The backup has ${backup.vials.length} vials and ${backup.draws.length} draws. Your current ${shelf.vials.length} vials and ${shelf.draws.length} draws will be replaced.`,
      confirmText: 'Restore backup',
      destructive: true,
    })
    if (!ok) return
    await restoreBackup(db, backup)
    await Promise.all([shelf.load(), settings.load()])
    theme.change(settings.theme)
    notify.show('Backup restored', 'success')
  } catch (e) {
    notify.show(e instanceof BackupFormatError ? e.message : 'Could not read that file.', 'error')
  }
}

interface InstallScreenshot {
  src: string
  width: number
  height: number
  alt: string
}

const INSTALL_SCREENSHOTS: Partial<Record<InstallPlatform, InstallScreenshot>> = {
  'ios-safari': {
    src: iosSafariShot,
    width: 480,
    height: 666,
    alt: "Safari's Share menu with Add to Home Screen at the bottom of the list",
  },
  'ios-chrome': {
    src: iosChromeShot,
    width: 480,
    height: 842,
    alt: "Chrome's Share menu on iPhone with Add to Home Screen at the bottom of the list",
  },
  'android-chrome': {
    src: androidChromeShot,
    width: 480,
    height: 996,
    alt: "Chrome's menu on Android with Install and create shortcut highlighted",
  },
  'android-firefox': {
    src: androidFirefoxShot,
    width: 480,
    height: 999,
    alt: "Firefox's menu on Android with Add app to Home screen highlighted",
  },
}

const installShot = computed(() => INSTALL_SCREENSHOTS[install.state.platform])

async function promptInstall() {
  if (await install.actions.promptInstall()) notify.show('PepCalc installed', 'success')
}

const formatMb = (bytes: number | null) =>
  bytes === null ? '?' : `${(bytes / 1_048_576).toFixed(1)} MB`
</script>

<template>
  <div class="pc-page settings">
    <header class="mb-4">
      <p class="pc-eyebrow">Preferences</p>
      <h1 class="pc-display text-headline-large">Settings</h1>
    </header>

    <div class="settings-grid">
      <v-card>
        <v-card-item>
          <p class="pc-eyebrow">Display</p>
          <v-card-title>Appearance and defaults</v-card-title>
        </v-card-item>
        <v-card-text class="pc-stack">
          <div>
            <p id="theme-label" class="pc-label">Theme</p>
            <v-btn-toggle
              v-model="themeModel"
              mandatory
              density="comfortable"
              aria-labelledby="theme-label"
            >
              <v-btn value="system">System</v-btn>
              <v-btn value="light">Light</v-btn>
              <v-btn value="dark">Dark</v-btn>
            </v-btn-toggle>
          </div>
          <v-select
            v-model="syringeModel"
            :items="syringeCatalog.syringes.map((s) => ({ title: s.label, value: s.id }))"
            label="Default syringe"
          />
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="pc-eyebrow">Shelf</p>
          <v-card-title>Vial age alerts</v-card-title>
        </v-card-item>
        <v-card-text class="pc-stack">
          <div>
            <p id="age-mode-label" class="pc-label">Mark a mixed vial by</p>
            <v-btn-toggle
              v-model="ageModeModel"
              mandatory
              density="comfortable"
              aria-labelledby="age-mode-label"
            >
              <v-btn value="sourced">Cited limit</v-btn>
              <v-btn value="custom">My own days</v-btn>
            </v-btn-toggle>
          </div>
          <p v-if="settings.vialAgeMode === 'sourced'" class="text-body-medium pc-muted">
            Each vial counts against its cited limit ({{ catalog.storage.inUse.days }} days for
            bacteriostatic water, shorter where a peptide's label says so) and is marked
            <em>use soon</em> in its last quarter.
          </p>
          <template v-else>
            <div class="d-flex ga-3 align-start">
              <v-text-field
                v-model="ageForm.nearing"
                label="Use soon from day"
                type="number"
                inputmode="numeric"
                :error-messages="ageFormError"
              />
              <v-text-field
                v-model="ageForm.past"
                label="Past from day"
                type="number"
                inputmode="numeric"
                :error="!!ageFormError"
              />
            </div>
            <p class="text-body-medium pc-muted">
              These are your own thresholds, not a sourced limit. Each vial page still shows its
              cited limit ({{ catalog.storage.inUse.days }} days for bacteriostatic water).
            </p>
            <div class="pc-actions">
              <v-btn variant="text" @click="resetAgeLimits">
                Reset to {{ DEFAULT_CUSTOM_AGE_LIMITS.nearingDays }} and
                {{ DEFAULT_CUSTOM_AGE_LIMITS.pastDays }} days
              </v-btn>
            </div>
          </template>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="pc-eyebrow">Your data</p>
          <v-card-title>Backup and restore</v-card-title>
        </v-card-item>
        <v-card-text class="pc-stack">
          <p>
            Everything is stored only in this browser on this device. If you clear site data,
            uninstall the app, or the system reclaims storage, it is gone. A backup file is the only
            copy that survives.
          </p>
          <v-alert v-if="backupStale" type="warning" variant="tonal" density="compact">
            {{
              settings.lastBackupAt
                ? `Last backup ${backupAge} days ago.`
                : 'You have not made a backup yet.'
            }}
          </v-alert>
          <p v-else-if="settings.lastBackupAt" class="pc-muted">
            Last backup {{ formatDateTime(settings.lastBackupAt) }}
          </p>
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              color="primary"
              variant="flat"
              :prepend-icon="mdiDownload"
              :loading="busy"
              @click="exportData"
            >
              Save a backup
            </v-btn>
            <v-btn variant="outlined" :prepend-icon="mdiTrayArrowUp" @click="fileInput?.click()">
              Restore from file
            </v-btn>
            <input
              ref="fileInput"
              type="file"
              :accept="backupAccept"
              class="d-none"
              aria-label="Backup file"
              @change="importData"
            />
          </div>
          <p class="text-body-small pc-muted">
            On iPhone and iPad, the Safari tab and the Home Screen app keep separate data. Move data
            between them with a backup.
          </p>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="pc-eyebrow">Install</p>
          <v-card-title>Add to Home Screen</v-card-title>
        </v-card-item>
        <v-card-text class="pc-stack">
          <p v-if="install.state.standalone" class="d-flex align-center ga-2">
            <v-icon :icon="mdiCheckCircleOutline" color="success" />
            Running as an installed app.
          </p>
          <template v-else>
            <p>Installed, PepCalc opens full screen and works with no connection.</p>
            <v-btn
              v-if="install.canPrompt.value"
              color="primary"
              variant="flat"
              :prepend-icon="mdiCellphoneArrowDown"
              class="align-self-start"
              @click="promptInstall"
            >
              Install PepCalc
            </v-btn>
            <template v-else>
              <!-- Step wording matches the menu labels in each screenshot. -->
              <ol class="install-steps">
                <template v-if="install.state.platform === 'ios-safari'">
                  <li>Tap the <strong>Share</strong> button.</li>
                  <li>
                    Tap <strong>View More</strong> if needed, then choose
                    <strong>Add to Home Screen</strong>.
                  </li>
                  <li>Tap <strong>Add</strong>.</li>
                </template>
                <template v-else-if="install.state.platform === 'ios-chrome'">
                  <li>Tap the <strong>Share</strong> button in the address bar.</li>
                  <li>Scroll down and choose <strong>Add to Home Screen</strong>.</li>
                  <li>Tap <strong>Add</strong>.</li>
                </template>
                <template v-else-if="install.state.platform === 'android-firefox'">
                  <li>Open the Firefox menu (<strong>⋮</strong>).</li>
                  <li>Choose <strong>Add app to Home screen</strong>, then confirm.</li>
                </template>
                <template v-else-if="install.state.platform === 'android-chrome'">
                  <li>Open the Chrome menu (<strong>⋮</strong>).</li>
                  <li>
                    Choose <strong>Install and create shortcut</strong> (or
                    <strong>Add to Home screen</strong>), then confirm.
                  </li>
                </template>
                <template v-else>
                  <li>Open the browser menu.</li>
                  <li>
                    Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </li>
                </template>
              </ol>
              <img
                v-if="installShot"
                class="install-shot"
                :src="installShot.src"
                :width="installShot.width"
                :height="installShot.height"
                :alt="installShot.alt"
                loading="lazy"
              />
            </template>
          </template>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="pc-eyebrow">Privacy</p>
          <v-card-title>Nothing leaves this device</v-card-title>
        </v-card-item>
        <v-card-text class="pc-stack">
          <ul class="privacy-list">
            <li>
              <v-icon :icon="mdiShieldLockOutline" size="small" /> No account, no server, no
              analytics.
            </li>
            <li>
              <v-icon :icon="mdiCloudOffOutline" size="small" /> Works fully offline once loaded.
            </li>
          </ul>
          <p class="text-body-small pc-muted">
            Storage:
            {{
              storage.state.persisted
                ? 'protected from automatic clean-up'
                : 'best effort (the browser may clear it under storage pressure)'
            }}
            <template v-if="storage.state.usageBytes !== null">
              · {{ formatMb(storage.state.usageBytes) }} used
            </template>
          </p>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="pc-eyebrow">About</p>
          <v-card-title>PepCalc {{ version }}</v-card-title>
        </v-card-item>
        <v-card-text class="about">
          <p>
            A reconstitution and draw calculator for peptide research. It does arithmetic and shows
            sourced reference values; it does not recommend doses and is not medical advice.
          </p>
          <p>
            Preset values carry their source: prescribing labels, clinical trials, or
            community-reported amounts (not clinically established). Level charts are model
            estimates.
          </p>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.settings-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
  align-items: start;
}

.install-steps {
  padding-left: 20px;
  margin: 0;
}

.install-steps li + li {
  margin-top: 4px;
}

.install-shot {
  display: block;
  width: 100%;
  max-width: 240px;
  height: auto;
  margin: 0 auto;
  border: 1px solid var(--pc-divider-strong);
  border-radius: var(--pc-radius-lg);
}

.privacy-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
}

.about p + p {
  margin-top: 12px;
}
</style>
