import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { devLog, devWarn } from "@/lib/devConsole";

/** SecureStore keys must be alphanumeric plus `.`, `-`, `_` only (no colons). */
const CREDENTIALS_KEY = "zoneweaver_remember_credentials";
/** Android fallback: Keystore entries are often lost after reinstall, backup, or process death. */
const CREDENTIALS_FALLBACK_KEY = "zoneweaver_remember_credentials_fb";

/**
 * iOS-only accessibility. Do not pass `keychainAccessible` on Android — it is
 * ignored by the native module and has caused read/write mismatches.
 */
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions =
  Platform.OS === "ios"
    ? {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
        requireAuthentication: false,
      }
    : { requireAuthentication: false };

type StoredCredentials = {
  email: string;
  password: string;
};

function isSecureStoreDecryptError(err: unknown): boolean {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  return /decrypt|encrypt|keychain|keystore|invalidated|not authenticated/i.test(
    message,
  );
}

async function clearSecureStoreEntry(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY, SECURE_STORE_OPTIONS);
  } catch {
    /* ignore */
  }
}

async function readFallbackCredentials(): Promise<StoredCredentials | null> {
  try {
    const raw = await AsyncStorage.getItem(CREDENTIALS_FALLBACK_KEY);
    if (!raw) return null;
    return parseCredentials(raw);
  } catch {
    return null;
  }
}

async function writeFallbackCredentials(
  payload: StoredCredentials,
): Promise<boolean> {
  try {
    await AsyncStorage.setItem(
      CREDENTIALS_FALLBACK_KEY,
      JSON.stringify(payload),
    );
    const verify = await AsyncStorage.getItem(CREDENTIALS_FALLBACK_KEY);
    return verify === JSON.stringify(payload);
  } catch (err) {
    devWarn("Failed to save Remember Me fallback credentials", { err });
    return false;
  }
}

async function clearFallbackCredentials(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CREDENTIALS_FALLBACK_KEY);
  } catch {
    /* ignore */
  }
}

function parseCredentials(raw: string): StoredCredentials | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredCredentials>;
    const email = typeof parsed.email === "string" ? parsed.email.trim() : "";
    const password =
      typeof parsed.password === "string" ? parsed.password : "";
    if (!email || !password) return null;
    return { email, password };
  } catch {
    return null;
  }
}

async function readSecureStoreCredentials(): Promise<StoredCredentials | null> {
  const available = await SecureStore.isAvailableAsync();
  if (!available) return null;

  try {
    const raw = await SecureStore.getItemAsync(
      CREDENTIALS_KEY,
      SECURE_STORE_OPTIONS,
    );
    if (!raw) return null;
    return parseCredentials(raw);
  } catch (err) {
    if (isSecureStoreDecryptError(err)) {
      await clearSecureStoreEntry();
    }
    devWarn("Failed to read Remember Me credentials from SecureStore", { err });
    return null;
  }
}

async function writeSecureStoreCredentials(
  payload: StoredCredentials,
): Promise<boolean> {
  const available = await SecureStore.isAvailableAsync();
  if (!available) return false;

  const serialized = JSON.stringify(payload);
  try {
    await SecureStore.setItemAsync(
      CREDENTIALS_KEY,
      serialized,
      SECURE_STORE_OPTIONS,
    );
    const verify = await SecureStore.getItemAsync(
      CREDENTIALS_KEY,
      SECURE_STORE_OPTIONS,
    );
    return verify === serialized;
  } catch (err) {
    if (isSecureStoreDecryptError(err)) {
      await clearSecureStoreEntry();
      try {
        await SecureStore.setItemAsync(
          CREDENTIALS_KEY,
          serialized,
          SECURE_STORE_OPTIONS,
        );
        const verify = await SecureStore.getItemAsync(
          CREDENTIALS_KEY,
          SECURE_STORE_OPTIONS,
        );
        return verify === serialized;
      } catch (retryErr) {
        devWarn("Failed to save Remember Me credentials after retry", {
          err: retryErr,
        });
        return false;
      }
    }
    devWarn("Failed to save Remember Me credentials", { err });
    return false;
  }
}

export async function setSecureCredentials(
  email: string,
  password: string,
): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed || !password) return;

  const payload: StoredCredentials = { email: trimmed, password };

  // Android Keystore often verifies in-process then returns null after a
  // restart. Always persist the AsyncStorage copy first so Remember Me
  // survives even when SecureStore later fails to decrypt.
  if (Platform.OS === "android") {
    const fallbackStored = await writeFallbackCredentials(payload);
    const secureStored = await writeSecureStoreCredentials(payload);
    if (!fallbackStored && !secureStored) {
      devWarn("Remember Me: could not persist credentials on Android");
    } else {
      devLog("Remember Me: saved credentials", {
        email: trimmed,
        secureStore: secureStored,
        fallback: fallbackStored,
      });
    }
    return;
  }

  const stored = await writeSecureStoreCredentials(payload);
  if (stored) {
    await clearFallbackCredentials();
    return;
  }

  await writeFallbackCredentials(payload);
}

export async function getSecureCredentials(): Promise<StoredCredentials | null> {
  // On Android the AsyncStorage copy is the reliable store after restarts;
  // SecureStore often verifies in-process then returns null on the next launch.
  if (Platform.OS === "android") {
    const fallback = await readFallbackCredentials();
    if (fallback) return fallback;
    return readSecureStoreCredentials();
  }

  const secure = await readSecureStoreCredentials();
  if (secure) return secure;
  return readFallbackCredentials();
}

export async function clearSecureCredentials(): Promise<void> {
  await clearSecureStoreEntry();
  await clearFallbackCredentials();
}
