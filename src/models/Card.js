/**
 * Represents a specific card printing.
 * Contains card information, not ownership or database behavior.
 */
export class Card {
    /**
     * Creates a card from Scryfall printing data.
     * @param {Object} printing Card data returned by Scryfall.
     * @param {string} printing.id Unique printing identifier.
     * @param {string} printing.name Card name.
     * @param {string} printing.set Set code.
     * @param {string} printing.set_name Set display name.
     * @param {string} printing.collector_number Collector number.
     * @param {string} [printing.type_line] Card type description.
     * @param {string} [printing.rarity] Printing rarity.
     * @param {{normal?: string}} [printing.image_uris] Main card image URLs.
     * @param {Array<{image_uris?: {normal?: string}}>} [printing.card_faces]
     *   Individual faces for cards with separate face images.
     * @throws {TypeError} If printing data or a required field is invalid.
     */
    constructor(printing) {
        if (!printing || typeof printing !== 'object' || Array.isArray(printing)) {
            throw new TypeError('Card printing data must be an object.')
        }

        const requiredFields = [
            'id',
            'name',
            'set',
            'set_name',
            'collector_number',
        ]

        for (const field of requiredFields) {
            if (
                typeof printing[field] !== 'string' ||
                printing[field].trim() === ''
            ) {
                throw new TypeError(`Card printing requires a nonempty "${field}" string.`)
            }
        }

        this.scryfallId = printing.id
        this.name = printing.name
        this.setCode = printing.set.toUpperCase()
        this.setName = printing.set_name
        this.collectorNumber = printing.collector_number
        this.typeLine = printing.type_line ?? ''
        this.rarity = printing.rarity ?? ''
        this.imageUrl =
            printing.image_uris?.normal ??
            printing.card_faces?.[0]?.image_uris?.normal ??
            ''
    }
}