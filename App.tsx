import React, { useState, useCallback, useEffect, useRef } from 'react';
import { URLInput } from './components/URLInput';
import { ImageDisplay } from './components/ImageDisplay';
import { BackgroundMap } from './components/BackgroundMap';
import { getAvailableResolutions, stitchStreetViewImage, extractUrlData } from './services/streetView';
import type { Progress, Resolution } from './types';

const App: React.FC = () => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [panoId, setPanoId] = useState<string | null>(null);
    const [availableResolutions, setAvailableResolutions] = useState<Resolution[]>([]);
    const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
    const [viewerProgress, setViewerProgress] = useState<Progress | null>(null);
    const [mapCoords, setMapCoords] = useState<{ lat: number, lng: number } | null>(null);
    const appShellRef = useRef<HTMLDivElement>(null);

    // Cache the initial viewport height so mobile address bar hiding doesn't jitter the scroll math
    const baseHeightRef = useRef<number>(window.innerHeight);

    useEffect(() => {
        const handleScroll = () => {
            const ANIMATION_SCROLL_RANGE = baseHeightRef.current * 0.6; // Animate over 60% of viewport height
            const scrollY = window.scrollY;
            const progress = Math.min(1, scrollY / ANIMATION_SCROLL_RANGE);

            if (appShellRef.current) {
                appShellRef.current.style.setProperty('--scroll-progress', progress.toString());
            }
        };

        const onScroll = () => {
            window.requestAnimationFrame(handleScroll);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        handleScroll(); // Set initial state

        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const handleViewerProgress = useCallback((p: Progress) => {
        setViewerProgress(p);
    }, []);

    const resetState = () => {
        setIsLoading(false);
        setError(null);
        setPanoId(null);
        setAvailableResolutions([]);
        setViewerImageUrl(null);
        setViewerProgress(null);
    };

    const handleSubmit = async (submittedUrl: string) => {
        const ANIMATION_SCROLL_RANGE = baseHeightRef.current * 0.6;
        if (window.scrollY < ANIMATION_SCROLL_RANGE) {
            window.scrollTo({ top: ANIMATION_SCROLL_RANGE + 50, behavior: 'smooth' });
        }

        resetState();
        setIsLoading(true);

        try {
            const { panoId: extractedPanoId, coords } = extractUrlData(submittedUrl);
            if (!extractedPanoId) {
                throw new Error("Could not find a valid Street View Panorama ID in the URL.");
            }
            setPanoId(extractedPanoId);
            setMapCoords(coords);

            const resolutions = getAvailableResolutions();
            setAvailableResolutions(resolutions);

            if (resolutions.length > 0) {
                const defaultRes = resolutions.find(r => r.zoom === 3) || resolutions[0];
                const imageUrl = await stitchStreetViewImage(extractedPanoId, defaultRes.zoom, handleViewerProgress);
                setViewerImageUrl(imageUrl);
            } else {
                throw new Error("No valid resolutions could be determined.");
            }
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("An unknown error occurred during image processing.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleStitchRequest = async (zoom: number, onProgress: (p: Progress) => void): Promise<string> => {
        if (!panoId) {
            throw new Error("Panorama ID is not available.");
        }
        return await stitchStreetViewImage(panoId, zoom, onProgress);
    };

    return (
        <>
            <BackgroundMap coords={mapCoords} />
            <div className="app-shell" ref={appShellRef}>
                <div className="app-header">
                    <div className="hero-content-wrapper">
                        <h1 className="hero-title">Street You There</h1>
                        <p className="hero-description">A Street View Image Downloader</p>
                    </div>

                    <div className="url-input-container">
                        <URLInput onSubmit={handleSubmit} isLoading={isLoading} />
                    </div>
                </div>

                <div className="image-display-wrapper">
                    <ImageDisplay
                        isLoading={isLoading}
                        progress={viewerProgress}
                        error={error}
                        viewerImageUrl={viewerImageUrl}
                        panoId={panoId}
                        resolutions={availableResolutions}
                        onStitchRequest={handleStitchRequest}
                    />
                </div>

                <div className="app-footer">
                    Built by <a href="https://github.com/jepixo" target="_blank" rel="noopener noreferrer">@jepixo</a> • <a href="https://www.linkedin.com/in/jepixo" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                </div>
            </div>
        </>
    );
};

export default App;