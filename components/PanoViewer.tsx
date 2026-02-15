import React, { useEffect, useRef, useState, useCallback } from 'react';

interface PanoViewerProps {
    imageUrl: string;
}

export const PanoViewer: React.FC<PanoViewerProps> = ({ imageUrl }) => {
    const panoRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<any>(null);

    const [hfov, setHfov] = useState(100);
    const [pitch, setPitch] = useState(0);
    const [yaw, setYaw] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);

    const syncControls = useCallback(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        setYaw(Number(viewer.getYaw().toFixed(1)));
        setPitch(Number(viewer.getPitch().toFixed(1)));
        setHfov(Number(viewer.getHfov().toFixed(1)));
    }, []);

    useEffect(() => {
        if (!imageUrl || !panoRef.current || !window.pannellum) {
            return;
        }

        setIsLoaded(false);

        const viewer = window.pannellum.viewer(panoRef.current, {
            type: 'equirectangular',
            panorama: imageUrl,
            autoLoad: true,
            autoRotate: -2,
            compass: false,
            showControls: true,
            hfov: 100,
            pitch: 0,
            yaw: 0,
        });
        viewerRef.current = viewer;

        viewer.on('load', () => {
            setIsLoaded(true);
            syncControls();
        });

        viewer.on('mouseup', syncControls);
        viewer.on('touchend', syncControls);
        viewer.on('animatefinished', syncControls);

        return () => {
            if (viewerRef.current) {
                viewer.destroy();
                viewerRef.current = null;
            }
        };
    }, [imageUrl, syncControls]);

    useEffect(() => {
        if (isLoaded && viewerRef.current) viewerRef.current.setHfov(hfov, false);
    }, [hfov, isLoaded]);

    useEffect(() => {
        if (isLoaded && viewerRef.current) viewerRef.current.setPitch(pitch, false);
    }, [pitch, isLoaded]);

    useEffect(() => {
        if (isLoaded && viewerRef.current) viewerRef.current.setYaw(yaw, false);
    }, [yaw, isLoaded]);

    return (
        // The parent .viewer-inner is now a flex container, so this div will grow
        <>
            <div className="pano-viewer-container">
                <div ref={panoRef} className="pano-viewer" />
                {!isLoaded && imageUrl && (
                    <div className="pano-viewer-loader">
                        <p>Loading panorama...</p>
                    </div>
                )}
            </div>
            <div className={`pano-controls ${!isLoaded ? 'disabled' : ''}`}>
                <div className="control-slider">
                    <label htmlFor="hfov">Zoom (HFOV)</label>
                    <input
                        id="hfov"
                        type="range" min="10" max="170" step="1"
                        value={hfov} onChange={(e) => setHfov(Number(e.target.value))}
                        aria-label="Zoom control" disabled={!isLoaded}
                    />
                    <span>{hfov}°</span>
                </div>
            </div>
        </>
    );
};
