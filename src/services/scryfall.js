import { Card } from '../models/Card.js'

const API_BASE_URL = 'https://api.scryfall.com'

/**
 * Searches one page of Scryfall results.
 * @param {string} query Card name or Scryfall search expression.
 * @param {Object} [options={}] Request options.
 * @param {number} [options.page=1] Results page to request.
 * @param {AbortSignal} [options.signal] Allows cancellation of the request.
 * @returns {Promise<{cards: Card[], totalCards: number, hasMore: boolean}>}
 * @throws {Error} If the input, request, or returned card data is invalid.
 */
export async function searchCards(query, { page = 1, signal } = {}) {
    if (typeof query !== 'string' || query.trim() === '') {
        throw new TypeError('Enter a card name to search.')
    }

    if (!Number.isSafeInteger(page) || page < 1) {
        throw new TypeError('Page must be a positive integer.')
    }

    const url = new URL(`${API_BASE_URL}/cards/search`)

    url.searchParams.set('q', query.trim())
    url.searchParams.set('unique', 'cards')
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