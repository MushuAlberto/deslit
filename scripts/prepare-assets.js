import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'sda');
const destDir = path.join(process.cwd(), 'public', 'sda');

if (fs.existsSync(srcDir)) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    
    const stat = fs.statSync(srcPath);
    if (stat.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${file} to public/sda/`);
    }
  }
} else {
  console.log('sda directory not found, skipping copy.');
}
