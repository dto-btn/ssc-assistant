import azure.functions as func
import logging
from azure.core.credentials import AzureKeyCredential
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents import SearchClient
from azure.storage.blob import BlobServiceClient
import openai
from dotenv import load_dotenv
import os
from llama_index.vector_stores.cogsearch import (
    IndexManagement,
    CognitiveSearchVectorStore,
)
from langchain.embeddings.azure_openai import AzureOpenAIEmbeddings
from llama_index.llms import AzureOpenAI
from llama_index import (
    Document,
    SimpleDirectoryReader,
    StorageContext,
    ServiceContext,
    VectorStoreIndex,
)
from azure.search.documents.indexes.models import (   
    HnswParameters
)
import json  # bourne
from bs4 import BeautifulSoup

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

# Configure environment variables
load_dotenv()
azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")
api_key                 = os.getenv("AZURE_OPENAI_API_KEY")
api_version             = os.getenv("AZURE_OPENAI_VERSION", "2023-07-01-preview")
service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
index_name              = os.getenv("AZURE_SEARCH_INDEX_NAME")
blob_connection_string  = os.getenv("BLOB_CONNECTION_STRING")
container_name          = os.getenv("BLOB_CONTAINER_NAME")
key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")

credential = AzureKeyCredential(key)
model: str = os.getenv("OPENAI_MODEL", "gpt-4-1106")
embedding_model: str = "text-embedding-ada-002"

#@retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(6))
@app.route(route="build_mysscplus_index")
def build_mysscplus_index(req: func.HttpRequest) -> func.HttpResponse:
    """
    Implementing via this method to get started.
    https://github.com/Azure/azure-search-vector-samples/blob/main/demo-python/code/azure-search-vector-python-llamaindex-sample.ipynb
    https://github.com/Azure/azure-search-vector-samples/blob/main/demo-python/code/azure-search-vector-python-llamaindex-sample.ipynb
    https://docs.llamaindex.ai/en/stable/examples/vector_stores/CognitiveSearchIndexDemo.html
    https://learn.microsoft.com/en-ca/azure/ai-services/openai/how-to/switching-endpoints
    """
    logging.info('Python HTTP trigger function processed a request.')

    name = req.params.get('name')
    if not name:
        try:
            req_body = req.get_json()
        except ValueError:
            pass
        else:
            name = req_body.get('name')

    if name:
        # Create search index
        index_client = SearchIndexClient(
            endpoint=service_endpoint,
            credential=credential,
        )

        # Use search client to demonstration using existing index
        search_client = SearchClient(
            endpoint=service_endpoint,
            index_name=name,
            credential=credential,
        )

        '''
        this is for a poc but this is the sort of data we are building and index for
        [
            {
                "title": "La Semaine de la pr\u00e9vention des incendies a lieu du 3 au 9 octobre",
                "body": "\u003Carticle data-history-node-id=\u0022336\u0022 lang=\u0022fr\u0022 class=\u0022article full clearfix\u0022\u003E\n\n  \n      \u003Ch2\u003E\n      \u003Ca href=\u0022/fr/nouvelles/articles/24-09-2021/semaine-prevention-incendies-lieu-du-3-au-9-octobre\u0022 rel=\u0022bookmark\u0022\u003E\u003Ch1\u003ELa Semaine de la pr\u00e9vention des incendies a lieu du 3 au 9 octobre\u003C/h1\u003E\n\u003C/a\u003E\n    \u003C/h2\u003E\n    \n\n  \n  \u003Cdiv class=\u0022content\u0022\u003E\n    \u003Cdiv class=\u0022mrgn-bttm-xl row bs-1col\u0022\u003E\n  \n  \u003Cdiv class=\u0022col-sm-12 bs-region bs-region--main\u0022\u003E\n    \n\u003Csection data-block-plugin-id=\u0022block_content:9ebeb264-7ece-4ad6-949e-6a9b0b255e97\u0022 class=\u0022block block-block-content block-block-content9ebeb264-7ece-4ad6-949e-6a9b0b255e97 clearfix\u0022\u003E\n    \n    \n\n      \n  \u003Cdiv class=\u0022header-region container-full-width\u0022\u003E\n\n    \u003Cdiv class=\u0022container\u0022\u003E\n\n      \u003Cdiv  class=\u0022header-banner\u0022 id=\u0022header-banner\u0022\u003E\n                \u003Cdiv class=\u0022overlay\u0022\u003E\n          \n                  \u003C/div\u003E\n\n                      \u003C/div\u003E\n\n            \n    \u003C/div\u003E\n\n  \u003C/div\u003E\n\n    \u003C/section\u003E\n\n\u003Csection data-block-plugin-id=\u0022extra_field_block:node:article:content_moderation_control\u0022 class=\u0022toc-ignore block block-layout-builder block-extra-field-blocknodearticlecontent-moderation-control clearfix\u0022\u003E\n    \n    \n\n      \n    \u003C/section\u003E\n\n  \u003C/div\u003E\n\u003C/div\u003E\n\n  \u003Cdiv  class=\u0022layout layout--conditional-sidebar section-main row padding-top-0 no-padding-x\u0022\u003E\n\n          \u003Cdiv  class=\u0022layout__region layout__region--main layout__region-main width-limiter col-md-12\u0022\u003E\n        \n\u003Csection data-block-plugin-id=\u0022field_block:node:article:body\u0022 class=\u0022block block-layout-builder block-field-blocknodearticlebody clearfix\u0022\u003E\n    \n    \n\n      \n\n            \u003Cdiv class=\u0022field field--name-body field--type-text-with-summary field--label-hidden field--item\u0022\u003E\u003Cp\u003EDans le cadre de la Semaine de la pr\u00e9vention des incendies, nous pouvons prendre d\u2019importantes mesures pour am\u00e9liorer la s\u00e9curit\u00e9 et la s\u00fbret\u00e9 au travail \u00e0 Services partag\u00e9s Canada (SPC).\u003C/p\u003E\n\n\u003Ch2\u003EEmploy\u00e9s\u003C/h2\u003E\n\n\u003Cul\u003E\u003Cli\u003EAssurez-vous que votre superviseur poss\u00e8de vos coordonn\u00e9es principales afin qu\u2019il puisse vous joindre en cas de situations d\u2019urgence, comme une interruption des activit\u00e9s courantes ou la fermeture prolong\u00e9e d\u2019un immeuble.\u003C/li\u003E\n\t\u003Cli\u003EPrenez connaissance des proc\u00e9dures \u00e0 suivre en ce qui a trait \u00e0 une vaste gamme de situations d\u2019urgence et prenez le temps de vous familiariser avec le\u00a0\u003Ca href=\u0022https://myssc-monspc.ssc-spc.gc.ca/fr/coin-gestionnaires/surete-securite/preparatifs-urgence/guide-sur-les-situations-durgence\u0022\u003EGuide sur les situations d\u2019urgence\u003C/a\u003E\u00a0de SPC.\u003C/li\u003E\n\u003C/ul\u003E\u003Ch2\u003ESuperviseurs\u003C/h2\u003E\n\n\u003Cul\u003E\u003Cli\u003ETenez \u00e0 jour une liste des coordonn\u00e9es d\u2019urgence des membres de votre \u00e9quipe.\u003C/li\u003E\n\t\u003Cli\u003ERappelez aux membres de votre \u00e9quipe les lieux de rassemblement d\u2019urgence et faites un exercice d\u2019\u00e9vacuation lors d\u2019une r\u00e9union d\u2019\u00e9quipe.\u003C/li\u003E\n\t\u003Cli\u003ERappelez aux membres de votre \u00e9quipe les ressources offertes aux personnes qui ont besoin d\u2019aide pendant une \u00e9vacuation.\u003C/li\u003E\n\u003C/ul\u003E\u003Cp\u003EPour obtenir des conseils, consultez le\u00a0\u003Ca href=\u0022https://myssc-monspc.ssc-spc.gc.ca/fr/coin-gestionnaires/surete-securite/preparatifs-urgence/guide-sur-les-situations-durgence\u0022\u003EGuide sur les situations d\u2019urgence\u003C/a\u003E, ou encore le site\u00a0\u003Ca href=\u0022https://www.preparez-vous.gc.ca/index-fr.aspx\u0022\u003EPr\u00e9parez-vous\u003C/a\u003E\u00a0de S\u00e9curit\u00e9 publique Canada.\u003C/p\u003E\n\n\u003Cp\u003EPour en apprendre davantage sur le programme de s\u00e9curit\u00e9 incendie de SPC, veuillez communiquer avec l\u2019\u003Ca href=\u0022mailto:securityembcp-securitegupca@ssc-spc.gc.ca\u0022\u003E\u00e9quipe de gestion des urgences de SPC\u003C/a\u003E.\u003C/p\u003E\u003C/div\u003E\n      \n    \u003C/section\u003E\n\n      \u003C/div\u003E\n    \n    \n  \u003C/div\u003E\n\u003Cdiv class=\u0022row bs-1col\u0022\u003E\n  \n  \u003Cdiv class=\u0022col-sm-12 bs-region bs-region--main\u0022\u003E\n    \n\u003Csection class=\u0022block block-block-content block-block-contentf9700e41-3812-46a3-8586-d0d84ee47ccf clearfix\u0022 data-block-plugin-id=\u0022block_content:f9700e41-3812-46a3-8586-d0d84ee47ccf\u0022\u003E\n    \n    \n\n      \u003Cdiv class=\u0022row bs-1col\u0022\u003E\n  \n  \u003Cdiv class=\u0022content-footer col-sm-12 bs-region bs-region--main\u0022\u003E\n    \n\u003Csection class=\u0022block block-wxt-library block-date-modified-block clearfix\u0022 data-block-plugin-id=\u0022date_modified_block\u0022\u003E\n    \n    \n\n      \u003Cdl id=\u0022wb-dtmd\u0022\u003E\n\u003Cdt\u003EDate modified:\u003C/dt\u003E\n\u003Cdd\u003E\u003Ctime property=\u0022dateModified\u0022\u003E2023-10-17\u003C/time\u003E\u003C/dd\u003E\u003C/dl\u003E\n    \u003C/section\u003E\n\n  \u003C/div\u003E\n\u003C/div\u003E\n\n    \u003C/section\u003E\n\n  \u003C/div\u003E\n\u003C/div\u003E\n\u003Cdiv class=\u0022bg--gray-1 container-full-width row bs-1col\u0022\u003E\n  \n  \u003Cdiv class=\u0022container-full-width col-sm-12 bs-region bs-region--main\u0022\u003E\n    \n  \u003C/div\u003E\n\u003C/div\u003E\n\u003Cdiv class=\u0022container-full-width bg--purple-light bg--section row bs-1col\u0022\u003E\n  \n  \u003Cdiv class=\u0022col-sm-12 bs-region bs-region--main\u0022\u003E\n    \n\u003Csection data-block-plugin-id=\u0022field_block:node:article:comment\u0022 class=\u0022block block-layout-builder block-field-blocknodearticlecomment clearfix\u0022\u003E\n    \n    \n\n      \u003Csection\u003E\n  \u003Cdiv class=\u0022container\u0022\u003E\n  \n  \u003Cdiv class=\u0022comment-login-message\u0022\u003E\u003Cp class=\u0022mrgn-bttm-0\u0022\u003E\u003Cstrong\u003EHey there, it looks like you\u0027re not logged in!\u003C/strong\u003E\u003C/p\u003E\r\n\r\n\u003Cp\u003EIf you want to leave a comment on this page, you will need to log in.\u003C/p\u003E\r\n\u003Ca href=\u0022/en/user/login?destination=/en/rest/page-by-id/336\u0022 class=\u0022btn btn-primary\u0022 role=\u0022button\u0022\u003ELogin\u003C/a\u003E\u003C/div\u003E\n\n  \n\u003C/div\u003E\n\u003C/section\u003E\n\n\n    \u003C/section\u003E\n\n  \u003C/div\u003E\n\u003C/div\u003E\n\n  \u003C/div\u003E\n\n\u003C/article\u003E\n",
                "langcode": "fr",
                "nid": "336",
                "date": "\u003Ctime datetime=\u00222021-09-24T12:00:00Z\u0022\u003E2021-09-24\u003C/time\u003E\n",
                "type": "article",
                "url": "https://plus-test.ssc-spc.gc.ca/fr/nouvelles/articles/24-09-2021/semaine-prevention-incendies-lieu-du-3-au-9-octobre"
            },
            {
                "title": "October 3 to 9 is Fire Prevention Week",
                "body": "\u003Carticle data-history-node-id=\u0022336\u0022 class=\u0022article full clearfix\u0022\u003E\n\n  \n      \u003Ch2\u003E\n      \u003Ca href=\u0022/en/news/articles/24-09-2021/october-3-9-fire-prevention-week\u0022 rel=\u0022bookmark\u0022\u003E\u003Ch1\u003EOctober 3 to 9 is Fire Prevention Week\u003C/h1\u003E\n\u003C/a\u003E\n    \u003C/h2\u003E\n    \n\n  \n  \u003Cdiv class=\u0022content\u0022\u003E\n    \u003Cdiv class=\u0022mrgn-bttm-xl row bs-1col\u0022\u003E\n  \n  \u003Cdiv class=\u0022col-sm-12 bs-region bs-region--main\u0022\u003E\n    \n\u003Csection data-block-plugin-id=\u0022block_content:9ebeb264-7ece-4ad6-949e-6a9b0b255e97\u0022 class=\u0022block block-block-content block-block-content9ebeb264-7ece-4ad6-949e-6a9b0b255e97 clearfix\u0022\u003E\n    \n    \n\n      \n  \u003Cdiv class=\u0022header-region container-full-width\u0022\u003E\n\n    \u003Cdiv class=\u0022container\u0022\u003E\n\n      \u003Cdiv  class=\u0022header-banner\u0022 id=\u0022header-banner\u0022\u003E\n                \u003Cdiv class=\u0022overlay\u0022\u003E\n          \n                  \u003C/div\u003E\n\n                      \u003C/div\u003E\n\n            \n    \u003C/div\u003E\n\n  \u003C/div\u003E\n\n    \u003C/section\u003E\n\n\u003Csection data-block-plugin-id=\u0022extra_field_block:node:article:content_moderation_control\u0022 class=\u0022toc-ignore block block-layout-builder block-extra-field-blocknodearticlecontent-moderation-control clearfix\u0022\u003E\n    \n    \n\n      \n    \u003C/section\u003E\n\n  \u003C/div\u003E\n\u003C/div\u003E\n\n  \u003Cdiv  class=\u0022layout layout--conditional-sidebar section-main row padding-top-0 no-padding-x\u0022\u003E\n\n          \u003Cdiv  class=\u0022layout__region layout__region--main layout__region-main width-limiter col-md-12\u0022\u003E\n        \n\u003Csection data-block-plugin-id=\u0022field_block:node:article:body\u0022 class=\u0022block block-layout-builder block-field-blocknodearticlebody clearfix\u0022\u003E\n    \n    \n\n      \n\n            \u003Cdiv class=\u0022field field--name-body field--type-text-with-summary field--label-hidden field--item\u0022\u003E\u003Cp\u003EAs part of Fire Prevention Week, there are important things we can do to make SSC a safer and more secure place to work.\u003C/p\u003E\n\n\u003Ch2\u003EAs an employee\u003C/h2\u003E\n\n\u003Cul\u003E\u003Cli\u003EMake sure your supervisor has your key contact information to reach you in an emergency, such as a disruption to regular business or an extended building closure.\u003C/li\u003E\n\t\u003Cli\u003EFamiliarize yourself with the procedures to follow for a range of emergencies and take the time to review SSC\u2019s\u00a0\u003Ca href=\u0022https://myssc-monspc.ssc-spc.gc.ca/en/managers-corner/safety-security/emergency-preparedness/guide-on-emergency-situations\u0022\u003EEmergency preparedness guide\u003C/a\u003E.\u003C/li\u003E\n\u003C/ul\u003E\u003Ch2\u003EAs a supervisor\u003C/h2\u003E\n\n\u003Cul\u003E\u003Cli\u003EMaintain a list of your employees emergency contact information.\u003C/li\u003E\n\t\u003Cli\u003ERemind your team members about their emergency meeting locations; practice an evacuation at a team meeting.\u003C/li\u003E\n\t\u003Cli\u003EInform your team members of the resources available to anyone who requires assistance during an evacuation.\u003C/li\u003E\n\u003C/ul\u003E\u003Cp\u003EFor tips to always keep in mind, check out our\u00a0\u003Ca href=\u0022https://myssc-monspc.ssc-spc.gc.ca/en/managers-corner/safety-security/emergency-preparedness/guide-on-emergency-situations\u0022\u003EGuide on emergency situations\u003C/a\u003E\u00a0page, as well as Public Safety Canada\u2019s\u00a0\u003Ca href=\u0022https://www.getprepared.gc.ca/index-eng.aspx\u0022\u003EGetPrepared\u003C/a\u003E\u00a0site.\u003C/p\u003E\n\n\u003Cp\u003ETo learn more about the SSC Fire Safety Program, please contact the SSC\u00a0\u003Ca href=\u0022mailto:securityembcp-securitegupca@ssc-spc.gc.ca\u0022\u003EEmergency Management Team\u003C/a\u003E.\u003C/p\u003E\u003C/div\u003E\n      \n    \u003C/section\u003E\n\n      \u003C/div\u003E\n    \n    \n  \u003C/div\u003E\n\u003Cdiv class=\u0022row bs-1col\u0022\u003E\n  \n  \u003Cdiv class=\u0022col-sm-12 bs-region bs-region--main\u0022\u003E\n    \n\u003Csection class=\u0022block block-block-content block-block-contentf9700e41-3812-46a3-8586-d0d84ee47ccf clearfix\u0022 data-block-plugin-id=\u0022block_content:f9700e41-3812-46a3-8586-d0d84ee47ccf\u0022\u003E\n    \n    \n\n      \u003Cdiv class=\u0022row bs-1col\u0022\u003E\n  \n  \u003Cdiv class=\u0022content-footer col-sm-12 bs-region bs-region--main\u0022\u003E\n    \n\u003Csection class=\u0022block block-wxt-library block-date-modified-block clearfix\u0022 data-block-plugin-id=\u0022date_modified_block\u0022\u003E\n    \n    \n\n      \u003Cdl id=\u0022wb-dtmd\u0022\u003E\n\u003Cdt\u003EDate modified:\u003C/dt\u003E\n\u003Cdd\u003E\u003Ctime property=\u0022dateModified\u0022\u003E2023-10-17\u003C/time\u003E\u003C/dd\u003E\u003C/dl\u003E\n    \u003C/section\u003E\n\n  \u003C/div\u003E\n\u003C/div\u003E\n\n    \u003C/section\u003E\n\n  \u003C/div\u003E\n\u003C/div\u003E\n\u003Cdiv class=\u0022bg--gray-1 container-full-width row bs-1col\u0022\u003E\n  \n  \u003Cdiv class=\u0022container-full-width col-sm-12 bs-region bs-region--main\u0022\u003E\n    \n  \u003C/div\u003E\n\u003C/div\u003E\n\u003Cdiv class=\u0022container-full-width bg--purple-light bg--section row bs-1col\u0022\u003E\n  \n  \u003Cdiv class=\u0022col-sm-12 bs-region bs-region--main\u0022\u003E\n    \n\u003Csection data-block-plugin-id=\u0022field_block:node:article:comment\u0022 class=\u0022block block-layout-builder block-field-blocknodearticlecomment clearfix\u0022\u003E\n    \n    \n\n      \u003Csection\u003E\n  \u003Cdiv class=\u0022container\u0022\u003E\n  \n  \u003Cdiv class=\u0022comment-login-message\u0022\u003E\u003Cp class=\u0022mrgn-bttm-0\u0022\u003E\u003Cstrong\u003EHey there, it looks like you\u0027re not logged in!\u003C/strong\u003E\u003C/p\u003E\r\n\r\n\u003Cp\u003EIf you want to leave a comment on this page, you will need to log in.\u003C/p\u003E\r\n\u003Ca href=\u0022/en/user/login?destination=/en/rest/page-by-id/336\u0022 class=\u0022btn btn-primary\u0022 role=\u0022button\u0022\u003ELogin\u003C/a\u003E\u003C/div\u003E\n\n  \n\u003C/div\u003E\n\u003C/section\u003E\n\n\n    \u003C/section\u003E\n\n  \u003C/div\u003E\n\u003C/div\u003E\n\n  \u003C/div\u003E\n\n\u003C/article\u003E\n",
                "langcode": "en",
                "nid": "336",
                "date": "\u003Ctime datetime=\u00222021-09-24T12:00:00Z\u0022\u003E2021-09-24\u003C/time\u003E\n",
                "type": "article",
                "url": "https://plus-test.ssc-spc.gc.ca/en/news/articles/24-09-2021/october-3-9-fire-prevention-week"
            }
        ]
        '''
        metadata_fields = { "title" : "title",
                            "langcode" : "langcode",
                            "nid" : "nid",
                            "date" : "date",
                            "type" : "type",
                            "url" : "url",
                        }

        vector_store = CognitiveSearchVectorStore(
            search_or_index_client=index_client,
            index_name=name,
            filterable_metadata_field_keys=metadata_fields,
            index_management=IndexManagement.CREATE_IF_NOT_EXISTS,
            id_field_key="id",
            chunk_field_key="content",
            embedding_field_key="content_vector",
            metadata_string_field_key="metadata",
            doc_id_field_key="doc_id",
        )

        # TODO: remove hardcoding here, 
        # this is just for a test of loading the data in the index and see if it yeilds good results
        pages = _get_pages_as_json("preload", "testload")
        documents = []
        for page in pages:
            # https://gpt-index.readthedocs.io/en/v0.6.34/how_to/customization/custom_documents.html
            document = Document(
                text=str(page["body"]).replace("\n", " "),
                metadata={ # type: ignore
                    'filename': page["filename"],
                    'url': page["url"],
                    'title': page["title"],
                    'date': page["date"],
                    'nid': page['nid'],
                    'langcode': page['langcode']
                }
            )
            documents.append(document)

        llm = AzureOpenAI(
            model="gpt-4",
            azure_deployment=model,
            api_version=api_version,
            azure_endpoint=azure_openai_uri,
            api_key=api_key
        )

        embed_model = AzureOpenAIEmbeddings(
            model=embedding_model, api_key=api_key, azure_endpoint=azure_openai_uri)

        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        service_context = ServiceContext.from_defaults(llm=llm, embed_model=embed_model)

        index = VectorStoreIndex.from_documents(
            documents, storage_context=storage_context, service_context=service_context
        )

        query_engine = index.as_query_engine()
        response = query_engine.query("SPC Onyx")

        # hybrid_retriever = index.as_retriever(
        #     vector_store_query_mode=VectorStoreQueryMode.SEMANTIC_HYBRID
        # )
        # hybrid_retriever.retrieve("What is inception about?")

        return func.HttpResponse(f"Creating index: {name}. RESP: {response}, METADATA: {response.metadata}")
    else:
        return func.HttpResponse(
             "Missing index name, pass the index name in the body of the request",
             status_code=200
        )
    
def _get_pages_as_json(dir: str, date: str) -> list:
    """
    Loads json file that were pulled from the SSCplusDatafetch function app
    it will load them inside a dictionary that we will use to create documents for indexing in azure cognitive search
    """
    pages = []
    blob_service_client = BlobServiceClient.from_connection_string(blob_connection_string)
    container_client = blob_service_client.get_container_client("sscplusdata")
    blobs = container_client.list_blobs(dir + "/" + date + "/")

    ignore_selectors = ['div.comment-login-message', 'section.block-date-modified-block']

    for blob in blobs:
        blob_client = container_client.get_blob_client(blob) # type: ignore
        # Download the blob data and decode it to string
        data = blob_client.download_blob().readall().decode('utf-8')
        if data is not None:
            raw = json.loads(data)
            if isinstance(raw, list) and raw:
                raw = raw[0] # sometimes the object is boxed into an array, not useful to us
            if isinstance(raw, dict):
                page = {}
                soup = BeautifulSoup(raw["body"], "html.parser")
                # remove useless tags like date modified and login blocks (see example in 336 parsed data vs non parsed)
                for selector in ignore_selectors:
                     for s in soup.select(selector):
                         s.decompose()

                page["body"] = ' '.join(soup.stripped_strings)
                page["title"] = str(raw["title"]).strip()
                page["url"] = str(raw["url"]).strip()
                page["date"] = str(raw["date"]).strip()
                page["filename"] = blob_client.blob_name
                page["nid"] = str(raw['nid']).strip()
                page["langcode"] = str(raw['langcode']).strip()

                pages.append(page)
    return pages
