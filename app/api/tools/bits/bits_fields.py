class BRFields:
    """
    This class contains the mapping of BR fields to their respective database columns.
    """
    # pylint: disable=line-too-long
    br_owner = {
        'BR_OWNER': { 'db_field': 'opis.BR_OWNER', 'description': 'The OPI responsible for the BR. Typically a Service Delivery Manager. OPI means Office of Primary Interest.', 'is_user_field': True},
    }

    status = {
        'BITS_STATUS_EN': { 'db_field': 's.DISP_STATUS_EN', 'description': 'The current BITS BR status. Status denoting where in the EBIDM process the BR is currently.'},
        'BITS_STATUS_FR': { 'db_field': 's.DISP_STATUS_FR', 'description': 'Statut BITS BR.'},
    }

    date_fields = {
        'REQST_IMPL_DATE': { 'db_field': 'br.REQST_IMPL_DATE', 'description': 'The date requested by partner/client to have BR implementation completed. CRID acronym.'},
        'SUBMIT_DATE': { 'db_field': 'br.SUBMIT_DATE', 'description': 'The date the BR was created in BITS.'},
        'RVSD_TARGET_IMPL_DATE': { 'db_field': 'br.RVSD_TARGET_IMPL_DATE', 'description': 'The revised implementation date of the BR.'},
        'ACTUAL_IMPL_DATE': { 'db_field': 'br.ACTUAL_IMPL_DATE', 'description': 'Date that specifies when the service was delivered.'},
        'AGRMT_END_DATE': { 'db_field': 'br.AGRMT_END_DATE', 'description': 'The agreement end date associated with the BR.'},
        'PRPO_TARGET_DATE': { 'db_field': 'br.PRPO_TARGET_DATE', 'description': 'Proposed Target Date for the BR.'},
        'IMPL_SGNOFF_DATE': { 'db_field': 'br.IMPL_SGNOFF_DATE', 'description': 'The date the partner/client confirms in writing the BR is fully implemented.'},
        'CLIENT_REQST_SOL_DATE': { 'db_field': 'br.CLIENT_REQST_SOL_DATE', 'description': 'Client Requested Solution Date.'},
        'TARGET_IMPL_DATE': { 'db_field': 'br.TARGET_IMPL_DATE', 'description': 'Target Implementation Date.'},
    }

    base_fields = {
        'LEAD_PRODUCT_EN': { 'db_field': 'products.PROD_DESC_EN', 'description': 'Lead Product' },
        'LEAD_PRODUCT_FR': { 'db_field': 'products.PROD_DESC_FR', 'description': 'Produit principal' },
        'BR_SHORT_TITLE': { 'db_field': 'br.BR_SHORT_TITLE', 'description': 'Title which relates to the Business Request (BR).' },
        'RPT_GC_ORG_NAME_EN': { 'db_field': 'br.RPT_GC_ORG_NAME_EN', 'description': 'Primary partner/client requesting the Business Request/service (BR)' },
        'RPT_GC_ORG_NAME_FR': { 'db_field': 'br.RPT_GC_ORG_NAME_FR', 'description': 'Partenaire/client principal' },
        'ORG_TYPE_EN': { 'db_field': 'br.ORG_TYPE_EN', 'description': 'Organization type' },
        'ORG_TYPE_FR': { 'db_field': 'br.ORG_TYPE_FR', 'description': 'Type d’organisation' },
        'BR_TYPE_EN': { 'db_field': 'br.BR_TYPE_EN', 'description': 'BR type' },
        'BR_TYPE_FR': { 'db_field': 'br.BR_TYPE_FR', 'description': 'Type de BR' },
        'PRIORITY_EN': { 'db_field': 'br.PRIORITY_EN', 'description': 'Priority' },
        'PRIORITY_FR': { 'db_field': 'br.PRIORITY_FR', 'description': 'Priorité' },
        'CPLX_EN': { 'db_field': 'br.CPLX_EN', 'description': 'Complexity' },
        'CPLX_FR': { 'db_field': 'br.CPLX_FR', 'description': 'Complexité' },
        'SCOPE_EN': { 'db_field': 'br.SCOPE_EN', 'description': 'Scope' },
        'SCOPE_FR': { 'db_field': 'br.SCOPE_FR', 'description': 'Portée' },
        'CLIENT_SUBGRP_EN': { 'db_field': 'br.CLIENT_SUBGRP_EN', 'description': 'Client subgroup' },
        'CLIENT_SUBGRP_FR': { 'db_field': 'br.CLIENT_SUBGRP_FR', 'description': 'Sous-groupe client' },
        'GROUP_EN': { 'db_field': 'br.GROUP_EN', 'description': 'Group' },
        'GROUP_FR': { 'db_field': 'br.GROUP_FR', 'description': 'Groupe' },
        'ASSOC_BRS': { 'db_field': 'br.ASSOC_BRS', 'description': 'Associated BRs to the BR.'},
        'BR_ACTIVE_EN': { 'db_field': 's.BR_ACTIVE_EN', 'description': 'Indicates if the BR is active.'},
        'BR_ACTIVE_FR': { 'db_field': 's.BR_ACTIVE_FR', 'description': 'Indique si la BR est active.'},
        'ACC_MANAGER_OPI': { 'db_field': 'opis.ACC_MANAGER_OPI', 'description': 'Account Manager OPI.', 'is_user_field': True},
        'AGR_OPI': { 'db_field': 'opis.AGR_OPI', 'description': 'The Agreement OPI associated with the BR.', 'is_user_field': True},
        'BA_OPI': { 'db_field': 'opis.BA_OPI', 'description': 'The EBIDM BA responsible for costing the BR using the ePET.', 'is_user_field': True},
        'BA_PRICING_OPI': { 'db_field': 'opis.BA_PRICING_OPI', 'description': 'The Business Analyst Pricing OPI associated with the Business Request (BR)', 'is_user_field': True},
        'BA_PRICING_TL': { 'db_field': 'opis.BA_PRICING_TL', 'description': 'Service Line Coordinator.', 'is_user_field': True},
        'BA_TL': { 'db_field': 'opis.BA_TL', 'description': 'The Business Analyst Team Lead associated with the BR.', 'is_user_field': True},
        'CSM_DIRECTOR': { 'db_field': 'opis.CSM_DIRECTOR', 'description': 'The Client Executive associated with the BR.', 'is_user_field': True},
        'EAOPI': { 'db_field': 'opis.EAOPI', 'description': 'EA OPI/BPR AE', 'is_user_field': True},
        'PM_OPI': { 'db_field': 'opis.PM_OPI', 'description': 'The PM Coordinator associated with the BR.', 'is_user_field': True},
        'QA_OPI': { 'db_field': 'opis.QA_OPI', 'description': 'QA OPI.', 'is_user_field': True},
        'SDM_TL_OPI': { 'db_field': 'opis.SDM_TL_OPI', 'description': 'The Service Delivery Manager Team Lead for the BR.', 'is_user_field': True},
        'TEAMLEADER': { 'db_field': 'opis.TEAMLEADER', 'description': 'The SDM (Service Delivery Manager) Executive associated with the BR.', 'is_user_field': True},
        'WIO_OPI': { 'db_field': 'opis.WIO_OPI', 'description': 'Finance OPI/BRP Finance', 'is_user_field': True},
        'GCIT_CAT_EN': { 'db_field': 'br.GCIT_CAT_EN', 'description': 'GCIT Category.'},
        'GCIT_CAT_FR': { 'db_field': 'br.GCIT_CAT_FR', 'description': 'Catégorie GCIT.'},
        'GCIT_PRIORITY_EN': { 'db_field': 'br.GCIT_PRIORITY_EN', 'description': 'GCIT Priority.'},
        'GCIT_PRIORITY_FR': { 'db_field': 'br.GCIT_PRIORITY_FR', 'description': 'Priorité GCIT.'},
        'IO_ID': { 'db_field': 'br.IO_ID', 'description': 'The internal order code associated with the BR.'},
        'EPS_NMBR': { 'db_field': 'br.EPS_NMBR', 'description': 'The Clarity/EPS project number associated with the BR . Enterprise Portfolio System (EPS) is the tool used by PM to track projects.'},
        'ECD_NMBR': { 'db_field': 'br.ECD_NMBR', 'description': 'ECD Number.'},
        'PROD_OPI': { 'db_field': 'opis.PROD_OPI', 'description': 'The Service Lead for the BR.', 'is_user_field': True},
        'PHASE_EN': { 'db_field': 's.BITS_PHASE_EN', 'description': 'The current phase of the BR. Phase denotes where in the EBIDM process the BR is currently.'},
        'PHASE_FR': { 'db_field': 's.BITS_PHASE_EN', 'description': 'Phase de la BR.'},
    }
    # pylint: enable=line-too-long

    # Combine all search fields
    valid_search_fields = {}
    valid_search_fields.update(base_fields)
    valid_search_fields.update(br_owner)
    valid_search_fields.update(date_fields)

    valid_search_fields_no_statuses = valid_search_fields.copy()
    valid_search_fields.update(status)
