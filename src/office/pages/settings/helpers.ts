/** Settings helpers: team invitations and edits, and the demo-data download. */
import type { Role, Staff } from '../../data/types';
import { edit, mutate } from '../../store';

const palette = ['#1d4ed0', '#277553', '#8a5a1c', '#6b4fa3', '#a2456b', '#1f7a8c', '#4f6176', '#5b5fa8', '#8c3b5e', '#3d7d5a'];

/** A sensible job title for each role (editable when inviting) */
export const defaultTitles: Record<Role, string> = {
  owner: 'Owner',
  sales: 'Sales',
  service: 'Service, parts & repairs',
  office: 'Office & accounting',
  shop: 'Fabricator',
  crew: 'Installer',
};

/** Invited teammates show as pending (inactive) until they accept. */
export const isInvited = (s: Staff) => s.id.startsWith('inv-') && !s.active;

/** Invite a teammate. The invitation email is simulated. */
export function inviteStaff(input: { name: string; role: Role; title: string }): string {
  let id = '';
  mutate((d) => {
    const slug = input.name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '') || 'teammate';
    id = `inv-${slug}`;
    for (let n = 2; d.staff.some((s) => s.id === id); n++) id = `inv-${slug}-${n}`;
    d.staff.push({
      id,
      name: input.name,
      role: input.role,
      title: input.title,
      store: 'camdenton',
      color: palette[d.staff.length % palette.length],
      tech: input.role === 'crew',
      shop: input.role === 'shop',
      active: false,
    });
  });
  return id;
}

export function updateStaff(id: string, patch: Partial<Staff>) {
  mutate((d) =>
    edit(d.staff, id, (s) => {
      Object.assign(s, patch);
      if (patch.role) {
        s.tech = patch.role === 'crew';
        s.shop = patch.role === 'shop';
      }
    }),
  );
}

/** Only pending invitations can be removed — everyone else may be referenced by past work. */
export function cancelInvite(id: string) {
  mutate((d) => {
    d.staff = d.staff.filter((s) => !(s.id === id && isInvited(s)));
  });
}

/** Save any value as a pretty-printed JSON download. */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
