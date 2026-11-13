<script setup>
import { onUnmounted, ref, watch } from 'vue'
import AddCardDialog from '../components/cards/AddCardDialog.vue'
import { searchCards } from '../services/scryfall'

const dialogOpen = ref(false)
const loading = ref(false)
const cards = ref([])
const errorMessage = ref('')
const searched = ref(false)
const hasMore = ref(false)

let activeRequest = null

/**
 * Searches Scryfall and displays the first page of results.
 * @param {string} query Submitted search text.
 * @returns {Promise<void>}
 */
async function handleSearch(query) {
  if (loading.value) return

  const controller = new AbortController()
  activeRequest = controller

  loading.value = true
  errorMessage.value = ''
  cards.value = []
  searched.value = false
  hasMore.value = false

  try {
    const result = await searchCards(query, {
      signal: controller.signal,
    })

    if (activeRequest !== controller) return

    cards.value = result.cards
    hasMore.value = result.hasMore
    searched.value = true
  } catch (error) {
    if (activeRequest !== controller || error.name === 'AbortError') return

    errorMessage.value = 'Unable to search cards. Please try again.'
  } finally {
    if (activeRequest === controller) {
      loading.value = false
      activeRequest = null
    }
  }
}

/**
 * Cancels a pending search and prevents stale results from being displayed.
 * @returns {void}
 */
function cancelSearch() {
  activeRequest?.abort()
  activeRequest = null
  loading.value = false
}

watch(dialogOpen, (isOpen) => {
  if (!isOpen) {
    cancelSearch()
  }
})

onUnmounted(cancelSearch)
</script>

<template>
  <section>
    <h1 class="text-h4 text-weight-bold q-mt-none q-mb-sm">
      My Collection
    </h1>

    <p>Browse and manage every card in your collection.</p>

    <q-btn
        color="primary"
        icon="add"
        label="Add card"
        no-caps
        @click="dialogOpen = true"
    />

    <AddCardDialog
        v-model="dialogOpen"
        :loading="loading"
        @search="handleSearch"
    >
      <div v-if="loading" role="status" aria-label="Searching cards">
        <q-skeleton
            v-for="item in 3"
            :key="item"
            type="rect"
            height="64px"
            class="q-mb-sm"
        />
      </div>

      <q-banner
          v-else-if="errorMessage"
          class="bg-red-1 text-negative rounded-borders"
          role="alert"
      >
        {{ errorMessage }}
      </q-banner>

      <template v-else-if="searched">
        <p role="status">
          {{ cards.length }} results displayed.
          <span v-if="hasMore">
            More matches are available. Refine your search for now.
          </span>
        </p>

        <q-list v-if="cards.length" bordered separator>
          <q-item v-for="card in cards" :key="card.scryfallId">
            <q-item-section>
              <q-item-label>{{ card.name }}</q-item-label>
              <q-item-label caption>
                {{ card.setName }} · #{{ card.collectorNumber }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <p v-else>No matching cards found. Try another name.</p>
      </template>
    </AddCardDialog>
  </section>
</template>