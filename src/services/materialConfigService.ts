import { db, doc, getDoc, setDoc } from '@/src/lib/firebase';
import { MaterialMultiplier } from '@/src/types';

export const DEFAULT_MATERIAL_MULTIPLIERS: MaterialMultiplier[] = [
  { id: '1', stt: 1, code: 'GR', material: 'Tranh gạo rang', description: 'Hạt gạo rang tự nhiên chuyển màu thủ công', percentage: 100 },
  { id: '2', stt: 2, code: 'GM', material: 'Tranh gạo màu', description: 'Gạo nhuộm màu nghệ thuật thủ công tinh xảo', percentage: 100 },
  { id: '3', stt: 3, code: 'CD', material: 'Tranh chân dung', description: 'Tranh gạo chân dung truyền thần tỉ mỉ', percentage: 100 },
  { id: '4', stt: 4, code: 'YEUCAU', material: 'Tranh theo yêu cầu', description: 'Tranh làm theo market & logo riêng của khách', percentage: 100 },
  { id: '5', stt: 5, code: 'KHUNG', material: 'Khung & Phụ kiện', description: 'Khung composite, kính, tem đồng lưu niệm', percentage: 100 },
];

const SETTINGS_DOC_ID = 'material_multipliers';
const SETTINGS_COLLECTION = 'settings';

export const getMaterialMultipliers = async (): Promise<MaterialMultiplier[]> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
        // Kiểm tra nếu dữ liệu cũ còn dính ECO/Ecoplast thì tự động di chuyển sang chuẩn Tranh Đại Việt (100%)
        const hasLegacyEco = data.items.some((i: any) => i.code === 'ECO' || (i.material && i.material.toLowerCase().includes('ecoplast')));
        if (hasLegacyEco) {
          console.log("Phát hiện hệ số cũ ECO, tự động chuyển đổi sang danh mục Tranh Đại Việt 100%...");
          await saveMaterialMultipliers(DEFAULT_MATERIAL_MULTIPLIERS);
          return DEFAULT_MATERIAL_MULTIPLIERS;
        }
        return data.items as MaterialMultiplier[];
      }
    }
    // Chưa có thì lưu mặc định và trả về
    await saveMaterialMultipliers(DEFAULT_MATERIAL_MULTIPLIERS);
    return DEFAULT_MATERIAL_MULTIPLIERS;
  } catch (error) {
    console.error("Error fetching material multipliers:", error);
    return DEFAULT_MATERIAL_MULTIPLIERS;
  }
};

export const saveMaterialMultipliers = async (items: MaterialMultiplier[]): Promise<void> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    await setDoc(docRef, { items }, { merge: true });
  } catch (error) {
    console.error("Error saving material multipliers:", error);
    throw error;
  }
};
