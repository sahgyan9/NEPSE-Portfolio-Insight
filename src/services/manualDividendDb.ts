/**
 * Manual Dividend Database Service
 * 
 * This service communicates with the local Python server (nepse_server.py)
 * to persist manual dividend entries in a JSON file (db/manual_dividends.json).
 * 
 * Data is stored permanently in the file system, not in browser localStorage.
 */

const API_BASE = import.meta.env.DEV
    ? '/api/nepse-server/api'
    : 'http://localhost:8000/api';

export interface ManualDividendEntry {
    id: string;
    symbol: string;
    companyName: string;
    fiscalYear: string;
    bonusPercent: number;
    cashPercent: number;
    cashIncome: number;
}

export interface ManualDividendData {
    entries: ManualDividendEntry[];
}

/**
 * Check if the server is available for manual dividend operations
 */
export async function isManualDividendServerAvailable(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/manual-dividends`, {
            method: "GET",
            signal: AbortSignal.timeout(2000)
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get all manual dividend entries from file storage
 */
export async function getManualDividends(): Promise<ManualDividendEntry[]> {
    try {
        const response = await fetch(`${API_BASE}/manual-dividends`);
        if (!response.ok) {
            throw new Error(`Failed to fetch manual dividends: ${response.status}`);
        }
        const data: ManualDividendData = await response.json();
        return data.entries || [];
    } catch (error) {
        console.error('[ManualDividendDb] Error fetching entries:', error);
        throw error;
    }
}

/**
 * Save all manual dividend entries to file storage
 */
export async function saveAllManualDividends(entries: ManualDividendEntry[]): Promise<ManualDividendEntry[]> {
    try {
        const response = await fetch(`${API_BASE}/manual-dividends`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entries })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to save manual dividends");
        }

        const data = await response.json();
        return data.entries || [];
    } catch (error) {
        console.error('[ManualDividendDb] Error saving entries:', error);
        throw error;
    }
}

/**
 * Add a new manual dividend entry
 */
export async function addManualDividend(entry: ManualDividendEntry): Promise<ManualDividendEntry[]> {
    try {
        const response = await fetch(`${API_BASE}/manual-dividends/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to add dividend entry");
        }

        const data = await response.json();
        return data.entries || [];
    } catch (error) {
        console.error('[ManualDividendDb] Error adding entry:', error);
        throw error;
    }
}

/**
 * Update an existing manual dividend entry
 */
export async function updateManualDividend(entryId: string, updatedEntry: Partial<ManualDividendEntry>): Promise<ManualDividendEntry[]> {
    try {
        const response = await fetch(`${API_BASE}/manual-dividends/${encodeURIComponent(entryId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedEntry)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to update dividend entry");
        }

        const data = await response.json();
        return data.entries || [];
    } catch (error) {
        console.error('[ManualDividendDb] Error updating entry:', error);
        throw error;
    }
}

/**
 * Delete a manual dividend entry
 */
export async function deleteManualDividend(entryId: string): Promise<ManualDividendEntry[]> {
    try {
        const response = await fetch(`${API_BASE}/manual-dividends/${encodeURIComponent(entryId)}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to delete dividend entry");
        }

        const data = await response.json();
        return data.entries || [];
    } catch (error) {
        console.error('[ManualDividendDb] Error deleting entry:', error);
        throw error;
    }
}
