import {
  DynamicFormItemType,
  IDynamicFormItemSchema,
} from '@/app/infra/entities/form/dynamic';
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
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
        <Switch
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      );

    case DynamicFormItemType.STRING_ARRAY:
      return (
        <div className="space-y-2">
          {field.value.map((item: string, index: number) => (
            <div key={index} className="flex gap-2 items-center">
              <Input
                className="w-[200px]"
                value={item}
                onChange={(e) => {
                  const newValue = [...field.value];
                  newValue[index] = e.target.value;
                  field.onChange(newValue);
                }}
              />
              <button 
                type="button"
                className="p-2 hover:bg-gray-100 rounded"
                onClick={() => {
                  const newValue = field.value.filter((_: string, i: number) => i !== index);
                  field.onChange(newValue);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-red-500">
                  <path d="M7 4V2H17V4H22V6H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V6H2V4H7ZM6 6V20H18V6H6ZM9 9H11V17H9V9ZM13 9H15V17H13V9Z"></path>
                </svg>
              </button>
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
