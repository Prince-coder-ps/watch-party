// ---------------------------------------------------------------------------
// Icon set used across the app.
//
// These are genuine icon components from `lucide-react` - a real npm
// package (installed like any other React library, see client/package.json),
// not hand-written SVG markup and not a CSS-mask trick pointed at a CDN URL.
// lucide-react ships each icon as a proper React component that already
// supports `className`, `size`, `color`/`currentColor`, `strokeWidth`, etc,
// so Tailwind text-color classes and dark mode keep working exactly like
// any other element in the app.
//
// Every export here just re-exports (and renames) a lucide-react icon under
// the name the rest of the app already imports - so nothing else needs to
// change, only this one file.
// ---------------------------------------------------------------------------
export {
  Play as PlayIcon,
  Pause as PauseIcon,
  Search as SearchIcon,
  X as XIcon,
  Check as CheckIcon,
  Copy as CopyIcon,
  Link as LinkIcon,
  Users as UsersIcon,
  Crown as CrownIcon,
  LogOut as LogOutIcon,
  MessageCircle as MessageCircleIcon,
  Send as SendIcon,
  Hand as HandRaisedIcon,
  Github as GithubIcon,
  Linkedin as LinkedinIcon,
  Mail as MailIcon,
  Sun as SunIcon,
  Moon as MoonIcon,
  Loader2 as LoaderIcon,
  AlertCircle as AlertCircleIcon,
  UserPlus as UserPlusIcon,
  UserMinus as UserMinusIcon,
  ShieldCheck as ShieldCheckIcon,
} from 'lucide-react';
