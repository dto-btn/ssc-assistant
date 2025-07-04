export const transformToBusinessRequest = (data: any): BusinessRequest => {
  return {
    LEAD_PRODUCT_EN: data.LEAD_PRODUCT_EN,
    LEAD_PRODUCT_FR: data.LEAD_PRODUCT_FR,
    PRODUCTS_EN: data.PRODUCTS_EN,
    PRODUCTS_FR: data.PRODUCTS_FR,
    BR_NMBR: data.BR_NMBR,
    BR_SHORT_TITLE: data.BR_SHORT_TITLE,
    RPT_GC_ORG_NAME_EN: data.RPT_GC_ORG_NAME_EN,
    RPT_GC_ORG_NAME_FR: data.RPT_GC_ORG_NAME_FR,
    ORG_TYPE_EN: data.ORG_TYPE_EN,
    ORG_TYPE_FR: data.ORG_TYPE_FR,
    REQST_IMPL_DATE: data.REQST_IMPL_DATE,
    BR_TYPE_EN: data.BR_TYPE_EN,
    BR_TYPE_FR: data.BR_TYPE_FR,
    PRIORITY_EN: data.PRIORITY_EN,
    PRIORITY_FR: data.PRIORITY_FR,
    SUBMIT_DATE: data.SUBMIT_DATE,
    RVSD_TARGET_IMPL_DATE: data.RVSD_TARGET_IMPL_DATE,
    CPLX_EN: data.CPLX_EN,
    CPLX_FR: data.CPLX_FR,
    ACTUAL_IMPL_DATE: data.ACTUAL_IMPL_DATE,
    AGRMT_END_DATE: data.AGRMT_END_DATE,
    SCOPE_EN: data.SCOPE_EN,
    SCOPE_FR: data.SCOPE_FR,
    CLIENT_SUBGRP_EN: data.CLIENT_SUBGRP_EN,
    CLIENT_SUBGRP_FR: data.CLIENT_SUBGRP_FR,
    GROUP_EN: data.GROUP_EN,
    GROUP_FR: data.GROUP_FR,
    BR_ACTIVE_EN: data.BR_ACTIVE_EN,
    BR_ACTIVE_FR: data.BR_ACTIVE_FR,
    BITS_STATUS_EN: data.BITS_STATUS_EN,
    BITS_STATUS_FR: data.BITS_STATUS_FR,
    ASSOC_BRS: data.ASSOC_BRS,
    ACC_MANAGER_OPI: data.ACC_MANAGER_OPI,
    AGR_OPI: data.AGR_OPI,
    BA_OPI: data.BA_OPI,
    BA_PRICING_OPI: data.BA_PRICING_OPI,
    BA_PRICING_TL: data.BA_PRICING_TL,
    BA_TL: data.BA_TL,
    CSM_DIRECTOR: data.CSM_DIRECTOR,
    EAOPI: data.EAOPI,
    PM_OPI: data.PM_OPI,
    QA_OPI: data.QA_OPI,
    SDM_TL_OPI: data.SDM_TL_OPI,
    BR_OWNER: data.BR_OWNER,
    TEAMLEADER: data.TEAMLEADER,
    WIO_OPI: data.WIO_OPI,
    GCIT_CAT_EN: data.GCIT_CAT_EN,
    GCIT_CAT_FR: data.GCIT_CAT_FR,
    GCIT_PRIORITY_EN: data.GCIT_PRIORITY_EN,
    GCIT_PRIORITY_FR: data.GCIT_PRIORITY_FR,
    TARGET_IMPL_DATE: data.TARGET_IMPL_DATE,
    IO_ID: data.IO_ID,
    EPS_NMBR: data.EPS_NMBR,
    ECD_NMBR: data.ECD_NMBR,
    PROD_OPI: data.PROD_OPI,
    PHASE_EN: data.PHASE_EN,
    PHASE_FR: data.PHASE_FR,
    SOLN_OPI: data.SOLN_OPI,
  };
};