# FastITS - Kurulum Rehberi

## Hızlı Kurulum

### 1. Dosyaları Kopyala
Tüm proje klasörünü müşteri sunucusuna kopyalayın (`node_modules` hariç).

### 2. Ortam Değişkenlerini Ayarla
```powershell
# .env dosyasını düzenle
notepad backend\.env
```

Minimum değiştirilmesi gerekenler:
- `DB_SERVER` - SQL Server adresi
- `DB_PASSWORD` - Veritabanı şifresi

### 3. Kurulumu Başlat
```powershell
# Administrator olarak PowerShell açın
cd C:\FastITS
.\install.ps1
```

## Erişim
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api/health

## PM2 Komutları
```powershell
pm2 list          # Servisleri listele
pm2 logs          # Logları görüntüle
pm2 restart all   # Yeniden başlat
pm2 stop all      # Durdur
```

## Sorun Giderme

### Bağlantı Hatası
1. SQL Server'ın çalıştığını kontrol edin
2. `.env` dosyasındaki bağlantı bilgilerini kontrol edin
3. Firewall'da 1433 portunun açık olduğunu kontrol edin

### Servis Başlamıyor
```powershell
pm2 logs fastits-backend  # Hata mesajlarını görün
```
