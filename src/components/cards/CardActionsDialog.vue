<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  entry: { type: Object, default: null },
  showDetails: Boolean,
  records: { type: Array, default: () => [] },
  copies: { type: Number, default: 0 },
  variantCount: { type: Number, default: 0 },
  preferredRecordId: { type: String, default: null },
})

const emit = defineEmits(['update:modelValue', 'closed'])
const pendingAction = ref(null)
const selectedRecordId = ref(null)
const imageExpanded = ref(false)
const imageTrigger = ref(null)
const priceFormat = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
const actionRecordId = computed(() =>
  props.records.length === 1 ? props.records[0].id : selectedRecordId.value,
)
const variantOptions = computed(() =>
  props.records.map(({ id, entry }) => {
    const price =
      entry.purchasePriceMinor == null
        ? ''
        : ` · ${priceFormat.format(entry.purchasePriceMinor / 100)} paid each`
    return { value: id, label: `${entry.quantity}× · ${entry.condition} · ${entry.finish}${price}` }
  }),
)
const cardImageUrl = computed(() => {
  const url = props.entry?.card.imageUrl
  return /^https?:\/\//i.test(url) ? url : null
})

/**
 * Queues the action until this dialog is hidden so the next one can open without overlap.
 * @param {'edit' | 'binder' | 'delete' | 'actions' | 'add'} action The selected action.
 * @param {string | null} [recordId=null] ID of the selected inventory variant, when applicable.
 */
function chooseAction(action, recordId = null) {
  pendingAction.value = { action, recordId }
  emit('update:modelValue', false)
}

function finishClosing() {
  imageExpanded.value = false
  const action = pendingAction.value
  pendingAction.value = null
  emit('closed', action)
}

function restoreImageFocus() {
  if (props.modelValue) imageTrigger.value?.focus({ preventScroll: true })
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    :position="!showDetails && $q.screen.width < 768 ? 'bottom' : 'standard'"
    aria-labelledby="card-actions-title"
    @update:model-value="emit('update:modelValue', $event)"
    @before-show="selectedRecordId = preferredRecordId"
    @hide="finishClosing"
  >
    <q-card
      v-if="entry"
      class="card-actions-dialog"
      :class="{ 'card-actions-dialog--details': showDetails }"
    >
      <q-card-section class="card-dialog-header row no-wrap items-start">
        <div class="col">
          <h2 id="card-actions-title" class="card-dialog-title q-ma-none">{{ entry.card.name }}</h2>
          <p
            v-if="showDetails ? entry.card.typeLine : entry.card.setName"
            class="card-dialog-subtitle"
          >
            {{
              showDetails
                ? entry.card.typeLine
                : `${entry.card.setName} · #${entry.card.collectorNumber}`
            }}
          </p>
        </div>
        <q-btn
          v-close-popup
          flat
          round
          dense
          icon="close"
          :aria-label="showDetails ? 'Close card details' : 'Close card actions'"
        />
      </q-card-section>

      <template v-if="showDetails">
        <div
          class="card-details-body"
          tabindex="0"
          role="region"
          aria-label="Card preview and variants"
        >
          <figure class="card-preview q-ma-none">
            <div v-if="cardImageUrl" class="card-image-stage">
              <button
                ref="imageTrigger"
                type="button"
                class="card-image-trigger"
                aria-haspopup="dialog"
                :aria-label="`Enlarge image of ${entry.card.name}`"
                @click="imageExpanded = true"
              >
                <img
                  :src="cardImageUrl"
                  class="card-details-image"
                  width="256"
                  height="358"
                  alt=""
                />
              </button>
            </div>
            <figcaption class="card-printing-caption">
              <span class="card-set-name">{{ entry.card.setName }}</span>
              <span class="card-printing-id">
                #{{ entry.card.collectorNumber }}
                <span v-if="entry.card.rarity"> · {{ entry.card.rarity }}</span>
              </span>
            </figcaption>
          </figure>

          <div class="card-variants-heading">
            <div>
              <h3 id="owned-variants-title" class="text-subtitle1 text-weight-bold q-ma-none">
                Owned variants
              </h3>
              <p class="text-caption text-grey-8 q-ma-none">
                {{ copies }} {{ copies === 1 ? 'copy' : 'copies' }} · {{ variantCount }}
                {{ variantCount === 1 ? 'variant' : 'variants' }}
              </p>
            </div>
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="Add another"
              @click="chooseAction('add')"
            />
          </div>
          <q-list separator class="card-variant-list" aria-labelledby="owned-variants-title">
            <q-item
              v-for="record in records"
              :key="record.id"
              class="card-variant-row items-center"
            >
              <q-item-section side>
                <span class="card-variant-quantity">×{{ record.entry.quantity }}</span>
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ record.entry.condition }}</q-item-label>
                <q-item-label caption class="text-capitalize">{{
                  record.entry.finish
                }}</q-item-label>
                <q-item-label v-if="record.entry.purchasePriceMinor != null" caption>
                  {{ priceFormat.format(record.entry.purchasePriceMinor / 100) }} paid per copy
                </q-item-label>
                <q-item-label
                  v-if="record.entry.favorite || record.entry.availableForTrade"
                  caption
                >
                  {{
                    [
                      record.entry.favorite && 'Favorite',
                      record.entry.availableForTrade && 'Available for trade',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row no-wrap items-center">
                  <q-btn
                    flat
                    no-caps
                    color="primary"
                    label="Edit"
                    @click="chooseAction('edit', record.id)"
                  />
                  <q-btn
                    flat
                    round
                    dense
                    icon="more_vert"
                    :aria-label="`Actions for ${record.entry.condition} ${record.entry.finish} entry`"
                    @click="chooseAction('actions', record.id)"
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </template>

      <template v-else>
        <q-separator />
        <q-card-section v-if="records.length > 1">
          <q-select
            v-model="selectedRecordId"
            :options="variantOptions"
            label="Choose an owned entry"
            outlined
            emit-value
            map-options
          />
        </q-card-section>
        <q-list class="q-py-sm">
          <q-item
            clickable
            :disable="!actionRecordId"
            @click="chooseAction('edit', actionRecordId)"
          >
            <q-item-section avatar><q-icon name="edit" color="primary" /></q-item-section>
            <q-item-section>Edit card details</q-item-section>
          </q-item>
          <q-item
            clickable
            :disable="!actionRecordId"
            @click="chooseAction('binder', actionRecordId)"
          >
            <q-item-section avatar><q-icon name="book" color="primary" /></q-item-section>
            <q-item-section>Assign to binder</q-item-section>
          </q-item>
          <q-separator class="q-my-xs" />
          <q-item
            clickable
            :disable="!actionRecordId"
            class="text-negative"
            @click="chooseAction('delete', actionRecordId)"
          >
            <q-item-section avatar
              ><q-icon name="delete_outline" color="negative"
            /></q-item-section>
            <q-item-section>Delete entry</q-item-section>
          </q-item>
        </q-list>
      </template>
    </q-card>
  </q-dialog>

  <q-dialog
    v-if="showDetails && cardImageUrl"
    v-model="imageExpanded"
    :maximized="$q.screen.width < 768"
    aria-labelledby="expanded-card-image-title"
    no-refocus
    @hide="restoreImageFocus"
  >
    <q-card class="card-image-viewer">
      <q-card-section class="card-dialog-header row no-wrap items-center">
        <h2 id="expanded-card-image-title" class="col card-dialog-title q-ma-none">
          {{ entry.card.name }}
        </h2>
        <q-btn v-close-popup flat round dense icon="close" aria-label="Close enlarged image" />
      </q-card-section>
      <q-card-section class="card-image-viewer-body">
        <img
          :src="cardImageUrl"
          :alt="`Card face of ${entry.card.name}`"
          width="488"
          height="680"
        />
      </q-card-section>
      <q-card-actions align="center">
        <q-btn
          flat
          no-caps
          color="primary"
          icon-right="open_in_new"
          label="Open original in a new tab"
          :href="cardImageUrl"
          target="_blank"
          rel="noopener noreferrer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.card-actions-dialog {
  width: 25rem;
  max-width: calc(100vw - 2rem);
}

.card-dialog-header {
  flex-shrink: 0;
  gap: 0.75rem;
  padding: 0.875rem 1rem;

  .col {
    min-width: 0;
    overflow-wrap: anywhere;
  }
}

.card-dialog-title {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.25;
}

.card-dialog-subtitle {
  margin: 0.25rem 0 0;
  color: #526278;
  font-size: 0.875rem;
  line-height: 1.4;
}

.card-actions-dialog--details {
  display: flex;
  flex-direction: column;
  width: 35rem;
  overflow: hidden;

  .card-dialog-header {
    border-bottom: 1px solid #dfe5ef;
  }
}

.card-details-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 0.5rem;

  &:focus-visible {
    outline: 2px solid var(--q-primary);
    outline-offset: -2px;
  }
}

.card-preview {
  background: #f3f6fa;
  border-bottom: 1px solid #dfe5ef;
}

.card-image-stage {
  display: grid;
  justify-items: center;
  padding: 1rem;
}

.card-image-trigger {
  display: block;
  width: min(100%, clamp(8rem, 29dvh, 16rem));
  padding: 0;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  cursor: zoom-in;

  &:focus-visible {
    outline: 2px solid var(--q-primary);
    outline-offset: 3px;
  }
}

.card-details-image {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px #172b4426;
}

.card-printing-caption {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  align-content: center;
  gap: 0.125rem 0.75rem;
  min-height: 3.75rem;
  padding: 0.875rem 1rem;
  border-top: 1px solid #dfe5ef;
  background: #f9fbfd;
  font-size: 0.875rem;
  line-height: 1.4;
}

.card-image-viewer {
  display: flex;
  flex-direction: column;
  width: min(38rem, calc(100vw - 2rem));
  background: #f3f6fa;
}

.card-image-viewer-body {
  display: grid;
  flex: 1;
  min-height: 0;
  place-items: center;
  padding-block: 0.5rem;

  img {
    display: block;
    width: min(100%, 30rem);
    height: auto;
    max-height: max(8rem, calc(100dvh - 11rem));
    object-fit: contain;
  }
}

.card-set-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.card-printing-id {
  color: #526278;
  text-transform: capitalize;
  white-space: nowrap;
}

.card-variants-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.75rem;
  padding: 0.875rem 1rem 0.5rem;
}

.card-variant-list {
  margin-inline: 1rem;
}

.card-variant-row {
  min-height: 3.5rem;
  padding-inline: 0;
}

.card-variant-quantity {
  min-width: 2rem;
  padding: 0.1875rem 0.375rem;
  border-radius: 0.375rem;
  background: #edf2f8;
  color: #294661;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

@media (max-width: 767.98px) {
  .card-actions-dialog:not(.card-actions-dialog--details) {
    width: 100%;
    max-width: 100%;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}

@media (max-width: 360px) {
  .card-image-stage {
    padding-block: 0.75rem;
  }

  .card-printing-caption {
    padding-block: 0.625rem;
  }

  .card-variants-heading {
    column-gap: 0.5rem;
    padding-inline: 0.75rem;

    .text-subtitle1 {
      font-size: 0.875rem;
    }

    .q-btn {
      padding-inline: 0.5rem;
      font-size: 0.8125rem;
    }
  }
}
</style>
