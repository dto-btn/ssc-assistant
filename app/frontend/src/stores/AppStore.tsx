import { create } from 'zustand';
import { produce } from 'immer'
import { theme } from '../theme';

import { LanguageService } from "../services/LanguageService";

// This is the time-to-live for a snackbar in milliseconds. After this time, the snackbar will
// automatically hide itself.
const SNACKBAR_TTL_MS = 6000;

// This debounces the snackbar so that we don't show multiple snackbars in quick succession.
// This is only used if a debounceKey is passed to the show function.
const SNACKBAR_DEBOUNCE_MS = 100;

type SnackbarDatum = {
    id: number;
    message: string;
    isOpen: boolean;
};

type AppContext = {
    snackbars: {
        data: SnackbarDatum[];
        debounceKeys: string[];
        show: (message: string, debounceKey: string) => void;
        _hide: (id: number) => void;
    };
    appDrawer: {
        isOpen: boolean;
        toggle: () => void;
    },
    languageService: LanguageService,
    feedbackForm: {
        state: "open-positive" | "open-negative" | "closed";
        open: (feedbackType: "positive" | "negative") => void;
        close: () => void;
    }
};

export const useAppStore = create<AppContext>((set, get) => ({
    snackbars: {
        data: [],
        debounceKeys: [],
        /**
         * This function shows a snackbar with a message. It will automatically hide after 6 seconds.
         * The debounceKey is used to prevent multiple snackbars from showing in quick succession. It
         * is optional, and if it is not provided, the snackbar will not be debounced.
         */
        show: (message: string, debounceKey?: string) => {
            // If the debounce key is provided and is in the list of debounce keys, we don't show the snackbar.
            if (debounceKey && get().snackbars.debounceKeys.includes(debounceKey)) {
                return;
            }

            // generate unique id
            const id = Math.random();

            // hide after 6 seconds
            setTimeout(() => {
                get().snackbars._hide(id);
            }, SNACKBAR_TTL_MS);

            // show the snackbar by adding it to the list
            set((state) => produce(state, (draft) => {
                draft.snackbars.data.push({
                    id,
                    message,
                    isOpen: true
                });
            }));

            // debounce the snackbar if a debounce key is provided.
            set((state) => produce(state, (draft) => {
                // If a debounce key is provided, we add it to the list of debounce keys.
                if (debounceKey) {
                    draft.snackbars.debounceKeys.push(debounceKey);
                }

                // We remove the debounce key after 2 seconds. This is to prevent the debounce key
                setTimeout(() => {
                    set((state) => produce(state, (draft) => {
                        draft.snackbars.debounceKeys = draft.snackbars.debounceKeys.filter((key) => key !== debounceKey);
                    }));
                }, SNACKBAR_DEBOUNCE_MS);
            }))
        },
        /**
         * This is a private function that hides a snackbar by id. It can easily be made
         * public, but we aren't using it outside the store currently, so it is set to private.
         */
        _hide: (id: number) => {
            set((state) => produce(state, (draft) => {
                draft.snackbars.data.forEach((datum) => {
                    if (datum.id === id) {
                        // To support animations, we don't remove the snackbar immediately. Instead,
                        // we set isOpen to false, which removes the snackbar from the DOM and triggers
                        // the exit animation.
                        datum.isOpen = false;
                    }

                    // After the animation is complete, we remove the snackbar from the list.
                    // The 2000ms delay is to allow the animation to complete. It can probably be
                    // reduced, but it works well at 2000ms.
                    setTimeout(() => {
                        set((state) => produce(state, (draft) => {
                            draft.snackbars.data = draft.snackbars.data.filter((datum) => datum.id !== id);
                        }));
                    }, 2000)
                })
            }));
        }
    },
    appDrawer: {
        isOpen: window.innerWidth < theme.breakpoints.values.lg ? false : true,
        toggle: () => {
            set((state) => produce(state, (draft) => {
                draft.appDrawer.isOpen = !draft.appDrawer.isOpen;
            }));
        }
    },
    feedbackForm: {
        state: "closed",
        open: (feedbackType: "positive" | "negative") => {
            set((state) => produce(state, (draft) => {
                draft.feedbackForm.state = feedbackType === "positive" ? "open-positive" : "open-negative";
            }));
        },
        close: () => {
            set((state) => produce(state, (draft) => {
                draft.feedbackForm.state = "closed";
            }));
        }
    },
    languageService: new LanguageService()
}));

