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
          style: 'mapbox://styles/mapbox/light-v11', // Changed to light style for better 3D visualization
          center: [coords.longitude, coords.latitude],
          zoom: 15, // Increased zoom level to better see buildings
          pitch: 15,  //Added pitch to see buildings from an angle
          bearing: -17.6, // Optional: slight rotation
          antialias: true // For smoother edges on 3D objects
        });

        //navigation module 
        map.current.addControl(new mapboxgl.NavigationControl());

        setTimeout(() => {
          map.current.resize();
        }, 100)

        // Add 3D buildings when map loads
        map.current.on('load', () => {

          //create light
          map.current.setLight({
            'anchor': 'viewport',    // Light follows the viewport
            'color': '#ffffff',      // White light
            'intensity': 0.5,        // Moderate intensity
            'position': [1.5, 180, 50], // [radial, azimuthal in degrees, polar in degrees]
            // This position places the sun to the south (180°) at a 45° elevation
          });
          // add 3D building layer
          map.current.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 13, // Only show 3D buildings when zoomed in
            'paint': {
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['get', 'height'],
                0, '#DCE2E9',
                50, '#CBD2DB',
                100, '#B9C3CC',
                200, '#A7B3BE'
              ],
              'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15, 0,
                16, ['get', 'height']
              ],
              'fill-extrusion-base': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15, 0,
                16, ['get', 'min_height']
              ],
              'fill-extrusion-opacity': 0.7
            }
          });

          //create shadows
          map.current.addLayer({
            'id': 'building-shadows',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill',
            'minzoom': 13,
            'layout': {
              'visibility': 'visible'
            },
            paint: {
              'fill-color': '#000000',
              'fill-opacity': 0.2,
              'fill-translate': [10, -10], // offset to simulate shadow direction
              'fill-translate-anchor': 'viewport'
            }
          });
        });

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
          style: 'mapbox://styles/mapbox/light-v11', // Changed to light style
          center: [lng, lat],
          zoom: 13,
          pitch: 45, // Added pitch
          antialias: true // Better rendering
        });

        map.current.addControl(new mapboxgl.NavigationControl());

        // Add 3D buildings when map loads (also in the fallback case)


        map.current.on('move', () => {
          setLng(map.current.getCenter().lng.toFixed(4));
          setLat(map.current.getCenter().lat.toFixed(4));
          setZoom(map.current.getZoom().toFixed(2)); // Fixed to 2 decimal places
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