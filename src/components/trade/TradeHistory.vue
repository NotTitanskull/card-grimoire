<script setup>
import { onMounted, ref } from 'vue'
import { getTradeHistory } from '../../services/trades.js'

const props = defineProps({
  userId: { type: String, required: true },
})

const trades = ref([])
const loading = ref(true)
const loadError = ref('')
const selectedTrade = ref(null)

const dateFormat = new Intl.DateTimeFormat(undefined, {
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

function formatDate(timestamp) {
  const date = timestamp?.toDate?.()
  return date ? dateFormat.format(date) : 'Date unavailable'
}

function countCopies(lines) {
  return lines.reduce((total, line) => total + line.quantity, 0)
}

function recordedPrice(value) {
  return Number.isSafeInteger(value) && value >= 0
    ? `${usd.format(value / 100)} per copy`
    : 'Price unavailable'
}

onMounted(loadHistory)
</script>

<template>
  <div v-if="loading" role="status" aria-label="Loading trade history">
    <q-skeleton v-for="row in 3" :key="row" height="60px" class="q-mb-sm" />
  </div>

  <q-banner v-else-if="loadError" class="bg-red-1 text-negative" role="alert">
    {{ loadError }}
    <template #action>
      <q-btn flat no-caps label="Retry" @click="loadHistory" />
    </template>
  </q-banner>

  <p v-else-if="!trades.length">Completed trades will appear here.</p>

  <q-list v-else bordered separator class="bg-white rounded-borders">
    <q-item v-for="trade in trades" :key="trade.id" clickable @click="selectedTrade = trade">
      <q-item-section>
        <q-item-label>{{ formatDate(trade.completedAt) }}</q-item-label>
        <q-item-label caption>
          Gave {{ countCopies(trade.given) }} · Received {{ countCopies(trade.received) }}
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-icon name="chevron_right" aria-hidden="true" />
      </q-item-section>
    </q-item>
  </q-list>

  <q-dialog
    :model-value="selectedTrade !== null"
    aria-labelledby="saved-trade-title"
    @update:model-value="!$event && (selectedTrade = null)"
  >
    <q-card v-if="selectedTrade" class="saved-trade">
      <q-card-section>
        <h2 id="saved-trade-title" class="text-h6 q-ma-none">Completed trade</h2>
        <p class="text-grey-8 q-mb-none">{{ formatDate(selectedTrade.completedAt) }}</p>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-y-md">
        <section
          v-for="side in [
            { label: 'You gave', lines: selectedTrade.given },
            { label: 'You received', lines: selectedTrade.received },
          ]"
          :key="side.label"
        >
          <h3 class="text-subtitle1 text-weight-bold q-ma-none">{{ side.label }}</h3>
          <q-list separator>
            <q-item v-for="(line, index) in side.lines" :key="index" class="q-px-none">
              <q-item-section>
                <q-item-label>{{ line.card.name }}</q-item-label>
                <q-item-label caption>
                  {{ line.card.setName }} · #{{ line.card.collectorNumber }} ·
                  {{ line.condition }} · {{ line.finish }}
                </q-item-label>
                <q-item-label caption>{{ recordedPrice(line.unitValueMinor) }}</q-item-label>
              </q-item-section>
              <q-item-section side>×{{ line.quantity }}</q-item-section>
            </q-item>
          </q-list>
        </section>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-close-popup flat no-caps color="primary" label="Close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.saved-trade {
  width: 36rem;
  max-width: calc(100vw - 2rem);
}
</style>
