import { Box, Button, Fade, Paper, styled, Typography } from "@mui/material";
import { useEffect, useState } from "react"
import TrapFocus from '@mui/material/Unstable_TrapFocus';
import { useTranslation } from "react-i18next";

interface TutorialBubbleProps {
    handleAllTutorialsDisplayed: () => void;
    menuIconRef: React.RefObject<HTMLButtonElement>;
    updateTutorialBubbleNumber: (tutorialNumber: number | undefined) => void;
}

const tips = [
    "tutorial.menu",
    "tutorial.clearChat",
    "tutorial.toolSelection",
    "tutorial.modelSelection"
];

const tipTitles = [
    "tutorial.menu.title",
    "tutorial.clearChat.title",
    "tutorial.toolSelection.title",
    "tutorial.modelSelection.title"
]

interface ArrowStyle {
    top: number;
    right: number;
    borderLeft?: string;
    borderRight?: string;
    borderTop?: string;
    borderBottom?: string;
}

const arrowStyles: Record<number, ArrowStyle> = {
    1: { top: -12, right: 18, borderRight: '15px solid transparent', borderBottom: '15px solid #24604A', borderLeft: '15px solid transparent' },
    2: { top: 20, right: -12, borderTop: '15px solid transparent', borderBottom: '15px solid transparent', borderLeft: '15px solid #24604A' },
    3: { top: 70, right: -12, borderTop: '15px solid transparent', borderBottom: '15px solid transparent', borderLeft: '15px solid #24604A' },
    4: { top: 120, right: -12, borderTop: '15px solid transparent', borderBottom: '15px solid transparent', borderLeft: '15px solid #24604A' },
};

const getArrowStyles = (tipNumber: number): React.CSSProperties => {
    const styles = arrowStyles[tipNumber] || {};
    return {
        content: '""',
        position: 'absolute',
        width: 0,
        height: 0,
        borderLeft: styles.borderLeft || '0',
        borderRight: styles.borderRight || '0',
        borderTop: styles.borderTop || '0',
        borderBottom: styles.borderBottom || '0',
        top: `${styles.top}px`,
        right: `${styles.right}px`,
    };
};

export const TutorialBubble = ({handleAllTutorialsDisplayed, menuIconRef, updateTutorialBubbleNumber}: TutorialBubbleProps) => {
    const [tipNumber, setTipNumber] = useState(1);
    const [allTutorialsSeen, setAllTutorialsSeen] = useState(false);
    const [dialogPosition, setDialogPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const { t } = useTranslation();

    // Anchors the tutorial bubble near the menu icon
    useEffect(() => {
        if (menuIconRef.current) {
            const rect = menuIconRef.current.getBoundingClientRect();
            setDialogPosition({
                top: tipNumber < 2 ? rect.top + 70 : rect.top + 15,
                left: tipNumber < 2 ? rect.right + 310 : window.innerWidth - 15
            });
        }
    }, [menuIconRef, tipNumber]);

    const StyledPaper = styled(Paper)(({ theme }) => ({
        backgroundColor: '#24604A',
        width: '300px',
        padding: '16px',
        borderRadius: '7px',
        boxShadow: theme.shadows[24],
        position: 'fixed',
        top: `${dialogPosition.top}px`,
        left: `${dialogPosition.left}px`,
        transform: 'translateX(-200%)',
        zIndex: 1200,
        '&::after': getArrowStyles(tipNumber)
    }));


    const handleSetTip = (newTipNumber: number) => {
        setTipNumber(newTipNumber)
        updateTutorialBubbleNumber(newTipNumber);
    }

    const handleDismissTips = () => {
        setAllTutorialsSeen(true);
        handleAllTutorialsDisplayed();
        updateTutorialBubbleNumber(undefined);
    }

    return (
        <>
          <TrapFocus open >
                <Fade appear={false} in={!allTutorialsSeen}>
                    <StyledPaper
                        role="dialog"
                        aria-modal="false"
                        aria-label="Tutorial bubble"
                        tabIndex={0}
                    >
                        <Typography variant="h6" sx={{color: 'white', mb: '5px'}}>{t(tipTitles[tipNumber - 1])}</Typography>
                        <Typography sx={{color: 'white', fontSize: '15px'}}
                            dangerouslySetInnerHTML={{ __html: t(tips[tipNumber - 1]) }}
                        />
                        <ButtonView>
                            <div>
                                {tipNumber > 1 &&
                                    <Button
                                        onClick={() => handleSetTip(tipNumber - 1)}
                                        aria-label={t("aria.previous.tutorial.button")}
                                        sx={{
                                            fontSize: '13px',
                                            color: 'white',
                                            padding: '4px 4px',
                                            mr: '5px',
                                            '&:hover' : { textDecoration: 'underline'}
                                        }}>
                                        {t("tutorial.previous")}
                                    </Button>
                                }
                                {(tipNumber < tips.length) &&
                                    <Button
                                        onClick={() => handleSetTip(tipNumber + 1)}
                                        aria-label={t("aria.next.tutorial.button")}
                                        sx={{
                                            fontSize: '13px',
                                            color: 'white',
                                            padding: '4px 4px',
                                            '&:hover' : { textDecoration: 'underline'}
                                        }}>
                                        {t("tutorial.next")}
                                    </Button>
                                }
                            </div>
                            <Button
                                onClick={handleDismissTips}
                                aria-label={t("aria.skip.tutorial.button")}
                                sx={{
                                    fontSize: '13px',
                                    color: 'white',
                                    padding: '4px 4px',
                                    ml: '5px',
                                    mr: '0px',
                                    '&:hover' : { textDecoration: 'underline'}
                                }}
                            >
                                {tipNumber < tips.length ? `${t("tutorial.skip")} (${tipNumber} / ${tips.length})` : `${t("close")}`}
                        </Button>
                        </ButtonView>
                    </StyledPaper>
                </Fade>
            </TrapFocus>
        </>
    )
}

const ButtonView = styled(Box)`
    display: flex;
    margin-top: 25px;
    justify-content: space-between;
`
