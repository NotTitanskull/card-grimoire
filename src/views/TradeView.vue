<script setup>
import { computed, ref, watch } from 'vue'
import { getBinders } from '../services/binders.js'
import { getCollectionEntries } from '../services/collection.js'
import { useAuthStore } from '@/stores/auth.js'
import { useTradeConfirmation } from '../composables/useTradeConfirmation.js'
import { copiesFromBinder, useTradeDraft } from '../composables/useTradeDraft.js'
import { useTradePrices } from '../composables/useTradePrices.js'
import ReceivingCardDialog from '../components/trade/ReceivingCardDialog.vue'
import TradePriceStatus from '../components/trade/TradePriceStatus.vue'
import TradeReviewDialog from '../components/trade/TradeReviewDialog.vue'
import TradeHistory from '../components/trade/TradeHistory.vue'
import TradeGivingPicker from '../components/trade/TradeGivingPicker.vue'

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
  if (pricingLoading.value) return { message: 'Loading market prices…', warning: false }
  if (pricingError.value) return { message: pricingError.value, warning: true }
  if (!giving.value.length || !receiving.value.length) {
    return { message: 'Add cards to both sides to compare.', warning: false }
  }

  const difference = differenceMinor.value
  if (givingEstimate.value.missing || receivingEstimate.value.missing) {
    return {
      message: 'Some market prices are missing, so the difference is unavailable.',
      warning: true,
    }
  }
  if (difference === null) {
    return { message: 'Value difference is too large to display.', warning: true }
  }
  if (difference === 0) {
    return { message: 'Both sides have the same estimated value.', warning: false }
  }

  const side = difference > 0 ? 'Receiving' : 'Giving'
  return {
    message: `${side} is worth ${usd.format(Math.abs(difference) / 100)} more.`,
    warning: false,
  }
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
    direction: 'giving',
    label: 'You give',
    lines: giving.value.map((line) => ({
      ...line,
      binderQuantity: copiesFromBinder(line),
    })),
    total: formatEstimate(givingEstimate.value, giving.value.length),
  },
  {
    direction: 'receiving',
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

const availableToGive = computed(() => {
  const selectedIds = new Set(giving.value.map(({ id }) => id))
  return owned.value.filter(({ id }) => !selectedIds.has(id))
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
      :class="{ 'trade-tabs--history': activeTab === 'history' }"
    >
      <q-tab name="compare" label="Compare" icon="swap_horiz" :ripple="false" />
      <q-tab name="history" label="History" icon="history" :ripple="false" />
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
              @click="pickerOpen = true"
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

        <section
          class="trade-panel trade-panel--receiving"
          aria-labelledby="trade-receiving-heading"
        >
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
        <TradePriceStatus
          class="q-mb-sm"
          :message="comparison.message"
          :warning="comparison.warning"
        />
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
      :comparison="comparison.message"
      :pricing-warning="comparison.warning"
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

    <TradeGivingPicker
      v-model="pickerOpen"
      :options="availableToGive"
      :selected-copies="totalCopies"
      @add="addCard"
    />
  </section>
</template>

<style scoped>
.trade-tabs {
  --switch-inset: 0.25rem;
  --switch-outer-radius: 0.625rem;

  isolation: isolate;
  width: 16rem;
  max-width: 100%;
  padding: var(--switch-inset);
  border: 1px solid var(--surface-border);
  border-radius: 0.875rem;
  background: var(--surface-muted);
}

.trade-tabs::before {
  --thumb-start-radius: var(--switch-outer-radius);
  --thumb-end-radius: 0;

  content: '';
  position: absolute;
  z-index: -1;
  inset-block: var(--switch-inset);
  inset-inline-start: var(--switch-inset);
  inline-size: calc(50% - var(--switch-inset));
  border-start-start-radius: var(--thumb-start-radius);
  border-end-start-radius: var(--thumb-start-radius);
  border-start-end-radius: var(--thumb-end-radius);
  border-end-end-radius: var(--thumb-end-radius);
  background: #fff;
  box-shadow: 0 1px 2px #19263b14;
  pointer-events: none;
  transition: inset-inline-start 180ms ease;
}

.trade-tabs--history::before {
  --thumb-start-radius: 0;
  --thumb-end-radius: var(--switch-outer-radius);

  inset-inline-start: 50%;
}

.trade-tabs :deep(.q-tab) {
  flex: 1 1 0;
  min-height: 2.75rem;
}

.trade-tabs :deep(.q-tab:first-child) {
  border-start-start-radius: var(--switch-outer-radius);
  border-end-start-radius: var(--switch-outer-radius);
}

.trade-tabs :deep(.q-tab:last-child) {
  border-start-end-radius: var(--switch-outer-radius);
  border-end-end-radius: var(--switch-outer-radius);
}

.trade-tabs :deep(.q-tab > .q-focus-helper) {
  opacity: 0;
}

.trade-tabs :deep(.q-tab:focus-visible) {
  outline: 2px solid var(--q-primary);
  outline-offset: -2px;
}

.trade-tabs :deep(.q-tab__indicator) {
  display: none;
}

@media (any-hover: hover) {
  .trade-tabs :deep(.q-tab--inactive:hover) {
    background: color-mix(in srgb, var(--q-primary) 5%, transparent);
    opacity: 1;
  }
}

@media (max-width: 640px) {
  .trade-tabs {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .trade-tabs::before,
  .trade-tabs :deep(.q-tab) {
    transition: none;
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
  --trade-direction: var(--q-primary);
  --trade-header-background: color-mix(in srgb, var(--q-primary) 7%, white);

  display: flex;
  flex-direction: column;
}

.trade-panel--receiving {
  --trade-direction: var(--q-secondary);
  --trade-header-background: var(--secondary-surface);
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
  padding: 0.5rem 0.625rem;
  border-radius: 0.5rem;
  background: var(--trade-header-background);
}

.trade-panel-header h2 {
  color: var(--trade-direction);
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.4;
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

.trade-panel-total strong {
  color: var(--trade-direction);
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
