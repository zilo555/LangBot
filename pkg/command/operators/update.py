from __future__ import annotations

import typing

from .. import operator
from langbot_plugin.api.entities.builtin.command import context as command_context


@operator.operator_class(name='update', help='更新程序', usage='!update', privilege=2)
class UpdateCommand(operator.CommandOperator):
    async def execute(
        self, context: command_context.ExecuteContext
    ) -> typing.AsyncGenerator[command_context.CommandReturn, None]:
        yield command_context.CommandReturn(text='不再支持通过命令更新，请查看 LangBot 文档。')
