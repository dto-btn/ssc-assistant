export const transformToBusinessRequest = (data: any) => {
  return {
    BR_NMBR: data.BR_NMBR,
    BR_TITLE: data.BR_TITLE,
    BR_SHORT_TITLE: data.BR_SHORT_TITLE,
    PRIORITY_EN: data.PRIORITY_EN,
    PRIORITY_FR: data.PRIORITY_FR,
    CLIENT_NAME_SRC: data.CLIENT_NAME_SRC,
    RPT_GC_ORG_NAME_EN: data.RPT_GC_ORG_NAME_EN,
    RPT_GC_ORG_NAME_FR: data.RPT_GC_ORG_NAME_FR,
    ORG_TYPE_EN: data.ORG_TYPE_EN,
    ORG_TYPE_FR: data.ORG_TYPE_FR,
    CLIENT_SUBGRP_ID: data.CLIENT_SUBGRP_ID,
    CLIENT_SUBGRP_EN: data.CLIENT_SUBGRP_EN,
    CLIENT_SUBGRP_FR: data.CLIENT_SUBGRP_FR,
    CREATE_DATE: data.CREATE_DATE,
    SUBMIT_DATE: data.SUBMIT_DATE,
    DAYS_SINCE_SUBMIT: data.DAYS_SINCE_SUBMIT,
    REQST_IMPL_DATE: data.REQST_IMPL_DATE,
    TARGET_IMPL_DATE: data.TARGET_IMPL_DATE,
    RVSD_TARGET_IMPL_DATE: data.RVSD_TARGET_IMPL_DATE,
    ACTUAL_IMPL_DATE: data.ACTUAL_IMPL_DATE,
    DAYS_TO_IMPL: data.DAYS_TO_IMPL,
    CANCEL_REASON_EN: data.CANCEL_REASON_EN,
    CANCEL_REASON_FR: data.CANCEL_REASON_FR,
    HOLD_REASON_EN: data.HOLD_REASON_EN,
    HOLD_REASON_FR: data.HOLD_REASON_FR,
    GROUP_ID: data.GROUP_ID,
    GROUP_EN: data.GROUP_EN,
    GROUP_FR: data.GROUP_FR,
    REGION_ACRN_EN: data.REGION_ACRN_EN,
    REGION_ACRN_FR: data.REGION_ACRN_FR,
    REGION_EN: data.REGION_EN,
    REGION_FR: data.REGION_FR,
    BR_TYPE_EN: data.BR_TYPE_EN,
    BR_TYPE_FR: data.BR_TYPE_FR,
    FUNDING_TYPE_EN: data.FUNDING_TYPE_EN,
    FUNDING_TYPE_FR: data.FUNDING_TYPE_FR,
    CPLX_EN: data.CPLX_EN,
    CPLX_FR: data.CPLX_FR,
    SCOPE_EN: data.SCOPE_EN,
    SCOPE_FR: data.SCOPE_FR,
    BR_OWNER: data.BR_OWNER,
    BR_INITR: data.BR_INITR,
    BR_LAST_EDITOR: data.BR_LAST_EDITOR,
    CSM_OPI: data.CSM_OPI,
    TL_OPI: data.TL_OPI,
    CSM_DIRTR: data.CSM_DIRTR,
    SOL_OPI: data.SOL_OPI,
    ENGN_OPI: data.ENGN_OPI,
    BA_OPI: data.BA_OPI,
    BA_TL: data.BA_TL,
    PM_OPI: data.PM_OPI,
    BA_PRICE_OPI: data.BA_PRICE_OPI,
    QA_OPI: data.QA_OPI,
    SL_COORD: data.SL_COORD,
    AGRMT_OPI: data.AGRMT_OPI,
    ACCT_MGR_OPI: data.ACCT_MGR_OPI,
    SDM_TL_OPI: data.SDM_TL_OPI,
    REQMT_OVRVW: data.REQMT_OVRVW,
    ASSOC_BRS: data.ASSOC_BRS,
  };
};