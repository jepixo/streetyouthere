
import React, { useState } from 'react';
import { LinkIcon } from './icons';

interface URLInputProps {
    onSubmit: (url: string) => void;
    isLoading: boolean;
}

export const URLInput: React.FC<URLInputProps> = ({ onSubmit, isLoading }) => {
    const [inputValue, setInputValue] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
            onSubmit(inputValue);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="url-input-form">
            <div className="url-input-wrapper">
                <LinkIcon className="icon" />
                <input
                    type="url"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="https://www.google.com/maps/..."
                    disabled={isLoading}
                    className="url-input-field"
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="url-input-button"
                >
                    {isLoading ? 'Processing...' : 'Generate'}
                </button>
            </div>
        </form>
    );
};