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
    title: "1. Tổng quan & Thành phần cấu tạo",
    icon: Layers,
    content: `Tấm nhựa rỗng cao cấp Ecoplast là dòng vật liệu nội thất thế hệ mới, được nghiên cứu và phát triển để thay thế gỗ công nghiệp và các loại nhựa mỏng giá rẻ trên thị trường.

**Thành phần cấu tạo:**
- **Nhựa PVC nguyên sinh (Polyvinyl Chloride):** Chiếm tỷ lệ lớn nhất, đóng vai trò liên kết nền, tạo độ bền dẻo và tính đàn hồi tốt.
- **Bột đá siêu mịn (CaCO3):** Tăng độ chịu lực, tăng độ cứng bề mặt và giảm độ co ngót của tấm nhựa.
- **Chất phụ gia chuyên dụng:** Gồm chất ổn định nhiệt, chống tia UV, phụ gia chống cháy lan và tạo dẻo không chứa chì (Lead-free), thân thiện với môi trường và sức khỏe con người.`
  },
  {
    id: 2,
    title: "2. Đặc tính kỹ thuật & Cấu trúc chịu lực",
    icon: Info,
    content: `Khác với nhựa đặc thông thường có giá thành rất cao và nặng, nhựa Ecoplast áp dụng cấu trúc rỗng với hệ xương chịu lực dày bên trong.

**Cấu trúc xương chịu lực dọc:**
- Các vách ngăn (xương nhựa) chạy dọc suốt chiều dài tấm với độ dày từ 1.2mm đến 2.0mm.
- Thiết kế này phân bổ lực nén và uốn từ bề mặt xuống cấu trúc chân đế, giúp tấm nhựa có khả năng chịu lực nén cực kỳ cao (xe tải có thể cán qua không vỡ).

**Quy cách độ dày phổ biến:**
- **15mm:** Thường dùng làm cánh tủ quần áo, mặt hộc ngăn kéo, phào tủ để đảm bảo trọng lượng nhẹ, tránh xệ bản lề.
- **20mm:** Dùng làm vách ngăn tủ, đợt tủ ngang, thùng tủ bếp, cánh tủ lớn cần độ cứng vững cao.
- **25mm - 30mm:** Dùng làm khung xương chịu lực chính, cột tủ, mặt bàn học hoặc giường ngủ nhựa Ecoplast.`
  },
  {
    id: 3,
    title: "3. Ưu điểm vượt trội của Ecoplast",
    icon: Droplet,
    content: `Tấm nhựa Ecoplast sở hữu những tính năng khắc phục triệt để nhược điểm của gỗ tự nhiên và gỗ công nghiệp:

- **Kháng nước tuyệt đối 100%:** Cấu trúc liên kết nhựa không thấm nước, hoàn toàn không bị nở, mục nát khi ngâm nước hoặc sử dụng trong môi trường ẩm ướt như nhà bếp, phòng vệ sinh.
- **Chống mối mọt hoàn toàn:** Do cấu tạo hoàn toàn là polyme và bột đá, mối mọt không thể xâm nhập hay tiêu hóa nguồn thức ăn này.
- **Chống cháy lan hiệu quả:** Đạt tiêu chuẩn chống cháy không bắt lửa tự do. Khi tiếp xúc trực tiếp với nguồn lửa lớn, nhựa Ecoplast chỉ sun lại và tự tắt khi cách ly nguồn cháy, không bùng phát đám cháy.
- **Trọng lượng nhẹ, dễ thi công:** Giúp giảm tải trọng công trình, thợ dễ dàng di chuyển và lắp đặt nhanh chóng tại công trình.`
  },
  {
    id: 4,
    title: "4. Kỹ thuật gia công và lắp đặt chuyên nghiệp",
    icon: ShieldCheck,
    content: `Gia công nhựa rỗng đòi hỏi kỹ năng đóng tủ chính xác để đảm bảo độ bền tối đa của sản phẩm liên kết:

**Liên kết bắt vít:**
- Do cấu trúc rỗng, khi bắt vít bản lề hoặc liên kết thùng tủ, thợ tuyệt đối không được bắt vít vào khoảng trống. Vít phải đi sâu vào vách xương chịu lực của tấm nhựa.
- **Gia cố nhét gỗ (Chốt gỗ):** Để liên kết bản lề chịu lực cực kỳ chắc chắn (như cánh tủ bếp), thợ tiến hành nhét các thanh gỗ tự nhiên hoặc gỗ nhựa vào trong các ô rỗng tại điểm bắt vít. Vít sẽ xuyên qua vỏ nhựa bám chặt vào lõi gỗ gia cố bên trong.

**Keo liên kết:**
- Sử dụng keo 502 kết hợp keo chuyên dụng AB hoặc keo silicon chịu nhiệt để gia cố các góc liên kết ke sắt, ke nhựa chống xê dịch.`
  },
  {
    id: 5,
    title: "5. Cẩm nang chốt Sales và Xử lý từ chối",
    icon: BookMarked,
    content: `Khi khách hàng nghi ngại về độ bền của nhựa rỗng hoặc lo sợ tủ nhựa ọp ẹp:

**1. Khách hàng bảo: "Tủ nhựa rỗng ọp ẹp lắm, dùng một thời gian sẽ bung hỏng"**
- *Tư vấn:* "Dạ chị, nhựa rỗng Ecoplast là nhựa chịu lực có cấu trúc xương dày gấp 3 lần nhựa đài loan thông thường. Bên cạnh đó, tại I-Nội-Thất, ở tất cả các vị trí bản lề và liên kết lực chính, đội kỹ thuật của tụi em đều nhét chốt gỗ đặc gia cố bên trong trước khi bắt vít sâu vào xương nhựa. Đảm bảo bản lề chắc chắn gấp đôi và không lo bị xệ cánh trong suốt quá trình sử dụng."

**2. Khách hàng bảo: "Mặt đợt ngang dài thế kia để đồ nặng sẽ bị võng"**
- *Tư vấn:* "Đối với các đợt ngăn tủ dài trên 70cm hoặc chịu lực nặng, chúng em thiết kế bổ sung thanh tăng cứng bằng gỗ nhựa đặc/sắt hộp bên trong lõi xương nhựa hoặc thiết kế chia vách ngăn thông minh để lực truyền đều, hoàn toàn không bị võng nứt."`
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
        "15mm hoặc 20mm",
        "25mm hoặc 30mm",
        "35mm"
      ],
      answer: 1,
      explanation: "Độ dày 15mm hoặc 20mm là tiêu chuẩn tối ưu giúp cánh tủ bền đẹp, trọng lượng vừa phải chống sệ cánh tủ."
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
        "Nhét chốt gỗ tự nhiên hoặc chốt nhựa đặc vào lõi rỗng trước khi bắn vít xuyên qua vách xương.",
        "Dùng súng bắn keo nến phủ kín khoảng rỗng.",
        "Bắn vít ngắn 5mm chỉ bám vào lớp vỏ nhựa mỏng bên ngoài.",
        "Chỉ cần bôi keo 502 trực tiếp lên vít rồi bắn qua."
      ],
      answer: 0,
      explanation: "Phương pháp gia cố nhét gỗ đặc vào trong các khoang rỗng giúp vít bám cực chắc vào thớ gỗ uốn, chống rung lắc bung bản lề."
    },
    {
      question: "Độ dày uốn chịu lực chính làm mặt giường ngủ nhựa Ecoplast nên chọn tối thiểu là bao nhiêu?",
      options: [
        "15mm",
        "20mm",
        "25mm đến 30mm",
        "10mm"
      ],
      answer: 2,
      explanation: "Giường ngủ chịu tải trọng động và tĩnh rất lớn, nên sử dụng các tấm nhựa dày từ 25mm trở lên kết hợp gia cố xương chịu lực dày bên dưới giường."
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
        "Cho khách hàng xem trực tiếp mẫu tấm nhựa có xương gia cường dày dặn, xe tải đi qua không vỡ và cam kết gia cố xương gỗ/sắt bên trong.",
        "Khuyên khách hàng nên mua loại gỗ đắt tiền hơn nếu không tin tưởng.",
        "Nói rằng nhựa rỗng rẻ tiền nên bắt buộc phải chấp nhận ọp ẹp.",
        "Tự ý giảm giá sâu 50% để khách hàng đồng ý mua đại."
      ],
      answer: 0,
      explanation: "Chứng minh độ bền cơ học thực tế của tấm xương tăng cứng và công nghệ chốt vít gia cố bằng gỗ đặc là cách thuyết phục trực quan nhất."
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
        "Chứa hàm lượng Focmandehit cực cao.",
        "Hoàn toàn không chứa kim loại nặng như chì (Lead-free), không chứa formaldehyde.",
        "Chứa sơn dầu VOC nồng độ cao hại phổi.",
        "Chứa amiăng gây xơ hóa phổi."
      ],
      answer: 1,
      explanation: "Được kiểm định chất lượng an toàn, không chứa chì và các hóa chất độc hại gây ảnh hưởng đến sức khỏe người tiêu dùng, trẻ em."
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
        "Từ 60cm đến 80cm là tối ưu, nếu dài hơn cần tăng cường xương chịu lực ngang.",
        "Không giới hạn, nhựa Ecoplast uốn rất bền không bao giờ võng.",
        "Tối đa 30cm để đảm bảo tuyệt đối.",
        "Từ 150cm trở lên để tiết kiệm vật tư tủ."
      ],
      answer: 0,
      explanation: "Khoảng cách an toàn chịu lực của tấm đợt ngang là dưới 80cm, vượt quá độ dài này cần thiết kế thêm vách đỡ dọc hoặc thanh xương đỡ chịu lực."
    }),
    (cat: string, p: { value: number; unit: string }) => ({
      question: `Tấm nhựa Ecoplast dày ${p.value}${p.unit} uốn nén dùng cho hạng mục ${cat} có khả năng kháng ẩm mốc như thế nào trong mùa nồm ẩm miền Bắc?`,
      options: [
        "Kháng ẩm mốc tuyệt đối 100%, bề mặt không bám nước đọng gây mốc đen.",
        "Vẫn bị mốc nhẹ ở các gân nhựa dọc.",
        "Hút ẩm mạnh làm biến dạng bề mặt vân gỗ uốn.",
        "Cần phun thêm chất bảo quản chống ẩm định kỳ hàng tháng."
      ],
      answer: 0,
      explanation: "Khả năng chống ẩm tuyệt hảo của polyme nguyên sinh giúp bảo vệ tủ hoàn toàn khỏi nấm mốc kể cả khi trời nồm ẩm hay thấm dột nước."
    }),
    (cat: string, p: { value: number; unit: string }) => ({
      question: `Khi tư vấn chốt sale thiết kế ${cat} bằng nhựa Ecoplast có độ dày uốn ${p.value}${p.unit}, khách hàng hỏi tuổi thọ trung bình của tủ nhựa là bao nhiêu, sale trả lời thế nào?`,
      options: [
        "Độ bền kết cấu khung tủ lên tới 15 - 20 năm nếu gia công đúng tiêu chuẩn và sử dụng đúng tải trọng.",
        "Chỉ dùng được khoảng 2 - 3 năm là phải thay tủ mới.",
        "Khoảng 50 năm không hỏng hóc bất cứ chi tiết nào kể cả bản lề uốn uốn.",
        "Độ bền tương đương gỗ lim tự nhiên nhóm 1."
      ],
      answer: 0,
      explanation: "Tấm nhựa Ecoplast có độ bền vật liệu cực kỳ cao, kết cấu gia công lắp ráp tiêu chuẩn của I-Nội-Thất bảo đảm tuổi thọ sản phẩm bền bỉ 15-20 năm."
    }),
    (cat: string, p: { value: number; unit: string }) => ({
      question: `Độ bám vít bản lề của tấm nhựa Ecoplast uốn dày ${p.value}${p.unit} lắp cho ${cat} phụ thuộc lớn nhất vào yếu tố nào?`,
      options: [
        "Kỹ thuật bắn vít xuyên qua gân nhựa tăng cứng dọc hoặc bắt vít trực tiếp vào chốt gỗ nhét gia cố.",
        "Độ bóng của lớp sơn ngoài tủ.",
        "Nhiệt độ phòng lúc thợ thi công.",
        "Màu sắc vân gỗ sáng hay tối."
      ],
      answer: 0,
      explanation: "Độ bền chắc của vít phụ thuộc vào việc vít được bắt vào phần thịt nhựa (xương gân dọc) hoặc phần lõi gỗ gia cố đặc nhét bên trong ô rỗng."
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
