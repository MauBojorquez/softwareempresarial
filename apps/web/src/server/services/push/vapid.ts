/**
 * Web Push (VAPID) configuration.
 *
 * VAPID keys identify this application server to the browser push services
 * (FCM, Mozilla, Apple). They are NOT user secrets: the private key only
 * authorizes sending push messages to subscribers that already opted in to
 * THIS app's public key — it cannot read user data or decrypt anything.
 *
 * The generated pair below makes push work out of the box. To rotate the keys
 * (recommended for production), set NEXT_PUBLIC_VAPID_PUBLIC_KEY and
 * VAPID_PRIVATE_KEY as environment variables; they take precedence.
 */

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BEEiFbQoBHFob_uv-uLBHz0RAqfKK9GZq0Z8vgShbGWP6zIukYiBv2Y1JkTL9oxgJdeY5EwRqCDa31xPYmRqRXI";

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "SZByVpnwvJpd_y9RWQuEwbqmKOGJMZLzul-BWUY87DA";

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:soporte@somosstratium.com";
