'use client';

import SunCalc from 'suncalc';
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
// import TimeSelector from './TimeSelector';

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

//get sunrise and sunset times

function getSunTimes(latitude, longitude) {
  const date = new Date();
  //gets times
  const times = SunCalc.getTimes(date, latitude, longitude);

  console.log("Sunrise:", times.sunrise.toLocaleTimeString());
  console.log("Sunset:", times.sunset.toLocaleTimeString());
}

// function to get position of sun
function getCurrentSunAngle(latitude, longitude) {
  // current date and time
  const date = new Date();

  // current position of sun
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
          // Get the sun position based on current coordinates
          const sunPosition = getCurrentSunAngle(coords.latitude, coords.longitude);
          const times = getSunTimes(coords.latitude, coords.longitude)
          console.log(times)

          // Avoid adding the same layer twice
          if (!map.current.getLayer('3d-buildings')) {
            map.current.setLight({
              'anchor': 'map',
              'color': '#ffffff',
              'intensity': 0.5,
              'position': sunPosition, // Dynamic sun position
            });

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
                'fill-extrusion-opacity': 0.7
              }
            });
          }

          // Add building shadows only if not already added
          if (!map.current.getLayer('building-shadows')) {
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
                'fill-translate': [10, -10],
                'fill-translate-anchor': 'viewport'
              }
            });
          }
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
        map.current.on('load', () => {
          // Use a default position if location access fails
          const defaultSunPosition = [1, 180, 50];

          map.current.setLight({
            'anchor': 'map',
            'color': '#ffffff',
            'intensity': 0.5,
            'position': defaultSunPosition,
          });

          // Add the same building layers as in the success case
          if (!map.current.getLayer('3d-buildings')) {
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
                'fill-extrusion-opacity': 0.7
              }
            });
          }
        });

        map.current.on('move', () => {
          setLng(map.current.getCenter().lng.toFixed(4));
          setLat(map.current.getCenter().lat.toFixed(4));
          setZoom(map.current.getZoom().toFixed(2)); // Fixed to 2 decimal places
        });
      });
  }, []); //empty array so it executes on mount 

  return (
    <div className="w-full h-full relative">
      <div
        ref={mapContainer}
        className="w-full h-96 md:h-[600px] md:w-screen"
      />

      {/* <div className="absolute top-4 left-4 z-20">
        <TimeSelector />
      </div> */}

      <div className="bg-opacity-80 z-10 rounded m-2 flex justify-center w-screen absolute bottom-0 left-0">
        Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
      </div>
    </div>
  );
}