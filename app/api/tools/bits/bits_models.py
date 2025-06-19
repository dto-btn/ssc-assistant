from pydantic import BaseModel, Field, field_validator

from tools.bits.bits_fields import BRFields

class BRQueryFilter(BaseModel):
    """Model for BRQueryFilter."""
    name: str = Field(..., description="Name of the database field", )
    value: str = Field(..., description="Value of the field")
    operator: str = Field(..., description="Operator, must be one of '=', '<', '>', '<=' or '>=' or '!='")

    # Validator for the 'operator' field
    @field_validator("operator")
    @classmethod
    def validate_operator(cls, v: str) -> str:
        """Validate the operator field."""
        if v not in {"=", "<", ">", "<=", ">=", "!="}:
            raise ValueError("Operator, must be one of '=', '<', '>', '<=' or '>=' or '!='")
        return v

    # Validator for the 'name' field
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate the name field.Ensure its a valid DB field"""
        if v not in BRFields.valid_search_fields_filterable:
            raise ValueError(f"Name must be one of {list(BRFields.valid_search_fields_filterable.keys())}")
        return v

    def is_date(self) -> bool:
        """Check if the field is a date."""
        return str(self.name).endswith("_DATE")

    def to_label_dict(self):
        """Return a dict with en/fr labels instead of the raw name."""
        field_info = BRFields.valid_search_fields_filterable.get(self.name, {})
        return {
            "name": self.name,
            "en": field_info.get("en", self.name),
            "fr": field_info.get("fr", self.name),
            "value": self.value,
            "operator": self.operator,
        }

    def model_dump(self, *args, **kwargs):
        # Use the custom label dict for dumping
        return self.to_label_dict()

class BRQuery(BaseModel):
    """Represent the query that the AI does on behalf of the user"""
    query_filters: list[BRQueryFilter] = Field(..., description="List of filters to apply to the query.")
    limit: int = Field(750, description="Maximum number of records to return. Optional. Defaults to 750.")
    active: bool = Field(True, description="If it should search for active BRs only, on by default.")

    def model_dump(self, *args, **kwargs):
        data = super().model_dump(*args, **kwargs)
        # Replace query_filters with label dicts
        data["query_filters"] = [f.to_label_dict() for f in self.query_filters]
        return data
    
class BRSelectFields(BaseModel):
    """Fields to use for the SELECT statement in the BITS query **AND** fields that will displayed to the user."""
    fields: list[str]= Field(..., description="""List of database field names to include in the 
                             select statement and that will display to the user in the answer""")

    # Validator for the 'fields' field
    @field_validator("fields")
    @classmethod
    def validate_fields(cls, v: list[str]) -> list[str]:
        """Validate each field name to ensure it's a valid DB field"""
        for field in v:
            if field not in BRFields.valid_search_fields:
                raise ValueError(f"Field '{field}' must be one of {list(BRFields.valid_search_fields.keys())}")
        return v

    @field_validator("fields")
    @classmethod
    def validate_size(cls, v: list[str]) -> list[str]:
        """Ensure the fields list is not empty and does not exceed a reasonable size."""
        if not v:
            raise ValueError("At least one field must be specified.")
        if len(v) > 10:
            raise ValueError("Too many fields specified. Maximum is 10.")
        return v
    
    @field_validator("fields")
    @classmethod
    def validate_no_duplicates(cls, v: list[str]) -> list[str]:
        """Ensure there are no duplicate fields in the list."""
        if len(v) != len(set(v)):
            raise ValueError("Duplicate fields are not allowed.")
        return v

    def model_dump(self, *args, **kwargs):
        """Custom serialization for JSON encoding"""
        return {"fields": self.fields}
