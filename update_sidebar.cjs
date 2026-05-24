const fs = require('fs');
const file = 'src/components/layout/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\{ id: 'media', label: 'Thư viện ảnh', icon: Image, permission: 'menuMedia' \},/,
  `{ id: 'media', label: 'Thư viện ảnh', icon: Image, permission: 'menuMedia' },
        { id: 'documents', label: 'Tài liệu Sản Phẩm', icon: Folder, permission: 'menuMedia' },`
);

fs.writeFileSync(file, content);
console.log('Fixed Sidebar');
