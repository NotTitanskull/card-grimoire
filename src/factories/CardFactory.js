import { Card } from '../models/Card.js'

/**
 * Constructs Card models from supported data sources.
 */
export class CardFactory {
  /**
   * Translates a Scryfall printing into a Card.
   * @param {Object} printing Scryfall printing response.
   * @returns {Card} Validated card model.
   * @throws {TypeError} If the printing data is invalid.
   */
  static fromScryfall(printing) {
    if (!printing || typeof printing !== 'object' || Array.isArray(printing)) {
      throw new TypeError('Scryfall printing must be an object.')
    }

    return new Card({
      scryfallId: printing.id,
      oracleId: printing.oracle_id ?? null,
      name: printing.name,
      setCode: printing.set,
      setName: printing.set_name,
      collectorNumber: printing.collector_number,
      typeLine: printing.type_line ?? '',
      rarity: printing.rarity ?? '',
      imageUrl: printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal ?? '',
      finishes: printing.finishes,
    })
  }

  /**
   * Restores a Card from our saved card representation.
   * @param {Object} data Stored card fields.
   * @returns {Card} Validated card model.
   * @throws {TypeError} If the stored card data is invalid.
   */
  static fromStoredData(data) {
    return new Card(data)
  }
}
