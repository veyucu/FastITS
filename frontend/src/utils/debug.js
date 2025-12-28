/**
 * Debug utility - Production'da console çıktılarını devre dışı bırakır
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development'

export const log = (...args) => {
  if (isDev) {
    console.log(...args)
  }
}

export const warn = (...args) => {
  if (isDev) {
    console.warn(...args)
  }
}

export const error = (...args) => {
  // Errors always logged
  console.error(...args)
}

export const debug = (...args) => {
  if (isDev) {
    console.debug(...args)
  }
}

export default { log, warn, error, debug }


