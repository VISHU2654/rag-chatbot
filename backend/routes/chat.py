"""
Chat route with Agentic capabilities, memory, and streaming support.
"""

import json
import uuid
from flask import Blueprint, request, jsonify, Response

from services.llm_service import get_llm
from services.rag_service import retrieve
from services.memory_service import get_session_history, save_user_message, save_assistant_message
from langchain.schema import HumanMessage, SystemMessage, AIMessage
from langchain_core.tools import tool
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from routes.auth import require_auth
from flask import g

chat_bp = Blueprint("chat", __name__)

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

@chat_bp.route("/chat", methods=["POST", "OPTIONS"])
@require_auth
def chat():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.get_json()
    if not data or "message" not in data:
        return jsonify({"error": "Please provide a 'message' field."}), 400

    user_message = data["message"].strip()
    if not user_message:
        return jsonify({"reply": "Please ask a question!"})

    session_id = data.get("session_id", str(uuid.uuid4()))
    provider = data.get("model", None)
    stream = data.get("stream", False)
    rag_k = data.get("k", 4)
    use_hybrid = data.get("hybrid", False)
    use_reranker = data.get("reranker", False)

    sources = []
    chunks = []

    user_id = g.user["user_id"] if hasattr(g, "user") else None

    @tool
    def search_documents(query: str) -> str:
        """Search the user's uploaded documents. Always use this tool if the user asks about their files, documents, or knowledge base."""
        retrieved = retrieve(
            query=query,
            k=rag_k,
            use_hybrid=use_hybrid,
            use_reranker=use_reranker,
            user_id=user_id,
        )
        if not retrieved:
            return "No relevant documents found."
        
        for d in retrieved:
            if d["source"] not in sources:
                sources.append(d["source"])
            chunks.append({"content": d["content"][:200], "source": d["source"], "score": d.get("score", 0)})
            
        return "\n\n".join([f"[Source: {d['source']}]\n{d['content']}" for d in retrieved])

    # 2. Get conversation history
    history = get_session_history(session_id)

    # Save user message to memory
    save_user_message(session_id, user_message, user_id=user_id)

    try:
        llm = get_llm(provider=provider, streaming=False)
        tools = [calculate, search_web, search_documents]
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are NexusAI, a powerful AI assistant. Answer the user's question. "
                       "You have access to tools for Math, Web Search, and Document Search. "
                       "Only call these tools if absolutely necessary. DO NOT hallucinate tools."),
            MessagesPlaceholder(variable_name="chat_history"),
            ("user", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        agent = create_tool_calling_agent(llm, tools, prompt)
        agent_executor = AgentExecutor(
            agent=agent, 
            tools=tools, 
            verbose=True, 
            handle_parsing_errors=True,
            max_iterations=5
        )

        if stream:
            def generate():
                import time
                reply_text = ""
                try:
                    for chunk in agent_executor.stream({
                        "input": user_message,
                        "chat_history": history,
                    }):
                        if "actions" in chunk:
                            for action in chunk["actions"]:
                                yield f"data: {json.dumps({'tool': action.tool, 'status': 'running'})}\n\n"
                        elif "steps" in chunk:
                            yield f"data: {json.dumps({'tool': 'done', 'status': 'done'})}\n\n"
                        elif "output" in chunk:
                            reply_text = chunk["output"]
                            
                            # Stream the final text chunks
                            chunk_size = 5
                            for i in range(0, len(reply_text), chunk_size):
                                text_chunk = reply_text[i:i+chunk_size]
                                yield f"data: {json.dumps({'chunk': text_chunk})}\n\n"
                                time.sleep(0.01)

                    # Save to memory after stream finishes
                    save_assistant_message(session_id, reply_text, sources, chunks)
                    yield f"data: {json.dumps({'done': True, 'sources': sources, 'chunks': chunks, 'session_id': session_id})}\n\n"
                except Exception as agent_err:
                    print(f"Agent stream failed: {agent_err}")
                    yield f"data: {json.dumps({'error': str(agent_err)})}\n\n"

            return Response(
                generate(),
                mimetype="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                    "Access-Control-Allow-Origin": "*",
                },
            )
        else:
            try:
                result = agent_executor.invoke({
                    "input": user_message,
                    "chat_history": history,
                })
                reply = result["output"]
            except Exception as agent_err:
                print(f"Agent tool call failed, falling back: {agent_err}")
                
                # Fallback retrieve
                fallback_retrieved = retrieve(query=user_message, k=rag_k, use_hybrid=use_hybrid, use_reranker=use_reranker, user_id=user_id)
                context = ""
                if fallback_retrieved:
                    context = "\n\n".join([f"[Source: {d['source']}]\n{d['content']}" for d in fallback_retrieved])
                    for d in fallback_retrieved:
                        if d["source"] not in sources:
                            sources.append(d["source"])
                        chunks.append({"content": d["content"][:200], "source": d["source"], "score": d.get("score", 0)})

                fallback_prompt = ChatPromptTemplate.from_messages([
                    ("system", "You are NexusAI, a powerful AI assistant. Answer the user's question using your general knowledge or the Document Context below.\n\nDocument Context:\n{context}"),
                    MessagesPlaceholder(variable_name="chat_history"),
                    ("user", "{input}")
                ])
                fallback_chain = fallback_prompt | llm
                fallback_result = fallback_chain.invoke({
                    "input": user_message,
                    "chat_history": history,
                    "context": context
                })
                reply = fallback_result.content

            # Save assistant response to memory
            save_assistant_message(session_id, reply, sources, chunks)

        return jsonify({
            "reply": reply,
            "sources": sources,
            "context_used": bool(sources),
            "chunks": chunks,
            "session_id": session_id,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@chat_bp.route("/sessions", methods=["GET"])
@require_auth
def get_sessions():
    """Get all past conversations."""
    try:
        from services.memory_service import list_sessions
        user_id = g.user["user_id"] if hasattr(g, "user") else None
        return jsonify(list_sessions(user_id))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@chat_bp.route("/sessions/<session_id>", methods=["GET"])
@require_auth
def get_session(session_id):
    """Get messages for a specific conversation."""
    try:
        from models import get_conversation_messages
        # We should ideally verify session belongs to user, but models handles it or can be updated
        messages = get_conversation_messages(session_id)
        return jsonify(messages)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _simulate_stream(reply, sources, chunks, session_id):
    """Simulate streaming the final response so the UI doesn't break."""
    def generate():
        import time
        try:
            # yield chunks of the reply
            chunk_size = 5
            for i in range(0, len(reply), chunk_size):
                chunk = reply[i:i+chunk_size]
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                time.sleep(0.01)

            yield f"data: {json.dumps({'done': True, 'sources': sources, 'chunks': chunks, 'session_id': session_id})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
