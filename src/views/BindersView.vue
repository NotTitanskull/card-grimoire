<script setup>
import { computed, onMounted, ref, shallowRef } from 'vue'
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

const cardsByBinder = computed(() => {
  const groups = new Map()

  for (const { id, entry } of inventory.value) {
    for (const [binderId, quantity] of Object.entries(entry.binderQuantities)) {
      if (!groups.has(binderId)) groups.set(binderId, [])

      groups.get(binderId).push({
        id,
        name: entry.card.name,
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
    name.value = ''
    await loadBinders()
  } catch {
    saveError.value = 'Could not save the binder. Please try again.'
  } finally {
    saving.value = false
  }
}

onMounted(loadBinders)
</script>

<template>
  <section>
    <q-btn
      v-if="activeBinder"
      flat
      no-caps
      icon="arrow_back"
      label="Back to binders"
      class="q-mb-md"
      @click="activeBinderId = null"
    />
    <h1 class="text-h4 text-weight-bold q-mt-none q-mb-sm">
      {{ activeBinder?.name ?? 'Binders' }}
    </h1>

    <q-form v-if="!activeBinder" class="q-gutter-sm q-mb-lg" @submit.prevent="submitBinder">
      <q-input v-model="name" label="Binder name" outlined :disable="saving" />
      <p v-if="saveError" class="text-negative" role="alert">{{ saveError }}</p>
      <q-btn
        type="submit"
        label="Create binder"
        color="primary"
        :loading="saving"
        :disable="loading"
      />
    </q-form>

    <div v-if="loading" class="binder-grid" role="status" aria-label="Loading binders">
      <q-card v-for="index in 3" :key="index" flat bordered aria-hidden="true">
        <q-card-section class="binder-tile">
          <q-skeleton type="text" width="65%" height="2rem" />
          <q-skeleton type="text" width="35%" />
        </q-card-section>
      </q-card>
    </div>
    <div v-else-if="loadError">
      <p class="text-negative" role="alert">{{ loadError }}</p>
      <q-btn flat label="Retry" @click="loadBinders" />
    </div>
    <template v-else-if="activeBinder">
      <q-list v-if="activeBinder.cards.length" bordered separator>
        <q-item v-for="card in activeBinder.cards" :key="card.id">
          <q-item-section>
            <q-item-label>{{ card.name }}</q-item-label>
            <q-item-label caption>{{ card.printing }}</q-item-label>
          </q-item-section>
          <q-item-section side>{{ card.quantity }} assigned</q-item-section>
        </q-item>
      </q-list>
      <p v-else class="q-mt-md">No cards assigned yet.</p>
    </template>
    <p v-else-if="binderTiles.length === 0">You haven't created any binders yet.</p>
    <div v-else class="binder-grid">
      <q-card v-for="binder in binderTiles" :key="binder.id" tag="article" flat bordered>
        <button
          type="button"
          class="binder-tile binder-tile-button"
          :aria-label="`Open binder ${binder.name}`"
          @click="activeBinderId = binder.id"
        >
          <span class="text-h6">{{ binder.name }}</span>
          <span class="text-body2">
            {{ binder.copies }} {{ binder.copies === 1 ? 'copy' : 'copies' }} assigned
          </span>
        </button>
      </q-card>
    </div>
  </section>
</template>

<style scoped lang="scss">
.binder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: 1rem;
}

.binder-tile {
  display: grid;
  align-content: center;
  gap: 0.25rem;
  min-height: 6.5rem;
  padding: 1rem;
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
    box-shadow: inset 0 0 0 2px var(--q-primary);
  }
}
</style>
