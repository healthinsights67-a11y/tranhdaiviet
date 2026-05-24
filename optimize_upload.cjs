const fs = require('fs');
const file = 'src/components/documents/ProductDocuments.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
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
          }, 'image/jpeg', 0.8); // 80% quality
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !selectedFolder) return;

    setIsUploading(true);
    let successCount = 0;
    try {
      // Create a function to process a single file
      const uploadFile = async (file: File) => {
        try {
          const processedFile = file.type.startsWith('image/') ? await compressImage(file) : file;
          const fileRef = ref(storage, \`product_documents/\${selectedFolder.id}/\${Date.now()}_\${processedFile.name}\`);
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

      // Upload in chunks of 5 to avoid memory/network issues
      const chunkSize = 5;
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        const results = await Promise.all(chunk.map(f => uploadFile(f)));
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

// Find where handleFileUpload is
if (content.includes('const handleFileUpload = async')) {
  content = content.replace(/  const handleFileUpload = async \([\s\S]*?if \(fileInputRef\.current\) fileInputRef\.current\.value = '';\n    \}\n  \};/, replacement);
  fs.writeFileSync(file, content);
  console.log('Fixed handleFileUpload');
} else {
  console.log('Could not find handleFileUpload');
}
