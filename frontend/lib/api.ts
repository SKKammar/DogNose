export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type ApiErrorType = 'network' | 'cors' | 'timeout' | 'server'

export interface ApiError {
  type: ApiErrorType
  message: string
  details?: any
}

export async function fetchWithErrorHandling(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
  
  try {
    const response = await fetch(url, {
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
      // This is indicative of a Network or CORS issue in fetch
      throw { type: 'network', message: 'Failed to reach the server. This could be due to a network outage, or a CORS configuration issue.' }
    }
    
    throw { type: 'server', message: error.message || 'An unknown error occurred.' }
  }
}
