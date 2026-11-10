/** Log a request that didn't come through the website: a phone call, a walk-in, a Facebook message, a boat show… */
import { useState } from 'preact/hooks';
import { estimateLiftSize, lb } from '../../../data/lifts';
import { logRequest } from '../../actions';
import type { BoatInfo, LeadKind, LeadSource } from '../../data/types';
import { navigate } from '../../router';
import { customerOf } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Field, Segmented } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { CustomerPicker, whereLabel } from '../../ui/pickers';
import { sourceLabels } from '../../ui/status';

const sources: LeadSource[] = ['phone', 'walk-in', 'facebook', 'referral', 'boat-show'];

/** The boat types the website's quote form offers */
const boatTypes = ['PWC / personal watercraft', 'V-bottom (fishing, ski, runabout)', 'Cat-hull', 'Pontoon or tri-toon', 'Performance boat or cuddy', 'Cruiser or large boat', 'Sailboat', 'Something else'];

type Kind = Exclude<LeadKind, 'warranty'>;

const summaryHints: Record<Kind, string> = {
  quote: 'e.g. 22 ft pontoon, wants a lift before Memorial Day',
  service: 'e.g. Lift raises slowly — blower runs, no air at one tank',
  dealer: 'e.g. Marina on a reservoir asking about carrying lifts',
  question: 'e.g. Asked whether there are any used lifts for a tri-toon',
};

const num = (v: string) => {
  const n = Number(v.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function RequestDialog({ onClose }: { onClose: () => void }) {
  const d = db.value;

  const [kind, setKind] = useState<Kind>('quote');
  const [source, setSource] = useState<LeadSource>('phone');
  const [who, setWho] = useState<'new' | 'existing'>('new');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [phoneNo, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [boatType, setBoatType] = useState(boatTypes[1]);
  const [length, setLength] = useState('');
  const [dry, setDry] = useState('');
  const [fuel, setFuel] = useState('');
  const [summary, setSummary] = useState('');
  const [message, setMessage] = useState('');
  const [assignee, setAssignee] = useState<string | undefined>();

  const customer = who === 'existing' ? customerOf(d, customerId) : undefined;
  const assignTo = assignee ?? d.settings.forms.routing[kind];

  // Quotes: FiberSteel's formula as the numbers come in
  const lengthFt = num(length);
  const dryLb = num(dry);
  const fuelGal = num(fuel);
  const estimate = kind === 'quote' && lengthFt && dryLb ? estimateLiftSize(dryLb, fuelGal ?? 0, lengthFt) : undefined;
  const boatShort = boatType.replace(/ \(.*\)$/, '').replace(/ \/ .*$/, '');
  const autoSummary = kind === 'quote' && lengthFt ? [`${lengthFt} ft ${boatShort.toLowerCase()}`, estimate?.size?.name].filter(Boolean).join(' · ') : '';
  const finalSummary = summary.trim() || autoSummary;
  const canSave = (who === 'existing' ? !!customer : name.trim().length > 0) && finalSummary.length > 0;

  const save = () => {
    if (!canSave) return;
    const boat: BoatInfo | undefined = kind === 'quote' && lengthFt ? { type: boatShort, lengthFt, dryLb: dryLb ?? 0, fuelGal } : undefined;
    const id = logRequest({
      kind,
      source,
      name: customer ? (customer.contact ?? customer.name) : name.trim(),
      phone: customer ? customer.phone : phoneNo.trim() || undefined,
      email: customer ? customer.email : email.trim() || undefined,
      city: customer ? customer.address.city : city.trim() || undefined,
      location: location.trim() || (customer?.lake ? whereLabel(customer) : undefined),
      summary: finalSummary,
      message: message.trim() || undefined,
      assignee: assignTo,
      customerId: customer?.id,
      boat,
      suggestedSize: estimate?.size?.id,
    });
    onClose();
    navigate(`/office/inbox/?id=${id}`);
    toast(`Request ${id} logged`, { tone: 'success' });
  };

  return (
    <Dialog
      title="Log a request"
      description="For calls, walk-ins, Facebook messages and boat-show conversations that didn’t come through the website."
      size="md"
      class="inbox-dialog"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" disabled={!canSave} onClick={save}>
            Log request
          </Button>
        </>
      }
    >
      <form
        class="stack request-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div class="form-grid">
          <div class="field span-2">
            <span class="field__label">What do they need?</span>
            <Segmented
              label="Request type"
              items={[
                { key: 'quote', label: 'A lift quote', icon: 'lift' },
                { key: 'service', label: 'Service', icon: 'wrench' },
                { key: 'dealer', label: 'To be a dealer', icon: 'handshake' },
                { key: 'question', label: 'A question', icon: 'message' },
              ]}
              value={kind}
              onChange={setKind}
            />
          </div>
          <Field label="How did they reach you?" class="span-2">
            <select class="select" value={source} onChange={(e) => setSource((e.target as HTMLSelectElement).value as LeadSource)}>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {sourceLabels[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset class="request-form__who">
          <legend class="field__label">Who is it from?</legend>
          <Segmented
            label="Contact"
            size="sm"
            items={[
              { key: 'new', label: 'New contact' },
              { key: 'existing', label: 'Existing customer' },
            ]}
            value={who}
            onChange={setWho}
          />
          {who === 'existing' ? (
            <CustomerPicker value={customerId} onChange={setCustomerId} />
          ) : (
            <div class="form-grid">
              <Field label="Name" class="span-2">
                <input class="input" value={name} autocomplete="off" data-autofocus onInput={(e) => setName((e.target as HTMLInputElement).value)} />
              </Field>
              <Field label="Phone" optional>
                <input class="input" type="tel" value={phoneNo} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} />
              </Field>
              <Field label="Email" optional>
                <input class="input" type="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
              </Field>
              <Field label="Town" optional class="span-2">
                <input class="input" value={city} onInput={(e) => setCity((e.target as HTMLInputElement).value)} />
              </Field>
            </div>
          )}
        </fieldset>

        {kind !== 'dealer' && kind !== 'question' && (
          <Field label="Where the dock is" optional hint="Arm or channel, mile marker, cove">
            <input class="input" value={location} placeholder={customer?.lake ? whereLabel(customer) : 'e.g. Gravois arm, MM 9 · Sunset Cove'} onInput={(e) => setLocation((e.target as HTMLInputElement).value)} />
          </Field>
        )}

        {kind === 'quote' && (
          <fieldset class="request-form__boat">
            <legend class="field__label">The boat</legend>
            <div class="form-grid">
              <Field label="Boat type" class="span-2">
                <select class="select" value={boatType} onChange={(e) => setBoatType((e.target as HTMLSelectElement).value)}>
                  {boatTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Length (ft)">
                <input class="input" inputMode="decimal" value={length} onInput={(e) => setLength((e.target as HTMLInputElement).value)} />
              </Field>
              <Field label="Dry weight (lb)">
                <input class="input" inputMode="numeric" value={dry} onInput={(e) => setDry((e.target as HTMLInputElement).value)} />
              </Field>
              <Field label="Fuel (gal)" optional>
                <input class="input" inputMode="numeric" value={fuel} onInput={(e) => setFuel((e.target as HTMLInputElement).value)} />
              </Field>
            </div>
            <p class="request-form__estimate" aria-live="polite">
              <Icon name="calculator" size={15} />
              {estimate ? (
                <span>
                  Needs {lb(estimate.needed)} of lift →{' '}
                  <strong>{estimate.size ? estimate.size.name : 'more than the largest standard size (a custom build)'}</strong>
                </span>
              ) : (
                <span class="muted">Add the length and dry weight to work out the size with FiberSteel’s formula.</span>
              )}
            </p>
          </fieldset>
        )}

        <Field label="Summary" hint={autoSummary && !summary.trim() ? `Leave blank to use “${autoSummary}”` : 'A short line the whole team will see in the inbox'}>
          <input class="input" value={summary} placeholder={autoSummary || summaryHints[kind]} onInput={(e) => setSummary((e.target as HTMLInputElement).value)} />
        </Field>
        <Field label="Details" optional>
          <textarea class="textarea" rows={3} value={message} placeholder="What they said, the slip size, best times to call…" onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)} />
        </Field>
        <Field label="Assign to" hint={assignee ? undefined : 'Picked from the website-form routing in Settings'}>
          <select class="select" value={assignTo} onChange={(e) => setAssignee((e.target as HTMLSelectElement).value)}>
            {d.staff
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.title}
                </option>
              ))}
          </select>
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
