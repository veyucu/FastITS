import { useState, useRef, useEffect } from 'react'
import { XCircle, Barcode, CheckCircle } from 'lucide-react'
import apiService from '../../services/apiService'
import { parseITSBarcode } from '../../utils/barcodeParser'

/**
 * Toplu ITS Karekod Okutma Modal Componenti - Dark Theme
 */
const BulkScanModal = ({
  isOpen,
  onClose,
  documentId,
  documentNo,
  docType,
  ftirsip,
  cariKodu,
  items = [],
  onSuccess,
  playSuccessSound,
  playErrorSound
}) => {
  const textareaRef = useRef(null)
  const lineNumbersRef = useRef(null)
  const [barcodeText, setBarcodeText] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)

  // Modal açıldığında textarea'ya focus
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Satır numaralarını senkronize et
  useEffect(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      const lineCount = barcodeText.split('\n').length
      const numbers = Array.from({ length: Math.max(lineCount, 10) }, (_, i) => i + 1).join('\n')
      lineNumbersRef.current.textContent = numbers
    }
  }, [barcodeText])

  // Scroll senkronizasyonu
  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  // Kullanıcı bilgisini al
  const getKullanici = () => {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}')
      return userData.username || 'SYSTEM'
    } catch {
      return 'SYSTEM'
    }
  }

  // Toplu okutma işlemi
  const handleBulkScan = async () => {
    const lines = barcodeText.split('\n').filter(line => line.trim())

    if (lines.length === 0) {
      alert('⚠️ Lütfen en az bir karekod girin')
      return
    }

    setLoading(true)
    setResults(null)

    const successItems = []
    const errorItems = []
    const kullanici = getKullanici()

    for (let i = 0; i < lines.length; i++) {
      const barcode = lines[i].trim()

      try {
        // Barkodu parse et
        const parsed = parseITSBarcode(barcode)

        if (!parsed) {
          errorItems.push({
            line: i + 1,
            barcode: barcode.substring(0, 30) + '...',
            message: 'Geçersiz ITS karekod formatı'
          })
          continue
        }

        // Ürünü bul
        const matchedItem = items.find(item => {
          const itemGtin = item.gtin?.replace(/^0+/, '') || ''
          const parsedGtin = parsed.gtin?.replace(/^0+/, '') || ''
          return itemGtin === parsedGtin
        })

        if (!matchedItem) {
          errorItems.push({
            line: i + 1,
            barcode: barcode.substring(0, 30) + '...',
            message: `GTIN ${parsed.gtin} belgede bulunamadı`
          })
          continue
        }

        // API'ye kaydet
        const response = await apiService.saveITSBarcode({
          kayitTipi: 'ITS',
          gtin: parsed.gtin,
          seriNo: parsed.serialNumber,
          miad: parsed.expiryDate,
          lotNo: parsed.lotNumber,
          stokKodu: matchedItem.stokKodu,
          straInc: matchedItem.straInc,
          tarih: matchedItem.tarih,
          gckod: matchedItem.gckod,
          belgeNo: documentNo,
          belgeTip: docType,
          subeKodu: matchedItem.subeKodu,
          ilcGtin: matchedItem.ilcGtin,
          expectedQuantity: matchedItem.miktar,
          ftirsip: ftirsip,
          cariKodu: cariKodu,
          kullanici: kullanici
        })

        if (response.success) {
          successItems.push({
            line: i + 1,
            barcode: barcode.substring(0, 30) + '...',
            stokKodu: matchedItem.stokKodu
          })
        } else {
          errorItems.push({
            line: i + 1,
            barcode: barcode.substring(0, 30) + '...',
            message: response.message || 'Kaydetme hatası'
          })
        }
      } catch (error) {
        errorItems.push({
          line: i + 1,
          barcode: barcode.substring(0, 30) + '...',
          message: error.message || 'Beklenmeyen hata'
        })
      }
    }

    setResults({
      totalCount: lines.length,
      successCount: successItems.length,
      errorCount: errorItems.length,
      errors: errorItems
    })

    if (successItems.length > 0) {
      playSuccessSound?.()
      onSuccess?.()
    }
    if (errorItems.length > 0) {
      playErrorSound?.()
    }

    setLoading(false)
  }

  // Temizle
  const handleClear = () => {
    setBarcodeText('')
    setResults(null)
    textareaRef.current?.focus()
  }

  // Modal kapat
  const handleClose = () => {
    setBarcodeText('')
    setResults(null)
    onClose()
  }

  if (!isOpen) return null

  const lineCount = barcodeText.split('\n').filter(l => l.trim()).length

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={handleClose}
      onKeyDown={(e) => e.key === 'Escape' && handleClose()}
    >
      <div
        className="bg-dark-800 rounded-2xl shadow-dark-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-primary-500/30 flex items-center justify-between bg-gradient-to-r from-primary-600/30 to-cyan-600/30 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500/20 border border-primary-500/30 rounded-lg flex items-center justify-center">
              <Barcode className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Toplu ITS Karekod Okutma</h2>
              <p className="text-xs text-slate-400">Her satıra bir ITS karekod (2D) yazın</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark-600 transition-colors text-slate-400 hover:text-slate-200"
            disabled={loading}
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
          {/* Textarea with Line Numbers */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              ITS Karekod Listesi
              <span className="text-slate-500 font-normal ml-2">(Her satıra bir ITS karekod)</span>
            </label>
            <div className="flex border border-dark-600 rounded-lg focus-within:border-primary-500 overflow-hidden" style={{ height: '256px' }}>
              {/* Line Numbers */}
              <div
                ref={lineNumbersRef}
                className="w-10 bg-dark-700 text-dark-400 text-right pr-2 py-2 font-mono text-sm overflow-hidden select-none"
                style={{ lineHeight: '1.5' }}
              >
                {Array.from({ length: Math.max(barcodeText.split('\n').length, 10) }, (_, i) => i + 1).join('\n')}
              </div>
              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={barcodeText}
                onChange={(e) => setBarcodeText(e.target.value)}
                onScroll={handleScroll}
                placeholder="ITS karekodları buraya yapıştırın...&#10;&#10;Örnek:&#10;01086992937002582110020832004322217280831102509178&#10;01086992937002582110020832004322217280831102509179"
                className="flex-1 p-2 font-mono text-sm resize-none focus:outline-none bg-dark-900 text-slate-100 placeholder-slate-600"
                style={{ lineHeight: '1.5' }}
                disabled={loading}
              />
            </div>
          </div>

          {/* Results */}
          {results && (
            <div className="p-4 rounded-lg bg-dark-700 border border-dark-600">
              <h3 className="font-bold mb-3 text-slate-200">📊 Sonuçlar</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-primary-500/20 border border-primary-500/30 rounded-lg">
                  <p className="text-2xl font-bold text-primary-400">{results.totalCount}</p>
                  <p className="text-xs text-primary-300">Toplam</p>
                </div>
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
                  <p className="text-2xl font-bold text-emerald-400">{results.successCount}</p>
                  <p className="text-xs text-emerald-300">Başarılı</p>
                </div>
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-2xl font-bold text-red-400">{results.errorCount}</p>
                  <p className="text-xs text-red-300">Hatalı</p>
                </div>
              </div>

              {/* Error Details */}
              {results.errors && results.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-red-400 mb-2">❌ Hatalar:</h4>
                  <div className="max-h-32 overflow-y-auto bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                    {results.errors.map((error, index) => (
                      <p key={index} className="text-xs text-red-300 font-mono py-0.5">
                        Satır {error.line}: {error.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-dark-700 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded transition-all border border-dark-600 text-slate-300 hover:bg-dark-600"
            disabled={loading}
          >
            İptal
          </button>
          <button
            onClick={handleBulkScan}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded transition-all bg-primary-600 text-white hover:bg-primary-500 shadow-lg shadow-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !barcodeText.trim()}
          >
            {loading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Kaydet ({lineCount} satır)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BulkScanModal
