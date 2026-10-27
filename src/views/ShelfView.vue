<script setup lang="ts">
import { ref } from 'vue'
import { useShelfStore } from '@/stores/shelf'
import VialCard from '@/components/shelf/VialCard.vue'
import { mdiPlus } from '@/plugins/icons'

const shelf = useShelfStore()
const showArchived = ref(false)
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
      <v-card-text>
        <p class="mb-2"><strong>No vials yet.</strong></p>
        <p class="pc-muted">
          Work out a draw in the calculator (<em>Help me choose</em> suggests how much water to
          add), then choose <em>Save vial to shelf</em>. PepCalc will remember the concentration and
          track what is left as you log draws.
        </p>
      </v-card-text>
    </v-card>

    <div class="shelf-grid">
      <VialCard
        v-for="vial in shelf.activeVials"
        :key="vial.id"
        :vial="vial"
        :balance="shelf.balanceOf(vial)"
      />
    </div>

    <template v-if="shelf.archivedVials.length">
      <v-btn variant="text" class="mt-6" @click="showArchived = !showArchived">
        {{ showArchived ? 'Hide' : 'Show' }} archived ({{ shelf.archivedVials.length }})
      </v-btn>
      <div v-if="showArchived" class="shelf-grid mt-2">
        <VialCard
          v-for="vial in shelf.archivedVials"
          :key="vial.id"
          :vial="vial"
          :balance="shelf.balanceOf(vial)"
        />
      </div>
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
