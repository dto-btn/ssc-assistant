import { create } from 'zustand';
import { produce } from 'immer'
import { AppContext } from './AppStore.types';

// This is the time-to-live for a snackbar in milliseconds. After this time, the snackbar will
// automatically hide itself.
const SNACKBAR_TTL_MS = 6000;

const useAppStore = create<AppContext>((set, get) => ({
    snackbars: {
        data: [],
        /**
         * This function shows a snackbar with a message. It will automatically hide after 6 seconds.
         */
        show: (message: string) => {
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
    }
}));

export { useAppStore };