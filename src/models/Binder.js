/**
 * Represents a named binder in a user's collection.
 */
export class Binder {
  #name

  /**
   * @param {string} name Name entered by the user or loaded from storage.
   * @throws {TypeError} If the name is missing, blank, or not a string.
   */
  constructor(name) {
    if (typeof name !== 'string') {
      throw new TypeError('Binder name must be a string.')
    }

    const trimmedName = name.trim()

    if (trimmedName === '') {
      throw new TypeError('Binder name cannot be blank.')
    }

    this.#name = trimmedName
  }

  get name() {
    return this.#name
  }
}
