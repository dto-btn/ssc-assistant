from flask import Blueprint

api = Blueprint("api", __name__)

@api.route('/query')
def query():
    #  llm = AzureOpenAI(
    #         model="gpt-4",
    #         azure_deployment=model,
    #         api_version=api_version,
    #         azure_endpoint=azure_openai_uri,
    #         api_key=api_key
    #     )

    #     embed_model = AzureOpenAIEmbeddings(
    #         model=embedding_model, api_key=api_key, azure_endpoint=azure_openai_uri)

    #     storage_context = StorageContext.from_defaults(vector_store=vector_store)
    #     service_context = ServiceContext.from_defaults(llm=llm, embed_model=embed_model)

    #     index = VectorStoreIndex.from_documents(
    #         documents, storage_context=storage_context, service_context=service_context
    #     )

    #     query_engine = index.as_query_engine()
    #     response = query_engine.query("SPC Onyx")

        # hybrid_retriever = index.as_retriever(
        #     vector_store_query_mode=VectorStoreQueryMode.SEMANTIC_HYBRID
        # )
        # hybrid_retriever.retrieve("What is inception about?")
    return "this is the query placeholder"