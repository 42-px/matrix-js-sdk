"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SecretStorage = exports.SECRET_STORAGE_ALGORITHM_V1_AES = void 0;

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _logger = require("../logger");

var olmlib = _interopRequireWildcard(require("./olmlib"));

var _randomstring = require("../randomstring");

var _aes = require("./aes");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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
const SECRET_STORAGE_ALGORITHM_V1_AES = "m.secret_storage.v1.aes-hmac-sha2"; // Some of the key functions use a tuple and some use an object...

exports.SECRET_STORAGE_ALGORITHM_V1_AES = SECRET_STORAGE_ALGORITHM_V1_AES;

/**
 * Implements Secure Secret Storage and Sharing (MSC1946)
 * @module crypto/SecretStorage
 */
class SecretStorage {
  // In it's pure javascript days, this was relying on some proper Javascript-style
  // type-abuse where sometimes we'd pass in a fake client object with just the account
  // data methods implemented, which is all this class needs unless you use the secret
  // sharing code, so it was fine. As a low-touch TypeScript migration, this now has
  // an extra, optional param for a real matrix client, so you can not pass it as long
  // as you don't request any secrets.
  // A better solution would probably be to split this class up into secret storage and
  // secret sharing which are really two separate things, even though they share an MSC.
  constructor(accountDataAdapter, cryptoCallbacks, baseApis) {
    this.accountDataAdapter = accountDataAdapter;
    this.cryptoCallbacks = cryptoCallbacks;
    this.baseApis = baseApis;
    (0, _defineProperty2.default)(this, "requests", new Map());
  }

  async getDefaultKeyId() {
    const defaultKey = await this.accountDataAdapter.getAccountDataFromServer('m.secret_storage.default_key');
    if (!defaultKey) return null;
    return defaultKey.key;
  }

  setDefaultKeyId(keyId) {
    return new Promise((resolve, reject) => {
      const listener = ev => {
        if (ev.getType() === 'm.secret_storage.default_key' && ev.getContent().key === keyId) {
          this.accountDataAdapter.removeListener('accountData', listener);
          resolve();
        }
      };

      this.accountDataAdapter.on('accountData', listener);
      this.accountDataAdapter.setAccountData('m.secret_storage.default_key', {
        key: keyId
      }).catch(e => {
        this.accountDataAdapter.removeListener('accountData', listener);
        reject(e);
      });
    });
  }
  /**
   * Add a key for encrypting secrets.
   *
   * @param {string} algorithm the algorithm used by the key.
   * @param {object} opts the options for the algorithm.  The properties used
   *     depend on the algorithm given.
   * @param {string} [keyId] the ID of the key.  If not given, a random
   *     ID will be generated.
   *
   * @return {object} An object with:
   *     keyId: {string} the ID of the key
   *     keyInfo: {object} details about the key (iv, mac, passphrase)
   */


  async addKey(algorithm, opts, keyId) {
    const keyInfo = {
      algorithm
    };
    if (!opts) opts = {};

    if (opts.name) {
      keyInfo.name = opts.name;
    }

    if (algorithm === SECRET_STORAGE_ALGORITHM_V1_AES) {
      if (opts.passphrase) {
        keyInfo.passphrase = opts.passphrase;
      }

      if (opts.key) {
        const {
          iv,
          mac
        } = await (0, _aes.calculateKeyCheck)(opts.key);
        keyInfo.iv = iv;
        keyInfo.mac = mac;
      }
    } else {
      throw new Error(`Unknown key algorithm ${algorithm}`);
    }

    if (!keyId) {
      do {
        keyId = (0, _randomstring.randomString)(32);
      } while (await this.accountDataAdapter.getAccountDataFromServer(`m.secret_storage.key.${keyId}`));
    }

    await this.accountDataAdapter.setAccountData(`m.secret_storage.key.${keyId}`, keyInfo);
    return {
      keyId,
      keyInfo
    };
  }
  /**
   * Get the key information for a given ID.
   *
   * @param {string} [keyId = default key's ID] The ID of the key to check
   *     for. Defaults to the default key ID if not provided.
   * @returns {Array?} If the key was found, the return value is an array of
   *     the form [keyId, keyInfo].  Otherwise, null is returned.
   *     XXX: why is this an array when addKey returns an object?
   */


  async getKey(keyId) {
    if (!keyId) {
      keyId = await this.getDefaultKeyId();
    }

    if (!keyId) {
      return null;
    }

    const keyInfo = await this.accountDataAdapter.getAccountDataFromServer("m.secret_storage.key." + keyId);
    return keyInfo ? [keyId, keyInfo] : null;
  }
  /**
   * Check whether we have a key with a given ID.
   *
   * @param {string} [keyId = default key's ID] The ID of the key to check
   *     for. Defaults to the default key ID if not provided.
   * @return {boolean} Whether we have the key.
   */


  async hasKey(keyId) {
    return Boolean(await this.getKey(keyId));
  }
  /**
   * Check whether a key matches what we expect based on the key info
   *
   * @param {Uint8Array} key the key to check
   * @param {object} info the key info
   *
   * @return {boolean} whether or not the key matches
   */


  async checkKey(key, info) {
    if (info.algorithm === SECRET_STORAGE_ALGORITHM_V1_AES) {
      if (info.mac) {
        const {
          mac
        } = await (0, _aes.calculateKeyCheck)(key, info.iv);
        return info.mac.replace(/=+$/g, '') === mac.replace(/=+$/g, '');
      } else {
        // if we have no information, we have to assume the key is right
        return true;
      }
    } else {
      throw new Error("Unknown algorithm");
    }
  }
  /**
   * Store an encrypted secret on the server
   *
   * @param {string} name The name of the secret
   * @param {string} secret The secret contents.
   * @param {Array} keys The IDs of the keys to use to encrypt the secret
   *     or null/undefined to use the default key.
   */


  async store(name, secret, keys) {
    const encrypted = {};

    if (!keys) {
      const defaultKeyId = await this.getDefaultKeyId();

      if (!defaultKeyId) {
        throw new Error("No keys specified and no default key present");
      }

      keys = [defaultKeyId];
    }

    if (keys.length === 0) {
      throw new Error("Zero keys given to encrypt with!");
    }

    for (const keyId of keys) {
      // get key information from key storage
      const keyInfo = await this.accountDataAdapter.getAccountDataFromServer("m.secret_storage.key." + keyId);

      if (!keyInfo) {
        throw new Error("Unknown key: " + keyId);
      } // encrypt secret, based on the algorithm


      if (keyInfo.algorithm === SECRET_STORAGE_ALGORITHM_V1_AES) {
        const keys = {
          [keyId]: keyInfo
        };
        const [, encryption] = await this.getSecretStorageKey(keys, name);
        encrypted[keyId] = await encryption.encrypt(secret);
      } else {
        _logger.logger.warn("unknown algorithm for secret storage key " + keyId + ": " + keyInfo.algorithm); // do nothing if we don't understand the encryption algorithm

      }
    } // save encrypted secret


    await this.accountDataAdapter.setAccountData(name, {
      encrypted
    });
  }
  /**
   * Get a secret from storage.
   *
   * @param {string} name the name of the secret
   *
   * @return {string} the contents of the secret
   */


  async get(name) {
    const secretInfo = await this.accountDataAdapter.getAccountDataFromServer(name);

    if (!secretInfo) {
      return;
    }

    if (!secretInfo.encrypted) {
      throw new Error("Content is not encrypted!");
    } // get possible keys to decrypt


    const keys = {};

    for (const keyId of Object.keys(secretInfo.encrypted)) {
      // get key information from key storage
      const keyInfo = await this.accountDataAdapter.getAccountDataFromServer("m.secret_storage.key." + keyId);
      const encInfo = secretInfo.encrypted[keyId]; // only use keys we understand the encryption algorithm of

      if (keyInfo.algorithm === SECRET_STORAGE_ALGORITHM_V1_AES) {
        if (encInfo.iv && encInfo.ciphertext && encInfo.mac) {
          keys[keyId] = keyInfo;
        }
      }
    }

    if (Object.keys(keys).length === 0) {
      throw new Error(`Could not decrypt ${name} because none of ` + `the keys it is encrypted with are for a supported algorithm`);
    }

    let keyId;
    let decryption;

    try {
      // fetch private key from app
      [keyId, decryption] = await this.getSecretStorageKey(keys, name);
      const encInfo = secretInfo.encrypted[keyId]; // We don't actually need the decryption object if it's a passthrough
      // since we just want to return the key itself. It must be base64
      // encoded, since this is how a key would normally be stored.

      if (encInfo.passthrough) return (0, olmlib.encodeBase64)(decryption.get_private_key());
      return await decryption.decrypt(encInfo);
    } finally {
      if (decryption && decryption.free) decryption.free();
    }
  }
  /**
   * Check if a secret is stored on the server.
   *
   * @param {string} name the name of the secret
   * @param {boolean} checkKey check if the secret is encrypted by a trusted key
   *
   * @return {object?} map of key name to key info the secret is encrypted
   *     with, or null if it is not present or not encrypted with a trusted
   *     key
   */


  async isStored(name, checkKey) {
    // check if secret exists
    const secretInfo = await this.accountDataAdapter.getAccountDataFromServer(name);
    if (!secretInfo) return null;

    if (!secretInfo.encrypted) {
      return null;
    }

    if (checkKey === undefined) checkKey = true;
    const ret = {}; // filter secret encryption keys with supported algorithm

    for (const keyId of Object.keys(secretInfo.encrypted)) {
      // get key information from key storage
      const keyInfo = await this.accountDataAdapter.getAccountDataFromServer("m.secret_storage.key." + keyId);
      if (!keyInfo) continue;
      const encInfo = secretInfo.encrypted[keyId]; // only use keys we understand the encryption algorithm of

      if (keyInfo.algorithm === SECRET_STORAGE_ALGORITHM_V1_AES) {
        if (encInfo.iv && encInfo.ciphertext && encInfo.mac) {
          ret[keyId] = keyInfo;
        }
      }
    }

    return Object.keys(ret).length ? ret : null;
  }
  /**
   * Request a secret from another device
   *
   * @param {string} name the name of the secret to request
   * @param {string[]} devices the devices to request the secret from
   */


  request(name, devices) {
    const requestId = this.baseApis.makeTxnId();
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.requests.set(requestId, {
      name,
      devices,
      resolve,
      reject
    });

    const cancel = reason => {
      // send cancellation event
      const cancelData = {
        action: "request_cancellation",
        requesting_device_id: this.baseApis.deviceId,
        request_id: requestId
      };
      const toDevice = {};

      for (const device of devices) {
        toDevice[device] = cancelData;
      }

      this.baseApis.sendToDevice("m.secret.request", {
        [this.baseApis.getUserId()]: toDevice
      }); // and reject the promise so that anyone waiting on it will be
      // notified

      reject(new Error(reason || "Cancelled"));
    }; // send request to devices


    const requestData = {
      name,
      action: "request",
      requesting_device_id: this.baseApis.deviceId,
      request_id: requestId
    };
    const toDevice = {};

    for (const device of devices) {
      toDevice[device] = requestData;
    }

    _logger.logger.info(`Request secret ${name} from ${devices}, id ${requestId}`);

    this.baseApis.sendToDevice("m.secret.request", {
      [this.baseApis.getUserId()]: toDevice
    });
    return {
      requestId,
      promise,
      cancel
    };
  }

  async onRequestReceived(event) {
    const sender = event.getSender();
    const content = event.getContent();

    if (sender !== this.baseApis.getUserId() || !(content.name && content.action && content.requesting_device_id && content.request_id)) {
      // ignore requests from anyone else, for now
      return;
    }

    const deviceId = content.requesting_device_id; // check if it's a cancel

    if (content.action === "request_cancellation") {
      /*
      Looks like we intended to emit events when we got cancelations, but
      we never put anything in the _incomingRequests object, and the request
      itself doesn't use events anyway so if we were to wire up cancellations,
      they probably ought to use the same callback interface. I'm leaving them
      disabled for now while converting this file to typescript.
      if (this._incomingRequests[deviceId]
          && this._incomingRequests[deviceId][content.request_id]) {
          logger.info(
              "received request cancellation for secret (" + sender +
              ", " + deviceId + ", " + content.request_id + ")",
          );
          this.baseApis.emit("crypto.secrets.requestCancelled", {
              user_id: sender,
              device_id: deviceId,
              request_id: content.request_id,
          });
      }
      */
    } else if (content.action === "request") {
      if (deviceId === this.baseApis.deviceId) {
        // no point in trying to send ourself the secret
        return;
      } // check if we have the secret


      _logger.logger.info("received request for secret (" + sender + ", " + deviceId + ", " + content.request_id + ")");

      if (!this.cryptoCallbacks.onSecretRequested) {
        return;
      }

      const secret = await this.cryptoCallbacks.onSecretRequested(sender, deviceId, content.request_id, content.name, this.baseApis.checkDeviceTrust(sender, deviceId));

      if (secret) {
        _logger.logger.info(`Preparing ${content.name} secret for ${deviceId}`);

        const payload = {
          type: "m.secret.send",
          content: {
            request_id: content.request_id,
            secret: secret
          }
        };
        const encryptedContent = {
          algorithm: olmlib.OLM_ALGORITHM,
          sender_key: this.baseApis.crypto.olmDevice.deviceCurve25519Key,
          ciphertext: {}
        };
        await olmlib.ensureOlmSessionsForDevices(this.baseApis.crypto.olmDevice, this.baseApis, {
          [sender]: [this.baseApis.getStoredDevice(sender, deviceId)]
        });
        await olmlib.encryptMessageForDevice(encryptedContent.ciphertext, this.baseApis.getUserId(), this.baseApis.deviceId, this.baseApis.crypto.olmDevice, sender, this.baseApis.getStoredDevice(sender, deviceId), payload);
        const contentMap = {
          [sender]: {
            [deviceId]: encryptedContent
          }
        };

        _logger.logger.info(`Sending ${content.name} secret for ${deviceId}`);

        this.baseApis.sendToDevice("m.room.encrypted", contentMap);
      } else {
        _logger.logger.info(`Request denied for ${content.name} secret for ${deviceId}`);
      }
    }
  }

  onSecretReceived(event) {
    if (event.getSender() !== this.baseApis.getUserId()) {
      // we shouldn't be receiving secrets from anyone else, so ignore
      // because someone could be trying to send us bogus data
      return;
    }

    const content = event.getContent();

    _logger.logger.log("got secret share for request", content.request_id);

    const requestControl = this.requests.get(content.request_id);

    if (requestControl) {
      // make sure that the device that sent it is one of the devices that
      // we requested from
      const deviceInfo = this.baseApis.crypto.deviceList.getDeviceByIdentityKey(olmlib.OLM_ALGORITHM, event.getSenderKey());

      if (!deviceInfo) {
        _logger.logger.log("secret share from unknown device with key", event.getSenderKey());

        return;
      }

      if (!requestControl.devices.includes(deviceInfo.deviceId)) {
        _logger.logger.log("unsolicited secret share from device", deviceInfo.deviceId);

        return;
      }

      _logger.logger.log(`Successfully received secret ${requestControl.name} ` + `from ${deviceInfo.deviceId}`);

      requestControl.resolve(content.secret);
    }
  }

  async getSecretStorageKey(keys, name) {
    if (!this.cryptoCallbacks.getSecretStorageKey) {
      throw new Error("No getSecretStorageKey callback supplied");
    }

    const returned = await this.cryptoCallbacks.getSecretStorageKey({
      keys
    }, name);

    if (!returned) {
      throw new Error("getSecretStorageKey callback returned falsey");
    }

    if (returned.length < 2) {
      throw new Error("getSecretStorageKey callback returned invalid data");
    }

    const [keyId, privateKey] = returned;

    if (!keys[keyId]) {
      throw new Error("App returned unknown key from getSecretStorageKey!");
    }

    if (keys[keyId].algorithm === SECRET_STORAGE_ALGORITHM_V1_AES) {
      const decryption = {
        encrypt: async function (secret) {
          return await (0, _aes.encryptAES)(secret, privateKey, name);
        },
        decrypt: async function (encInfo) {
          return await (0, _aes.decryptAES)(encInfo, privateKey, name);
        }
      };
      return [keyId, decryption];
    } else {
      throw new Error("Unknown key type: " + keys[keyId].algorithm);
    }
  }

}

exports.SecretStorage = SecretStorage;