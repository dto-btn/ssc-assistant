type SnackbarDatum = {
    id: number;
    message: string;
    isOpen: boolean;
};

export type AppContext = {
    snackbars: {
        data: SnackbarDatum[];
        show: (message: string) => void;
        _hide: (id: number) => void;
    };
};
