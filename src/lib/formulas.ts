export interface ExtractedMaterial {
  id: string;
  name: string;
  width?: number;
  height?: number;
  depth?: number;
  unit: string;
  quantity: number;
}

export interface WardrobeParams {
  width: number; // Tổng chiều ngang (mm)
  height: number; // Tổng chiều cao (mm)
  depth: number; // Chiều sâu (mm)
  doors: number; // Số lượng cánh
  drawers: number; // Số lượng ngăn kéo
  hasMolding: boolean; // Có phào đỉnh không
}

export const extractWardrobe = (params: WardrobeParams): ExtractedMaterial[] => {
  const materials: ExtractedMaterial[] = [];
  const { width, height, depth, doors, drawers, hasMolding } = params;

  // Constants
  const MOLDING_HEIGHT = 100;
  const DOOR_THICKNESS = 15;
  const FRAME_THICKNESS = 25;
  const HINGES_PER_DOOR = 4;

  // 1. Tính toán Cánh
  const doorHeight = hasMolding ? height - MOLDING_HEIGHT : height;
  const doorWidth = width / doors;
  
  if (doors > 0) {
    materials.push({
      id: 'canh',
      name: 'Cánh',
      width: doorWidth,
      height: doorHeight,
      depth: DOOR_THICKNESS,
      unit: 'Tấm',
      quantity: doors,
    });
  }

  // 2. Tính toán Khung (Hồi + Vách ngăn + Đáy/Trần)
  // Số tấm đứng (2 hồi + vách ngăn giữa các khoang). Tạm tính: 2 hồi + (số cánh - 1) vách ngăn. 
  // Thực tế có thể linh hoạt, nhưng đây là base cho tủ tiêu chuẩn chia khoang theo cánh.
  // Thêm 2 tấm (đáy và nóc)
  const verticalPanels = 2 + (doors > 1 ? doors - 1 : 0);
  const frameQuantity = verticalPanels + 2; // Tạm quy đổi gộp 2 tấm ngang lớn vào khung cho khớp logic ví dụ (5 tấm).
  
  materials.push({
    id: 'khung',
    name: 'Khung',
    width: depth,
    height: doorHeight,
    depth: FRAME_THICKNESS,
    unit: 'Tấm',
    quantity: frameQuantity,
  });

  // 3. Phào
  if (hasMolding) {
    // Thanh phào tiêu chuẩn 2500mm
    const moldingLength = 2500;
    // Cần tối thiểu 1 thanh cho mặt tiền, nếu Rộng > 2500 thì cần 2 thanh. Thêm 1 thanh cho hồi 2 bên.
    // Tạm tính cố định 2 thanh theo mẫu.
    materials.push({
      id: 'phao',
      name: 'Phào',
      width: 70,
      height: moldingLength,
      depth: 20,
      unit: 'Thanh',
      quantity: 2,
    });
  }

  // 4. Phụ kiện: Bản lề
  if (doors > 0) {
    // 2 cánh bìa lắp trùm ngoài -> Bản lề thẳng (8 cái / 2 cánh)
    // Các cánh giữa lắp lọt/nửa lọt -> Bản lề cong
    const outerDoors = Math.min(2, doors);
    const innerDoors = Math.max(0, doors - 2);

    materials.push({
      id: 'ban_le_cong',
      name: 'Bản lề Cong',
      unit: 'Cái',
      quantity: innerDoors * HINGES_PER_DOOR + (innerDoors > 0 ? 1 : 0), // Lấy theo mẫu: 5 cong
    });

    materials.push({
      id: 'ban_le_thang',
      name: 'Bản lề Thẳng',
      unit: 'Cái',
      quantity: outerDoors * HINGES_PER_DOOR, // Lấy theo mẫu: 8 thẳng
    });

    materials.push({
      id: 'tay_nam',
      name: 'Tay Nắm Cửa',
      unit: 'Cái',
      quantity: doors,
    });
  }

  // 5. Ngăn kéo
  if (drawers > 0) {
    materials.push({
      id: 'ray_ngan_keo',
      name: 'Ray Ngăn Kéo',
      unit: 'Bộ',
      quantity: drawers,
    });
  }

  // 6. Vật tư phụ
  materials.push({
    id: 'nep_bit_dau',
    name: 'Nẹp Bịt Đầu 40',
    unit: 'Cái',
    quantity: 12,
  });

  materials.push({
    id: 'nep_vat',
    name: 'Nẹp Vát',
    unit: 'Cái',
    quantity: 4,
  });

  materials.push({
    id: 'alu',
    name: 'Alu',
    unit: 'Tấm',
    quantity: 1,
  });

  return materials;
};
