type SnackbarDatum = {
    id: number;
    message: string;
    isOpen: boolean;
};

export type AppContext = {
    snackbars: {
        data: SnackbarDatum[];
        debounceKeys: string[];
        show: (message: string, debounceKey: string) => void;
        _hide: (id: number) => void;
    };
    appDrawer: {
        isOpen: boolean;
        toggle: () => void;
    }
};
