declare global {
    interface Window {
        pannellum: {
            viewer(container: string | HTMLElement, config: any): any;
        };
    }
    // Fix: Move L declaration inside `declare global` to make it accessible project-wide.
    var L: any;
}

export {};
