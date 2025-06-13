// Preloader for critical resources to improve loading experience
export class SacredPreloader {
  private static instance: SacredPreloader;
  private loadedResources = new Set<string>();
  private loadingPromises = new Map<string, Promise<void>>();

  static getInstance(): SacredPreloader {
    if (!this.instance) {
      this.instance = new SacredPreloader();
    }
    return this.instance;
  }

  // Preload critical fonts
  async preloadFonts(): Promise<void> {
    const fonts = [];

    const promises = fonts.map(url => this.loadStylesheet(url));
    await Promise.allSettled(promises);
  }

  // Preload essential images
  async preloadImages(): Promise<void> {
    const images = [
      // Add any critical images here
    ];

    const promises = images.map(url => this.loadImage(url));
    await Promise.allSettled(promises);
  }

  // Load stylesheet
  private loadStylesheet(url: string): Promise<void> {
    if (this.loadedResources.has(url)) {
      return Promise.resolve();
    }

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = () => {
        this.loadedResources.add(url);
        resolve();
      };
      link.onerror = reject;
      document.head.appendChild(link);
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  // Load image
  private loadImage(url: string): Promise<void> {
    if (this.loadedResources.has(url)) {
      return Promise.resolve();
    }

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.loadedResources.add(url);
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  // Initialize all preloading
  async initializeAll(): Promise<void> {
    try {
      await Promise.allSettled([
        this.preloadFonts(),
        this.preloadImages()
      ]);
      console.log('🪷 Sacred resources preloaded successfully');
    } catch (error) {
      console.warn('⚠️ Some sacred resources failed to preload:', error);
    }
  }

  // Show loading progress
  getLoadingProgress(): number {
    const totalResources = this.loadingPromises.size;
    const loadedResources = this.loadedResources.size;
    return totalResources > 0 ? (loadedResources / totalResources) * 100 : 100;
  }
}

// Initialize preloader on module load
export const sacredPreloader = SacredPreloader.getInstance();

// Auto-start preloading
if (typeof window !== 'undefined') {
  sacredPreloader.initializeAll();
} 

// Sacred preloader for enlightened user experience
declare global {
  interface Window {
    __SACRED_PRELOADER__: SacredPreloader;
  }
} 