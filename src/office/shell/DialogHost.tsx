/** Renders whichever app-wide dialog is open (see dialogs.ts). */
import { closeDialog, type DialogRequest } from '../dialogs';
import { InvoiceDialog, PaymentDialog } from '../pages/accounting/dialogs';
import { CustomerDialog } from '../pages/customers/CustomerDialog';
import { LiftDialog } from '../pages/customers/LiftDialog';
import { DealerDialog, DealerOrderDialog } from '../pages/dealers/dialogs';
import { RequestDialog } from '../pages/inbox/RequestDialog';
import { AdjustDialog, PODialog } from '../pages/inventory/dialogs';
import { JobDialog } from '../pages/jobs/JobDialog';
import { ClaimDialog } from '../pages/warranty/ClaimDialog';

export function DialogHost({ request }: { request: DialogRequest }) {
  const onClose = closeDialog;
  switch (request.kind) {
    case 'job':
      return <JobDialog jobId={request.jobId} preset={request.preset} onClose={onClose} />;
    case 'customer':
      return <CustomerDialog customerId={request.customerId} preset={request.preset} onCreated={request.onCreated} onClose={onClose} />;
    case 'lift':
      return <LiftDialog liftId={request.liftId} customerId={request.customerId} onClose={onClose} />;
    case 'invoice':
      return <InvoiceDialog invoiceId={request.invoiceId} preset={request.preset} onClose={onClose} />;
    case 'payment':
      return <PaymentDialog invoiceId={request.invoiceId} onClose={onClose} />;
    case 'request':
      return <RequestDialog onClose={onClose} />;
    case 'claim':
      return <ClaimDialog liftId={request.liftId} jobId={request.jobId} onClose={onClose} />;
    case 'dealer':
      return <DealerDialog dealerId={request.dealerId} onClose={onClose} />;
    case 'dealer-order':
      return <DealerOrderDialog orderId={request.orderId} dealerId={request.dealerId} preset={request.preset} onClose={onClose} />;
    case 'adjust':
      return <AdjustDialog itemId={request.itemId} onClose={onClose} />;
    case 'po':
      return <PODialog poId={request.poId} preset={request.preset} onClose={onClose} />;
  }
}
