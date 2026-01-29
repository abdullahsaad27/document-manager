import type { LibraryDocument, StructuredContentItem } from '../types';

const DB_NAME = 'DocumentExpertDB';
const DB_VERSION = 2; // Incremented version
const STORE_NAME = 'library';
const CACHE_STORE_NAME = 'cacheStore';

let db: IDBDatabase;

export const initDB = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        if (db) return resolve(true);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Database error:', request.error);
            reject('Error opening database');
        };

        request.onsuccess = (event) => {
            db = (event.target as IDBOpenDBRequest).result;
            resolve(true);
        };

        request.onupgradeneeded = (event) => {
            const dbInstance = (event.target as IDBOpenDBRequest).result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
             // New store for version 2
            if (!dbInstance.objectStoreNames.contains(CACHE_STORE_NAME)) {
                dbInstance.createObjectStore(CACHE_STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveDocument = (doc: Omit<LibraryDocument, 'id'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(doc);

        request.onsuccess = () => {
            resolve(request.result as number);
        };

        request.onerror = () => {
            console.error('Error saving document:', request.error);
            reject('Could not save document.');
        };
    });
};

export const getDocuments = (): Promise<LibraryDocument[]> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            // Sort by createdAt date descending
            const sorted = request.result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            resolve(sorted);
        };

        request.onerror = () => {
            console.error('Error fetching documents:', request.error);
            reject('Could not fetch documents.');
        };
    });
};

export const deleteDocument = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error('Error deleting document:', request.error);
            reject('Could not delete document.');
        };
    });
};


// --- Caching Functions ---
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const setCache = (id: string, data: any): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CACHE_STORE_NAME);
        const request = store.put({ id, data, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = (e) => {
            console.error("Error saving cache:", request.error);
            reject('Could not save cache.');
        }
    });
};

const deleteCache = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CACHE_STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Could not delete cache item.');
    });
};

export const getCache = (id: string): Promise<any | null> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(CACHE_STORE_NAME, 'readonly');
        const store = transaction.objectStore(CACHE_STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            if (request.result) {
                const isStale = Date.now() - request.result.timestamp > CACHE_TTL;
                if (isStale) {
                    // Delete the stale cache entry asynchronously
                    deleteCache(id).finally(() => resolve(null));
                } else {
                    resolve(request.result.data);
                }
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject('Could not fetch cache.');
    });
};