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
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 120000
  },
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
  requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT) || 60000,
  beforeConnect: (conn) => {
    conn.on('connect', (err) => {
      if (!err) {
        console.log('SQL Server bağlantısı kuruldu')
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
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 120000
  },
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
  requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT) || 60000,
  beforeConnect: (conn) => {
    conn.on('connect', (err) => {
      if (!err) {
        console.log('PTS SQL Server bağlantısı kuruldu')
      }
    })
  }
}

let mainPool = null
let ptsPool = null

// Dinamik veritabanı bağlantı havuzu (şirket bazlı)
const dynamicPools = new Map()

/**
 * Dinamik veritabanı bağlantısı (seçilen şirkete göre)
 * @param {string} databaseName - Bağlanılacak veritabanı adı
 */
export const getDynamicConnection = async (databaseName) => {
  if (!databaseName) {
    // Database adı yoksa varsayılan bağlantıyı kullan
    return getConnection()
  }

  try {
    // Pool zaten var mı kontrol et
    if (dynamicPools.has(databaseName)) {
      const pool = dynamicPools.get(databaseName)
      if (pool.connected) {
        return pool
      }
      // Bağlantı kopmuşsa yeniden oluştur
      dynamicPools.delete(databaseName)
    }

    // Yeni bağlantı oluştur
    const dynamicConfig = {
      server: process.env.DB_SERVER || 'NB2',
      database: databaseName,
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
        min: parseInt(process.env.DB_POOL_MIN) || 2,
        idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 120000
      },
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
      requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT) || 60000
    }

    const pool = await new sql.ConnectionPool(dynamicConfig).connect()
    dynamicPools.set(databaseName, pool)
    console.log(`✅ Dinamik SQL bağlantısı başarılı (${databaseName})`)
    return pool
  } catch (error) {
    console.error(`❌ Dinamik SQL bağlantı hatası (${databaseName}):`, error)
    throw error
  }
}

/**
 * Tüm dinamik bağlantıları kapat
 */
export const closeDynamicConnections = async () => {
  for (const [dbName, pool] of dynamicPools) {
    try {
      await pool.close()
      console.log(`${dbName} dinamik bağlantısı kapatıldı`)
    } catch (error) {
      console.error(`${dbName} bağlantı kapatma hatası:`, error)
    }
  }
  dynamicPools.clear()
}

// Aktif veritabanı context'i (request başına ayarlanır)
let currentDatabase = null

/**
 * Aktif veritabanını ayarla (middleware tarafından çağrılır)
 */
export const setCurrentDatabase = (dbName) => {
  currentDatabase = dbName?.trim() || null
}

/**
 * Aktif veritabanını getir
 */
export const getCurrentDatabase = () => currentDatabase

/**
 * Ana veritabanı bağlantısı
 * Eğer currentDatabase set edilmişse o veritabanına bağlanır (şirket bazlı)
 * Set edilmemişse varsayılan veritabanına bağlanır
 */
export const getConnection = async () => {
  // Aktif şirket veritabanı varsa onu kullan
  if (currentDatabase) {
    return getDynamicConnection(currentDatabase)
  }

  // Fallback: varsayılan veritabanı (sadece backend başlangıcında kullanılır)
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
    // Dinamik bağlantıları da kapat
    await closeDynamicConnections()
  } catch (error) {
    console.error('Bağlantı kapatma hatası:', error)
  }
}

export default { getConnection, getPTSConnection, getDynamicConnection, closeDynamicConnections, closeConnection, mainConfig, ptsConfig }

