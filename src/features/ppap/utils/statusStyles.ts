export function getStatusColor(status: string): string {
  switch (status) {
    case 'NEW':
      return 'bg-gray-200 text-gray-800';
    case 'PRE_ACK_IN_PROGRESS':
      return 'bg-blue-200 text-blue-800';
    case 'SUBMITTED':
      return 'bg-yellow-200 text-yellow-800';
    case 'APPROVED':
      return 'bg-green-200 text-green-800';
    case 'REJECTED':
      return 'bg-red-200 text-red-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}
