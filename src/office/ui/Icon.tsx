import { icons as siteIcons } from '../../data/icons';

/** The public site's icons plus the ones FiberSteel mode needs (same 24×24 stroke style). */
const officeIcons = {
  inbox: '<path d="M3.5 13.5h4.6l1.4 2.6h5l1.4-2.6h4.6"/><path d="M5.6 5.5h12.8l2.1 8v4.8a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7v-4.8z"/>',
  dashboard: '<rect x="3.5" y="3.5" width="7" height="8" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.5"/>',
  box: '<path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9z"/><path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 3.5h6v3H9z"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4"/>',
  truck: '<path d="M3 6.5h11v9.5H3z"/><path d="M14 9.5h3.8l3.2 3.4v3.1h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2H5z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1-3.8 3.9-6 7.5-6s6.5 2.2 7.5 6"/>',
  logout: '<path d="M14.5 4.5h3.8a1.7 1.7 0 0 1 1.7 1.7v11.6a1.7 1.7 0 0 1-1.7 1.7h-3.8"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
  file: '<path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12z"/><path d="M14 3.5V8h4.5M9 12.5h6M9 16h6"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M6.5 15h3"/>',
  bank: '<path d="M3.5 9 12 4l8.5 5z"/><path d="M5.5 10v7M9.8 10v7M14.2 10v7M18.5 10v7M3.5 20h17"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8.5 16v-5M13 16V8M17.5 16v-3"/>',
  trend: '<path d="m3.5 16.5 5.5-5.5 4 4 7.5-7.5"/><path d="M15 7.5h5.5V13"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 0 1-13.1 5M4.5 12a7.5 7.5 0 0 1 13.1-5"/><path d="M17.8 3.5v3.7h-3.7M6.2 20.5v-3.7h3.7"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  filter: '<path d="M4 5.5h16l-6.2 7.3v5.4l-3.6 1.8v-7.2z"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="17.5" r="1" fill="currentColor" stroke="none"/>',
  columns: '<rect x="3.5" y="4" width="5" height="16" rx="1.2"/><rect x="10" y="4" width="5" height="11" rx="1.2"/><rect x="16.5" y="4" width="4" height="7" rx="1.2"/>',
  edit: '<path d="m4.5 19.5 1-4.2L15.8 5a2 2 0 0 1 2.9 0l.3.3a2 2 0 0 1 0 2.9L8.7 18.5z"/><path d="m13.8 7 3.2 3.2"/>',
  trash: '<path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l.9 12.3a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5L17.5 7"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1"/><path d="M5 9v9.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>',
  star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.5L12 16.6l-5 2.6.9-5.5-4-4 5.6-.8z"/>',
  download: '<path d="M12 4.5v11M7.5 11 12 15.5 16.5 11"/><path d="M4.5 15.5v2.8a1.7 1.7 0 0 0 1.7 1.7h11.6a1.7 1.7 0 0 0 1.7-1.7v-2.8"/>',
  printer: '<path d="M7 9V4h10v5"/><rect x="3.5" y="9" width="17" height="7.5" rx="1.5"/><path d="M7 14h10v6H7z"/>',
  alert: '<path d="M10.4 4.4 2.9 17.6a1.8 1.8 0 0 0 1.6 2.7h15a1.8 1.8 0 0 0 1.6-2.7L13.6 4.4a1.8 1.8 0 0 0-3.2 0z"/><path d="M12 9.5v4.2M12 16.8v.2"/>',
  'check-circle': '<circle cx="12" cy="12" r="8.8"/><path d="m8.2 12.3 2.6 2.6 5-5.2"/>',
  'x-circle': '<circle cx="12" cy="12" r="8.8"/><path d="m9 9 6 6M15 9l-6 6"/>',
  send: '<path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>',
  note: '<path d="M5 4.5h14v9.5l-5 5H5z"/><path d="M14 19v-5h5"/>',
  store: '<path d="M4.5 10v10h15V10"/><path d="M3 4.5h18l-1 5.5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0z"/><path d="M10 20v-5h4v5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  transfer: '<path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/>',
  minus: '<path d="M5 12h14"/>',
  globe: '<circle cx="12" cy="12" r="8.8"/><path d="M3.2 12h17.6M12 3.2c2.4 2.4 3.6 5.4 3.6 8.8s-1.2 6.4-3.6 8.8c-2.4-2.4-3.6-5.4-3.6-8.8S9.6 5.6 12 3.2z"/>',
  grip: '<circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
  receipt: '<path d="M6 3.5h12v17l-2.4-1.4-2.4 1.4-2.4-1.4-2.4 1.4L6 20.5z"/><path d="M9 8h6M9 11.5h6M9 15h4"/>',
  sort: '<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
  'sort-up': '<path d="m8 14 4-4 4 4"/>',
  'sort-down': '<path d="m8 10 4 4 4-4"/>',
  undo: '<path d="M9 8.5 4.5 13 9 17.5"/><path d="M4.5 13h10a5 5 0 0 0 0-10H11"/>',
  map: '<path d="m9 4.5-5.5 2v13l5.5-2 6 2 5.5-2v-13l-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
  message: '<path d="M4 5.5h16v10.5H9.5L5 19.5V16H4z"/>',
  'calendar-plus': '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
  wifi: '<path d="M3 9.5a13 13 0 0 1 18 0M6 13a8.5 8.5 0 0 1 12 0M9.2 16.4a4 4 0 0 1 5.6 0"/><circle cx="12" cy="19.4" r="1" fill="currentColor" stroke="none"/>',
  zap: '<path d="M13.2 2.8 4.8 13.6h6.4l-.9 7.6 8.9-11h-6.6z"/>',
  pen: '<path d="M4 20c3-1 4.5-4 7.5-7.5s5.5-6.5 7-7c1 .5 1.5 1.5 1 2.5-.5 1.5-3.5 4-7 7S5 17 4 20z"/><path d="M4 20h7"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M17.5 13.5v4.8a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 18.3V8.2a1.7 1.7 0 0 1 1.7-1.7h4.8"/>',
} as const;

export const icons = { ...siteIcons, ...officeIcons };
export type IconName = keyof typeof icons;

interface Props {
  name: IconName;
  size?: number;
  class?: string;
  /** Give the icon an accessible name; otherwise it's hidden from assistive tech */
  label?: string;
  stroke?: number;
}

export function Icon({ name, size = 18, class: className, label, stroke = 1.75 }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={`icon${className ? ` ${className}` : ''}`}
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: icons[name] }}
    />
  );
}
