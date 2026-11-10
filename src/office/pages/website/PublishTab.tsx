/**
 * Website → Publishing: everything waiting for the next publish, and the publishes so far — all simulated. In
 * production a publish would rebuild the site in about a minute; here it updates the previews the public pages show
 * in this browser.
 *   /office/website/?tab=publish
 */
import { firstName } from '../../selectors';
import { dayTime, plural } from '../../lib/format';
import { setParams } from '../../router';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Card, EmptyState } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { publishPending, undoDealer, undoInstall, undoUsed } from './actions';
import { pendingChanges, type PendingChange } from './data';

const areaLabel: Record<PendingChange['area'], string> = { installs: 'Lifts we’ve installed', used: 'Used lifts', dealers: 'Dealer list' };
const areaTab: Record<PendingChange['area'], string> = { installs: 'installs', used: 'used', dealers: 'dealers' };

function undo(c: PendingChange) {
  if (c.area === 'installs') undoInstall(c.id);
  else if (c.area === 'used') undoUsed(c.id);
  else undoDealer(c.id);
}

export function PublishTab() {
  const d = db.value;
  const changes = pendingChanges.value;
  const history = d.website.publishes;
  return (
    <div class="installs-tab">
      <Card
        title={changes.length ? `Waiting for the next publish (${changes.length})` : 'Nothing waiting'}
        subtitle="Saved in this browser. A publish puts them on the public pages — here, as previews in this browser only."
        actions={
          changes.length > 0 && (
            <Button
              variant="primary"
              icon="send"
              onClick={() => {
                const n = publishPending();
                toast(`Published ${plural(n, 'change')} (simulated) — the public pages in this browser show them as previews`, { tone: 'success' });
              }}
            >
              Publish now (simulated)
            </Button>
          )
        }
        flush
      >
        {changes.length ? (
          <ul class="web-list" role="list">
            {changes.map((c) => (
              <li key={c.key} class="web-item">
                <div class="web-item__main">
                  <p class="web-item__title">{c.title}</p>
                  <p class="web-item__meta">
                    {areaLabel[c.area]} · {c.what}
                  </p>
                </div>
                <div class="web-item__actions">
                  <Button size="sm" variant="ghost" onClick={() => setParams({ tab: areaTab[c.area], [c.area === 'installs' ? 'install' : c.area === 'used' ? 'listing' : 'dealer']: c.id })}>
                    Open<span class="sr-only">: {c.title}</span>
                  </Button>
                  {c.canUndo && (
                    <Button size="sm" variant="ghost" icon="undo" onClick={() => (undo(c), toast(`${c.title}: back to how the site shows it`))}>
                      Undo<span class="sr-only">: {c.title}</span>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div class="web-note">
            <EmptyState icon="check-circle" title="Everything is published">
              Post an install, change a used-lift listing or fix a dealer’s phone number, and it waits here until you publish.
            </EmptyState>
          </div>
        )}
      </Card>

      <Card title="How publishing would work" level={2}>
        <ul class="used-rules" role="list">
          <li>
            <Icon name="send" size={16} /> In production, “Publish” saves the changes and rebuilds the website — usually in about a minute — so every visitor sees them.
          </li>
          <li>
            <Icon name="eye" size={16} /> In this demo, nothing on the real site changes: the public pages open in this browser show what you published, marked “Preview”.
          </li>
          <li>
            <Icon name="lock" size={16} /> Photos stay in this browser. A real version would keep them with the site and make the right sizes for phones and big screens.
          </li>
        </ul>
      </Card>

      <Card title="Publishes" subtitle={history.length ? undefined : 'None yet in this browser.'} flush>
        {history.length > 0 && (
          <ul class="web-list" role="list">
            {history.slice(0, 20).map((p) => (
              <li key={p.id} class="web-item">
                <div class="web-item__main">
                  <p class="web-item__title">{plural(p.changes, 'change')} published (simulated)</p>
                  <p class="web-item__meta">
                    {dayTime(p.at)} · {firstName(d, p.by)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
