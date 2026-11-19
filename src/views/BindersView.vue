<script setup>
import { computed, onMounted, ref, shallowRef } from 'vue'
import ResponsiveAddButton from '../components/layout/ResponsiveAddButton.vue'
import { Binder } from '../models/Binder.js'
import { createBinder, getBinders } from '../services/binders.js'
import { getCollectionEntries } from '../services/collection.js'
import { useAuthStore } from '../stores/auth.js'

const authStore = useAuthStore()
const binders = shallowRef([])
const inventory = shallowRef([])
const name = ref('')
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const activeBinderId = ref(null)
const createDialogOpen = ref(false)

/** Indexes assigned copies by binder ID so one inventory entry can appear in several binders. */
const cardsByBinder = computed(() => {
  const groups = new Map()

  for (const { id, entry } of inventory.value) {
    for (const [binderId, quantity] of Object.entries(entry.binderQuantities)) {
      if (!groups.has(binderId)) groups.set(binderId, [])

      groups.get(binderId).push({
        id,
        name: entry.card.name,
        imageUrl: entry.card.imageUrl,
        printing: `${entry.card.setName} · #${entry.card.collectorNumber} · ${entry.finish}`,
        quantity,
      })
    }
  }

  return groups
})

const binderTiles = computed(() =>
  binders.value.map(({ id, binder }) => {
    const cards = cardsByBinder.value.get(id) ?? []
    return {
      id,
      name: binder.name,
      cards,
      copies: cards.reduce((total, card) => total + card.quantity, 0),
    }
  }),
)

const activeBinder = computed(() =>
  binderTiles.value.find((binder) => binder.id === activeBinderId.value),
)

/**
 * Loads binder records and inventory together so the page can show each binder's contents.
 * @returns {Promise<void>}
 */
async function loadBinders() {
  loading.value = true
  loadError.value = ''

  try {
    const userId = authStore.user?.uid
    const [binderRecords, inventoryRecords] = await Promise.all([
      getBinders(userId),
      getCollectionEntries(userId),
    ])

    binders.value = binderRecords
    inventory.value = inventoryRecords
  } catch {
    loadError.value = 'Could not load binders and their cards. Please try again.'
  } finally {
    loading.value = false
  }
}

/**
 * Validates the entered name, creates the binder, and refreshes the grid after success.
 * @returns {Promise<void>}
 */
async function submitBinder() {
  if (saving.value || loading.value) return

  saveError.value = ''

  let binder
  try {
    binder = new Binder(name.value)
  } catch (error) {
    saveError.value = error.message
    return
  }

  saving.value = true

  try {
    await createBinder(authStore.user?.uid, binder)
    createDialogOpen.value = false
    await loadBinders()
  } catch {
    saveError.value = 'Could not save the binder. Please try again.'
  } finally {
    saving.value = false
  }
}

function resetBinderForm() {
  name.value = ''
  saveError.value = ''
}

onMounted(loadBinders)
</script>

<template>
  <section>
    <header class="binder-page-header">
      <div class="binder-heading">
        <q-btn
          v-if="activeBinder"
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Back to binders"
          class="q-mb-sm"
          @click="activeBinderId = null"
        />
        <h1 class="text-h4 text-weight-bold q-ma-none">{{ activeBinder?.name ?? 'Binders' }}</h1>
        <p v-if="activeBinder" class="binder-copy-count q-mt-xs q-mb-none">
          {{ activeBinder.copies }} {{ activeBinder.copies === 1 ? 'copy' : 'copies' }} assigned
        </p>
      </div>
      <ResponsiveAddButton
        v-if="!activeBinder"
        label="New binder"
        :disable="loading || saving"
        @click="createDialogOpen = true"
      />
    </header>

    <div
      v-if="loading"
      class="binder-grid binder-grid--loading"
      role="status"
      aria-label="Loading binders"
    >
      <q-card v-for="index in 4" :key="index" class="binder-card" flat bordered aria-hidden="true">
        <q-card-section class="binder-tile">
          <q-skeleton type="rect" class="binder-tile-icon" />
          <div>
            <q-skeleton type="text" width="65%" height="1.75rem" />
            <q-skeleton type="text" width="40%" />
          </div>
        </q-card-section>
      </q-card>
    </div>
    <div v-else-if="loadError">
      <p class="text-negative" role="alert">{{ loadError }}</p>
      <q-btn flat label="Retry" @click="loadBinders" />
    </div>
    <template v-else-if="activeBinder">
      <q-list v-if="activeBinder.cards.length" class="binder-card-list" bordered separator>
        <q-item v-for="card in activeBinder.cards" :key="card.id">
          <q-item-section v-if="card.imageUrl" avatar>
            <img
              :src="card.imageUrl"
              class="binder-thumbnail"
              loading="lazy"
              width="38"
              height="53"
              alt=""
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ card.name }}</q-item-label>
            <q-item-label caption>{{ card.printing }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-badge color="primary" :label="`×${card.quantity}`" />
          </q-item-section>
        </q-item>
      </q-list>
      <p v-else class="binder-empty">No cards assigned yet.</p>
    </template>
    <p v-else-if="binderTiles.length === 0" class="binder-empty">
      You haven't created any binders yet.
    </p>
    <div v-else class="binder-grid">
      <q-card
        v-for="binder in binderTiles"
        :key="binder.id"
        class="binder-card"
        tag="article"
        flat
        bordered
      >
        <button
          type="button"
          class="binder-tile binder-tile-button"
          :aria-label="`Open binder ${binder.name}`"
          @click="activeBinderId = binder.id"
        >
          <span class="binder-tile-top" aria-hidden="true">
            <span class="binder-tile-icon"><q-icon name="book" size="24px" /></span>
            <q-icon name="chevron_right" size="22px" />
          </span>
          <span>
            <span class="binder-tile-name">{{ binder.name }}</span>
            <span class="binder-copy-count">
              {{ binder.copies }} {{ binder.copies === 1 ? 'copy' : 'copies' }} assigned
            </span>
          </span>
        </button>
      </q-card>
    </div>

    <q-dialog v-model="createDialogOpen" :persistent="saving" @hide="resetBinderForm">
      <q-card class="binder-create-dialog">
        <q-form @submit.prevent="submitBinder">
          <q-card-section>
            <h2 class="text-h6 text-weight-bold q-ma-none">New binder</h2>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-input v-model="name" label="Binder name" outlined autofocus :disable="saving" />
            <p v-if="saveError" class="text-negative q-mt-sm q-mb-none" role="alert">
              {{ saveError }}
            </p>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-close-popup flat no-caps label="Cancel" :disable="saving" />
            <q-btn
              type="submit"
              unelevated
              no-caps
              color="primary"
              label="Create binder"
              :loading="saving"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped lang="scss">
$binder-tile-width: 16rem;
$binder-grid-gap: 1rem;

.binder-page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.binder-heading {
  min-width: 0;
  overflow-wrap: anywhere;
}

.binder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, $binder-tile-width), 1fr));
  gap: $binder-grid-gap;
}

.binder-grid--loading {
  container-type: inline-size;

  // Show two placeholders on narrow screens and one full row on wider grids.
  @container (width < #{$binder-tile-width * 4 + $binder-grid-gap * 3}) {
    > :nth-child(4) {
      display: none;
    }
  }

  @container (width < #{$binder-tile-width * 3 + $binder-grid-gap * 2}) {
    > :nth-child(3) {
      display: none;
    }
  }
}

.binder-card,
.binder-card-list {
  border-radius: 0.875rem;
}

.binder-thumbnail {
  border-radius: 0.25rem;
  object-fit: contain;
}

.binder-tile {
  display: grid;
  align-content: space-between;
  gap: 1.125rem;
  min-height: 9rem;
  padding: 1.125rem;
}

.binder-tile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--q-primary);
}

.binder-tile-icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border-radius: 0.625rem;

  span.binder-tile-top & {
    background-color: color-mix(in srgb, var(--q-primary) 10%, transparent);
  }
}

.binder-tile-name {
  display: block;
  font-size: 1.125rem;
  font-weight: 650;
  line-height: 1.4;
}

.binder-copy-count {
  display: block;
  font-size: 0.875rem;
  opacity: 0.8;
}

.binder-tile-button {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  overflow-wrap: anywhere;
  text-align: left;

  &:hover,
  &:focus-visible {
    background-color: color-mix(in srgb, var(--q-primary) 5%, transparent);
    box-shadow: inset 0 0 0 2px var(--q-primary);
  }
}

.binder-empty {
  padding: 1.5rem;
  border: 1px dashed currentColor;
  border-radius: 0.875rem;
  text-align: center;
}

.binder-create-dialog {
  width: 26rem;
  max-width: calc(100vw - 2rem);
  border-radius: 0.875rem;
}
</style>
