import { BoxProps } from "@mui/material";


export type TopMenuItemDefinition = {
    id: string;
    icon: React.ReactElement;
    label: string;
    extraStyles?: BoxProps;
    onClick: () => void;
};
