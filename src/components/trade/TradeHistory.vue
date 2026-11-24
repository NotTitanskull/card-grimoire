<script setup>
import { onMounted, ref } from 'vue'
import DialogFrame from '../layout/DialogFrame.vue'
import { getTradeHistory } from '../../services/trades.js'

/** @typedef {import('../../services/trades.js').TradeRecord} TradeRecord */

const props = defineProps({
  userId: { type: String, required: true },
})

/** @type {import('vue').Ref<TradeRecord[]>} */
const trades = ref([])
const loading = ref(true)
const loadError = ref('')
/** @type {import('vue').Ref<TradeRecord|null>} */
const selectedTrade = ref(null)
const detailsOpen = ref(false)

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const usd = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })

async function loadHistory() {
  loading.value = true
  loadError.value = ''

  try {
    trades.value = await getTradeHistory(props.userId)
  } catch {
    loadError.value = 'Could not load trade history.'
  } finally {
    loading.value = false
  }
}

function formatDate(timestamp, formatter) {
  const date = timestamp?.toDate?.()
  return date && Number.isFinite(date.getTime()) ? formatter.format(date) : ''
}

function copyLabel(lines) {
  const count = lines.reduce((total, line) => total + line.quantity, 0)
  return `${count} ${count === 1 ? 'copy' : 'copies'}`
}

/** @param {TradeRecord} trade */
function tradeSides(trade) {
  return [
    { label: 'Gave', lines: trade.given, icon: 'north_east', direction: 'given' },
    { label: 'Received', lines: trade.received, icon: 'south_west', direction: 'received' },
  ]
}

/** @param {TradeRecord} trade */
function openTrade(trade) {
  selectedTrade.value = trade
  detailsOpen.value = true
}

function recordedPrice(value) {
  return Number.isSafeInteger(value) && value >= 0
    ? `${usd.format(value / 100)} per copy`
    : 'Price unavailable'
}

onMounted(loadHistory)
</script>

<template>
  <div v-if="loading" class="trade-history-list" role="status" aria-label="Loading trade history">
    <q-skeleton v-for="row in 3" :key="row" height="84px" class="trade-history-placeholder" />
  </div>

  <q-banner v-else-if="loadError" class="bg-red-1 text-negative" role="alert">
    {{ loadError }}
    <template #action>
      <q-btn flat no-caps label="Retry" @click="loadHistory" />
    </template>
  </q-banner>

  <div v-else-if="!trades.length" class="trade-history-empty">
    <q-icon name="history" size="1.75rem" aria-hidden="true" />
    <p>No completed trades yet.</p>
  </div>

  <ul v-else class="trade-history-list" aria-label="Completed trades">
    <li v-for="trade in trades" :key="trade.id">
      <button type="button" class="trade-history-row" @click="openTrade(trade)">
        <span class="trade-history-date">
          <strong>{{ formatDate(trade.completedAt, dateFormat) || 'Date unavailable' }}</strong>
          <span>{{ formatDate(trade.completedAt, timeFormat) }}</span>
        </span>

        <span
          v-for="side in tradeSides(trade)"
          :key="side.direction"
          class="trade-history-summary"
          :class="`trade-history-summary--${side.direction}`"
        >
          <span class="trade-history-summary-label">
            <q-icon :name="side.icon" aria-hidden="true" />
            <span>
              {{ side.label }} · <span class="text-no-wrap">{{ copyLabel(side.lines) }}</span>
            </span>
          </span>
          <span class="trade-history-preview">
            {{ side.lines[0]?.card.name || 'No cards' }}
            <span v-if="side.lines.length > 1" class="trade-history-more">
              +{{ side.lines.length - 1 }} more
            </span>
          </span>
        </span>

        <q-icon name="chevron_right" class="trade-history-chevron" aria-hidden="true" />
      </button>
    </li>
  </ul>

  <DialogFrame
    v-model="detailsOpen"
    title="Completed trade"
    icon="receipt_long"
    width="46rem"
    :subtitle="
      selectedTrade
        ? formatDate(selectedTrade.completedAt, dateTimeFormat) || 'Date unavailable'
        : ''
    "
  >
    <div v-if="selectedTrade" class="completed-trade">
      <div class="completed-trade-sides">
        <section
          v-for="side in tradeSides(selectedTrade)"
          :key="side.direction"
          class="completed-trade-side"
          :class="`completed-trade-side--${side.direction}`"
        >
          <div class="completed-trade-side-header">
            <q-icon :name="side.icon" aria-hidden="true" />
            <h3>{{ side.label }}</h3>
            <span>{{ copyLabel(side.lines) }}</span>
          </div>
          <ul v-if="side.lines.length" class="completed-trade-lines">
            <li v-for="(line, index) in side.lines" :key="index" class="completed-trade-line">
              <q-img
                v-if="line.card.imageUrl"
                :src="line.card.imageUrl"
                :ratio="5 / 7"
                class="completed-trade-thumbnail"
                loading="lazy"
                alt=""
              />
              <div class="completed-trade-card">
                <strong>{{ line.card.name }}</strong>
                <span class="completed-trade-set">
                  <span>{{ line.card.setName }}</span>
                  <span>#{{ line.card.collectorNumber }}</span>
                </span>
                <span>
                  {{ line.condition }} · <span class="text-capitalize">{{ line.finish }}</span>
                </span>
                <span>{{ recordedPrice(line.unitValueMinor) }}</span>
              </div>
              <span class="completed-trade-quantity">×{{ line.quantity }}</span>
            </li>
          </ul>
          <p v-else class="completed-trade-no-cards">No cards</p>
        </section>
      </div>
    </div>
  </DialogFrame>
</template>

<style scoped lang="scss">
.trade-history-list {
  display: grid;
  gap: 0.625rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.trade-history-row,
.trade-history-empty {
  width: 100%;
  border: 1px solid var(--surface-border);
  border-radius: 0.875rem;
  background: #fff;
}

.trade-history-placeholder {
  border-radius: 0.875rem;
}

.trade-history-empty {
  display: grid;
  justify-items: center;
  gap: 0.625rem;
  padding: 2rem 1rem;
  color: var(--text-muted);

  p {
    margin: 0;
  }
}

.trade-history-row {
  display: grid;
  grid-template-columns: 9rem repeat(2, minmax(0, 1fr)) auto;
  align-items: center;
  gap: 0.75rem 1.25rem;
  padding: 0.875rem 1rem;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;

  &:hover {
    background: #f9fbff;
    border-color: #afc3e5;
  }

  &:focus-visible {
    outline: 2px solid var(--q-primary);
    outline-offset: 2px;
  }
}

.trade-history-date,
.trade-history-summary {
  display: grid;
  gap: 0.1875rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.trade-history-date > span,
.trade-history-summary-label,
.trade-history-more {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.trade-history-summary {
  padding-inline-start: 1rem;
  border-inline-start: 1px solid var(--surface-border);
}

.trade-history-summary-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;

  .q-icon {
    color: var(--q-primary);
  }
}

.trade-history-summary--received .trade-history-summary-label,
.trade-history-summary--received .q-icon {
  color: var(--q-secondary);
}

.trade-history-preview {
  font-weight: 600;
}

.trade-history-more {
  margin-inline-start: 0.25rem;
  white-space: nowrap;
  font-weight: 400;
}

.trade-history-chevron {
  color: var(--q-primary);
  font-size: 1.25rem;
}

@media (max-width: 640px) {
  .trade-history-row {
    position: relative;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 0.625rem;
    padding: 0.75rem;
  }

  .trade-history-date {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.125rem 0.5rem;
    grid-column: 1 / -1;
    padding-inline-end: 1.5rem;
  }

  .trade-history-summary {
    align-self: start;
    padding: 0;
    border: 0;
  }

  .trade-history-summary-label {
    align-items: baseline;
    font-size: 0.75rem;
  }

  .trade-history-chevron {
    position: absolute;
    inset-block-start: 0.75rem;
    inset-inline-end: 0.75rem;
  }
}

.completed-trade {
  container-type: inline-size;
}

.completed-trade-sides {
  display: grid;
  gap: 0.75rem;

  @container (width >= 36rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

.completed-trade-side {
  min-width: 0;
  border: 1px solid var(--dialog-line);
  border-radius: 0.75rem;
  overflow: hidden;
}

.completed-trade-side-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--dialog-tint);
  border-bottom: 1px solid var(--dialog-line);

  .q-icon {
    color: var(--q-primary);
    font-size: 1.125rem;
  }

  h3 {
    flex: 1;
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.3;
    font-weight: 700;
  }

  span {
    color: var(--dialog-muted);
    font-size: 0.8125rem;
  }
}

.completed-trade-side--received .completed-trade-side-header {
  background: var(--secondary-surface);
}

.completed-trade-side--received .completed-trade-side-header .q-icon,
.completed-trade-side--received .completed-trade-side-header h3 {
  color: var(--q-secondary);
}

.completed-trade-lines {
  margin: 0;
  padding: 0;
  list-style: none;
}

.completed-trade-line {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.75rem;

  + .completed-trade-line {
    border-top: 1px solid var(--dialog-line);
  }
}

.completed-trade-thumbnail {
  flex: 0 0 2.5rem;
  width: 2.5rem;
  border-radius: 0.25rem;
}

.completed-trade-card {
  flex: 1;
  display: grid;
  gap: 0.125rem;
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--dialog-muted);
  font-size: 0.8125rem;

  strong {
    color: var(--dialog-ink);
    font-size: 0.9375rem;
  }
}

.completed-trade-set {
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.375rem;
}

.completed-trade-quantity {
  padding: 0.125rem 0.375rem;
  border-radius: 0.375rem;
  background: var(--dialog-accent);
  color: var(--q-primary);
  font-size: 0.8125rem;
  font-weight: 600;
}

.completed-trade-no-cards {
  margin: 0;
  padding: 0.75rem;
  color: var(--dialog-muted);
}
</style>
