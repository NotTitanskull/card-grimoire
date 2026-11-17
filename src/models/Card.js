/**
 * Represents a specific card printing using application-owned fields.
 * Has no knowledge of API responses, Vue, or database operations.
 */
export class Card {
  /**
   * @param {Object} data Normalized card information.
   * @param {string} data.scryfallId Printing identifier.
   * @param {string|null} [data.oracleId=null] Shared card identity.
   * @param {string} data.name Card name.
   * @param {string} data.setCode Set code.
   * @param {string} data.setName Set name.
   * @param {string} data.collectorNumber Collector number.
   * @param {string} [data.typeLine=''] Card type description.
   * @param {string} [data.rarity=''] Printing rarity.
   * @param {string} [data.imageUrl=''] Display image URL.
   * @param {string[]} data.finishes Available finishes.
   * @throws {TypeError} If card information is invalid.
   */
  constructor(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new TypeError('Card information must be an object.')
    }

    const requiredFields = ['scryfallId', 'name', 'setCode', 'setName', 'collectorNumber']

    for (const field of requiredFields) {
      if (typeof data[field] !== 'string' || data[field].trim() === '') {
        throw new TypeError(`Card requires a nonempty "${field}" string.`)
      }
    }

    const oracleId = data.oracleId ?? null

    if (oracleId !== null && (typeof oracleId !== 'string' || oracleId.trim() === '')) {
      throw new TypeError('Oracle ID must be a nonempty string or null.')
    }

    const typeLine = data.typeLine ?? ''
    const rarity = data.rarity ?? ''
    const imageUrl = data.imageUrl ?? ''

    for (const [field, value] of Object.entries({ typeLine, rarity, imageUrl })) {
      if (typeof value !== 'string') {
        throw new TypeError(`Card "${field}" must be a string.`)
      }
    }

    const supportedFinishes = ['nonfoil', 'foil', 'etched']

    if (
      !Array.isArray(data.finishes) ||
      data.finishes.length === 0 ||
      !data.finishes.every((finish) => supportedFinishes.includes(finish))
    ) {
      throw new TypeError('Card requires valid available finishes.')
    }

    this.scryfallId = data.scryfallId
    this.oracleId = oracleId
    this.name = data.name
    this.setCode = data.setCode.toUpperCase()
    this.setName = data.setName
    this.collectorNumber = data.collectorNumber
    this.typeLine = typeLine
    this.rarity = rarity
    this.imageUrl = imageUrl
    this.finishes = [...data.finishes]
  }
}
