import { Box } from '@mui/material';
import styled from '@mui/material/styles/styled';
import { useTranslation } from 'react-i18next';
import { AttachmentUtils } from './AttachmentUtils';

type AttachmentPreviewProps = {
    attachment: Attachment;
};

export const AttachmentPreview = ({ attachment }: AttachmentPreviewProps) => {
    const { t } = useTranslation();

    if (attachment.type === "image") {
        const url: string | undefined = attachment.blob_storage_url;
        return (
            <ImageContainer>
                <img
                    src={url}
                    aria-description={t("user.file.upload")}
                    height="100%"
                    width="100%"
                />
            </ImageContainer>
        );
    }

    if (AttachmentUtils.isDocumentType(attachment.type)) {
        return (
            <a
                href={attachment.blob_storage_url}
                target="_blank"
                rel="noopener noreferrer"
            >
                {attachment.file_name}
            </a>
        );
    }

    console.log(attachment.type);

    return (
        <span>Unsupported file type</span>
    )
}

const ImageContainer = styled(Box)`
  padding-top: 15px;
`;
