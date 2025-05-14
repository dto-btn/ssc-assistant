export interface BitsQueryFilter {
    name: string;
    value: string;
    operator: "=" | "<" | ">" | "<=" | ">=";
}

export interface BitsQueryParams {
    query_filters: BitsQueryFilter[];
    limit: number;
    statuses: string[];
}

export interface BitsStatus {
    STATUS_ID: string;
    NAME_EN: string;
    NAME_FR: string;
    PHASE_EN: string;
    PHASE_FR: string;
}

export interface BitsField {
    name: string;
    description: string;
    db_field: string;
}

export interface BitsFieldMap {
    [key: string]: BitsField;
}
