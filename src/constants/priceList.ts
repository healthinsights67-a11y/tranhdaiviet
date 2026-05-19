export interface PriceItem {
  name: string;
  unit: string;
  price: number;
  description: string;
  category: string;
}

export const STANDARD_PRICES: PriceItem[] = [
  {
    name: 'Tủ bếp',
    unit: 'md',
    price: 4200000,
    category: 'Phòng bếp',
    description: '- Tủ bếp kích thước tiêu chuẩn\n- Bếp dưới cao 80-85; sâu 55\n- Bếp trên cao 75; sâu 35\n- Khoảng Cách Giữa Bếp Trên và Dưới 62'
  },
  {
    name: 'Tủ áo',
    unit: 'm2',
    price: 1942500,
    category: 'Phòng ngủ',
    description: 'Tủ áo sâu 55'
  },
  {
    name: 'Tủ giày',
    unit: 'm2',
    price: 1680000,
    category: 'Phòng khách',
    description: 'Tủ giày sâu 35'
  },
  {
    name: 'Kệ TV treo',
    unit: 'md',
    price: 1680000,
    category: 'Phòng khách',
    description: 'Kệ TV treo cao 30; sâu 35'
  },
  {
    name: 'Tủ Gầm Cầu Thang',
    unit: 'm2',
    price: 1680000,
    category: 'Khu vực khác',
    description: 'Tủ gầm cầu thang kích thước tiêu chuẩn - Sâu 35'
  },
  {
    name: 'Cánh',
    unit: 'm2',
    price: 1522500,
    category: 'Khu vực khác',
    description: 'Thay cánh (Chưa bản lề)'
  },
  {
    name: 'Giường 1m6x2m',
    unit: 'cái',
    price: 5250000,
    category: 'Phòng ngủ',
    description: '- Giường trơn\n- Không Ngăn Kéo\n- Đầu Giường Bo Cong - Điểm nhấn 3 Kẻ Trắng\n- Mặt Giường Nhựa Rỗng'
  },
  {
    name: 'Giường 1m8x2m',
    unit: 'cái',
    price: 5985000,
    category: 'Phòng ngủ',
    description: '- Giường trơn\n- Không Ngăn Kéo\n- Đầu Giường Bo Cong - Điểm nhấn 3 Kẻ Trắng\n- Mặt Giường Nhựa Rỗng'
  },
  {
    name: 'Giường 2x2m2',
    unit: 'cái',
    price: 6825000,
    category: 'Phòng ngủ',
    description: '- Giường trơn\n- Không Ngăn Kéo\n- Đầu Giường Bo Cong - Điểm nhấn 3 Kẻ Trắng\n- Mặt Giường Nhựa Rỗng'
  },
  {
    name: 'Bàn học 1m2',
    unit: 'cái',
    price: 2625000,
    category: 'Phòng ngủ',
    description: 'Bàn Học Phổ Thông Cao 75cm\n- 1 NK To\n- 1 Hộc Tủ Cánh Mở'
  },
  {
    name: 'Bàn học 1m5',
    unit: 'cái',
    price: 3045000,
    category: 'Phòng ngủ',
    description: 'Bàn Học Phổ Thông Cao 75cm\n- 1 NK To\n- 1 Hộc Tủ Cánh Mở'
  },
  {
    name: 'Bàn học 1m6',
    unit: 'cái',
    price: 3360000,
    category: 'Phòng ngủ',
    description: 'Bàn Học Phổ Thông Cao 75cm\n- 1 NK To\n- 1 Hộc Tủ Cánh Mở'
  },
  {
    name: 'Mặt sàn ATT',
    unit: 'm2',
    price: 567000,
    category: 'Phòng ngủ',
    description: ''
  },
  {
    name: 'Tap đầu giường',
    unit: 'cái',
    price: 735000,
    category: 'Phòng ngủ',
    description: 'Tab Đầu Giường\n- Có 1 NK\n- 2NK'
  },
  {
    name: 'Lavabo',
    unit: 'cái',
    price: 2730000,
    category: 'Phòng tắm',
    description: '- Lavabo không kèm theo gương'
  },
  {
    name: 'Bàn trang điểm nhập khẩu',
    unit: 'cái',
    price: 3000000,
    category: 'Phòng ngủ',
    description: ''
  },
  {
    name: 'Giá bát cố định 2 tầng',
    unit: 'cái',
    price: 2150000,
    category: 'Phòng bếp',
    description: 'Tên sản phẩm: Giá để bát đĩa cố định\nChất liệu & xử lý: hợp kim nhôm + Inox304, điện phân\nKhoang Tủ: 800mm'
  },
  {
    name: 'Giá xoong',
    unit: 'cái',
    price: 2145000,
    category: 'Phòng bếp',
    description: 'Tên sản phẩm: Giá xoong nồi\nChất liệu & xử lý: Inox304 nan dẹt, điện phân\nKhoang Tủ: 800mm'
  },
  {
    name: 'Giá dao thớt',
    unit: 'cái',
    price: 2150000,
    category: 'Phòng bếp',
    description: 'Tên sản phẩm: Giá dao thớt, gia vị đa năng\nChất liệu & xử lý: Inox304 nan dẹt, điện phân\nKhoang Tủ: 350mm\nCó bánh xe chống rung'
  },
  {
    name: 'Giá bát nâng hạ',
    unit: 'cái',
    price: 4465000,
    category: 'Phòng bếp',
    description: 'Tên sản phẩm: Giá bát nâng hạ cơ\nChất liệu & xử lý: Inox304 nan dẹt, điện phân\nKhoang Tủ: 800mm'
  },
  {
    name: 'Chậu rửa+vòi',
    unit: 'bộ',
    price: 5695000,
    category: 'Phòng bếp',
    description: 'Chậu rửa 1 hố 7546G01 - 2 Phím có đèn LED\nChất liệu: Inox 304 Phủ nano tổ ong chống xước, chống bẩn\n- Vòi nước đa chức năng 3 chế độ + xả thác đổ\n- Khay rửa ly\n- Dây vòi lấy xà phòng\n- 2 khay rửa nhỏ\n- Thớt đi kèm\n- Hệ thống ống xả nước\n( Bảo hành 1 năm )'
  },
  {
    name: 'Hút mùi',
    unit: 'cái',
    price: 4600000,
    category: 'Phòng bếp',
    description: 'Hút mùi kính cong 3 tốc độ'
  },
  {
    name: 'Bếp từ đôi',
    unit: 'bộ',
    price: 4500000,
    category: 'Phòng bếp',
    description: 'Bếp từ đôi 02 vùng nấu - thương hiệu Gluka\n- Công nghệ Inverter Tiết kiệm điện\n- Công suất: 2200w - 2200w\n- Phím cảm ứng\nAn toàn: Quá nhiệt - Quá áp - Chống tràn - Khóa trẻ em\n- Kích thước vùng nấu 20 cm\n- Khung sơn tĩnh điện\n- Kính Ceramic, bo viền khung nhôm bảo vệ\n- Có thể lắp âm hoặc nổi trên bàn\n(lưu ý: Dùng nồi đáy phẳng chuyên cho bếp từ)'
  },
  {
    name: 'Thùng Gạo',
    unit: 'bộ',
    price: 2250000,
    category: 'Phòng bếp',
    description: 'Thùng gạo nhấn cơ - mặt kính bạc'
  },
  {
    name: 'Thùng rác Đôi gắn cánh',
    unit: 'cái',
    price: 1650000,
    category: 'Phòng bếp',
    description: 'Thùng rác đôi gắn cánh 300'
  },
  {
    name: 'Kính bếp',
    unit: 'md',
    price: 1250000,
    category: 'Phòng bếp',
    description: ''
  },
  {
    name: 'Đá bếp kim sa đen nhân tạo',
    unit: 'md',
    price: 1150000,
    category: 'Phòng bếp',
    description: ''
  },
  {
    name: 'Đá bếp kim sa đen tự nhiên',
    unit: 'md',
    price: 1450000,
    category: 'Phòng bếp',
    description: ''
  },
  {
    name: 'Cánh kính cường lực',
    unit: 'm2',
    price: 1650000,
    category: 'Phòng ngủ',
    description: 'độ dày 5ly'
  },
  {
    name: 'Tay CnC cánh kính',
    unit: 'cái',
    price: 700000,
    category: 'Phòng ngủ',
    description: ''
  },
  {
    name: 'Bản lề cánh kính',
    unit: 'cái',
    price: 50000,
    category: 'Phòng ngủ',
    description: ''
  }
];

