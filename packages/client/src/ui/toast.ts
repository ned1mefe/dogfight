export type ToastType = 'success' | 'error' | 'info';

export class ToastManager {
  private container: HTMLElement | null = null;

  private getContainer(): HTMLElement {
    if (!this.container || !document.body.contains(this.container)) {
      let el = document.getElementById('toast-container');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast-container';
        el.className = 'fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full px-4';
        document.body.appendChild(el);
      }
      this.container = el;
    }
    return this.container;
  }

  public show(message: string, type: ToastType = 'info', durationMs: number = 3500): void {
    const container = this.getContainer();
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto transform transition-all duration-300 translate-y-3 opacity-0 flex items-center space-x-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md text-sm font-medium ${this.getTypeStyles(type)}`;

    const icon = document.createElement('span');
    icon.className = 'text-base font-mono';
    icon.textContent = this.getTypeIcon(type);

    const text = document.createElement('span');
    text.className = 'flex-1 leading-snug';
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-3', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    // Dismiss
    setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-3', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, durationMs);
  }

  private getTypeStyles(type: ToastType): string {
    switch (type) {
      case 'error':
        return 'bg-rose-950/90 border-rose-600/80 text-rose-100 shadow-rose-950/50';
      case 'success':
        return 'bg-emerald-950/90 border-emerald-600/80 text-emerald-100 shadow-emerald-950/50';
      case 'info':
      default:
        return 'bg-slate-900/95 border-sky-600/70 text-sky-100 shadow-sky-950/50';
    }
  }

  private getTypeIcon(type: ToastType): string {
    switch (type) {
      case 'error':
        return '⚠️';
      case 'success':
        return '✓';
      case 'info':
      default:
        return 'ℹ️';
    }
  }
}

export const toast = new ToastManager();
