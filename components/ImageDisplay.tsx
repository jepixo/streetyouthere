import React, { useState, useCallback, useEffect } from 'react';
import type { Progress, Resolution } from '../types';
import { DownloadIcon, CheckCircleIcon } from './icons';
import { PanoViewer } from './PanoViewer';

interface ImageDisplayProps {
    isLoading: boolean;
    progress: Progress | null;
    error: string | null;
    viewerImageUrl: string | null;
    panoId: string | null;
    resolutions: Resolution[];
    onStitchRequest: (zoom: number, onProgress: (p: Progress) => void) => Promise<string>;
}

const ProgressBar: React.FC<{ progress: Progress, text?: string }> = ({ progress, text = "Fetching & Stitching Tiles" }) => {
    const percentage = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
    return (
        <div className="progress-bar">
            <div className="progress-bar-info">
                <span>{text}</span>
                <span>{progress.loaded} / {progress.total}</span>
            </div>
            <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const ResolutionSelector: React.FC<{
    resolutions: Resolution[];
    panoId: string;
    onStitchRequest: ImageDisplayProps['onStitchRequest'];
    onNewImageReady: (imageUrl: string) => void;
}> = ({ resolutions, panoId, onStitchRequest, onNewImageReady }) => {
    const [stitchingState, setStitchingState] = useState<Record<number, { progress: Progress | null; isLoading: boolean; imageUrl: string | null }>>({});

    const handleDownload = (imageUrl: string, resolution: Resolution) => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `street-you-there_${panoId}_${resolution.width}x${resolution.height}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGenerateClick = async (resolution: Resolution) => {
        if (!panoId || stitchingState[resolution.zoom]?.isLoading) return;

        setStitchingState(prev => ({ ...prev, [resolution.zoom]: { progress: null, isLoading: true, imageUrl: null } }));

        const onProgress = (p: Progress) => {
            setStitchingState(prev => ({
                ...prev,
                [resolution.zoom]: { ...prev[resolution.zoom], progress: p, isLoading: true }
            }));
        };

        try {
            const imageUrl = await onStitchRequest(resolution.zoom, onProgress);
            setStitchingState(prev => ({
                ...prev,
                [resolution.zoom]: { progress: null, isLoading: false, imageUrl }
            }));
            onNewImageReady(imageUrl);
            handleDownload(imageUrl, resolution);
        } catch (error) {
            console.error(`Failed to stitch resolution ${resolution.zoom}:`, error);
            setStitchingState(prev => ({ ...prev, [resolution.zoom]: { progress: null, isLoading: false, imageUrl: null } }));
        }
    };

    return (
        <div className="resolution-selector">
            <h3>Available Resolutions</h3>
            <div className="resolution-list">
                {resolutions.slice().reverse().map(res => {
                    const state = stitchingState[res.zoom];
                    const isCompleted = !!state?.imageUrl;
                    return (
                        <div key={res.zoom} className="resolution-item">
                            <div className="resolution-info">
                                <p>{res.width} x {res.height}px <span>({res.label} - {res.tileCount} tiles)</span></p>
                                {state?.isLoading && state.progress && <ProgressBar progress={state.progress} text="Generating..." />}
                            </div>
                            <button
                                onClick={() => handleGenerateClick(res)}
                                disabled={state?.isLoading}
                                className={`resolution-button ${isCompleted ? 'completed' : 'generate'}`}
                            >
                                {isCompleted ? <CheckCircleIcon /> : <DownloadIcon />}
                                {state?.isLoading ? 'Generating...' : isCompleted ? 'Download Again' : 'Generate & Download'}
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export const ImageDisplay: React.FC<ImageDisplayProps> = ({ isLoading, progress, error, viewerImageUrl, panoId, resolutions, onStitchRequest }) => {
    const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

    useEffect(() => {
        setCurrentImageUrl(viewerImageUrl);
    }, [viewerImageUrl]);

    const handleNewImageReady = useCallback((imageUrl: string) => {
        setCurrentImageUrl(imageUrl);
    }, []);

    const showInitialLoader = isLoading && !resolutions.length;
    const showViewerLoader = isLoading && resolutions.length > 0 && progress;

    return (
        <div className="image-display-container">
            {showInitialLoader && <p>Preparing panorama...</p>}
            {showViewerLoader && <ProgressBar progress={progress!} />}

            {error && (
                <div className="error-message">
                    <h3>An Error Occurred</h3>
                    <p>{error}</p>
                </div>
            )}

            {currentImageUrl && (
                <div className="viewer-wrapper">
                    <div className="viewer-inner">
                         <PanoViewer imageUrl={currentImageUrl} />
                    </div>
                </div>
            )}

            {panoId && resolutions.length > 0 && !isLoading && (
                 <ResolutionSelector
                    resolutions={resolutions}
                    panoId={panoId}
                    onStitchRequest={onStitchRequest}
                    onNewImageReady={handleNewImageReady}
                />
            )}

            {!isLoading && !error && !viewerImageUrl && (
                 <div className="placeholder-text">
                    <p>Your 360° image will appear here.</p>
                </div>
            )}
        </div>
    );
};