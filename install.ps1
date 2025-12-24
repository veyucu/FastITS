# AtakodITS Kurulum Script'i
# PowerShell ile çalıştırın

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AtakodITS Kurulum Başlıyor..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Node.js kontrolü
Write-Host "[1/6] Node.js kontrol ediliyor..." -ForegroundColor Yellow
$nodeVersion = node -v 2>$null
if ($nodeVersion) {
    Write-Host "  ✓ Node.js $nodeVersion yüklü" -ForegroundColor Green
} else {
    Write-Host "  ✗ Node.js yüklü değil! Lütfen https://nodejs.org adresinden yükleyin." -ForegroundColor Red
    exit 1
}

# 2. Logs klasörü oluştur
Write-Host "[2/6] Logs klasörü oluşturuluyor..." -ForegroundColor Yellow
if (!(Test-Path -Path ".\logs")) {
    New-Item -ItemType Directory -Path ".\logs" | Out-Null
}
Write-Host "  ✓ Logs klasörü hazır" -ForegroundColor Green

# 3. Backend bağımlılıkları
Write-Host "[3/6] Backend bağımlılıkları yükleniyor..." -ForegroundColor Yellow
Set-Location -Path ".\windows-backend"
npm install --production 2>&1 | Out-Null
Set-Location -Path ".."
Write-Host "  ✓ Backend bağımlılıkları yüklendi" -ForegroundColor Green

# 4. Frontend bağımlılıkları
Write-Host "[4/6] Frontend bağımlılıkları yükleniyor..." -ForegroundColor Yellow
npm install --production 2>&1 | Out-Null
Write-Host "  ✓ Frontend bağımlılıkları yüklendi" -ForegroundColor Green

# 5. PM2 ve serve global kurulum
Write-Host "[5/6] PM2 ve serve yükleniyor..." -ForegroundColor Yellow
npm install -g pm2 serve 2>&1 | Out-Null
Write-Host "  ✓ PM2 ve serve yüklendi" -ForegroundColor Green

# 6. Servisleri başlat
Write-Host "[6/6] Servisler başlatılıyor..." -ForegroundColor Yellow
pm2 start ecosystem.config.cjs
pm2 save
Write-Host "  ✓ Servisler başlatıldı" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Kurulum Tamamlandı!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  PM2 Komutları:" -ForegroundColor Yellow
Write-Host "    pm2 list          - Servisleri listele" -ForegroundColor Gray
Write-Host "    pm2 logs          - Logları görüntüle" -ForegroundColor Gray
Write-Host "    pm2 restart all   - Tümünü yeniden başlat" -ForegroundColor Gray
Write-Host "    pm2 stop all      - Tümünü durdur" -ForegroundColor Gray
Write-Host ""
