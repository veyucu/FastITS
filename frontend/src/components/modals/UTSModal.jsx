import { useState, useMemo, useRef, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { XCircle } from 'lucide-react'
import apiService from '../../services/apiService'

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
      width: 130,
      editable: true,
      cellEditor: 'agDateStringCellEditor',
      cellClass: 'text-center font-mono'
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

      // API'yi çağır
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
        cariKodu: document.customerCode,
        kullanici: JSON.parse(localStorage.getItem('user') || '{}').username || 'USER'
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
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleClose}
      onKeyDown={(e) => e.key === 'Escape' && handleClose()}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[90%] max-w-5xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">UTS Kayıtları</h2>
              <p className="text-sm text-red-100">{selectedItem.productName}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-red-100">Beklenen / Okutulan / Kalan</p>
                <p className="text-2xl font-bold">
                  <span className="text-red-100">{selectedItem.quantity}</span>
                  {' / '}
                  <span>{totalMiktar}</span>
                  {' / '}
                  <span className={totalMiktar >= selectedItem.quantity ? 'text-green-300' : 'text-yellow-300'}>
                    {selectedItem.quantity - totalMiktar}
                  </span>
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
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
            <div className={`mb-4 px-4 py-3 rounded-lg shadow-lg border-l-4 animate-pulse ${modalMessage.type === 'success'
              ? 'bg-green-50 border-green-500 text-green-800'
              : modalMessage.type === 'error'
                ? 'bg-red-50 border-red-500 text-red-800'
                : 'bg-yellow-50 border-yellow-500 text-yellow-800'
              }`}>
              <p className="font-semibold">{modalMessage.text}</p>
            </div>
          )}

          {/* Records Grid */}
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



