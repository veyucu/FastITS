# AtakodITS Kurulum Script'i
# PowerShell ile calistirin

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AtakodITS Kurulum Basliyor..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Node.js kontrolu
Write-Host "[1/6] Node.js kontrol ediliyor..." -ForegroundColor Yellow
$nodeVersion = node -v 2>$null
if ($nodeVersion)
{
    Write-Host "  OK - Node.js $nodeVersion yuklu" -ForegroundColor Green
}
else
{
    Write-Host "  HATA - Node.js yuklu degil!" -ForegroundColor Red
    exit 1
}

# 2. Logs klasoru olustur
Write-Host "[2/6] Logs klasoru olusturuluyor..." -ForegroundColor Yellow
if (-not (Test-Path -Path ".\logs"))
{
    New-Item -ItemType Directory -Path ".\logs" | Out-Null
}
Write-Host "  OK - Logs klasoru hazir" -ForegroundColor Green

# 3. Backend bagimliliklari
Write-Host "[3/6] Backend bagimliliklari yukleniyor..." -ForegroundColor Yellow
Push-Location ".\windows-backend"
npm install --production 2>&1 | Out-Null
Pop-Location
Write-Host "  OK - Backend bagimliliklari yuklendi" -ForegroundColor Green

# 4. Frontend bagimliliklari
Write-Host "[4/6] Frontend bagimliliklari yukleniyor..." -ForegroundColor Yellow
npm install --production 2>&1 | Out-Null
Write-Host "  OK - Frontend bagimliliklari yuklendi" -ForegroundColor Green

# 5. PM2 ve serve global kurulum
Write-Host "[5/6] PM2 ve serve yukleniyor..." -ForegroundColor Yellow
npm install -g pm2 serve 2>&1 | Out-Null
Write-Host "  OK - PM2 ve serve yuklendi" -ForegroundColor Green

# 6. Servisleri baslat
Write-Host "[6/6] Servisler baslatiliyor..." -ForegroundColor Yellow
pm2 start ecosystem.config.cjs
pm2 save
Write-Host "  OK - Servisler baslatildi" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Kurulum Tamamlandi!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
