import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, onSnapshot, query, deleteDoc, doc, storage, ref, uploadBytes, getDownloadURL, deleteObject, orderBy, where, serverTimestamp } from '@/src/lib/firebase';
import { 
  Folder, Plus, File as FileIcon, FileText, Image as ImageIcon, Trash2, X, Download, UploadCloud, ChevronLeft, Search, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { uploadToImgBB } from '../../services/uploadService';

interface DocumentFolder {
  id: string;
  name: string;
  createdAt: any;
}

interface ProductDocument {
  id: string;
  folderId: string;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: any;
}

export const ProductDocuments = () => {
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<DocumentFolder | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'product_document_folders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setFolders(snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentFolder)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedFolder) return;
    const q = query(
      collection(db, 'product_documents'),
      where('folderId', '==', selectedFolder.id),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductDocument)));
    });
    return () => unsub();
  }, [selectedFolder]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await addDoc(collection(db, 'product_document_folders'), {
        name: newFolderName.trim(),
        createdAt: serverTimestamp()
      });
      setNewFolderName('');
      setIsCreatingFolder(false);
      toast.success('Tạo thư mục thành công');
    } catch (error: any) {
      toast.error('Lỗi tạo thư mục: ' + error.message);
    }
  };

  const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa thư mục này và TOÀN BỘ tài liệu bên trong?')) return;
    try {
      // Find all docs in this folder
      const docsInFolder = documents.filter(d => d.folderId === folderId);
      // Delete from storage
      for (const d of docsInFolder) {
        try {
          const fileRef = ref(storage, d.url);
          await deleteObject(fileRef);
          await deleteDoc(doc(db, 'product_documents', d.id));
        } catch(e) { console.warn(e); }
      }
      await deleteDoc(doc(db, 'product_document_folders', folderId));
      if (selectedFolder?.id === folderId) setSelectedFolder(null);
      toast.success('Đã xóa thư mục');
    } catch (error: any) {
      toast.error('Lỗi xóa thư mục: ' + error.message);
    }
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.8);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      
      img.src = objectUrl;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !selectedFolder) return;

    setIsUploading(true);
    let successCount = 0;
    try {
      const uploadFile = async (file: File, index: number) => {
        try {
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const isImage = file.type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
          
          let url = '';
          let type = file.type || '';
          let size = file.size;

          if (isImage) {
            // Try uploading to ImgBB first
            const imgbbUrl = await uploadToImgBB(file);
            if (imgbbUrl) {
              url = imgbbUrl;
              type = file.type || 'image/jpeg';
            }
          }

          // Fallback to Firebase Storage if not an image or if ImgBB upload failed
          if (!url) {
            const isCompressibleImage = file.type?.startsWith('image/') && ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
            const processedFile = isCompressibleImage ? await compressImage(file) : file;
            const uniqueId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9) + '_' + index;
            const safeName = processedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const fileRef = ref(storage, `product_documents/${selectedFolder.id}/${uniqueId}_${safeName}`);
            await uploadBytes(fileRef, processedFile);
            url = await getDownloadURL(fileRef);
            type = processedFile.type;
            size = processedFile.size;
          }
          
          await addDoc(collection(db, 'product_documents'), {
            folderId: selectedFolder.id,
            name: file.name,
            url,
            type,
            size,
            createdAt: serverTimestamp()
          });
          return true;
        } catch (err) {
          console.error("Error uploading file:", err);
          return false;
        }
      };

      const chunkSize = 3; // Reduced chunk size to 3 for stability on weaker devices
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        const results = await Promise.all(chunk.map((f, idx) => uploadFile(f, i + idx)));
        successCount += results.filter(Boolean).length;
      }
      
      if (successCount > 0) {
        toast.success(`Đã tải lên thành công ${successCount}/${files.length} tài liệu`);
      } else {
        toast.error('Không thể tải lên tài liệu nào');
      }
    } catch (error: any) {
      toast.error('Lỗi tải file: ' + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (docObj: ProductDocument) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu này?')) return;
    try {
      const fileRef = ref(storage, docObj.url);
      await deleteObject(fileRef).catch(e => console.warn('Storage delete error:', e));
      await deleteDoc(doc(db, 'product_documents', docObj.id));
      toast.success('Đã xóa tài liệu');
    } catch (error: any) {
      toast.error('Lỗi xóa tài liệu: ' + error.message);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileMeta = (name: string, type: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    
    if (type.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return {
        icon: <ImageIcon className="h-10 w-10 text-sky-500" />,
        typeName: ext.toUpperCase() || 'IMAGE'
      };
    }
    if (ext === 'pdf' || type.includes('pdf')) {
      return {
        icon: <FileText className="h-10 w-10 text-rose-500" />,
        typeName: 'PDF'
      };
    }
    if (['doc', 'docx'].includes(ext) || type.includes('word') || type.includes('msword')) {
      return {
        icon: <FileText className="h-10 w-10 text-blue-600" />,
        typeName: ext.toUpperCase() || 'WORD'
      };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext) || type.includes('excel') || type.includes('sheet') || type.includes('csv')) {
      return {
        icon: <FileText className="h-10 w-10 text-emerald-600" />,
        typeName: ext.toUpperCase() || 'EXCEL'
      };
    }
    if (['ppt', 'pptx'].includes(ext) || type.includes('powerpoint') || type.includes('presentation')) {
      return {
        icon: <FileText className="h-10 w-10 text-orange-500" />,
        typeName: ext.toUpperCase() || 'POWERPOINT'
      };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || type.includes('zip') || type.includes('compressed')) {
      return {
        icon: <FileIcon className="h-10 w-10 text-amber-500" />,
        typeName: ext.toUpperCase() || 'ARCHIVE'
      };
    }
    if (['txt', 'md'].includes(ext) || type.includes('text')) {
      return {
        icon: <FileText className="h-10 w-10 text-slate-500" />,
        typeName: ext.toUpperCase() || 'TEXT'
      };
    }
    if (['cad', 'dwg', 'dxf'].includes(ext)) {
      return {
        icon: <FileIcon className="h-10 w-10 text-indigo-500" />,
        typeName: ext.toUpperCase() || 'CAD'
      };
    }
    return {
      icon: <FileIcon className="h-10 w-10 text-gray-400" />,
      typeName: ext.toUpperCase() || 'FILE'
    };
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Sidebar Folders */}
      <div className={`${selectedFolder ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-64 border-r bg-card/50`}>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Thư mục Tài liệu</h2>
          <Button variant="ghost" size="icon" onClick={() => setIsCreatingFolder(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {folders.map(folder => (
            <div 
              key={folder.id}
              onClick={() => setSelectedFolder(folder)}
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${selectedFolder?.id === folder.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <Folder className={`h-5 w-5 shrink-0 ${selectedFolder?.id === folder.id ? 'fill-primary/20 text-primary' : 'text-muted-foreground'}`} />
                <span className="truncate font-medium text-sm">{folder.name}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive" onClick={(e) => handleDeleteFolder(folder.id, e)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {folders.length === 0 && (
            <div className="text-center p-4 text-sm text-muted-foreground">Chưa có thư mục nào</div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={`${!selectedFolder ? 'hidden md:flex items-center justify-center' : 'flex'} flex-1 flex-col`}>
        {!selectedFolder ? (
          <div className="text-center text-muted-foreground">
            <Folder className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p>Chọn một thư mục để xem tài liệu</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedFolder(null)}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <Folder className="h-5 w-5 fill-primary/20 text-primary" />
                    {selectedFolder.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">{documents.length} tài liệu</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative hidden sm:block">
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Tìm tài liệu..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-9 bg-secondary border-none"
                  />
                </div>
                <div>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="h-9 gap-2">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    <span className="hidden sm:inline">Tải lên</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 relative block sm:hidden">
                <Search className="absolute left-6 top-6 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Tìm tài liệu..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 bg-secondary border-none w-full"
                />
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-secondary/20">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {documents.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).map(doc => (
                  <div key={doc.id} className="group bg-card rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col relative">
                    <div className="aspect-square bg-muted/30 flex items-center justify-center p-4 relative overflow-hidden">
                      {doc.type.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(doc.name.split('.').pop()?.toLowerCase() || '') ? (
                        <img src={doc.url} alt={doc.name} className="w-full h-full object-cover rounded-md" />
                      ) : (
                        getFileMeta(doc.name, doc.type).icon
                      )}
                      
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                         <a href={doc.url} target="_blank" rel="noreferrer" className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors">
                           <Download className="h-4 w-4" />
                         </a>
                         <button onClick={() => handleDeleteDocument(doc)} className="p-2 bg-red-500/80 hover:bg-red-600 rounded-full text-white backdrop-blur-sm transition-colors">
                           <Trash2 className="h-4 w-4" />
                         </button>
                      </div>
                    </div>
                    <div className="p-3 flex flex-col justify-between flex-1">
                      <p className="text-sm font-medium line-clamp-2" title={doc.name}>{doc.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">{formatSize(doc.size)} • {getFileMeta(doc.name, doc.type).typeName}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {documents.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                  <UploadCloud className="h-16 w-16 mb-4" />
                  <p>Kéo thả hoặc nhấn Tải lên để thêm tài liệu</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Dialog open={isCreatingFolder} onOpenChange={setIsCreatingFolder}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Tạo thư mục mới</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Tên thư mục..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingFolder(false)}>Hủy</Button>
            <Button onClick={handleCreateFolder}>Tạo thư mục</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
