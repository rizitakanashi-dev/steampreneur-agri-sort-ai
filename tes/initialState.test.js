import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialState } from '../src/business/initialState.js'

test('createInitialState membuat state awal tanpa data panen', () => {
  assert.deepEqual(createInitialState(), { batches: [] })
})
