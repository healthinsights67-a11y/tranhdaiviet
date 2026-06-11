import { db, doc, getDoc, setDoc } from '@/src/lib/firebase';
import { MaterialMultiplier } from '@/src/types';

export const DEFAULT_MATERIAL_MULTIPLIERS: MaterialMultiplier[] = [
  { id: '1', stt: 1, code: 'ECO', material: 'ECOPLAST', description: 'ECO hàng A, S', percentage: 105 },
  { id: '2', stt: 2, code: 'LUX', material: 'ECOPLAST LUXURY', description: 'ECO hàng LUX', percentage: 110 },
  { id: '3', stt: 3, code: 'ECO+', material: 'ECOPLUS', description: 'ECO+ từ E1-E8', percentage: 120 },
  { id: '4', stt: 4, code: 'ECOPVC+', material: 'ECOPLUS FILM PVC', description: 'ECO+ hàng phủ film PVC từ E28-E31', percentage: 155 },
  { id: '5', stt: 5, code: 'PENCO', material: 'PENCO', description: 'Nhựa ECO bản giảm giá thành', percentage: 95 },
  { id: '6', stt: 6, code: 'CASAWOOD', material: 'CASAWOOD nhựa đặc', description: 'Nhựa đặc phủ PET', percentage: 170 },
  { id: '7', stt: 7, code: 'THANTRE', material: 'Than tre', description: 'Than tre phủ PET', percentage: 175 },
  { id: '8', stt: 8, code: 'PKB', material: 'Phụ kiện tủ bếp', description: 'Phụ kiện tủ bếp fulco', percentage: 100 },
  { id: '9', stt: 9, code: 'MSNT', material: 'Mặt sàn nhựa thường', description: '', percentage: 100 },
  { id: '10', stt: 10, code: 'MSNCC', material: 'Mặt sàn nhựa cao cấp', description: '', percentage: 120 },
  { id: '11', stt: 11, code: 'PKTA', material: 'Phụ kiện tủ áo', description: 'Phụ kiện dành cho tủ áo', percentage: 100 },
  { id: '12', stt: 12, code: 'PKK', material: 'Phụ kiện khác', description: 'Những phụ kiện ngoài khác', percentage: 100 },
];

const SETTINGS_DOC_ID = 'material_multipliers';
const SETTINGS_COLLECTION = 'settings';

export const getMaterialMultipliers = async (): Promise<MaterialMultiplier[]> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.items && Array.isArray(data.items)) {
        return data.items as MaterialMultiplier[];
      }
    }
    // If not found, return default and potentially save them to initialize
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
