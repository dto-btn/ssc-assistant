import { Box } from '@mui/material';
import styled from '@mui/material/styles/styled';
import { useTranslation } from 'react-i18next';
import { AttachmentUtils } from './AttachmentUtils';
import { FileIconUtils } from "./FileIconUtils";

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
          style={{ maxHeight: "400px", borderRadius: "25px", height: "100%", width: "100%" }}
        />
      </ImageContainer>
    );
  }

  if (AttachmentUtils.isDocumentType(attachment.type)) {
    return (
      <AttachmentCard
        href={attachment.blob_storage_url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {FileIconUtils.getFileIcon(attachment.file_name, attachment.type)}
        <FileName title={attachment.file_name}>{attachment.file_name}</FileName>
      </AttachmentCard>
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

const AttachmentCard = styled('a')`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  background: #f5f7fa;
  border: 1.5px solid #e0e3e8;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.06);
  text-decoration: none;
  color: #222;
  transition: box-shadow 0.2s, border-color 0.2s, background 0.2s;
  margin: 8px 0;
  max-width: 420px;
  width: 100%;
  min-width: 0;
  cursor: pointer;
  &:hover {
    background: #e3f0fc;
    border-color: #90caf9;
    box-shadow: 0 4px 16px rgba(25, 118, 210, 0.13);
    text-decoration: none;
  }
`;

const FileName = styled('span')`
  font-size: 1.12rem;
  font-weight: 600;
  color: #1a237e;
  word-break: break-all;
  max-width: 70%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
`;
