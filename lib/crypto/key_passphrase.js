"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.deriveKey = deriveKey;
exports.keyFromAuthData = keyFromAuthData;
exports.keyFromPassphrase = keyFromPassphrase;

var _randomstring = require("../randomstring");

/*
Copyright 2018 - 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const DEFAULT_ITERATIONS = 500000;
const DEFAULT_BITSIZE = 256;
/* eslint-disable camelcase */

async function keyFromAuthData(authData, password) {
  if (!global.Olm) {
    throw new Error("Olm is not available");
  }

  if (!authData.private_key_salt || !authData.private_key_iterations) {
    throw new Error("Salt and/or iterations not found: " + "this backup cannot be restored with a passphrase");
  }

  return await deriveKey(password, authData.private_key_salt, authData.private_key_iterations, authData.private_key_bits || DEFAULT_BITSIZE);
}

async function keyFromPassphrase(password) {
  if (!global.Olm) {
    throw new Error("Olm is not available");
  }

  const salt = (0, _randomstring.randomString)(32);
  const key = await deriveKey(password, salt, DEFAULT_ITERATIONS, DEFAULT_BITSIZE);
  return {
    key,
    salt,
    iterations: DEFAULT_ITERATIONS
  };
}

async function deriveKey(password, salt, iterations, numBits = DEFAULT_BITSIZE) {
  const subtleCrypto = global.crypto.subtle;
  const TextEncoder = global.TextEncoder;

  if (!subtleCrypto || !TextEncoder) {
    // TODO: Implement this for node
    throw new Error("Password-based backup is not avaiable on this platform");
  }

  const key = await subtleCrypto.importKey('raw', new TextEncoder().encode(password), {
    name: 'PBKDF2'
  }, false, ['deriveBits']);
  const keybits = await subtleCrypto.deriveBits({
    name: 'PBKDF2',
    salt: new TextEncoder().encode(salt),
    iterations: iterations,
    hash: 'SHA-512'
  }, key, numBits);
  return new Uint8Array(keybits);
}