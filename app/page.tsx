import { redirect } from 'next/navigation';

export default function Home() {
  console.log('🧭 V6.1 ROOT ROUTE CHECK', {
    redirectedTo: '/emip-dashboard',
    timestamp: new Date().toISOString(),
  });
  
  redirect('/emip-dashboard');
}
