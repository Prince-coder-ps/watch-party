// ---------------------------------------------------------------------------
// Footer with author links. Edit the three values below with your own -
// that's it, nothing else in this file needs to change.
// ---------------------------------------------------------------------------
import { GithubIcon, LinkedinIcon, MailIcon } from '../icons';

const LINKEDIN_URL = 'https://www.linkedin.com/in/your-username';
const GITHUB_URL = 'https://github.com/your-username';
const EMAIL = 'you@example.com';

function Footer() {
  return (
    <footer className="shrink-0 border-t border-gray-200 px-6 py-4 dark:border-ink-700">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400 sm:flex-row">
        <span>
          Built by{' '}
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gray-700 hover:text-brand-500 dark:text-gray-300"
          >
            {/* Change the display name too, if you like */}
            Your Name
          </a>
        </span>

        <div className="flex items-center gap-4">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            className="transition hover:text-brand-500"
          >
            <GithubIcon className="h-4 w-4" />
          </a>
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn"
            className="transition hover:text-brand-500"
          >
            <LinkedinIcon className="h-4 w-4" />
          </a>
          <a href={`mailto:${EMAIL}`} title="Email" className="transition hover:text-brand-500">
            <MailIcon className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
