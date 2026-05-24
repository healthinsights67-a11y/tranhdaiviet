const fs = require('fs');
const file = 'src/components/documents/ProductDocuments.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace File from lucide-react with FileIcon
content = content.replace(/Folder, Plus, File, FileText, Image as ImageIcon/, 'Folder, Plus, File as FileIcon, FileText, Image as ImageIcon');
content = content.replace(/<File className="h-10 w-10 text-gray-500" \/>/, '<FileIcon className="h-10 w-10 text-gray-500" />');

fs.writeFileSync(file, content);
console.log('Fixed File shadow');
