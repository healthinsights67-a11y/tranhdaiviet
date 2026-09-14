import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  addDoc, 
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

export const fetchFinancialTransactions = async (): Promise<FinancialTransaction[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => {
      const raw = { ...docSnap.data(), id: docSnap.id };
      return FinancialTransactionSchema.parse(raw) as FinancialTransaction;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    return [];
  }
};

export const subscribeFinancialTransactions = (
  onData: (items: FinancialTransaction[]) => void,
  onError?: (err: any) => void
) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(docSnap => {
        const raw = { ...docSnap.data(), id: docSnap.id };
        return FinancialTransactionSchema.parse(raw) as FinancialTransaction;
      });
      onData(items);
    },
    (err) => {
      console.error("Realtime subscription error in financialService:", err);
      if (onError) onError(err);
    }
  );
};

export const addFinancialTransaction = async (
  data: Omit<FinancialTransaction, 'id'>
): Promise<string> => {
  try {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const newTransaction: FinancialTransaction = {
      ...data,
      id: docRef.id,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const validated = FinancialTransactionSchema.parse(newTransaction);
    await setDoc(docRef, validated);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    throw error;
  }
};

export const updateFinancialTransaction = async (
  id: string,
  data: Partial<FinancialTransaction>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updatedData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, updatedData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
    throw error;
  }
};

export const deleteFinancialTransaction = async (
  id: string,
  title?: string,
  deletedBy?: string
): Promise<void> => {
  try {
    await moveToTrash(COLLECTION_NAME, id, title || 'Phiếu thu chi', deletedBy || 'Người dùng');
  } catch (error) {
    console.warn("Could not move to trash, performing direct delete:", error);
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }
};
