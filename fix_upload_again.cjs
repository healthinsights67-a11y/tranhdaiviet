const fs = require('fs');
const file = 'src/components/documents/ProductDocuments.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `  const compressImage = (file: File): Promise<File> => {
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
          const processedFile = file.type.startsWith('image/') ? await compressImage(file) : file;
          // Use a random string + index to ensure uniqueness even if Date.now() is identical
          const uniqueId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9) + '_' + index;
          const safeName = processedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const fileRef = ref(storage, \`product_documents/\${selectedFolder.id}/\${uniqueId}_\${safeName}\`);
          await uploadBytes(fileRef, processedFile);
          const url = await getDownloadURL(fileRef);
          
          await addDoc(collection(db, 'product_documents'), {
            folderId: selectedFolder.id,
            name: processedFile.name,
            url,
            type: processedFile.type,
            size: processedFile.size,
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
        toast.success(\`Đã tải lên thành công \${successCount}/\${files.length} tài liệu\`);
      } else {
        toast.error('Không thể tải lên tài liệu nào');
      }
    } catch (error: any) {
      toast.error('Lỗi tải file: ' + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };`;

if (content.includes('const compressImage = (file: File): Promise<File> => {') && content.includes('const handleFileUpload = async')) {
  content = content.replace(/  const compressImage = \(file: File\): Promise<File> => \{[\s\S]*?if \(fileInputRef\.current\) fileInputRef\.current\.value = '';\n    \}\n  \};/, replacement);
  fs.writeFileSync(file, content);
  console.log('Fixed upload logic');
} else {
  console.log('Could not find functions');
}
