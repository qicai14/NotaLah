import { inputClass } from '@/components/Field';
import { cn } from '@/lib/utils';
import type { CollabRole } from '../../types';

const roleLabel = (r: CollabRole) => (r === 'edit' ? 'Can edit' : 'Can view');

/** Role picker for a collaborator, an invite or a request. A native select keeps keyboard and phone behaviour. */
export function RoleSelect({
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  value: CollabRole;
  onChange: (role: CollabRole) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as CollabRole)}
      className={cn(inputClass, 'h-10 w-auto shrink-0 px-3 text-body-sm font-semibold', className)}
    >
      <option value="edit">{roleLabel('edit')}</option>
      <option value="view">{roleLabel('view')}</option>
    </select>
  );
}
