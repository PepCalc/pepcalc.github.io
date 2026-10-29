<script setup lang="ts">
import { ref } from 'vue'
import { useShelfStore } from '@/stores/shelf'
import { useNow } from '@/composables/useNow'
import { usePaging } from '@/composables/usePaging'
import VialCard from '@/components/shelf/VialCard.vue'
import ListPager from '@/components/common/ListPager.vue'
import { mdiPlus } from '@/plugins/icons'

const shelf = useShelfStore()
const now = useNow()
const showArchived = ref(false)

const { state: activePaging, current: activePage } = usePaging(() => shelf.activeVials)
const { state: archivedPaging, current: archivedPage } = usePaging(() => shelf.archivedVials)
</script>

<template>
  <div class="pc-page">
    <header class="d-flex align-center flex-wrap ga-3 mb-4">
      <div class="flex-grow-1">
        <p class="pc-eyebrow">Your shelf</p>
        <h1 class="pc-display text-headline-large">Vials</h1>
      </div>
      <v-btn :to="{ name: 'calculator' }" color="primary" variant="flat" :prepend-icon="mdiPlus">
        Add a vial
      </v-btn>
    </header>

    <v-card v-if="shelf.loaded && shelf.activeVials.length === 0" variant="tonal">
      <v-card-text class="pc-stack pc-stack--tight">
        <p><strong>No vials yet.</strong></p>
        <p class="pc-muted">
          In the calculator, tap <em>Save vial to shelf</em> to track what's left as you log draws.
        </p>
      </v-card-text>
    </v-card>

    <div class="shelf-grid">
      <VialCard
        v-for="vial in activePage.items"
        :key="vial.id"
        :vial="vial"
        :balance="shelf.balanceOf(vial)"
        :title="shelf.displayName(vial)"
        :now="now"
      />
    </div>
    <ListPager v-model="activePaging.page" :current="activePage" noun="vials" class="mt-4" />

    <template v-if="shelf.archivedVials.length">
      <v-btn variant="text" class="mt-6" @click="showArchived = !showArchived">
        {{ showArchived ? 'Hide' : 'Show' }} archived ({{ shelf.archivedVials.length }})
      </v-btn>
      <template v-if="showArchived">
        <div class="shelf-grid mt-2">
          <VialCard
            v-for="vial in archivedPage.items"
            :key="vial.id"
            :vial="vial"
            :balance="shelf.balanceOf(vial)"
            :title="shelf.displayName(vial)"
            :now="now"
          />
        </div>
        <ListPager
          v-model="archivedPaging.page"
          :current="archivedPage"
          noun="archived vials"
          class="mt-4"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
.shelf-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}
</style>
