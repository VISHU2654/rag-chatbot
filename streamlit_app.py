import streamlit as st
import os
import sys
import uuid
import time
from dotenv import load_dotenv

# Add backend to sys path so we can import the services
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env"))

# Import services
try:
    from services.llm_service import get_llm
    from services.rag_service import retrieve
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain.agents import create_tool_calling_agent, AgentExecutor
    from langchain_core.tools import tool
    import tempfile
except ImportError as e:
    st.error(f"Failed to import backend services: {e}")
    st.stop()

def process_document(file_path: str, filename: str, user_id: int | None = None) -> dict:
    """Load, split, and add document chunks to the vector store."""
    try:
        from services.loader_service import load_document, split_documents
        from services.rag_service import add_documents
        from config import config
        from pathlib import Path
        
        suffix = Path(filename).suffix.lower()
        docs = load_document(file_path, suffix)
        for d in docs:
            d.metadata["source"] = filename
            
        chunks = split_documents(docs, config.CHUNK_SIZE, config.CHUNK_OVERLAP)
        add_documents(chunks, user_id=user_id)
        return {"message": "Success"}
    except Exception as e:
        return {"error": str(e)}

# --- Tools ---
@tool
def calculate(expression: str) -> str:
    """Evaluate a mathematical expression. Use this for math questions."""
    try:
        import numexpr
        return str(numexpr.evaluate(expression))
    except Exception as e:
        return f"Error evaluating expression: {e}"

@tool
def search_web(query: str) -> str:
    """Search the web for current events, facts, and general knowledge not found in the documents."""
    try:
        from duckduckgo_search import DDGS
        results = DDGS().text(query, max_results=3)
        if not results:
            return "No web results found."
        return "\n\n".join([f"[{r['title']}]({r['href']}): {r['body']}" for r in results])
    except Exception as e:
        return f"Web search error: {e}"


# --- Page Config ---
st.set_page_config(page_title="NexusAI Streamlit", page_icon="🤖", layout="wide")

# --- Session State ---
if "messages" not in st.session_state:
    st.session_state.messages = []
if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())
if "sources" not in st.session_state:
    st.session_state.sources = set()

# --- Sidebar ---
with st.sidebar:
    st.title("⚙️ Configuration")
    
    # We allow the user to provide their own Groq API key if they are running on Streamlit Cloud
    groq_api_key = st.text_input("Groq API Key (optional if deployed)", type="password")
    if groq_api_key:
        os.environ["GROQ_API_KEY"] = groq_api_key
        
    st.divider()
    
    available_providers = ["groq", "openai", "xai"]
    selected_model = st.selectbox("LLM Provider", available_providers, index=0)
    
    use_hybrid = st.checkbox("Enable Hybrid Search", value=False)
    use_reranker = st.checkbox("Enable Re-ranker", value=False)
    rag_k = st.slider("Retrieval K (Top Docs)", min_value=1, max_value=10, value=4)
    
    st.divider()
    st.title("📂 Document Upload")
    
    uploaded_file = st.file_uploader("Upload a file (PDF, TXT, DOCX, CSV)", type=["pdf", "txt", "docx", "csv", "xlsx", "md"])
    if uploaded_file is not None:
        if st.button("Ingest Document"):
            with st.spinner("Processing..."):
                try:
                    # Save uploaded file to a temporary file
                    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{uploaded_file.name.split('.')[-1]}") as tmp:
                        tmp.write(uploaded_file.getvalue())
                        tmp_path = tmp.name
                    
                    # Process it using backend service
                    result = process_document(tmp_path, uploaded_file.name, user_id=None)
                    
                    # Clean up
                    os.unlink(tmp_path)
                    
                    if "error" in result:
                        st.error(f"Error: {result['error']}")
                    else:
                        st.success(f"Successfully ingested {uploaded_file.name}")
                except Exception as e:
                    st.error(f"Ingestion error: {e}")
                    
    st.divider()
    if st.button("Clear Conversation"):
        st.session_state.session_id = str(uuid.uuid4())
        st.session_state.messages = []
        st.session_state.sources = set()
        st.rerun()


# --- Main UI ---
st.title("NexusAI - Document Assistant")
st.markdown("Ask anything about your documents, or just chat with the AI!")

# Display chat messages from history
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if message.get("sources"):
            with st.expander("View Sources"):
                for src in message["sources"]:
                    st.write(f"- {src}")

# Handle Chat Input
if prompt := st.chat_input("Ask a question..."):
    # Display user message
    st.chat_message("user").markdown(prompt)
    st.session_state.messages.append({"role": "user", "content": prompt})

    # Assistant Response Container
    with st.chat_message("assistant"):
        response_placeholder = st.empty()
        
        # 1. Setup Custom Document Retrieval Tool
        sources_used = []
        chunks_used = []
        
        @tool
        def search_documents(query: str) -> str:
            """Search the user's uploaded documents. Always use this tool if the user asks about their files, documents, or knowledge base."""
            retrieved = retrieve(
                query=query,
                k=rag_k,
                use_hybrid=use_hybrid,
                use_reranker=use_reranker,
                user_id=None,
            )
            if not retrieved:
                return "No relevant documents found."
            
            for d in retrieved:
                if d["source"] not in sources_used:
                    sources_used.append(d["source"])
                chunks_used.append({"content": d["content"][:200], "source": d["source"], "score": d.get("score", 0)})
                
            return "\n\n".join([f"[Source: {d['source']}]\n{d['content']}" for d in retrieved])

        # 2. Setup Agent
        try:
            llm = get_llm(provider=selected_model, streaming=True)
            tools = [calculate, search_web, search_documents]
            
            agent_prompt = ChatPromptTemplate.from_messages([
                ("system", "You are NexusAI, a powerful AI assistant. Answer the user's question. "
                           "You have access to tools for Math, Web Search, and Document Search. "
                           "Only call these tools if absolutely necessary. DO NOT hallucinate tools."),
                # Simplified history for Streamlit (just passing messages directly)
                ("placeholder", "{chat_history}"),
                ("user", "{input}"),
                ("placeholder", "{agent_scratchpad}"),
            ])
            
            agent = create_tool_calling_agent(llm, tools, agent_prompt)
            agent_executor = AgentExecutor(
                agent=agent, 
                tools=tools, 
                verbose=True, 
                handle_parsing_errors=True,
                max_iterations=5
            )
            
            # Format chat history for LangChain
            formatted_history = []
            for msg in st.session_state.messages[:-1]: # exclude the latest prompt
                from langchain.schema import HumanMessage, AIMessage
                if msg["role"] == "user":
                    formatted_history.append(HumanMessage(content=msg["content"]))
                else:
                    formatted_history.append(AIMessage(content=msg["content"]))

            # 3. Stream output
            def stream_agent():
                full_reply = ""
                try:
                    for chunk in agent_executor.stream({
                        "input": prompt,
                        "chat_history": formatted_history,
                    }):
                        if "actions" in chunk:
                            for action in chunk["actions"]:
                                yield f"\n*(Using tool: {action.tool}...)*\n\n"
                        elif "output" in chunk:
                            text = chunk["output"]
                            # Streamlit expects chunks to be yielded
                            # We'll just yield the whole block, Streamlit writes it immediately
                            full_reply = text
                            yield text
                            
                    st.session_state.messages.append({"role": "assistant", "content": full_reply, "sources": sources_used})
                except Exception as e:
                    yield f"Error: {str(e)}"
                    st.session_state.messages.append({"role": "assistant", "content": f"Error: {str(e)}", "sources": []})

            # Stream via write_stream
            response_placeholder.write_stream(stream_agent())
            
            if sources_used:
                with st.expander("View Sources"):
                    for src in sources_used:
                        st.write(f"- {src}")

        except Exception as e:
            st.error(f"Failed to process query: {e}")
