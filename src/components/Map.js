'use client';

import SunCalc from 'suncalc';
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Function to get current longitude and latitude
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

// Get sunrise and sunset times
function getSunTimes(latitude, longitude) {
  const date = new Date();
  // Gets times
  const times = SunCalc.getTimes(date, latitude, longitude);
  return times;
}

// Function to get position of sun
function getCurrentSunAngle(latitude, longitude) {
  // Current date and time
  const date = new Date();

  // Current position of sun
  const sunPosition = SunCalc.getPosition(date, latitude, longitude);

  // Extract altitude (elevation above horizon in radians) and azimuth (direction in radians)
  const altitude = sunPosition.altitude;
  const azimuth = sunPosition.azimuth;
  const polarAngle = Math.PI / 2 - altitude;
  let azimuthalAngle = azimuth + Math.PI; // Add 180° to shift from south to north as 0°

  // Normalize to [0, 2π)
  azimuthalAngle = azimuthalAngle % (2 * Math.PI);
  if (azimuthalAngle < 0) {
    azimuthalAngle += 2 * Math.PI;
  }

  // Using 1 as default for a directional light at unit distance
  const radialCoordinate = 1.5;

  // Return the array in the specified format: [r, a, p]
  return [
    radialCoordinate,  // r: radial coordinate (distance)
    azimuthalAngle,    // a: azimuthal angle (position around the object, clockwise from north/top)
    polarAngle         // p: polar angle (height of the light, 0° is directly above)
  ];
}

// Calculate shadow direction based on sun position and zoom level
function calculateShadowOffset(sunPosition, zoomLevel) {
  // Extract azimuthal angle and polar angle
  const azimuthalAngle = sunPosition[1];
  const polarAngle = sunPosition[2];

  // This helps maintain proportional shadows across zoom levels
  const baseLength = Math.tan(polarAngle) * 5;
  const zoomFactor = Math.pow(0.85, zoomLevel - 15); // Normalize around zoom level 15
  const shadowLength = baseLength * zoomFactor;
  
  // Calculate x and y offsets
  const shadowX = Math.sin(azimuthalAngle) * shadowLength;
  const shadowY = Math.cos(azimuthalAngle) * shadowLength;
  
  return [shadowX, shadowY];
}

export default function Map() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(0);
  const [lat, setLat] = useState(0);
  const [zoom, setZoom] = useState(13);

  useEffect(() => {
    // Initialize map only once and get current location
    if (!mapContainer.current || map.current) return;

    // Get location first, then initialize map
    getCurrentLocation()
      .then(coords => {
        // Set state with current location
        setLng(coords.longitude);
        setLat(coords.latitude);

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/light-v11', // Light style for better 3D visualization
          center: [coords.longitude, coords.latitude],
          zoom: 15, // Increased zoom level to better see buildings
          pitc: 30,  // camera angle
          
        });

        // Navigation module 
        map.current.addControl(new mapboxgl.NavigationControl());

        setTimeout(() => {
          map.current.resize();
        }, 100);

        // Add 3D buildings when map loads
        map.current.on('load', () => {
          // Get the sun position based on current coordinates
          const sunPosition = getCurrentSunAngle(coords.latitude, coords.longitude);
          const sunTimes = getSunTimes(coords.latitude, coords.longitude);
          console.log("Sunrise:", sunTimes.sunrise.toLocaleTimeString());
          console.log("Sunset:", sunTimes.sunset.toLocaleTimeString());
          
          // Calculate shadow offset based on sun position and current zoom level
          const shadowOffset = calculateShadowOffset(sunPosition, map.current.getZoom());
          
          // Set the light source for 3D buildings
          map.current.setLight({
            'anchor': 'map',
            'color': '#ffffff',
            'intensity': 0.5,
            'position': sunPosition, // Dynamic sun position
          });

          // Add the base ground layer
          map.current.addLayer({
            'id': 'ground',
            'source': 'composite',
            'source-layer': 'landuse',
            'type': 'fill',
            'paint': {
              'fill-color': '#F7F9FA',
              'fill-opacity': 1
            }
          });

          // Step 1: Add building shadows FIRST (underneath the buildings)
          map.current.addLayer({
            'id': 'building-shadows',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill',
            'minzoom': 13,
            'paint': {
              'fill-color': '#000000',
              'fill-opacity': 0.3,
              'fill-translate': shadowOffset, // Dynamic shadow direction based on sun position and zoom
              'fill-translate-anchor': 'map' // Use map-anchored translation for smoother zooming
            }
          });

          // Step 2: Add the actual 3D buildings OVER the shadows
          map.current.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 13,
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
              'fill-extrusion-opacity': 0.9 // Slightly increased opacity
            }
          });

          // Step 3: Add building footprints at ground level to "erase" shadows under buildings
          map.current.addLayer({
            'id': 'building-footprints',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill',
            'minzoom': 13,
            'paint': {
              'fill-color': '#F7F9FA', // Same as background or ground color
              'fill-opacity': 1
            }
          }, 'building-shadows'); // Insert this layer beneath building shadows
        });

        // Update position info and shadows on map movement/zoom
        map.current.on('move', () => {
          setLng(map.current.getCenter().lng.toFixed(4));
          setLat(map.current.getCenter().lat.toFixed(4));
          setZoom(map.current.getZoom().toFixed(2));
          
          // Update shadows based on new zoom level if the sun position layer exists
          if (map.current.getLayer('building-shadows')) {
            const currentZoom = map.current.getZoom();
            const sunPos = getCurrentSunAngle(map.current.getCenter().lat, map.current.getCenter().lng);
            const newShadowOffset = calculateShadowOffset(sunPos, currentZoom);
            
            // Update the shadow offset during zoom
            map.current.setPaintProperty('building-shadows', 'fill-translate', newShadowOffset);
          }
        });
      })
      .catch(error => {
        console.error("Error getting location:", error);
        // Fall back to default coordinates if location access fails
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [lng, lat],
          zoom: 13,
          pitch: 45,
          antialias: true
        });

        map.current.addControl(new mapboxgl.NavigationControl());

        // Add 3D buildings when map loads (also in the fallback case)
        map.current.on('load', () => {
          // Use a default position if location access fails
          const defaultSunPosition = [1, Math.PI * 1.5, Math.PI * 0.3]; // Adjusted for better default shadows
          const shadowOffset = calculateShadowOffset(defaultSunPosition, map.current.getZoom());

          map.current.setLight({
            'anchor': 'map',
            'color': '#ffffff',
            'intensity': 0.5,
            'position': defaultSunPosition,
          });

          // Similar layers as in the success case
          map.current.addLayer({
            'id': 'ground',
            'source': 'composite',
            'source-layer': 'landuse',
            'type': 'fill',
            'paint': {
              'fill-color': '#F7F9FA',
              'fill-opacity': 1
            }
          });

          map.current.addLayer({
            'id': 'building-shadows',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill',
            'minzoom': 13,
            'paint': {
              'fill-color': '#000000',
              'fill-opacity': 0.3,
              'fill-translate': shadowOffset,
              'fill-translate-anchor': 'map' // Using map anchored translation for smoother zooming
            }
          });

          map.current.addLayer({
            'id': 'building-footprints',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill',
            'minzoom': 13,
            'paint': {
              'fill-color': '#F7F9FA',
              'fill-opacity': 1
            }
          }, 'building-shadows');

          map.current.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 13,
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
              'fill-extrusion-opacity': 0.9
            }
          });
        });

        map.current.on('move', () => {
          setLng(map.current.getCenter().lng.toFixed(4));
          setLat(map.current.getCenter().lat.toFixed(4));
          setZoom(map.current.getZoom().toFixed(2));
        });
      });
  }, []);

  return (
    <div className="w-full h-full relative">
      <div
        ref={mapContainer}
        className="w-full h-96 md:h-[600px] md:w-screen"
      />

      <div className="bg-opacity-80 z-10 rounded m-2 flex justify-center w-screen absolute bottom-0 left-0">
        Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
      </div>
    </div>
  );
}