<script setup>
defineProps({
  printings: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  hasMore: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'load-more'])
</script>

<template>
  <section aria-label="Available card printings" :aria-busy="loading">
    <q-list v-if="printings.length" bordered separator>
      <q-item v-for="printing in printings" :key="printing.scryfallId">
        <q-item-section avatar>
          <q-img
            v-if="printing.imageUrl"
            :src="printing.imageUrl"
            alt=""
            width="48px"
            :ratio="5 / 7"
          />
          <q-icon v-else name="image_not_supported" size="32px" />
        </q-item-section>

        <q-item-section>
          <q-item-label>{{ printing.name }}</q-item-label>

          <q-item-label caption>
            {{ printing.setName }} · {{ printing.setCode }} · #{{ printing.collectorNumber }}
          </q-item-label>

          <q-item-label caption> Finishes: {{ printing.finishes.join(', ') }} </q-item-label>
        </q-item-section>

        <q-item-section side>
          <q-btn
            outline
            no-caps
            color="primary"
            label="Choose"
            :aria-label="`Choose ${printing.setName}, number ${printing.collectorNumber}`"
            :disable="loading"
            @click="emit('select', printing)"
          />
        </q-item-section>
      </q-item>
    </q-list>

    <div v-if="loading" class="q-mt-md" role="status" aria-label="Loading printings">
      <q-skeleton type="rect" height="80px" />
    </div>

    <p v-else-if="!printings.length" class="q-mt-md">No paper printings found.</p>

    <q-btn
      v-if="hasMore"
      class="q-mt-md"
      outline
      no-caps
      color="primary"
      label="Load more printings"
      :loading="loading"
      :disable="loading"
      @click="emit('load-more')"
    />
  </section>
</template>

<style scoped></style>
