/**
 * Real brand SVG logos for integrations, used on the landing page and the
 * integrations dashboard. Each accepts a `className` to size it (default h-6 w-6).
 */

type Props = { className?: string };

export function GoogleLogo({ className = "h-6 w-6" }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export function MetaLogo({ className = "h-6 w-6" }: Props) {
  return (
    <svg className={className} viewBox="0 0 36 24" aria-hidden>
      <defs>
        <linearGradient id="meta-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0064E0" />
          <stop offset="100%" stopColor="#0082FB" />
        </linearGradient>
      </defs>
      <path
        fill="url(#meta-g)"
        d="M5.3 16.1c0 1 .2 1.8.5 2.3.4.6 1 .9 1.7.9.9 0 1.6-.2 3-2.1.2-.3.5-.7.8-1.2l-1.9-3-1.7 2.7c-.6 1-1 1.3-1.5 1.3-.6 0-1-.5-1-1.5 0-1.5.8-4 1.7-5.4.6-.9 1.2-1.3 1.9-1.3 1.1 0 2 .8 3.4 3l1 1.7 1.5 2.5c1.7 2.8 2.9 3.6 4.6 3.6 1.1 0 1.9-.4 2.6-1.3.5-.7.8-1.6.8-2.7 0-2-.5-4.4-1.7-6.7C26 7.5 24.4 6 22.5 6c-1 0-1.9.4-2.8 1.3-.6.6-1.2 1.4-1.9 2.5l-.7 1.1c-1.4-2.2-2.4-3.4-3.5-4.1A4.9 4.9 0 0 0 11 6C8.3 6 6.2 7.9 4.9 11a17 17 0 0 0-1.3 6.3l1.7-1.2Zm14.4-5.6c.6-.9 1-1.5 1.5-2 .5-.4 1-.6 1.4-.6.9 0 1.6.7 2.2 1.9.7 1.4 1 3.1 1 4.6 0 1.1-.4 1.7-1.1 1.7-.7 0-1.2-.5-2.4-2.5l-2.6-4.3Z"
      />
    </svg>
  );
}

export function HubSpotLogo({ className = "h-6 w-6" }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#FF7A59" aria-hidden>
      <path d="M17.3 8.3V5.9a1.85 1.85 0 0 0 1.06-1.66v-.06A1.85 1.85 0 0 0 16.5 2.3h-.06a1.85 1.85 0 0 0-1.85 1.85v.06A1.85 1.85 0 0 0 15.65 5.9v2.4a5.24 5.24 0 0 0-2.5 1.1L6.55 4.27a2.1 2.1 0 1 0-1 1.32l6.46 5.03a5.26 5.26 0 0 0 .08 5.95l-1.96 1.97a1.7 1.7 0 0 0-.49-.08 1.71 1.71 0 1 0 1.71 1.71 1.7 1.7 0 0 0-.08-.49l1.94-1.95a5.27 5.27 0 1 0 4.09-9.46Zm-.83 7.9a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z" />
    </svg>
  );
}

export function QuickBooksLogo({ className = "h-6 w-6" }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#2CA01C" />
      <path fill="#fff" d="M7.4 8.2A4.6 4.6 0 0 0 8 17.4h1.3V15.6H8a2.8 2.8 0 1 1 0-5.6h.5v8.9a1.8 1.8 0 0 0 1.8 1.8V8.2H7.4Zm9.2 7.6A4.6 4.6 0 0 0 16 6.6h-1.3v1.8H16a2.8 2.8 0 1 1 0 5.6h-.5V5.1a1.8 1.8 0 0 0-1.8-1.8v12.5h2.9Z" />
    </svg>
  );
}

export function StripeLogo({ className = "h-6 w-6" }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="5" fill="#635BFF" />
      <path fill="#fff" d="M11.4 9.6c0-.5.4-.7 1-.7.9 0 2 .27 2.9.76V6.95a7.6 7.6 0 0 0-2.9-.55c-2.36 0-3.94 1.24-3.94 3.3 0 3.23 4.43 2.71 4.43 4.1 0 .57-.5.76-1.13.76-.97 0-2.22-.4-3.2-.94v2.72c1.09.47 2.18.67 3.2.67 2.42 0 4.09-1.2 4.09-3.29-.01-3.48-4.45-2.86-4.45-4.12Z" />
    </svg>
  );
}

export function GoogleSheetsLogo({ className = "h-6 w-6" }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#0F9D58" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
      <path fill="#fff" fillOpacity=".3" d="M14 2v6h6l-6-6Z" />
      <path fill="#fff" d="M8 11h8v7H8v-7Zm1.4 1.4v1.2h2.2v-1.2H9.4Zm3.2 0v1.2H15v-1.2h-2.4Zm-3.2 2.4v1.2h2.2v-1.2H9.4Zm3.2 0v1.2H15v-1.2h-2.4Z" />
    </svg>
  );
}

export function GoogleAnalyticsLogo({ className = "h-6 w-6" }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="16" y="3" width="5" height="18" rx="2.5" fill="#F9AB00" />
      <rect x="9.5" y="9" width="5" height="12" rx="2.5" fill="#E37400" />
      <circle cx="5.5" cy="18" r="2.7" fill="#E37400" />
    </svg>
  );
}

export function SlackLogo({ className = "h-6 w-6" }: Props) {
  return (
    <svg className={className} viewBox="0 0 122.8 122.8" aria-hidden>
      <path fill="#E01E5A" d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" />
      <path fill="#36C5F0" d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" />
      <path fill="#2EB67D" d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" />
      <path fill="#ECB22E" d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" />
    </svg>
  );
}
