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
  Info,
  Ruler,
  Plus,
  Edit2,
  Trash2,
  Upload,
  X,
  User,
  Users,
  ShieldAlert,
  MessageSquare,
  Check,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/contexts/AuthContext';
import { z } from 'zod';
import { db, collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, storage, ref, uploadBytes, getDownloadURL } from '../../lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { where } from 'firebase/firestore';

// Theory content structure
// Zod schema for validation
const lessonSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1, "Tiêu đề không được để trống"),
  content: z.string().min(1, "Nội dung không được để trống"),
  order: z.number().int().nonnegative(),
  iconName: z.string().min(1, "Vui lòng chọn Icon đại diện"),
  imageUrl: z.string().optional().default("")
});

type LessonType = z.infer<typeof lessonSchema>;

const userProgressSchema = z.object({
  userId: z.string(),
  userEmail: z.string(),
  userName: z.string(),
  lessonId: z.number().int().positive(),
  lessonTitle: z.string(),
  studyTime: z.number().nonnegative(),
  isCompleted: z.boolean(),
  updatedAt: z.string()
});

type UserProgressType = z.infer<typeof userProgressSchema>;

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Layers,
  Info,
  BookMarked,
  ShieldCheck,
  Droplet,
  TrendingUp,
  Clock,
  BookOpen,
  Flame,
  Award,
  Ruler
};

// Default static lessons for database initialization
const DEFAULT_LESSONS: LessonType[] = [
  {
    id: 1,
    title: "1. Giới thiệu Ngành vật liệu & Xu hướng Nhựa rỗng",
    order: 1,
    iconName: "Layers",
    content: `Trong ngành thiết kế và thi công nội thất hiện đại, việc lựa chọn chất liệu đóng vai trò quyết định đến độ bền, thẩm mỹ và chi phí của công trình. Dưới đây là bức tranh toàn cảnh về các nhóm vật liệu phổ biến:

**1. Gỗ tự nhiên (Gỗ thịt):**
- *Đặc điểm:* Mang vẻ đẹp vân gỗ tự nhiên sang trọng, ấm cúng và có độ bền cơ học cao.
- *Nhược điểm:* Dễ bị co ngót, nứt nẻ dưới tác động của thời tiết nóng ẩm tại Việt Nam, dễ bị mối mọt tấn công, chi phí khai thác và chế tác rất đắt đỏ, nguồn cung ngày càng khan hiếm.

**2. Gỗ công nghiệp (MDF, HDF, Plywood):**
- *Đặc điểm:* Khắc phục phần nào tình trạng co ngót của gỗ tự nhiên, bề mặt phẳng mịn phủ Melamine, Acrylic hiện đại.
- *Hạn chế:* Gặp nước lâu ngày dễ bị hút ẩm gây trương nở, nứt cạnh hoặc ẩm mốc. Quá trình sản xuất gỗ công nghiệp sử dụng lượng lớn keo hóa chất chứa **Formaldehyde** - một chất khí độc hại có thể gây kích ứng đường hô hấp và ảnh hưởng xấu đến sức khỏe nếu nồng độ cao trong phòng kín.
- *Đơn vị dẫn đầu:* Hãng cung cấp gỗ công nghiệp hàng đầu Việt Nam hiện nay là **An Cường** (thành lập từ năm 1994, với hơn 30 năm hình thành và phát triển vững chắc).

**3. Nhựa rỗng cao cấp (Ecoplast):**
- *Đặc điểm:* Là xu hướng vật liệu xanh thế hệ mới. Kháng nước hoàn toàn 100%, chống mối mọt tuyệt đối, không cong vênh, trọng lượng nhẹ giúp giảm tải trọng công trình và rút ngắn đáng kể thời gian thi công.
- *Đơn vị dẫn đầu:* Thương hiệu đứng đầu ngành nhựa rỗng tại Việt Nam là **Nhựa Đại Việt** với thương hiệu tấm nội thất **Ecoplast** cao cấp (hình thành và phát triển từ năm 2015, có hơn 9 năm khẳng định vị thế dẫn đầu thị trường).`
  },
  {
    id: 2,
    title: "2. Cấu tạo Chi tiết Tấm nhựa Ecoplast",
    order: 2,
    iconName: "Info",
    content: `Tấm nội thất Ecoplast được sản xuất trên dây chuyền công nghệ đùn ép tiên tiến, tạo ra cấu trúc nhựa rỗng với hệ xương chịu lực dày bên trong:

**Thành phần cấu tạo chính:**
- **Bột nhựa PVC nguyên sinh (Polyvinyl Chloride):** Chiếm tỷ lệ lớn, đóng vai trò liên kết nền, tạo độ dẻo dai và tính đàn hồi tốt trước va đập.
- **Bột đá siêu mịn (CaCO3):** Tăng độ cứng bề mặt, tăng khả năng chịu nén và giảm co ngót nhiệt.
- **Chất phụ gia chuyên dụng:** Chất ổn định nhiệt chống lão hóa, phụ gia chống tia UV giúp bảo vệ bề mặt màng film, và chất chống cháy lan.

**Quy cách độ dày chuẩn theo công năng:**
- **Độ dày 15mm (Cánh tủ & Ngăn kéo):** Dùng làm cánh tủ quần áo, mặt hộc ngăn kéo, phào tủ. Giúp cánh tủ nhẹ nhàng, giảm tải trọng uốn cho bản lề, tránh xệ cánh theo thời gian.
- **Độ dày 20mm (Khung thùng & Vách chịu lực):** Sử dụng làm khung xương, vách đứng, đợt tủ ngang chịu tải, thùng tủ bếp. Mang lại kết cấu cứng vững cao cho toàn bộ sản phẩm.
- **Độ dày 25mm - 30mm (Mặt giường & Mặt bàn):** Dùng cho giường ngủ, mặt bàn học, bàn làm việc chịu tải trọng động và tĩnh rất lớn.`
  },
  {
    id: 3,
    title: "3. Hệ thống Phụ kiện Chuyên dụng đi kèm",
    order: 3,
    iconName: "BookMarked",
    content: `Để hoàn thiện sản phẩm nhựa Ecoplast cao cấp, hệ thống phụ kiện chuyên dụng đi kèm đóng vai trò cực kỳ quan trọng:

**1. Thanh tăng cường bằng nhựa (Composite/Nhựa đặc):**
- Đây là thanh tăng cứng dạng hộp bằng nhựa đặc/composite thiết thiết kế vừa khít để nhét vào các khoang rỗng bên trong tấm nhựa Ecoplast tại vị trí bắt vít bản lề hoặc khu vực chịu lực uốn chính.
- Thanh tăng cường bằng nhựa giúp vít bám chặt, thay thế hoàn toàn chốt gỗ truyền thống để đồng nhất vật liệu nhựa, không lo bị ẩm mốc, mối mọt hay co nở theo thời gian.

**2. Nẹp chỉ viền PVC:**
- Được dán bo kín các đầu cắt hở của xương nhựa bằng keo chuyên dụng, giúp che lõi rỗng và tăng độ thẩm mỹ.

**3. Bản lề giảm chấn & Vít ren sâu:**
- Bản lề inox 304 kháng rỉ kết hợp vít xoắn ren sâu bám chặt vào lớp nhựa dày và thanh tăng cứng, chống lỏng lẻo bản lề.`
  },
  {
    id: 4,
    title: "4. Cách thức Liên kết (Mộng & CNC)",
    order: 4,
    iconName: "ShieldCheck",
    content: `Quy trình chế tác nhựa Ecoplast tại I-Nội-Thất áp dụng các công nghệ cơ khí chính xác:

**1. Công nghệ cắt CNC tự động:**
- Bản vẽ tủ được thiết kế lập trình sẵn trên máy tính và tấm nhựa được cắt tự động bằng máy CNC chuyên dụng tại xưởng.
- Đường cắt cực kỳ sắc nét, phẳng mịn, không bị xơ tua, định vị chuẩn xác 100% các vị trí mộng liên kết và lỗ bắt vít bản lề.

**2. Liên kết mộng nhựa liên kết âm/dương:**
- Thay vì bắt ke góc sắt thô sơ và mất thẩm mỹ, các tấm nhựa được phay mộng rãnh âm dương ăn khớp hoàn hảo với nhau.
- Các đầu vít liên kết được che giấu khéo léo vào bên trong thùng tủ, giúp kết cấu tủ vững chãi, vuông vắn tuyệt đối và sang trọng.`
  },
  {
    id: 5,
    title: "5. Tính An toàn Sức khỏe của Vật liệu",
    order: 5,
    iconName: "Droplet",
    content: `Nhựa Ecoplast là vật liệu an toàn tuyệt đối với sức khỏe con người và thân thiện với môi trường nhờ các kiểm định nghiêm ngặt:

**1. Tiêu chuẩn Lead-free (Không chì):**
- Trong quá trình đúc ép, Ecoplast hoàn toàn không sử dụng các chất ổn định chứa chì, loại bỏ nguy cơ nhiễm độc kim loại nặng.

**2. Tiêu chuẩn Formaldehyde-free (Không hóa chất độc hại):**
- Hoàn toàn không chứa formaldehyde như gỗ công nghiệp truyền thống (loại gỗ dùng nhiều keo hóa chất dán bột gỗ). Do đó, sản phẩm không có mùi hắc khó chịu khi lắp phòng kín.

**3. Đối tượng sử dụng:**
- Cực kỳ an toàn cho trẻ sơ sinh, trẻ nhỏ, phụ nữ mang thai và người cao tuổi. Vật liệu có khả năng tái chế 100%, góp phần bảo vệ tài nguyên rừng.`
  },
  {
    id: 6,
    title: "6. So sánh Giá thành của Nhựa Ecoplast",
    order: 6,
    iconName: "TrendingUp",
    content: `Giá thành của nhựa Ecoplast tối ưu và hiệu quả về mặt kinh tế lâu dài:

**1. So với nhựa Đài Loan giá rẻ:**
- Nhựa Ecoplast có giá thành cao hơn nhựa Đài Loan thông thường, nhưng chất lượng vượt trội hoàn toàn nhờ độ dày xương chịu tải gấp 2 - 3 lần và bề mặt film sắc nét, độ bền gấp 5 - 10 lần.

**2. So với gỗ công nghiệp MDF An Cường chống ẩm:**
- Giá thành thi công trọn gói của nhựa Ecoplast tiết kiệm hơn từ **15% - 30%** do cấu tạo phôi tấm nhẹ hơn, thời gian thi công nhanh hơn và bỏ qua công đoạn dán cạnh melamine/acrylic đắt đỏ.

**3. So với gỗ tự nhiên:**
- Chỉ bằng **1/3 đến 1/2** chi phí của gỗ tự nhiên chất lượng tốt, trong khi độ bền kháng ẩm, kháng mối mọt và tính thẩm mỹ hiện đại vượt trội hơn hẳn.`
  },
  {
    id: 7,
    title: "7. Thời gian Sản xuất & Thi công Lắp đặt",
    order: 7,
    iconName: "Clock",
    content: `Ưu thế lớn của tấm nội thất nhựa Ecoplast là tốc độ sản xuất và thi công cực kỳ nhanh chóng:

**1. Rút ngắn thời gian gia công:**
- Nhờ công nghệ cắt CNC lập trình sẵn tại xưởng và liên kết mộng nhựa lắp ráp nhanh, thời gian thi công tại công trình được rút ngắn **30% - 50%** so với gỗ công nghiệp truyền thống.

**2. Tiến độ thực tế:**
- Một căn phòng ngủ gồm hệ tủ quần áo, giường ngủ và bàn trang điểm nhựa Ecoplast có thể thi công trọn gói tại xưởng chỉ trong **1 ngày** và lắp đặt hoàn thiện tại công trình trong vòng **4 - 6 giờ**.
- Trung bình chỉ mất **2 - 3 ngày** để hoàn thiện trọn bộ tủ bếp cho khách hàng.`
  },
  {
    id: 8,
    title: "8. Màu sắc, Mã màu & Số lượng Màu sắc",
    order: 8,
    iconName: "BookOpen",
    content: `Nhựa Ecoplast mang lại sự đa dạng về mặt thẩm mỹ với hơn 20 mã màu sắc phong phú được phân cấp rõ ràng theo từng dòng sản phẩm để đáp ứng nhu cầu thiết kế từ bình dân đến cao cấp:

**1. Dòng Ecoplast In Vân (UV Standard):**
- *Công nghệ:* Vân gỗ được in trực tiếp lên bề mặt phôi nhựa bằng công nghệ in UV hiện đại, phủ bóng bảo vệ.
- *Các mã màu phổ biến:*
  - **AT** (Vân gỗ Teak cổ điển - sắc vàng sẫm)
  - **AV** (Vân gỗ Vàng nhạt - sáng sủa, thanh lịch)
  - **A2** (Vân gỗ Sồi nhạt Bắc Âu - trẻ trung, nhẹ nhàng)
  - **A7** (Vân gỗ Đỏ / Xoan đào truyền thống - trầm ấm, lịch lãm)
  - **A15, A16, AF, AH, A1D** (Các mã vân gỗ in tiêu chuẩn khác).

**2. Dòng Ecoplast Phủ Film (Premium/Luxury):**
- *Công nghệ:* Dán phủ màng film PVC cao cấp chịu nhiệt, tạo vân gỗ nổi có chiều sâu 3D chân thực, xúc cảm sần nhẹ như gỗ thật.
- *Các mã màu phổ biến:*
  - **A9** (Vân sồi trắng Thụy Điển - hiện đại, sang trọng)
  - **A10** (Vân sồi nâu ấm áp - nhã nhặn, tự nhiên)
  - **A11** (Vân gỗ Óc chó đậm châu Âu - đẳng cấp, thời thượng)
  - **A12** (Vân gỗ Đỏ hoàng gia - quý phái, truyền thống)
  - **Dòng Ecoplast Luxury (Dán phin đặc biệt):** **Lux 01** (Sồi xám phong trần), **Lux 02** (Óc chó vương giả), **Lux 04** (Gỗ tếch nhiệt đới), **Lux 06** (Mun sọc huyền bí), **Lux 24** (Vân vải xám Linen thời thượng), **Lux 25**, **Lux 26**.

**3. Dòng Ecoplast Galaxy (Galaxy Stars):**
- *Đặc điểm:* Các tông màu nhũ ánh kim sa lấp lánh như dải ngân hà dưới ánh sáng đèn trang trí.
- *Các mã màu phổ biến:*
  - **S6** (Nhũ bạc ánh sao - sang trọng, tinh tế)
  - **S8** (Đen vũ trụ hạt kim sa - huyền ảo, độc lạ)
  - **Trắng nhũ ngọc trai ánh kim** (A8 Galaxy - bóng bẩy, cao cấp).

**4. Dòng tấm nhựa sinh thái Eco+ (Eco Plus):**
- *Đặc điểm:* Dòng sản phẩm thế hệ mới của Nhựa Đại Việt với chất lượng phôi siêu chịu lực và bảng màu thời trang độc quyền.
- *Các mã màu phổ biến:* **E1** (Sồi sa mạc), **E2** (Gỗ óc chó sần Bắc Mỹ), **E3** (Xám xi măng lỳ industrial), **E4** (Trắng sữa bóng Acrylic), **E5** (Xanh mint pastel matte chống bám vân tay), **E6** (Hồng đất ấm pastel matte).`
  },
  {
    id: 9,
    title: "9. Độ bền của Nhựa Ecoplast",
    order: 9,
    iconName: "Flame",
    content: `Nhựa Ecoplast được đánh giá là một trong những vật liệu nội thất có độ bền kết cấu tốt nhất hiện nay:

**1. Tuổi thọ sử dụng:**
- Độ bền vật liệu cam kết trên **20 - 30 năm** trong điều kiện sử dụng thông thường.

**2. Khả năng chịu lực nén cực kỳ cao:**
- Nhờ cấu trúc xương chịu lực dọc dày dặn kết hợp với độ đàn hồi cao của nhựa PVC nguyên sinh, tấm nhựa Ecoplast chịu tải trọng uốn nén rất tốt (xe tải cán qua phôi tấm mà không bị nứt vỡ).

**3. Kháng nước tuyệt đối 100% & Kháng mối mọt hoàn toàn:**
- Không lo bị ngập nước gây phồng rộp, nấm mốc hay xệ mục. Mối mọt hoàn toàn không ăn mòn được vật liệu polyme.`
  },
  {
    id: 10,
    title: "10. Cẩm nang chốt Sales & Kỹ năng xử lý từ chối",
    order: 10,
    iconName: "Award",
    content: `Dành cho nhân viên tư vấn chốt Sales thực tế tại công trình hoặc showroom khi đối mặt với các băn khoăn của khách hàng:

**TÌNH HUỐNG 1: KHÁCH HÀNG SO SÁNH VỚI GỖ CÔNG NGHIỆP AN CƯỜNG CHỐNG ẨM**
- *Khách hàng phân vân:* "Chị thấy gỗ MDF chống ẩm của An Cường làm tủ nhìn phẳng phiu, vuông vắn và sang trọng hơn nhiều. Tủ nhựa Ecoplast này trông vẫn có vẻ mỏng manh, bình dân. Liệu dùng vài năm vít bản lề có bị lỏng và bung cánh ra không?"
- *Kịch bản xử lý chốt Sales cho nhân viên:*
  - *Bước 1 - Đồng cảm và ghi nhận:* "Dạ chị, em rất hiểu băn khoăn của chị. Gỗ MDF chống ẩm An Cường đúng là thương hiệu rất tốt và bề mặt gỗ công nghiệp phẳng đẹp sang trọng đã được khẳng định từ lâu ạ."
  - *Bước 2 - Phân tích cốt lõi giải pháp:* "Tuy nhiên, nhược điểm lớn nhất của gỗ công nghiệp vẫn là khả năng hút ẩm lâu ngày, nếu ở phòng ngủ khép kín nồm ẩm miền Bắc hay tầng trệt rất dễ bị mốc đen và trương nở mép dán chỉ. Đặc biệt, gỗ MDF chứa keo kết dính có phát thải Formaldehyde ảnh hưởng hô hấp của trẻ nhỏ. Tấm nhựa Ecoplast Đại Việt của bên em chống nước tuyệt đối 100%, không lo mối mọt hay ẩm mốc."
  - *Bước 3 - Giải tỏa nghi ngại về độ bền và bắt vít cánh:* "Về lo ngại xệ cánh tủ và lỏng vít của nhựa rỗng: Chị hoàn toàn yên tâm vì tại I-Nội-Thất, chúng em cắt tấm bằng máy CNC chuẩn xác và áp dụng quy chuẩn **đút thanh tăng cường bằng nhựa đặc/composite** vào sâu bên trong khoang rỗng tại tất cả các điểm bắt bản lề. Khi thợ bắn vít xoắn ren sâu, vít sẽ ngậm chặt vào phần lõi nhựa đặc này chứ không phải vào khoảng rỗng, bản lề sẽ chắc chắn tương đương gỗ thịt, đảm bảo cánh tủ đóng mở êm ái hàng chục năm không hề bị xệ hay bung vít!"

**TÌNH HUỐNG 2: KHÁCH HÀNG LO NGẠI GIƯỜNG NGỦ/ĐỢT TỦ BỊ VÕNG KHI ĐỂ ĐỒ NẶNG**
- *Khách hàng hỏi:* "Tủ nhựa Ecoplast là nhựa rỗng, nếu anh xếp nhiều chăn màn nặng lên đợt tủ ngang hoặc hai vợ chồng và con cùng nằm lên giường nhựa thì có sợ bị gãy hay võng cong trũng xuống không em?"
- *Kịch bản xử lý chốt Sales cho nhân viên:*
  - *Tư vấn:* "Dạ anh, về kết cấu chịu lực, nhựa Ecoplast có hệ gân tăng cứng dọc dày đặc bên trong tấm phôi. Đối với các đợt tủ ngang dài trên 70-80cm, bên em đều gia cố chèn thêm các thanh xương đỡ chịu lực chạy dọc bên dưới và thiết kế vách ngăn dọc chia lực đứng. Đối với giường ngủ, bên em sử dụng phôi tấm Ecoplast có độ dày tối đa lên đến **25mm - 30mm** chịu lực nén cực tốt. Dưới giàn vạt giường là hệ thống xương nâng đỡ chịu lực dạng ô bàn cờ đan dày với khoảng cách chỉ 30cm/nhịp, đảm bảo chịu tải tĩnh và động lên tới 500kg. Thậm chí xe tải cán qua phôi tấm Ecoplast cũng không bị nứt vỡ, nên gia đình mình hoàn toàn yên tâm ngủ ngon mà không lo ọp ẹp hay võng nứt ạ."

**TÌNH HUỐNG 3: SO SÁNH GIÁ VỚI NHỰA ĐÀI LOAN GIÁ RẺ TRÊN THỊ TRƯỜNG**
- *Khách hàng thắc mắc:* "Sao giá tủ nhựa Ecoplast bên em báo giá thi công cao gấp rưỡi, gấp đôi mấy cái tủ nhựa Đài Loan bán sẵn ngoài phố vậy?"
- *Kịch bản xử lý chốt Sales cho nhân viên:*
  - *Tư vấn:* "Dạ thưa anh/chị, nhựa Ecoplast và nhựa Đài Loan thông thường (như ChinHuei) có sự khác biệt rất lớn về đẳng cấp và độ bền kết cấu:
    1. *Độ dày phôi và trọng lượng:* Tấm nhựa Ecoplast của Đại Việt dày gấp 3 lần nhựa Đài Loan thông thường, trọng lượng phôi nặng gấp đôi, giúp tủ cầm đầm tay, chịu va đập tốt.
    2. *Kỹ thuật liên kết:* Tủ nhựa Đài Loan giá rẻ ngoài phố thường liên kết thô sơ bằng cách bắn ke góc sắt/ke nhựa lộ đầu vít sắt ra ngoài rất thô và dễ rỉ sét. Tủ Ecoplast tại I-Nội-Thất được phay mộng âm dương bằng máy CNC, giấu kín ốc vít liên kết vào bên trong mang lại thẩm mỹ vuông vắn như tủ gỗ cao cấp.
    3. *Độ bền bám vít:* Tủ giá rẻ ngoài phố bắt vít trực tiếp vào phần nhựa mỏng nên dùng 1-2 năm là lỏng lẻo bản lề. Bên em sử dụng thanh tăng cứng nhựa đặc đút trong khoang rỗng bám vít tuyệt đối. Đầu tư một chiếc tủ Ecoplast chất lượng dùng bền bỉ 20-30 năm sẽ tiết kiệm hơn rất nhiều so với tủ Đài Loan giá rẻ dùng vài năm đã hỏng ạ."`
  },
  {
    id: 11,
    title: "11. Cẩm nang đo đạc kỹ thuật tại công trình",
    order: 11,
    iconName: "Ruler",
    content: `Đo đạc hiện trạng là công đoạn sống còn quyết định sự thành bại của dự án nội thất. Sai một ly đi một dặm, chỉ cần sai lệch vài milimet có thể dẫn đến việc tủ không đút vừa hộc tường hoặc hở khe quá lớn gây mất thẩm mỹ.

**1. Quy tắc đo đạc 3 điểm chuẩn:**
- Đối với mọi ô hộc tủ âm tường hoặc hộc tường lắp tủ bếp, tủ quần áo, thợ kỹ thuật bắt buộc phải đo đủ 3 vị trí để kiểm tra độ nghiêng méo của tường và sàn:
  - **Chiều rộng (W):** Đo tại vị trí đáy (dưới), vị trí giữa, và vị trí sát trần (trên).
  - **Chiều cao (H):** Đo tại vị trí góc trái, vị trí giữa, và vị trí góc phải.
  - **Chiều sâu (D):** Đo kiểm tra độ sâu lòng tường ở 3 điểm để tránh tường xây lồi lõm làm lồi tủ ra ngoài.
- *Nguyên tắc sản xuất:* Luôn lấy **kích thước nhỏ nhất** thu thập được làm kích thước sản xuất chính, trừ đi dung sai lắp đặt phù hợp (thường từ 5mm - 15mm tùy thuộc vào độ nghiêng của tường thực tế) để khi lắp ráp tủ không bị kẹt.

**2. Kiểm tra độ nghiêng méo của tường (Out-of-plumb) và sàn dốc:**
- Sử dụng thước nivo laser hoặc thước dây rọi để quét kiểm tra độ nghiêng dọc của bức tường lắp tủ.
- Kiểm tra cao độ của sàn nhà xem có phẳng hay dốc. Với tủ bếp dưới, nếu sàn dốc cần thiết kế chân tủ bếp có thể tăng chỉnh độ cao để mặt đá bếp sau này thăng bằng tuyệt đối.
- Xác định góc vuông của 2 bức tường giao nhau (sử dụng ke vuông góc lớn hoặc kiểm tra theo quy tắc Pythagoras 3-4-5) để thiết kế góc tủ góc (L-shape/U-shape) chính xác.

**3. Khảo sát và đánh dấu các chướng ngại vật kỹ thuật:**
- **Ổ cắm & Công tắc điện:** Đo tọa độ tâm ổ cắm (khoảng cách từ sàn và từ mép tường gần nhất) để ghi chú cho bộ phận CNC khoét sẵn lỗ luồn dây trên hồi tủ hoặc mặt hậu.
- **Phào chỉ & Baseboard:** Đo chiều dày và chiều cao của phào chân tường, phào trần thạch cao. Thiết kế hồi tủ cần khoét giật cấp (nẹp chặn) để tủ áp khít sát vào tường.
- **Thiết bị hạ tầng:** Ghi nhận vị trí hộp kỹ thuật (hộp gen), đường ống thoát nước, đường cấp nước (đặc biệt quan trọng với tủ lavabo, tủ bếp để bố trí khoang tủ chậu rửa chính xác), vị trí ống thông khói máy hút mùi.

**4. Khảo sát hành lang và đường vận chuyển:**
- Đo kích thước chiều cao, chiều rộng của thang máy chung cư, chiếu nghỉ cầu thang bộ, và các ô cửa phòng ngủ.
- Nếu lắp đặt hệ tủ quần áo kịch trần lớn hoặc tủ dài, bắt buộc phải chia module nhỏ phù hợp để vận chuyển dễ dàng, tránh tình trạng sản xuất tủ nguyên khối lớn không thể đưa lên phòng khách hàng.`
  }
];

const initializeLessonsIfEmpty = async () => {
  const q = query(collection(db, 'ecoplast_lessons'), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("Seeding default Ecoplast lessons to Firestore...");
    for (const lesson of DEFAULT_LESSONS) {
      const validated = lessonSchema.parse(lesson);
      await setDoc(doc(db, 'ecoplast_lessons', `lesson_${validated.id}`), validated);
    }
  }
};

interface Question {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  category: 'kĩ-thuật-chế-tác' | 'ưu-thế-vật-liệu' | 'kĩ-năng-chốt-sales' | 'đo-đạc-khảo-sát';
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
      explanation: "Nhựa Ecoplast được sản xuất từ bột nhựa PVC nguyên sinh cao cấp, bột đá CaCO3 siêu mịn và phụ gia để tăng độ đàn hồi, chịu lực.",
      category: "ưu-thế-vật-liệu"
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
      explanation: "Độ dày 15mm là tiêu chuẩn tối ưu giúp cánh tủ bền nhẹ, chống xệ bản lề; trong khi khung và vách thùng tủ sử dụng độ dày 20mm để đảm bảo kết cấu cứng vững.",
      category: "kĩ-thuật-chế-tác"
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
      explanation: "Quy cách chuẩn cho khung thùng, vách ngăn đứng và các vách chịu lực của tủ nhựa Ecoplast là độ dày 20mm để đảm bảo độ cứng vững.",
      category: "kĩ-thuật-chế-tác"
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
      explanation: "Ưu điểm cốt lõi của Ecoplast là khả năng chống nước hoàn hảo 100% và không bị mối mọt tấn công, điều mà gỗ MDF không làm được.",
      category: "ưu-thế-vật-liệu"
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
      explanation: "Phương pháp gia cố nhét thanh tăng cường bằng nhựa đặc chuyên dụng vào khoang rỗng giúp vít bám cực kỳ chắc chắn, đồng nhất chất liệu nhựa và không lo ẩm mốc.",
      category: "kĩ-thuật-chế-tác"
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
      explanation: "An Cường là thương hiệu số 1 Việt Nam về gỗ công nghiệp với hơn 30 năm hình thành và phát triển (thành lập từ năm 1994).",
      category: "ưu-thế-vật-liệu"
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
      explanation: "Ecoplast của công ty Nhựa Đại Việt là thương hiệu dẫn đầu ngành nhựa rỗng cao cấp, hình thành từ năm 2015 với hơn 9 năm phát triển.",
      category: "ưu-thế-vật-liệu"
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
      explanation: "Ecoplast có tính tự tắt lửa, hạn chế đám cháy lây lan rộng, đáp ứng tiêu chuẩn an toàn phòng cháy chữa cháy nội thất.",
      category: "ưu-thế-vật-liệu"
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
      explanation: "Xăng thơm và Axeton sẽ tẩy bay lớp vân phủ bóng PVC, làm bạc màu loang lổ bề mặt nhựa.",
      category: "kĩ-thuật-chế-tác"
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
      explanation: "Chứng minh độ bền cơ học thực tế của tấm xương tăng cứng và công nghệ gia cố thanh tăng cường bằng nhựa đặc chuyên dụng là cách thuyết phục trực quan nhất.",
      category: "kĩ-năng-chốt-sales"
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
      explanation: "Kích thước tiêu chuẩn giúp tối ưu hóa gia công chiều cao tủ quần áo và kệ là 2.2m và 2.4m.",
      category: "kĩ-thuật-chế-tác"
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
      explanation: "Được kiểm định chất lượng an toàn, không chứa chì (Lead-free) và không phát thải formaldehyde gây hại hô hấp, an toàn tuyệt đối cho trẻ nhỏ.",
      category: "ưu-thế-vật-liệu"
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
      explanation: "Khoảng cách an toàn chịu lực của tấm đợt ngang là dưới 80cm, vượt quá độ dài này cần thiết kế thêm vách đỡ dọc hoặc thanh tăng cường bằng nhựa chịu lực.",
      category: 'kĩ-thuật-chế-tác' as const
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
      explanation: "Khả năng chống ẩm tuyệt hảo của polyme nguyên sinh giúp bảo vệ tủ hoàn toàn khỏi nấm mốc kể cả khi trời nồm ẩm hay thấm dột nước.",
      category: 'ưu-thế-vật-liệu' as const
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
      explanation: "Tấm nhựa Ecoplast có độ bền vật liệu cực kỳ cao, kết cấu gia công lắp ráp tiêu chuẩn của I-Nội-Thất bảo đảm tuổi thọ sản phẩm bền bỉ 20-30 năm.",
      category: 'kĩ-năng-chốt-sales' as const
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
      explanation: "Độ bền chắc của vít phụ thuộc vào việc vít được bắt vào phần thịt nhựa (xương gân dọc) hoặc phần thanh tăng cường bằng nhựa đặc nhét bên trong ô rỗng.",
      category: 'kĩ-thuật-chế-tác' as const
    }),
    (cat: string, p: { value: number; unit: string }) => ({
      question: `Khi đo đạc khảo sát cho hạng mục ${cat} sát góc tường, tại sao thợ kỹ thuật phải đo đủ 3 điểm (dưới, giữa, trên) thay vì chỉ đo 1 điểm duy nhất?`,
      options: [
        "Để phát hiện độ nghiêng méo của tường và chọn kích thước nhỏ nhất trừ đi dung sai lắp đặt phù hợp.",
        "Để kiểm tra màu sắc sơn tường xem có phẳng hay không.",
        "Để tính xem cần mua bao nhiêu cuộn keo dán viền.",
        "Để chứng minh với khách hàng là mình làm việc cẩn thận nhằm lấy lòng tin."
      ],
      answer: 0,
      explanation: "Tường xây thực tế tại Việt Nam thường có độ nghiêng méo (out-of-plumb). Đo 3 điểm và lấy trị số nhỏ nhất là nguyên tắc sống còn để tủ lắp ráp đút vừa hộc tường.",
      category: 'đo-đạc-khảo-sát' as const
    }),
    (cat: string, p: { value: number; unit: string }) => ({
      question: `Khi thi công tủ bếp hoặc ${cat} sát nền nhà dốc, kỹ thuật viên I-Nội-thất xử lý phần chân tủ như thế nào để thăng bằng tuyệt đối?`,
      options: [
        "Sử dụng chân tủ có thể tăng chỉnh độ cao chuyên dụng để cân bằng bề mặt.",
        "Kê tạm bằng các mẩu gỗ thừa nhặt tại công trình.",
        "Bỏ qua vì độ dốc sàn nhà không ảnh hưởng đến thẩm mỹ.",
        "Bào bớt chân nhựa trực tiếp bằng dao rọc giấy."
      ],
      answer: 0,
      explanation: "Chân tăng chỉnh độ cao giúp thợ dễ dàng căn chỉnh mặt tủ thăng bằng tuyệt đối kể cả trên các bề mặt sàn nhà bị dốc nhẹ, đảm bảo thẩm mỹ và an toàn.",
      category: 'đo-đạc-khảo-sát' as const
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

const getLessonCategory = (lessonId: number): 'ưu-thế-vật-liệu' | 'kĩ-thuật-chế-tác' | 'đo-đạc-khảo-sát' | 'kĩ-năng-chốt-sales' => {
  if (lessonId <= 3) return 'ưu-thế-vật-liệu';
  if (lessonId <= 7) return 'kĩ-thuật-chế-tác';
  if (lessonId <= 9) return 'đo-đạc-khảo-sát';
  return 'kĩ-năng-chốt-sales';
};

const ROADMAP_PHASES = [
  {
    id: 'ưu-thế-vật-liệu',
    title: 'Giai đoạn 1: Ưu thế vật liệu',
    description: 'Nắm vững cấu trúc xương nhựa rỗng, khả năng chống nước, chống cháy lan và độ an toàn chì/formaldehyde.',
    lessonsRange: 'Bài 1 - 3',
    color: 'emerald',
    iconName: 'Droplet'
  },
  {
    id: 'kĩ-thuật-chế-tác',
    title: 'Giai đoạn 2: Kỹ thuật chế tác',
    description: 'Học về độ dày phôi (15mm, 20mm), khoảng cách đợt chịu lực ngang tối đa, và chốt gỗ/nhựa gia cố chống bung tuột bản lề.',
    lessonsRange: 'Bài 4 - 7',
    color: 'blue',
    iconName: 'Layers'
  },
  {
    id: 'đo-đạc-khảo-sát',
    title: 'Giai đoạn 3: Đo đạc khảo sát',
    description: 'Quy tắc đo 3 điểm, kiểm tra độ nghiêng méo của tường và sàn dốc, đánh dấu ổ điện và lập hồ sơ hiện trạng.',
    lessonsRange: 'Bài 8 - 9',
    color: 'orange',
    iconName: 'Ruler'
  },
  {
    id: 'kĩ-năng-chốt-sales',
    title: 'Giai đoạn 4: Kỹ năng chốt Sales',
    description: 'Xử lý phản đối về giá nhựa rẻ tiền, chứng minh độ bền phôi xương dày dặn và kịch bản chốt đơn tối ưu.',
    lessonsRange: 'Bài 10 - 11',
    color: 'indigo',
    iconName: 'Award'
  }
];

const SWATCH_COLORS = [
  { code: 'AT', name: 'Vân gỗ Teak cổ điển', type: 'UV Standard', style: 'bg-[#9c6644]' },
  { code: 'AV', name: 'Vân gỗ Vàng nhạt', type: 'UV Standard', style: 'bg-[#e9c46a]' },
  { code: 'A2', name: 'Vân gỗ Sồi nhạt Bắc Âu', type: 'UV Standard', style: 'bg-[#ddb892]' },
  { code: 'A7', name: 'Vân gỗ Đỏ / Xoan đào', type: 'UV Standard', style: 'bg-[#8b5a2b]' },
  
  { code: 'A9', name: 'Sồi trắng Thụy Điển', type: 'Premium Film', style: 'bg-[#f4ebe1] border border-zinc-200 text-zinc-900' },
  { code: 'A10', name: 'Sồi nâu tự nhiên', type: 'Premium Film', style: 'bg-[#a38063]' },
  { code: 'A11', name: 'Gỗ Óc chó đậm châu Âu', type: 'Premium Film', style: 'bg-[#5c4033]' },
  { code: 'A12', name: 'Gỗ Đỏ hoàng gia', type: 'Premium Film', style: 'bg-[#70291d]' },
  { code: 'Lux 01', name: 'Sồi xám phong trần', type: 'Luxury Film', style: 'bg-[#8f8f8f]' },
  { code: 'Lux 02', name: 'Óc chó vương giả', type: 'Luxury Film', style: 'bg-[#4a3728]' },
  { code: 'Lux 04', name: 'Gỗ tếch nhiệt đới', type: 'Luxury Film', style: 'bg-[#b07d62]' },
  { code: 'Lux 06', name: 'Mun sọc huyền bí', type: 'Luxury Film', style: 'bg-[#2b2b2b]' },
  { code: 'Lux 24', name: 'Vân vải xám Linen', type: 'Luxury Film', style: 'bg-[#d3d3d3] text-zinc-800' },
  
  { code: 'S6', name: 'Nhũ bạc ánh sao', type: 'Galaxy Stars', style: 'bg-gradient-to-r from-slate-300 via-zinc-100 to-slate-300 border border-slate-200 text-slate-800' },
  { code: 'S8', name: 'Đen vũ trụ hạt kim sa', type: 'Galaxy Stars', style: 'bg-[#121212] text-zinc-300' },
  { code: 'A8 Galaxy', name: 'Trắng nhũ ngọc trai', type: 'Galaxy Stars', style: 'bg-gradient-to-r from-zinc-50 via-slate-100 to-zinc-50 border border-zinc-200 text-zinc-700' },

  { code: 'E1', name: 'Sồi sa mạc', type: 'Eco+ (Eco Plus)', style: 'bg-[#d7ba8d]' },
  { code: 'E2', name: 'Gỗ óc chó sần Bắc Mỹ', type: 'Eco+ (Eco Plus)', style: 'bg-[#58412f]' },
  { code: 'E3', name: 'Xám xi măng lỳ', type: 'Eco+ (Eco Plus)', style: 'bg-[#808588]' },
  { code: 'E4', name: 'Trắng sữa bóng Acrylic', type: 'Eco+ (Eco Plus)', style: 'bg-white border border-zinc-200 text-zinc-800' },
  { code: 'E5', name: 'Xanh mint pastel matte', type: 'Eco+ (Eco Plus)', style: 'bg-[#b6d7a8] text-zinc-800' },
  { code: 'E6', name: 'Hồng đất ấm pastel', type: 'Eco+ (Eco Plus)', style: 'bg-[#e0b0ff] text-zinc-800' }
];

interface LessonStudyTrackerProps {
  lessonId: number;
  lessonTitle: string;
  onProgressUpdated: () => void;
}

function LessonStudyTracker({ lessonId, lessonTitle, onProgressUpdated }: LessonStudyTrackerProps) {
  const { user, userProfile } = useAuth();
  const REQUIRED_STUDY_TIME = 120; // 120 seconds = 2 minutes
  
  const [seconds, setSeconds] = React.useState(0);
  const [isTabVisible, setIsTabVisible] = React.useState(true);
  const [isWindowFocused, setIsWindowFocused] = React.useState(true);
  const [isIdle, setIsIdle] = React.useState(false);
  const [isAutoClickerDetected, setIsAutoClickerDetected] = React.useState(false);
  const [lastInteraction, setLastInteraction] = React.useState(Date.now());
  const [isSaving, setIsSaving] = React.useState(false);

  // Load initial progress
  React.useEffect(() => {
    let initialSeconds = 0;
    
    // Always check localStorage first
    const stored = localStorage.getItem(`ecoplast_study_progress_${lessonId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        initialSeconds = parsed.studyTime || 0;
      } catch (e) {}
    }
    setSeconds(initialSeconds);

    if (user) {
      // Fetch from Firestore in background
      const getProgress = async () => {
        try {
          const q = query(
            collection(db, 'ecoplast_user_progress'), 
            where('userId', '==', user.uid), 
            where('lessonId', '==', lessonId)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            const dbSeconds = data.studyTime || 0;
            if (dbSeconds > initialSeconds) {
              setSeconds(dbSeconds);
            }
          }
        } catch (e) {
          console.warn("Firestore progress load failed, using local storage: ", e);
        }
      };
      getProgress();
    }
  }, [lessonId, user]);

  // Anti-cheat Event Handlers
  React.useEffect(() => {
    const handleActivity = (e: Event) => {
      // Check if event is trusted
      if (e.isTrusted === false) {
        setIsAutoClickerDetected(true);
        return;
      }
      setLastInteraction(Date.now());
      setIsIdle(false);
    };

    const handleVisibility = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };

    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const saveProgress = async (timeToSave: number) => {
    setIsSaving(true);
    try {
      const isCompleted = timeToSave >= REQUIRED_STUDY_TIME;
      const progressData = {
        userId: user ? user.uid : 'mock_user',
        userEmail: user ? (user.email || "") : 'guest@example.com',
        userName: userProfile?.name || user?.email || "Khách hàng thử nghiệm",
        lessonId,
        lessonTitle,
        studyTime: timeToSave,
        isCompleted,
        updatedAt: new Date().toISOString()
      };

      // Zod validation
      userProgressSchema.parse(progressData);

      // Always cache to localStorage
      localStorage.setItem(`ecoplast_study_progress_${lessonId}`, JSON.stringify(progressData));

      if (user) {
        try {
          await setDoc(doc(db, 'ecoplast_user_progress', `${user.uid}_${lessonId}`), progressData);
        } catch (dbError) {
          console.warn("Firestore save failed, progress was successfully saved locally:", dbError);
        }
      }
      onProgressUpdated();
    } catch (e) {
      console.error("Error saving progress:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Timer Tick and Inactivity Check
  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Idle check: 20 seconds of no interactions
      if (now - lastInteraction > 20000) {
        setIsIdle(true);
      } else {
        setIsIdle(false);
      }

      // Check current visibility and focus states
      const tabVisible = document.visibilityState === 'visible';
      const windowFocused = document.hasFocus();
      setIsTabVisible(tabVisible);
      setIsWindowFocused(windowFocused);

      // Accumulate time if active
      if (tabVisible && windowFocused && !(now - lastInteraction > 20000) && !isAutoClickerDetected && seconds < REQUIRED_STUDY_TIME) {
        setSeconds(prev => {
          const next = prev + 1;
          // Auto save every 10 seconds or when completed
          if (next % 10 === 0 || next >= REQUIRED_STUDY_TIME) {
            saveProgress(next);
          }
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [seconds, lastInteraction, isAutoClickerDetected, lessonId, user, userProfile]);

  const isCompleted = seconds >= REQUIRED_STUDY_TIME;
  const progressPercent = Math.min(100, Math.round((seconds / REQUIRED_STUDY_TIME) * 100));

  // Determine active/warning states
  const isActive = isTabVisible && isWindowFocused && !isIdle && !isAutoClickerDetected && !isCompleted;

  return (
    <div className={cn(
      "p-4 rounded-2xl border transition-all duration-300 shadow-xs mb-6",
      isCompleted 
        ? "bg-emerald-50/30 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200"
        : isAutoClickerDetected
        ? "bg-rose-50 border-rose-200 text-rose-900 animate-pulse dark:bg-rose-950/20 dark:border-rose-900/30"
        : !isActive
        ? "bg-amber-50/50 border-amber-200 text-amber-900 dark:bg-amber-950/15 dark:border-amber-900/30 dark:text-amber-200"
        : "bg-blue-50/30 border-blue-200 text-blue-900 dark:bg-blue-950/10 dark:border-blue-900/30 dark:text-blue-200"
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : isAutoClickerDetected ? (
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 animate-bounce" />
            ) : !isActive ? (
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
            )}
            <span className="font-extrabold text-sm tracking-tight">
              {isCompleted 
                ? "Đã đạt đủ thời gian học tối thiểu!" 
                : isAutoClickerDetected 
                ? "Cảnh báo phát hiện gian lận tự động!" 
                : !isActive 
                ? "Đã tạm dừng đếm giờ học" 
                : "Hệ thống đang tích lũy thời gian học..."}
            </span>
            {isSaving && <span className="text-[10px] text-muted-foreground animate-pulse font-medium">(Đang lưu...)</span>}
          </div>
          <p className="text-xs text-muted-foreground leading-normal">
            {isCompleted 
              ? "Tuyệt vời! Bạn đã hoàn thành 2 phút đọc tài liệu. Hệ thống đã lưu trữ tiến độ học của bạn."
              : isAutoClickerDetected 
              ? "Phát hiện sự kiện mô phỏng từ phần mềm hoặc tool tự động (untrusted event). Trình ghi nhận thời gian đã bị khóa."
              : !isTabVisible 
              ? "⚠️ Tạm dừng đếm giờ do bạn đã chuyển sang tab khác. Hãy quay lại trang để tiếp tục."
              : !isWindowFocused 
              ? "⚠️ Tạm dừng đếm giờ do mất tiêu điểm màn hình. Hãy nhấp chuột vào nội dung bài học."
              : isIdle 
              ? "⚠️ Bạn đang treo máy? Tạm dừng tính giờ do không tương tác (quá 20s). Hãy cuộn hoặc di chuyển chuột."
              : "Vui lòng giữ tiêu điểm và đọc kỹ tài liệu. Thời gian yêu cầu tối thiểu: 2 phút."}
          </p>
        </div>
        
        <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
          <div className="text-right">
            <div className="text-sm font-black font-mono">
              {Math.floor(seconds / 60)}m {seconds % 60}s / 2m 00s
            </div>
            <div className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5">
              Tiến độ: {progressPercent}%
            </div>
          </div>
          
          <div className="w-14 h-14 relative flex items-center justify-center shrink-0">
            {/* Circular Progress Ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle 
                cx="28" cy="28" r="24" 
                className="stroke-muted fill-none" 
                strokeWidth="3.5" 
              />
              <circle 
                cx="28" cy="28" r="24" 
                className={cn(
                  "fill-none transition-all duration-300",
                  isCompleted 
                    ? "stroke-emerald-500" 
                    : isAutoClickerDetected
                    ? "stroke-rose-500"
                    : !isActive
                    ? "stroke-amber-500"
                    : "stroke-blue-600"
                )}
                strokeWidth="3.5" 
                strokeDasharray={2 * Math.PI * 24}
                strokeDashoffset={2 * Math.PI * 24 * (1 - progressPercent / 100)}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[11px] font-black font-mono">
              {progressPercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BeautifulLessonRendererProps {
  content: string;
  lessonId: number;
}

function BeautifulLessonRenderer({ content, lessonId }: BeautifulLessonRendererProps) {
  if (!content) return null;

  const parseContent = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentBlock: { type: 'situation' | 'none'; title: string; lines: string[] } = { type: 'none', title: '', lines: [] };

    const flushBlock = (key: number) => {
      if (currentBlock.type === 'situation') {
        elements.push(
          <div key={`block-${key}`} className="my-6 border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-amber-100/80 dark:bg-amber-950/50 px-4 py-3 border-b border-amber-200 dark:border-amber-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="font-bold text-amber-900 dark:text-amber-100 text-sm md:text-base">
                {currentBlock.title.replace(/\*\*|:/g, '')}
              </span>
            </div>
            <div className="p-4 space-y-3">
              {currentBlock.lines.map((line, idx) => renderLine(line, `sub-${key}-${idx}`))}
            </div>
          </div>
        );
      } else {
        currentBlock.lines.forEach((line, idx) => {
          const rendered = renderLine(line, `line-${key}-${idx}`);
          if (rendered) elements.push(rendered);
        });
      }
      currentBlock = { type: 'none', title: '', lines: [] };
    };

    const renderLine = (line: string, key: string) => {
      const trimmed = line.trim();
      if (!trimmed) return null;

      // 1. Step/Dialogue items inside situation: - *Bước 1...* or - *Tư vấn:* or - *Khách hàng hỏi:*
      if (trimmed.startsWith('- *Bước') || trimmed.startsWith('- **Bước') || trimmed.startsWith('- *Tư vấn:') || trimmed.startsWith('- *Khách hàng') || trimmed.startsWith('- *Kịch bản') || trimmed.startsWith('**Bước')) {
        const isClient = trimmed.includes('Khách hàng');
        
        let displayContent = trimmed;
        // Strip leading symbols
        if (displayContent.startsWith('- ')) displayContent = displayContent.substring(2);
        if (displayContent.startsWith('  - ')) displayContent = displayContent.substring(4);
        
        // Parse bold prefix
        const boldMatch = displayContent.match(/^\*(.*?):\*(.*)/) || displayContent.match(/^\*\*(.*?):\*\*(.*)/) || displayContent.match(/^\*(.*?)\*(.*)/);
        let prefix = "";
        let body = displayContent;
        if (boldMatch) {
          prefix = boldMatch[1];
          body = boldMatch[2] || boldMatch[3] || "";
        }

        return (
          <div key={key} className={cn(
            "flex gap-3 items-start p-3 rounded-lg text-sm border my-2 transition-all hover:shadow-xs",
            isClient 
              ? "bg-rose-50/40 dark:bg-rose-950/10 border-rose-100/50 dark:border-rose-950/20 text-rose-950 dark:text-rose-200" 
              : "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-100/50 dark:border-emerald-950/20 text-emerald-950 dark:text-emerald-200"
          )}>
            <div className={cn(
              "p-1.5 rounded-md shrink-0",
              isClient ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400" : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
            )}>
              {isClient ? <User className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            </div>
            <div className="flex-1">
              {prefix && (
                <span className="font-bold text-xs uppercase tracking-wider block mb-1 opacity-90">
                  {prefix.replace(/:/g, '')}
                </span>
              )}
              <span className="text-muted-foreground leading-relaxed whitespace-pre-line">{body.trim()}</span>
            </div>
          </div>
        );
      }

      // 2. Section/Item Title: **1. ...** or **Thành phần...**
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        const cleanTitle = trimmed.replace(/\*\*/g, '');
        return (
          <h4 key={key} className="text-base font-bold text-foreground mt-6 mb-3 flex items-center gap-2 border-b border-border/40 pb-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
            {cleanTitle}
          </h4>
        );
      }

      // 3. Bullet point with custom badge: - *Ưu điểm:* or - *Nhược điểm:* or - *Hạn chế:* or - *Đặc điểm:*
      if (trimmed.startsWith('- *') || trimmed.startsWith('- **') || trimmed.startsWith('*')) {
        let cleanText = trimmed;
        if (cleanText.startsWith('- ')) cleanText = cleanText.substring(2);
        
        const labelMatch = cleanText.match(/^\*(.*?):\*(.*)/) || cleanText.match(/^\*\*(.*?):\*\*(.*)/);
        
        if (labelMatch) {
          const label = labelMatch[1].trim();
          const desc = labelMatch[2].trim();
          
          let icon = <Check className="h-3.5 w-3.5" />;
          let theme = "bg-sky-50/30 dark:bg-sky-950/15 text-sky-950 dark:text-sky-200 border-sky-100/50 dark:border-sky-900/30";
          let badgeTheme = "bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300";

          if (label.toLowerCase().includes("ưu điểm")) {
            icon = <Check className="h-3.5 w-3.5" />;
            theme = "bg-emerald-50/40 dark:bg-emerald-950/10 text-emerald-950 dark:text-emerald-200 border-emerald-100/50 dark:border-emerald-900/30";
            badgeTheme = "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300";
          } else if (label.toLowerCase().includes("nhược điểm") || label.toLowerCase().includes("hạn chế")) {
            icon = <X className="h-3.5 w-3.5" />;
            theme = "bg-rose-50/40 dark:bg-rose-950/10 text-rose-950 dark:text-rose-200 border-rose-100/50 dark:border-rose-900/30";
            badgeTheme = "bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300";
          } else if (label.toLowerCase().includes("lưu ý") || label.toLowerCase().includes("nguyên tắc") || label.toLowerCase().includes("hạn chế")) {
            icon = <AlertCircle className="h-3.5 w-3.5" />;
            theme = "bg-amber-50/40 dark:bg-amber-950/10 text-amber-950 dark:text-amber-200 border-amber-100/50 dark:border-amber-900/30";
            badgeTheme = "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300";
          } else if (label.toLowerCase().includes("đặc điểm") || label.toLowerCase().includes("công nghệ")) {
            icon = <Info className="h-3.5 w-3.5" />;
            theme = "bg-blue-50/40 dark:bg-blue-950/10 text-blue-950 dark:text-blue-200 border-blue-100/50 dark:border-blue-900/30";
            badgeTheme = "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300";
          }

          return (
            <div key={key} className={cn("flex gap-3 items-start p-3 my-2 border rounded-xl transition-all", theme)}>
              <span className={cn("flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 shadow-xs border border-current/10 uppercase tracking-wider", badgeTheme)}>
                {icon}
                {label}
              </span>
              <span className="text-muted-foreground leading-relaxed text-sm">{desc}</span>
            </div>
          );
        }

        // Standard bullet with bold text
        const boldTextMatch = cleanText.match(/^\*\*(.*?)\*\*(.*)/);
        if (boldTextMatch) {
          return (
            <div key={key} className="flex gap-2.5 items-start my-2.5 text-sm leading-relaxed">
              <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-2" />
              <span>
                <strong className="text-foreground font-semibold mr-1">{boldTextMatch[1]}</strong>
                <span className="text-muted-foreground">{boldTextMatch[2]}</span>
              </span>
            </div>
          );
        }

        return (
          <div key={key} className="flex gap-2.5 items-start my-2.5 text-sm text-muted-foreground leading-relaxed">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 shrink-0 mt-2" />
            <span>{cleanText}</span>
          </div>
        );
      }

      // 3. Section/Item Title: **1. ...** or **Thành phần...**
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        const cleanTitle = trimmed.replace(/\*\*/g, '');
        return (
          <h4 key={key} className="text-base font-bold text-foreground mt-6 mb-3 flex items-center gap-2 border-b border-border/40 pb-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
            {cleanTitle}
          </h4>
        );
      }

      // 4. Default Text Paragraph
      return (
        <p key={key} className="text-muted-foreground text-sm leading-relaxed my-3 whitespace-pre-line">
          {trimmed.replace(/\*\*/g, '')}
        </p>
      );
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('**TÌNH HUỐNG')) {
        flushBlock(i);
        currentBlock = { type: 'situation', title: trimmed, lines: [] };
      } else if (currentBlock.type === 'situation') {
        if (trimmed.startsWith('**1.') || trimmed.startsWith('**2.') || trimmed.startsWith('**3.') || trimmed.startsWith('**4.') || trimmed.startsWith('**5.') || trimmed.startsWith('**6.') || trimmed.startsWith('**7.') || trimmed.startsWith('**8.') || trimmed.startsWith('**9.') || trimmed.startsWith('**10.') || trimmed.startsWith('**11.')) {
          // If we encounter a new main lesson topic, flush
          flushBlock(i);
          currentBlock.lines.push(line);
        } else {
          currentBlock.lines.push(line);
        }
      } else {
        currentBlock.lines.push(line);
      }
    }
    flushBlock(lines.length);

    return elements;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">{parseContent(content)}</div>
      
      {lessonId === 8 && (
        <div className="mt-8 border border-border/60 rounded-2xl p-6 bg-slate-50/50 dark:bg-zinc-950/20">
          <h4 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Bảng Tra Cứu Mã Màu Ecoplast Thực Tế
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {SWATCH_COLORS.map((swatch, idx) => (
              <div 
                key={idx} 
                className="group relative rounded-xl border border-border bg-white dark:bg-zinc-900 p-2 shadow-xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 flex flex-col gap-2"
              >
                <div className={cn("w-full h-16 rounded-lg font-bold flex items-center justify-center text-sm shadow-xs text-white", swatch.style)}>
                  <span className="px-2 py-1 rounded bg-black/30 backdrop-blur-xs font-mono tracking-wider">
                    {swatch.code}
                  </span>
                </div>
                <div className="px-1">
                  <div className="font-bold text-xs truncate text-foreground group-hover:text-blue-600 transition-colors">
                    {swatch.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {swatch.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function EcoplastLearningPage() {
  const queryClient = useQueryClient();
  const { user, userProfile, isAdmin } = useAuth();
  const isManager = isAdmin || (userProfile?.role?.toLowerCase().includes('quản lý') || userProfile?.role?.toLowerCase().includes('manager'));
  
  // Load progress list for current user
  const { data: userProgressList = [], refetch: refetchUserProgress } = useQuery<UserProgressType[]>({
    queryKey: ['ecoplast_user_progress', user?.uid],
    queryFn: async () => {
      if (!user) {
        // Load mock progress from localStorage
        const list: UserProgressType[] = [];
        for (let i = 1; i <= 20; i++) {
          const stored = localStorage.getItem(`ecoplast_study_progress_${i}`);
          if (stored) {
            try {
              list.push(JSON.parse(stored));
            } catch (e) {}
          }
        }
        return list;
      }
      const q = query(
        collection(db, 'ecoplast_user_progress'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => doc.data() as UserProgressType);
    }
  });

  // Load all progress reports (Admins and Managers only)
  const { data: allProgressList = [], isLoading: isLoadingAllProgress, refetch: refetchAllProgress } = useQuery<UserProgressType[]>({
    queryKey: ['all_ecoplast_progress'],
    queryFn: async () => {
      const q = collection(db, 'ecoplast_user_progress');
      const snap = await getDocs(q);
      return snap.docs.map(doc => {
        try {
          return userProgressSchema.parse(doc.data());
        } catch (e) {
          console.error("Invalid progress doc:", doc.id, e);
          return null;
        }
      }).filter(Boolean) as UserProgressType[];
    },
    enabled: !!(isAdmin || isManager)
  });

  const progressMap = React.useMemo(() => new Map(userProgressList.map(p => [p.lessonId, p])), [userProgressList]);

  const salesProgressReport = React.useMemo(() => {
    const userGroups: Record<string, {
      userId: string;
      userName: string;
      userEmail: string;
      lessons: Record<number, { studyTime: number; isCompleted: boolean; updatedAt: string }>;
      totalStudyTime: number;
      completedCount: number;
    }> = {};

    allProgressList.forEach(item => {
      if (!userGroups[item.userId]) {
        userGroups[item.userId] = {
          userId: item.userId,
          userName: item.userName || item.userEmail || "Nhân viên",
          userEmail: item.userEmail || "",
          lessons: {},
          totalStudyTime: 0,
          completedCount: 0
        };
      }
      
      userGroups[item.userId].lessons[item.lessonId] = {
        studyTime: item.studyTime,
        isCompleted: item.isCompleted,
        updatedAt: item.updatedAt
      };
      
      userGroups[item.userId].totalStudyTime += item.studyTime;
      if (item.isCompleted) {
        userGroups[item.userId].completedCount += 1;
      }
    });

    return Object.values(userGroups);
  }, [allProgressList]);

  const [activeTab, setActiveTab] = React.useState<string>('theory');
  const [expandedLesson, setExpandedLesson] = React.useState<number | null>(1);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingLesson, setEditingLesson] = React.useState<LessonType | null>(null);

  // Form fields for Dialog
  const [titleField, setTitleField] = React.useState('');
  const [contentField, setContentField] = React.useState('');
  const [orderField, setOrderField] = React.useState<number>(0);
  const [iconNameField, setIconNameField] = React.useState('BookOpen');
  const [imageUrlField, setImageUrlField] = React.useState('');
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = React.useState<string>('all');
  const [selectedQuizCategory, setSelectedQuizCategory] = React.useState<string>('all');
  
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

  // TanStack Query to fetch lessons dynamically from Firestore
  const { data: lessons = [], isLoading } = useQuery<LessonType[]>({
    queryKey: ['ecoplast_lessons'],
    queryFn: async () => {
      await initializeLessonsIfEmpty();
      const q = query(collection(db, 'ecoplast_lessons'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => {
        const data = doc.data();
        try {
          return lessonSchema.parse({
            id: data.id || parseInt(doc.id.replace('lesson_', '')) || 0,
            title: data.title || 'Untitled',
            content: data.content || '',
            order: data.order ?? 999,
            iconName: data.iconName || 'BookOpen',
            imageUrl: data.imageUrl || ''
          });
        } catch (err) {
          console.error(`Error parsing lesson ${doc.id}:`, err);
          return null;
        }
      }).filter(Boolean) as LessonType[];
    }
  });

  const filteredLessons = React.useMemo(() => {
    return lessons.filter(l => selectedPhaseId === 'all' || getLessonCategory(l.id) === selectedPhaseId);
  }, [lessons, selectedPhaseId]);

  // Mutation to Add/Update Lesson
  const upsertLessonMutation = useMutation({
    mutationFn: async (lesson: LessonType) => {
      const validated = lessonSchema.parse(lesson);
      const docRef = doc(db, 'ecoplast_lessons', `lesson_${validated.id}`);
      await setDoc(docRef, validated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecoplast_lessons'] });
      toast.success("Đã lưu bài học thành công!");
      setIsDialogOpen(false);
      setEditingLesson(null);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(`Lỗi khi lưu bài học: ${err.message}`);
    }
  });

  // Mutation to Delete Lesson
  const deleteLessonMutation = useMutation({
    mutationFn: async (id: number) => {
      await deleteDoc(doc(db, 'ecoplast_lessons', `lesson_${id}`));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecoplast_lessons'] });
      toast.success("Đã xóa bài học thành công!");
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(`Lỗi khi xóa bài học: ${err.message}`);
    }
  });

  const handleOpenAddDialog = () => {
    setEditingLesson(null);
    const maxId = lessons.reduce((max, l) => l.id > max ? l.id : max, 0);
    const maxOrder = lessons.reduce((max, l) => l.order > max ? l.order : max, 0);
    setTitleField('');
    setContentField('');
    setOrderField(maxOrder + 1);
    setIconNameField('BookOpen');
    setImageUrlField('');
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (lesson: LessonType) => {
    setEditingLesson(lesson);
    setTitleField(lesson.title);
    setContentField(lesson.content);
    setOrderField(lesson.order);
    setIconNameField(lesson.iconName);
    setImageUrlField(lesson.imageUrl || '');
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const storageRef = ref(storage, `ecoplast_lessons/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setImageUrlField(url);
      toast.success("Tải ảnh lên thành công!");
    } catch (err: any) {
      console.error(err);
      toast.error(`Lỗi khi tải ảnh lên: ${err.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = () => {
    try {
      const id = editingLesson ? editingLesson.id : (lessons.reduce((max, l) => l.id > max ? l.id : max, 0) + 1);
      const newLesson: LessonType = {
        id,
        title: titleField.trim(),
        content: contentField.trim(),
        order: Number(orderField),
        iconName: iconNameField,
        imageUrl: imageUrlField
      };
      
      // Zod validation
      lessonSchema.parse(newLesson);
      upsertLessonMutation.mutate(newLesson);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error(err.message || "Lỗi dữ liệu nhập vào");
      }
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Bạn có chắc chắn muốn xóa bài học này?")) {
      deleteLessonMutation.mutate(id);
    }
  };

  const handleStartQuiz = () => {
    let allQuestions = generateQuestionBank();
    
    if (selectedQuizCategory && selectedQuizCategory !== 'all') {
      allQuestions = allQuestions.filter(q => q.category === selectedQuizCategory);
    }
    
    // Pick 30 random questions (or fewer if category has less than 30)
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(30, shuffled.length));
    
    if (selected.length === 0) {
      toast.error("Không có câu hỏi nào thuộc bộ câu hỏi đã chọn!");
      return;
    }
    
    setSelectedQuestions(selected);
    setAnswers({});
    setQuizStarted(true);
    setQuizSubmitted(false);
    setScore(0);
    setTimeLeft(2700); // 45 minutes
    setCurrentQuestionIndex(0);
  };

  const handleAnswerSelect = (questionId: number, optionIndex: number) => {
    if (quizSubmitted) return;
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleQuizSubmit = (isTimeOut: boolean = false) => {
    if (quizSubmitted) return;
    
    let correctCount = 0;
    selectedQuestions.forEach(q => {
      if (answers[q.id] === q.answer) {
        correctCount++;
      }
    });

    setScore(correctCount);
    setQuizSubmitted(true);

    const isPassed = correctCount >= 24; // 80% of 30 is 24

    // Update stats
    const newStats = {
      totalTests: stats.totalTests + 1,
      bestScore: Math.max(stats.bestScore, correctCount),
      lastScore: correctCount,
      passed: stats.passed || isPassed
    };

    setStats(newStats);
    localStorage.setItem('ecoplast_quiz_stats', JSON.stringify(newStats));

    if (isTimeOut) {
      toast.error("Hết giờ làm bài! Hệ thống tự động nộp bài thi của bạn.");
    }

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
        <TabsList className={cn(
          "grid w-full rounded-xl h-12 p-1.5 bg-gray-100 dark:bg-zinc-800 border border-border/50",
          isAdmin || isManager ? "grid-cols-3" : "grid-cols-2"
        )}>
          <TabsTrigger value="theory" className="rounded-lg font-bold text-sm flex items-center gap-2">
            <BookOpen className="h-4.5 w-4.5" />
            Lý thuyết Sản phẩm
          </TabsTrigger>
          <TabsTrigger value="quiz" className="rounded-lg font-bold text-sm flex items-center gap-2">
            <HelpCircle className="h-4.5 w-4.5" />
            Thi Luyện tập (Đề 30 câu)
          </TabsTrigger>
          {(isAdmin || isManager) && (
            <TabsTrigger value="sales-progress" className="rounded-lg font-bold text-sm flex items-center gap-2">
              <Users className="h-4.5 w-4.5" />
              Tiến độ Nhân viên
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Theory */}
        <TabsContent value="theory" className="outline-none">
          {/* Interactive Learning Roadmap */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-600" />
                  Lộ trình đào tạo chuyên sâu Ecoplast
                </h2>
                <p className="text-xs text-muted-foreground">Chọn từng giai đoạn học tập dưới đây để tự động lọc danh sách bài giảng tương ứng.</p>
              </div>
              {selectedPhaseId !== 'all' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedPhaseId('all')}
                  className="font-bold text-xs h-8 border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  Hiển thị tất cả bài học
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ROADMAP_PHASES.map((phase) => {
                const PhaseIcon = ICON_MAP[phase.iconName] || BookOpen;
                const isActive = selectedPhaseId === phase.id;
                return (
                  <Card 
                    key={phase.id}
                    onClick={() => setSelectedPhaseId(isActive ? 'all' : phase.id)}
                    className={cn(
                      "cursor-pointer transition-all duration-300 border shadow-sm flex flex-col justify-between overflow-hidden relative group h-full",
                      isActive 
                        ? "border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/15 dark:bg-blue-950/10" 
                        : "border-border/60 hover:border-blue-400 hover:shadow-md bg-card"
                    )}
                  >
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div className={cn(
                          "p-2 rounded-lg transition-colors",
                          isActive ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground group-hover:bg-blue-50 group-hover:text-blue-600"
                        )}>
                          <PhaseIcon className="h-4.5 w-4.5" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold border-none bg-muted px-2 py-0.5">
                          {phase.lessonsRange}
                        </Badge>
                      </div>
                      <div className="space-y-1 mt-2">
                        <h3 className="font-extrabold text-sm text-foreground leading-tight">{phase.title}</h3>
                        <p className="text-[11px] leading-snug text-muted-foreground line-clamp-3">{phase.description}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "h-1.5 w-full mt-auto transition-all",
                      isActive ? "bg-blue-600" : "bg-transparent group-hover:bg-blue-400/40"
                    )} />
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3 bg-card border rounded-2xl p-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                  <p className="text-xs font-bold text-muted-foreground">Đang tải tài liệu học tập từ hệ thống...</p>
                </div>
              ) : filteredLessons.length === 0 ? (
                <div className="text-center py-12 bg-card border rounded-2xl">
                  <BookMarked className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-bold text-muted-foreground">Chưa có bài học nào được cấu hình cho giai đoạn này.</p>
                </div>
              ) : (
                filteredLessons.map((lesson) => {
                  const Icon = ICON_MAP[lesson.iconName] || BookOpen;
                  const isExpanded = expandedLesson === lesson.id;
                  return (
                    <Card key={lesson.id} className="border border-border/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-full p-4 flex items-center justify-between bg-gray-50/50 hover:bg-gray-50 dark:hover:bg-zinc-800/40 text-left transition-colors border-b border-border/30">
                        <button
                          onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                          className="flex-1 flex items-center gap-3 text-left"
                        >
                          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                            <span className="font-bold text-base text-foreground leading-none">{lesson.title}</span>
                            {(() => {
                              const prog = progressMap.get(lesson.id);
                              if (prog?.isCompleted) {
                                return (
                                  <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-none font-bold text-[10px] py-0.5 px-2">
                                    Đã hoàn thành học (2m)
                                  </Badge>
                                );
                              } else if (prog && prog.studyTime > 0) {
                                const pct = Math.min(99, Math.round((prog.studyTime / 120) * 100));
                                return (
                                  <Badge className="bg-blue-500/15 text-blue-600 hover:bg-blue-500/20 border-none font-bold text-[10px] py-0.5 px-2">
                                    Đang học ({pct}%)
                                  </Badge>
                                );
                              } else {
                                return (
                                  <Badge variant="outline" className="text-muted-foreground font-bold text-[10px] py-0.5 px-2">
                                    Chưa học
                                  </Badge>
                                );
                              }
                            })()}
                          </div>
                        </button>

                        <div className="flex items-center gap-2">
                            {isAdmin && (
                              <div className="flex items-center gap-1.5 mr-2" onClick={(e) => e.stopPropagation()}>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30" 
                                  onClick={() => handleOpenEditDialog(lesson)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-950/30" 
                                  onClick={() => handleDelete(lesson.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          <button onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}>
                            <ChevronRight className={cn(
                              "h-5 w-5 text-muted-foreground/50 transition-transform duration-200",
                              isExpanded ? "transform rotate-90" : ""
                            )} />
                          </button>
                        </div>
                      </div>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <CardContent className="p-6 text-sm leading-relaxed text-muted-foreground border-t border-border/10 bg-slate-50/30 dark:bg-zinc-950/20 space-y-6">
                              {lesson.imageUrl && (
                                <div className="relative rounded-xl overflow-hidden border border-border/60 shadow-sm max-w-full md:max-w-2xl mx-auto">
                                  <img 
                                    src={lesson.imageUrl} 
                                    alt={lesson.title} 
                                    className="w-full h-[200px] md:h-[320px] object-cover bg-muted" 
                                  />
                                </div>
                              )}
                              <LessonStudyTracker 
                                lessonId={lesson.id} 
                                lessonTitle={lesson.title} 
                                onProgressUpdated={() => refetchUserProgress()} 
                              />
                              <BeautifulLessonRenderer content={lesson.content} lessonId={lesson.id} />
                            </CardContent>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  );
                })
              )}
              
              {/* Add New Section Button */}
              {isAdmin && (
                <Button 
                  variant="outline"
                  className="w-full py-6 border-dashed border-2 text-muted-foreground hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 flex flex-col gap-2 h-auto"
                  onClick={handleOpenAddDialog}
                >
                  <Plus className="h-6 w-6" />
                  <span className="font-bold">Thêm phần thông tin mới</span>
                </Button>
              )}
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
                    Bắt đầu thi sát hạch
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Quiz */}
        <TabsContent value="quiz" className="outline-none">
          {!quizStarted ? (
            <Card className="border border-border/80 p-6 md:p-8 text-center max-w-2xl mx-auto rounded-2xl shadow-sm bg-card space-y-6">
              <div className="space-y-2">
                <HelpCircle className="h-14 w-14 text-blue-600 mx-auto mb-2" />
                <h2 className="text-xl font-black">Thi sát hạch Chuyên đề Ecoplast</h2>
                <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Đề thi gồm 30 câu hỏi ngẫu nhiên được trích xuất từ ngân hàng 300 câu hỏi sát hạch của I-Nội-thất.
                  Thời gian: <strong>45 phút</strong>. Điều kiện đạt: <strong>24/30 câu đúng (80%)</strong>.
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t text-left">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Chọn chuyên đề sát hạch:</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'all', label: 'Đề thi tổng hợp (Tất cả)', desc: 'Ngẫu nhiên 30 câu thuộc cả 4 phần.' },
                    { id: 'ưu-thế-vật-liệu', label: '1. Ưu thế vật liệu', desc: 'Đặc tính cấu trúc nhựa, chống nước, chống cháy.' },
                    { id: 'kĩ-thuật-chế-tác', label: '2. Kỹ thuật chế tác', desc: 'Độ dày phôi, khoảng cách chịu lực, bám vít.' },
                    { id: 'đo-đạc-khảo-sát', label: '3. Đo đạc khảo sát', desc: 'Đo 3 điểm, out-of-plumb, phào chỉ.' },
                    { id: 'kĩ-năng-chốt-sales', label: '4. Kỹ năng chốt Sales', desc: 'Xử lý từ chối, kịch bản thuyết phục.' }
                  ].map((cat) => {
                    const isSelected = selectedQuizCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedQuizCategory(cat.id)}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all flex flex-col justify-between hover:border-blue-400 hover:shadow-sm",
                          isSelected 
                            ? "border-blue-600 bg-blue-50/25 ring-2 ring-blue-500/10" 
                            : "border-border/60 bg-card text-foreground"
                        )}
                      >
                        <span className="font-extrabold text-xs text-foreground block">{cat.label}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 leading-snug block">{cat.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button 
                onClick={handleStartQuiz} 
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-12 h-11 rounded-xl shadow-md transition-all mt-4"
              >
                Bắt đầu làm bài thi
              </Button>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-4">
              {/* Question Navigation & Stats */}
              <div className="space-y-4">
                <Card className="border border-border/80 rounded-2xl p-4 shadow-sm bg-card">
                  <div className="flex justify-between items-center pb-3 border-b mb-3">
                    <span className="text-xs font-bold text-muted-foreground">Thời gian còn lại</span>
                    <span className={cn(
                      "text-base font-black px-2.5 py-0.5 rounded-lg border",
                      timeLeft < 300 ? "bg-red-50 text-red-600 border-red-200 animate-pulse" : "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {formatTime(timeLeft)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-muted-foreground">Tiến độ</span>
                      <span>{Object.keys(answers).length}/30 câu</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${(Object.keys(answers).length / 30) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2 mt-5">
                    {selectedQuestions.map((q, idx) => {
                      const isAnswered = answers[q.id] !== undefined;
                      const isCurrent = currentQuestionIndex === idx;
                      return (
                        <button
                          key={q.id}
                          onClick={() => setCurrentQuestionIndex(idx)}
                          className={cn(
                            "h-9 rounded-lg text-xs font-black transition-all border",
                            isCurrent && "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20",
                            !isCurrent && isAnswered && "bg-secondary text-foreground border-border",
                            !isCurrent && !isAnswered && "bg-transparent text-muted-foreground/80 border-border hover:bg-secondary/40"
                          )}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  {!quizSubmitted ? (
                    <Button 
                      onClick={() => handleQuizSubmit()}
                      className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-xl"
                    >
                      Nộp bài thi
                    </Button>
                  ) : (
                    <div className="mt-6 space-y-3">
                      <div className="p-3 bg-muted rounded-xl text-center border">
                        <p className="text-[10px] font-black uppercase text-muted-foreground">Kết quả thi</p>
                        <p className="text-2xl font-black mt-1 text-primary">{score}/30 đúng</p>
                        <Badge className={cn(
                          "mt-2 font-bold px-3 border-none",
                          score >= 24 ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                        )}>
                          {score >= 24 ? "ĐẠT (TỐT NGHIỆP)" : "CHƯA ĐẠT"}
                        </Badge>
                      </div>
                      <Button 
                        onClick={handleStartQuiz}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Thi đề khác
                      </Button>
                    </div>
                  )}
                </Card>
              </div>

              {/* Current Question */}
              <div className="lg:col-span-3">
                <Card className="border border-border/80 rounded-2xl shadow-sm bg-card">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex justify-between items-center gap-4">
                      <Badge className="bg-blue-500/10 text-blue-600 border-none font-black text-[10px] px-2.5 py-0.5">
                        CÂU HỎI {currentQuestionIndex + 1} / 30
                      </Badge>
                      {quizSubmitted && (
                        answers[selectedQuestions[currentQuestionIndex]?.id] === selectedQuestions[currentQuestionIndex]?.answer ? (
                          <Badge className="bg-emerald-500 text-white border-none font-bold text-xs flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" /> Đúng
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500 text-white border-none font-bold text-xs flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5" /> Sai
                          </Badge>
                        )
                      )}
                    </div>
                    <CardTitle className="text-base md:text-lg font-bold leading-snug mt-3">
                      {selectedQuestions[currentQuestionIndex]?.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-3">
                    {selectedQuestions[currentQuestionIndex]?.options.map((option, idx) => {
                      const questionId = selectedQuestions[currentQuestionIndex].id;
                      const isSelected = answers[questionId] === idx;
                      const isCorrect = selectedQuestions[currentQuestionIndex].answer === idx;
                      const labels = ['A', 'B', 'C', 'D'];
                      
                      return (
                        <div
                          key={idx}
                          onClick={() => handleAnswerSelect(questionId, idx)}
                          className={cn(
                            "flex items-start gap-3 p-4 rounded-xl border transition-all text-sm font-semibold cursor-pointer",
                            !isSelected && "bg-transparent border-border hover:bg-secondary/20",
                            isSelected && "border-blue-600 bg-blue-500/5 text-blue-700 ring-1 ring-blue-500/30",
                            quizSubmitted && isCorrect && "bg-emerald-500/5 border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30",
                            quizSubmitted && isSelected && !isCorrect && "bg-rose-500/5 border-rose-500 text-rose-700 dark:text-rose-400 ring-1 ring-rose-500/30"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border shrink-0 mt-0.5",
                            !isSelected && "bg-secondary text-muted-foreground border-border/70",
                            isSelected && "bg-blue-600 text-white border-blue-600",
                            quizSubmitted && isCorrect && "bg-emerald-500 text-white border-emerald-500",
                            quizSubmitted && isSelected && !isCorrect && "bg-rose-500 text-white border-rose-500"
                          )}>
                            {labels[idx]}
                          </div>
                          <span className="leading-snug">{option}</span>
                        </div>
                      );
                    })}

                    {/* Review Mode Explanation */}
                    {quizSubmitted && (
                      <div className="mt-6 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-xs text-slate-700 dark:text-zinc-300">
                        <h4 className="font-bold text-primary mb-2 flex items-center gap-1.5">
                          <AlertCircle className="w-4.5 h-4.5" /> Giải thích chi tiết:
                        </h4>
                        <p className="leading-relaxed whitespace-pre-line font-medium text-muted-foreground">
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
        {(isAdmin || isManager) && (
          <TabsContent value="sales-progress" className="outline-none space-y-6">
            <Card className="border border-border/80 shadow-md bg-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-extrabold flex items-center gap-2 text-primary">
                    <Users className="h-5.5 w-5.5" />
                    Báo cáo Tiến độ Học tập của Đội ngũ Sales
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Theo dõi chi tiết thời lượng tích lũy thực tế và phòng chống gian lận cho từng nhân viên.
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchAllProgress()}
                  className="font-bold text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Làm mới
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingAllProgress ? (
                  <div className="flex flex-col items-center justify-center p-12 space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    <p className="text-xs text-muted-foreground font-bold">Đang tải dữ liệu tiến độ...</p>
                  </div>
                ) : salesProgressReport.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-bold text-muted-foreground">Chưa ghi nhận tiến độ học tập nào từ nhân viên sales.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/40 bg-muted/30 text-xs font-black uppercase text-muted-foreground">
                          <th className="p-4 pl-6">Nhân viên</th>
                          <th className="p-4">Số bài hoàn thành</th>
                          <th className="p-4">Tổng thời gian học</th>
                          <th className="p-4 pr-6">Chi tiết tiến trình</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 text-sm">
                        {salesProgressReport.map((grp) => {
                          const lessonsCompleted = grp.completedCount;
                          const totalLessons = lessons.length || 11;
                          const totalPct = Math.min(100, Math.round((lessonsCompleted / totalLessons) * 100));
                          
                          return (
                            <tr key={grp.userId} className="hover:bg-muted/10 transition-colors group">
                              <td className="p-4 pl-6">
                                <div className="font-extrabold text-foreground flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                    {grp.userName.substring(0, 2)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span>{grp.userName}</span>
                                    <span className="text-[10px] text-muted-foreground font-medium lowercase mt-0.5">{grp.userEmail}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="space-y-1.5 max-w-[150px]">
                                  <div className="flex items-center justify-between text-xs font-bold">
                                    <span>{lessonsCompleted} / {totalLessons} bài</span>
                                    <span className="text-primary">{totalPct}%</span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                    <div 
                                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                      style={{ width: `${totalPct}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="font-mono font-bold text-sm bg-muted/60 px-2 py-1 rounded">
                                  {Math.floor(grp.totalStudyTime / 60)} phút {grp.totalStudyTime % 60} giây
                                </span>
                              </td>
                              <td className="p-4 pr-6">
                                <div className="flex flex-wrap gap-1.5 max-w-sm">
                                  {lessons.map(lesson => {
                                    const lessonProg = grp.lessons[lesson.id];
                                    const isDone = lessonProg?.isCompleted;
                                    const time = lessonProg?.studyTime || 0;
                                    
                                    return (
                                      <Badge 
                                        key={lesson.id} 
                                        variant="outline" 
                                        className={cn(
                                          "text-[10px] py-0.5 px-2 border font-bold",
                                          isDone 
                                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                                            : time > 0 
                                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                            : "bg-muted text-muted-foreground border-transparent"
                                        )}
                                        title={`${lesson.title}: ${Math.floor(time / 60)}m ${time % 60}s study time`}
                                      >
                                        Bài {lesson.id}: {isDone ? "Đạt" : time > 0 ? `${time}s` : "Chưa"}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Admin Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] bg-white dark:bg-zinc-950 border-border/60 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 py-5 border-b border-border/40 bg-muted/20">
            <DialogTitle className="text-xl font-black text-blue-700 dark:text-blue-400">
              {editingLesson ? "Chỉnh sửa bài học" : "Thêm bài học mới"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-6 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-bold text-foreground">Tiêu đề bài học</Label>
              <Input 
                id="title" 
                placeholder="Ví dụ: 1. Giới thiệu Ecoplast" 
                value={titleField} 
                onChange={(e) => setTitleField(e.target.value)}
                className="h-11 font-semibold text-base"
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="order" className="text-sm font-bold text-foreground">Thứ tự hiển thị (Order)</Label>
                <Input 
                  id="order" 
                  type="number" 
                  value={orderField} 
                  onChange={(e) => setOrderField(Number(e.target.value))} 
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iconName" className="text-sm font-bold text-foreground">Chọn Icon đại diện</Label>
                <Select value={iconNameField} onValueChange={setIconNameField}>
                  <SelectTrigger id="iconName" className="h-11 font-semibold">
                    <SelectValue placeholder="Chọn icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(ICON_MAP).map((name) => {
                      const IconComponent = ICON_MAP[name];
                      return (
                        <SelectItem key={name} value={name}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4 text-muted-foreground" />
                            <span>{name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-foreground">Hình ảnh trực quan (Tùy chọn)</Label>
              <div className="flex items-center gap-4">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  disabled={isUploadingImage}
                  className="hidden"
                  id="image-file-upload"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  className="h-11 flex items-center gap-2 border-dashed border-2 hover:border-blue-400 hover:text-blue-600"
                  disabled={isUploadingImage}
                  onClick={() => document.getElementById('image-file-upload')?.click()}
                >
                  {isUploadingImage ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                      <span>Đang tải lên...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Chọn ảnh tải lên</span>
                    </>
                  )}
                </Button>
                {imageUrlField && (
                  <div className="flex-1 flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-border overflow-hidden">
                    <img 
                      src={imageUrlField} 
                      alt="Xem trước" 
                      className="h-8 w-8 object-cover rounded" 
                    />
                    <span className="text-xs truncate flex-1 font-semibold text-muted-foreground">{imageUrlField}</span>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-red-600 hover:text-red-700" 
                      onClick={() => setImageUrlField('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <Label htmlFor="content" className="text-sm font-bold text-foreground">Nội dung bài học (Markdown/Text)</Label>
                <Badge variant="outline" className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground bg-muted/30">Hỗ trợ Markdown</Badge>
              </div>
              <Textarea 
                id="content" 
                placeholder="Nhập nội dung chi tiết bài học..." 
                className="min-h-[350px] font-mono text-[13px] leading-relaxed resize-y border-border/60 focus:border-blue-500/50 p-4 rounded-xl"
                value={contentField} 
                onChange={(e) => setContentField(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="font-bold">
              Hủy
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 text-white hover:bg-blue-700 font-bold px-8 shadow-sm">
              Lưu lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EcoplastLearningPage;
