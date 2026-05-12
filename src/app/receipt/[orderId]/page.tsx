import ReceiptClient from "./receipt-client";

export default function ReceiptPage({
  params,
  searchParams
}: {
  params: { orderId: string };
  searchParams: { tx?: string };
}) {
  return (
    <ReceiptClient orderId={params.orderId} initialTx={searchParams.tx} />
  );
}
