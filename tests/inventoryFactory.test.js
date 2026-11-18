import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { markRaw, ref, isProxy } from 'vue'
import { parse } from '@vue/compiler-sfc'
import { Card } from '../src/models/Card.js'
import { CardFactory } from '../src/factories/CardFactory.js'
import { Inventory } from '../src/models/Inventory.js'
import { InventoryFactory } from '../src/factories/InventoryFactory.js'

function storedEntry() {
  return {
    card: {
      scryfallId: 'printing-id',
      oracleId: null,
      name: 'Example card',
      setCode: 'TST',
      setName: 'Test set',
      collectorNumber: '12',
      typeLine: 'Artifact',
      rarity: 'rare',
      imageUrl: '',
      finishes: ['foil'],
    },
    quantity: 4,
    condition: 'Near Mint',
    finish: 'foil',
    purchasePriceMinor: 0,
    currency: 'USD',
    favorite: false,
    availableForTrade: true,
    binderQuantities: { binder: 3 },
  }
}

function ownership(entry) {
  return Object.fromEntries(
    [
      'quantity',
      'condition',
      'finish',
      'purchasePriceMinor',
      'currency',
      'favorite',
      'availableForTrade',
      'binderQuantities',
    ].map((field) => [field, entry[field]]),
  )
}

test('new entries choose a finish the printing actually offers', () => {
  const card = CardFactory.fromStoredData(storedEntry().card)
  const entry = InventoryFactory.create(card)
  assert.ok(entry instanceof Inventory)
  assert.equal(entry.finish, 'foil')
  assert.equal(entry.quantity, 1)
  assert.equal(entry.purchasePriceMinor, null)
  assert.throws(() => InventoryFactory.create(card, { finish: 'nonfoil' }))
})

test('existing document layout restores both models and preserves ownership values', () => {
  const data = storedEntry()
  const entry = InventoryFactory.fromStoredData(data)
  assert.ok(entry instanceof Inventory)
  assert.ok(entry.card instanceof Card)
  assert.deepEqual(ownership(entry), ownership(data))
  assert.deepEqual({ ...entry.card }, data.card)
  data.binderQuantities.binder = 99
  data.card.finishes.push('nonfoil')
  assert.deepEqual(entry.binderQuantities, { binder: 3 })
  assert.deepEqual(entry.card.finishes, ['foil'])
})

test('incomplete and invalid saved entries fail instead of getting creation defaults', () => {
  for (const field of Object.keys(storedEntry())) {
    const data = storedEntry()
    delete data[field]
    assert.throws(() => InventoryFactory.fromStoredData(data), TypeError)
  }
  assert.throws(() => InventoryFactory.fromStoredData({ ...storedEntry(), quantity: -1 }))
  assert.throws(() => InventoryFactory.fromStoredData(null))
})

test('editing copies keep valid and failed edits isolated from the original', () => {
  const original = InventoryFactory.fromStoredData(storedEntry())
  const draft = InventoryFactory.copy(original)
  draft.updateDetails({ quantity: 5, favorite: true })
  assert.equal(original.quantity, 4)
  assert.equal(original.favorite, false)
  assert.equal(draft.quantity, 5)
  const before = ownership(draft)
  assert.throws(() => draft.updateDetails({ quantity: 2, favorite: false }))
  assert.deepEqual(ownership(draft), before)
  assert.throws(() => {
    draft.quantity = 0
  }, TypeError)
  const assignments = draft.binderQuantities
  assignments.binder = 0
  assert.equal(draft.binderQuantities.binder, 3)
})

test('markRaw keeps restored private-field models usable inside Vue records', () => {
  const entry = InventoryFactory.fromStoredData(storedEntry())
  const records = ref([{ id: 'document-id', entry: markRaw(entry) }])
  const editing = ref(records.value[0])
  assert.equal(isProxy(editing.value.entry), false)
  assert.equal(editing.value.entry.quantity, 4)
  assert.equal(InventoryFactory.copy(editing.value.entry).quantity, 4)
})

// Exercise the actual script-setup submit handler without a browser or database write.
function form(initialEntry) {
  const filename = new URL('../src/components/cards/InventoryForm.vue', import.meta.url)
  const { descriptor } = parse(readFileSync(filename, 'utf8'))
  const script = descriptor.scriptSetup.content.replace(/^import .*$/gm, '')
  const events = []
  const props = {
    card: initialEntry?.card ?? CardFactory.fromStoredData(storedEntry().card),
    initialEntry,
    saving: false,
    saveError: '',
  }
  const setup = new Function(
    'ref',
    'Card',
    'Inventory',
    'InventoryFactory',
    'defineProps',
    'defineEmits',
    script + '\nreturn {quantity, purchasePrice, errorMessage, submitEntry}',
  )
  const state = setup(
    ref,
    Card,
    Inventory,
    InventoryFactory,
    () => props,
    () =>
      (...args) =>
        events.push(args),
  )
  return { ...state, events, props }
}

test('form emits a model for adding and an isolated updated model for editing', () => {
  const add = form(null)
  add.quantity.value = 2
  add.purchasePrice.value = '4.10'
  add.submitEntry()
  assert.ok(add.events[0][1] instanceof Inventory)
  assert.equal(add.events[0][1].purchasePriceMinor, 410)
  const original = InventoryFactory.fromStoredData(storedEntry())
  const edit = form(original)
  edit.quantity.value = 5
  edit.submitEntry()
  assert.equal(edit.events[0][0], 'submit')
  assert.equal(edit.events[0][1].quantity, 5)
  assert.equal(original.quantity, 4)
})

test('form rejects invalid edits and blocks submissions while saving', () => {
  const edit = form(InventoryFactory.fromStoredData(storedEntry()))
  edit.quantity.value = 2
  edit.submitEntry()
  assert.equal(edit.events.length, 0)
  assert.match(edit.errorMessage.value, /Binder assignments/)
  edit.quantity.value = 5
  edit.props.saving = true
  edit.submitEntry()
  assert.equal(edit.events.length, 0)
})

test('service writes the existing schema and restores models with separate metadata', async () => {
  const source = readFileSync(new URL('../src/services/collection.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\n/gm, '')
    .replace(/export async function/g, 'async function')
  let stored,
    lastPath,
    deleted = false
  const timestamp = { seconds: 123 }
  const factory = new Function(
    'InventoryFactory',
    'db',
    'addDoc',
    'collection',
    'deleteDoc',
    'doc',
    'getDocs',
    'orderBy',
    'query',
    'serverTimestamp',
    'runTransaction',
    source +
      '\nreturn {createCollectionEntry, getCollectionEntries, updateCollectionEntry, deleteCollectionEntry}',
  )
  const service = factory(
    InventoryFactory,
    {},
    async (_reference, data) => {
      stored = data
      return { id: 'document-id' }
    },
    (_db, ...path) => {
      lastPath = path
      return path
    },
    async () => {
      deleted = true
    },
    (_db, ...path) => {
      lastPath = path
      return path
    },
    async () => ({ docs: [{ id: 'document-id', data: () => stored }] }),
    (...args) => args,
    (...args) => args,
    () => timestamp,
    async (_db, callback) => {
      await callback({
        get: async () => ({ exists: () => true, data: () => stored }),
        update: (_reference, data) => {
          stored = { ...stored, ...data }
        },
      })
    },
  )

  const original = InventoryFactory.fromStoredData(storedEntry())
  assert.equal(await service.createCollectionEntry('owner', original), 'document-id')
  assert.deepEqual(lastPath, ['users', 'owner', 'inventory'])
  assert.deepEqual(
    Object.keys(stored).sort(),
    [...Object.keys(storedEntry()), 'createdAt', 'updatedAt'].sort(),
  )
  assert.equal(Object.getPrototypeOf(stored.card), Object.prototype)
  const [record] = await service.getCollectionEntries('owner')
  assert.equal(record.id, 'document-id')
  assert.ok(record.entry instanceof Inventory)
  assert.deepEqual(ownership(record.entry), ownership(original))
  assert.equal(record.createdAt, timestamp)
  assert.equal(record.entry.id, undefined)

  const draft = InventoryFactory.copy(record.entry)
  draft.updateDetails({ quantity: 6 })
  const savedCard = stored.card
  await service.updateCollectionEntry('owner', record.id, draft)
  assert.deepEqual(lastPath, ['users', 'owner', 'inventory', 'document-id'])
  assert.equal(stored.quantity, 6)
  assert.equal(stored.card, savedCard)
  assert.equal(record.entry.quantity, 4)
  await service.deleteCollectionEntry('owner', record.id)
  assert.equal(deleted, true)
})
