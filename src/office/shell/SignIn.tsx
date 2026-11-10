/** Demo sign-in: pick a sample profile. A real build would use individual accounts + 2FA. */
import { useAssets } from '../assets';
import { profiles, roleLabels } from '../data/people';
import { PUBLIC_HOME } from '../router';
import { db, ui } from '../store';
import { Avatar, Badge } from '../ui/core';
import { Icon } from '../ui/Icon';
import { switchProfile } from './UserMenu';

export function SignIn() {
  const { signin, logo } = useAssets();
  return (
    <div class="signin">
      <aside class="signin__art" aria-label="About FiberSteel mode">
        <div class="signin__art-inner">
          <img src={logo} alt="FiberSteel Boat Lifts" width={132} height={60} class="signin__logo" />
          <p class="signin__kicker">FiberSteel mode · a demo</p>
          <p class="signin__headline">An idea for the staff side: from the quote to the lift on the water.</p>
          <ul class="signin__points" role="list">
            <li>
              <Icon name="inbox" size={18} /> Quote, service and warranty requests in one shared inbox
            </li>
            <li>
              <Icon name="clipboard" size={18} /> Site visits, shop builds, installs and service on one schedule
            </li>
            <li>
              <Icon name="shield" size={18} /> Every customer’s lifts, with their warranty terms worked out
            </li>
            <li>
              <Icon name="handshake" size={18} /> Dealer accounts and orders, stock, invoicing and the books
            </li>
          </ul>
          <img class="signin__photo" src={signin} alt="" width={600} height={160} />
        </div>
      </aside>
      <main class="signin__panel" id="office-main">
        <div class="signin__box">
          <h1 class="signin__title" data-page-title tabIndex={-1}>
            Try FiberSteel mode
          </h1>
          <p class="signin__lead">
            <strong>Purely a demo, with sample data.</strong> FiberSteel mode is optional — a real one would be customized to how FiberSteel works. Pick a sample profile to look around; you can switch any time.
          </p>
          <ul class="profile-list profile-list--signin" role="list">
            {profiles.map((p) => {
              const person = db.value.staff.find((s) => s.id === p.id)!;
              return (
                <li key={p.id}>
                  <button type="button" class="profile-option profile-option--lg" onClick={() => switchProfile(person.id, { keepPage: true })}>
                    <Avatar person={person} size={44} />
                    <span>
                      <span class="profile-option__name">
                        {person.name} <span class="muted">· {roleLabels[person.role]}</span>
                        {person.id === ui.value.lastUserId && (
                          <>
                            {' '}
                            <Badge tone="accent" class="profile-option__last">
                              Last used
                            </Badge>
                          </>
                        )}
                      </span>
                      <span class="profile-option__blurb">{p.blurb}</span>
                    </span>
                    <Icon name="arrow-right" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
          <p class="signin__note">
            <Icon name="lock" size={16} />
            <span>Dean is the only real name here, used for a profile. The other people, every customer and every number are made up. A real version would give each person their own sign-in with two-step verification.</span>
          </p>
          <a class="signin__back" href={PUBLIC_HOME}>
            <Icon name="arrow-left" size={16} /> Back to the public website
          </a>
        </div>
      </main>
    </div>
  );
}
