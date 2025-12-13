import sql from 'mssql'

const config = {
  server: 'NB2',
  database: 'MUHASEBE2025',
  user: 'sa',
  password: 'sapass1*',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    useUTC: false // Yerel saat dilimi kullan
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  // Türkçe karakter desteği için
  beforeConnect: (conn) => {
    conn.on('connect', (err) => {
      if (!err) {
        console.log('SQL Server bağlantısı kuruldu - Türkçe karakter desteği aktif')
      }
    })
  }
}

let pool = null

export const getConnection = async () => {
  try {
    if (!pool) {
      pool = await sql.connect(config)
      console.log('✅ SQL Server bağlantısı başarılı')
    }
    return pool
  } catch (error) {
    console.error('❌ SQL Server bağlantı hatası:', error)
    throw error
  }
}

export const closeConnection = async () => {
  try {
    if (pool) {
      await pool.close()
      pool = null
      console.log('SQL Server bağlantısı kapatıldı')
    }
  } catch (error) {
    console.error('Bağlantı kapatma hatası:', error)
  }
}

export default { getConnection, closeConnection }

