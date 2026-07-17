'use client'
import React, { useState, useEffect, use } from 'react'
import { supabase } from '../../../lib/supabase'
import { getDog, updateDog } from '../../../lib/api'
import { useRouter } from 'next/navigation'
import AppHeader from '../../components/AppHeader'
import { Loader2, Save, X, Edit3 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function EditDogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<any>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  // Form state
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
        if (!session) {
          router.push('/login')
          return
        }
        setSessionToken(session.access_token)

        const dogData = await getDog(id, session.access_token)
        
        setName(dogData.name || '')
        setBreed(dogData.breed || '')
        setAge(dogData.age !== null ? String(dogData.age) : '')
        setSex(dogData.sex || 'Male')
        setColorMarkings(dogData.color_markings || '')
        setOwnerName(dogData.owner_name || '')
        setOwnerPhone(dogData.owner_phone || '')
        setOwnerEmail(dogData.owner_email || '')
        setMicrochipId(dogData.microchip_id || '')
        setNotes(dogData.notes || '')
        
      } catch (err) {
        console.error(err)
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
      const updateData = {
        name,
        breed: breed || null,
        age: age === '' ? null : Number(age),
        sex,
        color_markings: colorMarkings || null,
        owner_name: ownerName || null,
        owner_phone: ownerPhone || null,
        owner_email: ownerEmail || null,
        microchip_id: microchipId || null,
        notes: notes || null
      }

      await updateDog(id, updateData, sessionToken)
      toast.success('Dog profile updated successfully')
      router.push('/dashboard')
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Failed to update dog profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center w-full bg-[var(--color-bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center w-full bg-[var(--color-bg)] p-4 text-center">
        <h2 className="text-xl font-bold text-[var(--color-error)] mb-2">Error loading profile</h2>
        <p className="text-[var(--color-muted)] mb-6">We couldn't load the details for this dog.</p>
        <Link href="/dashboard" className="px-6 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)]">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <>
      <AppHeader />
      <div className="min-h-screen p-4 pt-24 max-w-2xl mx-auto w-full relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)]">
            <Edit3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display text-[var(--color-text)] tracking-tight">Edit Profile</h1>
            <p className="text-[var(--color-muted)]">Update information for {name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xl space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] border-b border-[var(--color-border)] pb-2">Basic Info</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--color-text)]">Dog's Name *</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors" placeholder="e.g. Max" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--color-text)]">Breed</label>
                <input type="text" value={breed} onChange={e => setBreed(e.target.value)} className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors" placeholder="e.g. Golden Retriever" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--color-text)]">Age (Years)</label>
                <input type="number" step="0.1" min="0" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors" placeholder="e.g. 2.5" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--color-text)]">Sex</label>
                <select value={sex} onChange={e => setSex(e.target.value)} className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors appearance-none">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--color-text)]">Color & Markings</label>
              <input type="text" value={colorMarkings} onChange={e => setColorMarkings(e.target.value)} className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors" placeholder="e.g. Fawn with black mask" />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] border-b border-[var(--color-border)] pb-2">Owner Contact Info</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-[var(--color-text)]">Owner Name</label>
                <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors" placeholder="e.g. Jane Doe" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--color-text)]">Phone Number</label>
                <input type="tel" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors" placeholder="e.g. +1 555-1234" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--color-text)]">Email</label>
                <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors" placeholder="e.g. jane@example.com" />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] border-b border-[var(--color-border)] pb-2">Additional Details</h3>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--color-text)]">Microchip ID (Optional)</label>
              <input type="text" value={microchipId} onChange={e => setMicrochipId(e.target.value)} className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors" placeholder="e.g. 985141002345678" />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--color-text)]">Notes (Medical needs, behavior, etc.)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors custom-scrollbar" placeholder="e.g. Friendly but shy around loud noises" />
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <Link href="/dashboard" className="flex-1 py-4 bg-transparent border border-[var(--color-border)] text-[var(--color-text)] rounded-xl font-semibold hover:bg-[var(--color-bg)] transition flex justify-center items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </Link>
            <button disabled={!name || saving} type="submit" className="flex-1 py-4 bg-[var(--color-accent)] text-white text-center rounded-xl font-semibold hover:bg-blue-600 transition shadow-[0_0_15px_rgba(79,156,249,0.2)] flex items-center justify-center gap-2 disabled:opacity-70">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
