import { onScopeDispose, ref } from 'vue'
import { getCardPrintings, searchCards } from '../services/scryfall.js'

/** Manages card searches, printing pagination, and cancellation for one lookup flow. */
export function useCardLookup() {
  const loading = ref(false)
  const cards = ref([])
  const errorMessage = ref('')
  const searched = ref(false)
  const hasMore = ref(false)
  const selectedCard = ref(null)
  const printings = ref([])
  const printingsPage = ref(0)
  const printingsHaveMore = ref(false)

  let activeRequest = null

  /**
   * Loads the next page of printings for the selected card.
   * @returns {Promise<void>}
   */
  async function loadPrintings() {
    if (loading.value || !selectedCard.value?.oracleId) return

    const controller = new AbortController()
    const nextPage = printingsPage.value + 1
    activeRequest = controller

    loading.value = true
    errorMessage.value = ''

    try {
      const result = await getCardPrintings(selectedCard.value.oracleId, {
        page: nextPage,
        signal: controller.signal,
      })

      if (activeRequest !== controller) return

      printings.value = [...printings.value, ...result.cards]
      printingsPage.value = nextPage
      printingsHaveMore.value = result.hasMore
    } catch (error) {
      if (activeRequest !== controller || error.name === 'AbortError') return

      errorMessage.value = 'Unable to load printings. Please try again.'
    } finally {
      if (activeRequest === controller) {
        loading.value = false
        activeRequest = null
      }
    }
  }

  /**
   * Opens the available printings for a search result.
   * @param {import('../models/Card.js').Card} card Selected search result.
   * @returns {Promise<void>}
   */
  async function selectCard(card) {
    cancelSearch()

    selectedCard.value = card
    printings.value = []
    printingsPage.value = 0
    printingsHaveMore.value = false
    errorMessage.value = ''

    if (!card.oracleId) {
      errorMessage.value = 'This card does not have an Oracle ID to look up its printings.'
      return
    }

    await loadPrintings()
  }

  /**
   * Searches Scryfall and displays the first page of results.
   * @param {string} query Submitted search text.
   * @returns {Promise<void>}
   */
  async function searchByName(query) {
    if (loading.value) return

    selectedCard.value = null

    const controller = new AbortController()
    activeRequest = controller

    loading.value = true
    errorMessage.value = ''
    cards.value = []
    searched.value = false
    hasMore.value = false

    try {
      const result = await searchCards(query, {
        signal: controller.signal,
      })

      if (activeRequest !== controller) return

      cards.value = result.cards
      hasMore.value = result.hasMore
      searched.value = true
    } catch (error) {
      if (activeRequest !== controller || error.name === 'AbortError') return

      errorMessage.value = 'Unable to search cards. Please try again.'
    } finally {
      if (activeRequest === controller) {
        loading.value = false
        activeRequest = null
      }
    }
  }

  /**
   * Returns to the existing search results without fetching them again.
   * @returns {void}
   */
  function backToSearchResults() {
    cancelSearch()
    selectedCard.value = null
    errorMessage.value = ''
  }

  /**
   * Cancels the pending search or printing request and ignores any late response.
   * @returns {void}
   */
  function cancelSearch() {
    activeRequest?.abort()
    activeRequest = null
    loading.value = false
  }

  onScopeDispose(cancelSearch)

  return {
    loading,
    cards,
    errorMessage,
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
  }
}
