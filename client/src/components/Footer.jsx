// ---------------------------------------------------------------------------
// Footer with author links. Edit the three values below with your own -
// that's it, nothing else in this file needs to change.
// ---------------------------------------------------------------------------
import { GithubIcon, LinkedinIcon, MailIcon } from "../icons";

const LINKEDIN_URL = "https://www.linkedin.com/in/prince-saini04";
const GITHUB_URL = "https://github.com/Prince-coder-ps";
const EMAIL = "prince.saini0116@gmail.com";

function Footer() {
  return (
    <footer className="shrink-0 border-t border-gray-200 px-6 py-5 dark:border-ink-700">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400 sm:flex-row">
        <span className="font-medium">
          Built by{" "}
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-gray-800 hover:text-brand-500 dark:text-white"
          >
            Prince Saini
          </a>
        </span>

        <div className="flex items-center gap-5">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            className="text-gray-600 transition hover:text-brand-500 dark:text-gray-300"
          >
            <GithubIcon className="h-6 w-6" />
          </a>
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn"
            className="text-gray-600 transition hover:text-brand-500 dark:text-gray-300"
          >
            <LinkedinIcon className="h-6 w-6" />
          </a>
          <a
            href={`mailto:${EMAIL}`}
            title="Email"
            className="text-gray-600 transition hover:text-brand-500 dark:text-gray-300"
          >
            <MailIcon className="h-6 w-6" />
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
