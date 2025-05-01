'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function Map() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-70.9);
  const [lat, setLat] = useState(42.35);
  const [zoom, setZoom] = useState(3);

  useEffect(() => {
    // Initialize map only once
    if (map.current) return;
    
    // Replace with your Mapbox access token
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: zoom
    });

    // Add navigation controls (optional)
    map.current.addControl(new mapboxgl.NavigationControl());

    // Update state when map moves
    map.current.on('move', () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(2));
    });
  }, [lng, lat, zoom]);

  return (
    <div className="w-full h-full">
  <div
    ref={mapContainer}
    className="w-full h-96 md:h-[600px] md:w-screen"
  />
  <div className="bg-opacity-80 z-10 rounded m-2 flex justify-center">
    Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
  </div>
</div>
  );
}