export interface Attachment {
    type: string;
    blob_storage_url: string;
    encoded_file: string;
}

export class FileUpload implements Attachment {
    type!: string;
    blob_storage_url: string;
    message: string;
    file_name: string;
    encoded_file: string;

    constructor(blob_storage_url: string, encoded_file: string, message: string, file_name: string) {
        this.blob_storage_url = blob_storage_url;
        this.encoded_file = encoded_file;
        this.message = message;
        this.file_name = file_name;
    }
}