import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const piecesDir = path.join(__dirname, '..', 'public', 'assets', 'pieces');
if (!fs.existsSync(piecesDir)) fs.mkdirSync(piecesDir, { recursive: true });

const pieces = ['wP','wN','wB','wR','wQ','wK','bP','bN','bB','bR','bQ','bK'];

function fetchPiece(name) {
  const url = `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/${name}.svg`;
  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      https.get(res.headers.location, (res2) => {
        let data = '';
        res2.on('data', chunk => data += chunk);
        res2.on('end', () => fs.writeFileSync(path.join(piecesDir, `${name}.svg`), data));
      }).on('error', () => console.warn('Network unavailable for piece fetch:', name));
      return;
    }
    if (res.statusCode === 200) {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => fs.writeFileSync(path.join(piecesDir, `${name}.svg`), data));
    } else {
      console.warn('Piece fetch failed for', name);
    }
  }).on('error', () => console.warn('Network unavailable for piece fetch:', name));
}

pieces.forEach(fetchPiece);
console.log('Piece fetch script executed.');
