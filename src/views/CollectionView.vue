<script setup>
import { computed, markRaw, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import {
  createCollectionEntry,
  deleteCollectionEntry,
  getCollectionEntries,
  updateCollectionEntry,
} from '../services/collection.js'
import AddCardDialog from '../components/cards/AddCardDialog.vue'
import BinderAssignmentDialog from '../components/cards/BinderAssignmentDialog.vue'
import CardActionsDialog from '../components/cards/CardActionsDialog.vue'
import { useCardLookup } from '../composables/useCardLookup.js'
import CardPrintingPicker from '../components/cards/CardPrintingPicker.vue'
import InventoryForm from '../components/cards/InventoryForm.vue'
import DialogFrame from '../components/layout/DialogFrame.vue'
import ResponsiveAddButton from '../components/layout/ResponsiveAddButton.vue'

/** @typedef {import('../services/collection.js').CollectionRecord} CollectionRecord */

const authStore = useAuthStore()
const saving = ref(false)
const saveError = ref('')
const successMessage = ref('')
const dialogOpen = ref(false)
const selectedPrinting = ref(null)
/** @type {import('vue').Ref<CollectionRecord[]>} */
const inventory = ref([])
const collectionSearch = ref('')
const collectionSort = ref('name-asc')
const collectionLoading = ref(false)
const collectionError = ref('')
const editingEntry = ref(null)
const editDialogOpen = ref(false)
const deletingEntry = ref(null)
const deleteDialogOpen = ref(false)
const deleting = ref(false)
const deleteError = ref('')
const binderDialogOpen = ref(false)
const binderEntry = ref(/** @type {CollectionRecord | null} */ (null))
const binderSaving = ref(false)
const cardActionsOpen = ref(false)
const cardActionsRecord = shallowRef(null)
const showCardDetails = ref(false)
const preferredActionRecordId = ref(null)
const returnToPrinting = ref(null)

let collectionRequestId = 0

const {
  loading,
  cards,
  errorMessage,
  searched,
  hasMore,
  selectedCard,
  printings,
  printingsHaveMore,
  searchByName,
  selectCard,
  loadPrintings,
  backToSearchResults,
  cancelSearch,
} = useCardLookup()

const collectionSortOptions = [
  { label: 'Name: A–Z', value: 'name-asc' },
  { label: 'Name: Z–A', value: 'name-desc' },
]
const cardNameOrder = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

const addCardStep = computed(() => {
  if (returnToPrinting.value && selectedPrinting.value) return 'variant'
  if (selectedPrinting.value) return 'details'
  return selectedCard.value ? 'printing' : 'search'
})

/** Groups display rows by printing while keeping the individual records for edits. */
const inventoryByPrinting = computed(() => {
  const groups = new Map()

  for (const record of inventory.value) {
    const { card, condition, finish, quantity } = record.entry
    if (!groups.has(card.scryfallId)) {
      groups.set(card.scryfallId, {
        card,
        records: [],
        copies: 0,
        variants: new Set(),
        favorite: false,
        availableForTrade: false,
      })
    }

    const group = groups.get(card.scryfallId)
    group.records.push(record)
    group.copies += quantity
    group.variants.add(JSON.stringify([condition, finish]))
    group.favorite ||= record.entry.favorite
    group.availableForTrade ||= record.entry.availableForTrade
  }

  return groups
})

const visibleInventory = computed(() => {
  const search = (collectionSearch.value ?? '').trim().toLocaleLowerCase()
  const direction = collectionSort.value === 'name-desc' ? -1 : 1

  return Array.from(inventoryByPrinting.value.values())
    .filter(({ card }) => card.name.toLocaleLowerCase().includes(search))
    .sort((a, b) => direction * cardNameOrder.compare(a.card.name, b.card.name))
})

const cardDialogGroup = computed(() =>
  inventoryByPrinting.value.get(cardActionsRecord.value?.entry.card.scryfallId),
)

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
    inventory.value = []
    collectionLoading.value = false
    return
  }

  collectionLoading.value = true

  try {
    const entries = await getCollectionEntries(userId)

    if (requestId !== collectionRequestId || authStore.user?.uid !== userId) return

    // Private model fields must not be accessed through Vue proxies.
    // Displayed models are replaced on reload; edits use independent working copies.
    inventory.value = entries.map((record) => ({
      ...record,
      entry: markRaw(record.entry),
    }))
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
 * @param {import('../models/Inventory.js').Inventory} entry Entry to save.
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
    await loadCollection()
    dialogOpen.value = false
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
 * @param {import('../models/Inventory.js').Inventory} entry Updated details.
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

/** Starts a new lookup while the Add Card form is idle. */
async function handleSearch(query) {
  if (loading.value || saving.value) return

  selectedPrinting.value = null
  await searchByName(query)
}

/** Drops the form selection and returns to the existing search results. */
function backToResults() {
  selectedPrinting.value = null
  backToSearchResults()
}

/**
 * Opens the printing overview or the action menu for its saved entries.
 * @param {import('../services/collection.js').CollectionRecord} record Saved inventory entry.
 * @param {'actions' | 'details'} [mode='actions'] Initial view shown in the dialog.
 * @param {string | null} [preferredRecordId=null] Variant to preselect in the action menu.
 */
function openCardDialog(record, mode = 'actions', preferredRecordId = null) {
  cardActionsRecord.value = record
  showCardDetails.value = mode === 'details'
  preferredActionRecordId.value = preferredRecordId
  cardActionsOpen.value = true
}

/**
 * Opens the next dialog after the card dialog finishes closing.
 * @param {{ action: 'edit' | 'binder' | 'delete' | 'actions' | 'add', recordId: string | null } | null} choice
 *   The action and optional variant ID, or null if dismissed.
 */
function handleCardAction(choice) {
  const group = cardDialogGroup.value
  const record = choice?.recordId
    ? group?.records.find(({ id }) => id === choice.recordId)
    : cardActionsRecord.value
  cardActionsRecord.value = null
  if (!choice || !record) return

  if (choice.action === 'edit') openEditDialog(record)
  if (choice.action === 'binder') openBinderDialog(record)
  if (choice.action === 'delete') openDeleteDialog(record)
  if (choice.action === 'actions') openCardDialog(record, 'actions', record.id)
  if (choice.action === 'add') {
    returnToPrinting.value = record.entry.card.scryfallId
    selectedPrinting.value = record.entry.card
    dialogOpen.value = true
  }
}

/** Restores the printing overview when Add another was opened from card details. */
function closeAddCard() {
  const printingId = returnToPrinting.value
  returnToPrinting.value = null
  backToResults()

  const record = inventoryByPrinting.value.get(printingId)?.records[0]
  if (record) openCardDialog(record, 'details')
}

function cancelInventoryForm() {
  if (returnToPrinting.value) dialogOpen.value = false
  else selectedPrinting.value = null
}

/**
 * Prepares a saved collection entry for editing.
 * @param {import('../services/collection.js').CollectionRecord} record Saved model and metadata.
 * @returns {void}
 */
function openEditDialog(record) {
  if (saving.value || deleting.value) return

  editingEntry.value = record
  saveError.value = ''
  successMessage.value = ''
  editDialogOpen.value = true
}

/**
 * Opens the binder assignment dialog for a saved inventory record.
 * @param {CollectionRecord} record Entry to assign.
 */
function openBinderDialog(record) {
  if (!authStore.user?.uid || saving.value || deleting.value || binderSaving.value) return

  binderEntry.value = record
  binderDialogOpen.value = true
}

/** @param {number} quantity Saved assignment count. */
function handleBinderSaved(quantity) {
  successMessage.value = quantity === 0 ? 'Binder assignment removed.' : 'Binder assignment saved.'
  void loadCollection()
}

/**
 * Opens confirmation for deleting an entire collection entry.
 * @param {import('../services/collection.js').CollectionRecord} record Saved model and metadata.
 * @returns {void}
 */
function openDeleteDialog(record) {
  if (saving.value || deleting.value) return

  deletingEntry.value = record
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
  const record = deletingEntry.value

  if (!userId) {
    deleteError.value = 'Please sign in again before deleting an entry.'
    return
  }

  deleting.value = true

  try {
    await deleteCollectionEntry(userId, record.id)

    successMessage.value = `${record.entry.card.name} was removed from your collection.`
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
    inventory.value = []
    collectionSearch.value = ''
    collectionSort.value = 'name-asc'
    binderDialogOpen.value = false
    binderEntry.value = null
    cardActionsOpen.value = false
    cardActionsRecord.value = null
    returnToPrinting.value = null
    successMessage.value = ''
    void loadCollection()
  },
  { immediate: true },
)

watch(selectedPrinting, () => {
  saveError.value = ''
})

watch(dialogOpen, (isOpen) => {
  if (!isOpen) cancelSearch()
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
  collectionRequestId += 1
})
</script>

<template>
  <section>
    <header class="collection-page-header">
      <div>
        <h1 class="text-h4 text-weight-bold q-mt-none q-mb-sm">My Collection</h1>
        <p class="q-mb-none">Browse and manage every card in your collection.</p>
      </div>
      <ResponsiveAddButton label="Add card" @click="dialogOpen = true" />
    </header>

    <q-banner
      v-if="successMessage"
      class="bg-green-1 text-positive rounded-borders q-mt-md"
      role="status"
    >
      {{ successMessage }}
    </q-banner>
    <div class="q-mt-lg" :aria-busy="collectionLoading">
      <div v-if="inventory.length && !collectionError" class="row q-col-gutter-sm q-mb-md">
        <div class="col-12 col-sm-8">
          <q-input v-model="collectionSearch" label="Search cards" type="search" dense outlined>
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
        <div class="col-12 col-sm-4">
          <q-select
            v-model="collectionSort"
            :options="collectionSortOptions"
            label="Sort by"
            dense
            outlined
            popup-content-class="grimoire-options"
            emit-value
            map-options
          />
        </div>
      </div>

      <div
        v-if="collectionLoading"
        class="collection-skeletons"
        role="status"
        aria-label="Loading collection"
      >
        <q-skeleton v-for="item in 5" :key="item" type="rect" height="88px" aria-hidden="true" />
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

      <q-list v-else-if="visibleInventory.length" bordered separator>
        <q-item v-for="group in visibleInventory" :key="group.card.scryfallId">
          <button
            type="button"
            class="collection-card-row"
            aria-haspopup="dialog"
            :aria-label="`View details for ${group.card.name}, ${group.card.setName}, number ${group.card.collectorNumber}`"
            :disabled="saving || deleting || binderSaving"
            @click="openCardDialog(group.records[0], 'details')"
          >
            <img
              v-if="group.card.imageUrl"
              :src="group.card.imageUrl"
              class="collection-card-thumbnail"
              width="48"
              height="67"
              loading="lazy"
              alt=""
            />
            <q-icon v-else name="image_not_supported" size="32px" aria-hidden="true" />

            <span class="collection-card-summary">
              <span class="collection-card-title">{{ group.card.name }}</span>
              <span class="text-caption text-grey-7">
                {{ group.card.setName }} · #{{ group.card.collectorNumber }}
              </span>
              <span v-if="group.variants.size > 1" class="text-caption text-grey-7">
                {{ group.variants.size }} variants
              </span>
              <span v-else class="text-caption text-grey-7">
                {{ group.records[0].entry.condition }} · {{ group.records[0].entry.finish }}
              </span>
              <span
                v-if="group.favorite || group.availableForTrade"
                class="text-caption text-grey-7"
              >
                <span v-if="group.favorite">Favorite</span>
                <span v-if="group.favorite && group.availableForTrade"> · </span>
                <span v-if="group.availableForTrade">Available for trade</span>
              </span>
            </span>
          </button>

          <q-item-section side>
            <div class="row items-center no-wrap q-gutter-x-xs">
              <q-badge color="primary" :label="`Qty: ${group.copies}`" />
              <q-btn
                flat
                round
                dense
                icon="more_vert"
                aria-haspopup="dialog"
                :aria-label="`Actions for ${group.card.name}`"
                :disable="saving || deleting || binderSaving"
                @click="openCardDialog(group.records[0])"
              />
            </div>
          </q-item-section>
        </q-item>
      </q-list>

      <p v-else-if="inventory.length" role="status">No cards match your search.</p>
      <p v-else role="status">Your collection is empty. Add a card to get started.</p>
    </div>
    <CardActionsDialog
      v-model="cardActionsOpen"
      :entry="cardActionsRecord?.entry"
      :records="cardDialogGroup?.records ?? []"
      :copies="cardDialogGroup?.copies ?? 0"
      :variant-count="cardDialogGroup?.variants.size ?? 0"
      :preferred-record-id="preferredActionRecordId"
      :show-details="showCardDetails"
      @closed="handleCardAction"
    />

    <BinderAssignmentDialog
      v-model="binderDialogOpen"
      v-model:saving="binderSaving"
      :record="binderEntry"
      :user-id="authStore.user?.uid ?? ''"
      @saved="handleBinderSaved"
    />
    <AddCardDialog
      v-model="dialogOpen"
      :loading="loading"
      :saving="saving"
      :step="addCardStep"
      @search="handleSearch"
      @hide="closeAddCard"
    >
      <InventoryForm
        v-if="selectedPrinting"
        :key="selectedPrinting.scryfallId"
        :card="selectedPrinting"
        :cancel-label="returnToPrinting ? 'Back to card details' : ''"
        :saving="saving"
        :save-error="saveError"
        @submit="saveEntry"
        @cancel="cancelInventoryForm"
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

        <p class="text-weight-medium q-mb-md">{{ selectedCard.name }}</p>

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

        <q-list v-if="cards.length" class="grimoire-picker-list">
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

    <DialogFrame
      v-model="editDialogOpen"
      :persistent="saving"
      title="Edit collection entry"
      icon="edit"
      width="40rem"
    >
      <InventoryForm
        v-if="editingEntry"
        :key="editingEntry.id"
        :card="editingEntry.entry.card"
        :initial-entry="editingEntry.entry"
        :saving="saving"
        :save-error="saveError"
        @submit="saveEditedEntry"
        @cancel="editDialogOpen = false"
      />
    </DialogFrame>

    <DialogFrame
      v-model="deleteDialogOpen"
      :persistent="deleting"
      title="Delete entry?"
      icon="delete_outline"
      width="28rem"
      danger
      hide-close
      aria-describedby="delete-entry-impact"
    >
      <template v-if="deletingEntry">
        <div class="delete-entry-preview">
          <q-img
            v-if="deletingEntry.entry.card.imageUrl"
            :src="deletingEntry.entry.card.imageUrl"
            :ratio="5 / 7"
            class="delete-entry-thumbnail"
            alt=""
          />
          <div class="delete-entry-printing">
            <strong>{{ deletingEntry.entry.card.name }}</strong>
            <span class="delete-entry-set">
              <span>{{ deletingEntry.entry.card.setName }}</span>
              <span>#{{ deletingEntry.entry.card.collectorNumber }}</span>
            </span>
            <span>
              {{ deletingEntry.entry.condition }} ·
              <span class="text-capitalize">{{ deletingEntry.entry.finish }}</span>
            </span>
          </div>
        </div>

        <p id="delete-entry-impact" class="delete-entry-impact">
          This permanently removes
          <strong>
            {{ deletingEntry.entry.quantity }}
            {{ deletingEntry.entry.quantity === 1 ? 'copy' : 'copies' }}
          </strong>
          from your collection.
          <template v-if="deletingEntry.entry.quantity > 1">
            To remove fewer copies, edit the quantity.
          </template>
        </p>
      </template>

      <q-banner v-if="deleteError" class="bg-red-1 text-negative rounded-borders" role="alert">
        {{ deleteError }}
      </q-banner>

      <template #actions>
        <q-btn
          flat
          no-caps
          label="Cancel"
          autofocus
          :disable="deleting"
          @click="deleteDialogOpen = false"
        />
        <q-btn
          unelevated
          no-caps
          color="negative"
          label="Delete entry"
          :loading="deleting"
          :disable="deleting"
          @click="confirmDelete"
        />
      </template>
    </DialogFrame>
  </section>
</template>

<style scoped lang="scss">
.collection-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.collection-card-row {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  padding: 0.25rem;
  border: 0;
  border-radius: 0.25rem;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;

  &:hover,
  &:focus-visible {
    background-color: color-mix(in srgb, var(--q-primary) 6%, transparent);
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}

.collection-card-thumbnail {
  flex-shrink: 0;
  border-radius: 0.25rem;
  object-fit: contain;
}

.collection-card-summary {
  display: grid;
  min-width: 0;
  overflow-wrap: anywhere;
}

.collection-card-title {
  color: var(--q-primary);
  font-weight: 600;
}

.delete-entry-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--dialog-line);
  border-radius: 0.75rem;
  background: var(--dialog-tint);
}

.delete-entry-thumbnail {
  flex: 0 0 2.75rem;
  width: 2.75rem;
  border-radius: 0.25rem;
}

.delete-entry-printing {
  display: grid;
  gap: 0.125rem;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.8125rem;
  color: var(--dialog-muted);

  strong {
    color: var(--dialog-ink);
    font-size: 1rem;
  }
}

.delete-entry-set {
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.375rem;
}

.delete-entry-impact {
  margin: 0.875rem 0 0;

  &:not(:last-child) {
    margin-bottom: 0.875rem;
  }
}

.collection-skeletons {
  display: grid;
  gap: 0.5rem;

  > :nth-child(n + 4) {
    display: none;
  }

  @media (min-width: 768px) and (min-height: 700px) {
    > :nth-child(4) {
      display: block;
    }
  }

  @media (min-width: 768px) and (min-height: 1000px) {
    > :nth-child(5) {
      display: block;
    }
  }
}
</style>
