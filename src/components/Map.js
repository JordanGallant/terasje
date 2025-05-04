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
  const radialCoordinate = 1;

  // Return the array in the specified format: [r, a, p]
  return [
    radialCoordinate,  // r: radial coordinate (distance)
    azimuthalAngle,    // a: azimuthal angle (position around the object, clockwise from north/top)
    polarAngle         // p: polar angle (height of the light, 0° is directly above)
  ];
}

/**
 * Calculate shadow direction and length based on sun position, zoom level, and building height
 * @param {Array} sunPosition - [r, a, p] sun position array
 * @param {number} zoomLevel - Current map zoom level
 * @param {number} buildingHeight - Height of the building in meters
 * @return {Array} - [x, y] shadow offset
 */
function calculateShadowOffset(sunPosition, zoomLevel, buildingHeight = 20) {
  // Extract azimuthal angle and polar angle
  const azimuthalAngle = sunPosition[1];
  const polarAngle = sunPosition[2];
  
  // If sun is below horizon or very close to horizon, limit shadow length
  if (polarAngle >= Math.PI * 0.49) {
    return [0, 0]; // No shadows when sun is below horizon
  }

  // Calculate shadow length based on sun angle and building height
  // tan(polarAngle) gives the ratio of shadow length to building height
  const shadowLength = Math.tan(polarAngle) * buildingHeight;
  
  // Apply a non-linear scaling factor based on zoom level
  // This creates more realistic shadows at different zoom levels
  const zoomScaleFactor = Math.pow(0.8, zoomLevel - 10);
  
  // Limit maximum shadow length for visual aesthetics
  const maxShadowLength = 300; // Maximum shadow length in pixels
  const adjustedShadowLength = Math.min(shadowLength * zoomScaleFactor, maxShadowLength);
  
  // Calculate x and y offsets - negate to correct shadow direction
  const shadowX = Math.sin(azimuthalAngle) * adjustedShadowLength;
  const shadowY = Math.cos(azimuthalAngle) * adjustedShadowLength;
  
  return [shadowX, shadowY];
}

// Calculate shadow opacity based on sun altitude
function calculateShadowOpacity(sunPosition) {
  // Get polar angle (altitude from zenith)
  const polarAngle = sunPosition[2];
  
  // Calculate relative sun height (0 = horizon, 1 = directly overhead)
  const sunHeight = 1 - (polarAngle / (Math.PI / 2));
  
  // Scale opacity: stronger shadows when sun is higher, fading as sun approaches horizon
  // Base opacity between 0.1 and 0.4
  const baseOpacity = 0.1 + (sunHeight * 0.3);
  
  return baseOpacity;
}

// Calculate shadow blur based on sun altitude and zoom level
function calculateShadowBlur(sunPosition, zoomLevel) {
  // Get polar angle (altitude from zenith)
  const polarAngle = sunPosition[2];
  
  // Calculate relative sun height (0 = horizon, 1 = directly overhead)
  const sunHeight = 1 - (polarAngle / (Math.PI / 2));
  
  // More blur when sun is near horizon, less when overhead
  // Adjust for zoom level - sharper shadows at higher zoom
  const baseBlur = 6 - (sunHeight * 4);
  const zoomAdjustment = Math.max(0, 18 - zoomLevel) / 2;
  
  return baseBlur + zoomAdjustment;
}

export default function Map() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(0);
  const [lat, setLat] = useState(0);
  const [zoom, setZoom] = useState(13);
  const [sunPosition, setSunPosition] = useState(null);
  const [isNight, setIsNight] = useState(false);
  const [buildingHeights, setBuildingHeights] = useState({}); // Store building heights

  // Function to update shadows based on current view
  const updateShadows = () => {
    if (!map.current || !map.current.loaded() || !sunPosition) return;

    const currentZoom = map.current.getZoom();
    const shadowOpacity = calculateShadowOpacity(sunPosition);
    const shadowBlur = calculateShadowBlur(sunPosition, currentZoom);
    
    // Default shadow if no specific building height
    const defaultShadowOffset = calculateShadowOffset(sunPosition, currentZoom);
    
    // Update the main shadow layer
    if (map.current.getLayer('building-shadows')) {
      map.current.setPaintProperty('building-shadows', 'fill-translate', defaultShadowOffset);
      map.current.setPaintProperty('building-shadows', 'fill-opacity', shadowOpacity);
      map.current.setPaintProperty('building-shadows', 'fill-blur', shadowBlur);
    }
    
    // Update the outer shadow layer with slightly larger offset and lower opacity
    if (map.current.getLayer('building-shadows-outer')) {
      map.current.setPaintProperty('building-shadows-outer', 'fill-translate', [
        defaultShadowOffset[0] * 1.25,
        defaultShadowOffset[1] * 1.25
      ]);
      map.current.setPaintProperty('building-shadows-outer', 'fill-opacity', shadowOpacity * 0.6);
      map.current.setPaintProperty('building-shadows-outer', 'fill-blur', shadowBlur * 1.5);
    }
  };

  // Timer to update sun position regularly
  useEffect(() => {
    if (!lat || !lng) return;
    
    // Update sun position every minute
    const intervalId = setInterval(() => {
      const newSunPosition = getCurrentSunAngle(lat, lng);
      setSunPosition(newSunPosition);
      
      // Check if it's night time
      const times = getSunTimes(lat, lng);
      const now = new Date();
      setIsNight(now < times.sunrise || now > times.sunset);
      
      updateShadows();
    }, 60000); // Every minute
    
    return () => clearInterval(intervalId);
  }, [lat, lng]);

  useEffect(() => {
    // Initialize map only once and get current location
    if (!mapContainer.current || map.current) return;

    // Get location first, then initialize map
    getCurrentLocation()
      .then(coords => {
        // Set state with current location
        setLng(coords.longitude);
        setLat(coords.latitude);

        // Get the sun position based on current coordinates
        const currentSunPosition = getCurrentSunAngle(coords.latitude, coords.longitude);
        setSunPosition(currentSunPosition);

        // Check if it's night time
        const times = getSunTimes(coords.latitude, coords.longitude);
        const now = new Date();
        setIsNight(now < times.sunrise || now > times.sunset);

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/light-v11', // Light style for better 3D visualization
          center: [coords.longitude, coords.latitude],
          zoom: 15, // Increased zoom level to better see buildings
          bearing: 0, // North-facing orientation
          
          antialias: true
        });

        // Navigation module 
        map.current.addControl(new mapboxgl.NavigationControl());

        setTimeout(() => {
          map.current.resize();
        }, 100);

        // Add 3D buildings when map loads
        map.current.on('load', () => {
          const sunTimes = getSunTimes(coords.latitude, coords.longitude);
          console.log("Sunrise:", sunTimes.sunrise.toLocaleTimeString());
          console.log("Sunset:", sunTimes.sunset.toLocaleTimeString());
          
          // Log building heights when clicking on buildings
          map.current.on('click', '3d-buildings', (e) => {
            if (e.features && e.features[0]) {
              const feature = e.features[0];
              const height = feature.properties.height || 20;
              const buildingId = feature.id || 'unknown';
              
              console.log("Building height:", height, "meters");
              
              // Store this building height
              setBuildingHeights(prev => ({
                ...prev,
                [buildingId]: height
              }));
              

            }
          });
          
          // Calculate shadow properties based on sun position
          const shadowOffset = calculateShadowOffset(currentSunPosition, map.current.getZoom());
          const shadowOpacity = calculateShadowOpacity(currentSunPosition);
          const shadowBlur = calculateShadowBlur(currentSunPosition, map.current.getZoom());
          
          // Set the light source for 3D buildings
          map.current.setLight({
            'anchor': 'map',
            'color': isNight ? '#0a1f44' : '#ffffff',
            'intensity': isNight ? 0.3 : 0.5,
            'position': currentSunPosition, // Dynamic sun position
          });
        
          // Add building footprints at ground level FIRST
          map.current.addLayer({
            'id': 'building-footprints',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill',
            'minzoom': 13,
            'paint': {
              'fill-color': '#F7F9FA', // Same as background or ground color
              'fill-opacity': 1,
            }
          });
          
          // Add building shadows SECOND
          map.current.addLayer({
            'id': 'building-shadows',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill',
            'minzoom': 13,
            'paint': {
              'fill-color': '#000000',
              'fill-opacity': shadowOpacity,
              'fill-translate': shadowOffset,
              'fill-translate-anchor': 'map',
              'fill-antialias': true,
              'fill-blur': shadowBlur,
            }
          }, 'building-footprints'); // Place shadows ABOVE footprints
        
          // Add a secondary shadow layer for gradient effect
          map.current.addLayer({
            'id': 'building-shadows-outer',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill',
            'minzoom': 13,
            'paint': {
              'fill-color': '#000000',
              'fill-opacity': shadowOpacity * 0.6,
              'fill-translate': [
                shadowOffset[0] * 1.25,
                shadowOffset[1] * 1.25
              ],
              'fill-translate-anchor': 'map',
              'fill-antialias': true,
              'fill-blur': shadowBlur * 1.5,
            }
          }, 'building-shadows'); // Place outer shadows ABOVE main shadows
        
          // Add the actual 3D buildings LAST (on top of everything)
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
                15, ['*', ['get', 'height'], 0.5], // Start showing half-height buildings at zoom 15
                16, ['get', 'height']               // Full height at zoom 16
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
          
          // Initial shadow update
          updateShadows();
        });

        // Update shadows when map moves or zooms
        map.current.on('moveend', updateShadows);

        // Update position info on map movement
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
          style: 'mapbox://styles/mapbox/light-v11',
          center: [lng, lat],
          zoom: 13,
          pitch: 45,
          antialias: true
        });

        map.current.addControl(new mapboxgl.NavigationControl());
        map.current.on('move', () => {
          setLng(map.current.getCenter().lng.toFixed(4));
          setLat(map.current.getCenter().lat.toFixed(4));
          setZoom(map.current.getZoom().toFixed(2));
        });
      });
  }, []);

  // Effect to update shadows when sun position changes
  useEffect(() => {
    if (sunPosition) {
      updateShadows();
    }
  }, [sunPosition]);

  return (
    <div className="w-full h-full relative">
      <div
        ref={mapContainer}
        className="w-full h-96 md:h-[600px] md:w-screen"
      />

      <div className="bg-white bg-opacity-80 z-10 rounded p-2 m-2 flex flex-col absolute bottom-0 left-0">
        <div>Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}</div>
        {sunPosition && (
          <div className="text-sm">
            Sun Altitude: {((Math.PI/2 - sunPosition[2]) * 180/Math.PI).toFixed(1)}° | 
            Azimuth: {(sunPosition[1] * 180/Math.PI).toFixed(1)}° | 
            {isNight ? ' Night time' : ' Day time'}
          </div>
        )}
      </div>
    </div>
  );
}