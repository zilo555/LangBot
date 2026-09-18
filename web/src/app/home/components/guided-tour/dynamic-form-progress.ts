import {
  IDynamicFormItemSchema,
  SYSTEM_FIELD_PREFIX,
} from '@/app/infra/entities/form/dynamic';

function isVisible(
  item: IDynamicFormItemSchema,
  values: Record<string, unknown>,
  externalValues: Record<string, unknown> = {},
) {
  if (!item.show_if || item.show_if.field.startsWith(SYSTEM_FIELD_PREFIX)) {
    return true;
  }
  const actual =
    values[item.show_if.field] ?? externalValues[item.show_if.field];
  if (item.show_if.operator === 'eq') return actual === item.show_if.value;
  if (item.show_if.operator === 'neq') return actual !== item.show_if.value;
  return (
    Array.isArray(item.show_if.value) && item.show_if.value.includes(actual)
  );
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object' && 'primary' in value) {
    return String((value as { primary?: unknown }).primary ?? '').trim() !== '';
  }
  return true;
}

export function areRequiredDynamicFieldsComplete(
  items: IDynamicFormItemSchema[],
  values: Record<string, unknown>,
  externalValues?: Record<string, unknown>,
) {
  return items
    .filter(
      (item) =>
        item.required &&
        !item.name.startsWith(SYSTEM_FIELD_PREFIX) &&
        isVisible(item, values, externalValues),
    )
    .every((item) => hasValue(values[item.name]));
}
