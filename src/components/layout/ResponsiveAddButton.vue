<script setup>
defineProps({
  label: { type: String, required: true },
  disable: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])
</script>

<template>
  <q-btn
    class="add-desktop"
    unelevated
    no-caps
    color="primary"
    icon="add"
    :label="label"
    :disable="disable"
    @click="emit('click')"
  />
  <q-btn
    class="add-mobile"
    round
    color="primary"
    icon="add"
    :aria-label="label"
    :disable="disable"
    @click="emit('click')"
  />
</template>

<style scoped lang="scss">
.add-desktop {
  display: none;
  flex-shrink: 0;
}

.add-mobile {
  position: fixed;
  z-index: 90;
  right: calc(1rem + env(safe-area-inset-right, 0px));
  bottom: var(--mobile-nav-clearance);
  width: 3.5rem;
  height: 3.5rem;
}

@media (min-width: 768px) {
  .add-desktop {
    display: inline-flex;
  }

  .add-mobile {
    display: none;
  }
}
</style>
