import * as React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import { AppBar } from './components/AppBar';
import { DrawerHeader } from './components/DrawerHeader';
import { MainContentSection } from './components/MainContentSection';
import { useAppStore } from '../../../stores/AppStore';
import { LEFT_MENU_WIDTH } from "../../../constants";


interface NewLayoutProps extends React.PropsWithChildren {
    appBar?: React.ReactNode;
    appDrawerContents?: React.ReactNode;
}

const NewLayout: React.FC<NewLayoutProps> = ({ children, appBar, appDrawerContents: drawerMenu }) => {
    const { appDrawer } = useAppStore();
    const isOpen = appDrawer.isOpen;
    const drawerWidth = LEFT_MENU_WIDTH;

    const handleToggle = () => appDrawer.toggle();

    return (
        <Box sx={{ display: 'flex' }}>
            {appBar ? appBar : (
                <AppBar position="fixed" isOpen={isOpen} drawerWidth={LEFT_MENU_WIDTH} >
                    <Toolbar>
                        <Box sx={{
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "row",
                            gap: "0rem",
                            alignItems: "center",
                        }}
                            onClick={handleToggle}
                        >
                            <IconButton
                                color="inherit"
                                aria-label="open drawer"
                                edge="start"
                            >
                                <MenuIcon />
                            </IconButton>
                            <Typography variant="h6" noWrap component="div">
                                Click to {isOpen ? 'close' : 'open'} drawer
                            </Typography>
                        </Box>
                </Toolbar>
                </AppBar> 
            )
            }
            <DrawerHeader />


            <Drawer
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: drawerWidth,
                        boxSizing: 'border-box',
                        backgroundColor: "#ededf3"
                    },
                }}
                variant="persistent"
                anchor="left"
                open={isOpen}
            >
                {drawerMenu ? drawerMenu : (
                    // keep empty
                    <div></div>
                )}

            </Drawer>
            <MainContentSection isOpen={isOpen} drawerWidth={drawerWidth}>
                <DrawerHeader />
                {children}
            </MainContentSection>

        </Box>
    );
};

export default NewLayout;