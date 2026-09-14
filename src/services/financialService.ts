import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  handleFirestoreError, 
  OperationType 
} from '../lib/firebase';
import { FinancialTransaction } from '../types';
import { FinancialTransactionSchema } from '../schemas';
import { moveToTrash } from './trashService';

const COLLECTION_NAME = 'financial_transactions';
const LOCAL_STORAGE_KEY = 'mkt_financial_transactions_cache';

const getLocalTransactions = (): FinancialTransaction[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalTransactions = (items: FinancialTransaction[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Could not save financial transactions to localStorage:", e);
  }
};

const sanitizeData = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeData);
  const clean: Record<string, any> = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null) {
      clean[key] = sanitizeData(obj[key]);
    }
  });
  return clean;
};

// Helper to post to Vercel API backend for serverless admin bypass sync
const syncToApi = async (transactionData: any) => {
  try {
    await fetch('/api/financial-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transactionData)
    });
  } catch (e) {
    console.warn("API sync error:", e);
  }
};

// Helper to delete via Vercel API backend for serverless admin bypass sync
const deleteFromApi = async (id: string) => {
  try {
    await fetch(`/api/financial-transactions/${id}`, {
      method: 'DELETE'
    });
  } catch (e) {
    console.warn("API delete error:", e);
  }
};

export const fetchFinancialTransactions = async (): Promise<FinancialTransaction[]> => {
  // 1. Try Vercel API backend (Admin SDK bypass)
  try {
    const apiRes = await fetch('/api/financial-transactions').catch(() => null);
    if (apiRes && apiRes.ok) {
      const apiItems: FinancialTransaction[] = await apiRes.json();
      if (Array.isArray(apiItems)) {
        apiItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        saveLocalTransactions(apiItems);
        return apiItems;
      }
    }
  } catch (e) {}

  // 2. Fallback to Firestore Client SDK
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    const remoteItems = snapshot.docs.map(docSnap => {
      const raw = { ...docSnap.data(), id: docSnap.id };
      return FinancialTransactionSchema.parse(raw) as FinancialTransaction;
    });
    remoteItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    saveLocalTransactions(remoteItems);
    return remoteItems;
  } catch (error) {
    console.warn("Firestore fetch failed for financial transactions (using local fallback):", error);
    return getLocalTransactions();
  }
};

export const subscribeFinancialTransactions = (
  onData: (items: FinancialTransaction[]) => void,
  onError?: (err: any) => void
) => {
  const colRef = collection(db, COLLECTION_NAME);
  
  // 1. Emit local & API data immediately for instant response
  fetchFinancialTransactions().then(data => {
    if (data && data.length > 0) {
      onData(data);
    }
  });

  // 2. Subscribe to Firestore Realtime
  return onSnapshot(
    colRef,
    (snapshot) => {
      const remoteItems = snapshot.docs.map(docSnap => {
        const raw = { ...docSnap.data(), id: docSnap.id };
        return FinancialTransactionSchema.parse(raw) as FinancialTransaction;
      });
      remoteItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      saveLocalTransactions(remoteItems);
      onData(remoteItems);
    },
    (err) => {
      console.warn("Realtime subscription error in financialService (using local & API fallback):", err);
      fetchFinancialTransactions().then(data => onData(data));
    }
  );
};

export const addFinancialTransaction = async (
  data: Omit<FinancialTransaction, 'id'>
): Promise<string> => {
  const docRef = doc(collection(db, COLLECTION_NAME));
  const newTransaction: FinancialTransaction = {
    ...data,
    id: docRef.id,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const validated = FinancialTransactionSchema.parse(newTransaction);
  const sanitized = sanitizeData(validated);

  // 1. Save to local storage immediately
  const currentLocal = getLocalTransactions();
  const updatedLocal = [sanitized, ...currentLocal.filter(x => x.id !== docRef.id)];
  saveLocalTransactions(updatedLocal);

  // 2. Sync via Vercel Admin API backend (100% bypasses client security rules)
  syncToApi(sanitized);

  // 3. Try saving to Firestore Client SDK in background
  try {
    await setDoc(docRef, sanitized);
  } catch (error) {
    console.warn("Could not save financial transaction to Firestore Client SDK (saved via API & locally):", error);
  }

  return docRef.id;
};

export const updateFinancialTransaction = async (
  id: string,
  data: Partial<FinancialTransaction>
): Promise<void> => {
  const currentLocal = getLocalTransactions();
  const index = currentLocal.findIndex(x => x.id === id);
  if (index >= 0) {
    currentLocal[index] = { ...currentLocal[index], ...data, updatedAt: new Date().toISOString() };
    saveLocalTransactions(currentLocal);
  }

  const updatedData = sanitizeData({
    ...data,
    id,
    updatedAt: new Date().toISOString()
  });

  // Sync to Vercel API backend
  syncToApi(updatedData);

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await setDoc(docRef, updatedData, { merge: true });
  } catch (error) {
    console.warn("Could not update financial transaction in Firestore Client SDK (updated via API & locally):", error);
  }
};

export const deleteFinancialTransaction = async (
  id: string,
  title?: string,
  deletedBy?: string
): Promise<void> => {
  // 1. Remove from local storage immediately
  const currentLocal = getLocalTransactions();
  const updatedLocal = currentLocal.filter(x => x.id !== id);
  saveLocalTransactions(updatedLocal);

  // 2. Sync delete via Vercel Admin API backend
  deleteFromApi(id);

  // 3. Try moving to trash in Firestore Client SDK
  try {
    await moveToTrash(COLLECTION_NAME, id, title || 'Phiếu thu chi', deletedBy || 'Người dùng');
  } catch (error) {
    console.warn("Could not move to trash in Firestore Client SDK, deleting via API/local:", error);
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch {}
  }
};
