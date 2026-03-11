/**
 * Calendar OAuth Authorization Endpoint
 *
 * GET /api/integrations/calendar/authorize?provider=google|outlook|apple
 *
 * Initiates the OAuth flow for a calendar provider.
 * Returns the authorization URL for redirect.
 */

import { NextRequest, NextResponse } from 'next/server'
import { CalendarProvider } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { initiateCalendarOAuth } from '@/lib/calendar/service'
import { isCalendarProviderConfigured } from '@/lib/calendar/oauth'

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
 * GET /api/integrations/calendar/authorize
 * Start OAuth flow for a calendar provider
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    // Get provider from query params
    const providerParam = request.nextUrl.searchParams.get('provider')
    if (!providerParam) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Provider parameter required' } },
        { status: 400 }
      )
    }

    const provider = parseProvider(providerParam)
    if (!provider) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_PROVIDER',
            message: `Invalid provider: ${providerParam}. Must be one of: google, outlook, apple`,
          },
        },
        { status: 400 }
      )
    }

    // Check if provider is configured
    if (!isCalendarProviderConfigured(provider)) {
      return NextResponse.json(
        {
          error: {
            code: 'PROVIDER_NOT_CONFIGURED',
            message: `${provider} calendar is not configured on this server`,
          },
        },
        { status: 400 }
      )
    }

    // Get optional redirect URL
    const redirectUrl = request.nextUrl.searchParams.get('redirectUrl') || undefined

    // Initiate OAuth flow
    const authorizationUrl = await initiateCalendarOAuth(
      user.id,
      user.orgId,
      provider,
      redirectUrl
    )

    return NextResponse.json({ authorizationUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Calendar Authorize] Error:', error)

    // Check for specific error about already connected
    if (message.includes('already have')) {
      return NextResponse.json(
        { error: { code: 'ALREADY_CONNECTED', message } },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to initiate OAuth flow' } },
      { status: 500 }
    )
  }
}
