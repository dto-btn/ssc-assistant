import mimetypes
import requests
from typing import Tuple

import tiktoken
from PyPDF2 import PdfReader
from docx import Document
from openpyxl import load_workbook
from pptx import Presentation

class FileManager:
    def __init__(self, data: bytes, filetype: str):
        self.data = data
        self.filetype = filetype
        self.content = None

    def extract_text(self) -> str:
        if self.filetype == 'application/pdf':
            return self._extract_pdf(self.data)
        elif self.filetype == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            return self._extract_docx(self.data)
        elif self.filetype == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            return self._extract_xlsx(self.data)
        elif self.filetype == 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
            return self._extract_pptx(self.data)
        else:
            return "[Unsupported file type]"

    def _extract_pdf(self, data: bytes) -> str:
        from io import BytesIO
        reader = PdfReader(BytesIO(data))
        text = "\n".join(page.extract_text() or '' for page in reader.pages)
        return text

    def _extract_docx(self, data: bytes) -> str:
        from io import BytesIO
        doc = Document(BytesIO(data))
        text = "\n".join([p.text for p in doc.paragraphs])
        return text

    def _extract_xlsx(self, data: bytes) -> str:
        from io import BytesIO
        wb = load_workbook(BytesIO(data), read_only=True)
        text = []
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True):
                text.append("\t".join([str(cell) if cell is not None else '' for cell in row]))
        return "\n".join(text)

    def _extract_pptx(self, data: bytes) -> str:
        from io import BytesIO
        prs = Presentation(BytesIO(data))
        text = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    text.append(shape.text)
        return "\n".join(text)

    def count_tokens(self, text: str, encoding_name: str = "cl100k_base") -> int:
        encoding = tiktoken.get_encoding(encoding_name)
        return len(encoding.encode(text))

    def get_text_and_token_count(self) -> Tuple[str, int]:
        text = self.extract_text()
        token_count = self.count_tokens(text)
        return text, token_count
