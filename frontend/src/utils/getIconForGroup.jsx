import React from 'react';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import HomeWorkIcon from '@mui/icons-material/HomeWork';

const getIconForGroup = (group) => {
  switch (group) {
    case 'study':
      return <MenuBookIcon sx={{ mr: 1, color: 'skyblue' }} />;
    case 'game':
      return <SportsEsportsIcon sx={{ mr: 1, color: 'green' }} />;
    case 'workout':
      return <FitnessCenterIcon sx={{ mr: 1, color: 'orange' }} />;
    default:
      return <HomeWorkIcon sx={{ mr: 1, color: 'gray' }} />;
  }
};

export default getIconForGroup;