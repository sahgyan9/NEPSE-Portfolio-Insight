/**
 * Shared Gemini API-key state.
 *
 * Every page used to re-implement this same block: read the key from
 * localStorage, fall back to the VITE_GEMINI_API_KEY build-time default, and
 * persist changes. This hook is the single source of truth for all of them.
 */

import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';

export function useApiKey() {
    const [apiKey, setApiKeyState] = useState('');

    useEffect(() => {
        const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
        if (savedKey) {
            setApiKeyState(savedKey);
            return;
        }
        // Seed from the build-time default the first time only.
        const defaultKey = import.meta.env.VITE_GEMINI_API_KEY || '';
        if (defaultKey) {
            setApiKeyState(defaultKey);
            localStorage.setItem(STORAGE_KEYS.apiKey, defaultKey);
        }
    }, []);

    const setApiKey = useCallback((key: string) => {
        setApiKeyState(key);
        localStorage.setItem(STORAGE_KEYS.apiKey, key);
    }, []);

    return { apiKey, setApiKey };
}
