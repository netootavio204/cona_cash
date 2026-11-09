import React from 'react';
import type { CategoryIconName } from '../../types/database';
import { AppIcon, ICON_LIBRARY } from './iconLibrary';

export const CATEGORY_ICONS_LIST: { id: CategoryIconName | string; label: string }[] =
  ICON_LIBRARY.map((i) => ({ id: i.id, label: i.label }));

export const CategoryIcon: React.FC<{
  name: CategoryIconName | string | null | undefined;
  className?: string;
}> = ({ name, className = 'w-4 h-4' }) => {
  return <AppIcon name={name} className={className} />;
};
