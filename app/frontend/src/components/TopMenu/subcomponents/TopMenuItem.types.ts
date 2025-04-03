import { BoxProps } from "@mui/material";


export type TopMenuItemDefinition = {
    icon: React.ReactElement;
    label: string;
    extraStyles?: BoxProps;
    onClick: () => void;
};
