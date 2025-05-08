// import { Form, Input, InputNumber, Select, Switch } from 'antd';
import {
  DynamicFormItemType,
  IDynamicFormItemConfig,
} from '@/app/home/components/dynamic-form/DynamicFormItemConfig';
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ControllerRenderProps } from "react-hook-form";

export default function DynamicFormItemComponent({
  config,
  field,
}: {
  config: IDynamicFormItemConfig;
  field: ControllerRenderProps<any, any>;
}) {
  switch (config.type) {
    case DynamicFormItemType.INT:
    case DynamicFormItemType.FLOAT:
      return (
        <Input
          type="number"
          {...field}
          onChange={(e) => field.onChange(Number(e.target.value))}
        />
      );

    case DynamicFormItemType.STRING:
      return <Input {...field} />;

    case DynamicFormItemType.BOOLEAN:
      return (
        <Checkbox
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      );

    case DynamicFormItemType.STRING_ARRAY:
      return (
        <Select
          value={field.value}
          onValueChange={field.onChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="请选择" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {/* 这里需要根据实际情况添加选项 */}
              <SelectItem value="option1">选项1</SelectItem>
              <SelectItem value="option2">选项2</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      );

    case DynamicFormItemType.SELECT:
      return (
        <Select
          value={field.value}
          onValueChange={field.onChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="请选择" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {/* 这里需要根据实际情况添加选项 */}
              <SelectItem value="option1">选项1</SelectItem>
              <SelectItem value="option2">选项2</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      );

    default:
      return <Input {...field} />;
  }
}
