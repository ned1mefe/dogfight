import { toast } from './toast.js';

export function parseLobbyHash(): string | null {
  const hash = window.location.hash;
  if (!hash) return null;
  const match = hash.match(/#lobby=([A-Za-z0-9_-]+)/i);
  return match ? match[1].toUpperCase() : null;
}

export function setLobbyHash(lobbyId: string): void {
  window.location.hash = `#lobby=${lobbyId.toUpperCase()}`;
}

export function clearLobbyHash(): void {
  if (window.location.hash.includes('#lobby=')) {
    history.replaceState(null, '', window.location.pathname);
  }
}

export async function copyInviteLink(lobbyId: string): Promise<boolean> {
  const url = `${window.location.origin}/#lobby=${lobbyId.toUpperCase()}`;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      // Fallback for non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    toast.show('Invite link copied to clipboard!', 'success');
    return true;
  } catch (err) {
    console.error('Failed to copy invite link:', err);
    toast.show(`Room Link: ${url}`, 'info', 6000);
    return false;
  }
}
