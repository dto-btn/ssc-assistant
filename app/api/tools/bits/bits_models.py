from pydantic import BaseModel, Field, field_validator

from tools.bits.bits_utils import BITSQueryBuilder

class BITSQueryFilter(BaseModel):
    """Model for BITSQueryFilter."""
    name: str = Field(..., description="Name of the database field")
    value: str = Field(..., description="Value of the field")
    operator: str = Field(..., description="Description of the field")

    # Validator for the 'operator' field
    @field_validator("operator")
    @classmethod
    def validate_operator(cls, v: str) -> str:
        """Validate the operator field."""
        if v not in {"=", "<", ">"}:
            raise ValueError("Operator must be one of '=', '<', or '>'")
        return v

    # Validator for the 'name' field
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate the name field.Ensure its a valid DB field"""
        if v not in BITSQueryBuilder.valid_search_fields:
            raise ValueError(f"Name must be one of {list(BITSQueryBuilder.valid_search_fields.keys())}")
        return v
    
class BITSQuery(BaseModel):
    """Represent the query that the AI does on behalf of the user"""
    query_filters: list[BITSQueryFilter] = Field(..., description="List of filters to apply to the query")
    limit: int = Field(100, description="Maximum number of records to return")
    statuses: list[str] = Field(..., description="List of statuses to filter by")
    
    # Validator for the 'statuses' field
    # TODO: need to come up with the extract of valid statuses and their description.
    # @field_validator("statuses")
    # def validate_statuses(self, v: list[str]) -> list[str]:
    #     """Validate the statuses field."""
    #     if not all(status in BITSQueryBuilder.valid_statuses for status in v):
    #         raise ValueError(f"Statuses must be one of {list(BITSQueryBuilder.valid_statuses)}")
    #     return v