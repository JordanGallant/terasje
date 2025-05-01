'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

//function to get current longitude and lattitude

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    // Check if geolocation is supported by the browser
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    // Get the current position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: true }
    );
  });
}



export default function Map() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(0);
  const [lat, setLat] = useState(0);
  const [zoom, setZoom] = useState(13);

  useEffect(() => {
    // initialize map only once and get current location
    if (!mapContainer.current || map.current) return;


    // get location first, then initialize map
    getCurrentLocation()
      .then(coords => {
        // Set state with current location
        setLng(coords.longitude);
        setLat(coords.latitude);

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [coords.longitude, coords.latitude],
          zoom: 13
        });
        //navigation module 
        map.current.addControl(new mapboxgl.NavigationControl());

        setTimeout(() => {
          map.current.resize();
        }, 100)

        // update movement on map
        map.current.on('move', () => {
          setLng(map.current.getCenter().lng.toFixed(4));
          setLat(map.current.getCenter().lat.toFixed(4));
          setZoom(map.current.getZoom().toFixed(2));
        });
      })
      .catch(error => {
        console.error("Error getting location:", error);
        // Fall back to default coordinates if location access fails
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [lng, lat],
          zoom: 9
        });

        map.current.addControl(new mapboxgl.NavigationControl());

        map.current.on('move', () => {
          setLng(map.current.getCenter().lng.toFixed(4));
          setLat(map.current.getCenter().lat.toFixed(4));
          setZoom(map.current.getZoom().toFixed(9));
        });
      });
  }, []); //empty array so it executes on mount 

  return (
    <div className="w-full h-full">
      <div
        ref={mapContainer}
        className="w-full h-96 md:h-[600px] md:w-screen"
      />
      <div className="bg-opacity-80 z-10 rounded m-2 flex justify-center w-screen">
        Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
      </div>
    </div>
  );
}