// generate-icons.js - DSinet 아이콘 생성 스크립트 (sharp 사용)
// Usage: node generate-icons.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sizes = [32, 48, 64, 128, 192, 256, 512];
const publicDir = path.join(__dirname, 'public');
const svgPath = path.join(publicDir, 'dsinet-icon.svg');

async function generateIcons() {
  for (const size of sizes) {
    const outputPath = path.join(publicDir, `app-icon-${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`✓ app-icon-${size}.png (${size}x${size})`);
  }

  // favicon용 ICO 대체 (32x32 PNG를 app-icon.ico로)
  // ICO는 sharp가 지원하지 않으므로 32px PNG를 복사
  const favicon32 = path.join(publicDir, 'app-icon-32.png');
  fs.copyFileSync(favicon32, path.join(publicDir, 'favicon.png'));
  console.log('✓ favicon.png');

  // SVG도 app-icon.svg로 복사
  fs.copyFileSync(svgPath, path.join(publicDir, 'app-icon.svg'));
  console.log('✓ app-icon.svg updated');

  console.log('\n모든 아이콘이 생성되었습니다!');
}

generateIcons().catch(console.error);
