import styled from "@mui/material/styles/styled";
import MuiAppBar, { AppBarProps } from "@mui/material/AppBar";

interface NewAppBarProps extends AppBarProps {
  isOpen: boolean;
  drawerWidth: number;
}

export const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "isOpen" && prop !== "drawerWidth",
})<NewAppBarProps>(({ theme, isOpen, drawerWidth }) => ({
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(isOpen && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(["margin", "width"], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    "& .MuiToolbar-gutters": {
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
  }),
}));
