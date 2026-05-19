import React from 'react';
import { X } from 'lucide-react';

const AddLinkModal = ({ onClose, onSave }: { onClose: () => void, onSave: () => void }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {/* Modal chính - Tăng padding toàn bộ lên p-8 */}
      <div className="w-full max-w-md bg-card text-card-foreground rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 p-8">
        
        {/* Header - Có khoảng cách rõ ràng với lề */}
        <div className="relative mb-8">
          <button 
            onClick={onClose}
            className="absolute -right-2 -top-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
          >
            <X size={24} />
          </button>
          
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">
            Thêm liên kết mới
          </h2>
          <p className="text-gray-500 font-medium">
            Dán đường dẫn OneDrive hoặc Google Drive vào đây.
          </p>
        </div>

        {/* Body - Các ô nhập liệu */}
        <div className="space-y-6">
          {/* Input Tên thư mục */}
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-bold text-blue-600 uppercase tracking-wider px-1">
              Tên thư mục
            </label>
            <input 
              type="text"
              placeholder="VD: Dự án Vinhomes 2024"
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-slate-700 placeholder:text-gray-300 focus:border-blue-500 focus:bg-card text-card-foreground outline-none transition-all"
            />
          </div>

          {/* Input Đường dẫn */}
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-bold text-blue-600 uppercase tracking-wider px-1">
              Đường dẫn (URL)
            </label>
            <input 
              type="url"
              placeholder="https://..."
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-slate-700 placeholder:text-gray-300 focus:border-blue-500 focus:bg-card text-card-foreground outline-none transition-all"
            />
          </div>
        </div>

        {/* Footer - Nút bấm */}
        <div className="mt-10 flex items-center justify-between gap-4">
          <button 
            onClick={onClose}
            className="text-gray-500 font-bold hover:text-gray-700 px-4 py-2"
          >
            Hủy bỏ
          </button>
          
          {/* NÚT LƯU - Dùng inline style để ép màu chữ trắng 100% */}
          <button 
            onClick={onSave}
            style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
            className="flex-1 py-4 px-6 rounded-2xl font-bold text-lg shadow-xl shadow-blue-100 hover:bg-slate-800 transition-all active:scale-95"
          >
            Lưu liên kết
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddLinkModal;
