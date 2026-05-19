import { doc, setDoc, serverTimestamp, db } from '../lib/firebase';

const COLLECTION_NAME = 'product_library';

/**
 * Lưu sản phẩm thông minh (Vừa Thêm mới, Vừa Cập nhật)
 * @param productData Dữ liệu sản phẩm
 * @returns productId
 */
export const saveProductTemplate = async (productData: any) => {
  try {
    // 1. Xác định ID: Dùng ID truyền vào hoặc tự tạo ID mới nếu chưa có/là temp ID
    const isNew = !productData.id || productData.id.startsWith('temp-');
    const productId = isNew ? `PROD-${Date.now()}` : productData.id;
    
    // 2. Trỏ tới đúng vị trí document đó trong Firebase
    const docRef = doc(db, COLLECTION_NAME, productId);

    // 3. Dùng setDoc với merge: true
    // Chúng ta tách id ra khỏi productData để đảm bảo không ghi đè ID cũ nếu truyền vào bậy bạ
    const { id, ...data } = productData;

    await setDoc(docRef, {
      ...data,
      id: productId,
      updatedAt: serverTimestamp(),
      ...(isNew ? { createdAt: serverTimestamp() } : {})
    }, { merge: true });

    return productId;
  } catch (error) {
    console.error("Lỗi khi lưu sản phẩm:", error);
    throw error;
  }
};
