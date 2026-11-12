<script setup>
import AppNavigation from './AppNavigation.vue'
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="page-container app-header__content">
        <RouterLink class="app-brand" :to="{ name: 'collection' }">
          Card Grimoire
        </RouterLink>
        <AppNavigation class="desktop-navigation" />
      </div>
    </header>

    <main class="page-container app-main">
      <slot />
    </main>

    <footer class="page-container app-footer">
      <small>Card Grimoire</small>
      <AppNavigation class="mobile-navigation" />
    </footer>
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  color: #212529;
  background-color: #f5f7fb;
  padding-bottom: calc(5rem + env(safe-area-inset-bottom));

  @media (min-width: 768px) {
    padding-bottom: 0;
  }
}

.page-container {
  width: 100%;
  max-width: 1140px;
  margin-inline: auto;
  padding-inline: 1rem;
}

.app-header {
  background-color: #fff;
  border-bottom: 1px solid #dfe5ef;

  &__content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 4.5rem;
    gap: 1rem;
  }
}

.app-brand {
  color: inherit;
  font-size: 1.5rem;
  font-weight: 700;
  text-decoration: none;

  &:focus-visible {
    outline: 3px solid $primary;
    outline-offset: 4px;
  }
}

.app-main {
  flex: 1;
  padding-block: 1.5rem;
}

.app-footer {
  padding-block: 1rem;
  border-top: 1px solid #dfe5ef;
}

.desktop-navigation {
  display: none;
}

.mobile-navigation {
  position: fixed;
  inset: auto 0 0;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
  background-color: #fff;
  border-top: 1px solid #dfe5ef;
}

@media (min-width: 768px) {
  .desktop-navigation {
    display: block;
  }

  .mobile-navigation {
    display: none;
  }
}

</style>