'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { getDog, updateDog } from '../../../lib/api'
import { Loader2, Save, X, Edit3, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { motion } from 'framer-motion'
import HealthRecordsPanel from '../../components/HealthRecordsPanel'

export default function EditDogClient({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<any>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [dogName, setDogName] = useState('')
  const [tab, setTab] = useState<'profile' | 'health'>('profile')

  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('Male')
  const [colorMarkings, setColorMarkings] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [microchipId, setMicrochipId] = useState('')
  const [notes, setNotes] = useState('')
  const [behaviourNotes, setBehaviourNotes] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [vetName, setVetName] = useState('')
  const [vetPhone, setVetPhone] = useState('')

  useEffect(() => {
    const fetchDog = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return }
        setSessionToken(session.access_token)
        const dog = await getDog(id, session.access_token)
        setName(dog.name || ''); setDogName(dog.name || '')
        setBreed(dog.breed || ''); setAge(dog.age !== null ? String(dog.age) : '')
        setSex(dog.sex || 'Male'); setColorMarkings(dog.color_markings || '')
        setOwnerName(dog.owner_name || ''); setOwnerPhone(dog.owner_phone || '')
        setOwnerEmail(dog.owner_email || ''); setMicrochipId(dog.microchip_id || '')
        setNotes(dog.notes || '')
        setBehaviourNotes(dog.behaviour_notes || '')
        setEmergencyName(dog.emergency_contact_name || '')
        setEmergencyPhone(dog.emergency_contact_phone || '')
        setVetName(dog.vet_name || '')
        setVetPhone(dog.vet_phone || '')
      } catch (err) {
        setError(err)
        toast.error('Failed to load dog profile')
      } finally {
        setLoading(false)
      }
    }
    fetchDog()
  }, [id, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !sessionToken) return
    setSaving(true)
    try {
      await updateDog(id, {
        name, breed: breed || null, age: age === '' ? null : Number(age), sex,
        color_markings: colorMarkings || null, owner_name: ownerName || null,
        owner_phone: ownerPhone || null, owner_email: ownerEmail || null,
        microchip_id: microchipId || null, notes: notes || null,
        behaviour_notes: behaviourNotes || null,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
        vet_name: vetName || null,
        vet_phone: vetPhone || null,
      }, sessionToken)
      toast.success('SYS_UPDATE_OK')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-accent-blue" /></div>

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h2 className="text-xl font-display font-bold text-accent-red uppercase tracking-wide mb-2">Data Retrieval Failed</h2>
      <p className="font-mono text-text-muted mb-8 text-xs uppercase tracking-widest">ERR_CODE: READ_FAULT</p>
      <Link href="/dashboard" className="btn-ghost py-3 px-8 text-sm tracking-widest uppercase">Return to Dashboard</Link>
    </div>
  )

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-10 flex flex-col items-center text-center border-b border-border pb-6">
          <Link href="/dashboard" className="font-mono text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-2 uppercase tracking-widest mb-6">
            <ChevronLeft className="w-3 h-3" /> ABORT EDIT
          </Link>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-background border border-border flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-accent-blue" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold uppercase tracking-tight text-text-primary">Modify Subject</h1>
              <p className="font-mono text-xs text-text-muted uppercase tracking-widest mt-2">ID_REF: {dogName}</p>
            </div>
          </div>
        </motion.div>

        {/* NEW: tab bar */}
        <div className="flex gap-2 mb-6 border-b border-border">
          {(['profile', 'health'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {t === 'profile' ? 'Profile' : 'Health Records'}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
        <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} onSubmit={handleSubmit} className="space-y-6">

          {/* Basic Info */}
          <div className="bg-surface border border-border p-8 shadow-brutalist space-y-6">
            <h3 className="text-xs font-mono font-bold text-text-muted uppercase tracking-widest border-b border-border pb-4">Subject Metadata</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="field-label">Primary Identifier (Name) *</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="input-base" placeholder="e.g. Max" />
              </div>
              <div>
                <label className="field-label">Morphological Class (Breed)</label>
                <input type="text" value={breed} onChange={e => setBreed(e.target.value)} className="input-base" placeholder="e.g. Golden Retriever" />
              </div>
              <div>
                <label className="field-label">Age (Years)</label>
                <input type="number" step="0.1" min="0" value={age} onChange={e => setAge(e.target.value)} className="input-base" placeholder="e.g. 2.5" />
              </div>
              <div>
                <label className="field-label">Biological Sex</label>
                <select value={sex} onChange={e => setSex(e.target.value)} className="input-base appearance-none">
                  <option value="Male">MALE</option>
                  <option value="Female">FEMALE</option>
                  <option value="Unknown">UNKNOWN</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="field-label">Phenotype (Color/Markings)</label>
                <input type="text" value={colorMarkings} onChange={e => setColorMarkings(e.target.value)} className="input-base" placeholder="e.g. Fawn with black mask" />
              </div>
            </div>
          </div>

          {/* Owner Contact */}
          <div className="bg-surface border border-border p-8 shadow-brutalist space-y-6">
            <h3 className="text-xs font-mono font-bold text-text-muted uppercase tracking-widest border-b border-border pb-4">Associated Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="field-label">Full Name</label>
                <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} className="input-base" placeholder="e.g. Jane Doe" />
              </div>
              <div>
                <label className="field-label">Phone Coordinates</label>
                <input type="tel" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} className="input-base" placeholder="+1 555-1234" />
              </div>
              <div>
                <label className="field-label">Email Coordinates</label>
                <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} className="input-base" placeholder="jane@example.com" />
              </div>
            </div>
          </div>

          {/* Additional */}
          <div className="bg-surface border border-border p-8 shadow-brutalist space-y-6">
            <h3 className="text-xs font-mono font-bold text-text-muted uppercase tracking-widest border-b border-border pb-4">Supplementary Data</h3>
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="field-label">External Hardware ID (Microchip)</label>
                <input type="text" value={microchipId} onChange={e => setMicrochipId(e.target.value)} className="input-base" placeholder="e.g. 985141002345678" />
              </div>
              <div>
                <label className="field-label">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-base resize-none" placeholder="Medical conditions, distinct behavior..." />
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border p-8 shadow-brutalist space-y-6 pt-4 mt-6">
            <h3 className="text-xs font-mono font-bold text-text-muted uppercase tracking-widest border-b border-border pb-4">
              Emergency &amp; Behaviour
            </h3>

            <div className="space-y-1">
              <label className="field-label">Behaviour Notes</label>
              <textarea
                value={behaviourNotes}
                onChange={e => setBehaviourNotes(e.target.value)}
                rows={3}
                className="input-base resize-none"
                placeholder="e.g. Friendly, but nervous around loud noises. Do not let him off-leash."
              />
              <p className="text-xs text-text-muted">
                Shown to anyone who finds your dog.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="field-label">Emergency Contact Name</label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={e => setEmergencyName(e.target.value)}
                  className="input-base"
                  placeholder="e.g. Michael Chen"
                />
              </div>
              <div className="space-y-1">
                <label className="field-label">Emergency Phone</label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={e => setEmergencyPhone(e.target.value)}
                  className="input-base"
                  placeholder="+1 (555) 987-6543"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="field-label">Vet Name</label>
                <input
                  type="text"
                  value={vetName}
                  onChange={e => setVetName(e.target.value)}
                  className="input-base"
                  placeholder="e.g. Riverside Animal Hospital"
                />
              </div>
              <div className="space-y-1">
                <label className="field-label">Vet Phone</label>
                <input
                  type="tel"
                  value={vetPhone}
                  onChange={e => setVetPhone(e.target.value)}
                  className="input-base"
                  placeholder="+1 (555) 222-3333"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href="/dashboard" className="btn-ghost flex-1 py-4 justify-center text-sm tracking-widest uppercase">
              ABORT
            </Link>
            <button disabled={!name || saving} type="submit" className="btn-primary flex-1 py-4 justify-center text-sm tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2 inline-block" /> : null}
              {saving ? 'WRITING DATA...' : 'COMMIT CHANGES'}
            </button>
          </div>
        </motion.form>
        )}

        {tab === 'health' && (
          !sessionToken ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
            </div>
          ) : (
            <HealthRecordsPanel dogId={id} token={sessionToken} />
          )
        )}
      </div>
    </div>
  )
}
