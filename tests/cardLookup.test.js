import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import { useCardLookup } from '../src/composables/useCardLookup.js'

const printing = {
  id: 'sample-printing',
  oracle_id: '12345678-1234-1234-1234-123456789abc',
  name: 'Sample card',
  set: 'tst',
  set_name: 'Test Set',
  collector_number: '1',
  finishes: ['nonfoil'],
}

function result(data, hasMore = false) {
  return Response.json({ data, has_more: hasMore, total_cards: data.length })
}

test('loads printing pages and returns to the existing name results', async (t) => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    const page = url.searchParams.get('page')
    const unique = url.searchParams.get('unique')
    requests.push([unique, page])

    if (unique === 'cards') return result([printing])
    if (page === '1') return result([{ ...printing, id: 'page-one' }], true)
    return result([{ ...printing, id: 'page-two' }])
  })

  const scope = effectScope()
  t.after(() => scope.stop())
  const lookup = scope.run(useCardLookup)

  await lookup.searchByName('Sample')
  const searchResults = lookup.cards.value
  await lookup.selectCard(searchResults[0])
  assert.equal(lookup.printingsHaveMore.value, true)
  await lookup.loadPrintings()
  assert.deepEqual(
    lookup.printings.value.map((card) => card.scryfallId),
    ['page-one', 'page-two'],
  )
  assert.equal(lookup.printingsHaveMore.value, false)

  lookup.backToSearchResults()
  assert.equal(lookup.selectedCard.value, null)
  assert.equal(lookup.cards.value, searchResults)
  assert.deepEqual(requests, [
    ['cards', '1'],
    ['prints', '1'],
    ['prints', '2'],
  ])
})

test('cancellation and scope disposal ignore late search responses', async (t) => {
  const pending = []
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => {
    const response = Promise.withResolvers()
    pending.push({ signal, resolve: response.resolve })
    return response.promise
  })

  const scope = effectScope()
  t.after(() => scope.stop())
  const lookup = scope.run(useCardLookup)

  const first = lookup.searchByName('First')
  lookup.cancelSearch()
  const second = lookup.searchByName('Second')
  assert.equal(pending[0].signal.aborted, true)
  pending[0].resolve(result([printing]))
  await first
  assert.equal(lookup.loading.value, true)
  assert.deepEqual(lookup.cards.value, [])

  scope.stop()
  assert.equal(pending[1].signal.aborted, true)
  pending[1].resolve(result([printing]))
  await second
  assert.equal(lookup.loading.value, false)
  assert.equal(lookup.searched.value, false)
  assert.deepEqual(lookup.cards.value, [])
})
