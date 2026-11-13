import {Card} from './Card.js'

const CONDITIONS = [
    'Near Mint',
    'Lightly Played',
    'Moderately Played',
    'Heavily Played',
    'Damaged',
]

const FINISHES = ['nonfoil', 'foil', 'etched']

/**
 * Represents owned copies of a specific card printing.
 */
export class CollectionEntry {
    /**
     * @param {Card} card Normalized card printing.
     * @param {Object} [options={}] Ownership details.
     * @param {number} [options.quantity=1] Number of owned copies.
     * @param {string} [options.condition='Near Mint'] Condition of the owned copies.
     * @param {'nonfoil'|'foil'|'etched'} [options.finish='nonfoil'] Finish of the owned copies.
     * @param {boolean} [options.favorite=false] Whether the entry is a favorite.
     * @param {boolean} [options.availableForTrade=false] Whether the entry is offered for trade.
     * @param {number|null} [options.purchasePriceMinor=null] Per-copy purchase cost in cents.
     * @param {'USD'} [options.currency='USD'] Currency used for the purchase cost.
     * @param {Object<string, number>} [options.binderQuantities={}]
     *   Binder IDs mapped to assigned copy counts.
     * @throws {TypeError} If the card or ownership details are invalid.
     */
    constructor(
        card,
        {
            quantity = 1,
            condition = 'Near Mint',
            finish = 'nonfoil',
            favorite = false,
            availableForTrade = false,
            purchasePriceMinor = null,
            currency = 'USD',
            binderQuantities = {},
        } = {},
    ) {
        if (!(card instanceof Card)) {
            throw new TypeError('Collection entry requires a Card instance.')
        }

        if (!Number.isSafeInteger(quantity) || quantity < 1) {
            throw new TypeError('Quantity must be a positive safe integer.')
        }

        if (!CONDITIONS.includes(condition)) {
            throw new TypeError('Unsupported card condition.')
        }

        if (!FINISHES.includes(finish)) {
            throw new TypeError('Unsupported card finish.')
        }

        if (!card.finishes.includes(finish)) {
            throw new TypeError('This finish is unavailable for the selected printing.')
        }

        if (
            purchasePriceMinor !== null &&
            (!Number.isSafeInteger(purchasePriceMinor) || purchasePriceMinor < 0)
        ) {
            throw new TypeError('Purchase price must be null or a nonnegative safe integer.')
        }

        if (currency !== 'USD') {
            throw new TypeError('Only USD is currently supported.')
        }

        if (
            binderQuantities === null ||
            typeof binderQuantities !== 'object' ||
            Array.isArray(binderQuantities) ||
            Object.getPrototypeOf(binderQuantities) !== Object.prototype
        ) {
            throw new TypeError('Binder quantities must be a plain object.')
        }

        let totalAssigned = 0

        for (const [binderId, assignedQuantity] of Object.entries(binderQuantities)) {
            if (binderId.trim() === '') {
                throw new TypeError('Binder IDs must not be blank.')
            }

            if (!Number.isSafeInteger(assignedQuantity) || assignedQuantity < 1) {
                throw new TypeError('Assigned quantities must be positive safe integers.')
            }

            totalAssigned += assignedQuantity

            if (totalAssigned > quantity) {
                throw new TypeError('Binder assignments cannot exceed the owned quantity.')
            }
        }

        if (typeof favorite !== 'boolean') {
            throw new TypeError('Favorite must be a boolean.')
        }

        if (typeof availableForTrade !== 'boolean') {
            throw new TypeError('Available for trade must be a boolean.')
        }

        this.card = card
        this.quantity = quantity
        this.condition = condition
        this.finish = finish
        this.purchasePriceMinor = purchasePriceMinor
        this.currency = currency
        this.binderQuantities = { ...binderQuantities }
        this.favorite = favorite
        this.availableForTrade = availableForTrade
    }
}