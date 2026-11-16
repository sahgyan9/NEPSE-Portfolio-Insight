/**
 * Launcher handshake.
 *
 * The Windows launcher (scripts/launch.ps1) keeps its splash screen up until the
 * dashboard has actually rendered the user's data. It opens the app with
 * `?launch=<token>` and listens on a local port; once the first portfolio load
 * has finished and been painted, we send that token back so the splash can fade
 * out over a ready page.
 *
 * When the app was not opened by the launcher there is no token and nothing is sent.
 */

const LAUNCHER_READY_URL = 'http://localhost:5189/ready';

let token: string | null = null;
let signalled = false;
const marks: string[] = [];

/** Record a startup milestone (ms since page start); sent to the launcher log with the ready signal. */
export function markStartup(name: string): void {
    if (token) marks.push(`${name}=${Math.round(performance.now())}`);
}

// Read the token once and remove it from the address bar so a later reload or a
// bookmark does not carry it.
try {
    const url = new URL(window.location.href);
    token = url.searchParams.get('launch');
    if (token) {
        url.searchParams.delete('launch');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
} catch {
    token = null;
}

/** Tell the launcher the dashboard is ready. Safe to call many times; sends at most once. */
export function signalLauncherReady(): void {
    if (!token || signalled) return;
    signalled = true;
    let sent = false;
    const send = () => {
        if (sent) return;
        sent = true;
        markStartup('ready');
        const query = `token=${encodeURIComponent(token as string)}&marks=${encodeURIComponent(marks.join(' '))}`;
        fetch(`${LAUNCHER_READY_URL}?${query}`, { mode: 'no-cors' })
            .catch(() => { /* launcher already gone; nothing to do */ });
    };
    // Prefer two animation frames so the data is painted before the splash fades.
    // Chrome pauses animation frames while the window is behind another window
    // (the browser opens behind the splash), so a short timer is the fallback.
    requestAnimationFrame(() => requestAnimationFrame(send));
    setTimeout(send, 300);
}
