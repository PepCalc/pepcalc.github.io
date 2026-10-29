<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useDisplay, useTheme } from 'vuetify'
import { useRoute } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useShelfStore } from '@/stores/shelf'
import { useInstallPrompt } from '@/composables/useInstallPrompt'
import { useHideOnScroll } from '@/composables/useHideOnScroll'
import AppLogo from '@/components/common/AppLogo.vue'
import AppSnackbar from '@/components/common/AppSnackbar.vue'
import AppConfirm from '@/components/common/AppConfirm.vue'
import UpdatePrompt from '@/components/common/UpdatePrompt.vue'
import DisclaimerDialog from '@/components/common/DisclaimerDialog.vue'
import {
  mdiBookshelf,
  mdiCalculatorVariantOutline,
  mdiCellphoneArrowDown,
  mdiCogOutline,
  mdiHistory,
} from '@/plugins/icons'

const settings = useSettingsStore()
const shelf = useShelfStore()
const theme = useTheme()
const display = useDisplay()
const route = useRoute()
const install = useInstallPrompt()

const NAV = [
  { name: 'calculator', title: 'Calculator', icon: mdiCalculatorVariantOutline },
  { name: 'shelf', title: 'Shelf', icon: mdiBookshelf },
  { name: 'history', title: 'History', icon: mdiHistory },
  { name: 'settings', title: 'Settings', icon: mdiCogOutline },
] as const

// Phones get bottom navigation within thumb reach; tablets and desktops a side rail.
const wide = computed(() => display.mdAndUp.value)

const activeNav = computed(() => (route.name === 'vial' ? 'shelf' : String(route.name ?? '')))

const bar = useHideOnScroll()

// A new page starts with its title bar in view.
watch(() => route.fullPath, bar.actions.reveal)

/*
 * A tap on a non-interactive part of the page brings the bar back, as tapping the screen does in
 * reading apps; taps on controls are left to the control.
 */
const INTERACTIVE = 'a, button, input, select, textarea, label, canvas, [role], .v-field, .v-chip'
function onContentTap(event: MouseEvent) {
  if (!bar.state.hidden) return
  if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return
  bar.actions.reveal()
}

/** Re-tapping the current tab scrolls back to the top, as in iOS and Android tab bars. */
function onTabTap(name: string) {
  if (route.name !== name) return
  window.scrollTo({ top: 0, behavior: 'smooth' })
  bar.actions.reveal()
}

const showInstallBanner = computed(
  () => settings.loaded && !settings.installHintDismissed && !install.state.standalone,
)

onMounted(async () => {
  await Promise.all([settings.load(), shelf.load()])
  theme.change(settings.theme)
})
</script>

<template>
  <v-app>
    <v-app-bar
      flat
      density="compact"
      :class="['app-bar', { 'pc-app-bar--hidden': bar.state.hidden }]"
      @click="bar.actions.reveal"
      @focusin="bar.actions.reveal"
    >
      <v-app-bar-title>
        <router-link :to="{ name: 'calculator' }" class="brand" aria-label="PepCalc, calculator">
          <AppLogo :size="30" />
        </router-link>
      </v-app-bar-title>
    </v-app-bar>

    <v-navigation-drawer v-if="wide" permanent rail rail-width="96">
      <v-list nav density="comfortable" class="pt-4">
        <v-list-item
          v-for="item in NAV"
          :key="item.name"
          :to="{ name: item.name }"
          :active="activeNav === item.name"
          class="rail-item"
        >
          <div class="d-flex flex-column align-center ga-1 py-1">
            <v-icon :icon="item.icon" />
            <span class="text-label-medium">{{ item.title }}</span>
          </div>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main @click="onContentTap">
      <v-banner
        v-if="showInstallBanner"
        :icon="mdiCellphoneArrowDown"
        density="compact"
        :lines="wide ? 'one' : undefined"
        :stacked="!wide"
        class="install-banner"
      >
        <v-banner-text> Add PepCalc to your Home Screen to use it offline. </v-banner-text>
        <template #actions>
          <v-btn :to="{ name: 'settings' }" variant="text">How</v-btn>
          <v-btn variant="text" @click="settings.dismissInstallHint()">Dismiss</v-btn>
        </template>
      </v-banner>
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </v-main>

    <v-bottom-navigation v-if="!wide" :model-value="activeNav" grow class="bottom-nav">
      <v-btn
        v-for="item in NAV"
        :key="item.name"
        :value="item.name"
        :to="{ name: item.name }"
        @click="onTabTap(item.name)"
      >
        <v-icon :icon="item.icon" />
        <span>{{ item.title }}</span>
      </v-btn>
    </v-bottom-navigation>

    <AppSnackbar />
    <AppConfirm />
    <UpdatePrompt />
    <DisclaimerDialog />
  </v-app>
</template>

<style scoped>
.brand {
  display: inline-flex;
  text-decoration: none;
}

/*
 * Keep content clear of the notch and rounded corners when installed (viewport-fit=cover). The
 * Android app's WebView reports zero env() insets on older versions; Capacitor sets the
 * --safe-area-inset-* properties instead, so those win when present.
 */
.app-bar {
  padding-top: var(--safe-area-inset-top, env(safe-area-inset-top));
  padding-left: var(--safe-area-inset-left, env(safe-area-inset-left));
  padding-right: var(--safe-area-inset-right, env(safe-area-inset-right));
}

.bottom-nav {
  padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom));
  height: calc(64px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom))) !important;
}

.rail-item {
  justify-content: center;
  min-height: 64px;
}

.install-banner {
  border-bottom: 1px solid var(--pc-divider);
}
</style>
