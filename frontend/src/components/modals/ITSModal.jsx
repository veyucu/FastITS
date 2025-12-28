import { useState, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { XCircle, CheckCircle } from 'lucide-react'
import apiService from '../../services/apiService'

/**
 * ITS Kayıtları Modal Componenti
 */
const ITSModal = ({
  isOpen,
  onClose,
  selectedItem,
  documentId,
  records,
  setRecords,
  loading,
  onRecordsChange,
  playSuccessSound,
  playErrorSound
}) => {
  const [selectedRecords, setSelectedRecords] = useState([])
  const [modalView, setModalView] = useState('grid') // 'grid' veya 'text'

  // ITS Grid Column Definitions
  const columnDefs = useMemo(() => [
    {
      headerName: '',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 50,
      pinned: 'left',
      suppressMenu: true,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      headerClass: 'ag-header-cell-center'
    },
    {
      headerName: '#',
      valueGetter: 'node.rowIndex + 1',
      width: 60,
      cellClass: 'text-center font-semibold text-slate-400'
    },
    {
      headerName: 'Barkod',
      field: 'barkod',
      width: 150,
      cellClass: 'font-mono'
    },
    {
      headerName: 'Seri No',
      field: 'seriNo',
      flex: 1,
      minWidth: 250,
      cellClass: 'font-mono font-bold text-primary-400'
    },
    {
      headerName: 'Miad',
      field: 'miad',
      width: 120,
      cellClass: 'text-center font-semibold',
      valueFormatter: (params) => {
        if (!params.value) return ''
        // DATE tipinden gelen tarih (ISO string)
        const date = new Date(params.value)
        if (!isNaN(date.getTime())) {
          const dd = String(date.getDate()).padStart(2, '0')
          const mm = String(date.getMonth() + 1).padStart(2, '0')
          const yyyy = date.getFullYear()
          return `${dd}.${mm}.${yyyy}`
        }
        return ''
      }
    },
    {
      headerName: 'Lot',
      field: 'lot',
      width: 150,
      cellClass: 'font-mono'
    },
    {
      headerName: 'Koli Barkodu',
      field: 'carrierLabel',
      width: 180,
      cellClass: 'font-mono text-blue-400'
    }
  ], [])

  // Default Column Definitions
  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true
  }), [])

  // ITS Karekodları Text Formatında Oluştur
  const generateBarcodeTexts = () => {
    return records.map(record => {
      // MIAD'ı YYMMDD formatına çevir
      let miadFormatted = ''
      if (record.miad) {
        try {
          // ISO string'den tarihi parse et: "2028-09-29T21:00:00.000Z"
          const miadStr = String(record.miad)
          if (miadStr.includes('T') || miadStr.includes('-')) {
            // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ veya YYYY-MM-DD
            const datePart = miadStr.split('T')[0] // "2028-09-29"
            const parts = datePart.split('-') // ["2028", "09", "29"]
            if (parts.length === 3) {
              const yy = parts[0].slice(-2) // "28"
              const mm = parts[1] // "09"
              const dd = parts[2] // "29"
              miadFormatted = `${yy}${mm}${dd}` // "280929"
            }
          } else if (miadStr.length === 6) {
            // Zaten YYMMDD formatında
            miadFormatted = miadStr
          }
        } catch (e) {
          console.error('MIAD parse error:', e)
        }
      }

      // GTIN'i 14 haneye tamamla (başına 0 ekle)
      // stokKodu 13 haneli barkod, 14 haneye tamamlıyoruz
      const stokKodu = String(record.stokKodu || record.barkod || '')
      const gtinFormatted = stokKodu.padStart(14, '0') // 14 haneye tamamla

      const parts = [
        '01',
        gtinFormatted,
        '21',
        record.seriNo || '',
        '17',
        miadFormatted,
        '10',
        record.lot || ''
      ]
      return parts.join('')
    }).join('\n')
  }

  // Tüm Karekodları Kopyala
  const handleCopyAllBarcodes = () => {
    const text = generateBarcodeTexts()
    navigator.clipboard.writeText(text).then(() => {
      playSuccessSound?.()
      alert('✅ Karekodlar panoya kopyalandı!')
    }).catch(err => {
      console.error('Kopyalama hatası:', err)
      playErrorSound?.()
      alert('❌ Kopyalama başarısız!')
    })
  }

  // ITS Kayıtlarını Sil
  const handleDeleteRecords = async () => {
    if (selectedRecords.length === 0) {
      alert('⚠️ Lütfen silinecek kayıtları seçin')
      return
    }

    // Seçili kayıtlarda koli barkodu var mı kontrol et
    const recordsWithCarrier = selectedRecords.filter(record => {
      const fullRecord = records.find(r => r.seriNo === record)
      return fullRecord && fullRecord.carrierLabel
    })

    // Koli barkodu varsa ve tüm kayıtlar seçili değilse uyar
    if (recordsWithCarrier.length > 0) {
      const carrierLabels = new Set()
      recordsWithCarrier.forEach(record => {
        const fullRecord = records.find(r => r.seriNo === record)
        if (fullRecord && fullRecord.carrierLabel) {
          carrierLabels.add(fullRecord.carrierLabel)
        }
      })

      let hasPartialSelection = false
      for (const carrierLabel of carrierLabels) {
        const totalWithCarrier = records.filter(r => r.carrierLabel === carrierLabel).length
        const selectedWithCarrier = recordsWithCarrier.filter(record => {
          const fullRecord = records.find(r => r.seriNo === record)
          return fullRecord && fullRecord.carrierLabel === carrierLabel
        }).length

        if (selectedWithCarrier < totalWithCarrier) {
          hasPartialSelection = true
          break
        }
      }

      const confirmMessage = hasPartialSelection
        ? `⚠️ UYARI: Seçili kayıtlardan bazıları koli ile okutulmuştur.\n\nBu satırları silerseniz koli bütünlüğü bozulacak.\n\n${selectedRecords.length} kayıt silinecek. Emin misiniz?`
        : `${selectedRecords.length} kayıt silinecek (koli bilgileri de silinecek). Emin misiniz?`

      if (!confirm(confirmMessage)) {
        return
      }
    } else {
      if (!confirm(`${selectedRecords.length} kayıt silinecek. Emin misiniz?`)) {
        return
      }
    }

    try {
      const result = await apiService.deleteITSBarcodeRecords(
        documentId,
        selectedItem.itemId,
        selectedRecords,
        'ITS'
      )

      if (result.success) {
        // Kayıtları yeniden yükle
        const response = await apiService.getITSBarcodeRecords(documentId, selectedItem.itemId)
        if (response.success) {
          setRecords(response.data || [])
          setSelectedRecords([])
        }
        onRecordsChange?.()
        playSuccessSound?.()
      } else {
        alert('❌ Kayıtlar silinemedi: ' + result.message)
        playErrorSound?.()
      }
    } catch (error) {
      console.error('ITS kayıt silme hatası:', error)
      alert('❌ Kayıtlar silinemedi')
      playErrorSound?.()
    }
  }

  if (!isOpen || !selectedItem) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="bg-dark-800 rounded-xl shadow-2xl w-[90%] max-w-5xl max-h-[80vh] overflow-hidden border border-dark-600"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">ITS Karekod Kayıtları</h2>
              <p className="text-sm text-primary-200">{selectedItem.productName}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-primary-200">Beklenen / Okutulan</p>
                <p className="text-2xl font-bold">
                  <span className="text-primary-200">{selectedItem.quantity}</span>
                  {' / '}
                  <span>{records.length}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col bg-dark-800" style={{ height: 'calc(80vh - 100px)' }}>
          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-3 border-dark-600 border-t-primary-500 rounded-full mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">Yükleniyor...</p>
                </div>
              </div>
            ) : modalView === 'grid' ? (
              <div className="ag-theme-alpine-dark h-full">
                <AgGridReact
                  rowData={records}
                  columnDefs={columnDefs}
                  defaultColDef={defaultColDef}
                  rowSelection="multiple"
                  suppressRowClickSelection={true}
                  onSelectionChanged={(event) => {
                    const selected = event.api.getSelectedRows()
                    setSelectedRecords(selected.map(r => r.seriNo))
                  }}
                  animateRows={true}
                  enableCellTextSelection={true}
                />
              </div>
            ) : (
              <textarea
                readOnly
                value={generateBarcodeTexts()}
                className="w-full h-full font-mono text-sm p-4 bg-dark-900 border border-dark-600 rounded-lg resize-none focus:outline-none text-slate-200"
                placeholder="Karekod verisi yok..."
              />
            )}
          </div>

          {/* Action Bar - Grid View */}
          {modalView === 'grid' && (
            <div className="flex items-center gap-3 border-t border-dark-600 pt-4 mt-4">
              <button
                onClick={handleDeleteRecords}
                disabled={selectedRecords.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded shadow-lg hover:shadow-xl transition-all bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🗑️ Seçilenleri Sil ({selectedRecords.length})
              </button>
              <button
                onClick={() => setModalView('text')}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded shadow-lg hover:shadow-xl transition-all bg-indigo-600 text-white hover:bg-indigo-700"
              >
                📝 Karekodları Göster
              </button>
              <div className="flex-1" />
              <div className="flex items-center gap-2 text-sm">
                {records.length >= selectedItem.quantity ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle className="w-4 h-4" />
                    Tamamlandı
                  </span>
                ) : (
                  <span className="text-slate-400">
                    Kalan: <span className="font-bold text-amber-400">{selectedItem.quantity - records.length}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action Bar - Text View */}
          {modalView === 'text' && (
            <div className="flex items-center gap-3 border-t border-dark-600 pt-4 mt-4">
              <button
                onClick={() => setModalView('grid')}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded shadow-lg hover:shadow-xl transition-all bg-slate-600 text-white hover:bg-slate-700"
              >
                📊 Listeyi Göster
              </button>
              <button
                onClick={handleCopyAllBarcodes}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded shadow-lg hover:shadow-xl transition-all bg-emerald-600 text-white hover:bg-emerald-700"
              >
                📋 Tümünü Kopyala
              </button>
              <div className="flex-1" />
              <span className="text-slate-400 text-sm">
                {records.length} karekod
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ITSModal



