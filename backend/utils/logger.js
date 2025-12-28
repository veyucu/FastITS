/**
 * Logger utility - Production'da bazı logları devre dışı bırakır
 */

const isDev = process.env.NODE_ENV !== 'production'

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

// Current log level (can be set via environment variable)
const currentLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO

/**
 * Debug log - only in development
 */
export const debug = (...args) => {
  if (currentLevel <= LOG_LEVELS.DEBUG) {
    console.log('[DEBUG]', ...args)
  }
}

/**
 * Info log - general information
 */
export const info = (...args) => {
  if (currentLevel <= LOG_LEVELS.INFO) {
    console.log('[INFO]', ...args)
  }
}

/**
 * Warning log
 */
export const warn = (...args) => {
  if (currentLevel <= LOG_LEVELS.WARN) {
    console.warn('[WARN]', ...args)
  }
}

/**
 * Error log - always shown
 */
export const error = (...args) => {
  console.error('[ERROR]', ...args)
}

/**
 * Simple log - respects debug mode
 */
export const log = (...args) => {
  if (isDev) {
    console.log(...args)
  }
}

export default { debug, info, warn, error, log }


