import { Card } from '../models/Card.js'

const API_BASE_URL = 'https://api.scryfall.com'

/**
 * Searches one page of Scryfall results.
 * @param {string} query Card name or Scryfall search expression.
 * @param {Object} [options={}] Request options.
 * @param {number} [options.page=1] Results page to request.
 * @param {'cards'|'prints'} [options.unique='cards'] How matching printings are grouped.
 * @param {AbortSignal} [options.signal] Allows cancellation of the request.
 * @returns {Promise<{cards: Card[], totalCards: number, hasMore: boolean}>}
 * @throws {Error} If the input, request, or returned card data is invalid.
 */
export async function searchCards(query, { page = 1, signal, unique = 'cards' } = {}) {
  if (typeof query !== 'string' || query.trim() === '') {
    throw new TypeError('Enter a card name to search.')
  }

  if (!Number.isSafeInteger(page) || page < 1) {
    throw new TypeError('Page must be a positive integer.')
  }

  if (!['cards', 'prints'].includes(unique)) {
    throw new TypeError('Search uniqueness must be cards or prints.')
  }

  const url = new URL(`${API_BASE_URL}/cards/search`)

  url.searchParams.set('q', query.trim())
  url.searchParams.set('unique', unique)
  url.searchParams.set('order', 'name')
  url.searchParams.set('page', String(page))

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (response.status === 404) {
    return {
      cards: [],
      totalCards: 0,
      hasMore: false,
    }
  }

  if (!response.ok) {
    throw new Error(`Card search failed (${response.status}). Please try again.`)
  }

  const result = await response.json()

  return {
    cards: result.data.map((printing) => new Card(printing)),
    totalCards: result.total_cards,
    hasMore: result.has_more,
  }
}

/**
 * Retrieves one page of a card's paper printings.
 * @param {string} oracleId Shared card identity.
 * @param {Object} [options={}] Request options.
 * @param {number} [options.page=1] Results page.
 * @param {AbortSignal} [options.signal] Request cancellation signal.
 * @returns {Promise<{cards: Card[], totalCards: number, hasMore: boolean}>}
 * @throws {Error} If the identifier or request is invalid.
 */
export async function getCardPrintings(oracleId, { page = 1, signal } = {}) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (typeof oracleId !== 'string' || !uuidPattern.test(oracleId)) {
    throw new TypeError('A valid Oracle ID is required to find printings.')
  }

  return searchCards(`oracleid:${oracleId} game:paper`, {
    page,
    signal,
    unique: 'prints',
  })
}
