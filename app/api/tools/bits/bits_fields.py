
class BRFields:
    """
    This class contains the mapping of BR fields to their respective database columns.
    """
    # pylint: disable=line-too-long
    br_owner = {
        'BR_OWNER': { 'db_field': 'opis.BR_OWNER', 'description': 'The OPI responsible for the BR. Typically a Service Delivery Manager. OPI means Office of Primary Interest.'},
    }

    status = {
        'BITS_STATUS_EN': { 'db_field': 's.DISP_STATUS_EN', 'description': 'The current BITS BR status. Status denoting where in the EBIDM process the BR is currently.'},
        'BITS_STATUS_FR': { 'db_field': 's.DISP_STATUS_FR', 'description': ''},
        'PHASE_EN': { 'db_field': 's.BITS_PHASE_EN', 'description': 'The current phase of the BR. Phase denotes where in the EBIDM process the BR is currently.'},
        'PHASE_FR': { 'db_field': 's.BITS_PHASE_EN', 'description': ''},
    }

    date_fields = {
        'REQST_IMPL_DATE': { 'db_field': 'br.REQST_IMPL_DATE', 'description': 'The date requested by partner/client to have BR implementation completed. CRID acronym.'},
        'SUBMIT_DATE': { 'db_field': 'br.SUBMIT_DATE', 'description': 'The date the BR was created in BITS.'},
        'RVSD_TARGET_IMPL_DATE': { 'db_field': 'br.RVSD_TARGET_IMPL_DATE', 'description': 'The revised implementation date of the BR.'},
        'ACTUAL_IMPL_DATE': { 'db_field': 'br.ACTUAL_IMPL_DATE', 'description': 'Date that specifies when the service was delivered.'},
        'AGRMT_END_DATE': { 'db_field': 'br.AGRMT_END_DATE', 'description': 'The agreement end date associated with the BR.'},
        'PRPO_TARGET_DATE': { 'db_field': 'br.PRPO_TARGET_DATE', 'description': ''},
        'IMPL_SGNOFF_DATE': { 'db_field': 'br.IMPL_SGNOFF_DATE', 'description': 'The date the partner/client confirms in writing the BR is fully implemented.'},
        'CLIENT_REQST_SOL_DATE': { 'db_field': 'br.CLIENT_REQST_SOL_DATE', 'description': ''},
        'TARGET_IMPL_DATE': { 'db_field': 'br.TARGET_IMPL_DATE', 'description': ''},
    }

    base_fields = {
        'LEAD_PRODUCT_EN': { 'db_field': 'products.PROD_DESC_EN', 'description': 'The Lead Product associated with the BR.'},
        'LEAD_PRODUCT_FR': { 'db_field': 'products.PROD_DESC_FR', 'description': ''},
        'BR_SHORT_TITLE': { 'db_field': 'br.BR_SHORT_TITLE', 'description': 'Title which relates to the Business Request (BR).'},
        'RPT_GC_ORG_NAME_EN': { 'db_field': 'br.RPT_GC_ORG_NAME_EN', 'description': 'In BITS, this is the primary partner/client requesting the Business Request/service (BR). SSC provides service to Departmental Partners or Clients. This field contains the name of the SSC Partner or Client.'},
        'RPT_GC_ORG_NAME_FR': { 'db_field': 'br.RPT_GC_ORG_NAME_FR', 'description': ''},
        'ORG_TYPE_EN': { 'db_field': 'br.ORG_TYPE_EN', 'description': ''},
        'ORG_TYPE_FR': { 'db_field': 'br.ORG_TYPE_FR', 'description': ''},
        'BR_TYPE_EN': { 'db_field': 'br.BR_TYPE_EN', 'description': 'BR type is determined by the complexity of the request and/or the types of services requested.'},
        'BR_TYPE_FR': { 'db_field': 'br.BR_TYPE_FR', 'description': ''},
        'PRIORITY_EN': { 'db_field': 'br.PRIORITY_EN', 'description': 'The priority of the request.'},
        'PRIORITY_FR': { 'db_field': 'br.PRIORITY_FR', 'description': ''},
        'CPLX_EN': { 'db_field': 'br.CPLX_EN', 'description': 'The complexity of the BR.'},
        'CPLX_FR': { 'db_field': 'br.CPLX_FR', 'description': ''},
        'SCOPE_EN': { 'db_field': 'br.SCOPE_EN', 'description': 'Indicates whether the BR is an Operational Activity Request, Project Request or Real Property Activity.'},
        'SCOPE_FR': { 'db_field': 'br.SCOPE_FR', 'description': ''},
        'CLIENT_SUBGRP_EN': { 'db_field': 'br.CLIENT_SUBGRP_EN', 'description': ''},
        'CLIENT_SUBGRP_FR': { 'db_field': 'br.CLIENT_SUBGRP_FR', 'description': ''},
        'GROUP_EN': { 'db_field': 'br.GROUP_EN', 'description': ''},
        'GROUP_FR': { 'db_field': 'br.GROUP_FR', 'description': ''},
        'ASSOC_BRS': { 'db_field': 'br.ASSOC_BRS', 'description': 'Associated BRs to the BR.'},
        'BR_ACTIVE_EN': { 'db_field': 's.BR_ACTIVE_EN', 'description': ''},
        'BR_ACTIVE_FR': { 'db_field': 's.BR_ACTIVE_FR', 'description': ''},
        'ACC_MANAGER_OPI': { 'db_field': 'opis.ACC_MANAGER_OPI', 'description': ''},
        'AGR_OPI': { 'db_field': 'opis.AGR_OPI', 'description': 'The Agreement OPI associated with the BR.'},
        'BA_OPI': { 'db_field': 'opis.BA_OPI', 'description': 'The EBIDM BA responsible for costing the BR using the ePET.'},
        'BA_PRICING_OPI': { 'db_field': 'opis.BA_PRICING_OPI', 'description': 'The Business Analyst Pricing OPI associated with the Business Request (BR)'},
        'BA_PRICING_TL': { 'db_field': 'opis.BA_PRICING_TL', 'description': ''},
        'BA_TL': { 'db_field': 'opis.BA_TL', 'description': 'The Business Analyst Team Lead associated with the BR.'},
        'CSM_DIRECTOR': { 'db_field': 'opis.CSM_DIRECTOR', 'description': 'The Client Executive associated with the BR.'},
        'EAOPI': { 'db_field': 'opis.EAOPI', 'description': 'EA OPI/BPR AE'},
        'PM_OPI': { 'db_field': 'opis.PM_OPI', 'description': 'The PM Coordinator associated with the BR.'},
        'QA_OPI': { 'db_field': 'opis.QA_OPI', 'description': ''},
        'SDM_TL_OPI': { 'db_field': 'opis.SDM_TL_OPI', 'description': 'The Service Delivery Manager Team Lead for the BR.'},
        'TEAMLEADER': { 'db_field': 'opis.TEAMLEADER', 'description': 'The SDM (Service Delivery Manager) Executive associated with the BR.'},
        'WIO_OPI': { 'db_field': 'opis.WIO_OPI', 'description': 'Finance OPI/BRP Finance'},
        'GCIT_CAT_EN': { 'db_field': 'br.GCIT_CAT_EN', 'description': ''},
        'GCIT_CAT_FR': { 'db_field': 'br.GCIT_CAT_FR', 'description': ''},
        'GCIT_PRIORITY_EN': { 'db_field': 'br.GCIT_PRIORITY_EN', 'description': ''},
        'GCIT_PRIORITY_FR': { 'db_field': 'br.GCIT_PRIORITY_FR', 'description': ''},
        'IO_ID': { 'db_field': 'br.IO_ID', 'description': 'The internal order code associated with the BR.'},
        'EPS_NMBR': { 'db_field': 'br.EPS_NMBR', 'description': 'The Clarity/EPS project number associated with the BR . Enterprise Portfolio System (EPS) is the tool used by PM to track projects.'},
        'ECD_NMBR': { 'db_field': 'br.ECD_NMBR', 'description': ''},
        'PROD_OPI': { 'db_field': 'opis.PROD_OPI', 'description': 'The Service Lead for the BR.'},
    }
    # pylint: enable=line-too-long

    # Modify base fields
    base_fields.update(br_owner)
    base_fields.update(status)

    # Combine all search fields
    valid_search_fields = {}
    valid_search_fields.update(base_fields)
    valid_search_fields.update(date_fields)

    _opis_mapping = {
        "QA_OPI": {
            "en": "QA OPI",
            "fr": "BPR QA"
        },
        "CSM_DIRECTOR": {
            "en": "Client Executive",
            "fr": "Client exécutif"
        },
        "PROD_OPI": {
            "en": "Service Lead",
            "fr": "BPR des services"
        },
        "ENG_OPI": {
            "en": "Implementation OPI",
            "fr": "BPR Implémentation"
        },
        "BA_OPI": {
            "en": "BA OPI",
            "fr": "BPR analyste"
        },
        "TEAMLEADER": {
            "en": "Teamleader",
            "fr": "Chef d`équipe"
        },
        "BA_PRICING_OPI": {
            "en": "BA Pricing OPI",
            "fr": "BPR AA du prix"
        },
        "BA_PRICING_TL": {
            "en": "Service Line Coordinator",
            "fr": "Coordonnateur de la ligne de service"
        },
        "BR_OWNER": {
            "en": "BR OWNER",
            "fr": "Propriétaire"
        },
        "WIO_OPI": {
            "en": "Finance OPI",
            "fr": "BPR du Finance"
        },
        "EAOPI": {
            "en": "EA OPI",
            "fr": "BPR AE"
        },
        "SOLN_OPI": {
            "en": "Conceptual Designer",
            "fr": "Créateur Conceptuel"
        },
        "AGR_OPI": {
            "en": "Agreement OPI",
            "fr": "BPR Entente"
        },
        "PM_OPI": {
            "en": "PM/Coordinator",
            "fr": "GP/Coordonnateur"
        },
        "SISDOPI": {
            "en": "SISD OPI",
            "fr": "BPR DSIS"
        },
        "BA_TL": {
            "en": "BA Team Lead",
            "fr": "Chef d`équipe analystes"
        },
        "ACC_MANAGER_OPI": {
            "en": "Account Manager",
            "fr": "Gestionnaire de compte"
        },
        "SDM_TL_OPI": {
            "en": "SDM Team Lead",
            "fr": "GPS Chef d'équipe"
        }
    }
