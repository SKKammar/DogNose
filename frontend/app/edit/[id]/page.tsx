'use client'
import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { getDog, updateDog } from '../../../lib/api'
import { Loader2, Save, X, Edit3, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function EditDogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<any>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [dogName, setDogName] = useState('')

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
        microchip_id: microchipId || null, notes: notes || null
      }, sessionToken)
      toast.success('Profile updated')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h2 className="text-xl font-bold text-[var(--color-error)] mb-2">Error loading profile</h2>
      <p className="text-[var(--color-muted)] mb-6 text-sm">We couldn&apos;t load the details for this dog.</p>
      <Link href="/dashboard" className="btn-ghost py-2.5 px-6 rounded-xl">Back to Dashboard</Link>
    </div>
  )

  return (
    <div className="min-h-screen w-full max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors mb-5">
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center">
            <Edit3 className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Edit Profile</h1>
            <p className="text-[var(--color-muted)] text-sm">Updating {dogName}</p>
          </div>
        </div>
      </motion.div>

      <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} onSubmit={handleSubmit} className="space-y-5">

        {/* Basic Info */}
        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-muted)] uppercase tracking-wider border-b border-[var(--color-border)] pb-3">Basic Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Dog&apos;s Name *</label>
              <input required type="text" value={name} onChange={e => setName(e.target.value)} className="input-base" placeholder="e.g. Max" />
            </div>
            <div>
              <label className="field-label">Breed</label>
              <input type="text" value={breed} onChange={e => setBreed(e.target.value)} className="input-base" placeholder="e.g. Golden Retriever" />
            </div>
            <div>
              <label className="field-label">Age (years)</label>
              <input type="number" step="0.1" min="0" value={age} onChange={e => setAge(e.target.value)} className="input-base" placeholder="e.g. 2.5" />
            </div>
            <div>
              <label className="field-label">Sex</label>
              <select value={sex} onChange={e => setSex(e.target.value)} className="input-base appearance-none">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="field-label">Color & Markings</label>
              <input type="text" value={colorMarkings} onChange={e => setColorMarkings(e.target.value)} className="input-base" placeholder="e.g. Fawn with black mask" />
            </div>
          </div>
        </div>

        {/* Owner Contact */}
        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-muted)] uppercase tracking-wider border-b border-[var(--color-border)] pb-3">Owner Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="field-label">Owner Name</label>
              <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} className="input-base" placeholder="e.g. Jane Doe" />
            </div>
            <div>
              <label className="field-label">Phone Number</label>
              <input type="tel" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} className="input-base" placeholder="+1 555-1234" />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} className="input-base" placeholder="jane@example.com" />
            </div>
          </div>
        </div>

        {/* Additional */}
        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-muted)] uppercase tracking-wider border-b border-[var(--color-border)] pb-3">Additional Details</h3>
          <div>
            <label className="field-label">Microchip ID</label>
            <input type="text" value={microchipId} onChange={e => setMicrochipId(e.target.value)} className="input-base" placeholder="e.g. 985141002345678" />
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-base resize-none" placeholder="Medical needs, behavior, special characteristics..." />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Link href="/dashboard" className="btn-ghost flex-1 py-3.5 rounded-xl justify-center">
            <X className="w-4 h-4" /> Cancel
          </Link>
          <button disabled={!name || saving} type="submit" className="btn-primary flex-1 py-3.5 rounded-xl">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </motion.form>
    </div>
  )
}
