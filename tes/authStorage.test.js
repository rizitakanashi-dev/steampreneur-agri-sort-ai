import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateRegistrationInput,
  registerWithGmail,
  registerWithGoogleAccount,
  readActiveUser,
  readRegisteredUsers,
  logoutActiveUser,
  hashPassword,
} from '../src/business/authStorage.js'

function createMemoryStorage() {
  const store = new Map()
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, val) {
      store.set(key, String(val))
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

test('validateRegistrationInput menerima input Gmail dan password yang valid', () => {
  const res = validateRegistrationInput({
    fullName: 'Hieray Antovino',
    email: 'Hieray.Agri@gmail.com',
    password: 'Password123',
    confirmPassword: 'Password123',
  })
  assert.equal(res.isValid, true)
  assert.deepEqual(res.errors, {})
  assert.equal(res.sanitized.email, 'hieray.agri@gmail.com')
})

test('validateRegistrationInput menolak email non-gmail dan password lemah', () => {
  const res = validateRegistrationInput({
    fullName: 'Hi',
    email: 'user@yahoo.com',
    password: '123',
    confirmPassword: '456',
  })
  assert.equal(res.isValid, false)
  assert.ok(res.errors.fullName)
  assert.ok(res.errors.email)
  assert.ok(res.errors.password)
  assert.ok(res.errors.confirmPassword)
})

test('registerWithGmail menyimpan user baru, melakukan hash password, dan menolak duplikat Gmail', () => {
  const storage = createMemoryStorage()
  const first = registerWithGmail(
    {
      fullName: 'Faris Al Farizi',
      email: 'faris.ml@gmail.com',
      password: 'AgriSort2026',
      confirmPassword: 'AgriSort2026',
    },
    storage
  )
  assert.equal(first.ok, true)
  assert.equal(first.user.email, 'faris.ml@gmail.com')
  assert.equal(first.user.provider, 'gmail')

  const savedList = readRegisteredUsers(storage)
  assert.equal(savedList.length, 1)
  assert.equal(savedList[0].passwordHash, hashPassword('AgriSort2026'))
  assert.notEqual(savedList[0].passwordHash, 'AgriSort2026')

  const active = readActiveUser(storage)
  assert.equal(active.email, 'faris.ml@gmail.com')

  const duplicate = registerWithGmail(
    {
      fullName: 'Faris Duplikat',
      email: 'FARIS.ML@gmail.com',
      password: 'AgriSort2026',
      confirmPassword: 'AgriSort2026',
    },
    storage
  )
  assert.equal(duplicate.ok, false)
  assert.ok(duplicate.errors.email)
})

test('registerWithGoogleAccount mendaftarkan akun Google setelah persetujuan dan mengatur sesi aktif', () => {
  const storage = createMemoryStorage()
  const res = registerWithGoogleAccount(
    {
      email: 'afif.qa@gmail.com',
    },
    storage
  )
  assert.equal(res.ok, true)
  assert.equal(res.user.provider, 'google')
  assert.equal(res.user.fullName, 'Afif Qa')
  assert.equal(readActiveUser(storage).email, 'afif.qa@gmail.com')

  logoutActiveUser(storage)
  assert.equal(readActiveUser(storage), null)
})
