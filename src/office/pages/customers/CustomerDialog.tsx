/** Create or edit a customer. Opened from anywhere via openDialog({ kind: 'customer' }). */
import { useMemo, useState } from 'preact/hooks';
import { createCustomer, updateCustomer } from '../../actions';
import { arms, coves } from '../../data/people';
import type { Customer } from '../../data/types';
import { navigate } from '../../router';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Field } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { contactPrefLabels, kindLabels, suggestedTags } from './helpers';

interface Props {
  customerId?: string;
  preset?: Partial<Customer>;
  onCreated?: (id: string) => void;
  onClose: () => void;
}

const emailOk = (v: string) => !v.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

export function CustomerDialog({ customerId, preset, onCreated, onClose }: Props) {
  const d = db.value;
  const existing = customerId ? d.customers.find((c) => c.id === customerId) : undefined;
  const base: Partial<Customer> = existing ?? preset ?? {};

  const [name, setName] = useState(base.name ?? '');
  const [kind, setKind] = useState<Customer['kind']>(base.kind ?? 'owner');
  const [contact, setContact] = useState(base.contact ?? '');
  const [phone, setPhone] = useState(base.phone ?? '');
  const [email, setEmail] = useState(base.email ?? '');
  const [street, setStreet] = useState(base.address?.street ?? '');
  const [city, setCity] = useState(base.address?.city ?? '');
  const [state, setState] = useState(base.address?.state ?? 'MO');
  const [zip, setZip] = useState(base.address?.zip ?? '');
  const [arm, setArm] = useState(base.lake?.arm ?? '');
  const [mm, setMm] = useState(base.lake?.mm !== undefined ? String(base.lake.mm) : '');
  const [cove, setCove] = useState(base.lake?.cove ?? '');
  const [contactPref, setContactPref] = useState<Customer['contactPref']>(base.contactPref ?? 'phone');
  const [tags, setTags] = useState<string[]>(base.tags ?? []);
  const [newTag, setNewTag] = useState('');
  const [notes, setNotes] = useState(base.notes ?? '');
  const [tried, setTried] = useState(false);

  const tagOptions = useMemo(() => {
    const inUse = new Set(d.customers.flatMap((c) => c.tags));
    inUse.delete('Counter sales');
    return [...new Set([...suggestedTags, ...inUse, ...tags])];
  }, [d.customers, tags]);

  const mmValue = mm.trim() ? Number(mm) : undefined;
  const nameError = tried && !name.trim() ? 'Please enter a name.' : '';
  const emailError = tried && !emailOk(email) ? 'That email address doesn’t look right.' : '';
  const mmError = tried && mm.trim() && !(mmValue !== undefined && Number.isFinite(mmValue) && mmValue >= 0) ? 'Use a number, like 12 or 24.5.' : '';

  const toggleTag = (t: string) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  const addTag = () => {
    const t = newTag.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setNewTag('');
  };

  const save = (e?: Event) => {
    e?.preventDefault();
    setTried(true);
    if (!name.trim() || !emailOk(email) || mmError) return;
    const record = {
      name: name.trim(),
      kind,
      contact: kind === 'owner' ? undefined : contact.trim() || undefined,
      phone: phone.trim(),
      email: email.trim(),
      address: { street: street.trim(), city: city.trim(), state: state.trim() || 'MO', zip: zip.trim() },
      lake: arm.trim() ? { arm: arm.trim(), mm: mmValue !== undefined && Number.isFinite(mmValue) ? mmValue : undefined, cove: cove.trim() || undefined } : undefined,
      store: 'camdenton' as const,
      contactPref,
      tags,
      notes: notes.trim() || undefined,
    };
    if (existing) {
      updateCustomer(existing.id, record);
      toast('Customer details saved');
      onClose();
      return;
    }
    const id = createCustomer(record);
    toast(`${record.name} added as a customer`);
    onClose();
    if (onCreated) onCreated(id);
    else navigate(`/office/customers/?id=${id}`);
  };

  return (
    <Dialog
      title={existing ? `Edit ${existing.name}` : 'New customer'}
      description={existing ? `Customer ${existing.id}` : 'A lake owner, a marina or resort, or a dealer.'}
      onClose={onClose}
      size="lg"
      class="cust-dialog"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => save()}>
            {existing ? 'Save changes' : 'Add customer'}
          </Button>
        </>
      }
    >
      <form class="stack" onSubmit={save} noValidate>
        <div class="form-grid">
          <Field label={kind === 'owner' ? 'Name' : 'Business name'}>
            <input class="input" value={name} aria-invalid={nameError ? 'true' : undefined} data-autofocus onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            {nameError && <span class="field__error-text">{nameError}</span>}
          </Field>
          <Field label="Customer type">
            <select class="select" value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as Customer['kind'])}>
              {(Object.keys(kindLabels) as Customer['kind'][]).map((k) => (
                <option key={k} value={k}>
                  {kindLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          {kind !== 'owner' && (
            <Field label="Contact person" class="span-2">
              <input class="input" value={contact} onInput={(e) => setContact((e.target as HTMLInputElement).value)} />
            </Field>
          )}
          {kind === 'dealer' && !existing?.dealerId && (
            <p class="callout span-2">
              <Icon name="info" size={16} />
              <span>To set up a dealer with pricing and orders, use Dealers → Add dealer — it creates this billing record too.</span>
            </p>
          )}
          <Field label="Phone">
            <input class="input" type="tel" autocomplete="off" value={phone} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Email">
            <input class="input" type="email" autocomplete="off" value={email} aria-invalid={emailError ? 'true' : undefined} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
            {emailError && <span class="field__error-text">{emailError}</span>}
          </Field>
          <Field label="Street address" class="span-2">
            <input class="input" value={street} onInput={(e) => setStreet((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="City">
            <input class="input" value={city} onInput={(e) => setCity((e.target as HTMLInputElement).value)} />
          </Field>
          <div class="cust-form__statezip">
            <Field label="State">
              <input class="input" value={state} maxLength={2} onInput={(e) => setState((e.target as HTMLInputElement).value.toUpperCase())} />
            </Field>
            <Field label="ZIP">
              <input class="input" inputMode="numeric" value={zip} maxLength={10} onInput={(e) => setZip((e.target as HTMLInputElement).value)} />
            </Field>
          </div>
        </div>

        {kind !== 'dealer' && (
          <fieldset class="cust-form__lake">
            <legend class="field__label">Where the dock is</legend>
            <div class="form-grid form-grid--3">
              <Field label="Arm or channel">
                <input class="input" list="cust-arms" value={arm} placeholder="e.g. Gravois arm" onInput={(e) => setArm((e.target as HTMLInputElement).value)} />
                <datalist id="cust-arms">
                  {arms.map((a) => (
                    <option key={a.arm} value={a.arm} />
                  ))}
                </datalist>
              </Field>
              <Field label="Mile marker">
                <input class="input" inputMode="decimal" value={mm} aria-invalid={mmError ? 'true' : undefined} placeholder="e.g. 12" onInput={(e) => setMm((e.target as HTMLInputElement).value)} />
                {mmError && <span class="field__error-text">{mmError}</span>}
              </Field>
              <Field label="Cove" optional>
                <input class="input" list="cust-coves" value={cove} onInput={(e) => setCove((e.target as HTMLInputElement).value)} />
                <datalist id="cust-coves">
                  {coves.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>
            <p class="muted small">Crews find docks by arm, mile marker and cove. Leave it blank for customers who aren’t on the lake.</p>
          </fieldset>
        )}

        <Field label="Best way to reach them">
          <select class="select" value={contactPref} onChange={(e) => setContactPref((e.target as HTMLSelectElement).value as Customer['contactPref'])}>
            {(Object.keys(contactPrefLabels) as Customer['contactPref'][]).map((k) => (
              <option key={k} value={k}>
                {contactPrefLabels[k]}
              </option>
            ))}
          </select>
        </Field>

        <fieldset class="cust-form__tags">
          <legend class="field__label">Tags</legend>
          <div class="chips">
            {tagOptions.map((t) => (
              <button key={t} type="button" class="chip" aria-pressed={tags.includes(t)} onClick={() => toggleTag(t)}>
                {tags.includes(t) && <Icon name="check" size={13} stroke={2.6} />}
                {t}
              </button>
            ))}
          </div>
          <div class="cust-form__newtag">
            <label class="sr-only" for="new-tag">
              New tag
            </label>
            <input
              id="new-tag"
              class="input input--sm"
              placeholder="Add a tag"
              value={newTag}
              onInput={(e) => setNewTag((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <Button size="sm" icon="plus" disabled={!newTag.trim()} onClick={addTag}>
              Add
            </Button>
          </div>
        </fieldset>

        <Field label="Notes" optional hint="Gate codes, dock access, the best time to come by — anything the crew should know.">
          <textarea class="textarea" rows={3} value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
