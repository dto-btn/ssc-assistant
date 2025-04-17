
class BRFields:
    """
    This class contains the mapping of BR fields to their respective database columns.
    """
    br_owner = {
        'BR_OWNER': 'opis.BR_OWNER'
    }

    status = {
        'BITS_STATUS_EN': 's.BITS_STATUS_EN',
        'BITS_STATUS_FR': 's.BITS_STATUS_FR',
    }

    date_fields = {
        'REQST_IMPL_DATE': 'br.REQST_IMPL_DATE',
        'SUBMIT_DATE': 'br.SUBMIT_DATE',
        'RVSD_TARGET_IMPL_DATE': 'br.RVSD_TARGET_IMPL_DATE',
        'ACTUAL_IMPL_DATE': 'br.ACTUAL_IMPL_DATE',
        'AGRMT_END_DATE': 'br.AGRMT_END_DATE',
        'PRPO_TARGET_DATE': 'br.PRPO_TARGET_DATE',
        'IMPL_SGNOFF_DATE': 'br.IMPL_SGNOFF_DATE',
        'CLIENT_REQST_SOL_DATE': 'br.CLIENT_REQST_SOL_DATE',
        'TARGET_IMPL_DATE': 'br.TARGET_IMPL_DATE',
    }

    base_fields = {
        'LEAD_PRODUCT_EN': 'products.PROD_DESC_EN',
        'LEAD_PRODUCT_FR': 'products.PROD_DESC_FR',
        'BR_SHORT_TITLE': 'br.BR_SHORT_TITLE',
        'RPT_GC_ORG_NAME_EN': 'br.RPT_GC_ORG_NAME_EN',
        'RPT_GC_ORG_NAME_FR': 'br.RPT_GC_ORG_NAME_FR',
        'ORG_TYPE_EN': 'br.ORG_TYPE_EN',
        'ORG_TYPE_FR': 'br.ORG_TYPE_FR',
        'BR_TYPE_EN': 'br.BR_TYPE_EN',
        'BR_TYPE_FR': 'br.BR_TYPE_FR',
        'PRIORITY_EN': 'br.PRIORITY_EN',
        'PRIORITY_FR': 'br.PRIORITY_FR',
        'CPLX_EN': 'br.CPLX_EN',
        'CPLX_FR': 'br.CPLX_FR',
        'SCOPE_EN': 'br.SCOPE_EN',
        'SCOPE_FR': 'br.SCOPE_FR',
        'CLIENT_SUBGRP_EN': 'br.CLIENT_SUBGRP_EN',
        'CLIENT_SUBGRP_FR': 'br.CLIENT_SUBGRP_FR',
        'GROUP_EN': 'br.GROUP_EN',
        'GROUP_FR': 'br.GROUP_FR',
        'ASSOC_BRS': 'br.ASSOC_BRS',
        'BR_ACTIVE_EN': 's.BR_ACTIVE_EN',
        'BR_ACTIVE_FR': 's.BR_ACTIVE_FR',
        'ACC_MANAGER_OPI': 'opis.ACC_MANAGER_OPI',
        'AGR_OPI': 'opis.AGR_OPI',
        'BA_OPI': 'opis.BA_OPI',
        'BA_PRICING_OPI': 'opis.BA_PRICING_OPI',
        'BA_PRICING_TL': 'opis.BA_PRICING_TL',
        'BA_TL': 'opis.BA_TL',
        'CSM_DIRECTOR': 'opis.CSM_DIRECTOR',
        'EAOPI': 'opis.EAOPI',
        'PM_OPI': 'opis.PM_OPI',
        'QA_OPI': 'opis.QA_OPI',
        'SDM_TL_OPI': 'opis.SDM_TL_OPI',
        'TEAMLEADER': 'opis.TEAMLEADER',
        'WIO_OPI': 'opis.WIO_OPI',
        'GCIT_CAT_EN': 'br.GCIT_CAT_EN',
        'GCIT_CAT_FR': 'br.GCIT_CAT_FR',
        'GCIT_PRIORITY_EN': 'br.GCIT_PRIORITY_EN',
        'GCIT_PRIORITY_FR': 'br.GCIT_PRIORITY_FR',
        'IO_ID': 'br.IO_ID',
        'EPS_NMBR': 'br.EPS_NMBR',
        'ECD_NMBR': 'br.ECD_NMBR',
        'PROD_OPI': 'opis.PROD_OPI',
    }

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