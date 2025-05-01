'use client'
import dynamic from 'next/dynamic';

// Import the Map component with no SSR
// This is necessary because Mapbox GL JS requires browser APIs
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <p>Loading Map...</p>
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <h2 className="text-2xl font-bold mb-4">My Mapbox Map</h2>
      <div className="w-full max-w-4xl">
        <Map />
      </div>
    </main>
  );
}