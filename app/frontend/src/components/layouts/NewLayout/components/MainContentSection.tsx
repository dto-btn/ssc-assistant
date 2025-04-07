import { styled } from "@mui/material/styles";

interface MainContentSectionProps {
    isOpen?: boolean;
    drawerWidth: number;
}

export const MainContentSection = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<MainContentSectionProps>(({ theme, drawerWidth }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: `-${drawerWidth}px`,
    variants: [
        {
            props: ({ isOpen: open }) => open,
            style: {
                transition: theme.transitions.create('margin', {
                    easing: theme.transitions.easing.easeOut,
                    duration: theme.transitions.duration.enteringScreen,
                }),
                marginLeft: 0,
            },
        },
    ],
}));