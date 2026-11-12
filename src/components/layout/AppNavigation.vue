<script setup>
const links = [
  { name: 'collection', label: 'Collection', icon: 'collections_bookmark' },
  { name: 'trade', label: 'Trade', icon: 'swap_horiz' },
  { name: 'binders', label: 'Binders', icon: 'menu_book' },
]
</script>

<template>
  <nav aria-label="Main navigation">
    <q-tabs
        active-color="primary"
        indicator-color="primary"
        align="justify"
        no-caps
    >
      <q-route-tab
          v-for="link in links"
          :key="link.name"
          :to="{ name: link.name }"
          :label="link.label"
          :icon="link.icon"
          exact
      />
    </q-tabs>
  </nav>
</template>

<style scoped>

</style>