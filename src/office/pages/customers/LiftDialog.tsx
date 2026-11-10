/**
 * Add a lift to a customer's record (one from before FiberSteel mode, or another installer's), or edit one.
 * Opened from anywhere via openDialog({ kind: 'lift', liftId?, customerId? }).
 */
import { useState } from 'preact/hooks';
import { addLift, liftKindOf, remoteValves, updateLift } from '../../actions';
import { boatTypes } from '../../data/people';
import type { Docking, Lift, LiftKind, RemoteBrand } from '../../data/types';
import { today } from '../../lib/dates';
import { navigate } from '../../router';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Checkbox, Field, Segmented, Switch } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { CustomerPicker } from '../../ui/pickers';
import { bunkOptions, extraOptions, liftKindLabels } from './helpers';

const OTHER = 'other';
const remoteBrands: RemoteBrand[] = ['Admiral', 'FirstMate', 'Captain’s Choice'];

const num = (v: string) => {
  const n = Number(v);
  return v.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
};

export function LiftDialog({ liftId, customerId, onClose }: { liftId?: string; customerId?: string; onClose: () => void }) {
  const d = db.value;
  const existing = liftId ? d.lifts.find((l) => l.id === liftId) : undefined;
  const liftItems = d.items.filter((i) => i.kind === 'lift');

  const [owner, setOwner] = useState<string | undefined>(existing?.customerId ?? customerId);
  const [itemId, setItemId] = useState<string>(existing ? (existing.itemId ?? OTHER) : 'L-10000');
  const [model, setModel] = useState(existing && !existing.itemId ? existing.model : '');
  const [capacity, setCapacity] = useState(existing && !existing.itemId ? String(existing.capacity || '') : '');
  const [kind, setKind] = useState<LiftKind>(existing?.kind ?? 'boat');
  const [serial, setSerial] = useState(existing?.serial ?? '');
  const [installedOn, setInstalledOn] = useState(existing?.installedOn ?? today());
  const [installedBy, setInstalledBy] = useState<Lift['installedBy']>(existing?.installedBy ?? 'FiberSteel');
  const [dealerId, setDealerId] = useState(existing?.dealerId ?? '');
  const [originalOwner, setOriginalOwner] = useState(existing?.originalOwner ?? true);
  const [registered, setRegistered] = useState(existing?.registered ?? false);
  const [boatType, setBoatType] = useState(existing?.boat?.type ?? '');
  const [boatLength, setBoatLength] = useState(existing?.boat ? String(existing.boat.lengthFt) : '');
  const [dry, setDry] = useState(existing?.boat?.dryLb ? String(existing.boat.dryLb) : '');
  const [fuel, setFuel] = useState(existing?.boat?.fuelGal ? String(existing.boat.fuelGal) : '');
  const [slipW, setSlipW] = useState(existing?.slip ? String(existing.slip.widthFt) : '');
  const [slipL, setSlipL] = useState(existing?.slip ? String(existing.slip.lengthFt) : '');
  const [docking, setDocking] = useState<Docking>(existing?.slip?.docking ?? 'straight');
  const [offset, setOffset] = useState(!!existing?.slip?.offset);
  const [bunks, setBunks] = useState(existing?.bunks ?? 'V-bunks');
  const [extras, setExtras] = useState<string[]>(existing?.extras ?? []);
  const [remote, setRemote] = useState<RemoteBrand | ''>(existing?.remote?.brand ?? '');
  const [valves, setValves] = useState(String(existing?.remote?.valves ?? 2));
  const [remoteOn, setRemoteOn] = useState(existing?.remote?.installedOn ?? today());
  const [tried, setTried] = useState(false);

  const item = d.items.find((i) => i.id === itemId);
  const custom = itemId === OTHER;
  const ownerRecord = d.customers.find((c) => c.id === owner);
  const modelError = tried && custom && !model.trim() ? 'Describe the lift (size or make).' : '';
  const ownerError = tried && !owner ? 'Choose the customer whose dock it’s at.' : '';

  const pickItem = (id: string) => {
    setItemId(id);
    const it = d.items.find((i) => i.id === id);
    if (it) {
      setKind(liftKindOf(it));
      if (it.category === 'PWC lifts') setBunks('PWC bunks');
      else if (bunks === 'PWC bunks') setBunks('V-bunks');
    }
  };
  const pickBoat = (type: string) => {
    setBoatType(type);
    const b = boatTypes.find((x) => x.type === type);
    if (b && !existing) setBunks(b.bunks === 'Extra-tall bunks (inboard)' || bunkOptions.includes(b.bunks) ? b.bunks : 'V-bunks');
  };
  const toggleExtra = (x: string) => setExtras(extras.includes(x) ? extras.filter((e) => e !== x) : [...extras, x]);

  const save = (e?: Event) => {
    e?.preventDefault();
    setTried(true);
    if (!owner || (custom && !model.trim())) return;
    const lengthFt = num(boatLength);
    const boat = boatType.trim() && lengthFt ? { type: boatType.trim(), lengthFt, dryLb: num(dry) ?? 0, fuelGal: num(fuel) } : undefined;
    const widthFt = num(slipW);
    const slipLength = num(slipL);
    const slip = widthFt && slipLength ? { widthFt, lengthFt: slipLength, docking, offset: offset || undefined } : undefined;
    const cap = custom ? (num(capacity) ?? 0) : (item?.capacity ?? 0);
    const fields = {
      customerId: owner,
      itemId: custom ? undefined : itemId,
      model: custom ? model.trim() : (item?.name ?? model.trim()),
      capacity: cap,
      kind,
      installedOn,
      installedBy,
      dealerId: installedBy === 'Dealer' && dealerId ? dealerId : undefined,
      originalOwner,
      boat,
      slip,
      bunks,
      extras,
      remote: remote ? { brand: remote, valves: Math.max(1, Math.min(4, Number(valves) || remoteValves(cap))), installedOn: remoteOn } : undefined,
    };
    if (existing) {
      const s = serial.trim() || existing.serial;
      updateLift(existing.id, { ...fields, serial: s, registered, registrationNo: registered ? (existing.registrationNo ?? `REG-${s.replace(/^FS/i, '')}`) : undefined });
      toast('Lift details saved');
      onClose();
      return;
    }
    const id = addLift({ ...fields, serial: serial.trim() || undefined, registered });
    toast(`${fields.model} added to ${ownerRecord?.name ?? 'the customer'}’s record`);
    onClose();
    navigate(`/office/customers/?id=${owner}&lift=${id}`);
  };

  return (
    <Dialog
      title={existing ? `Edit ${existing.model}` : 'Add a lift'}
      description={existing ? `Serial ${existing.serial} · ${ownerRecord?.name ?? ''}` : ownerRecord ? `At ${ownerRecord.name}’s dock` : 'A lift already at a customer’s dock — one from before FiberSteel mode, or another installer’s.'}
      onClose={onClose}
      size="lg"
      class="cust-dialog lift-dialog"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => save()}>
            {existing ? 'Save changes' : 'Add the lift'}
          </Button>
        </>
      }
    >
      <form class="stack" onSubmit={save} noValidate>
        {!existing && !customerId && (
          <div>
            <CustomerPicker value={owner} onChange={setOwner} kinds={['owner', 'marina']} label="Customer" autoFocus />
            {ownerError && <span class="field__error-text">{ownerError}</span>}
          </div>
        )}

        <fieldset class="lift-form__group">
          <legend class="section-label">The lift</legend>
          <div class="form-grid">
            <Field label="Size">
              <select class="select" value={itemId} data-autofocus={existing || customerId ? '' : undefined} onChange={(e) => pickItem((e.target as HTMLSelectElement).value)}>
                {liftItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
                <option value={OTHER}>Another size or make</option>
              </select>
            </Field>
            <Field label="Type">
              <select class="select" value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as LiftKind)}>
                {(Object.keys(liftKindLabels) as LiftKind[]).map((k) => (
                  <option key={k} value={k}>
                    {liftKindLabels[k]}
                  </option>
                ))}
              </select>
            </Field>
            {custom && (
              <>
                <Field label="Description">
                  <input class="input" value={model} placeholder="e.g. Older 8,000 lb lift" aria-invalid={modelError ? 'true' : undefined} onInput={(e) => setModel((e.target as HTMLInputElement).value)} />
                  {modelError && <span class="field__error-text">{modelError}</span>}
                </Field>
                <Field label="Rated capacity (lb)" optional>
                  <input class="input" inputMode="numeric" value={capacity} onInput={(e) => setCapacity((e.target as HTMLInputElement).value)} />
                </Field>
              </>
            )}
            <Field label="Serial number" optional hint={existing ? undefined : 'Left blank, FiberSteel mode makes one up for the demo.'}>
              <input class="input" value={serial} autocomplete="off" onInput={(e) => setSerial((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Installed on">
              <input class="input" type="date" value={installedOn} max={today()} onInput={(e) => setInstalledOn((e.target as HTMLInputElement).value || today())} />
            </Field>
          </div>
          <Segmented<Lift['installedBy']>
            label="Who installed it"
            value={installedBy}
            onChange={setInstalledBy}
            items={[
              { key: 'FiberSteel', label: 'FiberSteel' },
              { key: 'Dealer', label: 'A FiberSteel dealer' },
              { key: 'Other', label: 'Someone else' },
            ]}
          />
          {installedBy === 'Dealer' && (
            <Field label="Dealer" optional>
              <select class="select" value={dealerId} onChange={(e) => setDealerId((e.target as HTMLSelectElement).value)}>
                <option value="">Not sure</option>
                {d.dealers.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div class="lift-form__switches">
            <Switch checked={originalOwner} onChange={setOriginalOwner} label="Original purchaser" description="FiberSteel’s warranty is for the original purchaser, for as long as they own the lift." />
            <Switch checked={registered} onChange={setRegistered} label="Warranty registered" />
          </div>
          {installedBy !== 'FiberSteel' && (
            <p class="callout">
              <Icon name="info" size={16} />
              <span>FiberSteel’s warranty is valid only on lifts FiberSteel installed, so this lift will show as not covered.</span>
            </p>
          )}
        </fieldset>

        <fieldset class="lift-form__group">
          <legend class="section-label">The boat it holds</legend>
          <div class="form-grid form-grid--4">
            <Field label="Boat type" class="span-2">
              <input class="input" list="lift-boat-types" value={boatType} placeholder="e.g. Pontoon" onInput={(e) => pickBoat((e.target as HTMLInputElement).value)} />
              <datalist id="lift-boat-types">
                {boatTypes.map((b) => (
                  <option key={b.type} value={b.type} />
                ))}
              </datalist>
            </Field>
            <Field label="Length (ft)">
              <input class="input" inputMode="decimal" value={boatLength} onInput={(e) => setBoatLength((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Dry weight (lb)">
              <input class="input" inputMode="numeric" value={dry} onInput={(e) => setDry((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Fuel (gal)" optional>
              <input class="input" inputMode="numeric" value={fuel} onInput={(e) => setFuel((e.target as HTMLInputElement).value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset class="lift-form__group">
          <legend class="section-label">The slip and setup</legend>
          <div class="form-grid form-grid--4">
            <Field label="Slip width (ft)">
              <input class="input" inputMode="decimal" value={slipW} onInput={(e) => setSlipW((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Slip length (ft)">
              <input class="input" inputMode="decimal" value={slipL} onInput={(e) => setSlipL((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Docking">
              <select class="select" value={docking} onChange={(e) => setDocking((e.target as HTMLSelectElement).value as Docking)}>
                <option value="straight">Straight pull-in</option>
                <option value="back-in">Back-in</option>
              </select>
            </Field>
            <Field label="Bunks">
              <select class="select" value={bunks} onChange={(e) => setBunks((e.target as HTMLSelectElement).value)}>
                {[...new Set([...bunkOptions, bunks])].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </Field>
          </div>
          <Checkbox checked={offset} onChange={setOffset}>
            Set off-center in the slip
          </Checkbox>
          <fieldset class="lift-form__extras">
            <legend class="field__label">Extras</legend>
            <div class="chips">
              {[...new Set([...extraOptions, ...extras])].map((x) => (
                <button key={x} type="button" class="chip" aria-pressed={extras.includes(x)} onClick={() => toggleExtra(x)}>
                  {extras.includes(x) && <Icon name="check" size={13} stroke={2.6} />}
                  {x}
                </button>
              ))}
            </div>
          </fieldset>
        </fieldset>

        <fieldset class="lift-form__group">
          <legend class="section-label">Remote control</legend>
          <div class="form-grid form-grid--4">
            <Field label="Remote system" class="span-2">
              <select class="select" value={remote} onChange={(e) => setRemote((e.target as HTMLSelectElement).value as RemoteBrand | '')}>
                <option value="">None</option>
                {remoteBrands.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </Field>
            {remote && (
              <>
                <Field label="Valves">
                  <select class="select" value={valves} onChange={(e) => setValves((e.target as HTMLSelectElement).value)}>
                    {['1', '2', '3', '4'].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Fitted on">
                  <input class="input" type="date" value={remoteOn} max={today()} onInput={(e) => setRemoteOn((e.target as HTMLInputElement).value || today())} />
                </Field>
              </>
            )}
          </div>
          {remote && remote !== 'Admiral' && (
            <p class="muted small">FiberSteel’s warranty page refers {remote} remote warranties to their maker — see Warranty → Coverage check for the contact.</p>
          )}
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
