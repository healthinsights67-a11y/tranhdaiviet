
import { GoogleGenAI } from "@google/genai";

export interface RenderResult {
  images: string[];
  fusionPrompt: string;
  modelUsed?: string;
}

export interface InteriorDesignConfig {
  roomType?: string;          // 'living' | 'bedroom' | 'kitchen' | 'kids' | 'office' | 'closet' | 'balcony'
  style?: string;             // 'modern' | 'minimalist' | 'luxury_glass' | 'neoclassic' | 'japandi' | 'scandinavian'
  primaryMaterial?: string;   // 'ecoplast_oak' | 'ecoplast_walnut' | 'ecoplast_white' | 'glass_anodized' | 'mdf_melamine' | 'acrylic'
  accentLighting?: string[];  // ['led_strip_3000k', 'magnetic_track', 'under_cabinet', 'cove_ceiling']
  customDetails?: string;     // Ghi chú chi tiết từ người dùng
  aspectRatio?: string;       // "1:1" | "4:3" | "16:9" | "9:16"
  mode?: 'fusion' | 'empty_room' | 'retexture';
}

// Từ điển chuyên ngành Nội thất & Xưởng thi công
export const ROOM_TYPE_MAP: Record<string, { vi: string; en: string }> = {
  living: { vi: "Phòng Khách", en: "Living Room with sofa, media console, coffee table and accent wall" },
  bedroom: { vi: "Phòng Ngủ Master", en: "Master Bedroom with bed, nightstands, wardrobe closet and vanity desk" },
  kitchen: { vi: "Bếp Ăn", en: "Modern Kitchen with upper and lower kitchen cabinets, kitchen island, and dining area" },
  kids: { vi: "Phòng Trẻ Em", en: "Kids Bedroom with multifunctional study desk, storage wardrobe and vibrant smart layout" },
  office: { vi: "Phòng Làm Việc", en: "Home Office with ergonomic desk, bookshelf and executive storage wall" },
  closet: { vi: "Phòng Thay Đồ", en: "Walk-in Closet with illuminated glass-door wardrobes and center accessory island" },
  balcony: { vi: "Ban Công / Logia", en: "Cozy balcony relaxation area with vertical plant wall and waterproof storage" },
};

export const DESIGN_STYLE_MAP: Record<string, { vi: string; en: string; prompt: string }> = {
  modern: {
    vi: "Hiện Đại Sang Trọng",
    en: "Modern Luxury Interior",
    prompt: "Clean straight architectural lines, hidden joinery, recessed LED linear profile lighting, seamless flush cabinetry, balance between open shelving and closed storage."
  },
  luxury_glass: {
    vi: "Cánh Kính Khung Nhôm Cao Cấp",
    en: "Ultra Luxury Anodized Glass & Metal",
    prompt: "High-end anodized aluminum framed fluted and bronze tinted glass cabinet doors, internal 3000K warm LED spotlighting, floating shelves, reflective polished bronze accents, hotel luxury vibe."
  },
  minimalist: {
    vi: "Tối Giản Hiện Đại (Minimalism)",
    en: "Warm Minimalism",
    prompt: "Clutter-free space, handleless J-pull cabinets, pure monochromatic color scheme, maximum functional storage, serene and airy ambiance."
  },
  japandi: {
    vi: "Japandi (Nhật Bản & Bắc Âu)",
    en: "Japandi Natural Aesthetic",
    prompt: "Harmonious blend of Scandinavian functionality and Japanese rustic minimalism, light natural wood grains, paper lantern pendant lights, neutral earth tones, calming zen atmosphere."
  },
  neoclassic: {
    vi: "Tân Cổ Điển Nhẹ Nhàng",
    en: "Transitional Neo-Classical",
    prompt: "Subtle decorative wall moldings, elegant profile cabinet doors, brushed brass handles, soft velvet upholstery, timeless refined luxury."
  },
  scandinavian: {
    vi: "Bắc Âu (Scandinavian)",
    en: "Nordic Scandinavian",
    prompt: "Bright natural daylight, light oak woodwork, crisp white surfaces, cozy textured textiles, functional and welcoming lifestyle aesthetic."
  }
};

export const MATERIAL_MAP: Record<string, { vi: string; en: string }> = {
  ecoplast_oak: { vi: "Tấm Ecoplast Vân Gỗ Sồi Nga", en: "High-grade Ecoplast waterproof interior panels in Natural Russian Oak woodgrain texture" },
  ecoplast_walnut: { vi: "Tấm Ecoplast Vân Gỗ Óc Chó", en: "Premium Ecoplast waterproof panels in luxurious Dark American Walnut woodgrain texture" },
  ecoplast_white: { vi: "Tấm Ecoplast Trắng Sứ / Trắng Bóng", en: "Ultra-clean high gloss and matte porcelain white Ecoplast waterproof panels" },
  ecoplast_grey: { vi: "Tấm Ecoplast Xám Xi Măng / Ghi Đá", en: "Modern industrial Slate Grey and Concrete finish Ecoplast waterproof panels" },
  glass_anodized: { vi: "Thùng Nhựa Cánh Kính Khung Nhôm Anodized", en: "Black anodized ultra-slim aluminum frames with grey smoke tempered glass doors and internal lighting" },
  mdf_melamine: { vi: "Gỗ MDF Lõi Xanh Chống Ẩm Phủ Melamine", en: "Moisture-resistant MDF wood with seamless anti-scratch melamine finish" },
  acrylic: { vi: "Cánh Acrylic Bóng Gương Không Đường Line", en: "Seamless zero-joint mirror gloss acrylic cabinet fronts" }
};

// Model fallback lists
const IMAGE_MODELS_CASCADE = [
  "gemini-2.5-flash-image",
  "imagen-3.0-generate-002",
  "gemini-2.0-flash-exp",
  "gemini-2.5-flash"
];

const VISION_MODELS_CASCADE = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-3-flash-preview"
];

/**
 * Kiểm tra tính hợp lệ và kết nối của Gemini API Key
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; message?: string }> {
  if (!apiKey || apiKey.trim().length < 20) {
    return { valid: false, message: "API Key quá ngắn hoặc không đúng định dạng." };
  }
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    await ai.models.list();
    return { valid: true };
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes("400") || errMsg.includes("API_KEY_INVALID")) {
      return { valid: false, message: "API Key không hợp lệ. Vui lòng kiểm tra lại trên Google AI Studio." };
    }
    if (errMsg.includes("403")) {
      return { valid: false, message: "API Key bị giới hạn quyền truy cập hoặc chưa kích hoạt Gemini API." };
    }
    return { valid: false, message: `Lỗi kết nối API: ${errMsg.slice(0, 120)}` };
  }
}

/**
 * Tạo prompt kiến trúc chuyên nghiệp cho mô hình Render
 */
export function buildMasterInteriorPrompt(
  config: InteriorDesignConfig, 
  mode: 'fusion' | 'empty_room' | 'retexture' = 'fusion',
  customPrompt?: string
): { systemPrompt: string; userPrompt: string } {
  const roomInfo = config.roomType ? ROOM_TYPE_MAP[config.roomType] || { vi: config.roomType, en: config.roomType } : { vi: "Không gian nội thất", en: "Interior room space" };
  const styleInfo = config.style ? DESIGN_STYLE_MAP[config.style] || { vi: config.style, en: config.style, prompt: "" } : DESIGN_STYLE_MAP.modern;
  const materialInfo = config.primaryMaterial ? MATERIAL_MAP[config.primaryMaterial] || { vi: config.primaryMaterial, en: config.primaryMaterial } : MATERIAL_MAP.ecoplast_oak;
  
  const lightingPrompts = (config.accentLighting || []).map(light => {
    if (light === 'led_strip_3000k') return "Warm 3000K concealed LED light strips along cabinet kickboards and underneath shelves";
    if (light === 'magnetic_track') return "Recessed black magnetic track lighting on the ceiling";
    if (light === 'under_cabinet') return "Task illumination under top cabinets";
    if (light === 'cove_ceiling') return "Indirect cove ceiling ambient lighting";
    return light;
  }).join(", ");

  let systemPrompt = `
BẠN LÀ CHUYÊN GIA KIẾN TRÚC SƯ & NGHỆ SĨ 3D RENDER NỘI THẤT HÀNG ĐẦU THẾ GIỚI.
CHUYÊN MÔN: Thiết kế và diễn họa nội thất photorealistic đẳng cấp cao cho nhà ở thực tế (căn hộ, nhà phố, biệt thự).

TIÊU CHUẨN ĐẦU RA BẮT BUỘC:
1. Độ sắc nét 8K UHD, ánh sáng Raytracing tự nhiên, đổ bóng chân thực và chuyển màu êm ái.
2. Đúng quy chuẩn hình học, đường chân trời và điểm tụ chuẩn xác của không gian thực.
3. Vật liệu sắc nét: vân gỗ mịn tự nhiên, độ bóng kính trong trẻo, ray nhôm anodized xước mờ cao cấp, không bị mờ nhòe hay bóp méo hình dạng.
4. Bảo toàn tính khả thi thi công thực tế tại xưởng (tỷ lệ module chuẩn, khoang cánh cân đối).
`;

  let userPrompt = "";

  if (mode === 'empty_room') {
    systemPrompt += `
NHIỆM VỤ: Dựng hoàn thiện nội thất trọn gói từ phòng thô / phòng trống hiện trạng.
NGUYÊN TẮC:
- Giữ nguyên cấu trúc tường chịu lực, sàn gạch/gỗ, trần thạch cao, cửa sổ và nguồn sáng tự nhiên từ ảnh hiện trạng.
- Thiết kế hệ thống tủ, kệ, bàn, giường vừa vặn khít khao vào các mảng tường trống.
- Không gian: ${roomInfo.en} (${roomInfo.vi}).
- Phong cách: ${styleInfo.en}. ${styleInfo.prompt}.
- Vật liệu chủ đạo: ${materialInfo.en} (${materialInfo.vi}).
- Ánh sáng & chi tiết: ${lightingPrompts ? lightingPrompts + "." : "Harmonious warm interior lighting."}
`;
    userPrompt = `Hãy thiết kế nội thất hoàn chỉnh cho ${roomInfo.vi} trong ảnh theo phong cách ${styleInfo.vi}, sử dụng vật liệu ${materialInfo.vi}. Đảm bảo giữ nguyên kiến trúc phòng gốc và tỷ lệ thi công thực tế. ${config.customDetails || ''} ${customPrompt || ''}`;
  } else if (mode === 'fusion') {
    systemPrompt += `
NHIỆM VỤ: HÒA TRỘN MẪU NỘI THẤT TỪ ẢNH 2 VÀO KHÔNG GIAN ẢNH 1.
NGUYÊN TẮC VÀNG:
1. TIỀN CẢNH BẤT BIẾN: Giữ nguyên 100% các đồ vật hiện hữu ở tiền cảnh của ẢNH 1 (rèm cửa, giường, điều hòa, thảm...).
2. TÍCH HỢP HỆ TỦ MỚI: Trích xuất kiểu dáng, vật liệu (${materialInfo.vi}) và cách phân chia khoang từ ẢNH 2 để dựng ốp vào mảng tường trống của ẢNH 1.
3. PHỐI CẢNH & ÁNH SÁNG: Đồ vật mới phải khớp góc chụp và nhận nguồn sáng tự nhiên của ẢNH 1.
`;
    userPrompt = `Lấy mẫu nội thất từ Ảnh 2 và lắp đặt hoàn hảo vào không gian tường trống của Ảnh 1, phong cách ${styleInfo.vi}, chất liệu ${materialInfo.vi}. ${config.customDetails || ''} ${customPrompt || ''}`;
  } else {
    systemPrompt += `
NHIỆM VỤ: CẢI TẠO BỀ MẶT VÀ VẬT LIỆU (RE-TEXTURING).
NGUYÊN TẮC: Giữ nguyên kết cấu hình học của tủ/tường/sàn, thay đổi bề mặt sang chất liệu ${materialInfo.vi}.
`;
    userPrompt = `Thay đổi chất liệu bề mặt sang ${materialInfo.vi}, giữ nguyên mọi đường nét và bố cục nội thất. ${config.customDetails || ''} ${customPrompt || ''}`;
  }

  return { systemPrompt, userPrompt };
}

/**
 * Xử lý gọi API Gemini đa model linh hoạt với cơ chế tự động thử lại khi quá tải
 */
async function callGeminiWithResilience(
  apiKey: string,
  modelList: string[],
  contents: any,
  systemInstruction?: string,
  imageConfig?: any,
  responseMimeType?: string
): Promise<any> {
  const ai = new GoogleGenAI({ apiKey });
  let lastError: any = null;

  for (const model of modelList) {
    let retries = 2;
    while (retries >= 0) {
      try {
        const config: any = {};
        if (systemInstruction) config.systemInstruction = systemInstruction;
        if (imageConfig) config.imageConfig = imageConfig;
        if (responseMimeType) config.responseMimeType = responseMimeType;

        const response = await ai.models.generateContent({
          model,
          contents,
          config: Object.keys(config).length > 0 ? config : undefined
        });

        return { response, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || "";
        // Nếu lỗi 429 (Rate limit) hoặc 503 (Overloaded), đợi và thử lại trên model hiện tại
        if ((msg.includes("429") || msg.includes("quota") || msg.includes("503") || msg.includes("RESOURCE_EXHAUSTED")) && retries > 0) {
          retries--;
          await new Promise(res => setTimeout(res, 2500 * (3 - retries)));
          continue;
        }
        // Nếu lỗi do Model không tồn tại (404) hoặc không hỗ trợ image/modal, chuyển ngay sang model kế tiếp
        break;
      }
    }
  }

  // Nếu tất cả các model đều thất bại, chuyển hóa thông báo lỗi thân thiện
  let errorMsg = lastError?.message || "Hệ thống AI không phản hồi.";
  if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
    throw new Error("API Gemini đang bị giới hạn lượt gọi (Quota Exceeded). Vui lòng thử lại sau 1-2 phút hoặc kiểm tra hạn mức API Key của bạn trên Google AI Studio.");
  }
  if (errorMsg.includes("403") || errorMsg.includes("PERMISSION_DENIED")) {
    throw new Error("API Key không có quyền truy cập mô hình này hoặc chưa được kích hoạt dịch vụ Google AI.");
  }
  if (errorMsg.includes("404") || errorMsg.includes("NOT_FOUND")) {
    throw new Error("Mô hình AI hiện tại không khả dụng tại khu vực của bạn. Vui lòng thử lại sau.");
  }
  throw new Error(`Lỗi khởi tạo AI: ${errorMsg}`);
}

/**
 * Trích xuất ảnh Base64 từ kết quả trả về của Gemini
 */
function extractImageAndTextFromResult(response: any): { generatedImage: string; textOutput: string } {
  let generatedImage = "";
  let textOutput = "";

  if (response?.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        generatedImage = `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
      } else if (part.text) {
        textOutput += part.text;
      }
    }
  }

  if (!textOutput && response?.text) {
    textOutput = response.text;
  }

  return { generatedImage, textOutput };
}

/**
 * Render Hòa trộn Nội thất (Fusion Render v3)
 */
export async function simpleRender(
  apiKey: string,
  baseImageBase64: string,
  refImageBase64?: string,
  prompt?: string,
  aspectRatio: string = "1:1",
  config?: InteriorDesignConfig
): Promise<RenderResult> {
  const mergedConfig: InteriorDesignConfig = {
    aspectRatio,
    mode: refImageBase64 ? 'fusion' : 'empty_room',
    ...(config || {})
  };

  const { systemPrompt, userPrompt } = buildMasterInteriorPrompt(mergedConfig, mergedConfig.mode, prompt);

  const cleanBase64 = (str: string) => str.includes(',') ? str.split(',')[1] : str;

  const baseImagePart = {
    inlineData: {
      data: cleanBase64(baseImageBase64),
      mimeType: "image/jpeg",
    },
  };

  const parts: any[] = [baseImagePart];

  if (refImageBase64) {
    parts.push({
      inlineData: {
        data: cleanBase64(refImageBase64),
        mimeType: "image/jpeg",
      }
    });
  }

  parts.push({ text: userPrompt });

  const { response, modelUsed } = await callGeminiWithResilience(
    apiKey,
    IMAGE_MODELS_CASCADE,
    { parts },
    systemPrompt,
    { aspectRatio: mergedConfig.aspectRatio || aspectRatio }
  );

  const { generatedImage, textOutput } = extractImageAndTextFromResult(response);

  return {
    images: generatedImage ? [generatedImage] : [],
    fusionPrompt: textOutput || "Đã phân tích phối cảnh và tạo ảnh thiết kế nội thất thành công.",
    modelUsed
  };
}

/**
 * Render Thiết kế trọn gói từ phòng trống / phòng thô
 */
export async function renderFromEmptyRoom(
  apiKey: string,
  baseImageBase64: string,
  config: InteriorDesignConfig
): Promise<RenderResult> {
  return simpleRender(apiKey, baseImageBase64, undefined, undefined, config.aspectRatio || "1:1", {
    ...config,
    mode: 'empty_room'
  });
}

/**
 * Phân tích cấu trúc nội thất và bounding box (Smart Vision)
 */
export async function analyzeDesign(apiKey: string, imageBase64: string): Promise<any> {
  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  
  const systemPrompt = `
BẠN LÀ CHUYÊN GIA PHÂN TÍCH THIẾT KẾ NỘI THẤT VIỆT NAM.
NHIỆM VỤ: Phân tích ảnh không gian và trả về JSON danh sách các vật dụng chính (Tủ áo, Tủ bếp, Kệ TV, Giường, Bàn học, Ghế sofa...).
Định dạng JSON:
[
  {
    "label": "Tên vật dụng (tiếng Việt UTF-8)",
    "box_2d": [ymin, xmin, ymax, xmax], // Chuẩn hóa từ 0 đến 1000
    "description": "Mô tả chất liệu, màu sắc và kiểu dáng"
  }
]
`;

  const imagePart = {
    inlineData: {
      data: cleanBase64,
      mimeType: "image/jpeg",
    },
  };

  const { response } = await callGeminiWithResilience(
    apiKey,
    VISION_MODELS_CASCADE,
    { parts: [imagePart, { text: "Phân tích và nhận diện các thành phần nội thất chính kèm tọa độ khung bao." }] },
    systemPrompt,
    undefined,
    "application/json"
  );

  const text = response.text || "";
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Không thể trích xuất cấu trúc JSON từ kết quả AI.");
  }
}

/**
 * Phân tách không gian thành Tường, Sàn, Trần (Spatial Segmentation)
 */
export async function analyzeSegmentation(apiKey: string, imageBase64: string): Promise<any> {
  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

  const systemPrompt = `
BẠN LÀ CHUYÊN GIA PHÂN VÙNG KHÔNG GIAN KIẾN TRÚC.
NHIỆM VỤ: Phân tách ảnh thành các vùng: "wall" (Tường), "floor" (Sàn), "ceiling" (Trần).
Định dạng JSON:
{
  "segments": [
    {
      "label": "wall" | "floor" | "ceiling",
      "polygon": [[x1, y1], [x2, y2], ...] // Tọa độ chuẩn hóa 0 đến 1000
    }
  ]
}
`;

  const imagePart = {
    inlineData: {
      data: cleanBase64,
      mimeType: "image/jpeg",
    },
  };

  const { response } = await callGeminiWithResilience(
    apiKey,
    VISION_MODELS_CASCADE,
    { parts: [imagePart, { text: "Xác định đa giác phân vùng ranh giới giữa Tường, Sàn và Trần." }] },
    systemPrompt,
    undefined,
    "application/json"
  );

  const text = response.text || "";
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Không thể phân tách ranh giới không gian.");
  }
}

/**
 * Di chuyển và inpainting vật thể sang tọa độ mới
 */
export async function relocateObject(
  apiKey: string,
  imageBase64: string,
  objectLabel: string,
  targetX: number,
  targetY: number,
  canvasWidth: number,
  canvasHeight: number
): Promise<string> {
  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const normX = Math.round((targetX / canvasWidth) * 1000);
  const normY = Math.round((targetY / canvasHeight) * 1000);

  const systemPrompt = `
BẠN LÀ CHUYÊN GIA INPAINTING & BIÊN TẬP HÌNH ẢNH NỘI THẤT.
NHIỆM VỤ: Di chuyển vật thể "${objectLabel}" từ vị trí hiện tại sang vị trí tâm mới [${normY}, ${normX}].
YÊU CẦU:
1. Xóa vật thể ở vị trí cũ và lấp đầy nền tường/sàn đồng nhất tự nhiên.
2. Đặt vật thể vào vị trí mới có tâm tại Y=${normY}, X=${normX}.
3. Giữ nguyên màu sắc, chất liệu và kích thước tỉ lệ so với căn phòng.
`;

  const imagePart = {
    inlineData: {
      data: cleanBase64,
      mimeType: "image/jpeg",
    },
  };

  const prompt = `Di chuyển ${objectLabel} sang tọa độ Y=${normY}, X=${normX}. Inpainting vùng cũ liền mạch hoàn hảo.`;

  const { response } = await callGeminiWithResilience(
    apiKey,
    IMAGE_MODELS_CASCADE,
    { parts: [imagePart, { text: prompt }] },
    systemPrompt
  );

  const { generatedImage } = extractImageAndTextFromResult(response);
  return generatedImage || `data:image/jpeg;base64,${cleanBase64}`;
}

/**
 * Thay đổi vật liệu vùng chọn hoặc toàn bộ không gian
 */
export async function retextureSpace(
  apiKey: string,
  imageBase64: string,
  targetRegion: 'wall' | 'floor' | 'ceiling',
  materialDescription: string
): Promise<string> {
  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const regionVi = targetRegion === 'wall' ? 'Tường' : targetRegion === 'floor' ? 'Sàn' : 'Trần';

  const systemPrompt = `
BẠN LÀ CHUYÊN GIA RE-TEXTURING VẬT LIỆU NỘI THẤT.
NHIỆM VỤ: Thay đổi vật liệu của vùng "${regionVi}" thành: ${materialDescription}.
YÊU CẦU: BẢO TOÀN toàn bộ các đồ đạc nội thất, ánh sáng và bố cục hiện có. Chỉ đổi bề mặt ${regionVi}.
`;

  const prompt = `Thay đổi vật liệu ${regionVi} thành ${materialDescription}. Giữ nguyên cấu trúc phòng.`;

  const imagePart = {
    inlineData: {
      data: cleanBase64,
      mimeType: "image/jpeg",
    },
  };

  const { response } = await callGeminiWithResilience(
    apiKey,
    IMAGE_MODELS_CASCADE,
    { parts: [imagePart, { text: prompt }] },
    systemPrompt
  );

  const { generatedImage } = extractImageAndTextFromResult(response);
  return generatedImage || `data:image/jpeg;base64,${cleanBase64}`;
}

/**
 * Render góc máy camera 3D mới
 */
export async function renderCameraAngle(
  apiKey: string, 
  imageBase64: string, 
  rotation: number, 
  tilt: number, 
  zoom: number
): Promise<string> {
  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

  const systemPrompt = `
BẠN LÀ CHUYÊN GIA DIỄN HỌA 3D NỘI THẤT.
NHIỆM VỤ: Render lại căn phòng này từ góc máy mới:
- Góc xoay ngang (Yaw): ${rotation} độ.
- Góc nghiêng dọc (Pitch): ${tilt} độ.
- Thu phóng (Zoom): ${zoom}x.
BẢO TOÀN 100% tất cả vật dụng, chất liệu và phối màu gốc.
`;

  const prompt = `Render lại không gian từ góc máy: Xoay ${rotation} độ, Nghiêng ${tilt} độ, Zoom ${zoom}x.`;

  const imagePart = {
    inlineData: {
      data: cleanBase64,
      mimeType: "image/jpeg",
    },
  };

  const { response } = await callGeminiWithResilience(
    apiKey,
    IMAGE_MODELS_CASCADE,
    { parts: [imagePart, { text: prompt }] },
    systemPrompt
  );

  const { generatedImage } = extractImageAndTextFromResult(response);
  return generatedImage || `data:image/jpeg;base64,${cleanBase64}`;
}

export interface ScannedInvoiceItem {
  code: string;
  name: string;
  unit: string;
  quantity: number;
}

/**
 * Trích xuất mặt hàng từ hóa đơn / phiếu xuất kho bằng AI Vision
 */
export async function scanInvoice(
  apiKey: string,
  imageBase64: string
): Promise<ScannedInvoiceItem[]> {
  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

  const systemPrompt = `
BẠN LÀ TRỢ LÝ AI BÓC TÁCH HÓA ĐƠN & PHIẾU XUẤT KHO VẬT TƯ NỘI THẤT.
NHIỆM VỤ: Trích xuất bảng kê hàng hóa thành danh sách JSON Array:
[
  {
    "code": "Mã hàng hoá (ví dụ: AT_4024 hoặc rỗng)",
    "name": "Tên hàng hoá (ví dụ: Ecoplast Màu Trắng 400*15*2400)",
    "unit": "Đơn vị tính (Hộp, Tấm, Cây, Bộ)",
    "quantity": 1
  }
]
Số lượng phải là kiểu number nguyên hoặc thập phân.
`;

  const imagePart = {
    inlineData: {
      data: cleanBase64,
      mimeType: "image/jpeg",
    },
  };

  const { response } = await callGeminiWithResilience(
    apiKey,
    VISION_MODELS_CASCADE,
    [imagePart, { text: "Trích xuất danh sách mặt hàng từ bảng hoá đơn này." }],
    systemPrompt,
    undefined,
    "application/json"
  );

  const text = response.text || "[]";
  try {
    return JSON.parse(text) as ScannedInvoiceItem[];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]) as ScannedInvoiceItem[];
    }
    return [];
  }
}

