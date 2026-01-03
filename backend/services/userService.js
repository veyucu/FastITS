import { getPTSConnection } from '../config/database.js'

// Yetki string'ini parse et ve object'e çevir
const parsePermissions = (menuYetkileri) => {
    const yetkiler = (menuYetkileri || '').split(',').map(y => y.trim()).filter(y => y)
    return {
        urunHazirlama: yetkiler.includes('UrunHazirlama'),
        pts: yetkiler.includes('PTS'),
        ayarlar: yetkiler.includes('Ayarlar'),
        kullanicilar: yetkiler.includes('Kullanicilar'),
        utsIslemleri: yetkiler.includes('UTSIslemleri'),
        serbestBildirim: yetkiler.includes('SerbestBildirim')
    }
}

// Permission object'i string'e çevir
const serializePermissions = (permissions) => {
    const yetkiler = []
    if (permissions?.urunHazirlama) yetkiler.push('UrunHazirlama')
    if (permissions?.pts) yetkiler.push('PTS')
    if (permissions?.ayarlar) yetkiler.push('Ayarlar')
    if (permissions?.kullanicilar) yetkiler.push('Kullanicilar')
    if (permissions?.utsIslemleri) yetkiler.push('UTSIslemleri')
    if (permissions?.serbestBildirim) yetkiler.push('SerbestBildirim')
    return yetkiler.join(',')
}

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
            MENU_YETKILERI,
            SIRKET_YETKILERI
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
                    permissions: parsePermissions(user.MENU_YETKILERI),
                    authorizedCompanies: user.SIRKET_YETKILERI || null
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
            AKTIF,
            MENU_YETKILERI,
            SIRKET_YETKILERI,
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
                    aktif: u.AKTIF,
                    permissions: parsePermissions(u.MENU_YETKILERI),
                    authorizedCompanies: u.SIRKET_YETKILERI || null,
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

            const menuYetkileri = serializePermissions(userData.permissions)

            const result = await pool.request()
                .input('username', userData.username)
                .input('password', userData.password)
                .input('name', userData.name)
                .input('email', userData.email)
                .input('role', userData.role || 'user')
                .input('menuYetkileri', menuYetkileri)
                .input('sirketYetkileri', userData.authorizedCompanies || null)
                .query(`
          INSERT INTO AKTBLKULLANICI (
            KULLANICI_ADI, SIFRE, AD_SOYAD, EMAIL, ROL,
            MENU_YETKILERI, SIRKET_YETKILERI
          )
          VALUES (
            @username, @password, @name, @email, @role,
            @menuYetkileri, @sirketYetkileri
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

            const menuYetkileri = serializePermissions(userData.permissions)

            await pool.request()
                .input('id', id)
                .input('name', userData.name)
                .input('email', userData.email)
                .input('role', userData.role)
                .input('aktif', userData.aktif ? 1 : 0)
                .input('menuYetkileri', menuYetkileri)
                .input('sirketYetkileri', userData.authorizedCompanies || null)
                .query(`
          UPDATE AKTBLKULLANICI 
          SET AD_SOYAD = @name, 
              EMAIL = @email, 
              ROL = @role, 
              AKTIF = @aktif,
              MENU_YETKILERI = @menuYetkileri,
              SIRKET_YETKILERI = @sirketYetkileri
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
