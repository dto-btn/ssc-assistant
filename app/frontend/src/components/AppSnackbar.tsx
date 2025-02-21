import { Alert, IconButton, Snackbar } from "@mui/material";
import { useAppStore } from "../context/AppStore";
import Grow, { GrowProps } from '@mui/material/Grow';

function GrowTransition(props: GrowProps) {
    return <Grow {...props} />;
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
                        TransitionComponent={GrowTransition}
                        style={{
                            maxWidth: "50%",
                        }}
                        action={
                            <IconButton
                                size="small"
                                aria-label="close"
                                color="inherit"
                                onClick={() => appStore.snackbars._hide(datum.id)}
                            >
                                X
                            </IconButton>
                        }
                    >
                        <Alert
                            onClose={() => appStore.snackbars._hide(datum.id)}
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