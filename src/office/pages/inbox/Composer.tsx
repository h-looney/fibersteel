/** Reply, log a call, text or leave an internal note on a request. Outbound messages are simulated. */
import { useId, useState } from 'preact/hooks';
import { addLeadActivity } from '../../actions';
import type { Lead } from '../../data/types';
import { phone, telHref } from '../../lib/format';
import { toast } from '../../toast';
import { Button, Segmented } from '../../ui/core';
import type { IconName } from '../../ui/Icon';
import { firstNameOf, templateContext, templatesFor, type ComposerMode } from './helpers';

const modes: { key: ComposerMode; label: string; icon: IconName }[] = [
  { key: 'email', label: 'Email', icon: 'mail' },
  { key: 'call', label: 'Call', icon: 'phone' },
  { key: 'text', label: 'Text', icon: 'message' },
  { key: 'note', label: 'Note', icon: 'note' },
];

const placeholders: Record<ComposerMode, string> = {
  email: 'Write a reply…',
  call: 'What did you talk about?',
  text: 'Write a text message…',
  note: 'Add a note for the team…',
};

const sendLabels: Record<ComposerMode, string> = { email: 'Send email', call: 'Log call', text: 'Send text', note: 'Add note' };
const sendIcons: Record<ComposerMode, IconName> = { email: 'send', call: 'phone', text: 'send', note: 'note' };

export function Composer({ lead }: { lead: Lead }) {
  const id = useId();
  const [mode, setMode] = useState<ComposerMode>(lead.email ? 'email' : lead.phone ? 'call' : 'note');
  const [text, setText] = useState('');
  const first = firstNameOf(lead);

  const missing = mode === 'email' && !lead.email ? 'No email address on file for this request.' : (mode === 'text' || mode === 'call') && !lead.phone ? 'No phone number on file for this request.' : undefined;

  const send = () => {
    const body = text.trim();
    if (!body || missing) return;
    addLeadActivity(lead.id, mode, body);
    setText('');
    if (mode === 'email') toast(`Email to ${first} logged — sending is simulated in this demo`, { tone: 'success' });
    else if (mode === 'text') toast(`Text to ${first} logged — sending is simulated in this demo`, { tone: 'success' });
    else toast(mode === 'call' ? 'Call logged' : 'Note added', { tone: 'success' });
  };

  const ctx = templateContext(lead);

  return (
    <div class="composer">
      <Segmented label="How are you following up?" size="sm" items={modes} value={mode} onChange={setMode} />
      <p class="composer__to">
        {mode === 'email' && (lead.email ? <>To {lead.email}</> : 'No email address on file')}
        {mode === 'text' && (lead.phone ? <>To {phone(lead.phone)}</> : 'No phone number on file')}
        {mode === 'call' &&
          (lead.phone ? (
            <>
              Call <a href={telHref(lead.phone)}>{phone(lead.phone)}</a>, then log what you talked about
            </>
          ) : (
            'No phone number on file'
          ))}
        {mode === 'note' && 'Notes are only visible to your team'}
      </p>
      <div class="composer__templates" role="group" aria-label="Quick replies">
        {templatesFor(mode, lead.kind).map((t) => (
          <button key={t.label} type="button" class="chip composer__chip" onClick={() => setText(t.text(ctx))}>
            {t.label}
          </button>
        ))}
      </div>
      <label class="sr-only" for={`${id}-text`}>
        {mode === 'note' ? 'Note' : mode === 'call' ? 'Call notes' : 'Message'}
      </label>
      <textarea
        id={`${id}-text`}
        class="textarea composer__text"
        rows={mode === 'email' ? 6 : 3}
        placeholder={placeholders[mode]}
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
      />
      <div class="composer__foot">
        <span class="composer__hint">{missing ?? (mode === 'email' || mode === 'text' ? 'Sending is simulated in this demo · Ctrl+Enter to send' : 'Ctrl+Enter to save')}</span>
        <Button variant="primary" size="sm" icon={sendIcons[mode]} disabled={!text.trim() || !!missing} onClick={send}>
          {sendLabels[mode]}
        </Button>
      </div>
    </div>
  );
}
