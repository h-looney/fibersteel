/**
 * App-wide dialogs (create/edit forms) can be opened from anywhere — the top bar's "New" menu, a record page, the
 * command palette. The shell's <DialogHost> renders the right one.
 */
import { signal } from '@preact/signals';
import type { Customer, DealerOrder, JobType } from './data/types';

export type DialogRequest =
  | {
      kind: 'job';
      jobId?: string;
      preset?: {
        type?: JobType;
        customerId?: string;
        liftId?: string;
        itemId?: string;
        leadId?: string;
        dealerOrderId?: string;
        issueKey?: string;
        title?: string;
        description?: string;
        location?: string;
      };
    }
  | { kind: 'customer'; customerId?: string; preset?: Partial<Customer>; onCreated?: (id: string) => void }
  /** Add a lift to a customer's record, or edit one */
  | { kind: 'lift'; liftId?: string; customerId?: string }
  | { kind: 'invoice'; invoiceId?: string; preset?: { kind?: 'invoice' | 'estimate'; customerId?: string; jobId?: string; leadId?: string; itemId?: string } }
  | { kind: 'payment'; invoiceId: string }
  | { kind: 'request' }
  | { kind: 'claim'; liftId?: string; jobId?: string }
  | { kind: 'dealer'; dealerId?: string }
  | { kind: 'dealer-order'; orderId?: string; dealerId?: string; preset?: Partial<Pick<DealerOrder, 'ship' | 'notes'>> }
  | { kind: 'adjust'; itemId: string }
  | { kind: 'po'; poId?: string; preset?: { vendorId?: string; itemIds?: string[] } };

export const activeDialog = signal<DialogRequest | null>(null);
export const openDialog = (d: DialogRequest) => {
  activeDialog.value = d;
};
export const closeDialog = () => {
  activeDialog.value = null;
};
