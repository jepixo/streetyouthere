import React, { useEffect, useRef } from 'react';

interface BackgroundMapProps {
    coords: { lat: number; lng: number } | null;
}

const famousPlaces = [
  { lat: 48.8584, lng: 2.2945, zoom: 16 },   // Eiffel Tower, Paris
  { lat: 40.7128, lng: -74.0060, zoom: 14 }, // New York City
  { lat: 35.6895, lng: 139.6917, zoom: 14 }, // Tokyo
  { lat: -33.8688, lng: 151.2093, zoom: 15 },// Sydney
  { lat: -22.9519, lng: -43.2105, zoom: 16 },// Christ the Redeemer, Rio
  { lat: 34.0522, lng: -118.2437, zoom: 14},// Los Angeles
  { lat: 51.5074, lng: -0.1278, zoom: 15 }  // London
];

export const BackgroundMap: React.FC<BackgroundMapProps> = ({ coords }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const tourIntervalRef = useRef<number | null>(null);

    // Initialize map
    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            const map = L.map(mapContainerRef.current, {
                center: [20, 0], // Default center
                zoom: 2,
                zoomControl: false,
                attributionControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
            });

            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri'
            }).addTo(map);

            mapRef.current = map;
        }
    }, []);

    // Handle tour mode vs. specific location
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        
        // If specific coords are provided, stop tour and fly to location
        if (coords) {
            if (tourIntervalRef.current) {
                clearInterval(tourIntervalRef.current);
                tourIntervalRef.current = null;
            }
            map.flyTo([coords.lat, coords.lng], 15, {
                animate: true,
                duration: 2.5
            });
        } 
        // Otherwise, if no coords and tour isn't running, start it
        else if (!tourIntervalRef.current) {
            const flyToRandomPlace = () => {
                const randomIndex = Math.floor(Math.random() * famousPlaces.length);
                const place = famousPlaces[randomIndex];
                 map.flyTo([place.lat, place.lng], place.zoom, {
                    animate: true,
                    duration: 2.5,
                    easeLinearity: 0.25
                });
            }
            
            flyToRandomPlace(); // Fly immediately
            tourIntervalRef.current = window.setInterval(flyToRandomPlace, 5000);
        }

        // Cleanup on component unmount
        return () => {
            if (tourIntervalRef.current) {
                clearInterval(tourIntervalRef.current);
            }
        }

    }, [coords]);


    return <div ref={mapContainerRef} className="background-map" />;
};
