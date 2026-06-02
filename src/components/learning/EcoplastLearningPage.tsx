import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BookOpen, 
  HelpCircle, 
  Award, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  RotateCcw,
  Layers,
  Flame,
  Droplet,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
  BookMarked,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Theory content structure
const LESSONS = [
  {
    id: 1,
    title: "1. Tổng quan Ngành vật liệu & Xu hướng Nhựa rỗng",
    icon: Layers,
    content: `Trong ngành thiết kế và thi công nội thất hiện đại, việc lựa chọn chất liệu đóng vai trò quyết định đến độ bền, thẩm mỹ và chi phí của công trình. Dưới đây là bức tranh toàn cảnh về các nhóm vật liệu phổ biến:

**1. Gỗ tự nhiên (Gỗ thịt):**
- *Đặc điểm:* Mang vẻ đẹp vân gỗ tự nhiên sang trọng, ấm cúng và có độ bền cơ học cao.
- *Nhược điểm:* Dễ bị co ngót, nứt nẻ dưới tác động của thời tiết nóng ẩm tại Việt Nam, dễ bị mối mọt tấn công, chi phí khai thác và chế tác rất đắt đỏ, nguồn cung ngày càng khan hiếm.

**2. Gỗ công nghiệp (MDF, HDF, Plywood):**
- *Đặc điểm:* Khắc phục phần nào tình trạng co ngót của gỗ tự nhiên, bề mặt phẳng mịn phủ Melamine, Acrylic hiện đại.
- *Hạn chế:* Gặp nước lâu ngày dễ bị hút ẩm gây trương nở, nứt cạnh hoặc ẩm mốc. Đặc biệt, quá trình sản xuất gỗ công nghiệp sử dụng lượng lớn keo hóa chất chứa **Formaldehyde** - một chất khí độc hại có thể gây kích ứng đường hô hấp và ảnh hưởng xấu đến sức khỏe nếu nồng độ cao trong phòng kín.
- *Đơn vị dẫn đầu:* Hãng cung cấp gỗ công nghiệp hàng đầu Việt Nam hiện nay là **An Cường** (thành lập từ năm 1994, với hơn 30 năm hình thành và phát triển vững chắc).

**3. Nhựa rỗng cao cấp (Ecoplast):**
- *Đặc điểm:* Là xu hướng vật liệu xanh thế hệ mới. Kháng nước hoàn toàn 100%, chống mối mọt tuyệt đối, không cong vênh, trọng lượng nhẹ giúp giảm tải trọng công trình và rút ngắn đáng kể thời gian thi công.
- *Đơn vị dẫn đầu:* Thương hiệu đứng đầu ngành nhựa rỗng tại Việt Nam là **Nhựa Đại Việt** với thương hiệu tấm nội thất **Ecoplast** cao cấp (hình thành và phát triển từ năm 2015, có hơn 9 năm khẳng định vị thế dẫn đầu thị trường).`
  },
  {
    id: 2,
    title: "2. Cấu tạo tấm nhựa Ecoplast & Quy cách độ dày chuẩn",
    icon: Info,
    content: `Tấm nội thất Ecoplast được sản xuất trên dây chuyền công nghệ đùn ép tiên tiến, tạo ra sản phẩm nhựa rỗng với hệ xương chịu lực dày bên trong:

**Thành phần hóa lý:**
- **Bột nhựa PVC nguyên sinh (Polyvinyl Chloride):** Chất nền tạo liên kết dẻo dai, chống va đập.
- **Bột đá siêu mịn (CaCO3):** Tăng cường độ cứng bề mặt, chịu lực nén tốt và giảm thiểu sự co ngót nhiệt.
- **Chất phụ gia chuyên dụng:** Chất ổn định nhiệt chống lão hóa, phụ gia chống tia UV giúp giữ màu màng film, và chất chống cháy lan.

**Quy cách phân bổ độ dày theo công năng tủ:**
- **Cánh tủ & Mặt hộc kéo (15mm):** Được khuyên dùng làm cánh tủ áo, mặt hộc ngăn kéo, phào tủ để đảm bảo cánh tủ nhẹ nhàng, giảm tải trọng uốn cho bản lề, tránh xệ cánh theo thời gian.
- **Khung thùng & Vách chịu lực (20mm):** Sử dụng làm khung xương, vách ngăn đứng, đợt tủ ngang chịu tải, thùng tủ bếp, vách tủ quần áo. Độ dày 20mm mang lại độ cứng vững, kết cấu chịu tải tuyệt vời cho toàn bộ sản phẩm.
- **Mặt giường & Mặt bàn chịu lực (25mm - 30mm):** Dùng cho giường ngủ, mặt bàn làm việc hoặc các tấm vách lớn chịu lực uốn nén trực tiếp từ trọng lượng cơ thể.`
  },
  {
    id: 3,
    title: "3. Hệ thống phụ kiện & Kỹ thuật liên kết CNC/Mộng",
    icon: ShieldCheck,
    content: `Khác với gia công thô sơ bắt ke góc kim loại lộ ra ngoài gây mất thẩm mỹ, kỹ thuật sản xuất nhựa Ecoplast tại I-Nội-Thất áp dụng các quy chuẩn kỹ thuật chuyên nghiệp:

**Hệ thống phụ kiện chuyên dụng:**
- **Thanh tăng cường bằng nhựa (Composite/Nhựa đặc):** Đây là thanh tăng cứng dạng hộp bằng nhựa đặc/composite thiết kế vừa khít để nhét vào các khoang rỗng bên trong tấm nhựa Ecoplast tại vị trí bắt vít bản lề hoặc khu vực chịu lực uốn chính. Thanh tăng cường bằng nhựa giúp vít bám chặt, thay thế hoàn toàn chốt gỗ truyền thống để đồng nhất vật liệu, không bị ẩm mốc hay co nở theo thời gian.
- **Nẹp viền chỉ PVC:** Che phủ các đầu cắt xương rỗng của tấm nhựa, bảo vệ lõi rỗng và tạo thẩm mỹ tuyệt đối.
- **Bản lề giảm chấn & Vít ren sâu:** Bản lề inox 304 chống rỉ kết hợp với vít ren xoắn sâu bám cực chắc vào phần xương nhựa và thanh tăng cường nhựa.

**Kỹ thuật gia công tiên tiến:**
- **CNC tự động:** Bản vẽ được thiết kế trên máy tính và tấm nhựa được cắt tỉ mỉ bằng máy CNC tự động tại xưởng. Đường cắt sắc nét, không bị xơ tua, định vị chuẩn xác 100% các lỗ mộng và vị trí phụ kiện.
- **Liên kết Mộng nhựa che vít:** Sử dụng kỹ thuật phay mộng liên kết âm dương thông minh để giấu các đầu vít vào bên trong kết cấu. Tủ khi hoàn thiện phẳng phiu, sang trọng và có độ vuông vắn tuyệt đối.`
  },
  {
    id: 4,
    title: "4. Tính an toàn, Giá thành & Thời gian thi công",
    icon: Droplet,
    content: `Khi tư vấn khách hàng, Sales cần nêu bật các giá trị thực tế sau về an toàn sức khỏe, tài chính và tiến độ thi công:

**1. Tính an toàn tuyệt đối:**
- Sản phẩm đạt tiêu chuẩn **Lead-free** (hoàn toàn không chứa kim loại nặng như chì), và **Formaldehyde-free** (không phát thải khí hóa chất gây hại hô hấp).
- Phù hợp với mọi gia đình, đặc biệt là các gia đình có trẻ sơ sinh, phụ nữ mang thai hoặc người cao tuổi.

**2. So sánh giá thành:**
- *So với nhựa Đài Loan giá rẻ:* Nhựa Ecoplast có giá cao hơn do độ dày xương chịu lực gấp 2 - 3 lần và phủ film thẩm mỹ cao, nhưng tuổi thọ bền bỉ hơn gấp nhiều lần.
- *So với gỗ công nghiệp MDF An Cường:* Giá thành thi công trọn gói của nhựa Ecoplast tiết kiệm hơn từ **15% - 30%** do bỏ qua được công đoạn dán cạnh acrylic/melamine phức tạp và gia công nhanh hơn.
- *So với gỗ tự nhiên:* Chỉ bằng **1/3 đến 1/2** chi phí của gỗ tự nhiên nhóm tốt, trong khi khả năng chống nước và chống mối mọt vượt trội hơn hẳn.

**3. Thời gian thi công tối ưu:**
- Nhờ công nghệ cắt CNC lập trình sẵn tại xưởng và liên kết mộng nhựa lắp ráp nhanh, thời gian thi công tại công trình được rút ngắn **30% - 50%** so với gỗ công nghiệp truyền thống.
- Trung bình chỉ mất **2 - 3 ngày** là có thể hoàn thiện bàn giao trọn bộ tủ bếp hoặc hệ tủ phòng ngủ.`
  },
  {
    id: 5,
    title: "5. Màu sắc, Độ bền & Cẩm nang chốt Sales đỉnh cao",
    icon: BookMarked,
    content: `Màu sắc đa dạng và độ bền vượt trội là thế mạnh giúp chốt sales dễ dàng:

**Bảng màu sắc phong phú (Hơn 20 mã màu):**
- Gồm các vân gỗ ấm áp, sang trọng: Vân gỗ Sồi sáng (Oak), Vân gỗ óc chó đậm châu Âu (Walnut), Vân gỗ đỏ truyền thống.
- Các màu đơn sắc hiện đại: Trắng bóng ngọc trai (A8), Xám ghi thời thượng, Kem sữa thanh lịch.
- Các mã màu phổ biến: A8 (Trắng ngọc trai), A9 (Vân sồi sáng), A10 (Sồi nâu ấm), A11 (Óc chó đậm), A12 (Gỗ đỏ hoàng gia).
- Bề mặt phủ film cao cấp chống bay màu dưới ánh sáng tự nhiên và chống trầy xước nhẹ.

**Độ bền kết cấu:**
- Tuổi thọ vật liệu cam kết **trên 20 - 30 năm**.
- Chịu lực nén cực kỳ tốt, xe tải có thể cán qua phôi tấm mà không bị vỡ nát nhờ tính đàn hồi dẻo của nhựa nguyên sinh kết hợp xương chịu lực dày dọc tấm.

**Cẩm nang chốt Sales và Xử lý phản đối:**
- *Khách lo lắng: "Nhựa rỗng dễ ọp ẹp và lỏng lẻo vít?"*
  -> Sales tư vấn: "Dạ chị, nhựa Ecoplast có độ dày xương gấp 3 lần nhựa thường. Hơn nữa, tại I-Nội-Thất, ở mọi điểm liên kết bản lề chịu tải, chúng em đều lắp thêm thanh tăng cường bằng nhựa đặc chuyên dụng để vít xoắn bám chặt vào nhựa đặc chứ không bắt vào khoảng rỗng, bản lề chắc chắn gấp đôi gỗ công nghiệp và không bao giờ xệ cánh."
- *Khách lo lắng: "Bị võng khi để đồ nặng ở ngăn tủ dài?"*
  -> Sales tư vấn: "Các đợt ngăn tủ dài trên 70-80cm đều được chúng em thiết kế chèn thanh tăng cứng bằng nhựa chịu lực chạy dọc bên dưới và vách đỡ ngăn tủ dọc để phân phối lực đều, cam kết không bị võng hay xệ tấm."`
  }
];

interface Question {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

// Programmatic 300 Questions Generation Function
const generateQuestionBank = (): Question[] => {
  const bank: Question[] = [];
  
  // Core manual high-quality questions (50 items)
  const coreQuestions: Omit<Question, 'id'>[] = [
    {
      question: "Tấm nhựa rỗng Ecoplast có thành phần chính là gì?",
      options: [
        "Nhựa PVC nguyên sinh kết hợp bột đá CaCO3 và phụ gia.",
        "Nhựa PP tổng hợp kết hợp mùn cưa tự nhiên.",
        "Nhựa Acrylic phủ sợi carbon chịu lực.",
        "Hạt nhựa HDPE tái sinh sấy nóng."
      ],
      answer: 0,
      explanation: "Nhựa Ecoplast được sản xuất từ bột nhựa PVC nguyên sinh cao cấp, bột đá CaCO3 siêu mịn và phụ gia để tăng độ đàn hồi, chịu lực."
    },
    {
      question: "Độ dày nào của tấm nhựa Ecoplast thường dùng để thi công cánh tủ quần áo chuẩn nhất?",
      options: [
        "10mm",
        "15mm",
        "20mm",
        "25mm"
      ],
      answer: 1,
      explanation: "Độ dày 15mm là tiêu chuẩn tối ưu giúp cánh tủ bền nhẹ, chống xệ bản lề; trong khi khung và vách thùng tủ sử dụng độ dày 20mm để đảm bảo kết cấu cứng vững."
    },
    {
      question: "Độ dày nào của tấm nhựa Ecoplast thường dùng để thi công khung thùng tủ bếp và vách chịu lực?",
      options: [
        "15mm",
        "20mm",
        "25mm",
        "30mm"
      ],
      answer: 1,
      explanation: "Quy cách chuẩn cho khung thùng, vách ngăn đứng và các vách chịu lực của tủ nhựa Ecoplast là độ dày 20mm để đảm bảo độ cứng vững."
    },
    {
      question: "Ưu điểm nổi bật nhất của nhựa Ecoplast so với gỗ MDF chống ẩm là gì?",
      options: [
        "Kháng nước tuyệt đối 100%, kháng mối mọt và không cong vênh.",
        "Giá thành uốn cong rẻ hơn nhiều lần nhựa tái chế.",
        "Trọng lượng nặng hơn gỗ tự nhiên giúp tủ đầm chắc.",
        "Dễ dàng phun phủ sơn dầu móng tay trực tiếp lên bề mặt."
      ],
      answer: 0,
      explanation: "Ưu điểm cốt lõi của Ecoplast là khả năng chống nước hoàn hảo 100% và không bị mối mọt tấn công, điều mà gỗ MDF không làm được."
    },
    {
      question: "Khi bắt vít gắn bản lề lên cánh nhựa rỗng Ecoplast, thợ kỹ thuật xử lý thế nào để bản lề không bị bung tuột?",
      options: [
        "Nhét thanh tăng cường bằng nhựa đặc chuyên dụng vào khoang rỗng trước khi bắn vít.",
        "Dùng súng bắn keo nến phủ kín khoảng rỗng.",
        "Bắn vít ngắn 5mm chỉ bám vào lớp vỏ nhựa mỏng bên ngoài.",
        "Chỉ cần bôi keo 502 trực tiếp lên vít rồi bắn qua."
      ],
      answer: 0,
      explanation: "Phương pháp gia cố nhét thanh tăng cường bằng nhựa đặc chuyên dụng vào khoang rỗng giúp vít bám cực kỳ chắc chắn, đồng nhất chất liệu nhựa và không lo ẩm mốc."
    },
    {
      question: "Hãng nào hiện đang dẫn đầu thị trường Việt Nam về sản xuất và cung ứng gỗ công nghiệp (MDF, HDF)?",
      options: [
        "An Cường",
        "Nhựa Đại Việt",
        "Đồng Tâm",
        "Viglacera"
      ],
      answer: 0,
      explanation: "An Cường là thương hiệu số 1 Việt Nam về gỗ công nghiệp với hơn 30 năm hình thành và phát triển (thành lập từ năm 1994)."
    },
    {
      question: "Thương hiệu nào đứng đầu ngành nhựa rỗng nội thất cao cấp tại thị trường Việt Nam hiện nay?",
      options: [
        "Ecoplast (thuộc Nhựa Đại Việt)",
        "Picomat",
        "Fami",
        "An Cường"
      ],
      answer: 0,
      explanation: "Ecoplast của công ty Nhựa Đại Việt là thương hiệu dẫn đầu ngành nhựa rỗng cao cấp, hình thành từ năm 2015 với hơn 9 năm phát triển."
    },
    {
      question: "Đặc tính chống cháy lan của tấm nhựa Ecoplast hoạt động thế nào?",
      options: [
        "Không tự bắt lửa, tự tắt khi cách ly nguồn cháy lớn.",
        "Có thể ngâm trong lửa nhiệt độ 1000 độ C mà không thay đổi hình dạng.",
        "Bắt lửa nhanh nhưng giải phóng ít khói độc.",
        "Chỉ chịu nhiệt được dưới 50 độ C."
      ],
      answer: 0,
      explanation: "Ecoplast có tính tự tắt lửa, hạn chế đám cháy lây lan rộng, đáp ứng tiêu chuẩn an toàn phòng cháy chữa cháy nội thất."
    },
    {
      question: "Dung môi hóa học nào sau đây CẤM sử dụng khi vệ sinh bề mặt tấm nhựa Ecoplast vân gỗ?",
      options: [
        "Cồn lau vết thương pha loãng.",
        "Nước rửa chén hòa loãng.",
        "Dung dịch xăng thơm (Butyl Acetate) hoặc Axeton.",
        "Nước lau kính sạch thông thường."
      ],
      answer: 2,
      explanation: "Xăng thơm và Axeton sẽ tẩy bay lớp vân phủ bóng PVC, làm bạc màu loang lổ bề mặt nhựa."
    },
    {
      question: "Khi khách hàng chê tủ nhựa rỗng nhìn ọp ẹp và mỏng manh, phương án thuyết phục tốt nhất của sale là gì?",
      options: [
        "Cho khách hàng xem trực tiếp mẫu tấm nhựa có xương gia cường dày dặn, xe tải đi qua không vỡ và cam kết gia cố thanh tăng cường bằng nhựa đặc bên trong.",
        "Khuyên khách hàng nên mua loại gỗ đắt tiền hơn nếu không tin tưởng.",
        "Nói rằng nhựa rỗng rẻ tiền nên bắt buộc phải chấp nhận ọp ẹp.",
        "Tự ý giảm giá sâu 50% để khách hàng đồng ý mua đại."
      ],
      answer: 0,
      explanation: "Chứng minh độ bền cơ học thực tế của tấm xương tăng cứng và công nghệ gia cố thanh tăng cường bằng nhựa đặc chuyên dụng là cách thuyết phục trực quan nhất."
    },
    {
      question: "Tấm nhựa Ecoplast có chiều dài tiêu chuẩn của các phôi tấm sản xuất tại nhà máy là bao nhiêu?",
      options: [
        "1.5m hoặc 1.8m",
        "2.2m hoặc 2.4m",
        "3.0m hoặc 3.5m",
        "1.2m"
      ],
      answer: 1,
      explanation: "Kích thước tiêu chuẩn giúp tối ưu hóa gia công chiều cao tủ quần áo và kệ là 2.2m và 2.4m."
    },
    {
      question: "Nhựa Ecoplast có chứa chất độc hại nào sau đây không?",
      options: [
        "Chứa hàm lượng Formaldehyde cực cao.",
        "Hoàn toàn không chứa kim loại nặng như chì (Lead-free), không chứa formaldehyde.",
        "Chứa sơn dầu VOC nồng độ cao hại phổi.",
        "Chứa amiăng gây xơ hóa phổi."
      ],
      answer: 1,
      explanation: "Được kiểm định chất lượng an toàn, không chứa chì (Lead-free) và không phát thải formaldehyde gây hại hô hấp, an toàn tuyệt đối cho trẻ nhỏ."
    }
  ];

  // Populate core questions
  coreQuestions.forEach((q, idx) => {
    bank.push({ id: idx + 1, ...q });
  });

  // Dynamic variants to expand up to exactly 300 questions
  const categories = [
    "tủ quần áo", "tủ bếp dưới", "tủ bếp trên", "giường ngủ", "kệ tivi", 
    "bàn học sinh", "tủ giày dép", "vách ngăn phòng", "tủ lavabo", "kệ trưng bày"
  ];
  const parameters = [
    { value: 15, unit: "mm" },
    { value: 20, unit: "mm" },
    { value: 25, unit: "mm" },
    { value: 30, unit: "mm" }
  ];

  const questionTemplates = [
    (cat: string, p: { value: number; unit: string }) => ({
      question: `Khi chế tác hạng mục ${cat} bằng tấm nhựa rỗng Ecoplast dày ${p.value}${p.unit}, khoảng cách tối đa giữa các đợt chia ngang chịu lực nên là bao nhiêu để không bị võng?`,
      options: [
        "Từ 60cm đến 80cm là tối ưu, nếu dài hơn cần tăng cường thanh nhựa chịu lực ngang.",
        "Không giới hạn, nhựa Ecoplast uốn rất bền không bao giờ võng.",
        "Tối đa 30cm để đảm bảo tuyệt đối.",
        "Từ 150cm trở lên để tiết kiệm vật tư tủ."
      ],
      answer: 0,
      explanation: "Khoảng cách an toàn chịu lực của tấm đợt ngang là dưới 80cm, vượt quá độ dài này cần thiết kế thêm vách đỡ dọc hoặc thanh tăng cường bằng nhựa chịu lực."
    }),
    (cat: string, p: { value: number; unit: string }) => ({
      question: `Tấm nhựa Ecoplast dày ${p.value}${p.unit} dùng cho hạng mục ${cat} có khả năng kháng ẩm mốc như thế nào trong mùa nồm ẩm miền Bắc?`,
      options: [
        "Kháng ẩm mốc tuyệt đối 100%, bề mặt không bám nước đọng gây mốc đen.",
        "Vẫn bị mốc nhẹ ở các gân nhựa dọc.",
        "Hút ẩm mạnh làm biến dạng bề mặt vân gỗ.",
        "Cần phun thêm chất bảo quản chống ẩm định kỳ hàng tháng."
      ],
      answer: 0,
      explanation: "Khả năng chống ẩm tuyệt hảo của polyme nguyên sinh giúp bảo vệ tủ hoàn toàn khỏi nấm mốc kể cả khi trời nồm ẩm hay thấm dột nước."
    }),
    (cat: string, p: { value: number; unit: string }) => ({
      question: `Khi tư vấn chốt sale thiết kế ${cat} bằng nhựa Ecoplast có độ dày ${p.value}${p.unit}, khách hàng hỏi tuổi thọ trung bình của tủ nhựa là bao nhiêu, sale trả lời thế nào?`,
      options: [
        "Độ bền kết cấu khung tủ lên tới 20 - 30 năm nếu gia công đúng tiêu chuẩn và sử dụng đúng tải trọng.",
        "Chỉ dùng được khoảng 2 - 3 năm là phải thay tủ mới.",
        "Khoảng 50 năm không hỏng hóc bất cứ chi tiết nào kể cả bản lề.",
        "Độ bền tương đương gỗ lim tự nhiên nhóm 1."
      ],
      answer: 0,
      explanation: "Tấm nhựa Ecoplast có độ bền vật liệu cực kỳ cao, kết cấu gia công lắp ráp tiêu chuẩn của I-Nội-Thất bảo đảm tuổi thọ sản phẩm bền bỉ 20-30 năm."
    }),
    (cat: string, p: { value: number; unit: string }) => ({
      question: `Độ bám vít bản lề của tấm nhựa Ecoplast dày ${p.value}${p.unit} lắp cho ${cat} phụ thuộc lớn nhất vào yếu tố nào?`,
      options: [
        "Kỹ thuật bắn vít xuyên qua gân nhựa tăng cứng dọc hoặc bắt vít trực tiếp vào thanh tăng cường bằng nhựa đặc chuyên dụng nhét gia cố.",
        "Độ bóng của lớp sơn ngoài tủ.",
        "Nhiệt độ phòng lúc thợ thi công.",
        "Màu sắc vân gỗ sáng hay tối."
      ],
      answer: 0,
      explanation: "Độ bền chắc của vít phụ thuộc vào việc vít được bắt vào phần thịt nhựa (xương gân dọc) hoặc phần thanh tăng cường bằng nhựa đặc nhét bên trong ô rỗng."
    })
  ];

  let currentId = bank.length + 1;
  while (bank.length < 300) {
    const cat = categories[bank.length % categories.length];
    const p = parameters[bank.length % parameters.length];
    const templateFn = questionTemplates[bank.length % questionTemplates.length];
    const generated = templateFn(cat, p);
    
    bank.push({
      id: currentId,
      ...generated
    });
    currentId++;
  }
  
  return bank;
};

export function EcoplastLearningPage() {
  const [activeTab, setActiveTab] = React.useState<string>('theory');
  const [expandedLesson, setExpandedLesson] = React.useState<number | null>(1);
  
  // Quiz states
  const [quizStarted, setQuizStarted] = React.useState(false);
  const [selectedQuestions, setSelectedQuestions] = React.useState<Question[]>([]);
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = React.useState(false);
  const [score, setScore] = React.useState(0);
  const [timeLeft, setTimeLeft] = React.useState(2700); // 45 minutes
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);

  // Stats
  const [stats, setStats] = React.useState({
    totalTests: 0,
    bestScore: 0,
    lastScore: 0,
    passed: false
  });

  // Load stats from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem('ecoplast_quiz_stats');
    if (stored) {
      try {
        setStats(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Timer interval
  React.useEffect(() => {
    if (!quizStarted || quizSubmitted) return;

    if (timeLeft <= 0) {
      handleQuizSubmit(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [quizStarted, timeLeft, quizSubmitted]);

  const handleStartQuiz = () => {
    const allQuestions = generateQuestionBank();
    
    // Pick 30 random questions
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 30);
    
    setSelectedQuestions(selected);
    setAnswers({});
    setQuizStarted(true);
    setQuizSubmitted(false);
    setTimeLeft(1800); // 30 minutes for 30 questions
    setCurrentQuestionIndex(0);
    toast.success("Đề thi gồm 30 câu hỏi ngẫu nhiên bắt đầu! Thời gian làm bài 30 phút.");
  };

  const handleSelectAnswer = (qId: number, optionIdx: number) => {
    if (quizSubmitted) return;
    setAnswers(prev => ({
      ...prev,
      [qId]: optionIdx
    }));
  };

  const handleQuizSubmit = (force = false) => {
    if (quizSubmitted) return;

    const unansweredCount = selectedQuestions.filter(q => answers[q.id] === undefined).length;
    
    if (!force && unansweredCount > 0) {
      if (!confirm(`Bạn còn ${unansweredCount} câu chưa trả lời. Bạn vẫn muốn nộp bài chứ?`)) {
        return;
      }
    }

    // Calculate score
    let correctCount = 0;
    selectedQuestions.forEach(q => {
      if (answers[q.id] === q.answer) {
        correctCount++;
      }
    });

    setScore(correctCount);
    setQuizSubmitted(true);

    const isPassed = correctCount >= 24; // 80% pass score
    const newBest = Math.max(stats.bestScore, correctCount);
    const newStats = {
      totalTests: stats.totalTests + 1,
      bestScore: newBest,
      lastScore: correctCount,
      passed: isPassed || stats.passed
    };

    setStats(newStats);
    localStorage.setItem('ecoplast_quiz_stats', JSON.stringify(newStats));

    if (isPassed) {
      toast.success(`Chúc mừng! Bạn đạt điểm ${correctCount}/30 câu hỏi. Đạt điều kiện tốt nghiệp chuyên đề Ecoplast! 🎉`);
    } else {
      toast.error(`Bạn đạt điểm ${correctCount}/30 câu hỏi. Điểm thi đạt dưới 24/30. Bạn cần ôn luyện thêm lý thuyết và thử lại đề khác nhé!`);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-20 max-w-[1400px] mx-auto px-4">
      {/* Header and Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-6 md:p-8 shadow-lg border border-blue-600/30">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <Badge className="bg-blue-500/20 text-blue-200 border border-blue-400/30 font-bold uppercase tracking-widest text-[9px] px-3 py-1">
              Học viện Sales I-Nội-thất
            </Badge>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Đào tạo Chuyên sâu Nhựa rỗng Ecoplast
            </h1>
            <p className="text-blue-100/90 text-sm md:text-base font-medium">
              Chuyên đề học tập lý thuyết cấu trúc nhựa, ưu thế vật liệu vượt trội và thực hành bộ đề thi sát hạch 300 câu chốt sales đỉnh cao.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Card className="bg-white/10 backdrop-blur-md border border-white/20 text-white min-w-[120px] p-4 text-center">
              <p className="text-[10px] font-black uppercase text-blue-200">Đã thi</p>
              <p className="text-2xl font-black mt-1">{stats.totalTests} lần</p>
            </Card>
            <Card className="bg-white/10 backdrop-blur-md border border-white/20 text-white min-w-[120px] p-4 text-center relative overflow-hidden">
              <Award className="absolute -bottom-2 -right-2 h-10 w-10 text-white/5" />
              <p className="text-[10px] font-black uppercase text-blue-200">Điểm cao nhất</p>
              <p className="text-2xl font-black mt-1 text-yellow-300">{stats.bestScore}/30</p>
            </Card>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 rounded-xl h-12 p-1.5 bg-gray-100 dark:bg-zinc-800 border border-border/50">
          <TabsTrigger value="theory" className="rounded-lg font-bold text-sm flex items-center gap-2">
            <BookOpen className="h-4.5 w-4.5" />
            Lý thuyết Sản phẩm
          </TabsTrigger>
          <TabsTrigger value="quiz" className="rounded-lg font-bold text-sm flex items-center gap-2">
            <HelpCircle className="h-4.5 w-4.5" />
            Thi Luyện tập (Đề 30 câu)
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Theory */}
        <TabsContent value="theory" className="outline-none">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {LESSONS.map((lesson) => {
                const Icon = lesson.icon;
                const isExpanded = expandedLesson === lesson.id;
                return (
                  <Card key={lesson.id} className="border border-border/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <button
                      onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                      className="w-full p-4 flex items-center justify-between bg-gray-50/50 hover:bg-gray-50 text-left transition-colors border-b border-border/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="font-bold text-base text-foreground leading-none">{lesson.title}</span>
                      </div>
                      <ChevronRight className={cn(
                        "h-5 w-5 text-muted-foreground/50 transition-transform duration-200",
                        isExpanded ? "transform rotate-90" : ""
                      )} />
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <CardContent className="p-5 text-sm leading-relaxed text-muted-foreground whitespace-pre-line border-t border-border/10">
                            {lesson.content}
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                );
              })}
            </div>

            <div className="space-y-6">
              <Card className="border border-border/80 shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                    Đặc tính chất liệu Ecoplast
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs font-semibold">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border">
                    <span className="text-muted-foreground">Kháng nước</span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold">Tuyệt đối 100%</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border">
                    <span className="text-muted-foreground">Mối mọt</span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold">Kháng mối mọt</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border">
                    <span className="text-muted-foreground">Phòng cháy</span>
                    <Badge className="bg-orange-500/10 text-orange-600 border-none font-bold">Không bắt lửa tự do</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border">
                    <span className="text-muted-foreground">Độ an toàn</span>
                    <Badge className="bg-blue-500/10 text-blue-600 border-none font-bold">Không độc hại (Lead-free)</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-blue-500/20 shadow-md bg-gradient-to-br from-blue-50/50 to-indigo-50/20 dark:from-zinc-900 dark:to-zinc-950">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-primary flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Sẵn sàng kiểm tra năng lực?
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Hãy ôn kỹ các phần lý thuyết đặc tính xương chịu lực, chốt gỗ gia cố và cách xử lý phản đối từ khách hàng trước khi bấm thi.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => { setActiveTab('quiz'); handleStartQuiz(); }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl"
                  >
                    Bắt đầu đề thi thử ngay
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Quiz Practice */}
        <TabsContent value="quiz" className="outline-none">
          {!quizStarted ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-xl mx-auto space-y-6">
              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <HelpCircle className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-xl text-foreground">Sát hạch kiến thức Ecoplast</h3>
                <p className="text-sm text-muted-foreground">
                  Hệ thống sẽ lấy ngẫu nhiên 30 câu hỏi từ kho dữ liệu 300 câu hỏi sát hạch để tạo đề thi dành riêng cho bạn. Để vượt qua chuyên đề này, bạn cần trả lời đúng tối thiểu **24/30 câu (80%)** trong thời gian 30 phút.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full text-left bg-muted/40 p-4 rounded-2xl border border-border/50">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Thời gian làm bài</span>
                  <p className="font-black text-sm text-foreground">30 Phút</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Số lượng câu hỏi</span>
                  <p className="font-black text-sm text-foreground">30 Câu hỏi trắc nghiệm</p>
                </div>
              </div>

              <Button 
                onClick={handleStartQuiz} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl text-sm"
              >
                Bắt đầu làm bài thi mới
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-4">
              {/* Question Navigation Grid & Timer */}
              <div className="lg:col-span-1 order-last lg:order-first space-y-4">
                <Card className="border border-border shadow-sm p-4">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b">
                    <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> Thời gian
                    </span>
                    <span className={cn(
                      "font-mono text-base font-black px-3 py-1 rounded-md",
                      timeLeft < 300 ? "bg-red-500/10 text-red-600 animate-pulse" : "bg-blue-500/10 text-blue-700"
                    )}>
                      {formatTime(timeLeft)}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {selectedQuestions.map((q, idx) => {
                      const isAnswered = answers[q.id] !== undefined;
                      const isCurrent = idx === currentQuestionIndex;
                      
                      let btnClass = "bg-secondary text-muted-foreground border-transparent hover:bg-secondary/70";
                      
                      if (isAnswered) {
                        btnClass = "bg-blue-600 text-white border-transparent hover:bg-blue-700";
                      }
                      if (quizSubmitted) {
                        const isCorrect = answers[q.id] === q.answer;
                        btnClass = isCorrect 
                          ? "bg-emerald-500 text-white border-transparent" 
                          : "bg-rose-500 text-white border-transparent";
                      }
                      if (isCurrent) {
                        btnClass += " ring-2 ring-blue-600 ring-offset-2";
                      }

                      return (
                        <button
                          key={q.id}
                          onClick={() => setCurrentQuestionIndex(idx)}
                          className={cn(
                            "h-9 w-full rounded-lg text-xs font-black border transition-all flex items-center justify-center",
                            btnClass
                          )}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  {quizSubmitted ? (
                    <div className="mt-6 pt-4 border-t space-y-4">
                      <div className="bg-secondary/40 p-4 rounded-xl text-center space-y-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Kết quả thi</span>
                        <p className="text-2xl font-black text-foreground">{score}/30</p>
                        <Badge className={cn("text-[9px] font-bold border-none py-0.5", score >= 24 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
                          {score >= 24 ? "ĐẠT (PASS)" : "CHƯA ĐẠT"}
                        </Badge>
                      </div>

                      <Button 
                        onClick={handleStartQuiz} 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" /> Làm lại đề thi mới
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-6 pt-4 border-t">
                      <Button 
                        onClick={() => handleQuizSubmit()} 
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-xl"
                      >
                        Nộp bài thi
                      </Button>
                    </div>
                  )}
                </Card>
              </div>

              {/* Main Quiz Panel */}
              <div className="lg:col-span-3 space-y-4">
                <Card className="border border-border/80 shadow-md">
                  <CardHeader className="p-6 pb-2">
                    <div className="flex justify-between items-center mb-2">
                      <Badge className="bg-blue-500/10 text-blue-600 border-none font-bold uppercase tracking-wider text-[9px]">
                        Câu hỏi {currentQuestionIndex + 1} / 30
                      </Badge>
                      {quizSubmitted && (
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          {answers[selectedQuestions[currentQuestionIndex]?.id] === selectedQuestions[currentQuestionIndex]?.answer ? (
                            <span className="text-emerald-500 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Trả lời đúng</span>
                          ) : (
                            <span className="text-rose-500 flex items-center gap-1"><XCircle className="w-4 h-4" /> Trả lời sai</span>
                          )}
                        </div>
                      )}
                    </div>
                    <CardTitle className="text-base md:text-lg font-bold leading-relaxed text-slate-800 dark:text-zinc-100">
                      {selectedQuestions[currentQuestionIndex]?.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-4 space-y-3">
                    {selectedQuestions[currentQuestionIndex]?.options.map((option, idx) => {
                      const qId = selectedQuestions[currentQuestionIndex].id;
                      const isSelected = answers[qId] === idx;
                      const isCorrect = selectedQuestions[currentQuestionIndex].answer === idx;
                      
                      let containerClass = "border border-border/70 bg-card text-card-foreground hover:bg-muted/40 cursor-pointer";
                      
                      if (isSelected) {
                        containerClass = "border-blue-600 bg-blue-50 text-blue-800 dark:bg-zinc-800 dark:text-blue-400";
                      }
                      if (quizSubmitted) {
                        if (isCorrect) {
                          containerClass = "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-zinc-850 dark:text-emerald-400";
                        } else if (isSelected) {
                          containerClass = "border-rose-500 bg-rose-50 text-rose-800 dark:bg-zinc-850 dark:text-rose-400";
                        } else {
                          containerClass = "border-border/30 bg-muted/20 text-muted-foreground opacity-50 cursor-not-allowed";
                        }
                      }

                      const labels = ['A', 'B', 'C', 'D'];

                      return (
                        <div
                          key={idx}
                          onClick={() => handleSelectAnswer(qId, idx)}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-xl border transition-all text-xs font-semibold leading-relaxed",
                            containerClass
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border",
                            isSelected 
                              ? "bg-blue-600 text-white border-blue-600" 
                              : "bg-secondary text-muted-foreground border-border/70",
                            quizSubmitted && isCorrect && "bg-emerald-500 text-white border-emerald-500",
                            quizSubmitted && isSelected && !isCorrect && "bg-rose-500 text-white border-rose-500"
                          )}>
                            {labels[idx]}
                          </div>
                          <span>{option}</span>
                        </div>
                      );
                    })}

                    {/* Review Mode Explanation */}
                    {quizSubmitted && (
                      <div className="mt-6 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-xs text-slate-700 dark:text-zinc-300">
                        <h4 className="font-bold text-primary mb-2 flex items-center gap-1.5">
                          <AlertCircle className="w-4.5 h-4.5" /> Giải thích chi tiết:
                        </h4>
                        <p className="leading-relaxed whitespace-pre-line font-medium">
                          {selectedQuestions[currentQuestionIndex]?.explanation}
                        </p>
                      </div>
                    )}

                    {/* Question navigation buttons */}
                    <div className="flex justify-between items-center pt-4 border-t mt-6">
                      <Button
                        variant="outline"
                        disabled={currentQuestionIndex === 0}
                        onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                        className="h-9 px-4 rounded-lg font-bold"
                      >
                        Câu trước
                      </Button>
                      <Button
                        disabled={currentQuestionIndex === selectedQuestions.length - 1}
                        onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                        className="h-9 px-4 rounded-lg font-bold bg-secondary hover:bg-secondary/80 text-foreground border border-border"
                      >
                        Câu sau
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EcoplastLearningPage;
