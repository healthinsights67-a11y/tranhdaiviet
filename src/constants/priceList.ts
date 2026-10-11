export interface PriceItem {
  name: string;
  unit: string;
  price: number;
  description: string;
  category: string;
}

export const STANDARD_PRICES: PriceItem[] = [
  // ==========================================
  // 1. TRANH GẠO RANG (TIÊU CHUẨN)
  // ==========================================
  {
    name: 'Tranh gạo rang 20x25cm',
    unit: 'bức',
    price: 330000,
    category: 'Tranh gạo rang',
    description: 'Kích cỡ 20x25 cm. Sử dụng hạt gạo rang tự nhiên chuyển màu thủ công tinh xảo.'
  },
  {
    name: 'Tranh gạo rang 25x35cm',
    unit: 'bức',
    price: 540000,
    category: 'Tranh gạo rang',
    description: 'Kích cỡ 25x35 cm. Tranh gạo rang phong cảnh, thư pháp hoặc tĩnh vật.'
  },
  {
    name: 'Tranh gạo rang 33x33cm',
    unit: 'bức',
    price: 620000,
    category: 'Tranh gạo rang',
    description: 'Kích cỡ vuông 33x33 cm. Thích hợp trang trí phòng khách hoặc bàn làm việc.'
  },
  {
    name: 'Tranh gạo rang 33x43cm',
    unit: 'bức',
    price: 750000,
    category: 'Tranh gạo rang',
    description: 'Kích cỡ 33x43 cm. Khung gỗ cao cấp, chống ẩm mốc, bền đẹp theo thời gian.'
  },
  {
    name: 'Tranh gạo rang 40x50cm',
    unit: 'bức',
    price: 940000,
    category: 'Tranh gạo rang',
    description: 'Kích cỡ 40x50 cm. Thể hiện chi tiết sắc nét, bố cục trang nhã.'
  },
  {
    name: 'Tranh gạo rang 50x50cm',
    unit: 'bức',
    price: 1250000,
    category: 'Tranh gạo rang',
    description: 'Kích cỡ vuông 50x50 cm. Mẫu tranh phong cảnh quê hương hoặc biểu tượng văn hóa.'
  },
  {
    name: 'Tranh gạo rang 45x60cm',
    unit: 'bức',
    price: 1450000,
    category: 'Tranh gạo rang',
    description: 'Kích cỡ 45x60 cm. Quà tặng đối ngoại, quà biếu tân gia sang trọng.'
  },
  {
    name: 'Tranh gạo rang 50x70cm',
    unit: 'bức',
    price: 1750000,
    category: 'Tranh gạo rang',
    description: 'Kích cỡ 50x70 cm. Chi tiết hạt gạo xếp tay thủ công đạt độ chân thực cao.'
  },
  {
    name: 'Tranh gạo rang 65x85cm',
    unit: 'bức',
    price: 2400000,
    category: 'Tranh gạo rang',
    description: 'Kích cỡ lớn 65x85 cm. Tranh đại cảnh, phù hợp không gian phòng khách lớn.'
  },
  {
    name: 'Tranh gạo rang 75x105cm',
    unit: 'bức',
    price: 3200000,
    category: 'Tranh gạo rang',
    description: 'Kích cỡ đại 75x105 cm. Tác phẩm nghệ thuật đỉnh cao từ hạt gạo Việt.'
  },

  // ==========================================
  // 2. TRANH GẠO MÀU (TIÊU CHUẨN)
  // ==========================================
  {
    name: 'Tranh gạo màu 20x25cm',
    unit: 'bức',
    price: 320000,
    category: 'Tranh gạo màu',
    description: 'Kích cỡ 20x25 cm. Sử dụng gạo nhuộm màu tự nhiên tươi sáng, sinh động.'
  },
  {
    name: 'Tranh gạo màu 25x35cm',
    unit: 'bức',
    price: 520000,
    category: 'Tranh gạo màu',
    description: 'Kích cỡ 25x35 cm. Tranh hoa lá, phong cảnh màu sắc bắt mắt.'
  },
  {
    name: 'Tranh gạo màu 33x33cm',
    unit: 'bức',
    price: 620000,
    category: 'Tranh gạo màu',
    description: 'Kích cỡ vuông 33x33 cm. Họa tiết hiện đại, tươi vui.'
  },
  {
    name: 'Tranh gạo màu 33x43cm',
    unit: 'bức',
    price: 720000,
    category: 'Tranh gạo màu',
    description: 'Kích cỡ 33x43 cm. Màu sắc bền màu, có phủ lớp bảo vệ bề mặt.'
  },
  {
    name: 'Tranh gạo màu 40x50cm',
    unit: 'bức',
    price: 900000,
    category: 'Tranh gạo màu',
    description: 'Kích cỡ 40x50 cm. Tạo điểm nhấn nghệ thuật cho không gian sống.'
  },
  {
    name: 'Tranh gạo màu 45x60cm',
    unit: 'bức',
    price: 1450000,
    category: 'Tranh gạo màu',
    description: 'Kích cỡ 45x60 cm. Phối màu hài hòa, đậm đà bản sắc dân tộc.'
  },
  {
    name: 'Tranh gạo màu 50x70cm',
    unit: 'bức',
    price: 1750000,
    category: 'Tranh gạo màu',
    description: 'Kích cỡ 50x70 cm. Tranh phong cảnh Việt Nam rực rỡ màu sắc.'
  },
  {
    name: 'Tranh gạo màu 65x85cm',
    unit: 'bức',
    price: 2400000,
    category: 'Tranh gạo màu',
    description: 'Kích cỡ 65x85 cm. Khung kép cao cấp, kính bảo vệ trong suốt.'
  },
  {
    name: 'Tranh gạo màu 75x105cm',
    unit: 'bức',
    price: 3200000,
    category: 'Tranh gạo màu',
    description: 'Kích cỡ đại 75x105 cm. Tác phẩm nghệ thuật quy mô lớn.'
  },

  // ==========================================
  // 3. TRANH CHÂN DUNG NGHỆ THUẬT
  // ==========================================
  {
    name: 'Tranh chân dung gạo màu 20x25cm',
    unit: 'bức',
    price: 680000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo màu kích cỡ 20x25 cm. Đòi hỏi độ tỉ mỉ và tay nghề nghệ nhân cao.'
  },
  {
    name: 'Tranh chân dung gạo màu 25x35cm',
    unit: 'bức',
    price: 880000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo màu kích cỡ 25x35 cm. Tái hiện thần thái nhân vật sinh động.'
  },
  {
    name: 'Tranh chân dung gạo màu 33x43cm',
    unit: 'bức',
    price: 1150000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo màu kích cỡ 33x43 cm. Quà tặng kỷ niệm, tri ân ý nghĩa.'
  },
  {
    name: 'Tranh chân dung gạo màu 40x50cm',
    unit: 'bức',
    price: 1450000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo màu kích cỡ 40x50 cm.'
  },
  {
    name: 'Tranh chân dung gạo màu 45x60cm',
    unit: 'bức',
    price: 1750000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo màu kích cỡ 45x60 cm.'
  },
  {
    name: 'Tranh chân dung gạo màu 50x70cm',
    unit: 'bức',
    price: 2000000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo màu kích cỡ 50x70 cm.'
  },
  {
    name: 'Tranh chân dung gạo màu 65x85cm',
    unit: 'bức',
    price: 2550000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo màu kích cỡ 65x85 cm.'
  },
  {
    name: 'Tranh chân dung gạo màu 75x105cm',
    unit: 'bức',
    price: 3450000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo màu kích cỡ đại 75x105 cm.'
  },
  {
    name: 'Tranh chân dung gạo rang 33x43cm',
    unit: 'bức',
    price: 1850000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo rang tự nhiên 33x43 cm. Phong cách hoài niệm, cổ điển sang trọng.'
  },
  {
    name: 'Tranh chân dung gạo rang 40x50cm',
    unit: 'bức',
    price: 2250000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo rang 40x50 cm.'
  },
  {
    name: 'Tranh chân dung gạo rang 45x60cm',
    unit: 'bức',
    price: 2650000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo rang 45x60 cm.'
  },
  {
    name: 'Tranh chân dung gạo rang 50x70cm',
    unit: 'bức',
    price: 2900000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo rang 50x70 cm.'
  },
  {
    name: 'Tranh chân dung gạo rang 65x85cm',
    unit: 'bức',
    price: 3300000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo rang 65x85 cm.'
  },
  {
    name: 'Tranh chân dung gạo rang 75x105cm',
    unit: 'bức',
    price: 4250000,
    category: 'Tranh chân dung',
    description: 'Tranh chân dung gạo rang 75x105 cm. Kiệt tác chân dung từ các sắc độ hạt gạo rang.'
  },

  // ==========================================
  // 4. TRANH ĐẶT HÀNG (LOGO - PHONG CẢNH RIÊNG)
  // ==========================================
  {
    name: 'Tranh đặt gạo rang 20x25cm (Logo/Cảnh)',
    unit: 'bức',
    price: 430000,
    category: 'Tranh theo yêu cầu',
    description: 'Làm theo mẫu logo công ty, phong cảnh riêng hoặc lời đề tặng (330k + 100k).'
  },
  {
    name: 'Tranh đặt gạo rang 25x35cm (Logo/Cảnh)',
    unit: 'bức',
    price: 640000,
    category: 'Tranh theo yêu cầu',
    description: 'Làm theo mẫu logo công ty, phong cảnh riêng hoặc lời đề tặng (540k + 100k).'
  },
  {
    name: 'Tranh đặt gạo rang 33x33cm (Logo/Cảnh)',
    unit: 'bức',
    price: 720000,
    category: 'Tranh theo yêu cầu',
    description: 'Làm theo mẫu logo riêng 33x33 cm (620k + 100k).'
  },
  {
    name: 'Tranh đặt gạo rang 33x43cm (Logo/Cảnh)',
    unit: 'bức',
    price: 900000,
    category: 'Tranh theo yêu cầu',
    description: 'Làm theo yêu cầu 33x43 cm (750k + 150k).'
  },
  {
    name: 'Tranh đặt gạo rang 40x50cm (Logo/Cảnh)',
    unit: 'bức',
    price: 1090000,
    category: 'Tranh theo yêu cầu',
    description: 'Làm theo yêu cầu 40x50 cm (940k + 150k).'
  },
  {
    name: 'Tranh đặt gạo rang 50x50cm (Logo/Cảnh)',
    unit: 'bức',
    price: 1450000,
    category: 'Tranh theo yêu cầu',
    description: 'Làm theo yêu cầu 50x50 cm (1250k + 200k).'
  },
  {
    name: 'Tranh đặt gạo rang 45x60cm (Logo/Cảnh)',
    unit: 'bức',
    price: 1700000,
    category: 'Tranh theo yêu cầu',
    description: 'Làm theo yêu cầu 45x60 cm (1450k + 250k).'
  },
  {
    name: 'Tranh đặt gạo rang 50x70cm (Logo/Cảnh)',
    unit: 'bức',
    price: 2000000,
    category: 'Tranh theo yêu cầu',
    description: 'Làm theo yêu cầu 50x70 cm (1750k + 250k).'
  },
  {
    name: 'Tranh đặt gạo rang 65x85cm (Logo/Cảnh)',
    unit: 'bức',
    price: 2700000,
    category: 'Tranh theo yêu cầu',
    description: 'Làm theo yêu cầu 65x85 cm (2400k + 300k).'
  },
  {
    name: 'Tranh đặt gạo rang 75x105cm (Logo/Cảnh)',
    unit: 'bức',
    price: 3550000,
    category: 'Tranh theo yêu cầu',
    description: 'Làm theo yêu cầu 75x105 cm (3200k + 350k).'
  }
];
