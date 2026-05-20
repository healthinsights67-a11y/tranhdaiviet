import { db, collection, getDocs, handleFirestoreError, OperationType, deleteDoc } from '../lib/firebase';
import { Task, Customer, Order, Member, MediaFolder, Quotation, MeasurementSchedule, InstallationSchedule, TrashItem } from '../types';
import { TaskSchema, CustomerSchema, OrderSchema, MemberSchema, MediaFolderSchema, QuotationSchema, MeasurementScheduleSchema, InstallationScheduleSchema, TrashItemSchema } from '../schemas';
import { z } from 'zod';

const validateData = <T>(schema: z.ZodSchema<T>, data: any): T => {
  return schema.parse(data);
};

export const fetchTasks = async (): Promise<Task[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'tasks'));
    return snapshot.docs.map(doc => validateData(TaskSchema, { ...doc.data(), id: doc.id }) as Task);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'tasks');
    throw new Error('Failed to fetch tasks');
  }
};

export const fetchCustomers = async (): Promise<Customer[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'customers'));
    return snapshot.docs.map(doc => validateData(CustomerSchema, { ...doc.data(), id: doc.id }) as Customer);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'customers');
    throw new Error('Failed to fetch customers');
  }
};

export const fetchOrders = async (): Promise<Order[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'orders'));
    return snapshot.docs.map(doc => validateData(OrderSchema, { ...doc.data(), id: doc.id }) as Order);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'orders');
    throw new Error('Failed to fetch orders');
  }
};

export const fetchMembers = async (): Promise<Member[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'members'));
    return snapshot.docs.map(doc => validateData(MemberSchema, { ...doc.data(), id: doc.id }) as Member);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'members');
    throw new Error('Failed to fetch members');
  }
};

export const fetchFolders = async (): Promise<MediaFolder[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'media_folders'));
    return snapshot.docs.map(doc => validateData(MediaFolderSchema, { ...doc.data(), id: doc.id }) as MediaFolder);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'media_folders');
    throw new Error('Failed to fetch media folders');
  }
};

export const fetchQuotations = async (): Promise<Quotation[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'quotations'));
    return snapshot.docs.map(doc => validateData(QuotationSchema, { ...doc.data(), id: doc.id }) as Quotation);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'quotations');
    throw new Error('Failed to fetch quotations');
  }
};

export const fetchMeasurementSchedules = async (): Promise<MeasurementSchedule[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'measurement_schedules'));
    return snapshot.docs.map(doc => validateData(MeasurementScheduleSchema, { ...doc.data(), id: doc.id }) as MeasurementSchedule);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'measurement_schedules');
    throw new Error('Failed to fetch measurement schedules');
  }
};

export const fetchInstallationSchedules = async (): Promise<InstallationSchedule[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'installation_schedules'));
    return snapshot.docs.map(doc => validateData(InstallationScheduleSchema, { ...doc.data(), id: doc.id }) as InstallationSchedule);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'installation_schedules');
    throw new Error('Failed to fetch installation schedules');
  }
};

export const fetchProductLibrary = async (): Promise<any[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'product_library'));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'product_library');
    throw new Error('Failed to fetch product library');
  }
};

export const clearAllAppData = async () => {
  const collectionsToClear = [
      'tasks', 
      'customers', 
      'orders', 
      'members', 
      'media_folders', 
      'quotations', 
      'measurement_schedules',
      'installation_schedules'
  ];
  
  for (const colName of collectionsToClear) {
      const snapshot = await getDocs(collection(db, colName));
      for (const docSnapshot of snapshot.docs) {
          await deleteDoc(docSnapshot.ref);
      }
  }
};

export const fetchTrash = async (): Promise<TrashItem[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'trash'));
    return snapshot.docs.map(doc => validateData(TrashItemSchema, { ...doc.data(), id: doc.id }) as TrashItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'trash');
    throw new Error('Failed to fetch trash items');
  }
};
