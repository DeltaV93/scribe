/**
 * Calendar OAuth Callback Handler
 *
 * GET /api/integrations/calendar/callback/[provider]
 *
 * Handles OAuth redirects from Google, Outlook, and Apple.
 */

import { NextRequest, NextResponse } from 'next/server'
import { CalendarProvider } from '@prisma/client'
import {
  parseCalendarOAuthState,
  completeCalendarOAuth,
} from '@/lib/calendar/service'

interface RouteParams {
  params: Promise<{
    provider: string
  }>
}

/**
 * Parse and validate provider parameter
 */
function parseProvider(providerParam: string): CalendarProvider | null {
  const normalized = providerParam.toUpperCase()
  if (Object.values(CalendarProvider).includes(normalized as CalendarProvider)) {
    return normalized as CalendarProvider
  }
  return null
}

/**
 * Redirect with error message
 */
function redirectWithError(baseUrl: string, error: string): NextResponse {
  const url = new URL(baseUrl, process.env.NEXT_PUBLIC_APP_URL)
  url.searchParams.set('calendar_error', error)
  return NextResponse.redirect(url)
}

/**
 * Redirect with success
 */
function redirectWithSuccess(
  baseUrl: string,
  provider: string,
  email?: string
): NextResponse {
  const url = new URL(baseUrl, process.env.NEXT_PUBLIC_APP_URL)
  url.searchParams.set('calendar_connected', 'true')
  url.searchParams.set('calendar_provider', provider.toLowerCase())
  if (email) {
    url.searchParams.set('calendar_email', email)
  }
  return NextResponse.redirect(url)
}

/**
 * GET /api/integrations/calendar/callback/[provider]
 * Handle OAuth callback from calendar providers
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const searchParams = request.nextUrl.searchParams
  const resolvedParams = await params

  // Get provider from route
  const provider = parseProvider(resolvedParams.provider)

  if (!provider) {
    return redirectWithError('/settings/integrations', 'Invalid provider')
  }

  // Check for OAuth error
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (error) {
    console.error(`[Calendar OAuth ${provider}] Error:`, error, errorDescription)
    return redirectWithError(
      '/settings/integrations',
      errorDescription || error
    )
  }

  // Get authorization code
  const code = searchParams.get('code')
  if (!code) {
    return redirectWithError('/settings/integrations', 'Authorization code missing')
  }

  // Get and validate state
  const stateParam = searchParams.get('state')
  if (!stateParam) {
    return redirectWithError('/settings/integrations', 'State parameter missing')
  }

  const state = parseCalendarOAuthState(stateParam)
  if (!state) {
    return redirectWithError(
      '/settings/integrations',
      'Invalid or expired state parameter'
    )
  }

  // Verify provider matches
  if (state.provider !== provider) {
    return redirectWithError('/settings/integrations', 'Provider mismatch in callback')
  }

  try {
    // Complete OAuth flow
    const result = await completeCalendarOAuth(code, state)

    if (!result.success) {
      return redirectWithError(
        state.redirectUrl || '/settings/integrations',
        result.error || 'Failed to connect calendar'
      )
    }

    // Redirect to success page
    return redirectWithSuccess(
      state.redirectUrl || '/settings/integrations',
      result.provider,
      result.email
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Calendar OAuth ${provider}] Completion failed:`, error)
    return redirectWithError(
      state.redirectUrl || '/settings/integrations',
      message
    )
  }
}

/**
 * POST /api/integrations/calendar/callback/[provider]
 * Handle Apple's form_post response mode
 *
 * Apple Sign In uses response_mode=form_post, which sends
 * the authorization response as a POST request.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const resolvedParams = await params
  const provider = parseProvider(resolvedParams.provider)

  if (!provider || provider !== CalendarProvider.APPLE) {
    return redirectWithError('/settings/integrations', 'Invalid provider for POST')
  }

  // Parse form data
  const formData = await request.formData()
  const code = formData.get('code') as string | null
  const stateParam = formData.get('state') as string | null
  const error = formData.get('error') as string | null
  const errorDescription = formData.get('error_description') as string | null

  // Check for error
  if (error) {
    console.error(`[Calendar OAuth APPLE] Error:`, error, errorDescription)
    return redirectWithError(
      '/settings/integrations',
      errorDescription || error
    )
  }

  if (!code) {
    return redirectWithError('/settings/integrations', 'Authorization code missing')
  }

  if (!stateParam) {
    return redirectWithError('/settings/integrations', 'State parameter missing')
  }

  const state = parseCalendarOAuthState(stateParam)
  if (!state) {
    return redirectWithError(
      '/settings/integrations',
      'Invalid or expired state parameter'
    )
  }

  try {
    const result = await completeCalendarOAuth(code, state)

    if (!result.success) {
      return redirectWithError(
        state.redirectUrl || '/settings/integrations',
        result.error || 'Failed to connect calendar'
      )
    }

    return redirectWithSuccess(
      state.redirectUrl || '/settings/integrations',
      result.provider,
      result.email
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Calendar OAuth APPLE] Completion failed:`, error)
    return redirectWithError(
      state.redirectUrl || '/settings/integrations',
      message
    )
  }
}
