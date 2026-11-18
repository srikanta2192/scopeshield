import type { DocumentSession } from "./types";

const DATABASE = "scopeshield-local-sessions";
const STORE = "sessions";
const SESSION_ID = "current";
const MAX_INACTIVE_MS = 7 * 24 * 60 * 60 * 1000;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalSession(input: Omit<DocumentSession, "id" | "updatedAt">): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put({ ...input, id: SESSION_ID, updatedAt: Date.now() } satisfies DocumentSession);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export async function loadLocalSession(): Promise<DocumentSession | null> {
  const database = await openDatabase();
  let session: DocumentSession | undefined;
  try {
    session = await new Promise<DocumentSession | undefined>((resolve, reject) => {
      const request = database.transaction(STORE).objectStore(STORE).get(SESSION_ID);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { database.close(); }
  if (session && Date.now() - session.updatedAt > MAX_INACTIVE_MS) {
    await clearLocalSession(); return null;
  }
  if (session) await saveLocalSession(session);
  return session ?? null;
}

export async function clearLocalSession(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(SESSION_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}
