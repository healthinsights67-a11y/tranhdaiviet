
import { GoogleGenAI } from "@google/genai";

export interface RenderResult {
  images: string[];
  fusionPrompt: string;
}

export async function simpleRender(
  apiKey: string,
  baseImageBase64: string,
  refImageBase64: string,
  prompt?: string,
  aspectRatio: string = "1:1"
): Promise<RenderResult> {
  const ai = new GoogleGenAI({ apiKey });
  
  const systemPrompt = `
    BẠN LÀ CHUYÊN GIA SIÊU CẤP VỀ THIẾT KẾ VÀ HÒA TRỘN NỘI THẤT (IMAGE FUSION).
    
    NHIỆM VỤ: Lấy các vật dụng nội thất từ ẢNH 2 và "lắp đặt" chúng vào không gian của ẢNH 1.
    
    NGUYÊN TẮC VÀNG (BẢO TOÀN HIỆN TRẠNG):
    1. TIỀN CẢNH BẤT BIẾN (FOREGROUND PRESERVATION): Tuyệt đối KHÔNG ĐƯỢC THAY ĐỔI, DI CHUYỂN hoặc XÓA BỎ các vật thể hiện hữu trong ẢNH 1 (Giường, Gối, Rèm, Điều hòa, Thảm...). Chúng phải giữ nguyên 100% chi tiết và vị trí.
    2. LỚP PHỦ NỘI THẤT (FURNITURE INTEGRATION): 
       - Trích xuất Đồ Nội Thất (Tủ, Kệ, Bàn, hoặc bất kỳ vật dụng nào) từ ẢNH 2.
       - Lắp chúng vào các mảng tường trống trong ẢNH 1. 
       - Nếu Giường đang chắn, đồ mới PHẢI NẰM PHÍA SAU. Không được đè lên các vật dụng hiện có.
    
    3. PHỐI CẢNH ĐỒNG NHẤT: Đồ vật mới phải khớp hoàn hảo với góc chụp, đường chân trời và điểm tụ của ẢNH 1.
    4. SAO CHÉP CHI TIẾT: Giữ nguyên màu sắc, vân gỗ, chất liệu (Ecoplast/Cánh kính...) và kiểu dáng từ ẢNH 2.
    5. ÁNH SÁNG: Tạo bóng đổ và phản xạ ánh sáng tự nhiên theo nguồn sáng của ẢNH 1.
    
    TỶ LỆ KHUNG HÌNH: ${aspectRatio}
  `;

  const userPrompt = prompt || "Hãy trích xuất đồ nội thất từ Ảnh 2 và lắp vào không gian Ảnh 1 một cách tự nhiên nhất, giữ nguyên bố cục vật dụng cũ của Ảnh 1.";

  const baseImagePart = {
    inlineData: {
      data: baseImageBase64,
      mimeType: "image/jpeg",
    },
  };
  
  const refImagePart = {
    inlineData: {
      data: refImageBase64,
      mimeType: "image/jpeg",
    },
  };

  const textPart = {
    text: userPrompt,
  };

  let response;
  let retries = 2;
  
  while (retries >= 0) {
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image", 
        contents: { parts: [baseImagePart, refImagePart, textPart] },
        config: {
          systemInstruction: systemPrompt,
          imageConfig: {
            aspectRatio: aspectRatio
          }
        }
      });
      break; 
    } catch (error: any) {
      if (error?.message?.includes("429") && retries > 0) {
        retries--;
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      throw error;
    }
  }

  if (!response) {
    throw new Error("Mô hình đang quá tải hoặc không phản hồi. Vui lòng thử lại sau.");
  }

  let generatedImage = "";
  let fusionPrompt = "";

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        generatedImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      } else if (part.text) {
        fusionPrompt += part.text;
      }
    }
  }

  if (!generatedImage && !fusionPrompt && response.text) {
    fusionPrompt = response.text;
  }

  return {
    images: generatedImage ? [generatedImage] : [], 
    fusionPrompt: fusionPrompt || "Đã phân tích phối cảnh và tạo ảnh hòa trộn dựa trên hình ảnh cung cấp."
  };
}

export async function analyzeDesign(apiKey: string, imageBase64: string): Promise<any> {
  const ai = new GoogleGenAI({ apiKey });
  
  const systemPrompt = `
    BẠN LÀ TRỢ LÝ PHÂN TÍCH THIẾT KẾ NỘI THẤT. 
    NHIỆM VỤ: Phân tích ảnh thiết kế nội thất này và trả về cấu trúc JSON mô tả các thành phần chính (Tủ, Giường, Kệ, v.v.).
    Mỗi thành phần cần có: 
    - label: tên vật dụng (tiếng Việt mã hóa UTF-8)
    - box_2d: [ymin, xmin, ymax, xmax] (tọa độ chuẩn hóa 0-1000)
    - description: mô tả ngắn gọn về chất liệu/màu sắc.
    
    LUÔN TRẢ VỀ JSON TRONG MỘT CODE BLOCK.
  `;

  const prompt = "Hãy phân tích ảnh này và liệt kê các vật dụng nội thất chính kèm tọa độ khung bao của chúng.";

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: "image/jpeg",
    },
  };

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [imagePart, { text: prompt }] },
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json"
    }
  });

  const text = result.text || "";
  
  try {
    if (!text || text.trim() === "" || text.trim() === "undefined") {
      throw new Error("Dữ liệu AI trả về trống hoặc không hợp lệ.");
    }
    return JSON.parse(text);
  } catch (e) {
    console.warn("Retrying JSON extraction from text candidate...");
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const cleanedJson = jsonMatch[0].trim();
        if (cleanedJson !== "undefined" && cleanedJson !== "") {
          return JSON.parse(cleanedJson);
        }
      } catch (innerE) {
        console.error("Inner JSON parse failed:", innerE);
      }
    }
    throw new Error("Không thể phân tích cấu trúc thiết kế.");
  }
}

export async function analyzeSegmentation(apiKey: string, imageBase64: string): Promise<any> {
  const ai = new GoogleGenAI({ apiKey });
  
  const systemPrompt = `
    BẠN LÀ CHUYÊN GIA PHÂN TÁCH KHÔNG GIAN (SEGMENTATION).
    NHIỆM VỤ: Phân tách ảnh thành các vùng: Tường (Wall), Sàn (Floor), Trần (Ceiling).
    Trả về JSON chứa mảng các "segments".
    Mỗi segment:
    - label: "wall", "floor", or "ceiling"
    - polygon: [[x1, y1], [x2, y2], ...] (tọa độ chuẩn hóa 0-1000)
    
    YÊU CẦU: Tìm chính xác ranh giới giữa tường, sàn và trần.
    LUÔN TRẢ VỀ JSON TRONG CODE BLOCK.
  `;

  const prompt = "Hãy phân tách vùng tường, sàn và trần trong ảnh này.";

  const imagePart = {
    inlineData: {
      data: imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64,
      mimeType: "image/jpeg",
    },
  };

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [imagePart, { text: prompt }] },
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json"
    }
  });

  const responseText = result.text || "";
  try {
    const cleanRepo = responseText || "";
    if (!cleanRepo || cleanRepo.trim() === "" || cleanRepo.trim() === "undefined") {
      throw new Error("Dữ liệu phân tách trống.");
    }
    return JSON.parse(cleanRepo);
  } catch (e) {
    const jsonMatch = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const cleanedJson = jsonMatch[0].trim();
        if (cleanedJson !== "undefined" && cleanedJson !== "") {
          return JSON.parse(cleanedJson);
        }
      } catch (innerE) {
        console.error("Inner segmentation JSON parse failed", innerE);
      }
    }
    throw new Error("Không thể phân tách không gian.");
  }
}

export async function relocateObject(
  apiKey: string,
  imageBase64: string,
  objectLabel: string,
  targetX: number,
  targetY: number,
  canvasWidth: number,
  canvasHeight: number
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  
  // Normalize coordinates to 0-1000
  const normX = Math.round((targetX / canvasWidth) * 1000);
  const normY = Math.round((targetY / canvasHeight) * 1000);

  const systemPrompt = `
    BẠN LÀ CHUYÊN GIA BIÊN TẬP HÌNH ẢNH NỘI THẤT.
    
    NHIỆM VỤ: Di chuyển vật thể "${objectLabel}" từ vị trí hiện tại sang vị trí mới được đánh dấu bởi tọa độ [${normY}, ${normX}].
    
    YÊU CẦU:
    1. Xác định vật thể có nhãn "${objectLabel}" trong ảnh.
    2. Cắt/Xóa vật thể đó ở vị trí cũ và lấp đầy khoảng trống (Inpainting) sao cho tự nhiên.
    3. Đặt vật thể đó vào vị trí mới có tâm tại [${normY}, ${normX}].
    4. Giữ nguyên hình dáng, màu sắc, chất liệu và kích thước của vật thể.
    5. Đảm bảo phối cảnh, bóng đổ và ánh sáng tại vị trí mới là chính xác.
    
    TRẢ VỀ ẢNH KẾT QUẢ.
  `;

  const prompt = `Di chuyển ${objectLabel} đến vị trí tọa độ Y=${normY}, X=${normX}. Hãy lấp đầy vùng trống ở vị trí cũ một cách hoàn hảo.`;

  const imagePart = {
    inlineData: {
      data: imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64,
      mimeType: "image/jpeg",
    },
  };

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        systemInstruction: systemPrompt,
      }
    });

    if (result.candidates && result.candidates[0]?.content?.parts) {
      for (const part of result.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return `data:image/jpeg;base64,${imagePart.inlineData.data}`;
  } catch (error) {
    console.error("Relocation Error:", error);
    throw error;
  }
}

export async function retextureSpace(
  apiKey: string,
  imageBase64: string,
  targetRegion: 'wall' | 'floor' | 'ceiling',
  materialDescription: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  
  const systemPrompt = `
    BẠN LÀ CHUYÊN GIA THAY ĐỔI VẬT LIỆU NỘI THẤT (RE-TEXTURING).
    
    NHIỆM VỤ: Thay đổi vật liệu/màu sắc của vùng "${targetRegion === 'wall' ? 'Tường' : targetRegion === 'floor' ? 'Sàn' : 'Trần'}" trong ảnh.
    
    YÊU CẦU:
    1. Chỉ thay đổi vùng ${targetRegion === 'wall' ? 'Tường' : targetRegion === 'floor' ? 'Sàn' : 'Trần'}.
    2. Sử dụng vật liệu/màu sắc: ${materialDescription}.
    3. BẢO TOÀN các vật thể nội thất khác (giường, tủ, đèn...) và ánh sáng gốc.
    4. Giữ nguyên phối cảnh và cấu trúc không gian.
    
    TRẢ VỀ ẢNH KẾT QUẢ.
  `;

  const prompt = `Thay đổi ${targetRegion === 'wall' ? 'tường' : targetRegion === 'floor' ? 'sàn' : 'trần'} thành ${materialDescription}. Giữ nguyên mọi thứ khác.`;

  const imagePart = {
    inlineData: {
      data: imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64,
      mimeType: "image/jpeg",
    },
  };

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        systemInstruction: systemPrompt,
      }
    });

    if (result.candidates && result.candidates[0]?.content?.parts) {
      for (const part of result.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return `data:image/jpeg;base64,${imagePart.inlineData.data}`;
  } catch (error) {
    console.error("Retexture Error:", error);
    throw error;
  }
}

export async function renderCameraAngle(
  apiKey: string, 
  imageBase64: string, 
  rotation: number, 
  tilt: number, 
  zoom: number
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  
  const systemPrompt = `
    BẠN LÀ CHUYÊN GIA RENDER 3D VÀ XỬ LÝ ẢNH CHUYÊN SÂU.
    
    NHIỆM VỤ: Render lại hình ảnh hiện có từ một GÓC NHÌN CAMERA MỚI.
    
    YÊU CẦU BẮT BUỘC (QUY TẮC 100%):
    1. BẢO TOÀN ĐỐI TƯỢNG: Giữ nguyên 100% tất cả các đồ vật, màu sắc, chất liệu và cấu trúc nội thất từ ảnh gốc. KHÔNG THÊM, KHÔNG BỚT, KHÔNG THAY THẾ đồ vật.
    2. THAY ĐỔI GÓC NHÌN (3D PERSPECTIVE):
       - XOAY (ROTATION): ${rotation} độ.
       - NGHIÊNG (TILT): ${tilt} độ.
       - PHÓNG (ZOOM): ${zoom}x.
    3. TÍNH CHÂN THỰC: Đảm bảo phối cảnh 3D, ánh sáng và bóng đổ thay đổi tương ứng với góc máy mới một cách tự nhiên.
    4. CHẤT LƯỢNG: Ảnh đầu ra phải là ảnh thực tế (Photorealistic), độ phân giải cao.
  `;

  const prompt = "Hãy render lại không gian này với góc máy mới: Xoay " + rotation + " độ, Nghiêng " + tilt + " độ, Phóng " + zoom + "x. Đảm bảo mọi đồ vật giữ nguyên vị trí và cấu trúc cũ.";

  const imagePart = {
    inlineData: {
      data: imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64,
      mimeType: "image/jpeg",
    },
  };

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        systemInstruction: systemPrompt,
      }
    });

    if (result.candidates && result.candidates[0]?.content?.parts) {
      for (const part of result.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    // Fallback if no image returned
    return `data:image/jpeg;base64,${imagePart.inlineData.data}`;
  } catch (error) {
    console.error("Camera Angle Render Error:", error);
    throw error;
  }
}

export interface ScannedInvoiceItem {
  code: string;
  name: string;
  unit: string;
  quantity: number;
}

export async function scanInvoice(
  apiKey: string,
  imageBase64: string
): Promise<ScannedInvoiceItem[]> {
  const ai = new GoogleGenAI({ apiKey });
  
  const systemPrompt = `
    BẠN LÀ TRỢ LÝ AI CHUYÊN SÂU VỀ XỬ LÝ ẢNH HOÁ ĐƠN, PHIẾU XUẤT KHO.
    
    NHIỆM VỤ: Trích xuất toàn bộ danh sách các mặt hàng từ bảng hàng hoá trong hình ảnh phiếu xuất kho hoặc hoá đơn.
    
    YÊU CẦU:
    1. Xác định bảng chứa thông tin hàng hoá.
    2. Trích xuất chính xác các cột: "Mã hàng", "Tên hàng", "Đơn vị" (Đơn vị tính), "Số lượng".
    3. Định dạng kết quả trả về dưới dạng JSON Array hợp lệ.
    4. KHÔNG tự bịa mã hàng, nếu cột "Mã hàng" trống hãy bỏ qua hoặc trả về chuỗi rỗng.
    5. Cột số lượng phải là một số (number). Nếu số lượng là "1,00" hãy chuyển thành 1.
    
    Định dạng đầu ra JSON bắt buộc:
    [
      {
        "code": "Mã hàng hoá (ví dụ: AT_4024)",
        "name": "Tên hàng hoá (ví dụ: Ecoplast_ Màu Trắng ( 400 * 15 * 2400 ))",
        "unit": "Đơn vị tính (ví dụ: Hộp)",
        "quantity": Số lượng (ví dụ: 1)
      }
    ]
  `;

  const prompt = "Hãy trích xuất danh sách mặt hàng từ bảng hoá đơn này theo định dạng JSON yêu cầu.";

  const imagePart = {
    inlineData: {
      data: imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64,
      mimeType: "image/jpeg",
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [imagePart, { text: prompt }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "[]";
    const items = JSON.parse(responseText) as ScannedInvoiceItem[];
    return items;
  } catch (error) {
    console.error("Scan Invoice Error:", error);
    throw error;
  }
}
