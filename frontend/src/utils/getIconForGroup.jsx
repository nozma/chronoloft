import React from 'react';
import iconMapping from './iconMapping';

const getIconForGroup = (group, groups) => {
  const currentGroup = groups.find(g => g.name === group);
  const customIconName = (currentGroup && currentGroup.icon_name) ? currentGroup.icon_name : 'HomeWorkIcon';
  const customIconColor = (currentGroup && currentGroup.icon_color) ? currentGroup.icon_color : 'gray';

  if (customIconName && iconMapping[customIconName]) {
    const IconComponent = iconMapping[customIconName];
    return <IconComponent sx={{ mr: 1, color: customIconColor }} />;
  } else {
    const DefaultIcon = iconMapping.HomeWorkIcon;
    return <DefaultIcon sx={{ mr: 1, color: 'gray' }} />;
  }
};

export default getIconForGroup;