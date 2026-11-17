<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import {
  createCollectionEntry,
  deleteCollectionEntry,
  getCollectionEntries,
  updateCollectionEntry,
} from '../services/collection.js'
import { CardFactory } from '../factories/CardFactory.js'
import AddCardDialog from '../components/cards/AddCardDialog.vue'
import { getCardPrintings, searchCards } from '../services/scryfall'
import CardPrintingPicker from '../components/cards/CardPrintingPicker.vue'
import CollectionEntryForm from '../components/cards/CollectionEntryForm.vue'

const authStore = useAuthStore()
const saving = ref(false)
const saveError = ref('')
const successMessage = ref('')
const dialogOpen = ref(false)
const loading = ref(false)
const cards = ref([])
const errorMessage = ref('')
const searched = ref(false)
const hasMore = ref(false)
const selectedCard = ref(null)
const printings = ref([])
const printingsPage = ref(0)
const printingsHaveMore = ref(false)
const selectedPrinting = ref(null)
const collectionEntries = ref([])
const collectionLoading = ref(false)
const collectionError = ref('')
const editingEntry = ref(null)
const editDialogOpen = ref(false)
const deletingEntry = ref(null)
const deleteDialogOpen = ref(false)
const deleting = ref(false)
const deleteError = ref('')

let collectionRequestId = 0
let activeRequest = null

/**
 * Loads saved entries for the current user.
 * Ignores results from superseded requests or previous sessions.
 * @returns {Promise<void>}
 */
async function loadCollection() {
  const requestId = ++collectionRequestId
  const userId = authStore.user?.uid

  collectionError.value = ''

  if (!userId) {
    collectionEntries.value = []
    collectionLoading.value = false
    return
  }

  collectionLoading.value = true

  try {
    const entries = await getCollectionEntries(userId)

    if (requestId !== collectionRequestId || authStore.user?.uid !== userId) return

    collectionEntries.value = entries
  } catch {
    if (requestId !== collectionRequestId || authStore.user?.uid !== userId) return

    collectionError.value = 'Unable to load your collection. Please try again.'
  } finally {
    if (requestId === collectionRequestId) {
      collectionLoading.value = false
    }
  }
}

/**
 * Saves validated ownership details for the signed-in user.
 * @param {import('../models/CollectionEntry.js').CollectionEntry} entry Entry to save.
 * @returns {Promise<void>}
 */
async function saveEntry(entry) {
  if (saving.value) return

  saveError.value = ''
  successMessage.value = ''
  const userId = authStore.user?.uid

  if (!userId) {
    saveError.value = 'Please sign in again before saving your collection.'
    return
  }

  saving.value = true

  try {
    await createCollectionEntry(userId, entry)
    successMessage.value = `${entry.card.name} was added to your collection.`
    dialogOpen.value = false
    await loadCollection()
  } catch (error) {
    saveError.value =
      error.code === 'permission-denied'
        ? 'Saving was denied. Check that you are signed in and the Firestore rules are published.'
        : 'Unable to save this entry. Your details are still here; please try again.'
  } finally {
    saving.value = false
  }
}

/**
 * Saves ownership changes to the entry being edited.
 * @param {import('../models/CollectionEntry.js').CollectionEntry} entry Updated details.
 * @returns {Promise<void>}
 */
async function saveEditedEntry(entry) {
  if (saving.value || !editingEntry.value) return

  saveError.value = ''
  successMessage.value = ''

  const userId = authStore.user?.uid
  const entryId = editingEntry.value.id

  if (!userId) {
    saveError.value = 'Please sign in again before saving your changes.'
    return
  }

  saving.value = true

  try {
    await updateCollectionEntry(userId, entryId, entry)

    successMessage.value = `${entry.card.name} was updated.`
    editDialogOpen.value = false
    await loadCollection()
  } catch (error) {
    saveError.value =
      error.code === 'permission-denied'
        ? 'Updating was denied. Check that the latest Firestore rules are published.'
        : 'Unable to save your changes. Your details are still here; please try again.'
  } finally {
    saving.value = false
  }
}

/**
 * Loads the next page of printings for the selected card.
 * @returns {Promise<void>}
 */
async function loadPrintings() {
  if (loading.value || !selectedCard.value?.oracleId) return

  const controller = new AbortController()
  const nextPage = printingsPage.value + 1
  activeRequest = controller

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await getCardPrintings(selectedCard.value.oracleId, {
      page: nextPage,
      signal: controller.signal,
    })

    if (activeRequest !== controller) return

    printings.value = [...printings.value, ...result.cards]
    printingsPage.value = nextPage
    printingsHaveMore.value = result.hasMore
  } catch (error) {
    if (activeRequest !== controller || error.name === 'AbortError') return

    errorMessage.value = 'Unable to load printings. Please try again.'
  } finally {
    if (activeRequest === controller) {
      loading.value = false
      activeRequest = null
    }
  }
}

/**
 * Opens the available printings for a search result.
 * @param {import('../models/Card').Card} card Selected search result.
 * @returns {Promise<void>}
 */
async function selectCard(card) {
  cancelSearch()

  selectedCard.value = card
  selectedPrinting.value = null
  printings.value = []
  printingsPage.value = 0
  printingsHaveMore.value = false
  errorMessage.value = ''

  if (!card.oracleId) {
    errorMessage.value = 'This card does not have an Oracle ID to look up its printings.'
    return
  }

  await loadPrintings()
}

/**
 * Searches Scryfall and displays the first page of results.
 * @param {string} query Submitted search text.
 * @returns {Promise<void>}
 */
async function handleSearch(query) {
  if (loading.value || saving.value) return

  selectedCard.value = null
  selectedPrinting.value = null

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
 * Returns to the existing search results without fetching them again.
 * @returns {void}
 */
function backToResults() {
  cancelSearch()
  selectedCard.value = null
  selectedPrinting.value = null
  errorMessage.value = ''
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

/**
 * Prepares a saved collection entry for editing.
 * @param {Object} entry Saved entry, including its document ID.
 * @returns {void}
 */
function openEditDialog(entry) {
  if (saving.value || deleting.value) return

  const card = CardFactory.fromStoredData(entry.card)

  editingEntry.value = { ...entry, card }
  saveError.value = ''
  successMessage.value = ''
  editDialogOpen.value = true
}

/**
 * Opens confirmation for deleting an entire collection entry.
 * @param {Object} entry Saved entry to delete.
 * @returns {void}
 */
function openDeleteDialog(entry) {
  if (saving.value || deleting.value) return

  deletingEntry.value = entry
  deleteError.value = ''
  successMessage.value = ''
  deleteDialogOpen.value = true
}

/**
 * Deletes the confirmed entry and refreshes the collection.
 * @returns {Promise<void>}
 */
async function confirmDelete() {
  if (deleting.value || !deletingEntry.value) return

  deleteError.value = ''

  const userId = authStore.user?.uid
  const entry = deletingEntry.value

  if (!userId) {
    deleteError.value = 'Please sign in again before deleting an entry.'
    return
  }

  deleting.value = true

  try {
    await deleteCollectionEntry(userId, entry.id)

    successMessage.value = `${entry.card.name} was removed from your collection.`
    deleteDialogOpen.value = false
    await loadCollection()
  } catch (error) {
    deleteError.value =
      error.code === 'permission-denied'
        ? 'Deletion was denied. Check that the latest Firestore rules are published.'
        : 'Unable to delete this entry. Please try again.'
  } finally {
    deleting.value = false
  }
}

watch(
  () => authStore.user?.uid,
  () => {
    collectionEntries.value = []
    successMessage.value = ''
    void loadCollection()
  },
  { immediate: true },
)

watch(selectedPrinting, () => {
  saveError.value = ''
})

watch(dialogOpen, (isOpen) => {
  if (!isOpen) {
    backToResults()
  }
})

watch(editDialogOpen, (isOpen) => {
  if (!isOpen) {
    editingEntry.value = null
    saveError.value = ''
  }
})

watch(deleteDialogOpen, (isOpen) => {
  if (!isOpen) {
    deletingEntry.value = null
    deleteError.value = ''
  }
})

onUnmounted(() => {
  cancelSearch()
  collectionRequestId += 1
})
</script>

<template>
  <section>
    <h1 class="text-h4 text-weight-bold q-mt-none q-mb-sm">My Collection</h1>

    <p>Browse and manage every card in your collection.</p>

    <q-btn color="primary" icon="add" label="Add card" no-caps @click="dialogOpen = true" />

    <q-banner
      v-if="successMessage"
      class="bg-green-1 text-positive rounded-borders q-mt-md"
      role="status"
    >
      {{ successMessage }}
    </q-banner>
    <div class="q-mt-lg" :aria-busy="collectionLoading">
      <div v-if="collectionLoading" role="status" aria-label="Loading collection">
        <q-skeleton v-for="item in 3" :key="item" type="rect" height="88px" class="q-mb-sm" />
      </div>

      <q-banner
        v-else-if="collectionError"
        class="bg-red-1 text-negative rounded-borders"
        role="alert"
      >
        {{ collectionError }}

        <template #action>
          <q-btn flat no-caps label="Retry" @click="loadCollection" />
        </template>
      </q-banner>

      <q-list v-else-if="collectionEntries.length" bordered separator>
        <q-item v-for="entry in collectionEntries" :key="entry.id">
          <q-item-section avatar>
            <q-img
              v-if="entry.card.imageUrl"
              :src="entry.card.imageUrl"
              alt=""
              width="48px"
              :ratio="5 / 7"
            />
            <q-icon v-else name="image_not_supported" size="32px" />
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ entry.card.name }}</q-item-label>

            <q-item-label caption>
              {{ entry.card.setName }} · #{{ entry.card.collectorNumber }}
            </q-item-label>

            <q-item-label caption> {{ entry.condition }} · {{ entry.finish }} </q-item-label>

            <q-item-label v-if="entry.favorite || entry.availableForTrade" caption>
              <span v-if="entry.favorite">Favorite</span>
              <span v-if="entry.favorite && entry.availableForTrade"> · </span>
              <span v-if="entry.availableForTrade">Available for trade</span>
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-badge color="primary" :label="`Qty: ${entry.quantity}`" />

            <q-btn
              flat
              no-caps
              color="primary"
              label="Edit"
              class="q-mt-sm"
              :aria-label="`Edit ${entry.card.name}`"
              :disable="saving || deleting"
              @click="openEditDialog(entry)"
            />

            <q-btn
              flat
              no-caps
              color="negative"
              label="Delete"
              :aria-label="`Delete ${entry.card.name}`"
              :disable="saving || deleting"
              @click="openDeleteDialog(entry)"
            />
          </q-item-section>
        </q-item>
      </q-list>

      <p v-else role="status">Your collection is empty. Add a card to get started.</p>
    </div>
    <AddCardDialog
      v-model="dialogOpen"
      :loading="loading"
      :saving="saving"
      :show-search="!selectedPrinting"
      @search="handleSearch"
    >
      <CollectionEntryForm
        v-if="selectedPrinting"
        :key="selectedPrinting.scryfallId"
        :card="selectedPrinting"
        :saving="saving"
        :save-error="saveError"
        @submit="saveEntry"
        @cancel="selectedPrinting = null"
      />

      <template v-else-if="selectedCard">
        <q-btn
          flat
          no-caps
          icon="arrow_back"
          label="Back to results"
          class="q-mb-md"
          @click="backToResults"
        />

        <h2 class="text-h6 q-mt-none q-mb-md">Choose a printing of {{ selectedCard.name }}</h2>

        <q-banner
          v-if="errorMessage"
          class="bg-red-1 text-negative rounded-borders q-mb-md"
          role="alert"
        >
          {{ errorMessage }}

          <template #action>
            <q-btn
              v-if="selectedCard.oracleId"
              flat
              no-caps
              label="Retry"
              :disable="loading"
              @click="loadPrintings"
            />
          </template>
        </q-banner>

        <CardPrintingPicker
          v-if="!errorMessage || printings.length"
          :printings="printings"
          :loading="loading"
          :has-more="printingsHaveMore"
          @select="selectedPrinting = $event"
          @load-more="loadPrintings"
        />
      </template>

      <div v-else-if="loading" role="status" aria-label="Searching cards">
        <q-skeleton v-for="item in 3" :key="item" type="rect" height="64px" class="q-mb-sm" />
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
          <span v-if="hasMore"> More matches are available. Refine your search for now. </span>
        </p>

        <q-list v-if="cards.length" bordered separator>
          <q-item v-for="card in cards" :key="card.scryfallId" clickable @click="selectCard(card)">
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

    <q-dialog v-model="editDialogOpen" :persistent="saving" aria-labelledby="edit-entry-title">
      <q-card class="edit-entry-dialog">
        <q-card-section class="row items-center">
          <h2 id="edit-entry-title" class="text-h6 q-ma-none">Edit collection entry</h2>

          <q-space />

          <q-btn
            v-close-popup
            flat
            round
            dense
            icon="close"
            aria-label="Close edit dialog"
            :disable="saving"
          />
        </q-card-section>

        <q-separator />

        <q-card-section>
          <CollectionEntryForm
            v-if="editingEntry"
            :key="editingEntry.id"
            :card="editingEntry.card"
            :initial-entry="editingEntry"
            :saving="saving"
            :save-error="saveError"
            @submit="saveEditedEntry"
            @cancel="editDialogOpen = false"
          />
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog
      v-model="deleteDialogOpen"
      :persistent="deleting"
      aria-labelledby="delete-entry-title"
      aria-describedby="delete-entry-description"
    >
      <q-card class="delete-entry-dialog">
        <q-card-section>
          <h2 id="delete-entry-title" class="text-h6 q-ma-none">Delete collection entry?</h2>
        </q-card-section>

        <q-card-section v-if="deletingEntry">
          <p id="delete-entry-description">
            Remove all {{ deletingEntry.quantity }} owned copies of
            <strong>{{ deletingEntry.card.name }}</strong>
            in this entry?
          </p>

          <p class="text-grey-7">
            {{ deletingEntry.card.setName }} · #{{ deletingEntry.card.collectorNumber }} ·
            {{ deletingEntry.condition }} · {{ deletingEntry.finish }}
          </p>

          <p class="q-mb-none">
            This cannot be undone. To remove only some copies, cancel and edit the quantity instead.
          </p>

          <q-banner
            v-if="deleteError"
            class="bg-red-1 text-negative rounded-borders q-mt-md"
            role="alert"
          >
            {{ deleteError }}
          </q-banner>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            flat
            no-caps
            label="Cancel"
            autofocus
            :disable="deleting"
            @click="deleteDialogOpen = false"
          />

          <q-btn
            no-caps
            color="negative"
            label="Delete entry"
            :loading="deleting"
            :disable="deleting"
            @click="confirmDelete"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped lang="scss">
.edit-entry-dialog {
  width: 40rem;
  max-width: calc(100vw - 2rem);
}

.delete-entry-dialog {
  width: 32rem;
  max-width: calc(100vw - 2rem);
}
</style>
