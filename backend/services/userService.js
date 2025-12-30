import { getPTSConnection } from '../config/database.js'

const userService = {
    // Kullanıcı doğrulama
    async login(username, password) {
        try {
            const pool = await getPTSConnection()

            const result = await pool.request()
                .input('username', username)
                .input('password', password)
                .query(`
          SELECT 
            ID,
            KULLANICI_ADI,
            AD_SOYAD,
            EMAIL,
            ROL,
            DEPARTMAN,
            YETKI_URUN_HAZIRLAMA,
            YETKI_PTS,
            YETKI_MESAJ_KODLARI,
            YETKI_AYARLAR,
            YETKI_KULLANICILAR,
            YETKI_SIRKETLER
          FROM AKTBLKULLANICI 
          WHERE KULLANICI_ADI = @username 
            AND SIFRE = @password 
            AND AKTIF = 1
        `)

            if (result.recordset.length === 0) {
                return { success: false, error: 'Kullanıcı adı veya şifre hatalı!' }
            }

            const user = result.recordset[0]

            // Son giriş tarihini güncelle
            await pool.request()
                .input('id', user.ID)
                .query('UPDATE AKTBLKULLANICI SET SON_GIRIS = GETDATE() WHERE ID = @id')

            return {
                success: true,
                user: {
                    id: user.ID,
                    username: user.KULLANICI_ADI,
                    name: user.AD_SOYAD,
                    email: user.EMAIL,
                    role: user.ROL,
                    department: user.DEPARTMAN,
                    permissions: {
                        urunHazirlama: user.YETKI_URUN_HAZIRLAMA === true || user.YETKI_URUN_HAZIRLAMA === 1,
                        pts: user.YETKI_PTS === true || user.YETKI_PTS === 1,
                        mesajKodlari: user.YETKI_MESAJ_KODLARI === true || user.YETKI_MESAJ_KODLARI === 1,
                        ayarlar: user.YETKI_AYARLAR === true || user.YETKI_AYARLAR === 1,
                        kullanicilar: user.YETKI_KULLANICILAR === true || user.YETKI_KULLANICILAR === 1
                    },
                    authorizedCompanies: user.YETKI_SIRKETLER || null
                }
            }
        } catch (error) {
            console.error('Login hatası:', error)
            return { success: false, error: 'Giriş işlemi başarısız' }
        }
    },

    // Tüm kullanıcıları getir (admin için)
    async getAllUsers() {
        try {
            const pool = await getPTSConnection()

            const result = await pool.request()
                .query(`
          SELECT 
            ID,
            KULLANICI_ADI,
            AD_SOYAD,
            EMAIL,
            ROL,
            DEPARTMAN,
            AKTIF,
            YETKI_URUN_HAZIRLAMA,
            YETKI_PTS,
            YETKI_MESAJ_KODLARI,
            YETKI_AYARLAR,
            YETKI_KULLANICILAR,
            YETKI_SIRKETLER,
            SON_GIRIS,
            OLUSTURMA_TARIHI
          FROM AKTBLKULLANICI 
          ORDER BY AD_SOYAD
        `)

            return {
                success: true,
                data: result.recordset.map(u => ({
                    id: u.ID,
                    username: u.KULLANICI_ADI,
                    name: u.AD_SOYAD,
                    email: u.EMAIL,
                    role: u.ROL,
                    department: u.DEPARTMAN,
                    aktif: u.AKTIF,
                    permissions: {
                        urunHazirlama: u.YETKI_URUN_HAZIRLAMA === true || u.YETKI_URUN_HAZIRLAMA === 1,
                        pts: u.YETKI_PTS === true || u.YETKI_PTS === 1,
                        mesajKodlari: u.YETKI_MESAJ_KODLARI === true || u.YETKI_MESAJ_KODLARI === 1,
                        ayarlar: u.YETKI_AYARLAR === true || u.YETKI_AYARLAR === 1,
                        kullanicilar: u.YETKI_KULLANICILAR === true || u.YETKI_KULLANICILAR === 1
                    },
                    authorizedCompanies: u.YETKI_SIRKETLER || null,
                    sonGiris: u.SON_GIRIS,
                    olusturmaTarihi: u.OLUSTURMA_TARIHI
                }))
            }
        } catch (error) {
            console.error('Kullanıcı listesi hatası:', error)
            return { success: false, error: error.message }
        }
    },

    // Kullanıcı ekle
    async createUser(userData) {
        try {
            const pool = await getPTSConnection()

            const result = await pool.request()
                .input('username', userData.username)
                .input('password', userData.password)
                .input('name', userData.name)
                .input('email', userData.email)
                .input('role', userData.role || 'user')
                .input('department', userData.department)
                .input('yetkiUrunHazirlama', userData.permissions?.urunHazirlama ? 1 : 0)
                .input('yetkiPts', userData.permissions?.pts ? 1 : 0)
                .input('yetkiMesajKodlari', userData.permissions?.mesajKodlari ? 1 : 0)
                .input('yetkiAyarlar', userData.permissions?.ayarlar ? 1 : 0)
                .input('yetkiKullanicilar', userData.permissions?.kullanicilar ? 1 : 0)
                .input('yetkiSirketler', userData.authorizedCompanies || null)
                .query(`
          INSERT INTO AKTBLKULLANICI (
            KULLANICI_ADI, SIFRE, AD_SOYAD, EMAIL, ROL, DEPARTMAN,
            YETKI_URUN_HAZIRLAMA, YETKI_PTS, YETKI_MESAJ_KODLARI, YETKI_AYARLAR, YETKI_KULLANICILAR, YETKI_SIRKETLER
          )
          VALUES (
            @username, @password, @name, @email, @role, @department,
            @yetkiUrunHazirlama, @yetkiPts, @yetkiMesajKodlari, @yetkiAyarlar, @yetkiKullanicilar, @yetkiSirketler
          );
          SELECT SCOPE_IDENTITY() AS ID;
        `)

            return { success: true, id: result.recordset[0].ID }
        } catch (error) {
            console.error('Kullanıcı ekleme hatası:', error)
            return { success: false, error: error.message }
        }
    },

    // Kullanıcı güncelle
    async updateUser(id, userData) {
        try {
            const pool = await getPTSConnection()

            await pool.request()
                .input('id', id)
                .input('name', userData.name)
                .input('email', userData.email)
                .input('role', userData.role)
                .input('department', userData.department)
                .input('aktif', userData.aktif ? 1 : 0)
                .input('yetkiUrunHazirlama', userData.permissions?.urunHazirlama ? 1 : 0)
                .input('yetkiPts', userData.permissions?.pts ? 1 : 0)
                .input('yetkiMesajKodlari', userData.permissions?.mesajKodlari ? 1 : 0)
                .input('yetkiAyarlar', userData.permissions?.ayarlar ? 1 : 0)
                .input('yetkiKullanicilar', userData.permissions?.kullanicilar ? 1 : 0)
                .input('yetkiSirketler', userData.authorizedCompanies || null)
                .query(`
          UPDATE AKTBLKULLANICI 
          SET AD_SOYAD = @name, 
              EMAIL = @email, 
              ROL = @role, 
              DEPARTMAN = @department,
              AKTIF = @aktif,
              YETKI_URUN_HAZIRLAMA = @yetkiUrunHazirlama,
              YETKI_PTS = @yetkiPts,
              YETKI_MESAJ_KODLARI = @yetkiMesajKodlari,
              YETKI_AYARLAR = @yetkiAyarlar,
              YETKI_KULLANICILAR = @yetkiKullanicilar,
              YETKI_SIRKETLER = @yetkiSirketler
          WHERE ID = @id
        `)

            return { success: true }
        } catch (error) {
            console.error('Kullanıcı güncelleme hatası:', error)
            return { success: false, error: error.message }
        }
    },

    // Şifre değiştir
    async changePassword(id, newPassword) {
        try {
            const pool = await getPTSConnection()

            await pool.request()
                .input('id', id)
                .input('password', newPassword)
                .query('UPDATE AKTBLKULLANICI SET SIFRE = @password WHERE ID = @id')

            return { success: true }
        } catch (error) {
            console.error('Şifre değiştirme hatası:', error)
            return { success: false, error: error.message }
        }
    },

    // Kullanıcı sil (admin silinemez)
    async deleteUser(id) {
        try {
            const pool = await getPTSConnection()

            // Admin kullanıcısı silinemez
            const check = await pool.request()
                .input('id', id)
                .query("SELECT KULLANICI_ADI FROM AKTBLKULLANICI WHERE ID = @id")

            if (check.recordset.length > 0 && check.recordset[0].KULLANICI_ADI === 'admin') {
                return { success: false, error: 'Admin kullanıcısı silinemez!' }
            }

            await pool.request()
                .input('id', id)
                .query('DELETE FROM AKTBLKULLANICI WHERE ID = @id')

            return { success: true }
        } catch (error) {
            console.error('Kullanıcı silme hatası:', error)
            return { success: false, error: error.message }
        }
    }
}

export default userService
