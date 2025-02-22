import { DeviceInfo } from "./deviceinfo";
import { IKeyBackupInfo } from "./keybackup";
export declare enum CrossSigningKey {
    Master = "master",
    SelfSigning = "self_signing",
    UserSigning = "user_signing"
}
export interface IEncryptedEventInfo {
    /**
     * whether the event is encrypted (if not encrypted, some of the other properties may not be set)
     */
    encrypted: boolean;
    /**
     * the sender's key
     */
    senderKey: string;
    /**
     * the algorithm used to encrypt the event
     */
    algorithm: string;
    /**
     * whether we can be sure that the owner of the senderKey sent the event
     */
    authenticated: boolean;
    /**
     * the sender's device information, if available
     */
    sender?: DeviceInfo;
    /**
     * if the event's ed25519 and curve25519 keys don't match (only meaningful if `sender` is set)
     */
    mismatchedSender: boolean;
}
export interface IRecoveryKey {
    keyInfo?: {
        pubkey: string;
        passphrase?: {
            algorithm: string;
            iterations: number;
            salt: string;
        };
    };
    privateKey: Uint8Array;
    encodedPrivateKey?: string;
}
export interface ICreateSecretStorageOpts {
    /**
     * Function called to await a secret storage key creation flow.
     * Returns:
     *     {Promise<Object>} Object with public key metadata, encoded private
     *     recovery key which should be disposed of after displaying to the user,
     *     and raw private key to avoid round tripping if needed.
     */
    createSecretStorageKey?: () => Promise<IRecoveryKey>;
    /**
     * The current key backup object. If passed,
     * the passphrase and recovery key from this backup will be used.
     */
    keyBackupInfo?: IKeyBackupInfo;
    /**
     * If true, a new key backup version will be
     * created and the private key stored in the new SSSS store. Ignored if keyBackupInfo
     * is supplied.
     */
    setupNewKeyBackup?: boolean;
    /**
     * Reset even if keys already exist.
     */
    setupNewSecretStorage?: boolean;
    /**
     * Function called to get the user's
     * current key backup passphrase. Should return a promise that resolves with a Uint8Array
     * containing the key, or rejects if the key cannot be obtained.
     */
    getKeyBackupPassphrase?: () => Promise<Uint8Array>;
}
export interface ISecretStorageKeyInfo {
    name: string;
    algorithm: string;
    iv: string;
    mac: string;
    passphrase: IPassphraseInfo;
}
export interface ISecretStorageKey {
    keyId: string;
    keyInfo: ISecretStorageKeyInfo;
}
export interface IPassphraseInfo {
    algorithm: "m.pbkdf2";
    iterations: number;
    salt: string;
    bits: number;
}
export interface IAddSecretStorageKeyOpts {
    name: string;
    passphrase: IPassphraseInfo;
    key: Uint8Array;
}
export interface IImportOpts {
    stage: string;
    successes: number;
    failures: number;
    total: number;
}
export interface IImportRoomKeysOpts {
    progressCallback?: (stage: IImportOpts) => void;
    untrusted?: boolean;
    source?: string;
}
//# sourceMappingURL=api.d.ts.map