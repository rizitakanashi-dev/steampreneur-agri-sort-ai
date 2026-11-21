import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateRegistrationInput,
  validateLoginInput,
  registerWithGmail,
  loginWithGmail,
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
    fullName: 'Pengguna Uji',
    email: 'Pengguna.Uji@gmail.com',
    password: 'ContohPassword123',
    confirmPassword: 'ContohPassword123',
  })
  assert.equal(res.isValid, true)
  assert.deepEqual(res.errors, {})
  assert.equal(res.sanitized.email, 'pengguna.uji@gmail.com')
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
      fullName: 'Petani Contoh',
      email: 'petani.contoh@gmail.com',
      password: 'ContohPassword123',
      confirmPassword: 'ContohPassword123',
    },
    storage
  )
  assert.equal(first.ok, true)
  assert.equal(first.user.email, 'petani.contoh@gmail.com')
  assert.equal(first.user.provider, 'gmail')

  const savedList = readRegisteredUsers(storage)
  assert.equal(savedList.length, 1)
  assert.equal(savedList[0].passwordHash, hashPassword('ContohPassword123'))
  assert.notEqual(savedList[0].passwordHash, 'ContohPassword123')

  const active = readActiveUser(storage)
  assert.equal(active.email, 'petani.contoh@gmail.com')

  const duplicate = registerWithGmail(
    {
      fullName: 'Petani Duplikat',
      email: 'PETANI.CONTOH@gmail.com',
      password: 'ContohPassword123',
      confirmPassword: 'ContohPassword123',
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
      email: 'akun.oauth@gmail.com',
    },
    storage
  )
  assert.equal(res.ok, true)
  assert.equal(res.user.provider, 'google')
  assert.equal(res.user.fullName, 'Akun Oauth')
  assert.equal(readActiveUser(storage).email, 'akun.oauth@gmail.com')

  logoutActiveUser(storage)
  assert.equal(readActiveUser(storage), null)
})

test('validateLoginInput dan loginWithGmail memverifikasi email dan password dengan benar', () => {
  const storage = createMemoryStorage()
  registerWithGmail(
    {
      fullName: 'Pengguna Uji',
      email: 'pengguna.login@gmail.com',
      password: 'ContohPassword123',
      confirmPassword: 'ContohPassword123',
    },
    storage
  )
  logoutActiveUser(storage)

  const invalidLogin = validateLoginInput({ email: 'bukan-gmail@yahoo.com', password: '' })
  assert.equal(invalidLogin.isValid, false)

  const wrongPass = loginWithGmail({ email: 'pengguna.login@gmail.com', password: 'SalahPassword1' }, storage)
  assert.equal(wrongPass.ok, false)
  assert.ok(wrongPass.errors.password)

  const validLogin = loginWithGmail({ email: 'PENGGUNA.LOGIN@gmail.com', password: 'ContohPassword123' }, storage)
  assert.equal(validLogin.ok, true)
  assert.equal(validLogin.user.email, 'pengguna.login@gmail.com')
  assert.equal(readActiveUser(storage).email, 'pengguna.login@gmail.com')
})
