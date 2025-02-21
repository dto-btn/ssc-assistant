import { Alert, IconButton, Snackbar } from "@mui/material";
import { useAppStore } from "../context/AppStore";
import Slide, { SlideProps } from '@mui/material/Slide';

function SlideTransition(props: SlideProps) {
    return <Slide {...props} />;
}

export const AppSnackbars = () => {
    const appStore = useAppStore();

    return (
        <>
            {appStore.snackbars.data.map((datum) => {

                return (
                    <Snackbar
                        key={datum.id}
                        open={datum.isOpen}
                        message={datum.message}
                        TransitionComponent={SlideTransition}
                        style={{
                            maxWidth: "50%",
                        }}
                        onClose={() => {
                            // This onClose handles the escape key press, which is
                            // necessary for accessibility.
                            appStore.snackbars._hide(datum.id)
                        }}
                    >
                        <Alert
                            onClose={() => {
                                // This onClose handles the close button, which is
                                // only displayed if this onClose property is set
                                // on the Alert component.
                                appStore.snackbars._hide(datum.id)
                            }}
                            severity="error"
                            variant="filled"
                            sx={{ width: '100%' }}
                        >
                            {datum.message}
                        </Alert>
                    </Snackbar>
                )
            })}
        </>
    );
}