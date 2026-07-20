const fs = require('fs');
const https = require('https');
const path = require('path');

const piecesDir = path.join(__dirname, '..', 'public', 'assets', 'pieces');
if (!fs.existsSync(piecesDir)) fs.mkdirSync(piecesDir, { recursive: true });

const pieces = ['wP','wN','wB','wR','wQ','wK','bP','bN','bB','bR','bQ','bK'];

// We fetch official Lichess SVG pieces. For offline reliability, we write a minimal SVG fallback if fetch fails.
function fetchPiece(name) {
  const url = `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/${name}.svg`;
  https.get(url, (res) => {
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