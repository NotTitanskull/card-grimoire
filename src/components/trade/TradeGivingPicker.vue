<script setup>
import { computed, ref } from 'vue'

/** @typedef {import('../../composables/useTradeDraft.js').TradeOption} TradeOption */

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  options: { type: /** @type {import('vue').PropType<TradeOption[]>} */ (Array), required: true },
  selectedCopies: { type: Number, required: true },
})
const emit = defineEmits(['add'])
const search = ref('')

const matchingCards = computed(() => {
  const query = search.value.trim().toLowerCase()

  return props.options.filter((card) => {
    const text = `${card.name} ${card.details} ${card.binderName ?? ''}`.toLowerCase()
    return text.includes(query)
  })
})
</script>

<template>
  <q-dialog v-model="open" aria-labelledby="trade-picker-title" @before-show="search = ''">
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
                @click="emit('add', card)"
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
          {{ selectedCopies }} {{ selectedCopies === 1 ? 'copy' : 'copies' }} selected
        </span>
        <q-btn v-close-popup unelevated no-caps color="primary" label="Done" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
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
</style>
