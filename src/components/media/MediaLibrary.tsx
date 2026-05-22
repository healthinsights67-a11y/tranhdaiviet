import * as React from 'react';
import { MediaFolder } from '@/src/types';
import { 
  Folder, 
  ExternalLink, 
  Plus, 
  Search, 
  Trash2, 
  MoreVertical,
  FileImage,
  HardDrive,
  Upload,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  LayoutGrid,
  Maximize2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { db, collection, addDoc, deleteDoc, doc, handleFirestoreError, OperationType, onSnapshot, query, where, orderBy } from '@/src/lib/firebase';
import { getVNTimestamp } from '@/src/lib/utils';
import { ImagePreviewDialog } from '@/src/components/ui/ImagePreviewDialog';
import { uploadToImgBB } from '@/src/services/uploadService';
import { moveToTrash } from '@/src/services/trashService';

interface MediaLibraryProps {
  folders: MediaFolder[];
  user?: any;
}

const CATEGORIES = [
  { id: 'tu-bep', name: 'Tủ Bếp', icon: 'Kitchen' },
  { id: 'tu-ao', name: 'Tủ Áo', icon: 'Wardrobe' },
  { id: 'combo-phong-ngu', name: 'Combo Phòng Ngủ', icon: 'Bed' },
  { id: 'ke-tivi', name: 'Kệ Tivi', icon: 'Tv' },
  { id: 'ban-lam-viec', name: 'Bàn Làm Việc', icon: 'Monitor' },
  { id: 'san-pham-khac', name: 'Sản Phẩm Khác', icon: 'Package' },
];

export function MediaLibrary({ folders, user }: MediaLibraryProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isAddFolderDialogOpen, setIsAddFolderDialogOpen] = React.useState(false);
  const [isAddLinkDialogOpen, setIsAddLinkDialogOpen] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [images, setImages] = React.useState<any[]>([]);
  const [isLoadingImages, setIsLoadingImages] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [previewImageIndex, setPreviewImageIndex] = React.useState<number | null>(null);
  const [allImages, setAllImages] = React.useState<any[]>([]);
  
  const [newFolder, setNewFolder] = React.useState({
    name: '',
    link: '',
  });

  // Fetch all images once for counting badges
  React.useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'media_library'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllImages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch images for selected category
  React.useEffect(() => {
    if (!selectedCategory || !user) {
      setImages([]);
      return;
    }

    setIsLoadingImages(true);
    const q = query(
      collection(db, 'media_library'), 
      where('categoryId', '==', selectedCategory),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setImages(data);
      setIsLoadingImages(false);
    }, (error) => {
      console.error("Error fetching images:", error);
      setIsLoadingImages(false);
    });

    return () => unsubscribe();
  }, [selectedCategory, user]);

  const getCategoryImageCount = (catId: string) => {
    return allImages.filter(img => img.categoryId === catId).length;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !selectedCategory) return;

    setIsUploading(true);
    const toastId = toast.loading(`Đang tải lên ${files.length} ảnh...`);
    let successCount = 0;
    try {
      const categoryName = CATEGORIES.find(c => c.id === selectedCategory)?.name || 'KHAC';
      const cleanCategoryName = categoryName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '_').toUpperCase();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imageUrl = await uploadToImgBB(file);
        if (imageUrl) {
          const fileName = `${cleanCategoryName}_${getVNTimestamp()}_${i+1}`;
          await addDoc(collection(db, 'media_library'), {
            categoryId: selectedCategory,
            url: imageUrl,
            title: fileName,
            createdAt: new Date().toISOString()
          });
          successCount++;
        }
      }
      toast.dismiss(toastId);
      if (successCount > 0) {
        toast.success(`Đã tải lên ${successCount}/${files.length} ảnh thành công!`);
      } else {
        toast.error('Không thể tải lên ảnh nào.');
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('Có lỗi xảy ra khi tải ảnh lên');
    } finally {
      setIsUploading(false);
      // Reset input
      if (e.target) e.target.value = '';
    }
  };

  // Remove local uploadToImgBB as we use the service now


  const handleDeleteImage = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa ảnh này?")) return;
    try {
      if (user) {
        const image = images.find(img => img.id === id);
        const title = image ? `Ảnh thư viện: ${image.name || id}` : id;
        await moveToTrash('media_library', id, title, user.email || '');
      } else {
        await deleteDoc(doc(db, 'media_library', id));
      }
      toast.success("Đã xóa ảnh");
    } catch (error: any) {
      toast.error("Lỗi xóa ảnh");
    }
  };

  const handleAddFolder = async () => {
    if (!newFolder.name || !newFolder.link) {
      toast.error("Yêu cầu nhập đủ thông tin");
      return;
    }
    try {
      await addDoc(collection(db, 'media_folders'), { ...newFolder, createdAt: new Date().toISOString() });
      toast.success("Đã lưu liên kết");
      setIsAddFolderDialogOpen(false);
      setNewFolder({ name: '', link: '' });
    } catch (error) {
      toast.error("Lỗi khi lưu");
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  const handleDeleteFolder = async (id: string) => {
    try {
      if (user) {
        const folder = folders.find(f => f.id === id);
        const title = folder ? `Thư mục Drive: ${folder.name}` : id;
        await moveToTrash('media_folders', id, title, user.email || '');
      } else {
        await deleteDoc(doc(db, 'media_folders', id));
      }
      toast.success("Đã xóa liên kết");
      setDeleteConfirmId(null);
    } catch (error) {
      toast.error("Lỗi khi xóa");
    }
  };

  const filteredFolders = folders.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-20">
      {/* SaaS Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {selectedCategory && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-full bg-gray-50 hover:bg-gray-100" 
                onClick={() => setSelectedCategory(null)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {selectedCategory 
                ? CATEGORIES.find(c => c.id === selectedCategory)?.name 
                : "Thư viện ảnh"}
            </h1>
          </div>
          <p className="text-slate-500 font-medium text-sm ml-1">
            {selectedCategory ? "Dữ liệu điện toán đám mây đồng bộ với ImgBB" : "Quản lý dữ liệu media tập trung cho doanh nghiệp."}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {!selectedCategory ? (
            <>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Tìm kiếm liên kết..." 
                  className="pl-10 h-10 border-gray-200 bg-gray-50 focus:bg-card text-card-foreground transition-all text-sm rounded-xl" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Dialog open={isAddFolderDialogOpen} onOpenChange={setIsAddFolderDialogOpen}>
                <DialogTrigger 
                  render={
                    <Button variant="outline" className="h-10 gap-2 px-5 rounded-xl text-sm font-bold border-slate-200 hover:bg-slate-50 transition-all active:scale-95">
                      <Plus className="h-4 w-4" />
                      Thêm thư mục
                    </Button>
                  }
                />
                <DialogContent className="sm:max-w-[420px] rounded-3xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Thêm thư mục mới</DialogTitle>
                    <DialogDescription>Nhập tên thư mục mới.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tên thư mục</Label>
                      <Input
                        className="h-11 rounded-xl"
                        placeholder="VD: Dự án nội thất mới"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" className="h-11 rounded-xl font-bold" onClick={() => setIsAddFolderDialogOpen(false)}>Hủy bỏ</Button>
                    <Button className="h-11 rounded-xl font-bold px-8 bg-slate-900">Lưu thư mục</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddLinkDialogOpen} onOpenChange={setIsAddLinkDialogOpen}>
                <DialogTrigger 
                  render={
                    <Button className="h-10 gap-2 px-5 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all active:scale-95">
                      <Plus className="h-4 w-4" />
                      Thêm link
                    </Button>
                  }
                />
                <DialogContent className="sm:max-w-[420px] rounded-3xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Thêm liên kết mới</DialogTitle>
                    <DialogDescription>Dán đường dẫn OneDrive hoặc Google Drive vào đây.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tên thư mục</Label>
                      <Input
                        value={newFolder.name}
                        className="h-11 rounded-xl"
                        onChange={(e) => setNewFolder({ ...newFolder, name: e.target.value })}
                        placeholder="VD: Dự án Vinhomes 2024"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Đường dẫn (URL)</Label>
                      <Input
                        value={newFolder.link}
                        className="h-11 rounded-xl font-mono text-xs"
                        onChange={(e) => setNewFolder({ ...newFolder, link: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" className="h-11 rounded-xl font-bold" onClick={() => setIsAddLinkDialogOpen(false)}>Hủy bỏ</Button>
                    <Button onClick={handleAddFolder} className="h-11 rounded-xl font-bold px-8 bg-slate-900">Lưu liên kết</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <input type="file" id="image-upload" className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
              <Button 
                disabled={isUploading}
                className="h-10 gap-2 px-6 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-100"
                onClick={() => !isUploading && document.getElementById('image-upload')?.click()}
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isUploading ? "Đang xử lý..." : "Tải ảnh lên"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!selectedCategory ? (
          <motion.div 
            key="folders"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-12"
          >
            {/* Cloud Categories */}
            <div className="space-y-6">
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                 <LayoutGrid className="h-3 w-3" />
                 Hệ thống ImgBB Cloud
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                {CATEGORIES.map((cat, i) => {
                  const count = getCategoryImageCount(cat.id);
                  return (
                    <motion.div key={cat.id} whileHover={{ y: -4 }}>
                      <Card 
                        className="group relative cursor-pointer border-border shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 overflow-hidden bg-card text-card-foreground h-32 flex flex-col justify-center px-8"
                        onClick={() => setSelectedCategory(cat.id)}
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 bg-slate-50 rounded-full group-hover:bg-blue-50 transition-colors duration-500 flex items-end justify-start p-10">
                           <ImageIcon className="h-8 w-8 text-slate-200 group-hover:text-blue-200 transition-colors" />
                        </div>
                        
                        <div className="relative z-10 space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{cat.name}</h3>
                            <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold">
                              {count} ảnh
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Nhấn để truy cập bộ sưu tập</p>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* External Links Section */}
            <div className="space-y-6">
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                 <ExternalLink className="h-3 w-3" />
                 Lưu trữ bên thứ ba
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {/* System Card */}
                <Card className="p-6 border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-3 opacity-60 grayscale hover:grayscale-0 transition-all">
                  <HardDrive className="h-7 w-7 text-slate-400" />
                  <div>
                    <h3 className="text-[11px] font-black text-slate-600 uppercase">System Storage</h3>
                    <p className="text-[9px] text-slate-400 font-bold mt-1">INTERNAL ASSETS</p>
                  </div>
                </Card>

                {filteredFolders.map((folder, i) => (
                  <motion.div key={folder.id} whileHover={{ y: -4 }}>
                    <Card className="group relative p-6 border-slate-200 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/50 transition-all duration-300 flex flex-col justify-between h-52 bg-card text-card-foreground">
                      
                      <div className="flex justify-between items-start">
                        <div className="p-2.5 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                          <Folder className="h-5 w-5" />
                        </div>
                        
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          {deleteConfirmId === folder.id ? (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="destructive" className="h-6 text-[8px] px-2 font-bold rounded-lg" onClick={() => handleDeleteFolder(folder.id)}>Xóa</Button>
                              <Button size="sm" variant="ghost" className="h-6 text-[8px] px-2 font-bold rounded-lg" onClick={() => setDeleteConfirmId(null)}>Hủy</Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-300 hover:text-destructive transition-colors" onClick={() => setDeleteConfirmId(folder.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-2 min-h-[32px]">{folder.name}</h3>
                          <div className="flex items-center gap-1.5 mt-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">OneDrive Cloud</span>
                          </div>
                        </div>
                        
                        <Button 
                          className="w-full h-9 rounded-xl bg-slate-50 hover:bg-slate-900 group-hover:text-white text-slate-600 font-bold text-[10px] uppercase gap-2 transition-all border-none"
                          onClick={() => window.open(folder.link, '_blank')}
                        >
                          Truy cập kho
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="category-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-blue-600 rounded-full" />
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                  {images.length} KẾT QUẢ TÌM THẤY
                </h2>
              </div>
            </div>

            {isLoadingImages ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tải dữ liệu cloud...</p>
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 bg-slate-50/50 rounded-[40px] border-2 border-dashed border-slate-200">
                <div className="p-6 rounded-full bg-card text-card-foreground shadow-sm mb-6">
                  <ImageIcon className="h-10 w-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Thư mục hiện tại đang trống</h3>
                <p className="text-[10px] text-slate-400 mt-2 font-black uppercase tracking-widest">Hãy bắt đầu bằng việc tải một bức ảnh lên hệ thống</p>
                <Button 
                  className="mt-8 h-12 px-8 rounded-2xl bg-blue-600 font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100"
                  onClick={() => document.getElementById('image-upload')?.click()}
                >
                  <Plus className="h-4 w-4 mr-2" /> Thêm ảnh ngay
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {images.map((img, i) => (
                  <motion.div
                    key={img.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div className="group relative aspect-[4/5] rounded-[28px] overflow-hidden bg-card text-card-foreground border-2 border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-100 transition-all duration-500 cursor-pointer" onClick={() => setPreviewImageIndex(i)}>
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-between p-4">
                        <div className="flex justify-end gap-2">
                           <Button size="icon" variant="secondary" className="h-9 w-9 rounded-xl bg-card text-card-foreground border-0 text-foreground hover:bg-gray-100" onClick={() => setPreviewImageIndex(i)}>
                             <Maximize2 className="h-4 w-4" />
                           </Button>
                           <Button size="icon" variant="destructive" className="h-9 w-9 rounded-xl bg-red-500 border-0 text-white hover:bg-red-600" onClick={() => handleDeleteImage(img.id)}>
                             <Trash2 className="h-4 w-4" />
                           </Button>
                        </div>
                        
                        <div className="space-y-1 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                          <p className="text-[11px] text-white font-black uppercase tracking-tight line-clamp-2 leading-tight">{img.name}</p>
                          <p className="text-[9px] text-white/60 font-bold">{new Date(img.createdAt).toLocaleDateString('vi-VN')}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>


      <ImagePreviewDialog 
        isOpen={previewImageIndex !== null} 
        imageUrl={previewImageIndex !== null ? images[previewImageIndex].url : null} 
        allImages={images.map(img => img.url)}
        currentIdx={previewImageIndex !== null ? previewImageIndex : 0}
        onNavigate={(idx) => setPreviewImageIndex(idx)}
        onClose={() => setPreviewImageIndex(null)} 
      />
    </div>
  );
}
