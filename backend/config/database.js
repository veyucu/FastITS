import sql from 'mssql'
import dotenv from 'dotenv'

// .env dosyasını yükle
dotenv.config()

// Ana veritabanı config (MUHASEBE2025) - ITS, UTS, Belgeler için
const mainConfig = {
  server: process.env.DB_SERVER || 'NB2',
  database: process.env.DB_NAME || 'MUHASEBE2025',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'sapass1*',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    useUTC: false
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    min: parseInt(process.env.DB_POOL_MIN) || 0,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000
  },
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
  requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT) || 60000,
  beforeConnect: (conn) => {
    conn.on('connect', (err) => {
      if (!err) {
        console.log('SQL Server bağlantısı kuruldu - Türkçe karakter desteği aktif')
      }
    })
  }
}

// PTS veritabanı config (NETSIS) - Sadece PTS işlemleri için
const ptsConfig = {
  server: process.env.PTS_DB_SERVER || process.env.DB_SERVER || 'NB2',
  database: process.env.PTS_DB_NAME || 'NETSIS',
  user: process.env.PTS_DB_USER || process.env.DB_USER || 'sa',
  password: process.env.PTS_DB_PASSWORD || process.env.DB_PASSWORD || 'sapass1*',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    useUTC: false
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    min: parseInt(process.env.DB_POOL_MIN) || 0,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000
  },
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
  requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT) || 60000,
  beforeConnect: (conn) => {
    conn.on('connect', (err) => {
      if (!err) {
        console.log('PTS SQL Server bağlantısı kuruldu - Türkçe karakter desteği aktif')
      }
    })
  }
}

let mainPool = null
let ptsPool = null

// Ana veritabanı bağlantısı (MUHASEBE2025)
export const getConnection = async () => {
  try {
    if (!mainPool) {
      mainPool = await sql.connect(mainConfig)
      console.log(`✅ SQL Server bağlantısı başarılı (${mainConfig.database})`)
    }
    return mainPool
  } catch (error) {
    console.error(`❌ SQL Server bağlantı hatası (${mainConfig.database}):`, error)
    throw error
  }
}

// PTS veritabanı bağlantısı (NETSIS)
export const getPTSConnection = async () => {
  try {
    if (!ptsPool) {
      ptsPool = await new sql.ConnectionPool(ptsConfig).connect()
      console.log(`✅ PTS SQL Server bağlantısı başarılı (${ptsConfig.database})`)
    }
    return ptsPool
  } catch (error) {
    console.error(`❌ PTS SQL Server bağlantı hatası (${ptsConfig.database}):`, error)
    throw error
  }
}

export const closeConnection = async () => {
  try {
    if (mainPool) {
      await mainPool.close()
      mainPool = null
      console.log(`${mainConfig.database} bağlantısı kapatıldı`)
    }
    if (ptsPool) {
      await ptsPool.close()
      ptsPool = null
      console.log(`${ptsConfig.database} bağlantısı kapatıldı`)
    }
  } catch (error) {
    console.error('Bağlantı kapatma hatası:', error)
  }
}

export default { getConnection, getPTSConnection, closeConnection, mainConfig, ptsConfig }

