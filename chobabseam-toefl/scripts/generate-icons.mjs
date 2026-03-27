import sharp from 'sharp'
import { readFileSync } from 'fs'

const sizes = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512]
const source = './scripts/icon-source.png'

for (const size of sizes) {
  await sharp(source)
    .resize(size, size)
    .png()
    .toFile(`./public/icons/icon-${size}x${size}.png`)
  console.log(`✓ icon-${size}x${size}.png`)
}

// Apple touch icon
await sharp(source).resize(180, 180).png().toFile('./public/apple-touch-icon.png')
// Favicon
await sharp(source).resize(32, 32).png().toFile('./public/favicon.png')
console.log('✓ 모든 아이콘 생성 완료!')
