<script setup>
import { computed, ref, watch } from 'vue'
import AddCardDialog from '../cards/AddCardDialog.vue'
import CardPrintingPicker from '../cards/CardPrintingPicker.vue'
import ReceivingCardForm from './ReceivingCardForm.vue'
import { useCardLookup } from '../../composables/useCardLookup.js'

defineProps({
  errorMessage: { type: String, default: '' },
})

const open = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['submit', 'clear-error'])
const selectedPrinting = ref(null)

const {
  loading,
  cards,
  errorMessage: lookupError,
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

const step = computed(() => {
  if (selectedPrinting.value) return 'details'
  if (selectedCard.value) return 'printing'
  return 'search'
})

function backToPrintings() {
  selectedPrinting.value = null
  emit('clear-error')
}

function submit(details) {
  emit('submit', { card: selectedPrinting.value, details })
}

function reset() {
  backToPrintings()
  backToSearchResults()
  cards.value = []
  searched.value = false
  hasMore.value = false
}

watch(open, (isOpen) => {
  if (!isOpen) cancelSearch()
})
</script>

<template>
  <AddCardDialog
    v-model="open"
    :step="step"
    :loading="loading"
    @search="searchByName"
    @hide="reset"
  >
    <ReceivingCardForm
      v-if="selectedPrinting"
      :key="selectedPrinting.scryfallId"
      :card="selectedPrinting"
      :error-message="errorMessage"
      @back="backToPrintings"
      @submit="submit"
    />

    <template v-else>
      <q-btn
        v-if="selectedCard"
        flat
        no-caps
        icon="arrow_back"
        label="Back to results"
        class="q-mb-md"
        @click="backToSearchResults"
      />

      <q-banner v-if="lookupError" class="bg-red-1 text-negative q-mb-md" role="alert">
        {{ lookupError }}
        <template v-if="selectedCard?.oracleId" #action>
          <q-btn flat no-caps label="Retry" @click="loadPrintings" />
        </template>
      </q-banner>

      <CardPrintingPicker
        v-if="selectedCard && (!lookupError || printings.length)"
        :printings="printings"
        :loading="loading"
        :has-more="printingsHaveMore"
        @select="selectedPrinting = $event"
        @load-more="loadPrintings"
      />

      <div v-else-if="!selectedCard && loading" role="status" aria-label="Searching cards">
        <q-skeleton v-for="row in 3" :key="row" height="64px" class="q-mb-sm" />
      </div>

      <template v-else-if="!selectedCard && searched">
        <p v-if="hasMore">More matches are available. Try a more specific name.</p>
        <q-list v-if="cards.length" bordered separator>
          <q-item v-for="card in cards" :key="card.scryfallId" clickable @click="selectCard(card)">
            <q-item-section>
              <q-item-label>{{ card.name }}</q-item-label>
              <q-item-label caption>{{ card.setName }} · #{{ card.collectorNumber }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <p v-else role="status">No matching cards found. Try another name.</p>
      </template>
    </template>
  </AddCardDialog>
</template>
