'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabase'
import { getDog, updateDog } from '../../../lib/api'
import HealthRecordsPanel from '../../components/HealthRecordsPanel'

export default function EditDogClient({ id }: { id: string }) {
  const router = useRouter()
  const [tab, setTab] = useState<'profile' | 'health'>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('Male')
  const [color, setColor] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [microchip, setMicrochip] = useState('')
  const [notes, setNotes] = useState('')
  const [behaviour, setBehaviour] = useState('')
  const [emName, setEmName] = useState('')
  const [emPhone, setEmPhone] = useState('')
  const [vetName, setVetName] = useState('')
  const [vetPhone, setVetPhone] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setToken(session.access_token)
      try {
        const d = await getDog(id, session.access_token)
        setName(d.name || '')
        setBreed(d.breed || '')
        setAge(d.age != null ? String(d.age) : '')
        setSex(d.sex || 'Male')
        setColor(d.color_markings || '')
        setOwnerName(d.owner_name || '')
        setOwnerPhone(d.owner_phone || '')
        setOwnerEmail(d.owner_email || '')
        setMicrochip(d.microchip_id || '')
        setNotes(d.notes || '')
        setBehaviour(d.behaviour_notes || '')
        setEmName(d.emergency_contact_name || '')
        setEmPhone(d.emergency_contact_phone || '')
        setVetName(d.vet_name || '')
        setVetPhone(d.vet_phone || '')
      } catch {
        toast.error("Couldn't load this dog")
      } finally {
        setLoading(false)
      }
    })()
  }, [id, router])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    try {
      await updateDog(id, {
        name,
        breed: breed || null,
        age: age === '' ? null : Number(age),
        sex,
        color_markings: color || null,
        owner_name: ownerName || null,
        owner_phone: ownerPhone || null,
        owner_email: ownerEmail || null,
        microchip_id: microchip || null,
        notes: notes || null,
        behaviour_notes: behaviour || null,
        emergency_contact_name: emName || null,
        emergency_contact_phone: emPhone || null,
        vet_name: vetName || null,
        vet_phone: vetPhone || null,
      }, token)
      toast.success('Saved')
      router.push('/dashboard')
    } catch {
      toast.error("Couldn't save")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="skeleton h-8 w-40 mb-8" />
        <div className="skeleton h-96" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/dashboard" className="text-sm text-text-muted hover:text-text-primary transition-colors">
        ← Dashboard
      </Link>
      <h1 className="font-display text-3xl font-bold text-text-primary mt-3 mb-8">
        {name}
      </h1>

      <div className="flex gap-6 border-b border-border mb-8">
        {(['profile', 'health'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tab ${tab === t ? 'tab-active' : ''}`}
          >
            {t === 'profile' ? 'Profile' : 'Health'}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <form onSubmit={save} className="space-y-10">
          <section>
            <h3 className="font-display text-base font-bold text-text-primary mb-4">About the dog</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="field-label">Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className="field-label">Breed</label>
                <input className="input" value={breed} onChange={(e) => setBreed(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Age (years)</label>
                <input className="input" type="number" step="0.1" min="0" value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Sex</label>
                <select className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Unknown</option>
                </select>
              </div>
              <div>
                <label className="field-label">Colour & markings</label>
                <input className="input" value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-display text-base font-bold text-text-primary mb-4">Contact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="field-label">Owner name</label>
                <input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Phone</label>
                <input className="input" type="tel" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input className="input" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Emergency name</label>
                <input className="input" value={emName} onChange={(e) => setEmName(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Emergency phone</label>
                <input className="input" type="tel" value={emPhone} onChange={(e) => setEmPhone(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Vet name</label>
                <input className="input" value={vetName} onChange={(e) => setVetName(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Vet phone</label>
                <input className="input" type="tel" value={vetPhone} onChange={(e) => setVetPhone(e.target.value)} />
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-display text-base font-bold text-text-primary mb-4">Behaviour</h3>
            <textarea
              className="input"
              rows={3}
              value={behaviour}
              onChange={(e) => setBehaviour(e.target.value)}
              placeholder="Shown to anyone who finds your dog."
            />
          </section>

          <section>
            <h3 className="font-display text-base font-bold text-text-primary mb-4">Additional</h3>
            <div className="space-y-4">
              <div>
                <label className="field-label">Microchip ID</label>
                <input className="input" value={microchip} onChange={(e) => setMicrochip(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Private notes</label>
                <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                <p className="field-hint">Only you can see these.</p>
              </div>
            </div>
          </section>

          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <Link href="/dashboard" className="btn-ghost">Cancel</Link>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      {tab === 'health' && token && (
        <HealthRecordsPanel dogId={id} token={token} />
      )}
    </div>
  )
}
