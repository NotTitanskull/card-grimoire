<script setup>
import { computed, ref, watch } from 'vue'
import { getCollectionEntries } from '../services/collection.js'
import { useAuthStore } from '@/stores/auth.js'

/**
 * A saved inventory entry as displayed in the Giving picker.
 * @typedef {Object} TradeOption
 * @property {string} id Inventory document ID for this printing, condition, and finish.
 * @property {string} name Card name.
 * @property {string} details Searchable display text for the printing and variant.
 * @property {number} available Copies that are outside binders.
 */

/** @typedef {TradeOption & { quantity: number }} TradeDraftLine */

const authStore = useAuthStore()
/** @type {import('vue').Ref<TradeOption[]>} */
const owned = ref([])
/** @type {import('vue').Ref<TradeDraftLine[]>} */
const giving = ref([])
const loading = ref(false)
const loadError = ref('')
const pickerOpen = ref(false)
const search = ref('')

const matchingCards = computed(() => {
  const query = search.value.trim().toLowerCase()
  const selectedIds = new Set(giving.value.map(({ id }) => id))

  return owned.value.filter((card) => {
    const text = `${card.name} ${card.details}`.toLowerCase()
    return !selectedIds.has(card.id) && text.includes(query)
  })
})

const totalCopies = computed(() => giving.value.reduce((total, card) => total + card.quantity, 0))

/**
 * Loads eligible entries for the signed-in account and excludes copies assigned to binders.
 * Applies results only while the request's account is still signed in.
 * @returns {Promise<void>}
 */
async function loadOwned() {
  const userId = authStore.user?.uid
  loadError.value = ''
  loading.value = Boolean(userId)

  if (!userId) return

  try {
    const records = await getCollectionEntries(userId)

    if (authStore.user?.uid !== userId) return

    owned.value = records
      .map(({ id, entry }) => {
        const assigned = Object.values(entry.binderQuantities).reduce(
          (total, quantity) => total + quantity,
          0,
        )

        return {
          id,
          name: entry.card.name,
          details: `${entry.card.setName}  · #${entry.card.collectorNumber} · ${entry.condition} · ${entry.finish}`,
          available: entry.quantity - assigned,
        }
      })
      .filter((card) => card.available > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    if (authStore.user?.uid === userId) {
      loadError.value = 'Could not load your collection. Please try again.'
    }
  } finally {
    if (authStore.user?.uid === userId) loading.value = false
  }
}

function openPicker() {
  search.value = ''
  pickerOpen.value = true
}

/**
 * Adds one copy to the current draft and prevents duplicate lines for the same saved entry.
 * @param {TradeOption} card The selected inventory entry.
 */
function addCard(card) {
  if (giving.value.some(({ id }) => id === card.id)) return
  giving.value.push({ ...card, quantity: 1 })
}

/**
 * Adjusts the draft quantity within the entry's available copies.
 * @param {TradeDraftLine} card The line to adjust.
 * @param {-1 | 1} amount One fewer or one more copy.
 */
function changeQuantity(card, amount) {
  const next = card.quantity + amount
  if (next >= 1 && next <= card.available) card.quantity = next
}

function removeCard(id) {
  giving.value = giving.value.filter((card) => card.id !== id)
}

watch(
  () => authStore.user?.uid,
  () => {
    owned.value = []
    giving.value = []
    pickerOpen.value = false
    void loadOwned()
  },
  { immediate: true },
)
</script>

<template>
  <section>
    <h1 class="text-h4 text-weight-bold q-mt-none q-mb-md">Trade</h1>

    <div class="row items-center justify-between q-gutter-sm q-mb-md">
      <h2 class="text-h6 q-ma-none">
        Giving
        <span v-if="totalCopies" class="text-body2 text-grey-8">
          · {{ totalCopies }} {{ totalCopies === 1 ? 'copy' : 'copies' }}
        </span>
      </h2>
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="add"
        label="Add from collection"
        :disable="loading || Boolean(loadError) || !owned.length"
        @click="openPicker"
      />
    </div>

    <div v-if="loading" role="status" aria-label="Loading collection">
      <q-skeleton v-for="row in 3" :key="row" height="60px" class="q-mb-sm" />
    </div>
    <q-banner v-else-if="loadError" class="bg-red-1 text-negative" role="alert">
      {{ loadError }}
      <template #action>
        <q-btn flat no-caps label="Retry" @click="loadOwned" />
      </template>
    </q-banner>
    <p v-else-if="!owned.length">
      There are no copies outside binders to add from your collection.
    </p>
    <p v-else-if="!giving.length">Choose cards from your collection to start a trade draft.</p>

    <q-list v-else bordered separator>
      <q-item v-for="card in giving" :key="card.id" class="items-center">
        <q-item-section>
          <q-item-label>{{ card.name }}</q-item-label>
          <q-item-label caption>{{ card.details }}</q-item-label>
          <q-item-label caption>{{ card.available }} available</q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="row no-wrap items-center">
            <q-btn
              flat
              round
              dense
              icon="remove"
              :aria-label="`Give one fewer copy of ${card.name}`"
              :disable="card.quantity <= 1"
              @click="changeQuantity(card, -1)"
            />
            <span class="q-px-xs" aria-live="polite">{{ card.quantity }}</span>
            <q-btn
              flat
              round
              dense
              icon="add"
              :aria-label="`Give one more copy of ${card.name}`"
              :disable="card.quantity >= card.available"
              @click="changeQuantity(card, 1)"
            />
            <q-btn
              flat
              round
              dense
              icon="close"
              :aria-label="`Remove ${card.name} from the draft`"
              @click="removeCard(card.id)"
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <q-dialog v-model="pickerOpen" aria-labelledby="trade-picker-title">
      <q-card style="width: 36rem; max-width: calc(100vw - 3rem)">
        <q-card-section class="row items-center justify-between">
          <h2 id="trade-picker-title" class="text-h6 q-ma-none">Choose cards to give</h2>
          <q-btn v-close-popup flat round dense icon="close" aria-label="Close picker" />
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-input v-model="search" outlined dense type="search" label="Search your collection" />
        </q-card-section>
        <q-list v-if="matchingCards.length" separator>
          <q-item v-for="card in matchingCards" :key="card.id" class="items-center">
            <q-item-section>
              <q-item-label>{{ card.name }}</q-item-label>
              <q-item-label caption>{{ card.details }}</q-item-label>
              <q-item-label caption>{{ card.available }} available</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                no-caps
                color="primary"
                label="Add"
                :aria-label="`Add ${card.name}, ${card.details}, to the draft`"
                @click="addCard(card)"
              />
            </q-item-section>
          </q-item>
        </q-list>
        <q-card-section v-else>
          {{
            search.trim()
              ? 'No remaining cards match your search.'
              : 'All eligible entries are in the draft.'
          }}
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps color="primary" label="Done" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </section>
</template>
