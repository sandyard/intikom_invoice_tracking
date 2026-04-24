'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { appendInvoiceStatusHistory } from '@/lib/invoice-history'

interface Customer {
  id: string
  name: string
}

interface ImportFormProps {
  customers: Customer[]
}

interface ParsedInvoice {
  invoice_number: string
  customer_name: string
  customer_address?: string
  customer_city?: string
  customer_pic?: string
  pic?: string
  invoice_date: string
  due_date?: string
  amount?: number
  description?: string
  isValid: boolean
  errors: string[]
}

const REQUIRED_COLUMNS = ['invoice_number', 'customer_name', 'invoice_date']
const OPTIONAL_COLUMNS = ['customer_address', 'customer_city', 'customer_pic', 'pic', 'due_date', 'amount', 'description']

export function ImportForm({ customers }: ImportFormProps) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedInvoice[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [rawHeaders, setRawHeaders] = useState<string[]>([])
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([])
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'done'>('upload')
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 })
  const [importErrors, setImportErrors] = useState<Array<{ row: number; invoice_number?: string; message: string }>>([])

  const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '_')

  const readCellAsString = (row: Record<string, unknown>, header: string | undefined) => {
    if (!header) return ''
    const v = row[header]
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
    if (v instanceof Date) return v.toISOString()
    return String(v)
  }

  const excelSerialToISODate = (serial: number) => {
    // Excel serial date -> JS date (date only)
    const parsed = XLSX.SSF.parse_date_code(serial)
    if (!parsed || !parsed.y || !parsed.m || !parsed.d) return ''
    const dt = new Date(parsed.y, parsed.m - 1, parsed.d)
    if (Number.isNaN(dt.getTime())) return ''
    return dt.toISOString().split('T')[0] as string
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)
    setImportErrors([])

    try {
      let data: Record<string, unknown>[] = []
      let headers: string[] = []

      if (selectedFile.name.endsWith('.csv')) {
        // Parse CSV
        const text = await selectedFile.text()
        const result = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
        })
        data = result.data
        headers = result.meta.fields || []
      } else if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        // Parse Excel
        const arrayBuffer = await selectedFile.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        // Use raw values to handle Excel serial dates & numbers reliably
        data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: '' })
        if (data.length > 0) {
          headers = Object.keys(data[0])
        }
      } else {
        setError('Please upload a CSV or Excel file')
        return
      }

      if (data.length === 0) {
        setError('The file appears to be empty')
        return
      }

      setRawHeaders(headers)
      setRawData(data)

      // Auto-map columns based on header names
      const autoMapping: Record<string, string> = {}
      const allColumns = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]
      
      headers.forEach((header) => {
        const normalized = normalizeHeader(header)
        const match = allColumns.find(col => 
          normalized.includes(col.replace(/_/g, '')) || 
          normalized === col ||
          col.includes(normalized)
        )
        if (match) {
          autoMapping[match] = header
        }
      })

      setColumnMapping(autoMapping)
      setStep('mapping')
    } catch (err) {
      setError('Failed to parse file. Please check the format.')
    }
  }, [])

  const handleMappingChange = (targetColumn: string, sourceColumn: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [targetColumn]: sourceColumn === 'none' ? '' : sourceColumn
    }))
  }

  const validateAndPreview = () => {
    // Check required columns are mapped
    const missingRequired = REQUIRED_COLUMNS.filter(col => !columnMapping[col])
    if (missingRequired.length > 0) {
      setError(`Missing required columns: ${missingRequired.join(', ')}`)
      return
    }

    // Parse and validate data
    const parsed: ParsedInvoice[] = rawData.map((row, index) => {
      const errors: string[] = []
      
      const invoice_number = readCellAsString(row, columnMapping['invoice_number']).trim()
      const customer_name = readCellAsString(row, columnMapping['customer_name']).trim()
      const invoice_date_raw_value = row[columnMapping['invoice_date']]
      const invoice_date_raw = readCellAsString(row, columnMapping['invoice_date']).trim()
      
      if (!invoice_number) errors.push('Missing invoice number')
      if (!customer_name) errors.push('Missing customer name')
      if (!invoice_date_raw) errors.push('Missing invoice date')

      // Parse date
      let invoice_date = ''
      if (invoice_date_raw) {
        if (typeof invoice_date_raw_value === 'number') {
          invoice_date = excelSerialToISODate(invoice_date_raw_value)
          if (!invoice_date) errors.push('Invalid invoice date format')
        } else {
          const parsed = new Date(invoice_date_raw)
          if (Number.isNaN(parsed.getTime())) {
            errors.push('Invalid invoice date format')
          } else {
            invoice_date = parsed.toISOString().split('T')[0]
          }
        }
      }

      // Parse amount
      let amount: number | undefined
      if (columnMapping['amount'] && row[columnMapping['amount']]) {
        const amountStr = readCellAsString(row, columnMapping['amount']).replace(/[^0-9.-]/g, '')
        amount = parseFloat(amountStr)
        if (isNaN(amount)) amount = undefined
      }

      // Parse due date
      let due_date: string | undefined
      if (columnMapping['due_date'] && row[columnMapping['due_date']]) {
        const dueRawValue = row[columnMapping['due_date']]
        const dueRaw = readCellAsString(row, columnMapping['due_date']).trim()
        if (typeof dueRawValue === 'number') {
          const iso = excelSerialToISODate(dueRawValue)
          if (iso) due_date = iso
        } else {
          const parsed = new Date(dueRaw)
          if (!Number.isNaN(parsed.getTime())) {
            due_date = parsed.toISOString().split('T')[0]
          }
        }
      }

      return {
        invoice_number,
        customer_name,
        customer_address: columnMapping['customer_address'] ? readCellAsString(row, columnMapping['customer_address']).trim() : undefined,
        customer_city: columnMapping['customer_city'] ? readCellAsString(row, columnMapping['customer_city']).trim() : undefined,
        customer_pic: columnMapping['customer_pic'] ? readCellAsString(row, columnMapping['customer_pic']).trim() : undefined,
        pic: columnMapping['pic'] ? readCellAsString(row, columnMapping['pic']).trim() : undefined,
        invoice_date,
        due_date,
        amount,
        description: columnMapping['description'] ? readCellAsString(row, columnMapping['description']).trim() : undefined,
        isValid: errors.length === 0,
        errors,
      }
    })

    setParsedData(parsed)
    setError(null)
    setStep('preview')
  }

  const handleImport = async () => {
    setStep('importing')
    const supabase = createClient()
    setImportErrors([])
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Authentication required')
      return
    }

    let success = 0
    let failed = 0
    const failures: Array<{ row: number; invoice_number?: string; message: string }> = []

    for (let i = 0; i < parsedData.length; i++) {
      const invoice = parsedData[i]
      if (!invoice.isValid) {
        failed++
        failures.push({
          row: i + 2,
          invoice_number: invoice.invoice_number || undefined,
          message: invoice.errors.join(', ') || 'Row is invalid',
        })
        continue
      }

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoice.invoice_number,
          customer_name: invoice.customer_name,
          customer_address: invoice.customer_address || null,
          customer_city: invoice.customer_city || null,
          customer_pic: invoice.customer_pic || null,
          pic: invoice.pic || null,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date || null,
          amount: invoice.amount || null,
          description: invoice.description || null,
          status: 'draft',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (error) {
        failed++
        failures.push({
          row: i + 2,
          invoice_number: invoice.invoice_number || undefined,
          message: error.message,
        })
      } else {
        success++
        if (data?.id) {
          await appendInvoiceStatusHistory(supabase as any, {
            invoice_id: data.id,
            old_status: null,
            new_status: 'draft',
            changed_by: user.id,
            notes: 'Imported invoice created',
            metadata: { action: 'import_invoice' },
          })
        }
      }
    }

    setImportResult({ success, failed })
    setImportErrors(failures)
    setStep('done')
  }

  const downloadTemplate = () => {
    const template = [
      {
        invoice_number: 'INV-001',
        customer_name: 'PT Example',
        customer_address: 'Jl. Contoh No. 123',
        customer_city: 'Jakarta',
        customer_pic: 'John Doe',
        pic: 'Andi (Finance)',
        invoice_date: '2024-01-15',
        due_date: '2024-02-15',
        amount: '1500000',
        description: 'Invoice for services',
      },
    ]
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'invoice_import_template.xlsx')
  }

  const reset = () => {
    setFile(null)
    setParsedData([])
    setColumnMapping({})
    setRawHeaders([])
    setRawData([])
    setStep('upload')
    setError(null)
    setImportResult({ success: 0, failed: 0 })
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Upload a CSV or Excel file containing your invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground">CSV or Excel files only</p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-center">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>
              Match your file columns to invoice fields. Fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{file?.name}</span>
              <span className="text-sm text-muted-foreground">({rawData.length} rows)</span>
              <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map((col) => (
                <div key={col} className="space-y-2">
                  <Label>
                    {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    {REQUIRED_COLUMNS.includes(col) && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Select
                    value={columnMapping[col] || 'none'}
                    onValueChange={(value) => handleMappingChange(col, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Not mapped --</SelectItem>
                      {rawHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Cancel</Button>
              <Button onClick={validateAndPreview}>Continue to Preview</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Import</CardTitle>
            <CardDescription>
              Review the data before importing. Rows with errors will be skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                {parsedData.filter(d => d.isValid).length} valid
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <AlertCircle className="h-4 w-4" />
                {parsedData.filter(d => !d.isValid).length} with errors
              </span>
            </div>

            <div className="border rounded-lg overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 100).map((row, index) => (
                    <TableRow key={index} className={!row.isValid ? 'bg-destructive/5' : ''}>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.invoice_number || '-'}</TableCell>
                      <TableCell>{row.customer_name || '-'}</TableCell>
                      <TableCell>{row.invoice_date || '-'}</TableCell>
                      <TableCell>
                        {row.amount 
                          ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(row.amount)
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {row.errors.length > 0 && (
                          <span className="text-sm text-destructive">{row.errors.join(', ')}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsedData.length > 100 && (
              <p className="text-sm text-muted-foreground text-center">
                Showing first 100 rows of {parsedData.length} total
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
              <Button 
                onClick={handleImport}
                disabled={parsedData.filter(d => d.isValid).length === 0}
              >
                Import {parsedData.filter(d => d.isValid).length} Invoices
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="font-medium">Importing invoices...</p>
            <p className="text-sm text-muted-foreground">Please wait, this may take a moment.</p>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Done */}
      {step === 'done' && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="p-3 rounded-full bg-green-100 w-fit mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-lg">Import Complete!</p>
              <p className="text-muted-foreground">
                Successfully imported {importResult.success} invoices.
                {importResult.failed > 0 && ` ${importResult.failed} failed.`}
              </p>
            </div>
            {importErrors.length > 0 && (
              <div className="mx-auto max-w-2xl text-left">
                <p className="text-sm font-medium mb-2">Import errors (first {Math.min(importErrors.length, 10)}):</p>
                <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  {importErrors.slice(0, 10).map((e) => (
                    <div key={`${e.row}-${e.invoice_number ?? ''}`} className="text-sm">
                      <span className="font-medium">Row {e.row}</span>
                      {e.invoice_number ? <span className="text-muted-foreground"> · {e.invoice_number}</span> : null}
                      <div className="text-muted-foreground">{e.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={reset}>Import More</Button>
              <Button onClick={() => router.push('/dashboard/invoices')}>View Invoices</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
