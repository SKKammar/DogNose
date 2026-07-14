export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type ApiErrorType = 'network' | 'cors' | 'timeout' | 'server'

export interface ApiError {
  type: ApiErrorType
  message: string
  details?: any
}

/**
 * Fetch wrapper with error handling, timeout, and typed error responses.
 * Timeout set to 60s to accommodate Render free-tier cold starts.
 */
export async function fetchWithErrorHandling(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout for cold starts

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 503) {
        throw { type: 'server', message: "Server cold-start: waking up the matching engine, one moment..." }
      }

      let errorDetail = null
      try {
        const errorData = await response.json()
        errorDetail = errorData.detail
      } catch (e) {
        // Not JSON
      }

      throw { type: 'server', message: errorDetail || `Request failed with status ${response.status}` }
    }

    return response
  } catch (error: any) {
    clearTimeout(timeoutId)

    // If we threw a typed error above, re-throw it
    if (error.type) {
      throw error
    }

    if (error.name === 'AbortError') {
      throw { type: 'timeout', message: 'The request timed out. The server might be experiencing a cold-start on Render or there is a network issue.' }
    }

    if (error.name === 'TypeError' || error.message === 'Failed to fetch') {
      throw { type: 'network', message: 'Failed to reach the server. This could be due to a network outage, or a CORS configuration issue.' }
    }

    throw { type: 'server', message: error.message || 'An unknown error occurred.' }
  }
}

// --- Typed API functions ---

export interface DogDetails {
  name: string
  breed: string | null
  age: number | null
  sex: string | null
  color_markings: string | null
  owner_name: string | null
  owner_phone: string | null
  owner_email: string | null
  microchip_id: string | null
  notes: string | null
}

/**
 * Register a new dog profile.
 */
export async function registerDog(details: DogDetails, token: string) {
  const res = await fetchWithErrorHandling(`${API_URL}/dogs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(details)
  })
  return res.json()
}

/**
 * Upload one or multiple nose prints for a registered dog.
 */
export async function enrollNose(dogId: string, blobs: Blob[], token: string) {
  const formData = new FormData()
  blobs.forEach((blob, index) => {
    formData.append('nose_images', blob, `nose_${index}.jpg`)
  })

  const res = await fetchWithErrorHandling(`${API_URL}/dogs/${dogId}/enroll`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Note: Do not set Content-Type, browser will set it with boundary for FormData
    },
    body: formData
  })
  return res.json()
}

/**
 * Identify a dog from a nose photo. No auth required.
 */
export async function identifyNose(imageBlob: Blob) {
  const form = new FormData()
  form.append('nose_image', imageBlob, 'nose.jpg')
  const res = await fetchWithErrorHandling(`${API_URL}/dogs/identify`, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

/**
 * List the authenticated user's dogs.
 */
export async function listDogs(token: string) {
  const res = await fetchWithErrorHandling(`${API_URL}/dogs`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return res.json()
}
