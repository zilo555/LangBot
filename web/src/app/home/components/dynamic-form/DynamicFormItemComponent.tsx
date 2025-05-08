import {
  DynamicFormItemType,
  IDynamicFormItemSchema,
} from '@/app/infra/entities/form/dynamic';
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ControllerRenderProps } from "react-hook-form";
import { Button } from "@/components/ui/button";

export default function DynamicFormItemComponent({
  config,
  field,
}: {
  config: IDynamicFormItemSchema;
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
        <div className="space-y-2">
          {field.value.map((item: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                value={item}
                onChange={(e) => {
                  const newValue = [...field.value];
                  newValue[index] = e.target.value;
                  field.onChange(newValue);
                }}
              />
              <Button
                variant="destructive"
                onClick={() => {
                  const newValue = field.value.filter((_: string, i: number) => i !== index);
                  field.onChange(newValue);
                }}
              >
                删除
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => {
              field.onChange([...field.value, '']);
            }}
          >
            添加
          </Button>
        </div>
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
              {config.options?.map((option) => (
                <SelectItem key={option.name} value={option.name}>
                  {option.label.zh_CN}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      );

    default:
      return <Input {...field} />;
  }
}
