'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import CameraCapture from '../components/CameraCapture'
import NetworkError from '../components/NetworkError'
import { supabase } from '../../lib/supabase'
import { registerDog, enrollNose, callWithWakeUp } from '../../lib/api'
import type { ApiError } from '../../lib/api'

type Step = 'details' | 'capture' | 'uploading' | 'success' | 'error'
interface Shot { blob: Blob; status: 'pending' | 'error'; error?: string }

export default function EnrollPage() {
  const router = useRouter()
  const [auth, setAuth] = useState<'checking' | 'ok' | 'no'>('checking')
  const [step, setStep] = useState<Step>('details')

  // Dog details
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [age, setAge] = useState<string>('')
  const [sex, setSex] = useState('Unknown')
  const [color, setColor] = useState('')

  // Owner
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')

  // Optional
  const [showMore, setShowMore] = useState(false)
  const [microchip, setMicrochip] = useState('')
  const [notes, setNotes] = useState('')
  const [behaviour, setBehaviour] = useState('')
  const [emName, setEmName] = useState('')
  const [emPhone, setEmPhone] = useState('')
  const [vetName, setVetName] = useState('')
  const [vetPhone, setVetPhone] = useState('')

  // Nose capture
  const [shots, setShots] = useState<Shot[]>([])
  const [dogId, setDogId] = useState<string | null>(null)
  const [err, setErr] = useState<ApiError | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuth(data.session ? 'ok' : 'no')
    })
  }, [])

  if (auth === 'checking') {
    return (
      <div className="max-w-md mx-auto px-6 py-24">
        <div className="skeleton h-64" />
      </div>
    )
  }

  if (auth === 'no') {
    return (
      <div className="max-w-md mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-text-primary mb-3">
          Sign in to register a dog
        </h1>
        <p className="text-sm text-text-secondary mb-8">
          You need an account to save your dog&apos;s profile and health records.
        </p>
        <Link href="/login" className="btn-primary">
          Log in
        </Link>
      </div>
    )
  }

  // Only dog details are required now. Owner contact is optional for now.
  const valid1 =
    name.trim() !== '' &&
    breed.trim() !== '' &&
    age !== '' &&
    color.trim() !== ''

  const onCapture = (blob: Blob | Blob[]) => {
    const arr = Array.isArray(blob) ? blob : [blob]
    setShots((s) => [...s, ...arr.map((b) => ({ blob: b, status: 'pending' as const }))])
  }

  const removeShot = (i: number) => setShots((s) => s.filter((_, idx) => idx !== i))

  const submit = async () => {
    setStep('uploading')
    setErr(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw { type: 'server', message: 'Session expired' }

      let id = dogId
      if (!id) {
        const dog = await callWithWakeUp(
          () => registerDog({
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
          }, session.access_token),
          () => {}
        )
        id = dog.id
        setDogId(id)
      }

      const res = await callWithWakeUp(
        () => enrollNose(id!, shots.map((s) => s.blob), session.access_token),
        () => {}
      )

      if (res?.error) {
        if (res.code === 'NO_VALID_PHOTOS') {
          const errs = res.photo_errors || []
          setShots((prev) =>
            prev.map((s, i) => {
              const e = errs.find((x: any) => x.photo === i + 1)
              return e ? { ...s, status: 'error' as const, error: e.message } : s
            })
          )
          setStep('capture')
          return
        }
        throw { type: 'server', message: res.message || 'Registration failed' }
      }

      setStep('success')
    } catch (e: any) {
      setErr(e)
      setStep('error')
    }
  }

  const resetAll = () => {
    setName(''); setBreed(''); setAge(''); setSex('Unknown'); setColor('')
    setOwnerName(''); setOwnerPhone(''); setOwnerEmail('')
    setMicrochip(''); setNotes(''); setBehaviour('')
    setEmName(''); setEmPhone(''); setVetName(''); setVetPhone('')
    setShots([]); setDogId(null); setShowMore(false)
    setStep('details')
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      {/* Progress */}
      {(step === 'details' || step === 'capture') && (
        <div className="flex items-center gap-2 mb-10">
          <div className={`h-1 flex-1 rounded-full ${step === 'details' || step === 'capture' ? 'bg-accent' : 'bg-border'}`} />
          <div className={`h-1 flex-1 rounded-full ${step === 'capture' ? 'bg-accent' : 'bg-border'}`} />
        </div>
      )}

      {/* Step 1 */}
      {step === 'details' && (
        <>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
            About your dog
          </h1>
          <p className="text-sm text-text-secondary mb-8">
            This is what a finder sees if your dog ever gets lost.
          </p>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="field-label">Dog&apos;s name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Max" />
              </div>
              <div>
                <label className="field-label">Breed</label>
                <input className="input" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Labrador" />
              </div>
              <div>
                <label className="field-label">Age (years)</label>
                <input className="input" type="number" step="0.1" min="0" value={age} onChange={(e) => setAge(e.target.value)} placeholder="4" />
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
                <input className="input" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Golden with white chest" />
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h3 className="font-display text-base font-bold text-text-primary mb-4">Your contact (Optional)</h3>
              <div className="space-y-4">
                <div>
                  <label className="field-label">Your name</label>
                  <input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Sarah Chen" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Phone</label>
                    <input className="input" type="tel" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="+1 555 123 4567" />
                  </div>
                  <div>
                    <label className="field-label">Email</label>
                    <input className="input" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setShowMore((s) => !s)}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {showMore ? '− Hide optional details' : '+ Add optional details'}
              </button>

              {showMore && (
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="field-label">Microchip ID</label>
                    <input className="input" value={microchip} onChange={(e) => setMicrochip(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Behaviour notes</label>
                    <textarea className="input" rows={2} value={behaviour} onChange={(e) => setBehaviour(e.target.value)} placeholder="e.g. Friendly, but nervous around loud noises" />
                    <p className="field-hint">Shown to anyone who finds your dog.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Emergency contact name</label>
                      <input className="input" value={emName} onChange={(e) => setEmName(e.target.value)} />
                    </div>
                    <div>
                      <label className="field-label">Emergency phone</label>
                      <input className="input" type="tel" value={emPhone} onChange={(e) => setEmPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Vet name</label>
                      <input className="input" value={vetName} onChange={(e) => setVetName(e.target.value)} />
                    </div>
                    <div>
                      <label className="field-label">Vet phone</label>
                      <input className="input" type="tel" value={vetPhone} onChange={(e) => setVetPhone(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Private notes</label>
                    <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                    <p className="field-hint">Only you can see these.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between">
            <Link href="/dashboard" className="btn-ghost">
              Cancel
            </Link>
            <button
              disabled={!valid1}
              onClick={() => setStep('capture')}
              className="btn-primary"
            >
              Continue
            </button>
          </div>
        </>
      )}

      {/* Step 2 */}
      {step === 'capture' && (
        <>
          <button
            onClick={() => setStep('details')}
            className="btn-ghost btn-sm mb-6 -ml-2"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
            Nose prints
          </h1>
          <p className="text-sm text-text-secondary mb-8">
            Take 1–5 photos from slightly different angles. More photos make identification more reliable.
          </p>

          <CameraCapture onCapture={onCapture} />

          {shots.length > 0 && (
            <div className="mt-6 card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-xs uppercase tracking-wider text-text-muted">
                  Captured
                </p>
                <span className="font-mono text-xs text-text-muted">
                  {shots.length}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {shots.map((s, i) => (
                  <div key={i} className="relative w-16 h-16 shrink-0 rounded-md border border-border overflow-hidden">
                    <img src={URL.createObjectURL(s.blob)} alt="" className="w-full h-full object-cover" />
                    {s.status === 'error' && (
                      <div className="absolute inset-0 bg-error/40 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <button
                      onClick={() => removeShot(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={submit}
                disabled={shots.length === 0}
                className="btn-primary w-full mt-4"
              >
                Register {shots.length} {shots.length === 1 ? 'photo' : 'photos'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Uploading */}
      {step === 'uploading' && (
        <div className="py-24 text-center">
          <p className="font-display text-lg font-bold text-text-primary mb-2">
            Saving your dog
          </p>
          <p className="text-sm text-text-secondary">
            This takes a few seconds.
          </p>
        </div>
      )}

      {/* Success */}
      {step === 'success' && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border border-success/40 bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-success" />
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
            {name} is registered
          </h1>
          <p className="text-sm text-text-secondary max-w-sm mx-auto mb-8 leading-relaxed">
            Their nose print is saved. If someone finds them and scans their nose, you&apos;ll be reachable.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={resetAll} className="btn-secondary">
              Register another dog
            </button>
            <Link href="/dashboard" className="btn-primary">
              Go to dashboard
            </Link>
          </div>
        </div>
      )}

      {/* Error */}
      {step === 'error' && err && (
        <div className="flex justify-center">
          <NetworkError error={err} onRetry={submit} />
        </div>
      )}
    </div>
  )
}
