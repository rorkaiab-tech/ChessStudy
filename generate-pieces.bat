@echo off
mkdir public\assets\pieces 2>nul

set URL=https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett

curl -L %URL%/wP.svg -o public\assets\pieces\wP.svg
curl -L %URL%/wN.svg -o public\assets\pieces\wN.svg
curl -L %URL%/wB.svg -o public\assets\pieces\wB.svg
curl -L %URL%/wR.svg -o public\assets\pieces\wR.svg
curl -L %URL%/wQ.svg -o public\assets\pieces\wQ.svg
curl -L %URL%/wK.svg -o public\assets\pieces\wK.svg

curl -L %URL%/bP.svg -o public\assets\pieces\bP.svg
curl -L %URL%/bN.svg -o public\assets\pieces\bN.svg
curl -L %URL%/bB.svg -o public\assets\pieces\bB.svg
curl -L %URL%/bR.svg -o public\assets\pieces\bR.svg
curl -L %URL%/bQ.svg -o public\assets\pieces\bQ.svg
curl -L %URL%/bK.svg -o public\assets\pieces\bK.svg

echo Done
pause