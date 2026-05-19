import fs from 'fs';
import path from 'path';

function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, fileList);
    } else if (filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function replaceColors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  content = content.replace(/border-\[#eaeaea\]/g, 'border-border');
  content = content.replace(/\bbg-white\b/g, 'bg-card text-card-foreground');
  content = content.replace(/bg-\[#f9fafb\]/g, 'bg-muted');
  content = content.replace(/hover:bg-\[#f9fafb\]/g, 'hover:bg-muted');
  content = content.replace(/hover:bg-\[#f8f9fa\]/g, 'hover:bg-muted');
  content = content.replace(/border-\[#f0f0f0\]/g, 'border-border');
  content = content.replace(/bg-\[#fafafa\]/g, 'bg-background');
  content = content.replace(/text-\[#333333\]/g, 'text-foreground');
  content = content.replace(/text-gray-900/g, 'text-foreground');
  content = content.replace(/text-gray-800/g, 'text-foreground');
  
  if (original !== content) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed', filePath);
  }
}

const allTsxFiles = findFiles('src/');
allTsxFiles.forEach(replaceColors);
