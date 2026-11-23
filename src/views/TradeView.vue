<script setup>
import { computed, ref, watch } from 'vue'
import { getBinders } from '../services/binders.js'
import { getCollectionEntries } from '../services/collection.js'
import { useAuthStore } from '@/stores/auth.js'
import { useTradeConfirmation } from '../composables/useTradeConfirmation.js'
import { copiesFromBinder, useTradeDraft } from '../composables/useTradeDraft.js'
import { useTradePrices } from '../composables/useTradePrices.js'
import ReceivingCardDialog from '../components/trade/ReceivingCardDialog.vue'
import TradeReviewDialog from '../components/trade/TradeReviewDialog.vue'
import TradeHistory from '../components/trade/TradeHistory.vue'

/** @typedef {import('../composables/useTradeDraft.js').TradeOption} TradeOption */

const authStore = useAuthStore()
/** @type {import('vue').Ref<TradeOption[]>} */
const owned = ref([])
const {
  giving,
  totalCopies,
  addCard,
  changeQuantity,
  removeCard,
  clearDraft,
  receiving,
  totalReceivedCopies,
  addReceivedCard,
  removeReceivedCard,
} = useTradeDraft()
const loading = ref(false)
const loadError = ref('')
const pickerOpen = ref(false)
const receivingOpen = ref(false)
const reviewOpen = ref(false)
const activeTab = ref('compare')
const tradeSaved = ref(false)
const receivingError = ref('')
const search = ref('')
const incomingPrintings = computed(() =>
  receiving.value.map(({ card, finish, quantity }) => ({
    printingId: card.scryfallId,
    finish,
    quantity,
  })),
)
const {
  loading: pricingLoading,
  error: pricingError,
  unitPriceMinor,
  givingEstimate,
  receivingEstimate,
  differenceMinor,
  retry: retryPrices,
} = useTradePrices(giving, incomingPrintings)
const {
  saving: savingTrade,
  saveError: tradeSaveError,
  retryRequired,
  confirm,
  reset: resetTradeConfirmation,
} = useTradeConfirmation(unitPriceMinor)

const usd = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
const comparison = computed(() => {
  if (pricingLoading.value) return 'Loading market prices…'
  if (pricingError.value) return pricingError.value
  if (!giving.value.length || !receiving.value.length) return 'Add cards to both sides to compare.'

  const difference = differenceMinor.value
  if (givingEstimate.value.missing || receivingEstimate.value.missing) {
    return 'Value difference unavailable because some prices are missing.'
  }
  if (difference === null) return 'Value difference is too large to display.'
  if (difference === 0) return 'Both sides have the same estimated value.'

  const side = difference > 0 ? 'Receiving' : 'Giving'
  return `${side} is worth ${usd.format(Math.abs(difference) / 100)} more.`
})

function formatUnitPrice(printingId, finish) {
  const price = unitPriceMinor(printingId, finish)
  return price === null ? 'Price unavailable' : `${usd.format(price / 100)} each`
}

function formatEstimate({ totalMinor, missing }, lineCount) {
  if (pricingLoading.value) return 'Loading…'
  if (pricingError.value || missing === lineCount) return 'Unavailable'
  if (totalMinor === null) return 'Too large to display'

  const total = usd.format(totalMinor / 100)
  return missing ? `${total} for priced cards only` : total
}

const reviewSides = computed(() => [
  {
    label: 'You give',
    lines: giving.value.map((line) => ({
      ...line,
      binderQuantity: copiesFromBinder(line),
    })),
    total: formatEstimate(givingEstimate.value, giving.value.length),
  },
  {
    label: 'You receive',
    lines: receiving.value.map(({ id, card, condition, finish, quantity }) => ({
      id,
      name: card.name,
      details: `${card.setName} · #${card.collectorNumber} · ${condition} · ${finish}`,
      quantity,
    })),
    total: formatEstimate(receivingEstimate.value, receiving.value.length),
  },
])

const matchingCards = computed(() => {
  const query = search.value.trim().toLowerCase()
  const selectedIds = new Set(giving.value.map(({ id }) => id))

  return owned.value.filter((card) => {
    const text = `${card.name} ${card.details} ${card.binderName ?? ''}`.toLowerCase()
    return !selectedIds.has(card.id) && text.includes(query)
  })
})

/**
 * Loads loose copies and binder sources for entries marked available for trade.
 * Applies results only while the request's account is still signed in.
 * @returns {Promise<void>}
 */
async function loadOwned() {
  const userId = authStore.user?.uid
  loadError.value = ''
  loading.value = Boolean(userId)

  if (!userId) return

  try {
    const [records, binders] = await Promise.all([getCollectionEntries(userId), getBinders(userId)])

    if (authStore.user?.uid !== userId) return

    const binderNames = new Map(binders.map(({ id, binder }) => [id, binder.name]))

    owned.value = records
      .flatMap(({ id, entry }) => {
        const unassigned = entry.unassignedQuantity
        const option = {
          id,
          name: entry.card.name,
          details: `${entry.card.setName} · #${entry.card.collectorNumber} · ${entry.condition} · ${entry.finish}`,
          printingId: entry.card.scryfallId,
          condition: entry.condition,
          finish: entry.finish,
          imageUrl: entry.card.imageUrl,
          available: unassigned,
          unassigned,
        }
        /** @type {TradeOption[]} */
        const options = unassigned ? [option] : []

        if (entry.availableForTrade) {
          for (const [binderId, quantity] of Object.entries(entry.binderQuantities)) {
            const binderName = binderNames.get(binderId)
            if (binderName) {
              options.push({ ...option, binderId, binderName, available: unassigned + quantity })
            }
          }
        }

        return options
      })
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

function handleReceiveCard({ card, details }) {
  receivingError.value = ''

  try {
    addReceivedCard(card, details)
    receivingOpen.value = false
  } catch (error) {
    receivingError.value =
      error instanceof TypeError ? error.message : 'Could not add the card. Please try again.'
  }
}

async function confirmTrade() {
  const userId = authStore.user?.uid
  if (savingTrade.value || !userId || !giving.value.length || !receiving.value.length) return

  tradeSaved.value = false
  const result = await confirm(userId, { giving: giving.value, receiving: receiving.value })
  if (authStore.user?.uid !== userId) return

  if (result === 'saved') {
    reviewOpen.value = false
    clearDraft()
    tradeSaved.value = true
  }

  if (result === 'saved' || result === 'conflict') void loadOwned()
}

watch(
  () => authStore.user?.uid,
  () => {
    activeTab.value = 'compare'
    owned.value = []
    clearDraft()
    pickerOpen.value = false
    receivingOpen.value = false
    reviewOpen.value = false
    receivingError.value = ''
    resetTradeConfirmation()
    tradeSaved.value = false
    void loadOwned()
  },
  { immediate: true },
)
</script>

<template>
  <section>
    <h1 class="text-h4 text-weight-bold q-mt-none q-mb-md">Trade</h1>
    <q-banner v-if="tradeSaved" class="bg-green-1 text-positive q-mb-md" role="status">
      Trade completed. Your inventory was updated.
    </q-banner>
    <q-tabs
      v-model="activeTab"
      inline-label
      active-color="primary"
      no-caps
      aria-label="Trade views"
      class="trade-tabs q-mb-md"
    >
      <q-tab name="compare" label="Compare" icon="swap_horiz" />
      <q-tab name="history" label="History" icon="history" />
    </q-tabs>

    <template v-if="activeTab === 'compare'">
      <div class="trade-panels">
        <section class="trade-panel" aria-labelledby="trade-giving-heading">
          <div class="trade-panel-header">
            <h2 id="trade-giving-heading" class="text-h6 q-ma-none">
              You give
              <span v-if="totalCopies" class="trade-copy-count text-body2 text-grey-8">
                {{ totalCopies }} {{ totalCopies === 1 ? 'copy' : 'copies' }}
              </span>
            </h2>
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="Add card"
              aria-label="Add card from collection"
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
            No copies are eligible. Mark a card Available for trade to offer copies from a binder.
          </p>
          <p v-else-if="!giving.length">
            Choose cards from your collection to start a trade draft.
          </p>

          <q-list v-else separator>
            <q-item v-for="card in giving" :key="card.id" class="items-center">
              <q-item-section v-if="card.imageUrl" avatar class="trade-thumbnail">
                <q-img :src="card.imageUrl" alt="" loading="lazy" :ratio="5 / 7" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ card.name }}</q-item-label>
                <q-item-label caption>{{ card.details }}</q-item-label>
                <q-item-label caption>{{ card.available }} available</q-item-label>
                <q-item-label v-if="copiesFromBinder(card)" caption>
                  {{ copiesFromBinder(card) }} from {{ card.binderName }}
                </q-item-label>
                <q-item-label v-if="!pricingLoading && !pricingError" caption>
                  {{ formatUnitPrice(card.printingId, card.finish) }}
                </q-item-label>
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
                    @click="changeQuantity(card.id, -1)"
                  />
                  <span class="q-px-xs" aria-live="polite">{{ card.quantity }}</span>
                  <q-btn
                    flat
                    round
                    dense
                    icon="add"
                    :aria-label="`Give one more copy of ${card.name}`"
                    :disable="card.quantity >= card.available"
                    @click="changeQuantity(card.id, 1)"
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
          <div v-if="giving.length" class="trade-panel-total">
            <span>Estimated total</span>
            <strong>{{ formatEstimate(givingEstimate, giving.length) }}</strong>
          </div>
        </section>

        <section class="trade-panel" aria-labelledby="trade-receiving-heading">
          <div class="trade-panel-header">
            <h2 id="trade-receiving-heading" class="text-h6 q-ma-none">
              You receive
              <span v-if="totalReceivedCopies" class="trade-copy-count text-body2 text-grey-8">
                {{ totalReceivedCopies }} {{ totalReceivedCopies === 1 ? 'copy' : 'copies' }}
              </span>
            </h2>

            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="Add card"
              aria-label="Add card to receive"
              @click="receivingOpen = true"
            />
          </div>

          <p v-if="!receiving.length">Add the cards you expect to receive.</p>

          <q-list v-else separator>
            <q-item v-for="line in receiving" :key="line.id" class="items-center">
              <q-item-section v-if="line.card.imageUrl" avatar class="trade-thumbnail">
                <q-img :src="line.card.imageUrl" alt="" loading="lazy" :ratio="5 / 7" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ line.card.name }}</q-item-label>
                <q-item-label caption>
                  {{ line.card.setName }} · #{{ line.card.collectorNumber }} ·
                  {{ line.condition }} ·
                  {{ line.finish }}
                </q-item-label>
                <q-item-label v-if="!pricingLoading && !pricingError" caption>
                  {{ formatUnitPrice(line.card.scryfallId, line.finish) }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row no-wrap items-center q-gutter-x-sm">
                  <span>×{{ line.quantity }}</span>
                  <q-btn
                    flat
                    round
                    dense
                    icon="close"
                    :aria-label="`Remove ${line.card.name}, ${line.condition}, ${line.finish}, from Receiving`"
                    @click="removeReceivedCard(line.id)"
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-if="receiving.length" class="trade-panel-total">
            <span>Estimated total</span>
            <strong>{{ formatEstimate(receivingEstimate, receiving.length) }}</strong>
          </div>
        </section>
      </div>

      <section
        v-if="giving.length || receiving.length"
        class="trade-comparison"
        aria-labelledby="trade-comparison-heading"
      >
        <h2 id="trade-comparison-heading" class="text-subtitle1 text-weight-bold q-ma-none">
          Value difference
        </h2>
        <p class="q-mb-xs" role="status">{{ comparison }}</p>
        <q-btn
          v-if="pricingError"
          flat
          no-caps
          color="primary"
          label="Retry prices"
          @click="retryPrices"
        />
        <p class="text-caption text-grey-8 q-ma-none">
          Scryfall market estimates in USD, before condition adjustments.
        </p>
        <q-btn
          class="q-mt-md"
          unelevated
          no-caps
          color="primary"
          label="Review trade"
          :disable="!giving.length || !receiving.length"
          @click="reviewOpen = true"
        />
      </section>
    </template>

    <TradeHistory
      v-else-if="authStore.user?.uid"
      :key="authStore.user.uid"
      :user-id="authStore.user.uid"
    />
    <TradeReviewDialog
      v-model="reviewOpen"
      :sides="reviewSides"
      :comparison="comparison"
      :saving="savingTrade"
      :retry-required="retryRequired"
      :save-error="tradeSaveError"
      @confirm="confirmTrade"
    />
    <ReceivingCardDialog
      v-model="receivingOpen"
      :error-message="receivingError"
      @clear-error="receivingError = ''"
      @submit="handleReceiveCard"
    />

    <q-dialog v-model="pickerOpen" aria-labelledby="trade-picker-title">
      <q-card class="trade-picker grimoire-dialog grimoire-dialog--scroll grimoire-dialog-sized">
        <q-card-section class="grimoire-dialog__header">
          <q-icon name="collections_bookmark" class="grimoire-dialog__icon" aria-hidden="true" />
          <h2 id="trade-picker-title" class="grimoire-dialog__title grimoire-dialog__heading">
            Choose cards to give
          </h2>
          <q-btn
            v-close-popup
            flat
            round
            dense
            icon="close"
            class="grimoire-dialog__close"
            aria-label="Close picker"
          />
        </q-card-section>
        <q-card-section class="trade-picker-search">
          <q-input
            v-model="search"
            outlined
            dense
            type="search"
            aria-label="Search cards or binders"
            placeholder="Search cards or binders"
          >
            <template #prepend><q-icon name="search" aria-hidden="true" /></template>
          </q-input>
        </q-card-section>
        <q-card-section class="grimoire-dialog__body trade-picker-results">
          <q-list v-if="matchingCards.length" class="trade-picker-list">
            <q-item
              v-for="card in matchingCards"
              :key="JSON.stringify([card.id, card.binderId])"
              class="trade-picker-row items-center"
            >
              <q-item-section avatar class="trade-picker-thumbnail">
                <q-img
                  v-if="card.imageUrl"
                  :src="card.imageUrl"
                  :ratio="5 / 7"
                  alt=""
                  loading="lazy"
                />
                <q-icon v-else name="style" aria-hidden="true" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-bold">{{ card.name }}</q-item-label>
                <q-item-label caption>{{ card.details }}</q-item-label>
                <div class="trade-picker-metadata">
                  <span class="trade-picker-source">
                    <q-icon :name="card.binderName ? 'book' : 'style'" aria-hidden="true" />
                    {{ card.binderName ?? 'Loose copies' }}
                  </span>
                  <span>{{ card.available }} available</span>
                </div>
                <q-item-label v-if="card.binderName && card.unassigned" caption>
                  Uses loose copies first
                </q-item-label>
              </q-item-section>
              <q-item-section side class="trade-picker-action">
                <q-btn
                  unelevated
                  no-caps
                  icon="add"
                  class="trade-picker-add"
                  label="Add"
                  :aria-label="`Add ${card.name}, ${card.details}, from ${card.binderName ?? 'loose copies'}`"
                  @click="addCard(card)"
                />
              </q-item-section>
            </q-item>
          </q-list>
          <p v-else class="trade-picker-empty q-ma-none" role="status">
            {{
              search.trim()
                ? 'No remaining cards match your search.'
                : 'All eligible entries are in the draft.'
            }}
          </p>
        </q-card-section>
        <q-card-actions align="between" class="grimoire-dialog__footer">
          <span class="trade-picker-count" aria-live="polite">
            {{ totalCopies }} {{ totalCopies === 1 ? 'copy' : 'copies' }} selected
          </span>
          <q-btn v-close-popup unelevated no-caps color="primary" label="Done" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped>
.trade-tabs {
  width: fit-content;
  padding: 0.25rem;
  border: 1px solid var(--surface-border);
  border-radius: 0.875rem;
  background: #fff;
}

.trade-tabs :deep(.q-tab) {
  min-height: 2.5rem;
  border-radius: 0.625rem;
}

.trade-tabs :deep(.q-tab--active) {
  background: #e9efff;
}

.trade-tabs :deep(.q-tab__indicator) {
  display: none;
}

@media (max-width: 640px) {
  .trade-tabs {
    width: 100%;
  }

  .trade-tabs :deep(.q-tab) {
    flex: 1;
  }
}

.trade-picker-search {
  flex: 0 0 auto;
  padding: 0.875rem 1.125rem 0.25rem;
}

.trade-picker-results {
  padding-top: 0.625rem;
}

.trade-picker-list {
  display: grid;
  gap: 0.5rem;
}

.trade-picker-row {
  padding: 0.625rem;
  border: 1px solid var(--dialog-line);
  border-radius: 0.75rem;
  overflow-wrap: anywhere;
}

.trade-picker-thumbnail {
  width: 3rem;
  min-width: 0;
  padding-right: 0.625rem;
}

.trade-picker-thumbnail :deep(.q-img) {
  border-radius: 0.25rem;
}

.trade-picker-thumbnail :deep(.q-icon) {
  display: grid;
  width: 100%;
  height: 3rem;
  place-items: center;
  border-radius: 0.375rem;
  background: var(--dialog-tint);
  color: var(--q-primary);
}

.trade-picker-metadata {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5rem;
  margin-top: 0.375rem;
  color: var(--dialog-muted);
  font-size: 0.75rem;
}

.trade-picker-source {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.375rem;
  background: var(--dialog-tint);
  color: var(--dialog-ink);
}

.trade-picker-action {
  padding-left: 0.5rem;
}

.trade-picker-add {
  min-height: 2.5rem;
  padding-inline: 0.625rem;
  border-radius: 0.625rem;
  background: var(--dialog-accent);
  color: var(--q-primary);
  font-weight: 600;
}

.trade-picker-count,
.trade-picker-empty {
  color: var(--dialog-muted);
  font-size: 0.875rem;
}

.trade-picker-empty {
  padding: 0.875rem 0.625rem;
  border: 1px dashed var(--dialog-line);
  border-radius: 0.625rem;
  text-align: center;
}

@media (max-width: 767.98px) {
  .trade-picker-search {
    padding-inline: 0.875rem;
  }

  .trade-picker-thumbnail {
    width: 2.375rem;
    padding-right: 0.5rem;
  }
}

@media (max-width: 360px) {
  .trade-picker-thumbnail {
    display: none;
  }
}

.trade-panels {
  display: grid;
  gap: 1rem;
}

.trade-panel,
.trade-comparison {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 0.75rem;
  background: #fff;
}

.trade-panel {
  display: flex;
  flex-direction: column;
}

.trade-panel-header,
.trade-panel-total {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.trade-panel-header {
  margin-bottom: 0.75rem;
}

.trade-copy-count {
  display: block;
}

@media (min-width: 380px) {
  .trade-copy-count {
    display: inline;
  }

  .trade-copy-count::before {
    content: '· ';
  }
}

.trade-panel-total {
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--surface-border);
}

.trade-panel :deep(.q-item) {
  padding-inline: 0;
  overflow-wrap: anywhere;
}

.trade-thumbnail {
  min-width: 0;
  width: 3rem;
  padding-right: 0.625rem;
}

.trade-comparison {
  margin-top: 1rem;
}

@media (min-width: 960px) {
  .trade-panels {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
