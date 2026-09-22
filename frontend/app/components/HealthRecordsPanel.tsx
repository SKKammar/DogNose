'use client'
import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  listHealthRecords, createHealthRecord, deleteHealthRecord,
  type HealthRecordType,
} from '../../lib/api'

type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'select'

interface FieldConfig {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  step?: string
}

interface SectionConfig {
  key: HealthRecordType
  label: string
  fields: FieldConfig[]
  display: (r: any) => { primary: string; secondary?: string; badge?: { text: string; tone: 'warn' | 'ok' | 'muted' } }
}

const SECTIONS: SectionConfig[] = [
  {
    key: 'allergies',
    label: 'Allergies',
    fields: [
      { key: 'allergen', label: 'Allergen', type: 'text', required: true },
      { key: 'severity', label: 'Severity', type: 'select', options: ['mild', 'moderate', 'severe'] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    display: r => ({
      primary: r.allergen,
      secondary: r.notes,
      badge: r.severity ? {
        text: r.severity,
        tone: r.severity === 'severe' ? 'warn' : r.severity === 'moderate' ? 'warn' : 'muted',
      } : undefined,
    }),
  },
  {
    key: 'vaccinations',
    label: 'Vaccinations',
    fields: [
      { key: 'vaccine_name', label: 'Vaccine', type: 'text', required: true },
      { key: 'date_given', label: 'Date Given', type: 'date' },
      { key: 'next_due', label: 'Next Due', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    display: r => ({
      primary: r.vaccine_name,
      secondary: [r.date_given && `Given ${r.date_given}`, r.next_due && `Due ${r.next_due}`]
        .filter(Boolean).join(' · '),
      badge: r.next_due && new Date(r.next_due) < new Date()
        ? { text: 'overdue', tone: 'warn' }
        : undefined,
    }),
  },
  {
    key: 'medications',
    label: 'Medications',
    fields: [
      { key: 'name', label: 'Medication', type: 'text', required: true },
      { key: 'dosage', label: 'Dosage', type: 'text' },
      { key: 'frequency', label: 'Frequency', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    display: r => ({
      primary: r.name,
      secondary: [r.dosage, r.frequency].filter(Boolean).join(' · '),
    }),
  },
  {
    key: 'visits',
    label: 'Medical Visits',
    fields: [
      { key: 'visit_date', label: 'Visit Date', type: 'date' },
      { key: 'reason', label: 'Reason', type: 'text' },
      { key: 'vet_name', label: 'Vet Name', type: 'text' },
      { key: 'diagnosis', label: 'Diagnosis', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    display: r => ({
      primary: r.reason || r.diagnosis || 'Visit',
      secondary: [r.visit_date, r.vet_name].filter(Boolean).join(' · '),
    }),
  },
  {
    key: 'weights',
    label: 'Weight Log',
    fields: [
      { key: 'weight_kg', label: 'Weight (kg)', type: 'number', required: true, step: '0.1' },
      { key: 'measured_at', label: 'Date', type: 'date', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    display: r => ({
      primary: `${r.weight_kg} kg`,
      secondary: r.measured_at,
    }),
  },
]

export default function HealthRecordsPanel({ dogId, token }: { dogId: string; token: string }) {
  return (
    <div className="space-y-4">
      {SECTIONS.map(s => (
        <Section key={s.key} section={s} dogId={dogId} token={token} />
      ))}
    </div>
  )
}

function Section({ section, dogId, token }: { section: SectionConfig; dogId: string; token: string }) {
  const [open, setOpen] = useState(false)
  const [records, setRecords] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await listHealthRecords(dogId, section.key, token)
      setRecords(Array.isArray(data) ? data : [])
    } catch (e: any) {
      toast.error(`Failed to load ${section.label.toLowerCase()}`)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && records === null) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return
    try {
      await deleteHealthRecord(dogId, section.key, id, token)
      setRecords(prev => (prev || []).filter(r => r.id !== id))
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleCreated = (record: any) => {
    setRecords(prev => [record, ...(prev || [])])
    setShowForm(false)
    toast.success('Added')
  }

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-background/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
          <span className="font-semibold text-text-primary">{section.label}</span>
          {records !== null && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-background border border-border text-text-muted">
              {records.length}
            </span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-border pt-4 space-y-3">
              {loading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-accent-blue" />
                </div>
              )}

              {!loading && records && records.length === 0 && !showForm && (
                <p className="text-sm text-text-muted py-3">
                  No {section.label.toLowerCase()} recorded yet.
                </p>
              )}

              {!loading && records && records.map(r => {
                const d = section.display(r)
                return (
                  <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl bg-background/60 border border-border/60 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-text-primary">{d.primary}</span>
                        {d.badge && (
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                            d.badge.tone === 'warn'
                              ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/20'
                              : 'bg-background text-text-muted border-border'
                          }`}>
                            {d.badge.text}
                          </span>
                        )}
                      </div>
                      {d.secondary && (
                        <p className="text-xs text-text-muted mt-1">{d.secondary}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}

              {showForm ? (
                <InlineForm
                  fields={section.fields}
                  onSubmit={async body => {
                    const created = await createHealthRecord(dogId, section.key, body, token)
                    handleCreated(created)
                  }}
                  onCancel={() => setShowForm(false)}
                />
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 text-sm text-accent-blue hover:text-white font-medium py-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add {section.label.replace(/s$/, '')}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function InlineForm({
  fields, onSubmit, onCancel,
}: {
  fields: FieldConfig[]
  onSubmit: (body: Record<string, any>) => Promise<void>
  onCancel: () => void
}) {
  const [values, setValues] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  const setField = (k: string, v: any) => setValues(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, any> = {}
      for (const f of fields) {
        const v = values[f.key]
        if (v === undefined || v === '') continue
        body[f.key] = f.type === 'number' ? Number(v) : v
      }
      await onSubmit(body)
    } catch (err: any) {
      toast.error(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="p-4 rounded-xl bg-background border border-accent-blue/40 space-y-3"
    >
      {fields.map(f => (
        <div key={f.key}>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            {f.label}{f.required ? ' *' : ''}
          </label>
          {f.type === 'textarea' ? (
            <textarea
              required={f.required}
              value={values[f.key] ?? ''}
              onChange={e => setField(f.key, e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-blue resize-none"
            />
          ) : f.type === 'select' ? (
            <select
              required={f.required}
              value={values[f.key] ?? ''}
              onChange={e => setField(f.key, e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-blue appearance-none"
            >
              <option value="">—</option>
              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              required={f.required}
              type={f.type}
              step={f.step}
              value={values[f.key] ?? ''}
              onChange={e => setField(f.key, e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-blue"
            />
          )}
        </div>
      ))}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-border text-sm text-text-primary hover:bg-surface transition flex items-center justify-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2 rounded-lg bg-accent-blue text-white text-sm font-semibold hover:bg-blue-600 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </motion.form>
  )
}
