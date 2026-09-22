'use client'
import { use, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { getDog, API_URL } from '../../../lib/api'
import {
  Loader2, PawPrint, Phone, Mail, ChevronLeft, Edit3, Plus,
  Syringe, Pill, Stethoscope, Weight, AlertTriangle, Trash2, X, Save
} from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

type Tab = 'profile' | 'health'

interface Dog {
  id: string
  name: string
  breed?: string
  age?: number
  sex?: string
  color_markings?: string
  owner_name?: string
  owner_phone?: string
  owner_email?: string
  microchip_id?: string
  notes?: string
  profile_photo_url?: string
  created_at: string
}

interface Vaccination { id: string; vaccine_name: string; date_given: string; next_due?: string; notes?: string }
interface Medication { id: string; name: string; dosage?: string; frequency?: string; start_date?: string; end_date?: string; notes?: string }
interface MedicalVisit { id: string; visit_date: string; reason?: string; vet_name?: string; diagnosis?: string; notes?: string }
interface WeightLog { id: string; weight_kg: number; logged_at: string; notes?: string }
interface Allergy { id: string; allergen: string; severity?: string; notes?: string }

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function DogProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [tab, setTab] = useState<Tab>('profile')
  const [dog, setDog] = useState<Dog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)
  const [isOwner, setIsOwner] = useState(false)

  // Health data
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [visits, setVisits] = useState<MedicalVisit[]>([])
  const [weights, setWeights] = useState<WeightLog[]>([])
  const [allergies, setAllergies] = useState<Allergy[]>([])
  const [healthLoading, setHealthLoading] = useState(false)

  // Add forms
  const [showAddVaccine, setShowAddVaccine] = useState(false)
  const [showAddMed, setShowAddMed] = useState(false)
  const [showAddVisit, setShowAddVisit] = useState(false)
  const [showAddWeight, setShowAddWeight] = useState(false)
  const [showAddAllergy, setShowAddAllergy] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      try {
        const dogData = await getDog(id, session?.access_token || '')
        setDog(dogData)
        // Check ownership via Supabase auth uid matching dog's owner field
        if (session) {
          const { data } = await supabase
            .schema('dognose')
            .from('dogs')
            .select('owner')
            .eq('id', id)
            .single()
          if (data?.owner === session.user.id) setIsOwner(true)
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load dog profile')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id])

  useEffect(() => {
    if (tab === 'health' && isOwner && session) {
      fetchHealthData()
    }
  }, [tab, isOwner, session])

  const fetchHealthData = async () => {
    setHealthLoading(true)
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const [v, m, vis, w, a] = await Promise.all([
        fetch(`${API_URL}/dogs/${id}/vaccinations`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/dogs/${id}/medications`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/dogs/${id}/medical-visits`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/dogs/${id}/weight-logs`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/dogs/${id}/allergies`, { headers }).then(r => r.json()),
      ])
      setVaccinations(Array.isArray(v) ? v : [])
      setMedications(Array.isArray(m) ? m : [])
      setVisits(Array.isArray(vis) ? vis : [])
      setWeights(Array.isArray(w) ? w : [])
      setAllergies(Array.isArray(a) ? a : [])
    } catch {
      toast.error('Failed to load health records')
    } finally {
      setHealthLoading(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>

  if (error || !dog) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h2 className="text-xl font-bold text-[var(--color-error)] mb-2">Profile not found</h2>
      <p className="text-[var(--color-muted)] mb-6 text-sm">{error || "We couldn't find this dog's profile."}</p>
      <Link href="/" className="btn-ghost py-2.5 px-6 rounded-xl">Go Home</Link>
    </div>
  )

  // Public allergy & vaccination summary
  const allergyNames = allergies.length > 0 ? allergies.map(a => a.allergen).join(', ') : null
  const vaccinationStatus = vaccinations.length === 0 ? null :
    vaccinations.some(v => v.next_due && new Date(v.next_due) < new Date()) ? 'Overdue' : 'Up to date'
  const latestWeight = weights.length > 0 ? weights.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())[0] : null

  return (
    <div className="min-h-screen w-full max-w-2xl mx-auto px-4 py-10">

      {/* Back */}
      <div className="mb-6">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Dog hero card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden mb-6">
        {/* Photo */}
        <div className="w-full aspect-[16/7] bg-[var(--color-surface-2)] overflow-hidden">
          {dog.profile_photo_url ? (
            <img src={dog.profile_photo_url} alt={dog.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <PawPrint className="w-12 h-12 text-[var(--color-muted)] opacity-20" />
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold font-display mb-1">{dog.name}</h1>
              {dog.breed && <p className="text-[var(--color-muted)]">{dog.breed}</p>}
            </div>
            {isOwner && (
              <Link href={`/edit/${id}`} className="btn-ghost py-2 px-4 rounded-xl text-sm shrink-0">
                <Edit3 className="w-4 h-4" /> Edit
              </Link>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {dog.age && <span className="badge badge-accent">{dog.age} yrs</span>}
            {dog.sex && <span className="badge badge-accent">{dog.sex}</span>}
            {dog.color_markings && <span className="badge badge-accent">{dog.color_markings}</span>}
            {dog.microchip_id && <span className="badge badge-accent">Chip: {dog.microchip_id}</span>}
          </div>

          {/* Public health summary */}
          {(allergyNames || vaccinationStatus || latestWeight) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[var(--color-border)]">
              {allergyNames && (
                <div className="flex items-start gap-2 p-3 bg-[var(--color-warn)]/5 border border-[var(--color-warn)]/20 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-[var(--color-warn)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-warn)] mb-0.5">Allergies</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{allergyNames}</p>
                  </div>
                </div>
              )}
              {vaccinationStatus && (
                <div className={`flex items-start gap-2 p-3 rounded-xl border ${vaccinationStatus === 'Up to date' ? 'bg-[var(--color-success)]/5 border-[var(--color-success)]/20' : 'bg-[var(--color-error)]/5 border-[var(--color-error)]/20'}`}>
                  <Syringe className={`w-4 h-4 shrink-0 mt-0.5 ${vaccinationStatus === 'Up to date' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`} />
                  <div>
                    <p className={`text-xs font-semibold mb-0.5 ${vaccinationStatus === 'Up to date' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>Vaccinations</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{vaccinationStatus}</p>
                  </div>
                </div>
              )}
              {latestWeight && (
                <div className="flex items-start gap-2 p-3 bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 rounded-xl">
                  <Weight className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-accent)] mb-0.5">Last Weight</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{latestWeight.weight_kg} kg</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Owner contact */}
      {(dog.owner_name || dog.owner_phone || dog.owner_email) && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-5 mb-6">
          <p className="field-label mb-4">Owner Contact</p>
          <div className="space-y-3">
            {dog.owner_name && <p className="font-medium">{dog.owner_name}</p>}
            {dog.owner_phone && (
              <a href={`tel:${dog.owner_phone}`} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                <Phone className="w-4 h-4 text-[var(--color-accent)]" /> {dog.owner_phone}
              </a>
            )}
            {dog.owner_email && (
              <a href={`mailto:${dog.owner_email}`} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                <Mail className="w-4 h-4 text-[var(--color-accent)]" /> {dog.owner_email}
              </a>
            )}
          </div>
        </motion.div>
      )}

      {/* Tabs — only show if logged in */}
      {session && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl mb-6">
            {(['profile', 'health'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`tab-btn flex-1 capitalize ${tab === t ? 'active' : ''}`}
              >
                {t === 'profile' ? 'Profile' : 'Health Records'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* PROFILE TAB */}
            {tab === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {dog.notes && (
                  <div className="card p-5">
                    <p className="field-label mb-2">Notes</p>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{dog.notes}</p>
                  </div>
                )}
                <div className="card p-5">
                  <p className="field-label mb-2">Enrolled</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{formatDate(dog.created_at)}</p>
                </div>
              </motion.div>
            )}

            {/* HEALTH TAB — owner only */}
            {tab === 'health' && (
              <motion.div key="health" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {!isOwner ? (
                  <div className="card p-8 text-center">
                    <p className="text-[var(--color-muted)] text-sm">Health records are only visible to the dog&apos;s owner.</p>
                  </div>
                ) : healthLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
                  </div>
                ) : (
                  <div className="space-y-5">

                    {/* Allergies */}
                    <HealthSection
                      title="Allergies"
                      icon={<AlertTriangle className="w-4 h-4 text-[var(--color-warn)]" />}
                      onAdd={() => setShowAddAllergy(!showAddAllergy)}
                    >
                      {showAddAllergy && <AddAllergyForm dogId={id} token={session.access_token} onSaved={(a) => { setAllergies(p => [...p, a]); setShowAddAllergy(false) }} onCancel={() => setShowAddAllergy(false)} />}
                      {allergies.length === 0 && !showAddAllergy && <EmptyState message="No allergies recorded" />}
                      {allergies.map(a => (
                        <HealthItem key={a.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-sm">{a.allergen}</p>
                              {a.severity && <span className={`badge mt-1 ${a.severity === 'Severe' ? 'badge-error' : a.severity === 'Moderate' ? 'badge-warn' : 'badge-accent'}`}>{a.severity}</span>}
                              {a.notes && <p className="text-xs text-[var(--color-muted)] mt-1">{a.notes}</p>}
                            </div>
                          </div>
                        </HealthItem>
                      ))}
                    </HealthSection>

                    {/* Vaccinations */}
                    <HealthSection
                      title="Vaccinations"
                      icon={<Syringe className="w-4 h-4 text-[var(--color-success)]" />}
                      onAdd={() => setShowAddVaccine(!showAddVaccine)}
                    >
                      {showAddVaccine && <AddVaccineForm dogId={id} token={session.access_token} onSaved={(v) => { setVaccinations(p => [...p, v]); setShowAddVaccine(false) }} onCancel={() => setShowAddVaccine(false)} />}
                      {vaccinations.length === 0 && !showAddVaccine && <EmptyState message="No vaccinations recorded" />}
                      {vaccinations.map(v => (
                        <HealthItem key={v.id}>
                          <p className="font-medium text-sm">{v.vaccine_name}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-xs text-[var(--color-muted)]">Given: {formatDate(v.date_given)}</span>
                            {v.next_due && <span className={`text-xs ${new Date(v.next_due) < new Date() ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]'}`}>Due: {formatDate(v.next_due)}</span>}
                          </div>
                          {v.notes && <p className="text-xs text-[var(--color-muted)] mt-1">{v.notes}</p>}
                        </HealthItem>
                      ))}
                    </HealthSection>

                    {/* Medications */}
                    <HealthSection
                      title="Medications"
                      icon={<Pill className="w-4 h-4 text-[var(--color-accent-2)]" />}
                      onAdd={() => setShowAddMed(!showAddMed)}
                    >
                      {showAddMed && <AddMedForm dogId={id} token={session.access_token} onSaved={(m) => { setMedications(p => [...p, m]); setShowAddMed(false) }} onCancel={() => setShowAddMed(false)} />}
                      {medications.length === 0 && !showAddMed && <EmptyState message="No medications recorded" />}
                      {medications.map(m => (
                        <HealthItem key={m.id}>
                          <p className="font-medium text-sm">{m.name}</p>
                          <div className="flex flex-wrap gap-3 mt-1">
                            {m.dosage && <span className="text-xs text-[var(--color-muted)]">Dose: {m.dosage}</span>}
                            {m.frequency && <span className="text-xs text-[var(--color-muted)]">{m.frequency}</span>}
                          </div>
                          {m.notes && <p className="text-xs text-[var(--color-muted)] mt-1">{m.notes}</p>}
                        </HealthItem>
                      ))}
                    </HealthSection>

                    {/* Medical Visits */}
                    <HealthSection
                      title="Medical Visits"
                      icon={<Stethoscope className="w-4 h-4 text-[var(--color-accent)]" />}
                      onAdd={() => setShowAddVisit(!showAddVisit)}
                    >
                      {showAddVisit && <AddVisitForm dogId={id} token={session.access_token} onSaved={(v) => { setVisits(p => [...p, v]); setShowAddVisit(false) }} onCancel={() => setShowAddVisit(false)} />}
                      {visits.length === 0 && !showAddVisit && <EmptyState message="No visits recorded" />}
                      {visits.map(v => (
                        <HealthItem key={v.id}>
                          <p className="font-medium text-sm">{v.reason || 'Vet Visit'}</p>
                          <p className="text-xs text-[var(--color-muted)] mt-0.5">{formatDate(v.visit_date)}{v.vet_name ? ` · ${v.vet_name}` : ''}</p>
                          {v.diagnosis && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{v.diagnosis}</p>}
                          {v.notes && <p className="text-xs text-[var(--color-muted)] mt-1">{v.notes}</p>}
                        </HealthItem>
                      ))}
                    </HealthSection>

                    {/* Weight Log */}
                    <HealthSection
                      title="Weight Log"
                      icon={<Weight className="w-4 h-4 text-[var(--color-accent)]" />}
                      onAdd={() => setShowAddWeight(!showAddWeight)}
                    >
                      {showAddWeight && <AddWeightForm dogId={id} token={session.access_token} onSaved={(w) => { setWeights(p => [...p, w]); setShowAddWeight(false) }} onCancel={() => setShowAddWeight(false)} />}
                      {weights.length === 0 && !showAddWeight && <EmptyState message="No weight entries recorded" />}
                      {weights.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()).map(w => (
                        <HealthItem key={w.id}>
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{w.weight_kg} kg</p>
                            <p className="text-xs text-[var(--color-muted)]">{formatDate(w.logged_at)}</p>
                          </div>
                          {w.notes && <p className="text-xs text-[var(--color-muted)] mt-1">{w.notes}</p>}
                        </HealthItem>
                      ))}
                    </HealthSection>

                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* If not logged in — show note about health records */}
      {!session && (
        <div className="card p-5 mt-4 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            <Link href="/login" className="text-[var(--color-accent)] hover:underline">Sign in</Link> to view and manage full health records for this dog.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────

function HealthSection({ title, icon, onAdd, children }: { title: string; icon: React.ReactNode; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <button onClick={onAdd} className="w-7 h-7 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="divide-y divide-[var(--color-border)]">{children}</div>
    </div>
  )
}

function HealthItem({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-4 hover:bg-[var(--color-surface-2)] transition-colors">{children}</div>
}

function EmptyState({ message }: { message: string }) {
  return <div className="px-5 py-6 text-center text-xs text-[var(--color-muted)]">{message}</div>
}

// ─── Add forms ────────────────────────────────────────────────

function AddVaccineForm({ dogId, token, onSaved, onCancel }: { dogId: string; token: string; onSaved: (v: any) => void; onCancel: () => void }) {
  const [name, setName] = useState(''); const [date, setDate] = useState(''); const [due, setDue] = useState(''); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!name || !date) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/dogs/${dogId}/vaccinations`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ vaccine_name: name, date_given: date, next_due: due || null, notes: notes || null }) })
      const data = await res.json(); onSaved(data); toast.success('Vaccination added')
    } catch { toast.error('Failed to add vaccination') } finally { setSaving(false) }
  }
  return (
    <div className="px-5 py-4 bg-[var(--color-surface-2)] space-y-3 border-b border-[var(--color-border)]">
      <input placeholder="Vaccine name *" value={name} onChange={e => setName(e.target.value)} className="input-base text-sm" />
      <div className="grid grid-cols-2 gap-3">
        <input type="date" placeholder="Date given *" value={date} onChange={e => setDate(e.target.value)} className="input-base text-sm" />
        <input type="date" placeholder="Next due" value={due} onChange={e => setDue(e.target.value)} className="input-base text-sm" />
      </div>
      <input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="input-base text-sm" />
      <div className="flex gap-2"><button onClick={save} disabled={saving || !name || !date} className="btn-primary text-xs py-2 px-4 rounded-lg">{saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3" /> Save</>}</button><button onClick={onCancel} className="btn-ghost text-xs py-2 px-4 rounded-lg"><X className="w-3 h-3" /> Cancel</button></div>
    </div>
  )
}

function AddMedForm({ dogId, token, onSaved, onCancel }: { dogId: string; token: string; onSaved: (m: any) => void; onCancel: () => void }) {
  const [name, setName] = useState(''); const [dosage, setDosage] = useState(''); const [freq, setFreq] = useState(''); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!name) return; setSaving(true)
    try {
      const res = await fetch(`${API_URL}/dogs/${dogId}/medications`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, dosage: dosage || null, frequency: freq || null, notes: notes || null }) })
      const data = await res.json(); onSaved(data); toast.success('Medication added')
    } catch { toast.error('Failed to add medication') } finally { setSaving(false) }
  }
  return (
    <div className="px-5 py-4 bg-[var(--color-surface-2)] space-y-3 border-b border-[var(--color-border)]">
      <input placeholder="Medication name *" value={name} onChange={e => setName(e.target.value)} className="input-base text-sm" />
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Dosage (e.g. 10mg)" value={dosage} onChange={e => setDosage(e.target.value)} className="input-base text-sm" />
        <input placeholder="Frequency (e.g. Daily)" value={freq} onChange={e => setFreq(e.target.value)} className="input-base text-sm" />
      </div>
      <input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="input-base text-sm" />
      <div className="flex gap-2"><button onClick={save} disabled={saving || !name} className="btn-primary text-xs py-2 px-4 rounded-lg">{saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3" /> Save</>}</button><button onClick={onCancel} className="btn-ghost text-xs py-2 px-4 rounded-lg"><X className="w-3 h-3" /> Cancel</button></div>
    </div>
  )
}

function AddVisitForm({ dogId, token, onSaved, onCancel }: { dogId: string; token: string; onSaved: (v: any) => void; onCancel: () => void }) {
  const [date, setDate] = useState(''); const [reason, setReason] = useState(''); const [vet, setVet] = useState(''); const [diagnosis, setDiagnosis] = useState(''); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!date) return; setSaving(true)
    try {
      const res = await fetch(`${API_URL}/dogs/${dogId}/medical-visits`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ visit_date: date, reason: reason || null, vet_name: vet || null, diagnosis: diagnosis || null, notes: notes || null }) })
      const data = await res.json(); onSaved(data); toast.success('Visit added')
    } catch { toast.error('Failed to add visit') } finally { setSaving(false) }
  }
  return (
    <div className="px-5 py-4 bg-[var(--color-surface-2)] space-y-3 border-b border-[var(--color-border)]">
      <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-base text-sm" />
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} className="input-base text-sm" />
        <input placeholder="Vet name" value={vet} onChange={e => setVet(e.target.value)} className="input-base text-sm" />
      </div>
      <input placeholder="Diagnosis (optional)" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className="input-base text-sm" />
      <input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="input-base text-sm" />
      <div className="flex gap-2"><button onClick={save} disabled={saving || !date} className="btn-primary text-xs py-2 px-4 rounded-lg">{saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3" /> Save</>}</button><button onClick={onCancel} className="btn-ghost text-xs py-2 px-4 rounded-lg"><X className="w-3 h-3" /> Cancel</button></div>
    </div>
  )
}

function AddWeightForm({ dogId, token, onSaved, onCancel }: { dogId: string; token: string; onSaved: (w: any) => void; onCancel: () => void }) {
  const [kg, setKg] = useState(''); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!kg) return; setSaving(true)
    try {
      const res = await fetch(`${API_URL}/dogs/${dogId}/weight-logs`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ weight_kg: Number(kg), notes: notes || null }) })
      const data = await res.json(); onSaved(data); toast.success('Weight logged')
    } catch { toast.error('Failed to log weight') } finally { setSaving(false) }
  }
  return (
    <div className="px-5 py-4 bg-[var(--color-surface-2)] space-y-3 border-b border-[var(--color-border)]">
      <input type="number" step="0.1" placeholder="Weight in kg *" value={kg} onChange={e => setKg(e.target.value)} className="input-base text-sm" />
      <input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="input-base text-sm" />
      <div className="flex gap-2"><button onClick={save} disabled={saving || !kg} className="btn-primary text-xs py-2 px-4 rounded-lg">{saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3" /> Save</>}</button><button onClick={onCancel} className="btn-ghost text-xs py-2 px-4 rounded-lg"><X className="w-3 h-3" /> Cancel</button></div>
    </div>
  )
}

function AddAllergyForm({ dogId, token, onSaved, onCancel }: { dogId: string; token: string; onSaved: (a: any) => void; onCancel: () => void }) {
  const [allergen, setAllergen] = useState(''); const [severity, setSeverity] = useState('Mild'); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!allergen) return; setSaving(true)
    try {
      const res = await fetch(`${API_URL}/dogs/${dogId}/allergies`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ allergen, severity, notes: notes || null }) })
      const data = await res.json(); onSaved(data); toast.success('Allergy added')
    } catch { toast.error('Failed to add allergy') } finally { setSaving(false) }
  }
  return (
    <div className="px-5 py-4 bg-[var(--color-surface-2)] space-y-3 border-b border-[var(--color-border)]">
      <input placeholder="Allergen (e.g. Pollen, Chicken) *" value={allergen} onChange={e => setAllergen(e.target.value)} className="input-base text-sm" />
      <select value={severity} onChange={e => setSeverity(e.target.value)} className="input-base text-sm appearance-none">
        <option value="Mild">Mild</option>
        <option value="Moderate">Moderate</option>
        <option value="Severe">Severe</option>
      </select>
      <input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="input-base text-sm" />
      <div className="flex gap-2"><button onClick={save} disabled={saving || !allergen} className="btn-primary text-xs py-2 px-4 rounded-lg">{saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3" /> Save</>}</button><button onClick={onCancel} className="btn-ghost text-xs py-2 px-4 rounded-lg"><X className="w-3 h-3" /> Cancel</button></div>
    </div>
  )
}
