import { Box, Button, Fade, Paper, styled, Typography } from "@mui/material";
import { useState } from "react"
import TrapFocus from '@mui/material/Unstable_TrapFocus';

interface HelpfulTipsProps {
    handleAllHelpTipsDisplayed: () => void;
}

const tips = [
    "Check out the menu in the top right for customization settings.",
    "For quicker responses, try changing the model version to GPT-3.5 Turbo in the settings. For more accurate responses, try GPT-4o.",
    "You can disable and enable tools in the settings. MySCC+ gives you access to intranet documents, and GEDS gives you access to employee information."
  ];

const HelpfulTips = ({handleAllHelpTipsDisplayed}: HelpfulTipsProps) => {
    const [tipNumber, setTipNumber] = useState(1);
    const [allTipsSeen, setAllTipsSeen] = useState(false);

    const handleSetNextTip = () => {
        setTipNumber(tipNumber + 1)
    }

    const handleDismissTips = () => {
        setAllTipsSeen(true);
        handleAllHelpTipsDisplayed();
    }

    // 8F7EE7

    const showNextTipButton = tipNumber < tips.length;

    return (
        <>
          <TrapFocus open disableAutoFocus disableEnforceFocus>
                <Fade appear={false} in={!allTipsSeen}>
                    <Paper
                        role="dialog"
                        aria-modal="false"
                        aria-label="Cookie banner"
                        tabIndex={-1}
                        sx={{
                            width: { xs: '30%', sm: '30%', md: '20%' }, // Responsive width
                            maxWidth: '300px',
                            position: 'fixed',
                            top: 200,
                            left: 80,
                            right: 0,
                            m: 0,
                            p: {xs: 1, sm: 2},
                            boxShadow: 4,
                            backgroundColor: '#8F7EE7'
                        }}
                    >
                        <Typography variant="h6" sx={{color: 'white'}}>Tip # {tipNumber}</Typography>
                        <Typography sx={{color: 'white'}}>{tips[tipNumber - 1]}</Typography>
                        <ButtonView>
                            {showNextTipButton && 
                                <Button 
                                    onClick={handleSetNextTip}
                                    sx={{ 
                                        fontSize: { xs: '0.75rem', sm: '0.75rem' }, 
                                        backgroundColor: 'primary.main', 
                                        color: 'white', 
                                        padding: '4px 4px' 
                                    }}                                     >
                                    Next
                                </Button>
                            }
                            <Button 
                                onClick={handleDismissTips}
                                sx={{ 
                                    fontSize: { xs: '0.75rem', sm: '0.75rem' }, 
                                    backgroundColor: 'primary.main', 
                                    color: 'white', 
                                    padding: '4px 4px',
                                    ml: '5px',
                                    mr: '5px'
                                }} 
                            >
                                Skip Tips
                            </Button>
                        </ButtonView>
                    </Paper>
                </Fade>
            </TrapFocus>
        </>
    )
}

export default HelpfulTips

const ButtonView = styled(Box)`
    display: flex;
    margin-top: 10px;
    justify-content: space-between;
`