import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
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

// Merge remote items with local items by ID
const mergeTransactions = (remote: FinancialTransaction[], local: FinancialTransaction[]): FinancialTransaction[] => {
  const map = new Map<string, FinancialTransaction>();
  // Local first
  local.forEach(item => map.set(item.id, item));
  // Remote overwrites or adds
  remote.forEach(item => map.set(item.id, item));
  return Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
};

export const fetchFinancialTransactions = async (): Promise<FinancialTransaction[]> => {
  const localItems = getLocalTransactions();
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    const remoteItems = snapshot.docs.map(docSnap => {
      const raw = { ...docSnap.data(), id: docSnap.id };
      return FinancialTransactionSchema.parse(raw) as FinancialTransaction;
    });
    const merged = mergeTransactions(remoteItems, localItems);
    saveLocalTransactions(merged);
    return merged;
  } catch (error) {
    console.warn("Firestore fetch failed for financial transactions (using local fallback):", error);
    return localItems;
  }
};

export const subscribeFinancialTransactions = (
  onData: (items: FinancialTransaction[]) => void,
  onError?: (err: any) => void
) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
  
  // Emit local items immediately for instant UI response
  const localItems = getLocalTransactions();
  if (localItems.length > 0) {
    onData(localItems);
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const remoteItems = snapshot.docs.map(docSnap => {
        const raw = { ...docSnap.data(), id: docSnap.id };
        return FinancialTransactionSchema.parse(raw) as FinancialTransaction;
      });
      const localNow = getLocalTransactions();
      const merged = mergeTransactions(remoteItems, localNow);
      saveLocalTransactions(merged);
      onData(merged);
    },
    (err) => {
      console.warn("Realtime subscription error in financialService (using local fallback):", err);
      onData(getLocalTransactions());
      if (onError) onError(err);
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

  // 1. Always save to local storage immediately so user is never blocked
  const currentLocal = getLocalTransactions();
  const updatedLocal = [sanitized, ...currentLocal.filter(x => x.id !== docRef.id)];
  saveLocalTransactions(updatedLocal);

  // 2. Try saving to Firestore in background
  try {
    await setDoc(docRef, sanitized);
  } catch (error) {
    console.warn("Could not save financial transaction to Firestore (saved locally):", error);
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

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updatedData = sanitizeData({
      ...data,
      updatedAt: new Date().toISOString()
    });
    await setDoc(docRef, updatedData, { merge: true });
  } catch (error) {
    console.warn("Could not update financial transaction in Firestore (updated locally):", error);
  }
};

export const deleteFinancialTransaction = async (
  id: string,
  title?: string,
  deletedBy?: string
): Promise<void> => {
  // Remove from local storage
  const currentLocal = getLocalTransactions();
  const updatedLocal = currentLocal.filter(x => x.id !== id);
  saveLocalTransactions(updatedLocal);

  try {
    await moveToTrash(COLLECTION_NAME, id, title || 'Phiếu thu chi', deletedBy || 'Người dùng');
  } catch (error) {
    console.warn("Could not move to trash in Firestore, deleting locally:", error);
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch {}
  }
};
