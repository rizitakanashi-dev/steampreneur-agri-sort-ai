import test from 'node:test'
import assert from 'node:assert/strict'
import { validateGradePercentages } from '../src/business/harvestValidation.js'

test('validateGradePercentages menolak nilai kosong', () => {
  const result = validateGradePercentages('', '')
  assert.deepEqual(result.errors, {
    gradeA: 'Grade A harus berupa angka.',
    gradeB: 'Grade B harus berupa angka.',
  })
})

test('validateGradePercentages menolak nilai negatif dan di atas 100', () => {
  assert.equal(validateGradePercentages('-1', '20').isValid, false)
  assert.equal(validateGradePercentages('101', '0').isValid, false)
})

test('validateGradePercentages menerima total Grade A dan B tepat 100', () => {
  const result = validateGradePercentages('60', '40')
  assert.equal(result.isValid, true)
  assert.deepEqual(result.errors, {})
})

test('validateGradePercentages menolak total Grade A dan B di atas 100', () => {
  const result = validateGradePercentages('60', '41')
  assert.equal(result.isValid, false)
  assert.equal(result.errors.gradeB, 'Total Grade A dan Grade B tidak boleh melebihi 100%.')
})

test('validateGradePercentages menolak input non-numerik', () => {
  const result = validateGradePercentages('abc', '20')
  assert.equal(result.isValid, false)
  assert.equal(result.errors.gradeA, 'Grade A harus berupa angka.')
})
