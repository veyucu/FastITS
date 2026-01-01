import { useState, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { XCircle } from 'lucide-react'
import apiService from '../../services/apiService'

// Custom Date Cell Editor - Maskelenmiş tarih girişi (DD.MM.YYYY)
const DateCellEditor = forwardRef((props, ref) => {
  const inputRef = useRef(null)
  const [value, setValue] = useState(props.value || '')

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleChange = (e) => {
    let input = e.target.value

    // Sadece rakam ve nokta kabul et
    input = input.replace(/[^\d.]/g, '')

    // Noktaları kaldır ve sadece rakamları al
    const digits = input.replace(/\./g, '')

    // Maksimum 8 rakam (DDMMYYYY)
    const limited = digits.slice(0, 8)

    // Otomatik nokta ekle (DD.MM.YYYY)
    let formatted = ''
    for (let i = 0; i < limited.length; i++) {
      if (i === 2 || i === 4) {
        formatted += '.'
      }
      formatted += limited[i]
    }

    setValue(formatted)
  }

  useImperativeHandle(ref, () => ({
    getValue() {
      return value
    },
    isCancelAfterEnd() {
      return false
    }
  }))

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={handleChange}
      placeholder="GG.AA.YYYY"
      maxLength={10}
      className="w-full h-full px-2 text-center rounded focus:outline-none font-mono"
      style={{
        fontSize: '14px',
        backgroundColor: '#1e293b',
        color: '#f1f5f9',
        border: '2px solid #3b82f6'
      }}
    />
  )
})
DateCellEditor.displayName = 'DateCellEditor'

/**
 * UTS Kayıtları Modal Componenti
 */
const UTSModal = ({
  isOpen,
  onClose,
  selectedItem,
  document,
  records,
  setRecords,
  originalRecords,
  setOriginalRecords,
  loading,
  onRecordsChange,
  playSuccessSound,
  playErrorSound
}) => {
  const gridRef = useRef(null)
  const [selectedRecords, setSelectedRecords] = useState([])
  const [modalMessage, setModalMessage] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Message timeout
  useEffect(() => {
    if (modalMessage) {
      const timer = setTimeout(() => setModalMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [modalMessage])

  // Show message helper
  const showMessage = (text, type = 'info') => {
    setModalMessage({ text, type })
  }

  // UTS Modal Column Definitions
  const columnDefs = useMemo(() => [
    {
      headerName: '',
      field: 'select',
      width: 50,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      pinned: 'left'
    },
    {
      headerName: '#',
      field: 'siraNo',
      width: 60,
      cellClass: 'text-center font-mono text-gray-500'
    },
    {
      headerName: 'Seri No',
      field: 'seriNo',
      flex: 1,
      minWidth: 150,
      editable: true,
      cellClass: 'font-mono text-sm'
    },
    {
      headerName: 'Lot',
      field: 'lot',
      width: 120,
      editable: true,
      cellClass: 'font-mono'
    },
    {
      headerName: 'Üretim Tarihi',
      field: 'uretimTarihiDisplay',
      width: 150,
      editable: true,
      cellEditor: DateCellEditor,
      cellClass: 'text-center font-mono',
      valueGetter: (params) => {
        // YYYY-MM-DD -> DD.MM.YYYY formatına çevir
        const val = params.data?.uretimTarihiDisplay
        if (!val) return ''
        if (val.includes('-')) {
          const [yyyy, mm, dd] = val.split('-')
          return `${dd}.${mm}.${yyyy}`
        }
        return val
      },
      valueSetter: (params) => {
        const newValue = params.newValue?.trim() || ''

        // Boş değer kabul et
        if (!newValue) {
          params.data.uretimTarihiDisplay = ''
          return true
        }

        // DD.MM.YYYY formatı -> YYYY-MM-DD olarak kaydet
        const ddmmyyyy = newValue.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
        if (ddmmyyyy) {
          const [, dd, mm, yyyy] = ddmmyyyy
          params.data.uretimTarihiDisplay = `${yyyy}-${mm}-${dd}`
          return true
        }

        // Geçersiz format
        return false
      }
    },
    {
      headerName: 'Miktar',
      field: 'miktar',
      width: 90,
      editable: true,
      cellEditor: 'agNumberCellEditor',
      cellClass: 'text-center font-bold',
      valueParser: (params) => {
        const val = Number(params.newValue)
        return isNaN(val) ? 0 : Math.max(0, Math.round(val))
      }
    }
  ], [])

  // Default Column Definitions
  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true
  }), [])

  // Yeni satır ekle
  const handleAddNewRow = () => {
    const maxSiraNo = records.length > 0
      ? Math.max(...records.map(r => r.siraNo || 0))
      : 0

    const newRow = {
      id: `new_${Date.now()}`,
      siraNo: maxSiraNo + 1,
      seriNo: '',
      lot: '',
      uretimTarihi: '',
      uretimTarihiDisplay: '',
      miktar: 1,
      isNew: true
    }

    setRecords([...records, newRow])
    setHasChanges(true)
  }

  // Seçili satırları sil
  const handleDeleteRecords = () => {
    if (selectedRecords.length === 0) {
      showMessage('⚠️ Lütfen silinecek kayıtları seçin', 'warning')
      return
    }

    if (!confirm(`${selectedRecords.length} kayıt silinecek. Emin misiniz?`)) {
      return
    }

    const selectedIds = new Set(selectedRecords.map(r => r.id))
    const remainingRecords = records.filter(r => !selectedIds.has(r.id))

    // Sıra numaralarını yeniden düzenle
    const reindexedRecords = remainingRecords.map((r, index) => ({
      ...r,
      siraNo: index + 1
    }))

    setRecords(reindexedRecords)
    setSelectedRecords([])
    setHasChanges(true)
    showMessage(`✅ ${selectedRecords.length} kayıt silindi`, 'success')
  }

  // Tüm kayıtları kaydet
  const handleSaveAll = async () => {
    try {
      // Validasyonlar
      const validRows = records.filter(row =>
        row.lot?.trim() || row.seriNo?.trim() || row.miktar > 0
      )

      if (validRows.length === 0) {
        showMessage('❌ Kaydedilecek veri yok!', 'error')
        playErrorSound?.()
        return
      }

      // Her satırı valide et
      for (const row of validRows) {
        const rowNum = row.siraNo

        // Lot No kontrolü (zorunlu)
        if (!row.lot || !row.lot.trim()) {
          showMessage(`❌ Satır ${rowNum}: Lot numarası boş olamaz!`, 'error')
          playErrorSound?.()
          return
        }

        // Üretim tarihi kontrolü (zorunlu)
        if (!row.uretimTarihiDisplay || !row.uretimTarihiDisplay.trim()) {
          showMessage(`❌ Satır ${rowNum}: Üretim tarihi boş olamaz!`, 'error')
          playErrorSound?.()
          return
        }

        // Miktar kontrolü
        if (!row.miktar || row.miktar <= 0) {
          showMessage(`❌ Satır ${rowNum}: Miktar boş olamaz ve 0'dan büyük olmalı!`, 'error')
          playErrorSound?.()
          return
        }

        // Seri no varsa miktar 1 olmalı
        if (row.seriNo && row.miktar !== 1) {
          showMessage(`❌ Satır ${rowNum}: Seri No girildiğinde miktar 1 olmalı!`, 'error')
          playErrorSound?.()
          return
        }
      }

      // Seri No teklik kontrolü
      const serialNumbers = validRows.filter(r => r.seriNo).map(r => r.seriNo.trim().toLowerCase())
      const serialCounts = {}
      serialNumbers.forEach(sn => {
        serialCounts[sn] = (serialCounts[sn] || 0) + 1
      })
      const duplicateSerials = Object.keys(serialCounts).filter(sn => serialCounts[sn] > 1)
      if (duplicateSerials.length > 0) {
        showMessage(`❌ Aynı Seri No birden fazla satırda kullanılamaz: ${duplicateSerials.join(', ')}`, 'error')
        playErrorSound?.()
        return
      }

      // Lot No teklik kontrolü
      const lotNumbers = validRows.filter(r => r.lot).map(r => r.lot.trim().toLowerCase())
      const lotCounts = {}
      lotNumbers.forEach(lot => {
        lotCounts[lot] = (lotCounts[lot] || 0) + 1
      })
      const duplicateLots = Object.keys(lotCounts).filter(lot => lotCounts[lot] > 1)
      if (duplicateLots.length > 0) {
        showMessage(`❌ Aynı Lot numarası birden fazla satırda kullanılamaz: ${duplicateLots.join(', ')}`, 'error')
        playErrorSound?.()
        return
      }

      // Toplam miktar kontrolü
      const totalMiktar = validRows.reduce((sum, row) => sum + (row.miktar || 0), 0)
      if (totalMiktar > selectedItem.quantity) {
        showMessage(`❌ Toplam miktar (${totalMiktar}) belge kalemindeki miktarı (${selectedItem.quantity}) geçemez!`, 'error')
        playErrorSound?.()
        return
      }

      // Belge tarihini formatla
      let belgeTarihiFormatted
      if (document.documentDate) {
        const date = new Date(document.documentDate)
        belgeTarihiFormatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      } else {
        const today = new Date()
        belgeTarihiFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      }

      // API'yi çağır (kullanıcı backend'de context'ten alınıyor)
      const result = await apiService.saveUTSRecords({
        records: validRows,
        originalRecords: originalRecords,
        documentId: document.id,
        itemId: selectedItem.itemId,
        stokKodu: selectedItem.stokKodu,
        belgeTip: selectedItem.stharHtur,
        gckod: selectedItem.stharGckod || '',
        belgeNo: document.documentNo,
        belgeTarihi: belgeTarihiFormatted,
        docType: document.docType,
        expectedQuantity: selectedItem.quantity,
        barcode: selectedItem.barcode || selectedItem.stokKodu,
        cariKodu: document.customerCode
        // kullanici artık context'ten alınıyor
      })

      if (result.success) {
        showMessage(`✅ ${result.message}`, 'success')
        playSuccessSound?.()
        setHasChanges(false)

        // Grid'i yenile
        const response = await apiService.getUTSBarcodeRecords(document.id, selectedItem.itemId)
        if (response.success) {
          const enrichedRecords = (response.data || []).map(record => {
            let uretimTarihiDisplay = ''
            if (record.uretimTarihi) {
              // DATE tipinden gelen tarih (ISO string)
              const date = new Date(record.uretimTarihi)
              if (!isNaN(date.getTime())) {
                uretimTarihiDisplay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
              }
            }
            return { ...record, uretimTarihiDisplay }
          })
          setRecords(enrichedRecords)
          setOriginalRecords(JSON.parse(JSON.stringify(enrichedRecords)))
        }

        onRecordsChange?.()

        // Başarılı kayıt sonrası modal'ı kapat
        setTimeout(() => onClose(true), 1000)
      } else {
        showMessage(`❌ ${result.message}`, 'error')
        playErrorSound?.()
      }
    } catch (error) {
      console.error('UTS toplu kayıt hatası:', error)
      showMessage('❌ Kayıt sırasında hata oluştu', 'error')
      playErrorSound?.()
    }
  }

  // Modal kapatma
  const handleClose = () => {
    if (hasChanges) {
      if (!confirm('⚠️ Kaydedilmemiş değişiklikler var. Çıkmak istediğinize emin misiniz?')) {
        return
      }
    }
    onClose()
  }

  if (!isOpen || !selectedItem) return null

  const totalMiktar = records.reduce((sum, r) => sum + (r.miktar || 0), 0)

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={handleClose}
      onKeyDown={(e) => e.key === 'Escape' && handleClose()}
    >
      <div
        className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-5xl mx-4 shadow-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-600/30 to-rose-500/30 border-b border-rose-500/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-100">UTS Kayıtları</h2>
              <p className="text-sm text-rose-300">{selectedItem.productName}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-slate-400">Beklenen / Okutulan / Kalan</p>
                <p className="text-2xl font-bold text-slate-100">
                  <span className="text-slate-400">{selectedItem.quantity}</span>
                  {' / '}
                  <span>{totalMiktar}</span>
                  {' / '}
                  <span className={totalMiktar >= selectedItem.quantity ? 'text-emerald-400' : 'text-amber-400'}>
                    {selectedItem.quantity - totalMiktar}
                  </span>
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark-600 transition-colors text-slate-400 hover:text-slate-200"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col" style={{ height: 'calc(80vh - 100px)' }}>
          {/* Toast Message */}
          {modalMessage && (
            <div className={`mb-4 px-4 py-3 rounded-lg border-l-4 ${modalMessage.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
              : modalMessage.type === 'error'
                ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                : 'bg-amber-500/20 border-amber-500 text-amber-400'
              }`}>
              <p className="font-semibold">{modalMessage.text}</p>
            </div>
          )}

          {/* Records Grid */}
          <style>{`
            .ag-theme-alpine .ag-cell-inline-editing {
              background-color: #1e293b !important;
              border: none !important;
              padding: 0 !important;
            }
            .ag-theme-alpine .ag-cell-edit-wrapper {
              background-color: #1e293b !important;
            }
            .ag-theme-alpine .ag-text-field-input {
              background-color: #1e293b !important;
              color: #f1f5f9 !important;
              border: 2px solid #3b82f6 !important;
            }
            .ag-theme-alpine .ag-popup-editor {
              background-color: #1e293b !important;
            }
          `}</style>
          <div className="ag-theme-alpine flex-1 mb-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-3 border-gray-200 border-t-red-600 rounded-full mx-auto mb-2" />
                  <p className="text-gray-600 text-sm">Yükleniyor...</p>
                </div>
              </div>
            ) : (
              <AgGridReact
                ref={gridRef}
                rowData={records}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                getRowId={(params) => params.data.id}
                rowSelection="multiple"
                suppressRowClickSelection={true}
                onSelectionChanged={(event) => {
                  const selected = event.api.getSelectedRows()
                  setSelectedRecords(selected.map(r => ({
                    id: r.id,
                    siraNo: r.siraNo,
                    seriNo: r.seriNo,
                    lot: r.lot
                  })))
                }}
                onCellValueChanged={(event) => {
                  const allRows = []
                  event.api.forEachNode(node => allRows.push(node.data))
                  setRecords([...allRows])
                  setHasChanges(true)
                }}
                animateRows={true}
                enableCellTextSelection={true}
                singleClickEdit={true}
                stopEditingWhenCellsLoseFocus={true}
              />
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
            <button
              onClick={handleAddNewRow}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded shadow-lg hover:shadow-xl transition-all bg-green-600 text-white hover:bg-green-700"
            >
              ➕ Yeni Satır Ekle
            </button>
            <button
              onClick={handleSaveAll}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded shadow-lg hover:shadow-xl transition-all bg-blue-600 text-white hover:bg-blue-700 ${hasChanges ? 'animate-pulse' : ''}`}
            >
              💾 Kaydet
            </button>
            <button
              onClick={handleDeleteRecords}
              disabled={selectedRecords.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded shadow-lg hover:shadow-xl transition-all bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🗑️ Seçilenleri Sil
            </button>
            <div className="flex-1" />
            {selectedRecords.length > 0 && (
              <span className="text-sm text-gray-600 font-semibold">
                {selectedRecords.length} kayıt seçildi
              </span>
            )}
            <div className="text-right">
              <p className="text-xs text-gray-500">Toplam Miktar</p>
              <p className="text-lg font-bold text-blue-600">
                {totalMiktar} / {selectedItem.quantity}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UTSModal



