import { redirect } from 'next/navigation';

interface BOMDetailRouteProps {
  params: {
    partNumber: string;
  };
}

export default function BOMDetailRoute({ params }: BOMDetailRouteProps) {
  redirect(`/sku/${encodeURIComponent(params.partNumber)}`);
}