const fs = require('fs');

// Update App.tsx
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

if (!appContent.includes('const ProductDocuments = React.lazy')) {
  appContent = appContent.replace(
    /const MediaLibrary = React\.lazy\(\(\) => import\('\.\/components\/media\/MediaLibrary'\)\.then\(module => \(\{ default: module\.MediaLibrary \}\)\)\);/,
    `const MediaLibrary = React.lazy(() => import('./components/media/MediaLibrary').then(module => ({ default: module.MediaLibrary })));
const ProductDocuments = React.lazy(() => import('./components/documents/ProductDocuments').then(module => ({ default: module.ProductDocuments })));`
  );
}

if (!appContent.includes("case 'documents':")) {
  appContent = appContent.replace(
    /      case 'media':\s*return redirect\(perms\.menuMedia\)\s*\?\s*<Dashboard[\s\S]*?\/>\s*:\s*<MediaLibrary folders=\{folders\} user=\{user\} \/>;/,
    `      case 'media':
        return redirect(perms.menuMedia)
          ? <Dashboard tasks={tasks} members={activeMembers} customers={customers} quotations={quotations} currentUser={currentMember} />
          : <MediaLibrary folders={folders} user={user} />;
      case 'documents':
        return redirect(perms.menuMedia)
          ? <Dashboard tasks={tasks} members={activeMembers} customers={customers} quotations={quotations} currentUser={currentMember} />
          : <ProductDocuments />;`
  );
}

fs.writeFileSync('src/App.tsx', appContent);
console.log('Fixed App.tsx');

// Update MobileBottomNav.tsx
let mobileNavContent = fs.readFileSync('src/components/layout/MobileBottomNav.tsx', 'utf8');

if (!mobileNavContent.includes("id: 'documents'")) {
  mobileNavContent = mobileNavContent.replace(
    /\{ id: 'media', label: 'Thư viện ảnh', icon: Image \},/,
    `{ id: 'media', label: 'Thư viện ảnh', icon: Image },
  { id: 'documents', label: 'Tài liệu', icon: Folder },`
  );

  // Add Folder to import
  if (!mobileNavContent.includes('Folder')) {
    mobileNavContent = mobileNavContent.replace(
      /import \{([\s\S]*?)Image,([\s\S]*?)\} from 'lucide-react';/,
      `import { $1Image, Folder, $2 } from 'lucide-react';`
    );
  }
}
fs.writeFileSync('src/components/layout/MobileBottomNav.tsx', mobileNavContent);
console.log('Fixed MobileBottomNav');
