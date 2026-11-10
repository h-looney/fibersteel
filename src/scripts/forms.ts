/**
 * Shared front-end form helpers.
 *
 * There is no backend yet: forms validate in the browser and then "submit"
 * locally. To wire one up, add `data-endpoint="https://…"` to the <form>;
 * the payload is POSTed as JSON (files are listed by name only).
 */

const messages: Record<string, string> = {
  valueMissing: 'This field is required.',
  typeMismatch: 'Please check the format.',
  patternMismatch: 'Please check the format.',
  tooShort: 'Please add a little more detail.',
};

const errorFor = (input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
  const v = input.validity;
  if (v.valueMissing) return input.dataset.msgRequired ?? messages.valueMissing;
  if (v.typeMismatch) return input.dataset.msgFormat ?? (input.type === 'email' ? 'Please enter a valid email address.' : messages.typeMismatch);
  if (v.patternMismatch) return input.dataset.msgFormat ?? messages.patternMismatch;
  if (v.tooShort) return messages.tooShort;
  return '';
};

/** Validate every field inside `scope`. Returns true when all are valid. */
export function validate(scope: HTMLElement): boolean {
  let firstInvalid: HTMLElement | null = null;

  // Single inputs
  scope
    .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input:not([type=radio]):not([type=checkbox]):not([type=file]), select, textarea',
    )
    .forEach((input) => {
      const field = input.closest<HTMLElement>('.field');
      if (!field) return;
      const message = input.checkValidity() ? '' : errorFor(input);
      setError(field, message, input);
      if (message && !firstInvalid) firstInvalid = input;
    });

  // Required radio / checkbox groups
  scope.querySelectorAll<HTMLElement>('[data-required-group]').forEach((group) => {
    const ok = !!group.querySelector('input:checked');
    setError(group, ok ? '' : group.dataset.msgRequired ?? 'Please choose at least one option.');
    if (!ok && !firstInvalid) firstInvalid = group.querySelector('input');
  });

  if (firstInvalid) (firstInvalid as HTMLElement).focus();
  return !firstInvalid;
}

function setError(field: HTMLElement, message: string, input?: HTMLElement) {
  const error = field.querySelector<HTMLElement>(':scope > .field__error, :scope .field__error');
  if (message) {
    field.dataset.invalid = '';
    if (error) error.textContent = message;
    input?.setAttribute('aria-invalid', 'true');
  } else {
    delete field.dataset.invalid;
    input?.removeAttribute('aria-invalid');
  }
}

/** Clear an individual field's error as soon as the visitor fixes it. */
export function liveClear(form: HTMLFormElement) {
  form.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    const field = input.closest<HTMLElement>('.field, [data-required-group]');
    if (!field || !('invalid' in field.dataset)) return;
    const ok = input.type === 'radio' || input.type === 'checkbox' ? !!field.querySelector('input:checked') : input.checkValidity();
    if (ok) setError(field, '', input);
  });
}

/** Turn FormData into a plain object, collecting repeated keys into arrays. */
export function toObject(data: FormData) {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of data.entries()) {
    const v = value instanceof File ? value.name : String(value);
    if (value instanceof File && !value.name) continue;
    if (key in out) out[key] = ([] as string[]).concat(out[key], v);
    else out[key] = v;
  }
  return out;
}

/** Submit to `data-endpoint` if present; otherwise simulate a short delay. */
export async function submit(form: HTMLFormElement): Promise<string | undefined> {
  const payload = toObject(new FormData(form));
  const endpoint = form.dataset.endpoint;
  if (endpoint) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return undefined;
  }
  // Front-end prototype: nothing leaves the browser. In the concept demo, the request is handed to FiberSteel mode
  // (the optional staff demo) through localStorage — see src/office/bridge.ts.
  console.info('[FiberSteel concept] Form submitted (not sent — no backend configured):', payload);
  await new Promise((resolve) => setTimeout(resolve, 700));
  return deliverToOffice(form);
}

type OfficeKind = 'quote' | 'service' | 'warranty' | 'dealer' | 'contact';

/** Labels FiberSteel mode shows for each form field, per form (`data-office="quote|service|warranty|dealer|contact"`). */
const officeFields: Record<OfficeKind, [name: string, label: string][]> = {
  quote: [
    ['boatType', 'Boat type'],
    ['brand', 'Boat brand'],
    ['model', 'Model'],
    ['length', 'Length (ft)'],
    ['dryWeight', 'Dry weight (lb)'],
    ['fuel', 'Fuel capacity (gal)'],
    ['suggested', 'Calculator suggested'],
    ['slipWidth', 'Slip width (ft)'],
    ['slipLength', 'Slip length (ft)'],
    ['docking', 'Docking'],
    ['water', 'Water at the dock'],
    ['extras', 'Interested in'],
    ['location', 'Where the dock is'],
    ['timeline', 'When'],
    ['contactPref', 'Best way to reach you'],
  ],
  service: [
    ['need', 'What do you need?'],
    ['liftSize', 'Lift size'],
    ['installed', 'Installed by'],
    ['installYear', 'Installed (year)'],
    ['problem', 'The problem'],
    ['remote', 'Remote system'],
    ['location', 'Where the lift is'],
    ['days', 'Best days'],
  ],
  warranty: [
    ['liftSize', 'Lift size'],
    ['installDate', 'Installation date'],
    ['installedBy', 'Installed by'],
    ['serial', 'Serial or order number'],
    ['remote', 'Remote system'],
    ['location', 'Where the lift is'],
  ],
  dealer: [
    ['business', 'Business'],
    ['businessType', 'Type of business'],
    ['city', 'City'],
    ['state', 'State'],
    ['lakes', 'Lakes / areas served'],
    ['website', 'Website'],
    ['years', 'Years in business'],
  ],
  contact: [['topic', 'About']],
};

/** What the visitor saw for a field: option text for selects and checked boxes, typed text otherwise. */
function shown(form: HTMLFormElement, name: string): string {
  const controls = Array.from(form.elements).filter((el) => (el as HTMLInputElement).name === name) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];
  return controls
    .map((el) => {
      if (el instanceof HTMLSelectElement) return el.value ? el.selectedOptions[0]?.textContent?.trim() ?? '' : '';
      if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) return el.checked ? el.closest('label')?.textContent?.trim() ?? el.value : '';
      if (el instanceof HTMLInputElement && el.type === 'file') return '';
      return el.value.trim();
    })
    .filter(Boolean)
    .join(', ');
}

async function deliverToOffice(form: HTMLFormElement): Promise<string | undefined> {
  const kind = form.dataset.office as OfficeKind | undefined;
  if (!kind || !(kind in officeFields)) return undefined;
  const { queueSubmission } = await import('../office/bridge');
  const data = new FormData(form);
  const value = (name: string) => String(data.get(name) ?? '').trim();
  const files = (form.elements.namedItem('photos') as HTMLInputElement | null)?.files?.length ?? 0;
  // The raw values too, so FiberSteel mode can fill in a lift size, a boat, a slip
  const raw: Record<string, string> = {};
  for (const [name] of officeFields[kind]) if (value(name)) raw[name] = value(name);
  return queueSubmission({
    kind,
    name: value('name') || value('contactName'),
    email: value('email') || undefined,
    phone: value('phone') || undefined,
    zip: value('zip') || undefined,
    location: value('location') || undefined,
    message: value('details') || value('description') || value('message') || undefined,
    fields: officeFields[kind].map(([name, label]) => [label, shown(form, name)] as [string, string]).filter(([, v]) => v),
    data: raw,
    photos: files || undefined,
  });
}

/** Toggle a button's busy state while submitting. */
export function setBusy(button: HTMLButtonElement | null, busy: boolean, busyLabel = 'Sending…') {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    if (button.dataset.label) button.innerHTML = button.dataset.label;
    button.disabled = false;
  }
}
