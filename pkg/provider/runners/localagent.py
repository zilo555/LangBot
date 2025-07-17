from __future__ import annotations

import json
import typing
from ...platform.types import message as platform_entities
from .. import runner
from ...core import entities as core_entities
from .. import entities as llm_entities


@runner.runner_class('local-agent')
class LocalAgentRunner(runner.RequestRunner):
    """本地Agent请求运行器"""

    async def run(self, query: core_entities.Query) -> typing.AsyncGenerator[llm_entities.Message, None]:
        """运行请求"""
        pending_tool_calls = []
            

        req_messages = query.prompt.messages.copy() + query.messages.copy() + [query.user_message]

        
        pipeline_uuid = query.pipeline_uuid
        pipeline = await self.ap.pipeline_mgr.get_pipeline_by_uuid(pipeline_uuid)

        try:
            if pipeline and pipeline.pipeline_entity.knowledge_base_uuid is not None:
                kb_id = pipeline.pipeline_entity.knowledge_base_uuid
                kb= await self.ap.rag_mgr.load_knowledge_base(kb_id)
        except Exception as e:
            self.ap.logger.error(f'Failed to load knowledge base {kb_id}: {e}')
            kb_id = None

        if kb:
            message = ''
            for msg in query.message_chain:
                if isinstance(msg, platform_entities.Plain):
                    message += msg.text
            result = await kb.retrieve(message)

            if result:
                rag_context = "\n\n".join(
                    f"[{i+1}] {entry.metadata.get('text', '')}" for i, entry in enumerate(result)
                )
                rag_message = llm_entities.Message(
                    role="user",
                    content="The following are relevant context entries retrieved from the knowledge base. "
                            "Please use them to answer the user's question. "
                            "Respond in the same language as the user's input.\n\n" + rag_context
                )
                req_messages += [rag_message]




        # 首次请求
        msg = await query.use_llm_model.requester.invoke_llm(
            query,
            query.use_llm_model,
            req_messages,
            query.use_funcs,
            extra_args=query.use_llm_model.model_entity.extra_args,
        )

        yield msg

        pending_tool_calls = msg.tool_calls

        req_messages.append(msg)

        # 持续请求，只要还有待处理的工具调用就继续处理调用
        while pending_tool_calls:
            for tool_call in pending_tool_calls:
                try:
                    func = tool_call.function

                    parameters = json.loads(func.arguments)

                    func_ret = await self.ap.tool_mgr.execute_func_call(query, func.name, parameters)

                    msg = llm_entities.Message(
                        role='tool',
                        content=json.dumps(func_ret, ensure_ascii=False),
                        tool_call_id=tool_call.id,
                    )

                    yield msg

                    req_messages.append(msg)
                except Exception as e:
                    # 工具调用出错，添加一个报错信息到 req_messages
                    err_msg = llm_entities.Message(role='tool', content=f'err: {e}', tool_call_id=tool_call.id)

                    yield err_msg

                    req_messages.append(err_msg)

            # 处理完所有调用，再次请求
            msg = await query.use_llm_model.requester.invoke_llm(
                query,
                query.use_llm_model,
                req_messages,
                query.use_funcs,
                extra_args=query.use_llm_model.model_entity.extra_args,
            )

            yield msg

            pending_tool_calls = msg.tool_calls

            req_messages.append(msg)
