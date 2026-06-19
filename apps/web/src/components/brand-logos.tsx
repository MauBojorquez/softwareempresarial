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
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="meta-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0064E0" />
          <stop offset="100%" stopColor="#19AFFF" />
        </linearGradient>
      </defs>
      <path
        fill="url(#meta-g)"
        d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.34 2.214c1.235 0 2.31.902 3.13 2.139 1.024 1.546 1.582 3.917 1.582 6.093 0 .848-.123 1.428-.397 1.84-.262.397-.625.59-1.103.59-.514 0-.836-.225-1.46-1.074-.41-.558-.93-1.388-1.625-2.55l-1.058-1.766a44.05 44.05 0 0 0-1.398-2.226c.785-1.211 1.467-2.026 2.034-2.581.611-.6 1.166-.838 1.785-.838l.51.336zm-10.39.043c.642 0 1.2.236 1.797.78.527.48 1.05 1.144 1.69 2.084-.751 1.156-1.347 2.046-1.972 3.045l-.61.976c-.69 1.106-1.276 1.901-1.794 2.466-.594.648-1.077.844-1.595.844-.518 0-.91-.226-1.207-.671-.302-.452-.456-1.087-.456-1.866 0-2.043.62-4.245 1.687-5.804.642-.937 1.43-1.563 2.262-1.563l-.001-1.617z"
      />
    </svg>
  );
}

export function MakeLogo({ className = "h-6 w-6" }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="make-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6D00CC" />
          <stop offset="100%" stopColor="#C800FF" />
        </linearGradient>
      </defs>
      <path
        fill="url(#make-g)"
        d="M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z"
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

export function SATLogo({ className = "h-6 w-6" }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="5" fill="#611232" />
      <text
        x="12"
        y="15.5"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fontFamily="Arial, sans-serif"
        fill="#fff"
        letterSpacing="0.3"
      >
        SAT
      </text>
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
