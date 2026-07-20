$pieces = @('wP','wN','wB','wR','wQ','wK','bP','bN','bB','bR','bQ','bK')
$dir = 'public/assets/pieces'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
foreach ($p in $pieces) {
    $color = if ($p[0] -eq 'w') { '#f0d9b5' } else { '#b58863' }
    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="$color" stroke="#000" stroke-width="1.5"><circle cx="22.5" cy="22.5" r="18" fill-opacity="0.85"/><text x="22.5" y="29" text-anchor="middle" font-family="serif" font-size="22" font-weight="bold" fill="#fff" stroke="none">$($p[1])</text></g></svg>
"@
    Set-Content -Path "$dir/$p.svg" -Value $svg
    Write-Host "Created $p"
}
