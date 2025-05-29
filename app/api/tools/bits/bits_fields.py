class BRFields:
    """
    This class contains the mapping of BR fields to their respective database columns.
    """
    # pylint: disable=line-too-long
    br_owner = {
        'BR_OWNER': { 'db_field': 'opis.BR_OWNER', 'description': 'The OPI responsible for the BR. Typically a Service Delivery Manager. OPI means Office of Primary Interest.', 'is_user_field': True, 'en': 'BR OWNER', 'fr': 'Responsable de la DO'},
    }

    status = {
        'BITS_STATUS_EN': { 'db_field': 's.DISP_STATUS_EN', 'description': 'The current BITS BR status. Status denoting where in the EBIDM process the BR is currently.', 'en': 'Status', 'fr': 'Statut'},
        'BITS_STATUS_FR': { 'db_field': 's.DISP_STATUS_FR', 'description': 'Statut BITS BR.', 'en': 'Status', 'fr': 'Statut'},
    }

    active = {
        'BR_ACTIVE_EN': { 'db_field': 's.BR_ACTIVE_EN', 'description': 'Indicates if the BR is active.', 'en': 'Active', 'fr': 'Actif' },
        'BR_ACTIVE_FR': { 'db_field': 's.BR_ACTIVE_FR', 'description': 'Indique si la BR est active.', 'en': 'Active', 'fr': 'Actif' },
    }

    date_fields = {
        'REQST_IMPL_DATE': { 'db_field': 'br.REQST_IMPL_DATE', 'description': 'The date requested by partner/client to have BR implementation completed. CRID acronym.', 'en': 'Client Requested Implementation Date', 'fr': 'Date de mise en oeuvre demandée'},
        'SUBMIT_DATE': { 'db_field': 'br.SUBMIT_DATE', 'description': 'The date the BR was created in BITS.', 'en': 'Date Submited', 'fr': 'Date de soumission'},
        'RVSD_TARGET_IMPL_DATE': { 'db_field': 'br.RVSD_TARGET_IMPL_DATE', 'description': 'The revised implementation date of the BR.', 'en': 'Revised Implementation Date', 'fr': 'Date de mise en œuvre révisée'},
        'ACTUAL_IMPL_DATE': { 'db_field': 'br.ACTUAL_IMPL_DATE', 'description': 'Date that specifies when the service was delivered.', 'en': 'Actual Implementation Date', 'fr': 'Date de mise en œuvre réelle'},
        'AGRMT_END_DATE': { 'db_field': 'br.AGRMT_END_DATE', 'description': 'The agreement end date associated with the BR.', 'en': 'Agreement End Date', 'fr': 'Date de fin de l\'entente'},
        #'PRPO_TARGET_DATE': { 'db_field': 'br.PRPO_TARGET_DATE', 'description': 'Proposed Target Date for the BR.', 'en': 'Target Specification Date', 'fr': 'Date de Spécification Cible'},
        #'IMPL_SGNOFF_DATE': { 'db_field': 'br.IMPL_SGNOFF_DATE', 'description': 'The date the partner/client confirms in writing the BR is fully implemented.', 'en': 'Client Sign-off Implementation Date', 'fr': 'Date de Mise en Œuvre de l\'Approbation du Client'},
        #'CLIENT_REQST_SOL_DATE': { 'db_field': 'br.CLIENT_REQST_SOL_DATE', 'description': 'Client Requested Solution Date.', 'en': 'Client Requested Specification Date', 'fr': 'Date de Spécification Demandée par le Client'},
        'TARGET_IMPL_DATE': { 'db_field': 'br.TARGET_IMPL_DATE', 'description': 'Target Implementation Date.', 'en': 'Target Implementation Date', 'fr': 'Date cible de la mise en oeuvre'},
    }

    base_fields = {
        'LEAD_PRODUCT_EN': { 'db_field': 'products.PROD_DESC_EN', 'description': 'Lead Product', 'en': 'Lead Product', 'fr': 'Produit principal' },
        'LEAD_PRODUCT_FR': { 'db_field': 'products.PROD_DESC_FR', 'description': 'Produit principal', 'en': 'Lead Product', 'fr': 'Produit principal' },
        'BR_SHORT_TITLE': { 'db_field': 'br.BR_SHORT_TITLE', 'description': 'Title which relates to the Business Request (BR).', 'en': 'Title', 'fr': 'Titre' },
        'RPT_GC_ORG_NAME_EN': { 'db_field': 'br.RPT_GC_ORG_NAME_EN', 'description': 'Primary partner/client requesting the Business Request/service (BR)', 'en': 'Client Name', 'fr': 'Client' },
        'RPT_GC_ORG_NAME_FR': { 'db_field': 'br.RPT_GC_ORG_NAME_FR', 'description': 'Partenaire/client principal', 'en': 'Client Name', 'fr': 'Client' },
        'ORG_TYPE_EN': { 'db_field': 'br.ORG_TYPE_EN', 'description': 'Organization type', 'en': 'Organization Type', 'fr': 'Type d\'organisation' },
        'ORG_TYPE_FR': { 'db_field': 'br.ORG_TYPE_FR', 'description': 'Type d\'organisation', 'en': 'Organization Type', 'fr': 'Type d\'organisation' },
        'BR_TYPE_EN': { 'db_field': 'br.BR_TYPE_EN', 'description': 'BR type', 'en': 'BR Type', 'fr': 'Type de DO' },
        'BR_TYPE_FR': { 'db_field': 'br.BR_TYPE_FR', 'description': 'Type de BR', 'en': 'BR Type', 'fr': 'Type de DO' },
        'PRIORITY_EN': { 'db_field': 'br.PRIORITY_EN', 'description': 'Priority', 'en': 'Priority', 'fr': 'Priorité de la demande' },
        'PRIORITY_FR': { 'db_field': 'br.PRIORITY_FR', 'description': 'Priorité', 'en': 'Priority', 'fr': 'Priorité de la demande' },
        'CPLX_EN': { 'db_field': 'br.CPLX_EN', 'description': 'Complexity', 'en': 'Complexity', 'fr': 'Niveau de complexité' },
        'CPLX_FR': { 'db_field': 'br.CPLX_FR', 'description': 'Complexité', 'en': 'Complexity', 'fr': 'Niveau de complexité' },
        'SCOPE_EN': { 'db_field': 'br.SCOPE_EN', 'description': 'Scope', 'en': 'Scope (OAR/PR)', 'fr': 'Champ d\'application (OAR/PR)' },
        'SCOPE_FR': { 'db_field': 'br.SCOPE_FR', 'description': 'Portée', 'en': 'Scope (OAR/PR)', 'fr': 'Champ d\'application (OAR/PR)' },
        'CLIENT_SUBGRP_EN': { 'db_field': 'br.CLIENT_SUBGRP_EN', 'description': 'Client subgroup', 'en': 'Client Subgroup', 'fr': 'Sous-groupe du client' },
        'CLIENT_SUBGRP_FR': { 'db_field': 'br.CLIENT_SUBGRP_FR', 'description': 'Sous-groupe client', 'en': 'Client Subgroup', 'fr': 'Sous-client' },
        'GROUP_EN': { 'db_field': 'br.GROUP_EN', 'description': 'Group', 'en': 'Group', 'fr': 'Groupe' },
        'GROUP_FR': { 'db_field': 'br.GROUP_FR', 'description': 'Groupe', 'en': 'Group', 'fr': 'Groupe' },
        'ASSOC_BRS': { 'db_field': 'br.ASSOC_BRS', 'description': 'Associated BRs to the BR.', 'en': 'Associated Business Request(s)', 'fr': 'Demande(s) opérationnelles associée(s)' },
        'ACC_MANAGER_OPI': { 'db_field': 'opis.ACC_MANAGER_OPI', 'description': 'Account Manager OPI.', 'is_user_field': True, 'en': 'Account Manager', 'fr': 'Gestionnaire de compte' },
        'AGR_OPI': { 'db_field': 'opis.AGR_OPI', 'description': 'The Agreement OPI associated with the BR.', 'is_user_field': True, 'en': 'Agreement OPI', 'fr': 'BPR Entente' },
        'BA_OPI': { 'db_field': 'opis.BA_OPI', 'description': 'The EBIDM BA responsible for costing the BR using the ePET.', 'is_user_field': True, 'en': 'BA OPI', 'fr': 'BPR analyste' },
        'BA_PRICING_OPI': { 'db_field': 'opis.BA_PRICING_OPI', 'description': 'The Business Analyst Pricing OPI associated with the Business Request (BR)', 'is_user_field': True, 'en': 'BA Pricing OPI', 'fr': 'BPR AA du prix' },
        'BA_PRICING_TL': { 'db_field': 'opis.BA_PRICING_TL', 'description': 'Service Line Coordinator.', 'is_user_field': True, 'en': 'Service Line Coordinator', 'fr': 'Coordonnateur de la ligne de service' },
        'BA_TL': { 'db_field': 'opis.BA_TL', 'description': 'The Business Analyst Team Lead associated with the BR.', 'is_user_field': True, 'en': 'BA Team Lead', 'fr': 'Chef d`équipe analystes' },
        'CSM_DIRECTOR': { 'db_field': 'opis.CSM_DIRECTOR', 'description': 'The Client Executive associated with the BR.', 'is_user_field': True, 'en': 'Client Executive', 'fr': 'Client exécutif' },
        'EAOPI': { 'db_field': 'opis.EAOPI', 'description': 'EA OPI/BPR AE', 'is_user_field': True, 'en': 'EA OPI', 'fr': 'BPR AE' },
        'PM_OPI': { 'db_field': 'opis.PM_OPI', 'description': 'The PM Coordinator associated with the BR.', 'is_user_field': True, 'en': 'PM/Coordinator', 'fr': 'GP/Coordonnateur' },
        'QA_OPI': { 'db_field': 'opis.QA_OPI', 'description': 'QA OPI.', 'is_user_field': True, 'en': 'QA OPI', 'fr': 'BPR QA' },
        'SDM_TL_OPI': { 'db_field': 'opis.SDM_TL_OPI', 'description': 'The Service Delivery Manager Team Lead for the BR.', 'is_user_field': True, 'en': 'SDM Team Lead', 'fr': 'GPS Chef d\'équipe' },
        'TEAMLEADER': { 'db_field': 'opis.TEAMLEADER', 'description': 'The SDM (Service Delivery Manager) Executive associated with the BR.', 'is_user_field': True, 'en': 'SDM Executive', 'fr': 'Cadre GPS' },
        'WIO_OPI': { 'db_field': 'opis.WIO_OPI', 'description': 'Finance OPI/BRP Finance', 'is_user_field': True, 'en': 'Finance OPI', 'fr': 'BPR du Finance' },
        'GCIT_CAT_EN': { 'db_field': 'br.GCIT_CAT_EN', 'description': 'GCIT Category.', 'en': 'GCIT Category Project or Activity', 'fr': 'Projet ou activité de catégorie GCTI' },
        'GCIT_CAT_FR': { 'db_field': 'br.GCIT_CAT_FR', 'description': 'Catégorie GCIT.', 'en': 'GCIT Category Project or Activity', 'fr': 'Projet ou activité de catégorie GCTI' },
        'GCIT_PRIORITY_EN': { 'db_field': 'br.GCIT_PRIORITY_EN', 'description': 'GCIT Priority.', 'en': 'GCIT Decision Framework Priority', 'fr': 'Priorité du cadre décisionnel GCTI' },
        'GCIT_PRIORITY_FR': { 'db_field': 'br.GCIT_PRIORITY_FR', 'description': 'Priorité GCIT.', 'en': 'GCIT Decision Framework Priority', 'fr': 'Priorité du cadre décisionnel GCTI' },
        'IO_ID': { 'db_field': 'br.IO_ID', 'description': 'The internal order code associated with the BR.', 'en': 'IO ID', 'fr': 'IO ID' },
        'EPS_NMBR': { 'db_field': 'br.EPS_NMBR', 'description': 'The Clarity/EPS project number associated with the BR . Enterprise Portfolio System (EPS) is the tool used by PM to track projects.', 'en': 'EPS #', 'fr': 'EPS #' },
        'ECD_NMBR': { 'db_field': 'br.ECD_NMBR', 'description': 'ECD Number.', 'en': 'ECD #', 'fr': 'ECD #' },
        'PROD_OPI': { 'db_field': 'opis.PROD_OPI', 'description': 'The Service Lead for the BR.', 'is_user_field': True, 'en': 'Service Lead', 'fr': 'BPR des services' },
        'PHASE_EN': { 'db_field': 's.BITS_PHASE_EN', 'description': 'The current phase of the BR. Phase denotes where in the EBIDM process the BR is currently.', 'en': 'Phase', 'fr': 'Phase' },
        'PHASE_FR': { 'db_field': 's.BITS_PHASE_EN', 'description': 'Phase de la BR.', 'en': 'Phase', 'fr': 'Phase' },
    }
    # pylint: enable=line-too-long

    # Combine all search fields
    valid_search_fields = {}
    valid_search_fields.update(base_fields)
    valid_search_fields.update(br_owner)
    valid_search_fields.update(date_fields)

    valid_search_fields_filterable = valid_search_fields.copy()
    valid_search_fields.update(status)
    valid_search_fields.update(active)
