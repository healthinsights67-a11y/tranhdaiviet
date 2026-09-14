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
import { Supplier, SupplierTransaction } from '../types';
import { addFinancialTransaction } from './financialService';
import { moveToTrash } from './trashService';

const SUPPLIERS_COLLECTION = 'suppliers';
const TRANSACTIONS_COLLECTION = 'supplier_transactions';

const SUPPLIERS_CACHE_KEY = 'mkt_suppliers_cache';
const TX_CACHE_KEY = 'mkt_supplier_tx_cache';

// Helper to read local cache
const getLocalSuppliers = (): Supplier[] => {
  try {
    const raw = localStorage.getItem(SUPPLIERS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalSuppliers = (items: Supplier[]) => {
  try {
    localStorage.setItem(SUPPLIERS_CACHE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Could not save suppliers to localStorage:", e);
  }
};

const getLocalTransactions = (): SupplierTransaction[] => {
  try {
    const raw = localStorage.getItem(TX_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalTransactions = (items: SupplierTransaction[]) => {
  try {
    localStorage.setItem(TX_CACHE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Could not save supplier transactions to localStorage:", e);
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

/**
 * Realtime subscribe suppliers list
 */
export const subscribeSuppliers = (onUpdate: (data: Supplier[]) => void) => {
  onUpdate(getLocalSuppliers());

  try {
    const colRef = collection(db, SUPPLIERS_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const remoteItems: Supplier[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || '',
            phone: data.phone || '',
            address: data.address || '',
            category: data.category || 'Khác',
            notes: data.notes || '',
            totalPurchased: Number(data.totalPurchased || 0),
            totalPaid: Number(data.totalPaid || 0),
            remainingDebt: Number(data.remainingDebt || (Number(data.totalPurchased || 0) - Number(data.totalPaid || 0))),
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt
          };
        });

        remoteItems.sort((a, b) => (b.remainingDebt - a.remainingDebt) || a.name.localeCompare(b.name));
        saveLocalSuppliers(remoteItems);
        onUpdate(remoteItems);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, SUPPLIERS_COLLECTION);
        onUpdate(getLocalSuppliers());
      }
    );
  } catch (error) {
    console.warn("Error subscribing suppliers, using local cache:", error);
    onUpdate(getLocalSuppliers());
    return () => {};
  }
};

/**
 * Realtime subscribe supplier debt transactions (invoices / payments)
 */
export const subscribeSupplierTransactions = (onUpdate: (data: SupplierTransaction[]) => void, supplierId?: string) => {
  const local = getLocalTransactions();
  if (supplierId) {
    onUpdate(local.filter(t => t.supplierId === supplierId));
  } else {
    onUpdate(local);
  }

  try {
    const colRef = collection(db, TRANSACTIONS_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const remoteItems: SupplierTransaction[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            supplierId: data.supplierId || '',
            supplierName: data.supplierName || '',
            type: data.type || 'purchase',
            amount: Number(data.amount || 0),
            date: data.date || new Date().toISOString().split('T')[0],
            invoiceNo: data.invoiceNo || '',
            paymentMethod: data.paymentMethod || 'transfer',
            financialTransactionId: data.financialTransactionId || '',
            handlerName: data.handlerName || '',
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : (data.imageUrl ? [data.imageUrl] : []),
            notes: data.notes || '',
            createdBy: data.createdBy || '',
            createdAt: data.createdAt || new Date().toISOString()
          };
        });

        remoteItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        saveLocalTransactions(remoteItems);

        if (supplierId) {
          onUpdate(remoteItems.filter(t => t.supplierId === supplierId));
        } else {
          onUpdate(remoteItems);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, TRANSACTIONS_COLLECTION);
        onUpdate(supplierId ? getLocalTransactions().filter(t => t.supplierId === supplierId) : getLocalTransactions());
      }
    );
  } catch (error) {
    console.warn("Error subscribing supplier transactions:", error);
    onUpdate(supplierId ? getLocalTransactions().filter(t => t.supplierId === supplierId) : getLocalTransactions());
    return () => {};
  }
};

/**
 * Add or update Supplier
 */
export const saveSupplier = async (supplier: Partial<Supplier>): Promise<string> => {
  const id = supplier.id || Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  const data: Supplier = {
    id,
    name: supplier.name || 'Nhà cung cấp chưa tên',
    phone: supplier.phone || '',
    address: supplier.address || '',
    category: supplier.category || 'Vật tư',
    notes: supplier.notes || '',
    totalPurchased: Number(supplier.totalPurchased || 0),
    totalPaid: Number(supplier.totalPaid || 0),
    remainingDebt: Number((supplier.totalPurchased || 0) - (supplier.totalPaid || 0)),
    createdAt: supplier.createdAt || now,
    updatedAt: now
  };

  const cleanData = sanitizeData(data);
  const localList = getLocalSuppliers();
  const idx = localList.findIndex(s => s.id === id);
  if (idx >= 0) {
    localList[idx] = cleanData;
  } else {
    localList.unshift(cleanData);
  }
  saveLocalSuppliers(localList);

  try {
    const docRef = doc(db, SUPPLIERS_COLLECTION, id);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${SUPPLIERS_COLLECTION}/${id}`);
  }

  return id;
};

/**
 * Delete Supplier
 */
export const deleteSupplier = async (id: string, name: string, deletedBy?: string) => {
  const localList = getLocalSuppliers().filter(s => s.id !== id);
  saveLocalSuppliers(localList);

  try {
    await moveToTrash(SUPPLIERS_COLLECTION, id, `Nhà cung cấp ${name}`, deletedBy || 'Hệ thống');
    const docRef = doc(db, SUPPLIERS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${SUPPLIERS_COLLECTION}/${id}`);
  }
};

/**
 * Record a new Purchase Order / Debt increase from Supplier
 */
export const addSupplierPurchaseTransaction = async (
  params: {
    supplierId: string;
    supplierName: string;
    amount: number;
    date: string;
    invoiceNo?: string;
    handlerName?: string;
    imageUrls?: string[];
    notes?: string;
    createdBy?: string;
    paidAmountImmediately?: number; // Đã trả ngay một phần tiền mặt/CK
    paymentMethod?: 'cash' | 'transfer' | 'other';
  }
): Promise<string> => {
  const txId = 'sup_tx_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  // 1. Create Purchase Transaction
  const txData: SupplierTransaction = {
    id: txId,
    supplierId: params.supplierId,
    supplierName: params.supplierName,
    type: 'purchase',
    amount: Number(params.amount),
    date: params.date || now.split('T')[0],
    invoiceNo: params.invoiceNo || '',
    handlerName: params.handlerName || '',
    imageUrls: params.imageUrls || [],
    notes: params.notes || '',
    createdBy: params.createdBy || '',
    createdAt: now
  };

  const localTxs = getLocalTransactions();
  localTxs.unshift(txData);
  saveLocalTransactions(localTxs);

  try {
    await setDoc(doc(db, TRANSACTIONS_COLLECTION, txId), sanitizeData(txData));
  } catch (e) {
    console.warn("Could not save purchase transaction to Firestore:", e);
  }

  // 2. Update Supplier Total Purchased
  const suppliers = getLocalSuppliers();
  const targetSupplier = suppliers.find(s => s.id === params.supplierId);
  const currentTotalPurchased = targetSupplier ? targetSupplier.totalPurchased : 0;
  const currentTotalPaid = targetSupplier ? targetSupplier.totalPaid : 0;

  let newTotalPaid = currentTotalPaid;
  let financialTxId: string | undefined = undefined;

  // 3. If paid amount immediately > 0, create immediate payment transaction & financial expense
  if (params.paidAmountImmediately && params.paidAmountImmediately > 0) {
    const payAmount = Number(params.paidAmountImmediately);
    newTotalPaid += payAmount;

    // Create Financial Expense in Thu Chi
    try {
      financialTxId = await addFinancialTransaction({
        type: 'expense',
        title: `Chi thanh toán ngay đơn hàng ${params.invoiceNo || ''} - NCC ${params.supplierName}`.trim(),
        amount: payAmount,
        date: params.date || now.split('T')[0],
        category: 'Mua vật tư & phụ kiện',
        paymentMethod: params.paymentMethod || 'transfer',
        payerPayee: params.supplierName,
        handlerName: params.handlerName,
        imageUrls: params.imageUrls,
        notes: `Tự động tạo từ đơn phát sinh nợ NCC ${params.supplierName}`,
        createdBy: params.createdBy || 'Hệ thống',
        createdAt: now
      });
    } catch (e) {
      console.warn("Could not sync immediate payment to Financial page:", e);
    }

    // Record Payment Transaction
    const payTxId = 'sup_tx_' + (Date.now() + 1).toString();
    const payTxData: SupplierTransaction = {
      id: payTxId,
      supplierId: params.supplierId,
      supplierName: params.supplierName,
      type: 'payment',
      amount: payAmount,
      date: params.date || now.split('T')[0],
      invoiceNo: params.invoiceNo ? `Trả tiền ${params.invoiceNo}` : '',
      paymentMethod: params.paymentMethod || 'transfer',
      financialTransactionId: financialTxId,
      handlerName: params.handlerName || '',
      imageUrls: params.imageUrls || [],
      notes: `Trả ngay khi tạo đơn mua`,
      createdBy: params.createdBy || '',
      createdAt: now
    };
    localTxs.unshift(payTxData);
    saveLocalTransactions(localTxs);
    try {
      await setDoc(doc(db, TRANSACTIONS_COLLECTION, payTxId), sanitizeData(payTxData));
    } catch (e) {
      console.warn("Could not save immediate payment tx to Firestore:", e);
    }
  }

  const newTotalPurchased = currentTotalPurchased + Number(params.amount);
  await saveSupplier({
    id: params.supplierId,
    name: params.supplierName,
    totalPurchased: newTotalPurchased,
    totalPaid: newTotalPaid,
    remainingDebt: newTotalPurchased - newTotalPaid,
    updatedAt: now
  });

  return txId;
};

/**
 * Record a Payment to Supplier (reduces debt)
 * Automatically syncs a PHIẾU CHI to Financial Page!
 */
export const addSupplierPaymentTransaction = async (
  params: {
    supplierId: string;
    supplierName: string;
    amount: number;
    date: string;
    paymentMethod: 'cash' | 'transfer' | 'other';
    handlerName?: string;
    imageUrls?: string[];
    notes?: string;
    createdBy?: string;
  }
): Promise<string> => {
  const txId = 'sup_pay_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  // 1. Create Financial Transaction in Thu Chi
  let financialTxId: string | undefined = undefined;
  try {
    financialTxId = await addFinancialTransaction({
      type: 'expense',
      title: `Chi trả tiền công nợ cho Nhà Cung Cấp ${params.supplierName}`,
      amount: Number(params.amount),
      date: params.date || now.split('T')[0],
      category: 'Chi trả công nợ NCC',
      paymentMethod: params.paymentMethod || 'transfer',
      payerPayee: params.supplierName,
      handlerName: params.handlerName,
      imageUrls: params.imageUrls,
      notes: params.notes || `Thanh toán nợ cho nhà cung cấp ${params.supplierName}`,
      createdBy: params.createdBy || 'Hệ thống',
      createdAt: now
    });
  } catch (e) {
    console.warn("Could not create financial expense for supplier payment:", e);
  }

  // 2. Create Supplier Payment Transaction
  const txData: SupplierTransaction = {
    id: txId,
    supplierId: params.supplierId,
    supplierName: params.supplierName,
    type: 'payment',
    amount: Number(params.amount),
    date: params.date || now.split('T')[0],
    paymentMethod: params.paymentMethod,
    financialTransactionId: financialTxId,
    handlerName: params.handlerName || '',
    imageUrls: params.imageUrls || [],
    notes: params.notes || '',
    createdBy: params.createdBy || '',
    createdAt: now
  };

  const localTxs = getLocalTransactions();
  localTxs.unshift(txData);
  saveLocalTransactions(localTxs);

  try {
    await setDoc(doc(db, TRANSACTIONS_COLLECTION, txId), sanitizeData(txData));
  } catch (e) {
    console.warn("Could not save payment transaction to Firestore:", e);
  }

  // 3. Update Supplier Total Paid & Remaining Debt
  const suppliers = getLocalSuppliers();
  const targetSupplier = suppliers.find(s => s.id === params.supplierId);
  const currentTotalPurchased = targetSupplier ? targetSupplier.totalPurchased : 0;
  const currentTotalPaid = targetSupplier ? targetSupplier.totalPaid : 0;

  const newTotalPaid = currentTotalPaid + Number(params.amount);
  await saveSupplier({
    id: params.supplierId,
    name: params.supplierName,
    totalPurchased: currentTotalPurchased,
    totalPaid: newTotalPaid,
    remainingDebt: currentTotalPurchased - newTotalPaid,
    updatedAt: now
  });

  return txId;
};

/**
 * Delete a Supplier Debt Transaction
 */
export const deleteSupplierTransaction = async (tx: SupplierTransaction, deletedBy?: string) => {
  const localTxs = getLocalTransactions().filter(t => t.id !== tx.id);
  saveLocalTransactions(localTxs);

  try {
    await moveToTrash(TRANSACTIONS_COLLECTION, tx.id, `Giao dịch công nợ ${tx.supplierName}`, deletedBy || 'Hệ thống');
    await deleteDoc(doc(db, TRANSACTIONS_COLLECTION, tx.id));
  } catch (e) {
    console.warn("Could not delete supplier transaction from Firestore:", e);
  }

  // Recalculate Supplier Total Purchased & Total Paid
  const suppliers = getLocalSuppliers();
  const targetSupplier = suppliers.find(s => s.id === tx.supplierId);
  if (targetSupplier) {
    let newTotalPurchased = targetSupplier.totalPurchased;
    let newTotalPaid = targetSupplier.totalPaid;

    if (tx.type === 'purchase') {
      newTotalPurchased = Math.max(0, newTotalPurchased - tx.amount);
    } else if (tx.type === 'payment') {
      newTotalPaid = Math.max(0, newTotalPaid - tx.amount);
    }

    await saveSupplier({
      id: targetSupplier.id,
      name: targetSupplier.name,
      totalPurchased: newTotalPurchased,
      totalPaid: newTotalPaid,
      remainingDebt: newTotalPurchased - newTotalPaid
    });
  }
};
