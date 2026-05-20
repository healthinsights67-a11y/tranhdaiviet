import { db, doc, getDoc, setDoc, addDoc, deleteDoc, collection } from '@/src/lib/firebase';
import { TrashItem } from '../types';

export const moveToTrash = async (
  collectionName: string,
  docId: string,
  title: string,
  deletedBy: string
) => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error('Tài liệu không tồn tại');
    }
    const data = docSnap.data();

    // 1. Lưu vào bộ sưu tập trash
    await addDoc(collection(db, 'trash'), {
      originalId: docId,
      collection: collectionName,
      title: title || docId,
      data,
      deletedAt: new Date().toISOString(),
      deletedBy: deletedBy || 'Hệ thống'
    });

    // 2. Xóa tài liệu gốc
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error moving to trash:', error);
    throw error;
  }
};

export const restoreFromTrash = async (item: TrashItem) => {
  try {
    // 1. Phục hồi tài liệu về bộ sưu tập gốc
    const docRef = doc(db, item.collection, item.originalId);
    await setDoc(docRef, item.data);

    // 2. Xóa khỏi thùng rác
    await deleteDoc(doc(db, 'trash', item.id));
  } catch (error) {
    console.error('Error restoring from trash:', error);
    throw error;
  }
};

export const deletePermanently = async (itemId: string) => {
  try {
    await deleteDoc(doc(db, 'trash', itemId));
  } catch (error) {
    console.error('Error permanently deleting from trash:', error);
    throw error;
  }
};
