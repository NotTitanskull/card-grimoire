<script setup>
import { computed, ref, watch } from 'vue'
import { getBinders } from '../../services/binders.js'
import { saveBinderAssignment } from '../../services/collection.js'

/** @typedef {import('../../services/collection.js').CollectionRecord} CollectionRecord */

const props = defineProps({
  userId: { type: String, required: true },
  record: {
    type: /** @type {import('vue').PropType<CollectionRecord | null>} */ (Object),
    default: null,
  },
})

const binderDialogOpen = defineModel({ type: Boolean, default: false })
const binderSaving = defineModel('saving', { type: Boolean, default: false })
const emit = defineEmits(['saved'])

const binderOptions = ref(/** @type {{ label: string, value: string, name: string }[]} */ ([]))
const selectedBinderId = ref(/** @type {string | null} */ (null))
const binderQuantity = ref(/** @type {number | string} */ (0))
const bindersLoading = ref(false)
const binderLoadError = ref('')
const binderSaveError = ref('')

const selectedBinderCopies = computed(() => {
  const binderId = selectedBinderId.value
  if (!binderId) return 0

  return props.record?.entry.binderQuantities[binderId] ?? 0
})

/** The selected binder can keep its current copies and take any unassigned copies. */
const binderCopyLimit = computed(() => {
  const entry = props.record?.entry
  return entry ? entry.unassignedQuantity + selectedBinderCopies.value : 0
})

/** @param {string | null} binderId Selected binder ID. */
function selectBinder(binderId) {
  binderSaveError.value = ''
  selectedBinderId.value = binderId
  binderQuantity.value = selectedBinderCopies.value || (binderCopyLimit.value > 0 ? 1 : '')
}

watch(
  [binderDialogOpen, () => props.userId, () => props.record],
  async ([open, userId, record], _, onCleanup) => {
    if (!open || !userId || !record) return

    let current = true
    onCleanup(() => {
      current = false
    })

    binderOptions.value = []
    selectedBinderId.value = null
    binderQuantity.value = 0
    binderLoadError.value = ''
    binderSaveError.value = ''
    bindersLoading.value = true

    try {
      const binders = await getBinders(userId)
      if (!current) return

      const assignments = record.entry.binderQuantities
      binderOptions.value = binders.map(({ id, binder }) => {
        const copies = assignments[id] ?? 0
        return {
          label: copies ? `${binder.name} · ${copies} assigned` : binder.name,
          value: id,
          name: binder.name,
        }
      })

      if (binderOptions.value.length === 1) selectBinder(binderOptions.value[0].value)
    } catch {
      if (current) binderLoadError.value = 'Could not load your binders.'
    } finally {
      if (current) bindersLoading.value = false
    }
  },
  { immediate: true },
)

/**
 * Saves the selected binder's copy count and reports it to the collection page.
 * @param {boolean} [remove=false] Whether to remove the assignment by saving zero copies.
 */
async function submitBinderAssignment(remove = false) {
  const { userId, record } = props
  const binderId = selectedBinderId.value
  const quantity = remove ? 0 : binderQuantity.value

  if (!userId || !record || !binderId || bindersLoading.value || binderSaving.value) return

  binderSaveError.value = ''

  if (
    typeof quantity !== 'number' ||
    !Number.isSafeInteger(quantity) ||
    quantity < (remove ? 0 : 1)
  ) {
    binderSaveError.value = 'Enter a whole number of copies, at least 1.'
    return
  }

  if (quantity > binderCopyLimit.value) {
    binderSaveError.value = `You can assign up to ${binderCopyLimit.value} copies to this binder.`
    return
  }

  binderSaving.value = true

  try {
    await saveBinderAssignment(userId, record.id, binderId, quantity)
    if (props.userId !== userId || props.record !== record) return

    binderDialogOpen.value = false
    emit('saved', quantity)
  } catch (error) {
    if (props.userId !== userId || props.record !== record) return

    binderSaveError.value =
      error instanceof Error && !('code' in error)
        ? error.message
        : 'Could not save the binder assignment. Please try again.'
  } finally {
    binderSaving.value = false
  }
}
</script>

<template>
  <q-dialog
    v-model="binderDialogOpen"
    :persistent="binderSaving"
    aria-labelledby="binder-assignment-title"
  >
    <q-card
      v-if="record"
      class="binder-assignment-dialog grimoire-dialog grimoire-dialog-sized"
      style="--dialog-width: 32rem"
    >
      <q-card-section class="grimoire-dialog__header">
        <q-icon name="book" class="grimoire-dialog__icon" aria-hidden="true" />
        <div class="grimoire-dialog__heading">
          <h2 id="binder-assignment-title" class="grimoire-dialog__title">Assign to binder</h2>
          <p class="grimoire-dialog__subtitle">
            {{ record.entry.card.name }} · {{ record.entry.quantity }} owned
          </p>
        </div>
        <q-btn
          v-close-popup
          :disable="binderSaving"
          flat
          round
          dense
          icon="close"
          class="grimoire-dialog__close"
          aria-label="Close binder assignment"
        />
      </q-card-section>

      <q-card-section class="grimoire-dialog__body binder-assignment-fields">
        <p v-if="bindersLoading" class="q-ma-none" role="status">Loading binders…</p>
        <p v-else-if="binderLoadError" class="text-negative q-ma-none" role="alert">
          {{ binderLoadError }}
        </p>
        <p v-else-if="binderOptions.length === 0" class="q-ma-none">
          Create a binder on the Binders page first.
        </p>

        <template v-else>
          <q-select
            :model-value="selectedBinderId"
            :options="binderOptions"
            :display-value="binderOptions.find((binder) => binder.value === selectedBinderId)?.name"
            label="Binder"
            outlined
            popup-content-class="grimoire-options"
            emit-value
            map-options
            :disable="binderSaving"
            @update:model-value="selectBinder"
          />
          <q-input
            v-if="selectedBinderId"
            v-model.number="binderQuantity"
            type="number"
            min="1"
            :max="binderCopyLimit"
            step="1"
            label="Assigned copies"
            :hint="`${selectedBinderCopies} currently assigned · Max ${binderCopyLimit}`"
            outlined
            :disable="binderSaving"
            @keyup.enter="submitBinderAssignment()"
          />
        </template>

        <p v-if="binderSaveError" class="text-negative q-ma-none" role="alert">
          {{ binderSaveError }}
        </p>
      </q-card-section>

      <q-card-actions class="grimoire-dialog__footer">
        <q-btn
          v-if="selectedBinderCopies > 0"
          flat
          no-caps
          color="negative"
          label="Remove assignment"
          class="binder-assignment-remove"
          :disable="binderSaving"
          @click="submitBinderAssignment(true)"
        />
        <q-space />
        <q-btn v-close-popup flat no-caps label="Cancel" :disable="binderSaving" />
        <q-btn
          color="primary"
          no-caps
          unelevated
          label="Save"
          aria-label="Save assignment"
          :loading="binderSaving"
          :disable="!selectedBinderId || bindersLoading || binderCopyLimit === 0"
          @click="submitBinderAssignment()"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.binder-assignment-fields {
  display: grid;
  gap: 0.875rem;
}

@media (max-width: 480px) {
  .binder-assignment-dialog .grimoire-dialog__footer {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .binder-assignment-remove {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .binder-assignment-dialog .grimoire-dialog__footer :deep(.q-space) {
    display: none;
  }
}
</style>
