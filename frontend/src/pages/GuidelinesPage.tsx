import { Link } from 'react-router-dom';
import { ChatIcon, BugIcon, RoadmapIcon } from '../components/ui/icons';

const sections = [
  {
    title: 'Welcome',
    body: `PH Project Hub is a community for Filipino builders to share project updates, releases, and ideas — and to chat about them in real time. Keep it friendly, keep it useful.`,
  },
  {
    icon: ChatIcon,
    title: 'Chat etiquette',
    rules: [
      'Be respectful. No harassment, hate speech, or discrimination.',
      'Stay on-topic per channel. Off-topic noise gets moved or removed.',
      'No spam, self-promotion without value, or link farming.',
      'Don\u2019t share anyone\u2019s private information (doxxing).',
      'Use reports for problems in the community; don\u2019t feed trolls.',
    ],
  },
  {
    icon: BugIcon,
    title: 'Bug reports & suggestions',
    rules: [
      'Report one issue per report, with clear steps to reproduce.',
      'Search before submitting to avoid duplicates.',
      'Suggestions should be constructive and actionable.',
      'Managers may mark reports as Investigating, Fixed, or Closed.',
    ],
  },
  {
    icon: RoadmapIcon,
    title: 'Updates & releases',
    rules: [
      'Only verified or clearly-labelled project updates are published.',
      'Version numbers, changelogs, and links are checked before posting.',
      'Official announcements come from the owner, admins, or moderators.',
    ],
  },
  {
    title: 'Moderation',
    rules: [
      'Violations may result in a warning, mute, or ban depending on severity.',
      'Moderators and admins act on reports; decisions can be appealed through the owner.',
      'Being blocked goes both ways: don\u2019t create accounts to dodge a block.',
    ],
  },
];

export function GuidelinesPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-2">
      <header>
        <h1 className="text-2xl font-bold text-white">Community Guidelines</h1>
        <p className="mt-1 text-sm text-gray-500">
          Keep PH Project Hub a safe, productive home for Filipino builders.
        </p>
      </header>

      {sections.map((s) => (
        <section key={s.title} className="rounded-2xl border border-ink-600 bg-ink-800/50 p-5">
          <div className="flex items-center gap-2">
            {s.icon && <s.icon size={16} className="text-primary-400" />}
            <h2 className="text-base font-semibold text-white">{s.title}</h2>
          </div>
          {s.body && <p className="mt-2 text-sm leading-relaxed text-gray-400">{s.body}</p>}
          {s.rules && (
            <ul className="mt-3 space-y-1.5">
              {s.rules.map((r, ri) => (
                <li key={ri} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-400" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="rounded-2xl border border-ink-600 bg-ink-800/50 p-5 text-center">
        <p className="text-sm text-gray-400">Ready to jump in?</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Link to="/chat/general" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-4 text-xs font-semibold text-white hover:bg-primary-500">
            <ChatIcon size={13} /> Join #general
          </Link>
          <Link to="/projects" className="inline-flex h-9 items-center rounded-lg border border-ink-500 px-4 text-xs font-medium text-gray-300 hover:bg-ink-600">
            Explore projects
          </Link>
          <Link to="/roadmap" className="inline-flex h-9 items-center rounded-lg border border-ink-500 px-4 text-xs font-medium text-gray-300 hover:bg-ink-600">
            View roadmap
          </Link>
        </div>
      </section>
    </div>
  );
}